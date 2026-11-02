"""Auto-layout a logical graph into draw.io XML using Graphviz.

Takes a graph (nodes + edges as JSON), runs `dot` to position the nodes, and
emits a .drawio document with the mxGeometry x/y filled in. draw.io routes the
edges itself (orthogonal style). This removes the manual-coordinate ceiling for
medium/large diagrams.

Input JSON:
  {
    "direction": "TB",          # TB (top-bottom, default) or LR (left-right)
    "nodes": [
      {"id": "a", "label": "Service A", "style": "rounded=1;...",
       "width": 120, "height": 60}
    ],
    "edges": [
      {"source": "a", "target": "b", "label": "calls"}
    ]
  }
Only "id" is required per node; label defaults to id and style/width/height
have defaults. Node ids must be unique and must not be "0" or "1" (reserved
for the draw.io root cells). Requires Graphviz `dot` on PATH.
"""

from __future__ import annotations

import shlex
import subprocess
from xml.sax.saxutils import escape

DEFAULT_W, DEFAULT_H = 120, 60
NODE_STYLE = "rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;"
EDGE_STYLE = "html=1;rounded=0;"
GROUP_STYLE = (
    "rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#999999;"
    "verticalAlign=top;fontStyle=2;dashed=1;"
)
# Ordered (fill, stroke) pairs from the skill's default palette, so grouped
# graphs keep the same colours as the drawio skill. Nodes that carry their own
# style keep it; only styleless grouped nodes are tinted. Disable with --mono.
PALETTE = [
    ("#dae8fc", "#6c8ebf"),  # primary
    ("#d5e8d4", "#82b366"),  # success
    ("#ffe6cc", "#d79b00"),  # accent
    ("#e1d5e7", "#9673a6"),  # secondary
    ("#fff2cc", "#d6b656"),  # warning
    ("#f8cecc", "#b85450"),  # danger
    ("#f5f5f5", "#666666"),  # neutral
]
# Uniform container padding; the title sits in the top pad (verticalAlign=top).
# dot's cluster margin is set to this same value so each container box equals
# dot's cluster box — which dot guarantees never overlaps, at any nesting depth.
GROUP_PAD = 20


def attr(value):
    return escape(str(value), {'"': "&quot;"})


def dot_quote(value):
    # Wrap as a DOT double-quoted string, escaping backslash and quote so ids
    # with those characters can't corrupt the Graphviz input.
    return '"' + str(value).replace("\\", "\\\\").replace('"', '\\"') + '"'


def snap(value, grid=10):
    # Align to the grid the skill uses everywhere (multiples of 10).
    return int(round(value / grid) * grid)


def group_tree(nodes):
    """Parse hierarchical `group` paths ("a/b") into a container tree.

    Returns (gpath, direct, children, ordered):
      gpath[node_id] = tuple of path segments (the node's deepest container)
      direct[path]   = node ids whose group is exactly this path
      children[path] = child container paths
      ordered        = all container paths, shallow-to-deep (stable)
    """
    gpath, direct, paths = {}, {}, set()
    for node in nodes:
        group = node.get("group")
        if group is None or str(group).strip("/") == "":
            continue
        tree = tuple(str(group).strip("/").split("/"))
        gpath[node["id"]] = tree
        direct.setdefault(tree, []).append(node["id"])
        for k in range(1, len(tree) + 1):
            paths.add(tree[:k])
    children = {}
    for path in sorted(paths):
        if len(path) > 1:
            children.setdefault(path[:-1], []).append(path)
    ordered = sorted(paths, key=lambda path: (len(path), path))
    return gpath, direct, children, ordered


def build_dot(graph):
    rankdir = "LR" if str(graph.get("direction", "TB")).upper() == "LR" else "TB"
    # splines=ortho makes dot route edges as orthogonal polylines; we replay
    # those bends as draw.io waypoints so edges go around nodes, not through them.
    lines = [f"digraph G {{ rankdir={rankdir}; splines=ortho; node [shape=box fixedsize=true];"]
    # Group nodes into (possibly nested) clusters so dot keeps each group
    # together; a node's first appearance fixes its cluster, so list members
    # before the size attributes. The cluster margin reserves room for the
    # padded container boxes we draw below (extra on Y for the title strip) so
    # neighbouring boxes do not overlap.
    _, direct, children, ordered = group_tree(graph["nodes"])
    cluster_index = {path: i for i, path in enumerate(ordered)}

    def emit_cluster(path, pad):
        lines.append(f"{pad}subgraph cluster_{cluster_index[path]} {{ margin={GROUP_PAD};")
        for child in children.get(path, []):
            emit_cluster(child, pad + "  ")
        lines.extend(f"{pad}  {dot_quote(member)};" for member in direct.get(path, []))
        lines.append(pad + "}")

    for root in [path for path in ordered if len(path) == 1]:
        emit_cluster(root, "")
    for node in graph["nodes"]:
        # Pass our pixel sizes to dot as inches so it lays out at the real size.
        width = node.get("width", DEFAULT_W) / 72.0
        height = node.get("height", DEFAULT_H) / 72.0
        lines.append(f'{dot_quote(node["id"])} [width={width:.4f} height={height:.4f}];')
    for edge in graph.get("edges", []):
        lines.append(f'{dot_quote(edge["source"])} -> {dot_quote(edge["target"])};')
    lines.append("}")
    return "\n".join(lines)


