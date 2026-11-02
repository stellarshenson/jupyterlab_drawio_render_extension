"""Deterministic structural linter for .drawio files.

Catches the class of mistakes a vision self-check is slow and unreliable at:
dangling edge endpoints, duplicate or reserved ids, broken parent references,
and (as warnings) off-grid geometry and overlapping sibling nodes. Runs without
launching draw.io, so it is a fast pre-check before visual review.

Compressed diagram pages are decoded before linting; a payload that cannot be
decoded is reported as an error.
"""

from __future__ import annotations

import base64
import urllib.parse
import xml.etree.ElementTree as ET
import zlib

RESERVED = {"0", "1"}
GRID = 10


def rect(cell):
    """Return (x, y, w, h) floats for a cell's geometry, or None if absent/bad.

    x/y default to 0 when omitted: draw.io treats a missing position as the
    origin, and container-managed children (table rows, swimlane/UML-class
    lines under tableLayout) legitimately omit x/y while keeping width/height.
    Only width/height are required to be present and numeric.
    """
    geometry = cell.find("mxGeometry")
    if geometry is None:
        return None
    try:
        return (
            float(geometry.get("x", "0")),
            float(geometry.get("y", "0")),
            float(geometry.get("width", "nan")),
            float(geometry.get("height", "nan")),
        )
    except ValueError:
        return None


def is_edge_label(cell):
    """True for a draw.io edge label / relative-positioned child vertex.

    These legitimately omit width/height: their position is given relative to a
    parent edge (style ``edgeLabel``) or via ``relative="1"`` geometry. Treating
    them as normal vertices wrongly flags them as missing/invalid geometry.
    """
    if "edgeLabel" in (cell.get("style") or ""):
        return True
    geometry = cell.find("mxGeometry")
    return geometry is not None and geometry.get("relative") == "1"


def overlap(a, b):
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    return ax < bx + bw and bx < ax + aw and ay < by + bh and by < ay + ah


def cells_of(root):
    """Return (id, mxCell) pairs, unwrapping UserObject/object wrappers.

    The wrapper's id is what draw.io edges and parents reference; the inner
    mxCell holds the style, vertex/edge flags and geometry. An inner mxCell id
    wins when present, matching the draw.io codec.
    """
    cells = []
    for element in root:
        cell, cell_id = element, element.get("id")
        if element.tag in ("UserObject", "object"):
            inner = element.find("mxCell")
            if inner is None:
                continue
            cell = inner
            cell_id = inner.get("id") or element.get("id")
        cells.append((cell_id, cell))
    return cells


def check_page(diagram):
    """Return (errors, warnings) for one <diagram> page."""
    name = diagram.get("name", "?")
    model = diagram.find("mxGraphModel")
    if model is None:
        text = (diagram.text or "").strip()
        if not text:
            return [f"page {name!r}: no <mxGraphModel>"], []
        try:
            model = ET.fromstring(
                urllib.parse.unquote_to_bytes(
                    zlib.decompress(base64.b64decode(text), -15)
                )
            )
        except (ValueError, zlib.error, ET.ParseError) as exc:
            return [f"page {name!r}: cannot decode compressed payload ({exc})"], []
    root = model.find("root")
    cells = cells_of(root) if root is not None else []
    errors, warns = [], []
    ids = {}
    for cell_id, cell in cells:
        if cell_id in ids:
            errors.append(f"duplicate id {cell_id!r}")
        ids[cell_id] = cell
    parents = {cell.get("parent") for _, cell in cells}  # ids that have children
    for cell_id, cell in cells:
        parent = cell.get("parent")
        is_vertex, is_edge = cell.get("vertex") == "1", cell.get("edge") == "1"
        if parent is not None and parent not in ids:
            errors.append(f"cell {cell_id!r} parent {parent!r} does not exist")
        for end in ("source", "target"):
            ref = cell.get(end)
            if ref and ref not in ids:
                errors.append(f"edge {cell_id!r} {end} {ref!r} does not exist")
        if (is_vertex or is_edge) and cell_id in RESERVED:
            errors.append(f"cell {cell_id!r} reuses reserved id 0/1")
        if is_vertex and not is_edge_label(cell):
            geometry = rect(cell)
            if geometry is None or any(value != value for value in geometry):  # None or NaN
                errors.append(f"vertex {cell_id!r} has missing/invalid geometry")
            else:
                x, y, w, h = geometry
                if w <= 0 or h <= 0:
                    warns.append(f"vertex {cell_id!r} non-positive size {w:g}x{h:g}")
                if x < 0 or y < 0:
                    warns.append(f"vertex {cell_id!r} negative position ({x:g},{y:g})")
                if any(value % GRID for value in geometry):
                    warns.append(
                        f"vertex {cell_id!r} off-grid geometry "
                        f"({x:g},{y:g}) {w:g}x{h:g}"
                    )
    # Sibling overlap: only leaf vertices (containers legitimately wrap children).
    boxes = [
        (cell_id, cell.get("parent"), rect(cell))
        for cell_id, cell in cells
        if cell.get("vertex") == "1"
        and cell_id not in parents
        and rect(cell)
        and not any(value != value for value in rect(cell))
    ]
    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            (id_a, parent_a, rect_a), (id_b, parent_b, rect_b) = boxes[i], boxes[j]
            if parent_a == parent_b and overlap(rect_a, rect_b):
                warns.append(f"vertices {id_a!r} and {id_b!r} overlap")
    return errors, warns


def validate_file(path, strict=False):
    """Lint one .drawio file.

    Returns {"errors": [...], "warnings": [...], "ok": bool}, where ok is False
    for any error, or for a warning when strict is true. Raises ET.ParseError or
    OSError when the file cannot be read as XML.
    """
    tree = ET.parse(path)
    pages = tree.getroot().findall("diagram") or [tree.getroot()]
    errors, warns = [], []
    for page in pages:
        page_errors, page_warns = check_page(page)
        errors += page_errors
        warns += page_warns
    return {
        "errors": errors,
        "warnings": warns,
        "ok": not errors and not (strict and warns),
    }
