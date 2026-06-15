import { DocumentWidget } from '@jupyterlab/docregistry';
import { ABCWidgetFactory, DocumentRegistry } from '@jupyterlab/docregistry';
import { PromiseDelegate } from '@lumino/coreutils';
import { Widget } from '@lumino/widgets';
import { PageConfig } from '@jupyterlab/coreutils';

// Declare GraphViewer on window
declare global {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface Window {
    GraphViewer: any;
    mxGraphModel: any;
    mxCell: any;
    mxGeometry: any;
    mxPoint: any;
    mxGraph: any;
    mxClient: any;
    mxUtils: any;
    mxCodec: any;
    mxEvent: any;
    Graph: any;
    mxResources: any;
    mxLoadResources: boolean;
    mxLoadStylesheets: boolean;
    mxBasePath: string;
    mxImageBasePath: string;
    STENCIL_PATH: string;
    SHAPES_PATH: string;
    STYLE_PATH: string;
    PROXY_URL: string;
    DRAW_MATH_URL: string;
    GRAPH_IMAGE_PATH: string;
  }
}

// Promise that resolves when GraphViewer is available
let viewerReady: Promise<void> | null = null;

// Current background setting
let currentBackground: string = 'default';
let customBackgroundColor: string = '#ffffff';

// Export settings
let exportDPI: number = 300;
let exportBackground: string = 'white';

// Track all active widgets for background updates
const activeWidgets: Set<DrawioWidget> = new Set();

/**
 * Set the custom background color
 */
export function setCustomBackgroundColor(color: string): void {
  customBackgroundColor = color;
  // If currently using custom, update all widgets
  if (currentBackground === 'custom') {
    activeWidgets.forEach(widget =>
      widget.updateBackground('custom', customBackgroundColor)
    );
  }
}

/**
 * Set the background for all Draw.io viewers
 */
export function setBackground(background: string): void {
  currentBackground = background;
  activeWidgets.forEach(widget =>
    widget.updateBackground(background, customBackgroundColor)
  );
}

/**
 * Set the export DPI
 */
export function setExportDPI(dpi: number): void {
  exportDPI = dpi;
}

/**
 * Set the export background
 */
export function setExportBackground(background: string): void {
  exportBackground = background;
}

/**
 * Get export settings
 */
export function getExportSettings(): {
  dpi: number;
  background: string;
  customColor: string;
} {
  return {
    dpi: exportDPI,
    background: exportBackground,
    customColor: customBackgroundColor
  };
}

/**
 * Convert SVG element to PNG blob, cropped to diagram content
 */
async function svgToPng(
  svg: SVGSVGElement,
  targetDPI: number,
  background: string,
  customColor: string
): Promise<Blob> {
  // Get the actual bounding box of content from original SVG
  const bbox = svg.getBBox();

  // Add padding around the content (10 pixels)
  const padding = 10;
  const cropX = bbox.x - padding;
  const cropY = bbox.y - padding;
  const cropWidth = bbox.width + padding * 2;
  const cropHeight = bbox.height + padding * 2;

  // Use 96 DPI as source (standard screen DPI)
  const sourceDPI = 96;
  const scale = targetDPI / sourceDPI;

  // Create canvas at target resolution
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(cropWidth * scale);
  canvas.height = Math.ceil(cropHeight * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Set background
  if (background !== 'transparent') {
    let bgColor: string;
    switch (background) {
      case 'white':
        bgColor = '#ffffff';
        break;
      case 'black':
        bgColor = '#000000';
        break;
      case 'custom':
        bgColor = customColor;
        break;
      default:
        bgColor = '#ffffff';
    }
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Enable high-quality rendering
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Clone SVG and set viewBox to crop to content
  const svgClone = svg.cloneNode(true) as SVGSVGElement;
  svgClone.setAttribute('viewBox', `${cropX} ${cropY} ${cropWidth} ${cropHeight}`);
  svgClone.setAttribute('width', String(cropWidth));
  svgClone.setAttribute('height', String(cropHeight));
  // Remove any inline width/height styles that might override attributes
  svgClone.style.width = '';
  svgClone.style.height = '';

  // Serialize SVG to string and create data URI
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgClone);
  const svgBase64 = btoa(unescape(encodeURIComponent(svgString)));
  const dataUri = `data:image/svg+xml;base64,${svgBase64}`;

  // Load SVG as image and draw to canvas
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        blob => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create PNG blob'));
          }
        },
        'image/png',
        1.0
      );
    };
    img.onerror = () => reject(new Error('Failed to load SVG as image'));
    img.src = dataUri;
  });
}

/**
 * Copy PNG blob to clipboard
 */
async function copyPngToClipboard(blob: Blob): Promise<void> {
  const clipboardItem = new ClipboardItem({ 'image/png': blob });
  await navigator.clipboard.write([clipboardItem]);
}

