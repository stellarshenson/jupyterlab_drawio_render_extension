# Changelog

<!-- <START NEW CHANGELOG ENTRY> -->

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
