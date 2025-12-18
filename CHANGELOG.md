# Changelog

<!-- <START NEW CHANGELOG ENTRY> -->

## 1.0.14

- Fix PNG export to crop to diagram content bounds (removes empty whitespace)
- Add comprehensive unit test suite (38 tests)
- Add Playwright/Galata UI tests for widget rendering, commands, and stencils
- Update README with PNG Export section and reorganized Settings tables
- Add test fixtures for simple and Veeam diagrams

## 1.0.12

- Add PNG export functionality with context menu commands
- Copy Diagram as PNG - copies diagram to clipboard at configured DPI
- Download Diagram as PNG - downloads diagram as PNG file
- Add exportDPI setting (72-1200 DPI, default 300)
- Add exportBackground setting (transparent, white, black, custom)
- SVG to PNG conversion using Canvas API with high-quality rendering

## 1.0.10

- Add full stencil support for Veeam, Cisco, AWS, Azure, GCP, and all vendor shapes
- Load shapes.min.js (1.2MB) and stencils.min.js (7.5MB) from Draw.io repository
- Add `fetch_drawio_assets` Makefile target to clone Draw.io repo and copy assets
- Include static files in wheel package via pyproject.toml artifacts
- Fix repository URLs after rename (removed trailing hyphen)
- Apply code linting and formatting

## 1.0.9

- Update CI/CD workflows to match jupyterlab_vscode_icons_extension pattern
- Remove failing lint/test steps from build workflow
- Update Python version to 3.12
- Add ignore_links for badge URLs in check-links job

## 1.0.8

- Rename background options from dark/light to black/white for clarity

## 1.0.7

- Add settings icon (image) for Draw.io Viewer in JupyterLab settings panel

## 1.0.6

- Rename background options from light/dark to white/black

## 1.0.5

- Add custom background color option with hex color input

## 1.0.4

- Add configurable background settings (default, dark, light)
- Integrate with JupyterLab settings registry
- Settings persist across sessions

## 1.0.3

- Fix GraphViewer toolbar width to span full container
- Add CSS rules forcing 100% width on viewer elements

## 1.0.2

- Switch to official Draw.io viewer library for full rendering support
- Serve viewer-static.min.js from Python server extension
- Full fidelity rendering - text, shapes, stencils, icons, and styles
- Remove npm mxgraph dependency
- Clean up debug console statements

## 0.1.18

- Debug mxgraph rendering issues
- Investigate blank diagram display
- Add pako for deflate decompression

## 0.1.8

- Switch to bundled mxgraph library for offline rendering
- Add zoom toolbar (in/out/fit/actual)
- Enable mouse wheel zoom and panning
- Work around JupyterLab CSP restrictions

## 0.1.3

- Attempt external Draw.io viewer library integration
- Fix file icon override conflicts

## 0.1.1

- Initial Draw.io viewer implementation
- Custom SVG rendering from mxGraphModel XML
- Support for compressed and uncompressed formats
- Register .drawio and .dio file types

## 0.1.0

- Initial project setup from JupyterLab extension template
- TypeScript frontend and Python server extension structure
- GitHub Actions workflows for build/release

<!-- <END NEW CHANGELOG ENTRY> -->
