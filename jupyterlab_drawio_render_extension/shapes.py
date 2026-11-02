"""Searchable indexes of draw.io palette and stencil shapes.

Palette entries come from the bundled shape-search index (Apache-2.0; see
data/SHAPE-INDEX-NOTICE.md). Stencil entries are decoded from the
static/stencils.min.js asset the build fetches, then cached under
~/.cache/jupyterlab-drawio (override with JUPYTERLAB_DRAWIO_CACHE).

The palette search is a port of the drawio skill's shapesearch.py: tag map
with exact + Soundex matching, strict AND first, scored OR fallback, and a
title tiebreak within equal tag scores.
"""

from __future__ import annotations

import base64
import gzip
import json
import os
import re
import struct
import zlib
from functools import lru_cache
from pathlib import Path

PACKAGE_DIR = Path(__file__).resolve().parent
PALETTE_FILE = PACKAGE_DIR / "data" / "shape-index.json.gz"
STENCIL_FILE = PACKAGE_DIR / "static" / "stencils.min.js"
CACHE_NAME = "stencil-index-v1.json"

_SOUNDEX_MAP = "01230120022455012603010202"  # A..Z digit codes
_TRAIL = re.compile(r"\.*\d*$")  # strip trailing digits/dots before soundex
_STENCIL_BLOB = re.compile(r"f\['([^']+\.xml)'\] = '([A-Za-z0-9+/=]+)'")

_DRAW_OPS = {
    "move", "line", "quad", "curve", "arc", "rect", "roundrect", "ellipse",
    "text", "image", "include-shape",
}
_XS = {"x", "x1", "x2", "x3"}
_YS = {"y", "y1", "y2", "y3"}


# --- palette search ----------------------------------------------------------

def _soundex(name):
    if not name:
        return ""
    result = [name[0].upper()]
    size = 1
    for char in name[1:]:
        code_index = ord(char.upper()) - 65
        if 0 <= code_index <= 25 and _SOUNDEX_MAP[code_index] != "0":
            code = _SOUNDEX_MAP[code_index]
            if code != result[size - 1]:
                result.append(code)
                size += 1
                if size > 3:
                    break
    result += ["0"] * (4 - len(result))
    return "".join(result[:4])


def _build_tag_map(entries):
    """tag (and its Soundex) -> set of entry indices."""
    tag_map = {}
    for i, entry in enumerate(entries):
        raw = entry.get("tags")
        if not raw:
            continue
        seen = set()
        for token in re.sub(r"[/,()]", " ", raw.lower()).split(" "):
            if len(token) < 2 or token in seen:
                continue
            seen.add(token)
            tag_map.setdefault(token, set()).add(i)
            sx = _soundex(_TRAIL.sub("", token))
            if sx and sx != token and sx not in seen:
                seen.add(sx)
                tag_map.setdefault(sx, set()).add(i)
    return tag_map


def _split_compound(token):
    """'pid2misc' -> ['pid','misc']; 'discInst' -> ['disc','inst']."""
    spaced = re.sub(r"([a-z])([A-Z])", r"\1 \2", token)
    spaced = re.sub(r"([a-zA-Z])(\d)", r"\1 \2", spaced)
    spaced = re.sub(r"(\d)([a-zA-Z])", r"\1 \2", spaced)
    return [part for part in spaced.lower().split() if len(part) >= 2]


def _match_term(tag_map, term):
    exact = set(tag_map.get(term, set()))
    phonetic = set()
    sx = _soundex(_TRAIL.sub("", term))
    if sx and sx != term:
        phonetic = {i for i in tag_map.get(sx, set()) if i not in exact}
    return exact, phonetic


