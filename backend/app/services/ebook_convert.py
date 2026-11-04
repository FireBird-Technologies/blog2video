"""
PDF <-> EPUB conversion for the free /tools/pdf-to-epub-converter page.

Both directions are pure-Python on top of dependencies the backend already ships
(PyMuPDF, beautifulsoup4, lxml) — no Calibre, no LibreOffice, no new packages.

PDF -> EPUB is a *reflowable* rebuild, not a page photograph. We read text spans
with their font sizes, infer headings from size relative to the body text, join
wrapped lines back into paragraphs, drop running headers/footers and page
numbers, keep embedded images, and split chapters at top-level headings. That is
the only thing that makes the result readable on an e-reader, and it is also
where the limits are: scanned PDFs have no text layer, and heavily columned or
table-driven layouts reflow imperfectly.

EPUB -> PDF lays the spine out with PyMuPDF's Story (HTML + CSS -> paginated
PDF), so text stays selectable and images are embedded.
"""
from __future__ import annotations

import io
import posixpath
import re
import uuid
import zipfile
from collections import Counter
from datetime import datetime, timezone
from html import escape
from urllib.parse import unquote

import fitz  # PyMuPDF
from bs4 import BeautifulSoup

# Below this much extracted text we call the PDF a scan rather than emit a
# near-empty book.
_MIN_TEXT_CHARS = 200
# Skip decorative images (rules, bullets, logos repeated on every page).
_MIN_IMAGE_BYTES = 4_000
# With no headings to split on, start a new chapter every N pages.
_FALLBACK_PAGES_PER_CHAPTER = 12
_MAX_PAGES = 1500

_IMAGE_MEDIA_TYPES = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
}

_EPUB_CSS = """\
body { font-family: serif; line-height: 1.5; margin: 0 5%; }
h1, h2, h3 { font-family: sans-serif; line-height: 1.25; page-break-after: avoid; }
h1 { font-size: 1.6em; margin: 1.2em 0 0.6em; }
h2 { font-size: 1.3em; margin: 1.1em 0 0.5em; }
h3 { font-size: 1.1em; margin: 1em 0 0.4em; }
p { margin: 0 0 0.9em; text-align: left; }
img { max-width: 100%; height: auto; display: block; margin: 1em auto; }
"""


class ConversionError(ValueError):
    """A user-facing reason the file could not be converted (maps to HTTP 422)."""


# ─── PDF -> EPUB ─────────────────────────────────────────────────────────────


def _line_text(line: dict) -> str:
    return "".join(span["text"] for span in line.get("spans", []))


def _line_size(line: dict) -> float:
    spans = [s for s in line.get("spans", []) if s["text"].strip()]
    if not spans:
        return 0.0
    # Dominant span by character count, so a small superscript doesn't win.
    return max(spans, key=lambda s: len(s["text"]))["size"]


