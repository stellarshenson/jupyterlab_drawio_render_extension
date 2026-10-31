// Downloads the git-ignored draw.io viewer, shape and stencil files that the wheel ships and the browser loads.
// Every build takes all 3 from the latest upstream release, so they cannot disagree and a build from any state of the folder ships the same files as a clean clone.
// A failed download fails the build and leaves no file from before, so no later build can ship one.
const fs = require('fs');
const path = require('path');

const DRAWIO_LATEST = 'https://github.com/jgraph/drawio/releases/latest';
const DRAWIO_RAW = 'https://raw.githubusercontent.com/jgraph/drawio';
const STATIC_DIR = path.join(
  __dirname,
  '..',
  'jupyterlab_drawio_render_extension',
  'static'
);
const ASSETS = {
  'viewer-static.min.js': 'viewer-static.min.js',
  'shapes.min.js': 'shapes-14-6-5.min.js',
  'stencils.min.js': 'stencils.min.js'
};

(async () => {
  fs.mkdirSync(STATIC_DIR, { recursive: true });
  for (const name of Object.keys(ASSETS)) {
    fs.rmSync(path.join(STATIC_DIR, name), { force: true });
  }
  // This address redirects to the page of the release, whose last path part is its tag.
  const latest = await fetch(DRAWIO_LATEST, { method: 'HEAD' });
  if (!latest.ok) {
    throw new Error(`${DRAWIO_LATEST} answered ${latest.status}`);
  }
  const tag = latest.url.split('/').pop();
  console.log(`Taking the draw.io files from upstream release ${tag}`);
  for (const [name, source] of Object.entries(ASSETS)) {
    const target = path.join(STATIC_DIR, name);
    const url = `${DRAWIO_RAW}/${tag}/src/main/webapp/js/${source}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`${url} answered ${response.status}`);
    }
    // The temporary name keeps a partial file out of the wheel.
    const partial = `${target}.tmp`;
    fs.writeFileSync(partial, Buffer.from(await response.arrayBuffer()));
    fs.renameSync(partial, target);
    console.log(`Downloaded ${name} from ${url}`);
  }
})();