def _search(entries, tag_map, query, limit):
    if not query:
        return []
    terms, seen = [], set()
    for raw in query.lower().split():
        parts = _split_compound(raw) or ([raw] if len(raw) >= 2 else [])
        for term in parts:
            if term not in seen:
                seen.add(term)
                terms.append(term)
    if not terms:
        return []

    term_matches = [_match_term(tag_map, term) for term in terms]

    # Strict AND across all terms first.
    and_set = None
    for exact, phonetic in term_matches:
        combined = exact | phonetic
        and_set = combined if and_set is None else (and_set & combined)
        if not and_set:
            break

    # Score: +1.0 exact, +0.5 Soundex-only, per term. AND results if any, else OR.
    scores = {}
    pool = and_set if and_set else None
    for exact, phonetic in term_matches:
        for index in exact:
            if pool is None or index in pool:
                scores[index] = scores.get(index, 0) + 1.0
        for index in phonetic:
            if (pool is None or index in pool) and index not in exact:
                scores[index] = scores.get(index, 0) + 0.5

    # Rank by tag score, then verbatim query terms in the title, then title, then
    # index. The title tiebreak only reorders within an equal tag-score group.
    term_set = set(terms)

    def title_hits(index):
        title = entries[index].get("title") or ""
        return len(term_set & set(re.split(r"[^a-z0-9]+", title.casefold())))

    ranked = sorted(
        scores,
        key=lambda i: (-scores[i], -title_hits(i), (entries[i].get("title") or "").casefold(), i),
    )
    return [
        {
            "title": entries[i].get("title"),
            "style": entries[i]["style"],
            "w": entries[i].get("w"),
            "h": entries[i].get("h"),
            "source": entries[i]["source"],
        }
        for i in ranked[:limit]
    ]


# --- palette index -----------------------------------------------------------

@lru_cache(maxsize=1)
def load_palette():
    """Palette entries from the bundled shape-search index."""
    with gzip.open(PALETTE_FILE, "rt", encoding="utf-8") as fh:
        shapes = json.load(fh)
    return [
        {
            "title": shape["title"],
            "style": shape["style"],
            "w": shape["w"],
            "h": shape["h"],
            "tags": shape.get("tags", ""),
            "source": "palette",
        }
        for shape in shapes
    ]


# --- stencil index -----------------------------------------------------------

def _decode_stencil(payload):
    """Decode one base64 raw-deflate mxStencil document into a node tree."""
    data = zlib.decompress(base64.b64decode(payload), -15)
    lengths = struct.unpack_from(">5I", data, 0)
    streams, offset = [], 20
    for length in lengths:
        streams.append(data[offset:offset + length])
        offset += length
    ops = streams[0]
    strings = streams[4].decode("utf-8").split("\0")
    positions = [0, 0, 0, 0]
    string_index = 0
    names, attrs = [], []

    root = {"name": "#root", "attrs": {}, "kids": []}
    parent = root
    px = py = 0
    counters = {}

    def read_varint(stream):
        value, multiplier = 0, 1
        while True:
            byte = streams[stream][positions[stream]]
            positions[stream] += 1
            value += (byte & 127) * multiplier
            multiplier *= 128
            if not byte & 128:
                break
        return -(value + 1) // 2 if value % 2 else value // 2

    i = 0
    while i < len(ops):
        op = ops[i]
        i += 1
        if op == 255:
            parent = parent["up"]
            continue
        if (op >> 1) == len(names):
            names.append(strings[string_index])
            string_index += 1
        name = names[op >> 1]
        node = {"name": name, "attrs": {}, "kids": [], "up": parent}
        parent["kids"].append(node)
        count = ops[i]
        i += 1
        coordinates = name in _DRAW_OPS
        if name == "shape":
            px = py = 0
            counters = {}
        for _ in range(count):
            attr_id = ops[i]
            i += 1
            if attr_id == len(attrs):
                attrs.append(strings[string_index])
                string_index += 1
            attr = attrs[attr_id]
            flag = ops[i]
            i += 1
            if flag == 0:
                node["attrs"][attr] = strings[string_index]
                string_index += 1
            elif coordinates and attr in _XS:
                px += read_varint(1)
                node["attrs"][attr] = px / 1000
            elif coordinates and attr in _YS:
                py += read_varint(2)
                node["attrs"][attr] = py / 1000
            else:
                key = name + " " + attr
                counters[key] = counters.get(key, 0) + read_varint(3)
                node["attrs"][attr] = counters[key] / 1000
        if not op & 1:
            parent = node
    return root


