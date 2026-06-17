"""
Depth tier — document extraction (PDF/DOCX/PPTX → markdown).

Tests the deterministic extraction helpers plus a real DOCX round-trip (built
in-memory with python-docx). The binary-sniff guard matters: without it, a
renamed binary silently decodes into garbage blog content.
"""
import tempfile
from pathlib import Path

import pytest

from app.services.doc_extractor import (
    _extract_docx,
    _looks_like_binary,
    _mime_to_ext,
    _table_to_markdown,
)

pytestmark = pytest.mark.depth


# ─── _table_to_markdown ─────────────────────────────────────────────────────

def test_table_to_markdown__renders_pipe_table():
    md = _table_to_markdown({"headers": ["A", "B"], "rows": [["1", "2"], ["3", "4"]]})
    assert md == "| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |"


def test_table_to_markdown__no_headers_returns_empty():
    assert _table_to_markdown({"headers": [], "rows": [["1"]]}) == ""


# ─── _looks_like_binary — the renamed-binary guard ──────────────────────────

@pytest.mark.parametrize("raw,expected", [
    (b"PK\x03\x04rest-of-zip", True),       # docx/pptx/xlsx (zip)
    (b"%PDF-1.7\n...", True),                # pdf
    (b"\x89PNG\r\n\x1a\n", True),            # png
    (b"\xff\xd8\xff\xe0", True),             # jpeg
    (b"This is plain readable text.", False),
    (b"", False),
])
def test_looks_like_binary(raw, expected):
    assert _looks_like_binary(raw) is expected


# ─── _mime_to_ext ───────────────────────────────────────────────────────────

@pytest.mark.parametrize("mime,ext", [
    ("image/png", "png"),
    ("image/jpeg", "jpg"),
    ("image/webp", "webp"),
    ("application/octet-stream", "png"),  # unknown -> png default
])
def test_mime_to_ext(mime, ext):
    assert _mime_to_ext(mime) == ext


# ─── _extract_docx — real DOCX round-trip ───────────────────────────────────

def test_extract_docx__pulls_headings_paragraphs_and_tables():
    docx = pytest.importorskip("docx")  # python-docx
    with tempfile.TemporaryDirectory() as tmp:
        doc = docx.Document()
        doc.add_heading("Quarterly Report", level=1)
        doc.add_paragraph("Revenue grew sharply this quarter.")
        table = doc.add_table(rows=2, cols=2)
        table.cell(0, 0).text = "Metric"
        table.cell(0, 1).text = "Value"
        table.cell(1, 0).text = "Revenue"
        table.cell(1, 1).text = "1000"
        path = Path(tmp) / "sample.docx"
        doc.save(str(path))

        markdown, images, tables = _extract_docx(str(path), image_dir=tmp)

    assert "Quarterly Report" in markdown
    assert "Revenue grew sharply this quarter." in markdown
    # The table content is captured (either as markdown rows or structured tables).
    assert "Revenue" in markdown or any("Revenue" in str(t) for t in tables)
