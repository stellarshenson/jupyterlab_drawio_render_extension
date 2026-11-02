# Acceptance Criteria

## Authors

- `@kj` Konrad Jelen

## Command-line interface `CLI`

The jupyterlab-drawio console script and its four subcommands.

- log: 2026-11-01T14:49:14Z @kj category created

- [x] `ACC-CLI-1-HELP` **Help runs every command** - HIGH; jupyterlab-drawio --help and each subcommand help state flags, output, exit codes and worked examples; an agent runs every command from help alone.
  - evidence: jupyterlab-drawio --help and shapes/stencils/validate/layout --help each exit 0 with flags, output description, worked examples and the 0/1/2 exit-code block.
  - test-tags: UNIT, MANUAL
  - log: 2026-11-01T14:49:14Z @kj added
  - log: 2026-11-02T08:44:46Z @kj closed
- [x] `ACC-CLI-2-SHAPES` **Shapes search prints JSON styles** - HIGH; shapes QUERY --json searches the palette and stencil indexes and prints an array of title, style, w, h and source; a query with no match exits 1.
  - evidence: jupyterlab-drawio shapes "aws lambda" --json --limit 3 exits 0 with title/style/w/h/source objects; shapes "aws eks" --json yields 8 stencil-source rows; an unmatched query exits 1.
  - test-tags: UNIT
  - log: 2026-11-01T14:49:14Z @kj added
  - log: 2026-11-02T08:44:55Z @kj closed
- [x] `ACC-CLI-3-VALIDATE` **Validate gates a diagram** - HIGH; validate FILE exits 0 clean and 1 with issues; it reports dangling edges, duplicate and reserved ids and broken parents, warns on off-grid and overlap, and --strict fails on warnings.
  - evidence: valid.drawio exits 0 (0 errors, 0 warnings); broken fixture exits 1 on a dangling edge; a 5-fault file reports duplicate/reserved ids and broken parent; warnings file exits 0 with off-grid/overlap and exits 1 under --strict.
  - test-tags: UNIT
  - log: 2026-11-01T14:49:14Z @kj added
  - log: 2026-11-02T08:44:55Z @kj closed
- [x] `ACC-CLI-4-LAYOUT` **Layout writes drawio XML** - MEDIUM; layout GRAPH -o OUT writes drawio XML from graph JSON through Graphviz dot; a missing dot exits 1 naming the install step.
  - evidence: dot absent: layout exits 1 naming "install graphviz"; with a -Tplain stand-in dot, layout graph.json -o out.drawio exits 0, writes XML and --json reports {nodes:2,edges:1}; validate of the output: 0 errors, 0 warnings.
  - test-tags: UNIT
  - log: 2026-11-01T14:49:14Z @kj added
  - log: 2026-11-02T08:44:55Z @kj closed
- [x] `ACC-CLI-5-ENTRYPOINT` **Console script declared** - HIGH; pyproject.toml declares the jupyterlab-drawio console script under project.scripts, and the wheel ships it.
  - evidence: pyproject.toml:28 [project.scripts] jupyterlab-drawio = jupyterlab_drawio_render_extension.cli:main; wheel 1.0.29 dist-info entry_points.txt carries the same console_scripts line; /opt/conda/bin/jupyterlab-drawio --help exits 0.
  - test-tags: MANUAL
  - log: 2026-11-01T14:49:14Z @kj added
  - log: 2026-11-02T08:44:55Z @kj closed

## Stencil index `STENC`

Vendor stencil shapes decoded from the shipped stencils.min.js.

- log: 2026-11-01T14:49:18Z @kj category created

- [x] `ACC-STENC-6-ALLSETS` **All 204 stencil sets indexed** - HIGH; The CLI decodes all 204 stencil sets and 9,090 shapes from static/stencils.min.js; stencils --json lists every set with its shape count.
  - evidence: jupyterlab-drawio stencils --json exits 0 with 204 sets totalling 9,090 shapes decoded from static/stencils.min.js (3,873,040 bytes).
  - test-tags: UNIT
  - log: 2026-11-01T14:49:18Z @kj added
  - log: 2026-11-02T08:44:55Z @kj closed