def layout(dot_src):
    """Run `dot -Tplain`; return (height_in, {id: (xc, yc)}, {(src, dst): [(x, y), ...]}).

    Node coords are inches (bottom-left origin); each edge's value is the list
    of orthogonal control points dot computed for routing, endpoints included.
    """
    try:
        proc = subprocess.run(
            ["dot", "-Tplain"], input=dot_src,
            capture_output=True, text=True, check=True,
        )
    except FileNotFoundError as exc:
        raise RuntimeError(
            "Graphviz `dot` not found on PATH; install graphviz "
            "(e.g. apt install graphviz) and retry"
        ) from exc
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(
            f"dot failed: {exc.stderr.strip()}; check that every edge source and "
            f"target names a node"
        ) from exc
    height, pos, edges = 0.0, {}, {}
    for line in proc.stdout.splitlines():
        token = shlex.split(line)
        if not token:
            continue
        if token[0] == "graph":
            height = float(token[3])  # graph scale width height
        elif token[0] == "node":
            pos[token[1]] = (float(token[2]), float(token[3]))  # node name x y ...
        elif token[0] == "edge":  # edge tail head n x1 y1 ... xn yn
            n = int(token[3])
            edges[(token[1], token[2])] = [
                (float(token[4 + 2 * i]), float(token[5 + 2 * i])) for i in range(n)
            ]
    return height, pos, edges


def group_style(stroke):
    """Container box styled with a group's colour (coloured border + title)."""
    return (
        f"rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor={stroke};"
        f"fontColor={stroke};verticalAlign=top;fontStyle=2;dashed=1;"
    )