def _collect_blocks(doc: "fitz.Document", images: dict[str, tuple[bytes, str]]):
    """Walk every page into a flat list of ('text'|'image', ...) items."""
    pages: list[list[dict]] = []
    size_chars: Counter = Counter()
    margin_text: Counter = Counter()

    page_count = min(len(doc), _MAX_PAGES)
    for page_no in range(page_count):
        page = doc[page_no]
        height = page.rect.height
        items: list[dict] = []
        for block in page.get_text("dict").get("blocks", []):
            if block.get("type") == 1:
                data, ext = block.get("image"), (block.get("ext") or "").lower()
                if (
                    data
                    and len(data) >= _MIN_IMAGE_BYTES
                    and ext in _IMAGE_MEDIA_TYPES
                ):
                    name = f"img{len(images) + 1:04d}.{'jpg' if ext == 'jpeg' else ext}"
                    images[name] = (data, _IMAGE_MEDIA_TYPES[ext])
                    items.append({"kind": "image", "name": name, "y": block["bbox"][1]})
                continue
            if block.get("type") != 0:
                continue
            lines = [ln for ln in block.get("lines", []) if _line_text(ln).strip()]
            if not lines:
                continue
            text = " ".join(_line_text(ln).strip() for ln in lines)
            size = round(max(_line_size(ln) for ln in lines), 1)
            y0, y1 = block["bbox"][1], block["bbox"][3]
            in_margin = y1 < height * 0.07 or y0 > height * 0.93
            if in_margin:
                # Normalise digits so "Page 3" and "Page 4" count as one footer.
                margin_text[re.sub(r"\d+", "#", text.strip().lower())] += 1
            else:
                size_chars[size] += len(text)
            items.append(
                {
                    "kind": "text",
                    "text": text,
                    "lines": [_line_text(ln).strip() for ln in lines],
                    "size": size,
                    "bold": all(
                        bool(s["flags"] & 16) or "bold" in s["font"].lower()
                        for ln in lines
                        for s in ln["spans"]
                        if s["text"].strip()
                    ),
                    "margin": in_margin,
                    "y": y0,
                }
            )
        pages.append(items)

    body_size = size_chars.most_common(1)[0][0] if size_chars else 11.0
    # Margin text repeating on a third of pages is a running header/footer.
    repeat_floor = max(2, page_count // 3)
    running = {k for k, v in margin_text.items() if v >= repeat_floor}
    return pages, body_size, running


def _join_lines(lines: list[str]) -> str:
    """Re-flow wrapped lines into one paragraph, healing hyphenated breaks."""
    out = ""
    for ln in lines:
        if not out:
            out = ln
        elif out.endswith("-") and ln[:1].islower():
            out = out[:-1] + ln
        else:
            out += " " + ln
    return re.sub(r"\s+", " ", out).strip()


def _heading_level(item: dict, body: float) -> int:
    text = item["text"]
    if len(text) > 160 or text.endswith((".", ",", ";")) and len(text) > 90:
        return 0
    ratio = item["size"] / body if body else 1.0
    if ratio >= 1.45:
        return 1
    if ratio >= 1.2:
        return 2
    if item["bold"] and len(text) <= 80 and ratio >= 0.98:
        return 3
    return 0


def _xhtml(title: str, body_html: str) -> str:
    return (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<!DOCTYPE html>\n'
        '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">\n'
        f"<head><meta charset=\"utf-8\"/><title>{escape(title)}</title>"
        '<link rel="stylesheet" type="text/css" href="style.css"/></head>\n'
        f"<body>\n{body_html}\n</body>\n</html>\n"
    )


def pdf_to_epub(data: bytes, filename: str = "document.pdf") -> bytes:
    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception as exc:  # corrupt / not a PDF
        raise ConversionError("That file could not be read as a PDF.") from exc
    if doc.needs_pass:
        raise ConversionError("This PDF is password-protected. Remove the password and try again.")

    images: dict[str, tuple[bytes, str]] = {}
    pages, body_size, running = _collect_blocks(doc, images)

    meta = doc.metadata or {}
    stem = re.sub(r"\.pdf$", "", filename, flags=re.I).replace("_", " ").replace("-", " ").strip()
    title = (meta.get("title") or "").strip() or stem or "Untitled"
    author = (meta.get("author") or "").strip()

    # chapters: list of [title, [html fragments]]
    chapters: list[list] = []
    total_chars = 0
    heading_counts = Counter()
    for items in pages:
        for it in items:
            if it["kind"] == "text" and not it["margin"]:
                lvl = _heading_level(it, body_size)
                if lvl:
                    heading_counts[lvl] += 1
    # Split on H1 when the document has a usable number of them, else H2.
    split_level = 1 if heading_counts[1] >= 2 else (2 if heading_counts[2] >= 2 else 0)

    def new_chapter(chapter_title: str):
        chapters.append([chapter_title, []])

    new_chapter(title)
    pages_in_chapter = 0
    for items in pages:
        pages_in_chapter += 1
        if split_level == 0 and pages_in_chapter > _FALLBACK_PAGES_PER_CHAPTER:
            new_chapter(f"Part {len(chapters) + 1}")
            pages_in_chapter = 1
        for it in sorted(items, key=lambda i: i["y"]):
            if it["kind"] == "image":
                chapters[-1][1].append(f'<img src="images/{it["name"]}" alt=""/>')
                continue
            text = it["text"].strip()
            if it["margin"]:
                key = re.sub(r"\d+", "#", text.lower())
                if key in running or re.fullmatch(r"[\W\d_]*\d+[\W\d_]*", text):
                    continue
            if re.fullmatch(r"\d{1,4}", text):  # stray page number mid-page
                continue
            total_chars += len(text)
            lvl = _heading_level(it, body_size)
            para = _join_lines(it["lines"])
            if lvl:
                if lvl == split_level and (chapters[-1][1] or len(chapters) > 1):
                    new_chapter(para)
                elif lvl == split_level:
                    chapters[-1][0] = para  # first heading names the opening chapter
                chapters[-1][1].append(f"<h{lvl}>{escape(para)}</h{lvl}>")
            else:
                chapters[-1][1].append(f"<p>{escape(para)}</p>")

    if total_chars < _MIN_TEXT_CHARS:
        raise ConversionError(
            "This PDF has no readable text layer — it looks like a scan. "
            "Run it through OCR first, then convert."
        )

    chapters = [c for c in chapters if c[1]] or [[title, ["<p></p>"]]]
    return _write_epub(title, author, chapters, images, lang=(meta.get("language") or "en"))


def _write_epub(
    title: str,
    author: str,
    chapters: list[list],
    images: dict[str, tuple[bytes, str]],
    lang: str = "en",
) -> bytes:
    book_id = f"urn:uuid:{uuid.uuid4()}"
    modified = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    lang = re.sub(r"[^A-Za-z-]", "", lang)[:10] or "en"

    manifest = [
        '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
        '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
        '<item id="css" href="style.css" media-type="text/css"/>',
    ]
    spine, nav_items, ncx_points = [], [], []
    files: dict[str, bytes | str] = {}

    for i, (ch_title, parts) in enumerate(chapters, start=1):
        href = f"chapter{i:03d}.xhtml"
        cid = f"ch{i:03d}"
        ch_title = ch_title.strip()[:200] or f"Chapter {i}"
        files[f"OEBPS/{href}"] = _xhtml(ch_title, "\n".join(parts))
        manifest.append(f'<item id="{cid}" href="{href}" media-type="application/xhtml+xml"/>')
        spine.append(f'<itemref idref="{cid}"/>')
        nav_items.append(f'<li><a href="{href}">{escape(ch_title)}</a></li>')
        ncx_points.append(
            f'<navPoint id="{cid}" playOrder="{i}"><navLabel><text>{escape(ch_title)}</text></navLabel>'
            f'<content src="{href}"/></navPoint>'
        )

    for name, (blob, media_type) in images.items():
        files[f"OEBPS/images/{name}"] = blob
        manifest.append(f'<item id="{name.replace(".", "-")}" href="images/{name}" media-type="{media_type}"/>')

    author_xml = f"<dc:creator>{escape(author)}</dc:creator>" if author else ""
    files["OEBPS/content.opf"] = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">\n'
        '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">'
        f'<dc:identifier id="bookid">{book_id}</dc:identifier>'
        f"<dc:title>{escape(title)}</dc:title>{author_xml}"
        f"<dc:language>{lang}</dc:language>"
        f'<meta property="dcterms:modified">{modified}</meta></metadata>\n'
        f"<manifest>{''.join(manifest)}</manifest>\n"
        f'<spine toc="ncx">{"".join(spine)}</spine>\n</package>\n'
    )
    files["OEBPS/nav.xhtml"] = (
        '<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n'
        '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">'
        f'<head><meta charset="utf-8"/><title>{escape(title)}</title></head><body>'
        f'<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>{"".join(nav_items)}</ol></nav></body></html>\n'
    )
    files["OEBPS/toc.ncx"] = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">'
        f'<head><meta name="dtb:uid" content="{book_id}"/></head>'
        f"<docTitle><text>{escape(title)}</text></docTitle>"
        f'<navMap>{"".join(ncx_points)}</navMap></ncx>\n'
    )
    files["OEBPS/style.css"] = _EPUB_CSS
    files["META-INF/container.xml"] = (
        '<?xml version="1.0"?>\n'
        '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">'
        '<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>'
        "</rootfiles></container>\n"
    )

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        # The EPUB spec requires `mimetype` first and uncompressed.
        zf.writestr(zipfile.ZipInfo("mimetype"), "application/epub+zip", compress_type=zipfile.ZIP_STORED)
        for path, content in files.items():
            zf.writestr(path, content, compress_type=zipfile.ZIP_DEFLATED)
    return buf.getvalue()