def _iter_shapes(node):
    for child in node["kids"]:
        if child["name"] == "shape":
            yield child
        yield from _iter_shapes(child)


def _decode_set(key, payload):
    try:
        document = _decode_stencil(payload)
    except (ValueError, IndexError, struct.error, zlib.error) as exc:
        raise ValueError(f"cannot decode stencil set {key!r}: {exc}") from exc
    if not document["kids"]:
        return []
    root = document["kids"][0]
    prefix = root["attrs"].get("name", "")
    set_name = key[:-4]
    entries = []
    for shape in _iter_shapes(root):
        name = shape["attrs"].get("name")
        if not name:
            continue
        # The stencil format stores the few shapes literally named "15" or "7"
        # as numbers; render them back as integers, not "15.0".
        if isinstance(name, float) and name.is_integer():
            name = int(name)
        name = str(name)
        entries.append(
            {
                "set": set_name,
                "prefix": prefix,
                "name": name,
                "title": name,
                "style": f"shape={(prefix + '.' + name.replace(' ', '_')).lower()}",
                "w": shape["attrs"].get("w"),
                "h": shape["attrs"].get("h"),
                "tags": f"{set_name.replace('/', ' ')} {prefix.replace('.', ' ')} {name}",
                "source": "stencil",
            }
        )
    return entries


def _cache_dir():
    override = os.environ.get("JUPYTERLAB_DRAWIO_CACHE")
    if override:
        return Path(override)
    return Path.home() / ".cache" / "jupyterlab-drawio"


@lru_cache(maxsize=1)
def load_stencils():
    """Stencil entries decoded from static/stencils.min.js, or [] when absent."""
    if not STENCIL_FILE.is_file():
        return []
    stat = STENCIL_FILE.stat()
    # Bump the format when the decoded entry shape changes: size and mtime
    # cannot tell one decoder version from another.
    source_key = {"size": stat.st_size, "mtime_ns": stat.st_mtime_ns, "format": 1}
    cache_file = _cache_dir() / CACHE_NAME
    try:
        with open(cache_file, encoding="utf-8") as fh:
            cached = json.load(fh)
        if cached.get("source") == source_key:
            return cached["entries"]
    except (OSError, ValueError, AttributeError):
        pass
    source = STENCIL_FILE.read_text(encoding="utf-8", errors="replace")
    entries = []
    for key, payload in _STENCIL_BLOB.findall(source):
        entries.extend(_decode_set(key, payload))
    try:
        cache_file.parent.mkdir(parents=True, exist_ok=True)
        tmp = cache_file.with_name(f"{cache_file.name}.{os.getpid()}.tmp")
        tmp.write_text(json.dumps({"source": source_key, "entries": entries}), encoding="utf-8")
        os.replace(tmp, cache_file)
    except OSError:
        pass
    return entries


def stencil_sets():
    """List stencil sets with their shape counts, sorted by set name."""
    counts = {}
    for entry in load_stencils():
        counts[entry["set"]] = counts.get(entry["set"], 0) + 1
    return [{"set": name, "shapes": count} for name, count in sorted(counts.items())]


# --- combined search ---------------------------------------------------------

@lru_cache(maxsize=2)
def _index(include_stencils):
    entries = load_palette()
    if include_stencils:
        entries = entries + load_stencils()
    return entries, _build_tag_map(entries)


def search(query, limit=10, include_stencils=True):
    """Search palette and stencil shapes; return ranked {title, style, w, h, source}."""
    entries, tag_map = _index(include_stencils)
    return _search(entries, tag_map, query, limit)
