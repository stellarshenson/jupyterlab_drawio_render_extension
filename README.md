# jupyterlab_drawio_render_extension

[![GitHub Actions](https://github.com/stellarshenson/jupyterlab_drawio_render_extension/actions/workflows/build.yml/badge.svg)](https://github.com/stellarshenson/jupyterlab_drawio_render_extension/actions/workflows/build.yml)
[![npm version](https://img.shields.io/npm/v/jupyterlab_drawio_render_extension.svg)](https://www.npmjs.com/package/jupyterlab_drawio_render_extension)
[![PyPI version](https://img.shields.io/pypi/v/jupyterlab-drawio-render-extension.svg)](https://pypi.org/project/jupyterlab-drawio-render-extension/)
[![Total PyPI downloads](https://static.pepy.tech/badge/jupyterlab-drawio-render-extension)](https://pepy.tech/project/jupyterlab-drawio-render-extension)
[![JupyterLab 4](https://img.shields.io/badge/JupyterLab-4-orange.svg)](https://jupyterlab.readthedocs.io/en/stable/)
[![Brought To You By KOLOMOLO](https://img.shields.io/badge/Brought%20To%20You%20By-KOLOMOLO-00ffff?style=flat)](https://kolomolo.com)
[![Donate PayPal](https://img.shields.io/badge/Donate-PayPal-blue?style=flat)](https://www.paypal.com/donate/?hosted_button_id=B4KPBJDLLXTSA)

View Draw.io diagrams directly in JupyterLab. Open any `.drawio` or `.dio` file and see it rendered with full fidelity - text, shapes, stencils, icons, and styles matching the official Draw.io application.

This extension uses the official [Draw.io viewer library](https://github.com/jgraph/drawio) from jgraph, served locally from the server extension for offline capability and CSP compliance.

![Draw.io Diagram Viewer](.resources/screenshot-diagram-viewer.png)

## Features

- **Full Draw.io rendering** - Uses official Draw.io viewer library for pixel-perfect diagram display
- **Read-only viewer** - Safe viewing without accidental modifications
- **Interactive controls** - Zoom, pan, layers panel, and lightbox view
- **PNG export** - Right-click to copy or download diagram as PNG with configurable DPI
- **Configurable background** - Choose from default (theme), black, white, or custom hex color
- **Full stencil support** - Veeam, Cisco, AWS, Azure, GCP, and all vendor shapes
- **Offline capable** - Viewer library served locally, no external network requests
- **JupyterLab 4 compatible** - Built for the latest JupyterLab release

## PNG Export

Right-click on any diagram to access export options:
- **Copy Diagram as PNG** - Copy to clipboard at configured DPI
- **Download Diagram as PNG** - Save as PNG file

Export automatically crops to diagram content with minimal padding.

## Settings

Configure the extension in **Settings > Draw.io Viewer**:

### Viewer Settings

| Setting                 | Description                                                    | Default   |
| ----------------------- | -------------------------------------------------------------- | --------- |
| Background              | Viewer background: `default` (theme), `black`, `white`, `custom` | `default` |
| Custom Background Color | Hex color (e.g., `#f0f0f0`) when background is `custom`        | `#ffffff` |

### Export Settings

| Setting           | Description                                                      | Default |
| ----------------- | ---------------------------------------------------------------- | ------- |
| Export DPI        | Resolution for PNG export (72-1200). Higher = larger file        | `300`   |
| Export Background | PNG background: `transparent`, `white`, `black`, `custom`        | `white` |

## Requirements

- JupyterLab >= 4.0.0
- Python >= 3.10

## Installation

```bash
pip install jupyterlab-drawio-render-extension
```

## Uninstall

```bash
pip uninstall jupyterlab-drawio-render-extension
```