# ─── EPUB -> PDF ─────────────────────────────────────────────────────────────

_PDF_CSS = """
body { font-family: serif; font-size: 11pt; line-height: 1.4; }
h1 { font-size: 20pt; margin: 18pt 0 8pt; }
h2 { font-size: 16pt; margin: 14pt 0 6pt; }
h3, h4 { font-size: 13pt; margin: 12pt 0 5pt; }
p { margin: 0 0 8pt; }
img { max-width: 100%; }
blockquote { margin: 8pt 0 8pt 18pt; font-style: italic; }
pre, code { font-family: monospace; font-size: 9.5pt; }
li { margin-bottom: 3pt; }
"""
_DROP_TAGS = ("script", "style", "link", "meta", "svg", "head", "title", "nav", "iframe", "object", "video", "audio")
_MAX_EPUB_UNCOMPRESSED = 200 * 1024 * 1024  # zip-bomb guard


def _read_zip_text(zf: zipfile.ZipFile, path: str) -> str:
    return zf.read(path).decode("utf-8", errors="replace")


def epub_to_pdf(data: bytes) -> bytes:
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as exc:
        raise ConversionError("That file could not be read as an EPUB.") from exc

    with zf:
        if sum(i.file_size for i in zf.infolist()) > _MAX_EPUB_UNCOMPRESSED:
            raise ConversionError("This EPUB expands to too much data to convert.")
        try:
            container = BeautifulSoup(_read_zip_text(zf, "META-INF/container.xml"), "xml")
            opf_path = container.find("rootfile")["full-path"]
            opf = BeautifulSoup(_read_zip_text(zf, opf_path), "xml")
        except (KeyError, TypeError) as exc:
            raise ConversionError("This EPUB is missing its package file and cannot be read.") from exc

        opf_dir = posixpath.dirname(opf_path)
        manifest = {
            it["id"]: it for it in opf.find_all("item") if it.get("id") and it.get("href")
        }
        title_tag = opf.find("dc:title") or opf.find("title")
        title = title_tag.get_text(strip=True) if title_tag else "Untitled"
        author_tag = opf.find("dc:creator") or opf.find("creator")
        author = author_tag.get_text(strip=True) if author_tag else ""

        spine_ids = [r["idref"] for r in opf.find_all("itemref") if r.get("idref")]
        archive = fitz.Archive()
        body_parts: list[str] = [
            f"<h1>{escape(title)}</h1>" + (f"<p><i>{escape(author)}</i></p>" if author else "")
        ]
        text_chars = 0
        n_images = 0

        for idref in spine_ids:
            item = manifest.get(idref)
            if not item or "html" not in (item.get("media-type") or ""):
                continue
            doc_path = posixpath.normpath(posixpath.join(opf_dir, unquote(item["href"])))
            try:
                soup = BeautifulSoup(_read_zip_text(zf, doc_path), "lxml")
            except KeyError:
                continue
            for tag in soup(list(_DROP_TAGS)):
                tag.decompose()
            body = soup.body
            if body is None:
                continue
            doc_dir = posixpath.dirname(doc_path)
            for img in body.find_all("img"):
                src = unquote((img.get("src") or "").split("#")[0])
                img_path = posixpath.normpath(posixpath.join(doc_dir, src)) if src else ""
                ext = posixpath.splitext(img_path)[1].lower().lstrip(".")
                if ext not in _IMAGE_MEDIA_TYPES or img_path not in zf.namelist():
                    img.decompose()
                    continue
                n_images += 1
                key = f"i{n_images}.{ext}"
                archive.add(zf.read(img_path), key)
                img["src"] = key
                for attr in ("width", "height", "style", "srcset"):
                    img.attrs.pop(attr, None)
            for a in body.find_all("a"):
                a.attrs.pop("href", None)  # internal links point at files that no longer exist
            text_chars += len(body.get_text(strip=True))
            body_parts.append(body.decode_contents())

    if text_chars < 50 and n_images == 0:
        raise ConversionError(
            "No readable content was found. The EPUB may be DRM-protected — "
            "DRM-locked books cannot be converted."
        )

    html = "<html><body>" + "\n".join(body_parts) + "</body></html>"
    out = io.BytesIO()
    writer = fitz.DocumentWriter(out)
    story = fitz.Story(html=html, user_css=_PDF_CSS, archive=archive)
    mediabox = fitz.paper_rect("a4")
    where = mediabox + (54, 54, -54, -54)
    more, pages = 1, 0
    while more:
        device = writer.begin_page(mediabox)
        more, _ = story.place(where)
        story.draw(device)
        writer.end_page()
        pages += 1
        if pages > 3000:
            break
    writer.close()
    result = out.getvalue()
    if not result:
        raise ConversionError("The PDF could not be generated from this EPUB.")
    return result
