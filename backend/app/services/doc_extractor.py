"""
Document extraction service – extracts text (as markdown) and images from
uploaded documents (PDF, DOCX, PPTX).

- PDF:  PyMuPDF + PyMuPDF4LLM (markdown with structure preserved)
- DOCX: python-docx (paragraphs + embedded images)
- PPTX: python-pptx (slide text + embedded images)
"""

import os
import hashlib
import tempfile

import fitz  # PyMuPDF
import pymupdf4llm
from docx import Document as DocxDocument
from pptx import Presentation
from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.config import settings
from app.models.project import Project, ProjectStatus
from app.models.asset import Asset, AssetType
from app.services import r2_storage

# Minimum image bytes to keep (skip tiny icons / decorations)
_MIN_IMAGE_BYTES = 5_000  # 5 KB

# Recognised file extensions -> handler key
_EXT_MAP = {
    ".pdf": "pdf",
    ".docx": "docx",
    ".pptx": "pptx",
}


def extract_from_documents(
    project: Project,
    files: list[UploadFile],
    db: Session,
) -> Project:
    """
    Extract text and images from uploaded documents.

    - Concatenates all extracted text into ``project.blog_content``
    - Saves extracted images locally and uploads to R2
    - Sets ``project.status = SCRAPED``
    """
    all_markdown: list[str] = []
    image_dir = os.path.join(settings.MEDIA_DIR, f"projects/{project.id}/images")
    os.makedirs(image_dir, exist_ok=True)

    image_count = 0

    for upload_file in files:
        filename = upload_file.filename or "document"
        ext = os.path.splitext(filename)[1].lower()
        handler = _EXT_MAP.get(ext, "pdf")  # default to PDF

        # Save upload to a temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext or ".pdf") as tmp:
            content = upload_file.file.read()
            tmp.write(content)
            tmp_path = tmp.name

        try:
            if handler == "pdf":
                md, imgs = _extract_pdf(tmp_path, image_dir)
            elif handler == "docx":
                md, imgs = _extract_docx(tmp_path, image_dir)
            elif handler == "pptx":
                md, imgs = _extract_pptx(tmp_path, image_dir)
            else:
                md, imgs = "", []

            if md and md.strip():
                all_markdown.append(md)

            # Create Asset records for extracted images
            for img_path, img_filename in imgs:
                r2_key = None
                r2_url = None
                if r2_storage.is_r2_configured():
                    try:
                        r2_url = r2_storage.upload_project_image(
                            project.user_id, project.id, img_path, img_filename
                        )
                        r2_key = r2_storage.image_key(
                            project.user_id, project.id, img_filename
                        )
                    except Exception as e:
                        print(f"[DOC_EXTRACTOR] R2 upload failed for {img_filename}: {e}")

                asset = Asset(
                    project_id=project.id,
                    asset_type=AssetType.IMAGE,
                    original_url=None,
                    local_path=img_path,
                    filename=img_filename,
                    r2_key=r2_key,
                    r2_url=r2_url,
                )
                db.add(asset)
                image_count += 1

        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    # ── Persist results ───────────────────────────────────────
    project.blog_content = "\n\n---\n\n".join(all_markdown) if all_markdown else ""
    project.status = ProjectStatus.SCRAPED
    db.commit()
    db.refresh(project)

    print(
        f"[DOC_EXTRACTOR] Project {project.id}: extracted "
        f"{len(all_markdown)} document(s), {image_count} images, "
        f"{len(project.blog_content)} chars of markdown"
    )

    return project


# ─── PDF extraction ──────────────────────────────────────────


def _extract_pdf(
    file_path: str, image_dir: str
) -> tuple[str, list[tuple[str, str]]]:
    """Return (markdown_text, [(local_path, filename), ...])."""
    images: list[tuple[str, str]] = []

    # Markdown text via pymupdf4llm
    md_text = pymupdf4llm.to_markdown(file_path)

    # Images via PyMuPDF
    doc = fitz.open(file_path)
    for page_num in range(len(doc)):
        page = doc[page_num]
        image_list = page.get_images(full=True)

        for img_info in image_list:
            xref = img_info[0]
            try:
                base_image = doc.extract_image(xref)
            except Exception:
                continue

            if not base_image or not base_image.get("image"):
                continue

            image_bytes = base_image["image"]
            if len(image_bytes) < _MIN_IMAGE_BYTES:
                continue

            ext = base_image.get("ext", "png")
            if ext not in ("png", "jpg", "jpeg", "webp"):
                ext = "png"

            img_hash = hashlib.md5(image_bytes).hexdigest()[:10]
            filename = f"pdf_p{page_num + 1}_{img_hash}.{ext}"
            local_path = os.path.join(image_dir, filename)

            if os.path.exists(local_path):
                continue

            with open(local_path, "wb") as f:
                f.write(image_bytes)

            images.append((local_path, filename))

    doc.close()
    return md_text or "", images


