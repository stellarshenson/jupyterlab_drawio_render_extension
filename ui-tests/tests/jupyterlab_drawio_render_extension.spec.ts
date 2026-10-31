import { expect, IJupyterLabPageFixture, test } from '@jupyterlab/galata';
import * as fs from 'fs';
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
          'JupyterLab extension @stellarshenson/jupyterlab-drawio-render-extension is activated!'
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

    await page.contents.uploadContent(
      content,
      'text',
      `${tmpPath}/test.drawio`
    );
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
    await page.contents.uploadContent(
      content,
      'text',
      `${tmpPath}/test.drawio`
    );
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

// The wheel must hold these git-ignored files, all 3 from one upstream release: without
// shapes and stencils the viewer draws generic frames for vendor shapes (AWS, Cisco,
// Veeam), and an older viewer throws on the mockup and iOS shapes of a newer shapes file.
// Every other test passes in both cases.
test.describe('Draw.io Static Assets', () => {
  for (const asset of [
    'viewer-static.min.js',
    'shapes.min.js',
    'stencils.min.js'
  ]) {
    test(`should serve static/${asset}`, async ({ request }) => {
      const response = await request.get(
        `jupyterlab-drawio-render-extension/static/${asset}`
      );
      expect(response.status()).toBe(200);
    });
  }

  test('should draw vendor, mockup and iOS shapes with viewer.diagrams.net blocked', async ({
    page,
    tmpPath
  }) => {
    test.setTimeout(120000);
    await page.route('https://viewer.diagrams.net/**', route => route.abort());
    await page.goto();
    const styles = [
      'shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.lambda;fillColor=#ED7100;strokeColor=#ffffff;',
      'shape=mxgraph.cisco.routers.router;fillColor=#036897;strokeColor=#ffffff;',
      'shape=mxgraph.veeam.2d.proxy;fillColor=#4495A2;strokeColor=none;',
      'shape=mxgraph.mockup.navigation.breadcrumb;strokeColor=#c4c4c4;mainText=A,B,C;',
      'shape=mxgraph.mockup.graphics.gauge;strokeColor=#000000;gaugePos=25;scaleColors=#bbddff,#ddeeff,#99ccff;gaugeLabels=CPU,0,100;',
      'shape=mxgraph.ios.iButton;fillColor=#dddddd;fillColor2=#bbbbbb;strokeColor=#444444;buttonText=Hit;'
    ];
    const vertices = styles.map(
      (style, i) =>
        `<mxCell id="${i + 2}" style="${style}" vertex="1" parent="1"><mxGeometry x="${40 + (i % 3) * 140}" y="${40 + Math.floor(i / 3) * 140}" width="100" height="100" as="geometry" /></mxCell>`
    );
    const content = `<mxfile host="test">
  <diagram id="vendor" name="Page-1">
    <mxGraphModel grid="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        ${vertices.join('\n        ')}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
    await page.contents.uploadContent(
      content,
      'text',
      `${tmpPath}/vendor.drawio`
    );
    await page.filebrowser.open(`${tmpPath}/vendor.drawio`);

    // One group per cell, in document order. A viewer that throws on a shape draws none.
    const cells = page.locator(
      '.jp-DrawioWidget svg g[transform="translate(0.5,0.5)"]'
    );
    await expect(cells).toHaveCount(styles.length, { timeout: 90000 });
    // A plain frame is one rect or path; a vendor shape adds its glyph.
    for (const i of [0, 1, 2]) {
      await expect(cells.nth(i).locator('rect')).toHaveCount(0);
      await expect
        .poll(() => cells.nth(i).locator('path').count())
        .toBeGreaterThan(1);
    }
    await expect(cells.nth(3)).toContainText('C');
    await expect(cells.nth(4)).toContainText('CPU');
    await expect(cells.nth(5)).toContainText('Hit');
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
    await page.contents.uploadContent(
      content,
      'text',
      `${tmpPath}/test.drawio`
    );
  });

  test('should execute Download as PNG command', async ({ page, tmpPath }) => {
    await page.filebrowser.open(`${tmpPath}/test.drawio`);
    await page.waitForSelector('.jp-DrawioWidget svg', { timeout: 60000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 10000 });

    await page.evaluate(async () => {
      const app = (window as any).jupyterapp;
      await app.commands.execute('drawio:download-as-png');
    });

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.png$/);
  });
});

/**
 * Download cells with the given number of HTML labels as PNG at the default 300 DPI.
 */
async function downloadCellsPng(
  page: IJupyterLabPageFixture,
  file: string,
  cell: string,
  labels = 1
): Promise<Buffer> {
  const content = `<mxfile host="test">
  <diagram id="labels" name="Page-1">
    <mxGraphModel grid="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        ${cell}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
  await page.contents.uploadContent(content, 'text', file);
  await page.filebrowser.open(file);
  await expect(page.locator('.jp-DrawioWidget svg foreignObject')).toHaveCount(
    labels,
    { timeout: 90000 }
  );

  const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
  await page.evaluate(async () => {
    const app = (window as any).jupyterapp;
    await app.commands.execute('drawio:download-as-png');
  });
  const download = await downloadPromise;
  return fs.readFileSync(await download.path());
}

/**
 * Download one cell as PNG at the default 300 DPI and decode the size of the file.
 */
async function downloadCellSize(
  page: IJupyterLabPageFixture,
  file: string,
  cell: string
): Promise<{ width: number; height: number }> {
  const png = await downloadCellsPng(page, file, cell);
  return page.evaluate(async base64 => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  }, png.toString('base64'));
}

// The viewer gives each HTML label a foreignObject about 20,000 units wide. A crop that
// counts it asks a canvas over the browser limit and no file arrives; a crop that drops
// the labels leaves out the label below the shape here.
test.describe('PNG Export of HTML labels', () => {
  test('should crop the download to the shape and its label', async ({
    page,
    tmpPath
  }) => {
    test.setTimeout(120000);
    await page.goto();
    const size = await downloadCellSize(
      page,
      `${tmpPath}/labels.drawio`,
      `<mxCell id="2" value="Below" style="rounded=0;whiteSpace=wrap;html=1;verticalLabelPosition=bottom;verticalAlign=top;" vertex="1" parent="1">
          <mxGeometry x="40" y="40" width="200" height="40" as="geometry" />
        </mxCell>`
    );

    // The shape is 200 by 40 and the one-line label ends 21 below it. With 10 of padding on
    // each side at the default 300 DPI that is 688 by 253, within a margin of 5%. Without
    // the label the height would be 188.
    expect(Math.abs(size.width - 688)).toBeLessThan(688 * 0.05);
    expect(Math.abs(size.height - 253)).toBeLessThan(253 * 0.05);
  });

  // With overflow=block the DOM rectangle of the label is the width of the cell, and the
  // sentence paints past it. A crop to that rectangle cuts the sentence with no error.
  test('should hold a block label wider than its cell', async ({
    page,
    tmpPath
  }) => {
    test.setTimeout(120000);
    await page.goto();
    const sentence =
      'A plain sentence in a nowrap block label, longer than its cell';
    const size = await downloadCellSize(
      page,
      `${tmpPath}/block.drawio`,
      `<mxCell id="2" value="${sentence}" style="rounded=0;html=1;overflow=block;" vertex="1" parent="1">
          <mxGeometry x="100" y="100" width="120" height="40" as="geometry" />
        </mxCell>`
    );

    const sentenceWidth = await page.evaluate(text => {
      const ctx = document.createElement('canvas').getContext('2d')!;
      ctx.font = '12px Helvetica';
      return ctx.measureText(text).width;
    }, sentence);
    expect(size.width).toBeGreaterThan((sentenceWidth * 300) / 96);
  });

  // The viewer fits this diagram to the panel, so the caption is drawn at a font size under
  // 0.7 units. A scan at scale 1 paints it at alpha 0, and the crop cuts it with no error.
  test('should keep a small caption outside the other paint', async ({
    page,
    tmpPath
  }) => {
    test.setTimeout(120000);
    await page.goto();
    const cell = (
      id: number,
      value: string,
      style: string,
      x: number,
      y: number,
      width: number,
      height: number
    ) =>
      `<mxCell id="${id}" value="${value}" style="${style}" vertex="1" parent="1">
          <mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry" />
        </mxCell>`;
    let cells = cell(
      2,
      'Footnote: reviewed by the architecture board',
      'text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;whiteSpace=nowrap;fontSize=12;',
      7000,
      4500,
      400,
      30
    );
    let id = 3;
    for (const x of [0, 7000, 14000]) {
      for (const y of [0, 3500]) {
        cells += cell(
          id++,
          `Node ${x} ${y}`,
          'rounded=0;whiteSpace=wrap;html=1;fontSize=48;',
          x,
          y,
          400,
          200
        );
      }
    }
    const png = await downloadCellsPng(
      page,
      `${tmpPath}/caption.drawio`,
      cells,
      7
    );

    // The shapes span 14,400 by 3,700 units. Ink more than 400 units below them is the
    // caption, about 240 units wide.
    const captionWidth = await page.evaluate(async base64 => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const { naturalWidth: width, naturalHeight: height } = image;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0);
      const { data } = ctx.getImageData(0, 0, width, height);
      const inkBox = (firstRow: number) => {
        let left = width;
        let right = -1;
        let top = height;
        for (let y = firstRow; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const k = (y * width + x) * 4;
            if (data[k] < 255 || data[k + 1] < 255 || data[k + 2] < 255) {
              left = Math.min(left, x);
              right = Math.max(right, x);
              top = Math.min(top, y);
            }
          }
        }
        return { top, inkWidth: Math.max(0, right + 1 - left) };
      };
      const all = inkBox(0);
      const pixelsPerUnit = all.inkWidth / 14400;
      const below = Math.ceil(all.top + 4100 * pixelsPerUnit);
      return inkBox(below).inkWidth / pixelsPerUnit;
    }, png.toString('base64'));
    expect(captionWidth).toBeGreaterThan(150);
  });
});
