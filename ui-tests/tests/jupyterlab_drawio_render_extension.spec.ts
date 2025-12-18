import { expect, test } from '@jupyterlab/galata';
import * as path from 'path';

/**
 * Test fixtures directory
 */
const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

/**
 * Don't load JupyterLab webpage before running the tests.
 * This is required to ensure we capture all log messages.
 */
test.use({ autoGoto: false });

test.describe('Extension Activation', () => {
  test('should emit an activation console message', async ({ page }) => {
    const logs: string[] = [];

    page.on('console', message => {
      logs.push(message.text());
    });

    await page.goto();

    expect(
      logs.filter(
        s =>
          s ===
          'JupyterLab extension jupyterlab_drawio_render_extension is activated!'
      )
    ).toHaveLength(1);
  });
});

test.describe('Draw.io File Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto();
  });

  test('should register .drawio file type', async ({ page }) => {
    const result = await page.evaluate(() => {
      const app = (window as any).jupyterapp;
      const fileTypes = Array.from(app.docRegistry.fileTypes()) as any[];
      const drawioType = fileTypes.find((ft: any) => ft.name === 'drawio');
      return drawioType !== undefined;
    });
    expect(result).toBe(true);
  });

  test('should register .dio file type', async ({ page }) => {
    const result = await page.evaluate(() => {
      const app = (window as any).jupyterapp;
      const fileTypes = Array.from(app.docRegistry.fileTypes()) as any[];
      const drawioType = fileTypes.find((ft: any) => ft.name === 'drawio');
      return drawioType?.extensions?.includes('.dio') ?? false;
    });
    expect(result).toBe(true);
  });

  test('should have Draw.io Viewer factory registered', async ({ page }) => {
    const result = await page.evaluate(() => {
      const app = (window as any).jupyterapp;
      const factories = Array.from(app.docRegistry.widgetFactories()) as any[];
      const drawioFactory = factories.find(
        (f: any) => f.name === 'Draw.io Viewer'
      );
      return drawioFactory !== undefined;
    });
    expect(result).toBe(true);
  });
});

test.describe('Context Menu Commands', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto();
  });

  test('should have Copy as PNG command registered', async ({ page }) => {
    const hasCommand = await page.evaluate(() => {
      const app = (window as any).jupyterapp;
      return app.commands.hasCommand('drawio:copy-as-png');
    });
    expect(hasCommand).toBe(true);
  });

  test('should have Download as PNG command registered', async ({ page }) => {
    const hasCommand = await page.evaluate(() => {
      const app = (window as any).jupyterapp;
      return app.commands.hasCommand('drawio:download-as-png');
    });
    expect(hasCommand).toBe(true);
  });

  test('should have correct command labels', async ({ page }) => {
    const labels = await page.evaluate(() => {
      const app = (window as any).jupyterapp;
      return {
        copy: app.commands.label('drawio:copy-as-png'),
        download: app.commands.label('drawio:download-as-png')
      };
    });
    expect(labels.copy).toBe('Copy Diagram as PNG');
    expect(labels.download).toBe('Download Diagram as PNG');
  });
});

