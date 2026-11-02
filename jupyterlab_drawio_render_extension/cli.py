"""Command line interface for the JupyterLab Draw.io extension.

Agent-facing CLI: search the official draw.io palette and bundled stencils,
validate .drawio files, and lay out a graph JSON with Graphviz. Every command
accepts --json and reports failures through stable exit codes.
"""

from __future__ import annotations

import argparse
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

from . import layout, shapes, validate

EXIT_OK = 0
EXIT_FAIL = 1
EXIT_USAGE = 2

EXIT_CODES = """\
exit codes:
  0  success (validate warnings still exit 0)
  1  command failure: no match, validation errors, dot missing or failed,
     unreadable input; validate with --strict also exits 1 on warnings only
  2  usage error
"""

TOP_EPILOG = EXIT_CODES + """
environment:
  JUPYTERLAB_DRAWIO_CACHE  cache directory for the parsed stencil index
                           (default: ~/.cache/jupyterlab-drawio)
"""

SHAPES_EPILOG = """\
examples:
  jupyterlab-drawio shapes "aws lambda"
  jupyterlab-drawio shapes "kubernetes pod" --limit 20 --json
  jupyterlab-drawio shapes "uml actor" --no-stencils
"""

STENCILS_EPILOG = """\
examples:
  jupyterlab-drawio stencils
  jupyterlab-drawio stencils --json
"""

VALIDATE_EPILOG = """\
examples:
  jupyterlab-drawio validate diagram.drawio
  jupyterlab-drawio validate diagram.drawio --strict
  jupyterlab-drawio validate diagram.drawio --json
"""

LAYOUT_EPILOG = """\
examples:
  jupyterlab-drawio layout graph.json -o diagram.drawio
  jupyterlab-drawio layout graph.json --direction LR -o diagram.drawio
  jupyterlab-drawio layout graph.json -o diagram.drawio --json
"""


def cmd_shapes(args):
    if not shapes.PALETTE_FILE.is_file():
        print(
            f"error: palette index not found at {shapes.PALETTE_FILE}; "
            f"reinstall jupyterlab-drawio-render-extension",
            file=sys.stderr,
        )
        return EXIT_FAIL
    try:
        results = shapes.search(
            args.query, limit=args.limit, include_stencils=not args.no_stencils
        )
    except (OSError, ValueError) as exc:
        print(
            f"error: {exc}; reinstall jupyterlab-drawio-render-extension",
            file=sys.stderr,
        )
        return EXIT_FAIL
    if not results:
        print(
            f"no shapes matched {args.query!r}; try a broader query, e.g. "
            f'jupyterlab-drawio shapes "aws lambda"',
            file=sys.stderr,
        )
        return EXIT_FAIL
    if args.json:
        print(json.dumps(results, indent=2, ensure_ascii=False))
        return EXIT_OK
    for result in results:
        size = "?" if result["w"] is None or result["h"] is None else f"{result['w']}x{result['h']}"
        print(f"{result['title']}  [{result['source']}]  ({size})")
        print(f"  {result['style']}")
    return EXIT_OK


def cmd_stencils(args):
    if not shapes.STENCIL_FILE.is_file():
        print(
            f"error: stencil asset not found at {shapes.STENCIL_FILE}; run: jlpm build:assets",
            file=sys.stderr,
        )
        return EXIT_FAIL
    try:
        sets = shapes.stencil_sets()
    except (OSError, ValueError) as exc:
        print(f"error: {exc}; run: jlpm build:assets", file=sys.stderr)
        return EXIT_FAIL
    if args.json:
        print(json.dumps(sets, indent=2, ensure_ascii=False))
        return EXIT_OK
    width = max((len(item["set"]) for item in sets), default=3)
    print(f"{'set':<{width}}  shapes")
    for item in sets:
        print(f"{item['set']:<{width}}  {item['shapes']}")
    return EXIT_OK


def cmd_validate(args):
    try:
        result = validate.validate_file(args.file, args.strict)
    except (ET.ParseError, OSError) as exc:
        print(
            f"error: cannot parse {args.file}: {exc}; check the path and that "
            f"the file is .drawio XML",
            file=sys.stderr,
        )
        return EXIT_FAIL
    if args.json:
        print(json.dumps({"file": args.file, **result}, indent=2, ensure_ascii=False))
    else:
        for warning in result["warnings"]:
            print(f"warning: {warning}")
        for error in result["errors"]:
            print(f"error: {error}")
        print(
            f'{len(result["errors"])} error(s), '
            f'{len(result["warnings"])} warning(s)'
        )
    return EXIT_OK if result["ok"] else EXIT_FAIL


