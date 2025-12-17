import { DocumentWidget } from '@jupyterlab/docregistry';
import { ABCWidgetFactory, DocumentRegistry } from '@jupyterlab/docregistry';
import { PromiseDelegate } from '@lumino/coreutils';
import { Widget } from '@lumino/widgets';

/**
 * A widget for displaying Draw.io diagrams as SVG
 */
export class DrawioWidget extends Widget {
  private _context: DocumentRegistry.Context;
  private _ready = new PromiseDelegate<void>();
  private _container: HTMLDivElement;
  private _errorDiv: HTMLDivElement;
  private _toolbar: HTMLDivElement;
  private _currentPage = 0;
  private _totalPages = 1;
  private _diagramXml: string | null = null;

  constructor(context: DocumentRegistry.Context) {
    super();
    this._context = context;

    this.addClass('jp-DrawioWidget');
    this.title.label = context.localPath;

    // Create toolbar for page navigation
    this._toolbar = document.createElement('div');
    this._toolbar.className = 'jp-DrawioWidget-toolbar';
    this._toolbar.style.display = 'none';

    // Create container for diagram
    this._container = document.createElement('div');
    this._container.className = 'jp-DrawioWidget-container';

    // Create error display div
    this._errorDiv = document.createElement('div');
    this._errorDiv.className = 'jp-DrawioWidget-error';
    this._errorDiv.style.display = 'none';

    this.node.appendChild(this._toolbar);
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
          <div>Loading diagram...</div>
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
   * Parse and render the diagram XML
   */
  private async _renderDiagram(xmlContent: string): Promise<void> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');

    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error('Invalid XML: ' + parseError.textContent);
    }

    this._diagramXml = xmlContent;

    const diagrams = doc.querySelectorAll('diagram');
    this._totalPages = diagrams.length || 1;

    if (this._totalPages > 1) {
      this._setupPageNavigation();
    }

