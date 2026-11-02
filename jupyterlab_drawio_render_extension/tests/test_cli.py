"""Tests for the jupyterlab-drawio agent CLI."""

import base64
import json
import os
import shutil
import urllib.parse
import xml.etree.ElementTree as ET
import zlib
from pathlib import Path

import pytest

from jupyterlab_drawio_render_extension import cli, layout, shapes, validate

FIXTURES = Path(__file__).resolve().parent / "fixtures"


@pytest.fixture(scope="session", autouse=True)
def stencil_cache(tmp_path_factory):
    """Keep the decoded stencil cache out of the user's home directory."""
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setenv(
        "JUPYTERLAB_DRAWIO_CACHE", str(tmp_path_factory.mktemp("stencil-cache"))
    )
    yield
    monkeypatch.undo()


def test_shapes_finds_aws_lambda(capsys):
    assert cli.main(["shapes", "aws lambda", "--json"]) == 0
    results = json.loads(capsys.readouterr().out)
    palette = [result for result in results if result["source"] == "palette"]
    assert palette, results
    assert all("=" in result["style"] for result in palette)


@pytest.mark.skipif(
    not shapes.STENCIL_FILE.is_file(),
    reason="static/stencils.min.js is not built; run jlpm build:assets",
)
def test_shapes_finds_aws4_eks(capsys):
    assert cli.main(["shapes", "aws eks", "--json"]) == 0
    results = json.loads(capsys.readouterr().out)
    assert any(
        result["source"] == "stencil" and "mxgraph.aws4.eks" in result["style"]
        for result in results
    ), results


@pytest.mark.skipif(
    not shapes.STENCIL_FILE.is_file(),
    reason="static/stencils.min.js is not built; run jlpm build:assets",
)
def test_stencil_styles_are_lowercase():
    entries = shapes.load_stencils()
    assert entries
    assert all(entry["style"] == entry["style"].lower() for entry in entries)


def write_page(path, body):
    path.write_text(
        f'<mxfile><diagram id="t" name="Page-1">{body}</diagram></mxfile>',
        encoding="utf-8",
    )


def test_validate_accepts_valid_file(capsys):
    assert cli.main(["validate", str(FIXTURES / "valid.drawio"), "--json"]) == 0
    result = json.loads(capsys.readouterr().out)
    assert result["errors"] == []
    assert result["warnings"] == []
    assert result["ok"] is True


def test_validate_reports_dangling_edge(capsys):
    assert cli.main(["validate", str(FIXTURES / "broken.drawio")]) == 1
    output = capsys.readouterr().out
    assert "edge 'e1' target 'missing' does not exist" in output


def test_validate_decodes_compressed_page(tmp_path, capsys):
    model = (
        '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>'
        '<mxCell id="a" vertex="1" parent="1">'
        '<mxGeometry x="10" y="10" width="120" height="60" as="geometry"/>'
        "</mxCell></root></mxGraphModel>"
    )
    compressor = zlib.compressobj(wbits=-15)
    payload = base64.b64encode(
        compressor.compress(urllib.parse.quote(model, safe="").encode())
        + compressor.flush()
    ).decode()
    page = tmp_path / "compressed.drawio"
    write_page(page, payload)
    assert cli.main(["validate", str(page), "--json"]) == 0
    assert json.loads(capsys.readouterr().out)["errors"] == []


def test_validate_reports_undecodable_page(tmp_path, capsys):
    page = tmp_path / "corrupt.drawio"
    write_page(page, "AAAA")
    assert cli.main(["validate", str(page)]) == 1
    assert "cannot decode compressed payload" in capsys.readouterr().out


def test_validate_checks_wrapped_cells(tmp_path, capsys):
    page = tmp_path / "wrapped.drawio"
    write_page(
        page,
        '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>'
        '<UserObject label="Box" id="w1"><mxCell vertex="1" parent="1">'
        '<mxGeometry x="10" y="10" width="120" height="60" as="geometry"/>'
        "</mxCell></UserObject>"
        '<object label="Edge" id="w2"><mxCell edge="1" parent="1" '
        'source="w1" target="missing">'
        '<mxGeometry relative="1" as="geometry"/></mxCell></object>'
        "</root></mxGraphModel>",
    )
    assert cli.main(["validate", str(page)]) == 1
    output = capsys.readouterr().out
    assert "edge 'w2' target 'missing' does not exist" in output
    assert "source 'w1'" not in output


def test_validate_warns_on_off_grid_geometry(tmp_path, capsys):
    page = tmp_path / "off-grid.drawio"
    write_page(
        page,
        '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>'
        '<mxCell id="a" vertex="1" parent="1">'
        '<mxGeometry x="123" y="10" width="120" height="60" as="geometry"/>'
        "</mxCell></root></mxGraphModel>",
    )
    assert cli.main(["validate", str(page), "--json"]) == 0
    result = json.loads(capsys.readouterr().out)
    assert any("off-grid" in warning for warning in result["warnings"])
    assert cli.main(["validate", str(page), "--strict"]) == 1


@pytest.mark.skipif(shutil.which("dot") is None, reason="Graphviz dot is not on PATH")
def test_layout_writes_drawio(tmp_path, capsys):
    output = tmp_path / "diagram.drawio"
    assert cli.main(["layout", str(FIXTURES / "graph.json"), "-o", str(output)]) == 0
    xml = output.read_text(encoding="utf-8")
    assert 'id="a"' in xml
    assert 'id="b"' in xml
    assert 'source="a" target="b"' in xml
    assert "wrote" in capsys.readouterr().err


def test_layout_coerces_numeric_ids(monkeypatch):
    monkeypatch.setattr(
        layout, "layout", lambda dot_src: (1.0, {"2": (1.0, 1.0), "3": (3.0, 1.0)}, {})
    )
    xml = layout.render(
        {"nodes": [{"id": 2}, {"id": 3}], "edges": [{"source": 2, "target": 3}]}
    )
    assert 'id="2"' in xml
    assert 'id="3"' in xml
    assert 'source="2" target="3"' in xml


def test_layout_grouped_geometry_is_on_grid(monkeypatch):
    monkeypatch.setattr(
        layout, "layout", lambda dot_src: (1.0, {"a": (1.0, 1.0), "b": (3.0, 1.0)}, {})
    )
    xml = layout.render(
        {
            "nodes": [{"id": "a", "group": "g"}, {"id": "b", "group": "g"}],
            "edges": [{"source": "a", "target": "b"}],
        }
    )
    errors, warnings = validate.check_page(ET.fromstring(xml).find("diagram"))
    assert errors == []
    assert warnings == []


def test_layout_edge_id_avoids_node_id(monkeypatch):
    monkeypatch.setattr(
        layout, "layout", lambda dot_src: (1.0, {"e0": (1.0, 1.0), "b": (3.0, 1.0)}, {})
    )
    xml = layout.render(
        {"nodes": [{"id": "e0"}, {"id": "b"}], "edges": [{"source": "e0", "target": "b"}]}
    )
    assert xml.count('id="e0"') == 1
    assert 'id="e0_"' in xml
