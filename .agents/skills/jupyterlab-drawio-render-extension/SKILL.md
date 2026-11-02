---
name: jupyterlab-drawio-render-extension
description: Author or fix draw.io diagrams (architecture, UML, ERD, sequence, flowchart, network, ML), look up exact official shape styles including vendor stencils (AWS, Azure, GCP, Cisco), validate a .drawio file, auto-layout a graph, and render or export through the JupyterLab viewer. Use when asked to draw, fix, validate, lay out or style a draw.io diagram.
---

# Draw.io diagrams

Produces editable `.drawio` XML. The JupyterLab Draw.io extension renders it read-only; the user exports PNG from the viewer with a right-click. Read `jupyterlab-drawio --help` and `jupyterlab-drawio <command> --help` before running anything (`shapes`, `stencils`, `validate`, `layout`). The rules below are the draw.io knowledge `--help` cannot enforce.

## Workflow

Ask 1-3 questions only when the request lacks the diagram type (ERD, UML class, sequence, architecture, ML, flowchart), the output path or the scope. Skip when the request is clear.

**Step 0 - active style preset.** A phrase that names a preset ("use my `<name>` style", "in `<name>` mode") activates it. Otherwise load the user preset marked `"default": true` in `~/.drawio-skill/styles/`. A loaded preset replaces the color, shape, edge and font conventions below for this diagram; read `references/style-presets.md` for the application rules. If the named preset is absent, list the user presets and stop; do not fall back silently. Built-in preset JSON is not shipped in this extension, so only user presets are available.

**Step 1 - plan.** List shapes, relationships, direction (LR or TB) and tiers.

**Step 2 - generate.** Write the `.drawio` XML. Hand-place coordinates for small or styled diagrams. For large or layout-heavy graphs (more than about 15 nodes) write graph JSON and run `jupyterlab-drawio layout graph.json -o diagram.drawio`; input format in `references/autolayout.md`. For any non-trivial shape or vendor icon run `jupyterlab-drawio shapes "<keywords>"` first; a guessed `shape=mxgraph.*` name renders as a blank box.

**Step 3 - validate.** Run `jupyterlab-drawio validate diagram.drawio`. Exit 0 is clean, warnings included; exit 1 lists errors (dangling edges, duplicate or reserved ids, broken parents), and `--strict` also exits 1 on warnings (overlap, geometry). Exit 2 is a usage error. Fix and rerun.

**Step 4 - review.** The user opens the file in the JupyterLab viewer and gives feedback. Apply the minimal XML edit, re-validate, and let the user reload. Repeat until approved.

### Review loop

| User request | XML edit |
|---|---|
| Change color of X | Find the `mxCell` by `value`, update `fillColor` / `strokeColor` |
| Add a node | Append a vertex with the next free id, position near related nodes |
| Remove a node | Delete the vertex and every edge with it as `source` or `target` |
| Move or resize X | Update `x`/`y` or `width`/`height` in the matching `mxGeometry` |
| Add arrow A to B | Append an edge with `source` and `target` matching A and B |
| Change label | Update the `value` attribute |
| Change layout direction | Regenerate the full XML |

- Single-element changes: edit in place; this preserves tuned coordinates
- Layout-wide changes: regenerate
- Re-validate after every edit
- After 5 rounds, suggest the user fine-tune directly in a draw.io editor

## XML structure

### File skeleton

```xml
<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="drawio" version="26.0.0">
  <diagram name="Page-1">
    <mxGraphModel>
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <!-- user shapes start at id="2" -->
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

- `id="0"` and `id="1"` are required root cells; never omit them
- User shapes start at `id="2"` and increment
- Every shape has `parent="1"` unless it sits inside a container
- Every text style carries `html=1`
- Never put `--` inside an XML comment
- Escape `&amp;`, `&lt;`, `&gt;`, `&quot;` in attribute values
- Multi-line labels use `&#xa;`, not a literal `\n`

### Shape types

| Style keyword | Use for |
|---|---|
| `rounded=0` | plain rectangle |
| `rounded=1` | rounded rectangle, service or module |
| `ellipse;` | start, end, database alternative |
| `rhombus;` | decision |
| `shape=cylinder3;` | database |
| `swimlane;` | container with a title bar |

For vendor and branded icons, run `jupyterlab-drawio shapes "<keywords>"` and copy the returned `style` verbatim and size the cell as `references/shapes.md` says. Do not guess `shape=mxgraph.*`. The cheatsheet and the search rules are in `references/shapes.md`.

Required properties:

```xml
<mxCell id="2" value="Label" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1">
  <mxGeometry x="100" y="100" width="160" height="60" as="geometry" />
</mxCell>

<mxCell id="3" value="DB" style="shape=cylinder3;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666666;fontColor=#333333;" vertex="1" parent="1">
  <mxGeometry x="350" y="100" width="120" height="80" as="geometry" />
</mxCell>

<mxCell id="4" value="Check?" style="rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;" vertex="1" parent="1">
  <mxGeometry x="100" y="220" width="160" height="80" as="geometry" />
</mxCell>
```

### Containers and groups

Use real parent-child containment; do not stack shapes on top of a larger shape.

| Type | Style | When |
|---|---|---|
| Group, invisible | `group;pointerEvents=0;` | no border, no own connections |
| Swimlane, titled | `swimlane;startSize=30;` | needs a visible title bar, or has connections |
| Any shape as container | add `container=1;pointerEvents=0;` | box without own connections |