    await this._renderPage(this._currentPage);
  }

  /**
   * Render a specific page of the diagram
   */
  private async _renderPage(pageIndex: number): Promise<void> {
    if (!this._diagramXml) {
      return;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(this._diagramXml, 'text/xml');
    const diagrams = doc.querySelectorAll('diagram');

    if (diagrams.length === 0) {
      const mxGraphModel = doc.querySelector('mxGraphModel');
      if (mxGraphModel) {
        this._renderMxGraphModel(mxGraphModel);
        return;
      }
      throw new Error('No diagram content found');
    }

    const diagram = diagrams[pageIndex];
    if (!diagram) {
      throw new Error(`Page ${pageIndex + 1} not found`);
    }

    // Check for embedded mxGraphModel first (uncompressed format)
    const embeddedModel = diagram.querySelector('mxGraphModel');
    if (embeddedModel) {
      this._renderMxGraphModel(embeddedModel);
      return;
    }

    // Get diagram content - may be compressed
    let diagramContent = diagram.textContent || '';

    if (diagramContent && !diagramContent.includes('<mxGraphModel')) {
      try {
        diagramContent = await this._decompressDiagram(diagramContent);
      } catch (e) {
        console.warn('Decompression failed, trying raw content:', e);
      }
    }

    if (diagramContent.includes('<mxGraphModel')) {
      const innerDoc = parser.parseFromString(diagramContent, 'text/xml');
      const mxGraphModel = innerDoc.querySelector('mxGraphModel');
      if (mxGraphModel) {
        this._renderMxGraphModel(mxGraphModel);
        return;
      }
    }

    throw new Error('Could not parse diagram content');
  }

  /**
   * Decompress Draw.io compressed diagram data
   */
  private async _decompressDiagram(compressed: string): Promise<string> {
    // Draw.io uses URL-safe base64 + deflate compression
    const decoded = atob(compressed.replace(/-/g, '+').replace(/_/g, '/'));

    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      bytes[i] = decoded.charCodeAt(i);
    }

    // Use DecompressionStream API
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();

    const reader = ds.readable.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunks.push(value);
    }

    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return decodeURIComponent(new TextDecoder().decode(result));
  }

  /**
   * Render mxGraphModel as SVG
   */
  private _renderMxGraphModel(model: Element): void {
    const svg = this._mxGraphToSvg(model);
    this._container.innerHTML = '';
    this._container.appendChild(svg);
  }

  /**
   * Convert mxGraphModel to SVG element
   */
  private _mxGraphToSvg(model: Element): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'jp-DrawioWidget-svg');

    // Add arrow marker definition
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L0,6 L9,3 z" fill="#000000"/>
      </marker>
      <marker id="arrow-open" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L9,3 L0,6" fill="none" stroke="#000000" stroke-width="1"/>
      </marker>
    `;
    svg.appendChild(defs);

    const root = model.querySelector('root');
    if (!root) {
      svg.innerHTML += '<text x="50" y="50">Empty diagram</text>';
      return svg;
    }

    const cells = root.querySelectorAll('mxCell');
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity;

    // First pass: collect vertices for edge routing
    const vertices: Map<
      string,
      { x: number; y: number; width: number; height: number }
    > = new Map();

    cells.forEach(cell => {
      const id = cell.getAttribute('id') || '';
      const geometry = cell.querySelector('mxGeometry');
      const vertex = cell.getAttribute('vertex') === '1';

      if (geometry && vertex) {
        const x = parseFloat(geometry.getAttribute('x') || '0');
        const y = parseFloat(geometry.getAttribute('y') || '0');
        const width = parseFloat(geometry.getAttribute('width') || '100');
        const height = parseFloat(geometry.getAttribute('height') || '40');
        vertices.set(id, { x, y, width, height });
      }
    });

    // Second pass: render shapes and edges
    cells.forEach(cell => {
      const geometry = cell.querySelector('mxGeometry');
      const style = cell.getAttribute('style') || '';
      const value = cell.getAttribute('value') || '';
      const vertex = cell.getAttribute('vertex') === '1';
      const edge = cell.getAttribute('edge') === '1';

      if (geometry && vertex) {
        const x = parseFloat(geometry.getAttribute('x') || '0');
        const y = parseFloat(geometry.getAttribute('y') || '0');
        const width = parseFloat(geometry.getAttribute('width') || '100');
        const height = parseFloat(geometry.getAttribute('height') || '40');

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + width);
        maxY = Math.max(maxY, y + height);

        const shape = this._createShape(x, y, width, height, style, value);
        if (shape) {
          g.appendChild(shape);
        }
      }

      if (edge) {
        const source = cell.getAttribute('source') || '';
        const target = cell.getAttribute('target') || '';
        const edgePath = this._createEdge(
          cell,
          style,
          vertices.get(source),
          vertices.get(target)
        );
        if (edgePath) {
          g.appendChild(edgePath);
        }
      }
    });

    // Set viewBox with padding
    const padding = 30;
    if (minX !== Infinity) {
      const viewBox = `${minX - padding} ${minY - padding} ${maxX - minX + 2 * padding} ${maxY - minY + 2 * padding}`;
      svg.setAttribute('viewBox', viewBox);
    } else {
      svg.setAttribute('viewBox', '0 0 400 300');
    }

    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.appendChild(g);

    return svg;
  }

  /**
   * Create SVG shape from mxCell
   */
  private _createShape(
    x: number,
    y: number,
    width: number,
    height: number,
    style: string,
    value: string
  ): SVGGElement | null {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    const styles = this._parseStyle(style);
    const shape = styles.shape || '';
    const fillColor = styles.fillColor || '#ffffff';
    const strokeColor = styles.strokeColor || '#000000';
    const strokeWidth = styles.strokeWidth || '1';
    const fontColor = styles.fontColor || '#000000';
    const fontSize = styles.fontSize || '12';

    let shapeElement: SVGElement;

    if (shape === 'ellipse' || style.includes('ellipse')) {
      shapeElement = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'ellipse'
      );
      shapeElement.setAttribute('cx', String(x + width / 2));
      shapeElement.setAttribute('cy', String(y + height / 2));
      shapeElement.setAttribute('rx', String(width / 2));
      shapeElement.setAttribute('ry', String(height / 2));
    } else if (shape === 'rhombus' || style.includes('rhombus')) {
      shapeElement = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'polygon'
      );
      const points = `${x + width / 2},${y} ${x + width},${y + height / 2} ${x + width / 2},${y + height} ${x},${y + height / 2}`;
      shapeElement.setAttribute('points', points);
    } else if (shape === 'hexagon' || style.includes('hexagon')) {
      shapeElement = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'polygon'
      );
      const hw = width / 4;
      const points = `${x + hw},${y} ${x + width - hw},${y} ${x + width},${y + height / 2} ${x + width - hw},${y + height} ${x + hw},${y + height} ${x},${y + height / 2}`;
      shapeElement.setAttribute('points', points);
    } else if (shape === 'triangle' || style.includes('triangle')) {
      shapeElement = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'polygon'
      );
      const points = `${x + width / 2},${y} ${x + width},${y + height} ${x},${y + height}`;
      shapeElement.setAttribute('points', points);
    } else if (shape === 'cylinder' || style.includes('cylinder')) {
      // Simplified cylinder as rectangle with rounded top/bottom
      shapeElement = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'rect'
      );
      shapeElement.setAttribute('x', String(x));
      shapeElement.setAttribute('y', String(y));
      shapeElement.setAttribute('width', String(width));
      shapeElement.setAttribute('height', String(height));
      shapeElement.setAttribute('rx', String(width / 4));
      shapeElement.setAttribute('ry', String(height / 8));
    } else {
      // Default rectangle
      shapeElement = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'rect'
      );
      shapeElement.setAttribute('x', String(x));
      shapeElement.setAttribute('y', String(y));
      shapeElement.setAttribute('width', String(width));
      shapeElement.setAttribute('height', String(height));

      if (styles.rounded === '1') {
        shapeElement.setAttribute('rx', '5');
        shapeElement.setAttribute('ry', '5');
      }
    }

    // Handle fill
    if (styles.fillColor === 'none' || style.includes('fillColor=none')) {
      shapeElement.setAttribute('fill', 'none');
    } else {
      shapeElement.setAttribute('fill', fillColor);
    }

    shapeElement.setAttribute('stroke', strokeColor);
    shapeElement.setAttribute('stroke-width', strokeWidth);

    // Handle dashed lines
    if (styles.dashed === '1') {
      shapeElement.setAttribute('stroke-dasharray', '5,3');
    }

    g.appendChild(shapeElement);

    // Add text label
    if (value) {
      const text = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'text'
      );
      text.setAttribute('x', String(x + width / 2));
      text.setAttribute('y', String(y + height / 2));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('font-family', 'sans-serif');
      text.setAttribute('font-size', fontSize);
      text.setAttribute('fill', fontColor);

      // Handle multi-line text
      const cleanText = this._stripHtml(value);
      const lines = cleanText.split(/\n|<br\s*\/?>/i);

      if (lines.length === 1) {
        text.textContent = cleanText;
      } else {
        const lineHeight = parseFloat(fontSize) * 1.2;
        const startY = y + height / 2 - ((lines.length - 1) * lineHeight) / 2;

        lines.forEach((line, i) => {
          const tspan = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'tspan'
          );
          tspan.setAttribute('x', String(x + width / 2));
          tspan.setAttribute('y', String(startY + i * lineHeight));
          tspan.textContent = line.trim();
          text.appendChild(tspan);
        });
      }

      g.appendChild(text);
    }

    return g;
  }

  /**
   * Create SVG edge from mxCell
   */
  private _createEdge(
    cell: Element,
    style: string,
    source?: { x: number; y: number; width: number; height: number },
    target?: { x: number; y: number; width: number; height: number }
  ): SVGGElement | null {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const geometry = cell.querySelector('mxGeometry');

    const styles = this._parseStyle(style);
    const strokeColor = styles.strokeColor || '#000000';
    const strokeWidth = styles.strokeWidth || '1';

    let pathD = '';

    // Try to get explicit source/target points
    const sourcePoint = geometry?.querySelector('mxPoint[as="sourcePoint"]');
    const targetPoint = geometry?.querySelector('mxPoint[as="targetPoint"]');

    let x1: number, y1: number, x2: number, y2: number;

    if (sourcePoint && targetPoint) {
      x1 = parseFloat(sourcePoint.getAttribute('x') || '0');
      y1 = parseFloat(sourcePoint.getAttribute('y') || '0');
      x2 = parseFloat(targetPoint.getAttribute('x') || '0');
      y2 = parseFloat(targetPoint.getAttribute('y') || '0');
    } else if (source && target) {
      // Calculate connection points between shapes
      x1 = source.x + source.width / 2;
      y1 = source.y + source.height / 2;
      x2 = target.x + target.width / 2;
      y2 = target.y + target.height / 2;

      // Adjust to edge of shapes
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);

      if (len > 0) {
        // Adjust source point to edge
        const sourceRatio =
          Math.min(source.width / 2 / Math.abs(dx || 1), source.height / 2 / Math.abs(dy || 1)) || 0;
        x1 += dx * Math.min(sourceRatio, 0.5);
        y1 += dy * Math.min(sourceRatio, 0.5);

        // Adjust target point to edge
        const targetRatio =
          Math.min(target.width / 2 / Math.abs(dx || 1), target.height / 2 / Math.abs(dy || 1)) || 0;
        x2 -= dx * Math.min(targetRatio, 0.5);
        y2 -= dy * Math.min(targetRatio, 0.5);
      }
    } else {
      return null;
    }

    // Check for waypoints
    const points = geometry?.querySelectorAll('mxPoint:not([as])');
    if (points && points.length > 0) {
      pathD = `M ${x1} ${y1}`;
      points.forEach(point => {
        const px = point.getAttribute('x') || '0';
        const py = point.getAttribute('y') || '0';
        pathD += ` L ${px} ${py}`;
      });
      pathD += ` L ${x2} ${y2}`;
    } else {
      pathD = `M ${x1} ${y1} L ${x2} ${y2}`;
    }

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('stroke', strokeColor);
    path.setAttribute('stroke-width', strokeWidth);
    path.setAttribute('fill', 'none');

    // Handle dashed lines
    if (styles.dashed === '1') {
      path.setAttribute('stroke-dasharray', '5,3');
    }

    // Add arrow markers
    const endArrow = styles.endArrow || 'classic';
    if (endArrow !== 'none') {
      if (endArrow === 'open') {
        path.setAttribute('marker-end', 'url(#arrow-open)');
      } else {
        path.setAttribute('marker-end', 'url(#arrow)');
      }
    }

    const startArrow = styles.startArrow || 'none';
    if (startArrow !== 'none') {
      path.setAttribute('marker-start', 'url(#arrow)');
    }

    g.appendChild(path);

    // Add edge label if present
    const value = cell.getAttribute('value') || '';
    if (value) {
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;

      const text = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'text'
      );
      text.setAttribute('x', String(midX));
      text.setAttribute('y', String(midY - 5));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-family', 'sans-serif');
      text.setAttribute('font-size', '11');
      text.setAttribute('fill', '#000000');
      text.textContent = this._stripHtml(value);
      g.appendChild(text);
    }

    return g;
  }

  /**
   * Parse Draw.io style string into key-value pairs
   */
  private _parseStyle(style: string): Record<string, string> {
    const result: Record<string, string> = {};
    if (!style) {
      return result;
    }

    style.split(';').forEach(part => {
      const [key, value] = part.split('=');
      if (key && value !== undefined) {
        result[key.trim()] = value.trim();
      }
    });

    return result;
  }

  /**
   * Strip HTML tags from text
   */
  private _stripHtml(html: string): string {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  /**
   * Setup page navigation for multi-page diagrams
   */
  private _setupPageNavigation(): void {
    this._toolbar.style.display = 'flex';
    this._toolbar.innerHTML = `
      <button class="jp-DrawioWidget-navBtn" id="prevPage" title="Previous page">
        <span>&lt;</span>
      </button>
      <span class="jp-DrawioWidget-pageInfo">
        Page <span id="currentPage">${this._currentPage + 1}</span> of ${this._totalPages}
      </span>
      <button class="jp-DrawioWidget-navBtn" id="nextPage" title="Next page">
        <span>&gt;</span>
      </button>
    `;

    this._toolbar.querySelector('#prevPage')?.addEventListener('click', () => {
      if (this._currentPage > 0) {
        this._currentPage--;
        this._updatePageDisplay();
      }
    });

    this._toolbar.querySelector('#nextPage')?.addEventListener('click', () => {
      if (this._currentPage < this._totalPages - 1) {
        this._currentPage++;
        this._updatePageDisplay();
      }
    });
  }

  /**
   * Update page display after navigation
   */
  private _updatePageDisplay(): void {
    const pageSpan = this._toolbar.querySelector('#currentPage');
    if (pageSpan) {
      pageSpan.textContent = String(this._currentPage + 1);
    }
    void this._renderPage(this._currentPage);
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
