<!-- @import /home/lab/workspace/.claude/CLAUDE.md -->

# Project-Specific Configuration

This file imports workspace-level configuration from `/home/lab/workspace/.claude/CLAUDE.md`.
All workspace rules apply. Project-specific rules below strengthen or extend them.

The workspace `/home/lab/workspace/.claude/` directory contains additional instruction files
(MERMAID.md, NOTEBOOK.md, DATASCIENCE.md, GIT.md, and others) referenced by CLAUDE.md.
Consult workspace CLAUDE.md and the .claude directory to discover all applicable standards.

## Mandatory Bans (Reinforced)

The following workspace rules are STRICTLY ENFORCED for this project:

- **No automatic git tags** - only create tags when user explicitly requests
- **No automatic version changes** - only modify version in package.json/pyproject.toml/etc. when user explicitly requests
- **No automatic publishing** - never run `make publish`, `npm publish`, `twine upload`, or similar without explicit user request
- **No manual package installs if Makefile exists** - use `make install` or equivalent Makefile targets, not direct `pip install`/`uv install`/`npm install`
- **No automatic git commits or pushes** - only when user explicitly requests

## Project Context

JupyterLab extension for rendering Draw.io diagrams directly in the notebook interface. The extension provides read-only viewing of `.drawio` files within JupyterLab - a viewer widget without editing capabilities.

**Technology Stack**:

- TypeScript/JavaScript frontend extension
- Python server extension (`jupyter_server>=2.4.0`)
- JupyterLab 4.0.0+ compatible
- Build system: hatchling with hatch-jupyter-builder

**Package Names**:

- npm: `jupyterlab_drawio_render_extension`
- PyPI: `jupyterlab-drawio-render-extension` (hyphenated)

## Journal Rules (Project-Specific)

- **APPEND ONLY**: New journal entries MUST be appended at the end of the file, never inserted between existing entries
- Entries maintain strict chronological order by position - the last entry in the file is always the most recent work
- Never reorder, move, or insert entries out of sequence
- The Stellars **journal plugin** is the canonical tool for this file: create via `/journal:create`, append via `/journal:update`, archive via `/journal:archive`. The `journal:journal` skill auto-triggers on any mention of "journal" and runs `journal-tools check` after every write
- Direct edits to `JOURNAL.md` are a last resort - prefer the plugin so modus secundis format, continuous numbering and append-only order are enforced automatically

## Strengthened Rules

- **Build via Makefile only** - use `make install` to build and install the extension; never run `pip install`, `jlpm install`, or `jlpm build` directly
- **Commit lockfiles together** - always commit both `package.json` and `package-lock.json` (and `yarn.lock`) when dependencies change
- **JupyterLab extension standards** - follow the `jupyterlab-extension` skill for testing, CI/CD, and jupyter-releaser workflows
- **Release discipline** - version bumps and releases go through jupyter-releaser; never hand-edit version numbers or publish without explicit user request