# ─── DOCX extraction ─────────────────────────────────────────


def _extract_docx(
    file_path: str, image_dir: str
) -> tuple[str, list[tuple[str, str]]]:
    """Return (markdown_text, [(local_path, filename), ...])."""
    images: list[tuple[str, str]] = []
    lines: list[str] = []

    doc = DocxDocument(file_path)

    # Extract text — convert paragraphs to simple markdown
    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            lines.append("")
            continue

        style_name = (para.style.name or "").lower()
        if "heading 1" in style_name:
            lines.append(f"# {text}")
        elif "heading 2" in style_name:
            lines.append(f"## {text}")
        elif "heading 3" in style_name:
            lines.append(f"### {text}")
        elif "heading" in style_name:
            lines.append(f"#### {text}")
        elif "list" in style_name:
            lines.append(f"- {text}")
        else:
            lines.append(text)

    md_text = "\n\n".join(lines)

    # Extract embedded images from the docx relationships
    for rel in doc.part.rels.values():
        if "image" in rel.reltype:
            try:
                image_bytes = rel.target_part.blob
                if len(image_bytes) < _MIN_IMAGE_BYTES:
                    continue

                content_type = rel.target_part.content_type or ""
                ext = _mime_to_ext(content_type)

                img_hash = hashlib.md5(image_bytes).hexdigest()[:10]
                filename = f"docx_{img_hash}.{ext}"
                local_path = os.path.join(image_dir, filename)

                if os.path.exists(local_path):
                    continue

                with open(local_path, "wb") as f:
                    f.write(image_bytes)

                images.append((local_path, filename))
            except Exception as e:
                print(f"[DOC_EXTRACTOR] DOCX image extraction error: {e}")
                continue

    return md_text, images


# ─── PPTX extraction ─────────────────────────────────────────


def _extract_pptx(
    file_path: str, image_dir: str
) -> tuple[str, list[tuple[str, str]]]:
    """Return (markdown_text, [(local_path, filename), ...])."""
    images: list[tuple[str, str]] = []
    slides_text: list[str] = []

    prs = Presentation(file_path)

    for slide_num, slide in enumerate(prs.slides, 1):
        slide_lines: list[str] = []

        for shape in slide.shapes:
            # Extract text from text frames
            if shape.has_text_frame:
                for para in shape.text_frame.paragraphs:
                    text = para.text.strip()
                    if text:
                        slide_lines.append(text)

            # Extract text from tables
            if shape.has_table:
                for row in shape.table.rows:
                    row_text = " | ".join(
                        cell.text.strip() for cell in row.cells
                    )
                    if row_text.strip(" |"):
                        slide_lines.append(row_text)

            # Extract images
            if shape.shape_type == 13:  # MSO_SHAPE_TYPE.PICTURE
                try:
                    image = shape.image
                    image_bytes = image.blob
                    if len(image_bytes) < _MIN_IMAGE_BYTES:
                        continue

                    ext = _mime_to_ext(image.content_type or "")

                    img_hash = hashlib.md5(image_bytes).hexdigest()[:10]
                    filename = f"pptx_s{slide_num}_{img_hash}.{ext}"
                    local_path = os.path.join(image_dir, filename)

                    if os.path.exists(local_path):
                        continue

                    with open(local_path, "wb") as f:
                        f.write(image_bytes)

                    images.append((local_path, filename))
                except Exception as e:
                    print(f"[DOC_EXTRACTOR] PPTX image extraction error: {e}")
                    continue

        if slide_lines:
            header = f"## Slide {slide_num}"
            slides_text.append(header + "\n\n" + "\n\n".join(slide_lines))

    md_text = "\n\n---\n\n".join(slides_text)
    return md_text, images


# ─── Helpers ──────────────────────────────────────────────────


def _mime_to_ext(content_type: str) -> str:
    """Map MIME type to file extension."""
    ct = content_type.lower()
    mapping = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/gif": "gif",
        "image/webp": "webp",
        "image/tiff": "tiff",
        "image/bmp": "bmp",
        "image/x-emf": "emf",
        "image/x-wmf": "wmf",
    }
    return mapping.get(ct, "png")
