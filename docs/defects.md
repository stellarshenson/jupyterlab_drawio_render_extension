# Defects

## Authors

- `@kj` Konrad Jelen

## Command-line interface `CLI`

The jupyterlab-drawio console script and its four subcommands.

- log: 2026-11-01T14:49:21Z @kj category created

## Diagram viewer `VIEW`

The .drawio viewer widget, its PNG export and its styles.

- log: 2026-11-13T06:58:44Z @kj category created

- [x] `DEF-VIEW-1-LOADRETRY` **Failed viewer load is kept until page reload** - MEDIUM; one failed load of viewer-static.min.js (server restart, network drop) leaves every later .drawio open failing until the browser page reloads; src/widget.ts ensureViewerReady
  - evidence: src/widget.ts ensureViewerReady sets viewerReady to null when the promise rejects, so the next open loads the scripts again; build_test.py at 1.0.31: Jest 38, pytest 13, Galata 20 green
  - root-cause: 2026-11-13T07:02:48Z @kj ensureViewerReady stored the load promise in a module variable and returned it for ever, rejected or not
  - repro: block static/viewer-static.min.js once, open a .drawio, unblock, open another: still fails
  - log: 2026-11-13T06:58:44Z @kj added
  - log: 2026-11-13T07:02:48Z @kj closed
- [x] `DEF-VIEW-2-EXPORTERR` **Failed PNG export shows nothing** - MEDIUM; Copy or Download Diagram as PNG that fails (no clipboard on plain http, diagram still loading, canvas too large) only writes console.error; the user sees no result and no message; src/index.ts
  - evidence: src/index.ts reportFailure logs the error and runs apputils:notify with type error for both commands; build_test.py at 1.0.31: Jest 38, pytest 13, Galata 20 green
  - root-cause: 2026-11-13T07:02:48Z @kj the two export commands caught every error and wrote it only to the console
  - repro: open the lab over plain http on a non-localhost host, right-click a diagram, Copy Diagram as PNG: nothing happens
  - log: 2026-11-13T06:58:44Z @kj added
  - log: 2026-11-13T07:02:48Z @kj closed
- [x] `DEF-VIEW-3-READYREJECT` **Unhandled rejection on a diagram that fails to load** - MINOR; opening an empty or unreadable .drawio shows the error panel and also raises an unhandled promise rejection, because nothing awaits DrawioWidget.ready; src/widget.ts
  - evidence: src/widget.ts constructor attaches a no-op catch to the ready promise; the error panel is unchanged; build_test.py at 1.0.31: Jest 38, pytest 13, Galata 20 green
  - root-cause: 2026-11-13T07:02:48Z @kj _loadDiagram rejects the ready delegate and no code awaits DrawioWidget.ready
  - repro: create an empty x.drawio, open it, read the browser console
  - log: 2026-11-13T06:58:44Z @kj added
  - log: 2026-11-13T07:02:49Z @kj closed
- [x] `DEF-VIEW-4-DEADCSS` **Unused toolbar and graph styles** - MINOR; style/base.css holds .jp-DrawioWidget-toolbar, -toolbarBtn and -graph rules that no element carries; 35 lines shipped unused
  - evidence: style/base.css: the 3 rule groups removed, 35 lines; grep for jp-DrawioWidget-toolbar and -graph finds nothing; build_test.py at 1.0.31: Jest 38, pytest 13, Galata 20 green
  - root-cause: 2026-11-13T07:02:49Z @kj rules of an earlier toolbar design stayed after the widget moved to the GraphViewer toolbar
  - repro: grep -rn 'jp-DrawioWidget-toolbar\|jp-DrawioWidget-graph' src
  - log: 2026-11-13T06:58:44Z @kj added
  - log: 2026-11-13T07:02:49Z @kj closed
- [-] `DEF-VIEW-5-CANVASCAP` **Export size cap skips diagrams with no HTML label** - MINOR; svgToPng caps the canvas at browser limits only when the SVG holds a foreignObject; a diagram wider than about 5200 px with no HTML label exceeds the limit at 300 DPI and export fails; src/widget.ts
  - repro: export a 6000 px wide diagram whose cells all lack html=1 at 300 DPI
  - log: 2026-11-13T06:58:44Z @kj added
  - log: 2026-11-13T07:02:56Z @kj rejected: exotic: needs a diagram over about 5200 px wide with no html=1 label; draw.io writes html=1 by default, and a failed export is now shown to the user
- [-] `DEF-VIEW-6-MIRRORTEST` **Jest test checks a copy of generatePngFilename** - MINOR; src/**tests** redefines generatePngFilename instead of importing it from src/widget.ts, so a change of the shipped function cannot fail the test
  - repro: change generatePngFilename in src/widget.ts, run jlpm test: still green
  - log: 2026-11-13T06:58:45Z @kj added
  - log: 2026-11-13T07:02:56Z @kj rejected: not worth a fix: the function is 5 lines, the Galata download test runs the shipped one, and importing widget.ts into Jest pulls the document registry
- [x] `DEF-VIEW-7-PAGES` **Multi-page diagram shows only page 1** - MEDIUM; a .drawio file with two or more pages opens on page 1 and the viewer toolbar has no control to reach the other pages; src/widget.ts
  - evidence: src/widget.ts toolbar config is 'pages zoom layers lightbox'; the vendored viewer builds previous, next and the page counter only for the pages token and hides them for a one-page file; build_test.py at 1.0.32: Jest 38, pytest 13, Galata 20 green; a two-page file was not opened in a browser
  - repro: open a .drawio file that holds two <diagram> elements: no previous/next buttons, page 2 cannot be shown
  - root-cause: 2026-11-13T07:27:19Z @kj the GraphViewer toolbar config in _renderDiagram listed 'zoom layers lightbox' without the 'pages' token, and the viewer builds the page buttons only for that token
  - log: 2026-11-13T07:27:19Z @kj added
  - log: 2026-11-13T07:30:01Z @kj closed