/**
 * Download PNG blob as file
 */
function downloadPng(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate PNG filename from document path
 */
function generatePngFilename(documentPath: string): string {
  // Remove extension and get base name
  const baseName = documentPath
    .replace(/\.[^/.]+$/, '')
    .split('/')
    .pop();
  return `${baseName || 'diagram'}.png`;
}

/**
 * Load a script and return a promise
 */
function loadScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
    script.src = url;
    document.head.appendChild(script);
  });
}

function ensureViewerReady(): Promise<void> {
  if (viewerReady) {
    return viewerReady;
  }

  viewerReady = (async () => {
    // If already loaded, return immediately
    if (window.GraphViewer) {
      return;
    }

    // Set up globals BEFORE loading viewer to prevent external resource loading
    window.mxLoadResources = false;
    window.mxLoadStylesheets = false;
    window.mxBasePath = '';
    window.mxImageBasePath = '';
    window.STENCIL_PATH = '';
    window.SHAPES_PATH = '';
    window.STYLE_PATH = '';
    window.PROXY_URL = '';
    window.DRAW_MATH_URL = '';
    window.GRAPH_IMAGE_PATH = '';

    // Load scripts in order from server static endpoint
    const baseUrl = PageConfig.getBaseUrl();
    const staticBase = `${baseUrl}jupyterlab-drawio-render-extension/static`;

    // Load viewer first
    await loadScript(`${staticBase}/viewer-static.min.js`);

    // Wait a tick for viewer to initialize
    await new Promise(resolve => setTimeout(resolve, 100));

    // Load shapes and stencils for custom shape support (Veeam, Cisco, etc.)
    await loadScript(`${staticBase}/shapes.min.js`);
    await loadScript(`${staticBase}/stencils.min.js`);

    // Wait for stencils to register
    await new Promise(resolve => setTimeout(resolve, 100));
  })();

  return viewerReady;
}

/**
 * A widget for displaying Draw.io diagrams using the official GraphViewer
 */
export class DrawioWidget extends Widget {
  private _context: DocumentRegistry.Context;
  private _ready = new PromiseDelegate<void>();
  private _container: HTMLDivElement;
  private _errorDiv: HTMLDivElement;

  constructor(context: DocumentRegistry.Context) {
    super();
    this._context = context;

    this.addClass('jp-DrawioWidget');
    this.title.label = context.localPath;

    // Create container for diagram
    this._container = document.createElement('div');
    this._container.className = 'jp-DrawioWidget-container';

    // Create error display div
    this._errorDiv = document.createElement('div');
    this._errorDiv.className = 'jp-DrawioWidget-error';
    this._errorDiv.style.display = 'none';

    this.node.appendChild(this._errorDiv);
    this.node.appendChild(this._container);

    // Register widget for background updates
    activeWidgets.add(this);

    // Apply current background setting
    this.updateBackground(currentBackground, customBackgroundColor);

    // Load and render the diagram
    void this._loadDiagram();

    // Listen for content changes (file reload)
    context.ready.then(() => {
      context.model.contentChanged.connect(this._onContentChanged, this);
    });
  }

  /**
   * A promise that resolves when the widget is ready.
   */
  get ready(): Promise<void> {
    return this._ready.promise;
  }

  /**
   * Update the background color of the viewer
   */
  updateBackground(background: string, customColor?: string): void {
    // Remove existing background classes
    this.node.classList.remove(
      'jp-DrawioWidget-bg-default',
      'jp-DrawioWidget-bg-black',
      'jp-DrawioWidget-bg-white',
      'jp-DrawioWidget-bg-custom'
    );

    if (background === 'custom' && customColor) {
      // Apply custom color directly via CSS variable
      this.node.style.setProperty('--jp-drawio-custom-bg', customColor);
      this.node.classList.add('jp-DrawioWidget-bg-custom');
    } else {
      // Remove custom color property and add preset class
      this.node.style.removeProperty('--jp-drawio-custom-bg');
      this.node.classList.add(`jp-DrawioWidget-bg-${background}`);
    }
  }

  /**
   * Load the diagram from context
   */
  private async _loadDiagram(): Promise<void> {
    try {
      this._container.innerHTML = `
        <div class="jp-DrawioWidget-loading">
          <div>Loading Draw.io diagram...</div>
        </div>
      `;

      await this._context.ready;

      const content = this._context.model.toString();

      if (!content || content.trim() === '') {
        throw new Error('Empty diagram file');
      }

      await this._renderDiagram(content);

      this._ready.resolve();
    } catch (error) {
      this._showError(error);
      this._ready.reject(error);
    }
  }