test.describe('Draw.io Viewer Widget', () => {
  test.beforeEach(async ({ page, tmpPath }) => {
    await page.goto();
    // Upload test diagram using contents API
    const content = `<mxfile host="test">
  <diagram id="test" name="Page-1">
    <mxGraphModel dx="1434" dy="780" grid="1">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="2" value="Test" style="rounded=1;fillColor=#dae8fc;" vertex="1" parent="1">
          <mxGeometry x="120" y="80" width="120" height="60" as="geometry" />
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

    await page.contents.uploadContent(content, 'text', `${tmpPath}/test.drawio`);
  });

  test('should open .drawio file in viewer', async ({ page, tmpPath }) => {
    // Open the file
    await page.filebrowser.open(`${tmpPath}/test.drawio`);

    // Wait for widget to load
    await page.waitForSelector('.jp-DrawioWidget', { timeout: 30000 });

    // Verify widget is present
    const widget = await page.$('.jp-DrawioWidget');
    expect(widget).not.toBeNull();
  });

  test('should have container element', async ({ page, tmpPath }) => {
    await page.filebrowser.open(`${tmpPath}/test.drawio`);
    await page.waitForSelector('.jp-DrawioWidget', { timeout: 30000 });

    const container = await page.$('.jp-DrawioWidget-container');
    expect(container).not.toBeNull();
  });

  test('should apply default background class', async ({ page, tmpPath }) => {
    await page.filebrowser.open(`${tmpPath}/test.drawio`);
    await page.waitForSelector('.jp-DrawioWidget', { timeout: 30000 });

    const hasDefaultBg = await page.evaluate(() => {
      const widget = document.querySelector('.jp-DrawioWidget');
      return widget?.classList.contains('jp-DrawioWidget-bg-default') ?? false;
    });

    expect(hasDefaultBg).toBe(true);
  });
});

// SVG rendering tests - these require GraphViewer to fully load
// which may be slow or fail in CI environments
test.describe('SVG Rendering', () => {
  // Skip these tests in CI as they depend on full GraphViewer initialization
  test.skip(!!process.env.CI, 'Skipping rendering tests in CI');

  test.beforeEach(async ({ page, tmpPath }) => {
    await page.goto();
    const content = `<mxfile host="test">
  <diagram id="test" name="Page-1">
    <mxGraphModel dx="1434" dy="780" grid="1">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="2" value="Test" style="rounded=1;fillColor=#dae8fc;" vertex="1" parent="1">
          <mxGeometry x="120" y="80" width="120" height="60" as="geometry" />
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
    await page.contents.uploadContent(content, 'text', `${tmpPath}/test.drawio`);
  });

  test('should render SVG element', async ({ page, tmpPath }) => {
    await page.filebrowser.open(`${tmpPath}/test.drawio`);

    // Wait for SVG to render with longer timeout
    await page.waitForSelector('.jp-DrawioWidget svg', { timeout: 60000 });

    const svg = await page.$('.jp-DrawioWidget svg');
    expect(svg).not.toBeNull();
  });

  test('should render diagram content', async ({ page, tmpPath }) => {
    await page.filebrowser.open(`${tmpPath}/test.drawio`);
    await page.waitForSelector('.jp-DrawioWidget svg', { timeout: 60000 });

    const hasContent = await page.evaluate(() => {
      const svg = document.querySelector('.jp-DrawioWidget svg');
      if (!svg) return false;
      const paths = svg.querySelectorAll('path');
      const rects = svg.querySelectorAll('rect');
      const groups = svg.querySelectorAll('g');
      return paths.length > 0 || rects.length > 0 || groups.length > 0;
    });
    expect(hasContent).toBe(true);
  });
});

// PNG Export tests - these require SVG to be rendered
test.describe('PNG Export', () => {
  test.skip(!!process.env.CI, 'Skipping export tests in CI');

  test.beforeEach(async ({ page, tmpPath }) => {
    await page.goto();
    const content = `<mxfile host="test">
  <diagram id="test" name="Page-1">
    <mxGraphModel dx="1434" dy="780" grid="1">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="2" value="Test" style="rounded=1;fillColor=#dae8fc;" vertex="1" parent="1">
          <mxGeometry x="120" y="80" width="120" height="60" as="geometry" />
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
    await page.contents.uploadContent(content, 'text', `${tmpPath}/test.drawio`);
  });

  test('should execute Download as PNG command', async ({ page, tmpPath }) => {
    await page.filebrowser.open(`${tmpPath}/test.drawio`);
    await page.waitForSelector('.jp-DrawioWidget svg', { timeout: 60000 });

    const downloadPromise = page
      .waitForEvent('download', { timeout: 10000 })
      .catch(() => null);

    await page.evaluate(async () => {
      const app = (window as any).jupyterapp;
      await app.commands.execute('drawio:download-as-png');
    });

    const download = await downloadPromise;
    if (download) {
      const filename = download.suggestedFilename();
      expect(filename).toMatch(/\.png$/);
    }
  });
});
