"""PDF <-> EPUB converter behind /tools/pdf-to-epub-converter."""
import io
import zipfile

import fitz
import pytest

from app.services.ebook_convert import ConversionError, epub_to_pdf, pdf_to_epub

_LOREM = (
    "The quick brown fox jumps over the lazy dog while the committee reviews the "
    "annual report and several figures that explain how reflowable text behaves. "
) * 6


def _make_pdf(chapters: int = 3) -> bytes:
    body = ""
    for i in range(1, chapters + 1):
        body += f"<h1>Chapter {i}: Topic {i}</h1>"
        for _ in range(5):
            body += f"<p>{_LOREM}</p>"
    out = io.BytesIO()
    writer = fitz.DocumentWriter(out)
    story = fitz.Story(html=f"<html><body>{body}</body></html>")
    box = fitz.paper_rect("a4")
    more = 1
    while more:
        dev = writer.begin_page(box)
        more, _ = story.place(box + (50, 50, -50, -50))
        story.draw(dev)
        writer.end_page()
    writer.close()
    return out.getvalue()


def test_pdf_to_epub_is_valid_and_chaptered():
    epub = pdf_to_epub(_make_pdf(), "annual_report.pdf")
    with zipfile.ZipFile(io.BytesIO(epub)) as zf:
        names = zf.namelist()
        assert names[0] == "mimetype"
        assert zf.getinfo("mimetype").compress_type == zipfile.ZIP_STORED
        assert zf.read("mimetype") == b"application/epub+zip"
        assert "META-INF/container.xml" in names
        assert "OEBPS/content.opf" in names and "OEBPS/nav.xhtml" in names
        chapters = [n for n in names if n.startswith("OEBPS/chapter")]
        assert len(chapters) == 3
        assert "Chapter 2: Topic 2" in zf.read("OEBPS/nav.xhtml").decode()
        assert "<h1>Chapter 1: Topic 1</h1>" in zf.read(chapters[0]).decode()


def test_epub_round_trips_back_to_pdf_with_text():
    pdf = epub_to_pdf(pdf_to_epub(_make_pdf(), "report.pdf"))
    doc = fitz.open(stream=pdf, filetype="pdf")
    assert len(doc) >= 2
    assert "quick brown fox" in doc[1].get_text() or "quick brown fox" in doc[0].get_text()


def test_scanned_pdf_is_rejected():
    blank = fitz.open()
    blank.new_page()
    with pytest.raises(ConversionError, match="scan"):
        pdf_to_epub(blank.tobytes(), "scan.pdf")


def test_garbage_inputs_raise_conversion_error():
    with pytest.raises(ConversionError):
        pdf_to_epub(b"not a pdf")
    with pytest.raises(ConversionError):
        epub_to_pdf(b"not a zip")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("hello.txt", "hi")
    with pytest.raises(ConversionError):
        epub_to_pdf(buf.getvalue())
