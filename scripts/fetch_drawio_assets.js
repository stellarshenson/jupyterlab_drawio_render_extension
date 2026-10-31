// Downloads the git-ignored draw.io shape and stencil files that the wheel ships and the viewer loads.
// A file already present is kept. A failed download fails the build, so no build ships without the files.
const fs = require('fs');
const path = require('path');

const DRAWIO_RAW =
  'https://raw.githubusercontent.com/jgraph/drawio/dev/src/main/webapp/js';
const STATIC_DIR = path.join(
  __dirname,
  '..',
  'jupyterlab_drawio_render_extension',
  'static'
);
const ASSETS = {
  'shapes.min.js': 'shapes-14-6-5.min.js',
  'stencils.min.js': 'stencils.min.js'
};

(async () => {
  for (const [name, source] of Object.entries(ASSETS)) {
    const target = path.join(STATIC_DIR, name);
    if (fs.existsSync(target)) {
      continue;
    }
    const url = `${DRAWIO_RAW}/${source}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`${url} answered ${response.status}`);
    }
    // The temporary name keeps a partial file from being skipped by the next build.
    const partial = `${target}.tmp`;
    fs.writeFileSync(partial, Buffer.from(await response.arrayBuffer()));
    fs.renameSync(partial, target);
    console.log(`Downloaded ${name} from ${url}`);
  }
})();
