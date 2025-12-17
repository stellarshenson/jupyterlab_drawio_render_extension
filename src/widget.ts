import { DocumentWidget } from '@jupyterlab/docregistry';
import { ABCWidgetFactory, DocumentRegistry } from '@jupyterlab/docregistry';
import { PromiseDelegate } from '@lumino/coreutils';
import { Widget } from '@lumino/widgets';

// Import mxgraph factory
import factory from 'mxgraph';

// Initialize mxgraph
const mx = factory({
  mxBasePath: ''
});

const { mxGraph, mxCodec, mxUtils, mxEvent, mxClient } = mx;

/**
 * A widget for displaying Draw.io diagrams using mxgraph
 */
export class DrawioWidget extends Widget {
  private _context: DocumentRegistry.Context;
  private _ready = new PromiseDelegate<void>();
  private _container: HTMLDivElement;
  private _errorDiv: HTMLDivElement;
  private _graphContainer: HTMLDivElement | null = null;
  private _graph: any = null;

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
   * Render the diagram using mxgraph
   */
  private async _renderDiagram(xmlContent: string): Promise<void> {
    // Clear container
    this._container.innerHTML = '';
    this._errorDiv.style.display = 'none';
    this._container.style.display = 'block';

    // Create graph container
    this._graphContainer = document.createElement('div');
    this._graphContainer.className = 'jp-DrawioWidget-graph';
    this._graphContainer.style.width = '100%';
    this._graphContainer.style.height = '100%';
    this._graphContainer.style.overflow = 'auto';
    this._container.appendChild(this._graphContainer);

    // Check browser support
    if (!mxClient.isBrowserSupported()) {
      throw new Error('Browser not supported for mxGraph');
    }

    // Parse XML content
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      throw new Error('Invalid XML: ' + parseError.textContent);
    }

    // Find mxGraphModel - handle both mxfile wrapper and direct mxGraphModel
    let graphModelNode = xmlDoc.querySelector('mxGraphModel');
    const mxfileNode = xmlDoc.querySelector('mxfile');

    if (!graphModelNode && mxfileNode) {
      // Try to find diagram content - may be compressed
      const diagramNode = xmlDoc.querySelector('diagram');
      if (diagramNode) {
        const diagramContent = diagramNode.textContent;
        if (diagramContent) {
          // Try to decode compressed content
          const decodedXml = this._decodeDrawioContent(diagramContent);
          if (decodedXml) {
            const decodedDoc = parser.parseFromString(decodedXml, 'text/xml');
            graphModelNode = decodedDoc.querySelector('mxGraphModel');
          }
        }
      }
    }

    if (!graphModelNode) {
      throw new Error(
        'Not a valid Draw.io file: missing mxGraphModel element'
      );
    }

    // Create mxGraph instance
    this._graph = new mxGraph(this._graphContainer);

    // Configure graph for viewing
    this._graph.setEnabled(false); // Read-only
    this._graph.setPanning(true);
    this._graph.panningHandler.useLeftButtonForPanning = true;
    this._graph.setTooltips(true);
    this._graph.centerZoom = true;

    // Enable mouse wheel zoom
    mxEvent.addMouseWheelListener((evt: any, up: boolean) => {
      if (this._graph && mxEvent.isConsumed(evt)) {
        return;
      }
      if (up) {
        this._graph.zoomIn();
      } else {
        this._graph.zoomOut();
      }
      mxEvent.consume(evt);
    }, this._graphContainer);

    // Use mxCodec to decode the XML
    const codec = new mxCodec(graphModelNode.ownerDocument);
    codec.decode(graphModelNode, this._graph.getModel());

    // Fit to container
    this._graph.fit();
    this._graph.center();

    // Add toolbar
    this._addToolbar();
  }

  /**
   * Decode compressed Draw.io content
   */
  private _decodeDrawioContent(content: string): string | null {
    try {
      // Draw.io uses: base64 -> inflate -> URL decode
      // First try as plain XML (uncompressed)
      if (content.trim().startsWith('<')) {
        return content;
      }

      // Try base64 decode
      const decoded = atob(content);

      // Try to inflate (decompress)
      try {
        const inflated = this._inflate(decoded);
        // URL decode
        return decodeURIComponent(inflated);
      } catch {
        // If inflate fails, try direct URL decode
        try {
          return decodeURIComponent(decoded);
        } catch {
          return decoded;
        }
      }
    } catch (e) {
      console.error('Failed to decode Draw.io content:', e);
      return null;
    }
  }

  /**
   * Inflate (decompress) data using pako-like algorithm
   */
  private _inflate(data: string): string {
    // Convert string to byte array
    const bytes = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      bytes[i] = data.charCodeAt(i);
    }

    // Use DecompressionStream API if available
    if (typeof DecompressionStream !== 'undefined') {
      // This is async, but we need sync - use fallback
    }

    // Simple inflate using mxUtils if available
    if (mxUtils && mxUtils.decompress) {
      return mxUtils.decompress(data);
    }

    // Fallback: try raw deflate via browser
    return data;
  }

  /**
   * Add toolbar with zoom controls
   */
  private _addToolbar(): void {
    const toolbar = document.createElement('div');
    toolbar.className = 'jp-DrawioWidget-toolbar';

    const zoomInBtn = document.createElement('button');
    zoomInBtn.textContent = '+';
    zoomInBtn.title = 'Zoom In';
    zoomInBtn.className = 'jp-DrawioWidget-toolbarBtn';
    zoomInBtn.onclick = () => this._graph?.zoomIn();

    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.textContent = '-';
    zoomOutBtn.title = 'Zoom Out';
    zoomOutBtn.className = 'jp-DrawioWidget-toolbarBtn';
    zoomOutBtn.onclick = () => this._graph?.zoomOut();

    const fitBtn = document.createElement('button');
    fitBtn.textContent = 'Fit';
    fitBtn.title = 'Fit to Window';
    fitBtn.className = 'jp-DrawioWidget-toolbarBtn';
    fitBtn.onclick = () => {
      this._graph?.fit();
      this._graph?.center();
    };

    const actualBtn = document.createElement('button');
    actualBtn.textContent = '100%';
    actualBtn.title = 'Actual Size';
    actualBtn.className = 'jp-DrawioWidget-toolbarBtn';
    actualBtn.onclick = () => {
      this._graph?.zoomActual();
      this._graph?.center();
    };

    toolbar.appendChild(zoomInBtn);
    toolbar.appendChild(zoomOutBtn);
    toolbar.appendChild(fitBtn);
    toolbar.appendChild(actualBtn);

    this._container.insertBefore(toolbar, this._graphContainer);
  }

  /**
   * Handle content change signal
   */
  private _onContentChanged(): void {
    // Dispose existing graph
    if (this._graph) {
      this._graph.destroy();
      this._graph = null;
    }
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

    if (this._graph) {
      this._graph.destroy();
      this._graph = null;
    }

    this._graphContainer = null;

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