```xml
<mxCell id="svc1" value="User Service" style="swimlane;startSize=30;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1">
  <mxGeometry x="100" y="100" width="300" height="200" as="geometry"/>
</mxCell>
<mxCell id="api1" value="REST API" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="svc1">
  <mxGeometry x="20" y="40" width="120" height="60" as="geometry"/>
</mxCell>
```

- Children set `parent="<containerId>"` and use coordinates relative to the container

### Edges

Every edge cell needs the expanded `<mxGeometry relative="1" as="geometry" />` child. A self-closing edge cell does not render.

```xml
<mxCell id="10" value="" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;" edge="1" parent="1" source="2" target="3">
  <mxGeometry relative="1" as="geometry" />
</mxCell>

<mxCell id="11" value="HTTP/REST" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=1;exitDx=0;exitDy=0;entryX=0.5;entryY=0;entryDx=0;entryDy=0;" edge="1" parent="1" source="2" target="4">
  <mxGeometry relative="1" as="geometry" />
</mxCell>

<mxCell id="12" value="" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;" edge="1" parent="1" source="3" target="5">
  <mxGeometry relative="1" as="geometry">
    <Array as="points">
      <mxPoint x="500" y="50" />
    </Array>
  </mxGeometry>
</mxCell>
```

- Always keep `rounded=1;orthogonalLoop=1;jettySize=auto` for routing that avoids overlaps
- Pin `exitX/exitY/entryX/entryY` when a node has 2 or more connections
- Add `<Array as="points">` waypoints when an edge must detour around a shape
- Keep the last straight segment before the target at 20 px or more, or the arrowhead overlaps the bend
- `flowAnimation=1;` animates a moving dot; usable in SVG export and the editor

Connection points:

| Position | x | y | Use |
|---|---:|---:|---|
| Top center | 0.5 | 0 | node above |
| Top left / right | 0.25 / 0.75 | 0 | 2nd / 3rd from top |
| Right center | 1 | 0.5 | node on the right |
| Bottom center | 0.5 | 1 | node below |
| Left center | 0 | 0.5 | node on the left |

If a side carries N connections, space them evenly: 3 on the bottom give `exitX = 0.25, 0.5, 0.75`.

## Color palette

Used when no preset is active. The preset rules win when one is loaded.

| Color | fillColor | strokeColor | Use for |
|---|---|---|---|
| Blue | `#dae8fc` | `#6c8ebf` | services, clients |
| Green | `#d5e8d4` | `#82b366` | success, databases |
| Yellow | `#fff2cc` | `#d6b656` | queues, decisions |
| Orange | `#ffe6cc` | `#d79b00` | gateways, APIs |
| Red / pink | `#f8cecc` | `#b85450` | errors, alerts |
| Grey | `#f5f5f5` | `#666666` | external, neutral |
| Purple | `#e1d5e7` | `#9673a6` | security, auth |

## Layout tips

| Complexity | Nodes | Horizontal gap | Vertical gap |
|---|---|---:|---:|
| Simple | 5 or fewer | 200 px | 150 px |
| Medium | 6 to 10 | 280 px | 200 px |
| Complex | more than 10 | 350 px | 250 px |

- Snap hand-placed `x` and `y` to a multiple of 10. Off-grid geometry is a validate warning, not an error.
- Leave an empty routing corridor of about 80 px between rows and columns; never place a shape where an edge must pass
- Plan the grid before assigning coordinates; group related nodes in the same band
- Place hub nodes centrally so edges radiate without crossing
- Center a child under its parent to avoid diagonal routing
- Event bus pattern: put Kafka or the bus in the center of the service row, not below
- Trace each edge path before finalizing; move the shape or add waypoints when an edge crosses an unrelated shape
- Tree layout: one layer per row, connect adjacent layers only
- An edge that spans several rows routes along the outer corridor

## Diagram types

Read `references/diagram-types.md` for the matching preset. It sets structural style keywords, shapes, edges and direction.

| User says | Section |
|---|---|
| ER diagram, schema, data model | ERD |
| UML class, class diagram | UML Class |
| Sequence, interaction, lifeline | Sequence |
| Architecture, system, service diagram | Architecture |
| Neural network, model architecture, ML, deep learning | ML / Deep Learning |
| Flowchart, decision tree, process flow | Flowchart |

With an active user preset, keep the structural keywords and layer the preset color, font, edge and extras on top; `references/style-presets.md` has the merge rules.

## Bundled resources

Read a file only when the workflow needs it.

| File | Read it when |
|---|---|
| `references/diagram-types.md` | the user names a diagram type |
| `references/shapes.md` | the diagram needs a specific shape or a cheatsheet |
| `references/autolayout.md` | the diagram is large or layout-heavy; graph JSON format |
| `references/aws-architecture.md` and `examples/architecture-ccmt-ai.drawio` | the diagram is an AWS architecture or another layered system |
| `references/troubleshooting.md` | rendering, opening or edge routing looks wrong |
| `references/style-presets.md` | a preset is active, or the user asks to learn, list or manage one |
| `references/style-extraction.md` | a preset is being extracted from a `.drawio` file or an image |

The importers (`pyimports`, `jsimports`, `goimports`, `rustimports`), `pyclasses` and `aiicons` are not shipped in this extension; they stay with the retired home skill until ported.