- [x] `ACC-STENC-7-CACHE` **Decoded index is cached** - MEDIUM; The decoded index is cached by source size and mtime; a cache hit answers shapes in under a second; JUPYTERLAB_DRAWIO_CACHE moves the cache directory.
  - evidence: JUPYTERLAB_DRAWIO_CACHE=/tmp/drawio-acc-check/cache: cold shapes run 3.140s wrote stencil-index-v1.json keyed by size 3873040 and mtime_ns; warm run 0.449s with identical output.
  - test-tags: UNIT
  - log: 2026-11-01T14:49:18Z @kj added
  - log: 2026-11-02T08:44:55Z @kj closed
- [x] `ACC-STENC-8-MISSING` **Missing stencils degrade cleanly** - MEDIUM; With stencils.min.js absent, palette search still works and stencils names jlpm build:assets and exits 1.
  - evidence: A package copy with static/stencils.min.js removed: shapes "aws lambda" --json still exits 0 with palette results; stencils exits 1 with "stencil asset not found ... run: jlpm build:assets".
  - test-tags: UNIT
  - log: 2026-11-01T14:49:18Z @kj added
  - log: 2026-11-02T08:44:56Z @kj closed

## Agent skill `SKILL`

The drawio authoring skill shipped in the repository and the wheel.

- log: 2026-11-01T14:49:18Z @kj category created

- [x] `ACC-SKILL-9-NAME` **Skill name matches folder and extension** - HIGH; .agents/skills/jupyterlab-drawio-render-extension/SKILL.md carries name jupyterlab-drawio-render-extension in its frontmatter.
  - evidence: .agents/skills/jupyterlab-drawio-render-extension/SKILL.md frontmatter reads name: jupyterlab-drawio-render-extension, matching the folder and package name.
  - test-tags: MANUAL
  - log: 2026-11-01T14:49:18Z @kj added
  - log: 2026-11-02T08:44:56Z @kj closed
- [x] `ACC-SKILL-10-CMDS` **Skill commands exist** - HIGH; Every command and flag the skill names exists in --help, and no instruction names a script the extension does not ship.
  - evidence: Skill names commands shapes/stencils/validate/layout and flags --direction --help --json --limit --mono --no-stencils --strict, all present in --help; unshipped pyimports.py etc appear only in explicit not-shipped statements.
  - test-tags: MANUAL
  - log: 2026-11-01T14:49:18Z @kj added
  - log: 2026-11-02T08:44:56Z @kj closed
- [x] `ACC-SKILL-11-REFS` **References and example present** - MEDIUM; The references and the worked example are present and point at the CLI.
  - evidence: 8 references under references/ and examples/architecture-ccmt-ai.drawio exist; autolayout.md, shapes.md, aws-architecture.md and troubleshooting.md name jupyterlab-drawio commands; the SKILL.md bundled-resources table points at the example.
  - test-tags: MANUAL
  - log: 2026-11-01T14:49:18Z @kj added
  - log: 2026-11-02T08:44:56Z @kj closed

## Packaging `PKG`

Wheel contents for the CLI data and the skill.

- log: 2026-11-01T14:49:18Z @kj category created

- [x] `ACC-PKG-12-SHARED` **Wheel ships data and skill** - HIGH; pyproject shared-data installs the skill at share/jupyter/agents/skills/jupyterlab-drawio-render-extension, and the palette index ships in package data with its Apache-2.0 notice.
  - evidence: Wheel 1.0.29 contains .data/data/share/jupyter/agents/skills/jupyterlab-drawio-render-extension/ SKILL.md, 8 references and the example, plus package data shape-index.json.gz and SHAPE-INDEX-NOTICE.md naming Apache-2.0; installed at /opt/conda/share/jupyter/agents/skills/.
  - test-tags: MANUAL
  - log: 2026-11-01T14:49:18Z @kj added
  - log: 2026-11-02T08:44:56Z @kj closed