def cmd_layout(args):
    if args.json and not args.output:
        print(
            "error: --json needs -o OUT; without -o the .drawio XML is written to stdout",
            file=sys.stderr,
        )
        return EXIT_USAGE
    try:
        with open(args.graph, encoding="utf-8") as fh:
            graph = json.load(fh)
    except (OSError, ValueError) as exc:
        print(
            f"error: cannot read graph {args.graph}: {exc}; pass a JSON object "
            f"with nodes and edges",
            file=sys.stderr,
        )
        return EXIT_FAIL
    if not isinstance(graph, dict) or not isinstance(graph.get("nodes"), list):
        print(
            f"error: graph {args.graph} needs a top-level 'nodes' array; "
            f"see jupyterlab-drawio layout --help for the schema",
            file=sys.stderr,
        )
        return EXIT_FAIL
    if args.direction:
        graph["direction"] = args.direction
    try:
        xml = layout.render(graph, mono=args.mono)
    except RuntimeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return EXIT_FAIL
    except (KeyError, TypeError, AttributeError) as exc:
        print(
            f"error: invalid graph {args.graph}: {exc}; every node needs a string "
            f"'id' and every edge needs 'source' and 'target'",
            file=sys.stderr,
        )
        return EXIT_FAIL
    node_count = len(graph["nodes"])
    edge_count = len(graph.get("edges", []))
    if args.output:
        try:
            Path(args.output).write_text(xml, encoding="utf-8")
        except OSError as exc:
            print(
                f"error: cannot write {args.output}: {exc}; choose a writable path",
                file=sys.stderr,
            )
            return EXIT_FAIL
        if args.json:
            print(json.dumps(
                {"output": args.output, "nodes": node_count, "edges": edge_count}
            ))
        else:
            print(
                f"wrote {args.output} ({node_count} nodes, {edge_count} edges)",
                file=sys.stderr,
            )
    else:
        sys.stdout.write(xml)
    return EXIT_OK


def build_parser():
    parser = argparse.ArgumentParser(
        prog="jupyterlab-drawio",
        description=(
            "Search official draw.io shapes and stencils, validate .drawio files, "
            "and lay out a graph JSON into drawio XML. Designed for AI agents: "
            "every command accepts --json and reports failures through stable "
            "exit codes."
        ),
        epilog=TOP_EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    subparsers = parser.add_subparsers(dest="command", required=True, metavar="COMMAND")

    shapes_parser = subparsers.add_parser(
        "shapes",
        help="search palette and stencil shapes",
        description=(
            "Search the official draw.io palette (10,446 shapes) and, unless "
            "--no-stencils is given, the stencil sets decoded from "
            "static/stencils.min.js. Results are ranked by exact then Soundex tag "
            "matches. Each result carries title, style, w, h and source (palette "
            "or stencil); use the style verbatim in a draw.io cell. Exit 1 when "
            "nothing matches."
        ),
        epilog=SHAPES_EPILOG + "\n" + EXIT_CODES,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    shapes_parser.add_argument("query", help='keywords, e.g. "aws lambda" or "uml actor"')
    shapes_parser.add_argument(
        "--limit", type=int, default=10, metavar="N", help="maximum results (default: 10)"
    )
    shapes_parser.add_argument(
        "--json", action="store_true",
        help="print a JSON array of {title, style, w, h, source}",
    )
    shapes_parser.add_argument(
        "--no-stencils", action="store_true", help="search the palette index only"
    )
    shapes_parser.set_defaults(func=cmd_shapes)

    stencils_parser = subparsers.add_parser(
        "stencils",
        help="list stencil sets and shape counts",
        description=(
            "List the stencil sets combined into static/stencils.min.js with the "
            "number of shapes each contributes. Exit 1 with a build hint when the "
            "asset is missing."
        ),
        epilog=STENCILS_EPILOG + "\n" + EXIT_CODES,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    stencils_parser.add_argument(
        "--json", action="store_true",
        help="print a JSON array of {set, shapes}",
    )
    stencils_parser.set_defaults(func=cmd_stencils)

    validate_parser = subparsers.add_parser(
        "validate",
        help="lint a .drawio file for structural errors",
        description=(
            "Check one .drawio file for dangling edge endpoints, duplicate or "
            "reserved ids, broken parent references, and (as warnings) "
            "non-positive sizes, negative positions, off-grid geometry and "
            "overlapping siblings. Exit 0 when clean, 1 when any error is found "
            "(or any warning with --strict)."
        ),
        epilog=VALIDATE_EPILOG + "\n" + EXIT_CODES,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    validate_parser.add_argument("file", help="path to the .drawio file")
    validate_parser.add_argument(
        "--strict", action="store_true", help="treat warnings as failure too"
    )
    validate_parser.add_argument(
        "--json", action="store_true",
        help="print {file, errors, warnings, ok} instead of text",
    )
    validate_parser.set_defaults(func=cmd_validate)

    layout_parser = subparsers.add_parser(
        "layout",
        help="lay out a graph JSON into drawio XML",
        description=(
            "Lay out a graph JSON with Graphviz dot and emit .drawio XML. The "
            "graph is an object with 'nodes' ([{id, label?, style?, width?, "
            "height?, group?, groupLabel?}]) and optional 'edges' ([{source, "
            "target, label?}]) plus an optional 'direction' of TB or LR. "
            "Node ids must be unique and not 0 or 1. Requires Graphviz dot on "
            "PATH. --json needs -o and prints a summary object."
        ),
        epilog=LAYOUT_EPILOG + "\n" + EXIT_CODES,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    layout_parser.add_argument("graph", help="graph JSON file")
    layout_parser.add_argument(
        "-o", "--output", metavar="OUT",
        help="output .drawio path (default: stdout)",
    )
    layout_parser.add_argument(
        "--direction", choices=["TB", "LR"],
        help="rank direction, overriding the graph's own direction",
    )
    layout_parser.add_argument(
        "--mono", action="store_true",
        help="do not colour groups from the palette",
    )
    layout_parser.add_argument(
        "--json", action="store_true",
        help="with -o, print {output, nodes, edges} instead of a status line",
    )
    layout_parser.set_defaults(func=cmd_layout)

    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
