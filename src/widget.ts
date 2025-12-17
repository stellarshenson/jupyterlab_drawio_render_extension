import { DocumentWidget } from '@jupyterlab/docregistry';
import { ABCWidgetFactory, DocumentRegistry } from '@jupyterlab/docregistry';
import { PromiseDelegate } from '@lumino/coreutils';
import { Widget } from '@lumino/widgets';
import { PageConfig } from '@jupyterlab/coreutils';

// Declare GraphViewer on window
declare global {
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

function ensureViewerReady(): Promise<void> {
  if (viewerReady) {
    return viewerReady;
  }

  viewerReady = new Promise((resolve) => {
    // If already loaded, resolve immediately
    if (window.GraphViewer) {
      resolve();
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

    // Load viewer script from server static endpoint
    const baseUrl = PageConfig.getBaseUrl();
    const viewerUrl = `${baseUrl}jupyterlab-drawio-render-extension/static/viewer-static.min.js`;

    console.log('[DrawIO] Loading viewer from:', viewerUrl);

    const script = document.createElement('script');

    script.onload = () => {
      console.log('[DrawIO] Viewer script loaded successfully');

      // Wait a tick for script to initialize
      setTimeout(() => {
        if (window.GraphViewer) {
          console.log('[DrawIO] GraphViewer available');
          resolve();
        } else {
          console.error('[DrawIO] GraphViewer not found after script load');
          resolve();
        }
      }, 100);
    };

    script.onerror = (e) => {
      console.error('[DrawIO] Failed to load viewer script:', e);
      resolve();
    };

    script.src = viewerUrl;
    document.head.appendChild(script);
  });

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
      console.error('Error loading Draw.io diagram:', error);
      this._showError(error);
      this._ready.reject(error);
    }
  }

  /**
   * Render the diagram using GraphViewer
   */
  private async _renderDiagram(xmlContent: string): Promise<void> {
    console.log('[DrawIO] Starting render with GraphViewer...');

    // Wait for GraphViewer to be available
    await ensureViewerReady();

    if (!window.GraphViewer) {
      throw new Error('GraphViewer not available - viewer library failed to load');
    }

    console.log('[DrawIO] GraphViewer available');

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
    const config = {
      highlight: '#0000ff',
      nav: true,
      resize: true,
      toolbar: 'zoom layers lightbox',
      edit: null,
      xml: xmlContent
    };

    // Set data-mxgraph attribute with configuration
    mxgraphDiv.setAttribute('data-mxgraph', JSON.stringify(config));
    viewerContainer.appendChild(mxgraphDiv);

    console.log('[DrawIO] Processing element with GraphViewer...');

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
      console.log('[DrawIO] GraphViewer render complete');
    } catch (e) {
      console.error('[DrawIO] GraphViewer error:', e);
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
   * Dispose of resources
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }

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