def to_drawio(graph, height, pos, edge_pts, color=True):
    nodes = graph["nodes"]
    # Absolute snapped rect for every placed node.
    rects = {}
    for node in nodes:
        node_id = node["id"]
        if node_id not in pos:
            continue
        width, height_px = node.get("width", DEFAULT_W), node.get("height", DEFAULT_H)
        xc, yc = pos[node_id]
        x = snap(xc * 72 - width / 2)
        y = snap((height - yc) * 72 - height_px / 2)  # flip: dot origin is bottom-left
        rects[node_id] = (x, y, width, height_px)
    # Parse the (possibly nested) group tree and assign each container a
    # collision-free id and a title (the path's last segment, or a member's groupLabel).
    gpath, direct, children, ordered = group_tree(nodes)
    # Assign each top-level group a palette colour, in order of first appearance.
    top_order = []
    for node in nodes:
        tree = gpath.get(node["id"])
        if tree and tree[0] not in top_order:
            top_order.append(tree[0])

    def gcolor(segment):
        return PALETTE[top_order.index(segment) % len(PALETTE)]

    used = {node["id"] for node in nodes}
    label_override = {}
    for node in nodes:
        if node["id"] in gpath and "groupLabel" in node:
            label_override.setdefault(gpath[node["id"]], str(node["groupLabel"]))
    gid, glabel = {}, {}
    for i, path in enumerate(ordered):
        cell_id = f"group_{i}"
        while cell_id in used:  # never collide with a node id
            cell_id += "_"
        used.add(cell_id)
        gid[path] = cell_id
        glabel[path] = label_override.get(path, path[-1])
    # Container bounding box (members + nested children + uniform padding),
    # computed deepest-first so a parent can wrap its already-sized children.
    gbox = {}
    for path in sorted(ordered, key=len, reverse=True):
        boxes = [
            (rects[member][0], rects[member][1], rects[member][0] + rects[member][2],
             rects[member][1] + rects[member][3])
            for member in direct.get(path, []) if member in rects
        ]
        boxes += [
            (gbox[child][0], gbox[child][1], gbox[child][0] + gbox[child][2],
             gbox[child][1] + gbox[child][3])
            for child in children.get(path, []) if child in gbox
        ]
        if not boxes:
            continue
        x0 = min(box[0] for box in boxes) - GROUP_PAD
        y0 = min(box[1] for box in boxes) - GROUP_PAD
        x1 = max(box[2] for box in boxes) + GROUP_PAD
        y1 = max(box[3] for box in boxes) + GROUP_PAD
        gbox[path] = (x0, y0, x1 - x0, y1 - y0)

    # Shift everything positive: a container's top padding can push its top edge
    # above the page origin. Only translates when something would be negative.
    absx = [rect[0] for rect in rects.values()] + [box[0] for box in gbox.values()]
    absy = [rect[1] for rect in rects.values()] + [box[1] for box in gbox.values()]
    dx = GROUP_PAD - min(absx) if absx and min(absx) < 0 else 0
    dy = GROUP_PAD - min(absy) if absy and min(absy) < 0 else 0

    def rebase(x, y, parent_path):
        """Absolute -> coordinates relative to parent_path's box (or shifted if top-level)."""
        if parent_path is None:
            return x + dx, y + dy, "1"
        px, py, _, _ = gbox[parent_path]
        return x - px, y - py, gid[parent_path]

    cells = []
    # Containers shallow-first so each parent precedes its children.
    for path in ordered:
        if path not in gbox:
            continue
        gx, gy, gw, gh = gbox[path]
        x, y, parent = rebase(gx, gy, path[:-1] if len(path) > 1 else None)
        style = group_style(gcolor(path[0])[1]) if color else GROUP_STYLE
        cells.append(
            f'        <mxCell id="{attr(gid[path])}" value="{attr(glabel[path])}" '
            f'style="{style}" vertex="1" parent="{attr(parent)}">\n'
            f'          <mxGeometry x="{x}" y="{y}" width="{gw}" height="{gh}" as="geometry"/>\n'
            f"        </mxCell>"
        )
    for node in nodes:
        node_id = node["id"]
        if node_id not in rects:
            continue
        rx, ry, width, height_px = rects[node_id]
        x, y, parent = rebase(rx, ry, gpath.get(node_id) if gpath.get(node_id) in gbox else None)
        if node.get("style"):
            style = node["style"]  # explicit style always wins
        elif color and node_id in gpath:
            fill, stroke = gcolor(gpath[node_id][0])  # tint styleless nodes by group
            style = f"rounded=1;whiteSpace=wrap;html=1;fillColor={fill};strokeColor={stroke};"
        else:
            style = NODE_STYLE
        cells.append(
            f'        <mxCell id="{attr(node_id)}" value="{attr(node.get("label", node_id))}" '
            f'style="{attr(style)}" vertex="1" parent="{attr(parent)}">\n'
            f'          <mxGeometry x="{x}" y="{y}" width="{width}" height="{height_px}" as="geometry"/>\n'
            f"        </mxCell>"
        )
    for i, edge in enumerate(graph.get("edges", [])):
        edge_id = f"e{i}"
        while edge_id in used:  # never collide with a node, group or earlier edge
            edge_id += "_"
        used.add(edge_id)
        # Drop the first/last points (they sit on the node borders, where
        # draw.io attaches anyway) and replay the interior bends as waypoints.
        interior = edge_pts.get((edge["source"], edge["target"]), [])[1:-1]
        if interior:
            points = "".join(
                f'<mxPoint x="{snap(x * 72) + dx}" y="{snap((height - y) * 72) + dy}"/>'
                for x, y in interior
            )
            geometry = (
                f'<mxGeometry relative="1" as="geometry">'
                f'<Array as="points">{points}</Array></mxGeometry>'
            )
        else:
            geometry = '<mxGeometry relative="1" as="geometry"/>'
        cells.append(
            f'        <mxCell id="{attr(edge_id)}" value="{attr(edge.get("label", ""))}" '
            f'style="{EDGE_STYLE}" edge="1" parent="1" '
            f'source="{attr(edge["source"])}" target="{attr(edge["target"])}">\n'
            f"          {geometry}\n"
            f"        </mxCell>"
        )
    return (
        '<mxfile>\n  <diagram id="autolayout" name="Page-1">\n'
        '    <mxGraphModel dx="800" dy="600" grid="1" gridSize="10" guides="1" '
        'tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" '
        'pageWidth="850" pageHeight="1100" math="0" shadow="0">\n'
        "      <root>\n"
        '        <mxCell id="0"/>\n'
        '        <mxCell id="1" parent="0"/>\n'
        + "\n".join(cells)
        + "\n      </root>\n    </mxGraphModel>\n  </diagram>\n</mxfile>\n"
    )


def render(graph, mono=False):
    """Lay out one graph dict and return the .drawio XML string."""
    # dot's plain output keys nodes by string, so numeric JSON ids must match.
    for node in graph["nodes"]:
        node["id"] = str(node["id"])
    for edge in graph.get("edges", []):
        edge["source"], edge["target"] = str(edge["source"]), str(edge["target"])
    height, pos, edge_points = layout(build_dot(graph))
    return to_drawio(graph, height, pos, edge_points, color=not mono)