  /**
   * Render the diagram using GraphViewer
   */
  private async _renderDiagram(xmlContent: string): Promise<void> {
    // Wait for GraphViewer to be available
    await ensureViewerReady();

    if (!window.GraphViewer) {
      throw new Error(
        'GraphViewer not available - viewer library failed to load'
      );
    }

    // Clear container
    this._container.innerHTML = '';
    this._errorDiv.style.display = 'none';
    this._container.style.display = 'block';

    // Create viewer container
    const viewerContainer = document.createElement('div');
    viewerContainer.className = 'jp-DrawioWidget-viewer';
    viewerContainer.style.width = '100%';
    viewerContainer.style.height = '100%';
    viewerContainer.style.overflow = 'auto';
    this._container.appendChild(viewerContainer);

    // Create the mxgraph div that GraphViewer expects
    const mxgraphDiv = document.createElement('div');
    mxgraphDiv.className = 'mxgraph';
    mxgraphDiv.style.width = '100%';
    mxgraphDiv.style.height = '100%';

    // Configure GraphViewer options
    // resize: false keeps the graph container at the fixed viewport size so it
    // gets its own overflow:auto - this is what enables full-range scrollbars
    // and drag-to-pan when zoomed in. auto-fit fits a large diagram on open.
    const config = {
      highlight: '#0000ff',
      nav: true,
      resize: false,
      'auto-fit': true,
      toolbar: 'zoom layers lightbox',
      'toolbar-position': 'top',
      edit: null,
      xml: xmlContent
    };

    // Set data-mxgraph attribute with configuration
    mxgraphDiv.setAttribute('data-mxgraph', JSON.stringify(config));
    viewerContainer.appendChild(mxgraphDiv);

    // Use GraphViewer to render
    try {
      // GraphViewer.processElements processes all .mxgraph divs
      // But we can also create a viewer directly for more control
      if (window.GraphViewer.createViewerForElement) {
        window.GraphViewer.createViewerForElement(mxgraphDiv);
      } else {
        // Fallback to processElements
        window.GraphViewer.processElements(viewerContainer);
      }
    } catch (e) {
      throw new Error('GraphViewer failed to render: ' + (e as Error).message);
    }
  }

  /**
   * Handle content change signal
   */
  private _onContentChanged(): void {
    void this._loadDiagram();
  }

  /**
   * Show error message
   */
  private _showError(error: any): void {
    this._container.style.display = 'none';
    this._errorDiv.style.display = 'block';

    const message = error?.message || String(error);

    this._errorDiv.innerHTML = `
      <div class="jp-DrawioWidget-errorContent">
        <h3>Failed to load Draw.io diagram</h3>
        <p><strong>Error:</strong> ${this._escapeHtml(message)}</p>
        <div class="jp-DrawioWidget-troubleshooting">
          <strong>Troubleshooting:</strong>
          <ul>
            <li>Verify the file is a valid Draw.io/diagrams.net XML file</li>
            <li>Check that the file is not corrupted</li>
            <li>Try opening the file in Draw.io to verify it works</li>
          </ul>
        </div>
      </div>
    `;
  }

  /**
   * Escape HTML to prevent XSS
   */
  private _escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get the document path for filename generation
   */
  getDocumentPath(): string {
    return this._context.localPath;
  }

  /**
   * Get the SVG element from the rendered diagram
   */
  getSvgElement(): SVGSVGElement | null {
    // GraphViewer renders SVG inside the container
    const svg = this._container.querySelector('svg');
    return svg as SVGSVGElement | null;
  }

  /**
   * Export diagram as PNG blob
   */
  async exportAsPng(): Promise<Blob | null> {
    const svg = this.getSvgElement();
    if (!svg) {
      return null;
    }

    const settings = getExportSettings();
    return svgToPng(
      svg,
      settings.dpi,
      settings.background,
      settings.customColor
    );
  }

  /**
   * Copy diagram as PNG to clipboard
   */
  async copyAsPng(): Promise<void> {
    const blob = await this.exportAsPng();
    if (!blob) {
      throw new Error('No diagram to export');
    }
    await copyPngToClipboard(blob);
  }

  /**
   * Download diagram as PNG file
   */
  async downloadAsPng(): Promise<void> {
    const blob = await this.exportAsPng();
    if (!blob) {
      throw new Error('No diagram to export');
    }
    const filename = generatePngFilename(this.getDocumentPath());
    downloadPng(blob, filename);
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }

    // Unregister widget from background updates
    activeWidgets.delete(this);

    this._context.model.contentChanged.disconnect(this._onContentChanged, this);

    super.dispose();
  }
}

/**
 * A widget factory for Draw.io diagrams
 */
export class DrawioFactory extends ABCWidgetFactory<
  DocumentWidget<DrawioWidget>,
  DocumentRegistry.IModel
> {
  /**
   * Create a new widget given a context.
   */
  protected createNewWidget(
    context: DocumentRegistry.Context
  ): DocumentWidget<DrawioWidget> {
    const content = new DrawioWidget(context);
    const widget = new DocumentWidget({ content, context });

    return widget;
  }
}
