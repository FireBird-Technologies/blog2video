"""
Login-gated endpoints for the free public SEO tools.

Each endpoint requires a valid JWT (Depends(get_current_user)) so anonymous
callers get a 401 — this is the server-side backstop behind the frontend login
gate. The generators are stateless single-shot DSPy calls (no Project row).
"""
import io
import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.dspy_modules.free_tool_gen import (
    ThumbnailTextGenerator,
    VideoScriptGenerator,
    YouTubeDescriptionGenerator,
)
from app.dspy_modules.pdf_tool_gen import (
    DocumentSummarizer,
    DocumentToStoryboard,
    DocumentToVideoScript,
)
from app.models.user import LIFETIME_TOOLS, TOOL_QUOTAS, PlanTier, User
from app.services.doc_extractor import extract_text_from_upload

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/free-tools", tags=["free-tools"])

_GENERIC_FAIL = "Generation failed. Please try again in a moment."


def _check_quota(user: User, tool: str, db: Session) -> tuple[int, int]:
    """Gate a /tools generation, returning ``(used, limit)`` when allowed.

    Limits come from ``TOOL_QUOTAS`` on the User model: FREE allowances are
    lifetime, paid allowances refresh each billing period. Raises 403 with an
    upgrade-oriented message once the allowance is spent.
    """
    # Annual/lifetime allowances roll in-app rather than via a Stripe invoice, so
    # refresh before reading — otherwise a user whose window just rolled would be
    # blocked against last period's spent counter.
    user.roll_video_period_if_due(db)
    used = user.tool_used(tool)
    limit = user.tool_limit(tool)
    if used >= limit:
        if tool in LIFETIME_TOOLS:
            # Neither upgrading nor waiting for the next period lifts this cap,
            # so the copy must not imply either. Saying so plainly beats an
            # upsell the user would rightly feel misled by.
            detail = (
                f"You've already used your {limit} free narration. This tool is "
                "limited to one synthesis per account."
            )
        elif user.plan == PlanTier.FREE:
            detail = (
                f"You've used all {limit} free generations for this tool. "
                "Upgrade to Standard or Pro for a much higher monthly allowance."
            )
        else:
            detail = (
                f"You've used all {limit} generations for this tool this billing "
                "period. Your allowance refreshes at your next renewal."
            )
        raise HTTPException(status_code=403, detail=detail)
    return used, limit


def _charge(user: User, tool: str, db: Session) -> int:
    """Consume one generation after a SUCCESSFUL result; returns the new count."""
    attr = TOOL_QUOTAS[tool][0]
    setattr(user, attr, user.tool_used(tool) + 1)
    db.commit()
    return user.tool_used(tool)


# Appended to the user's book description so the image model renders a front
# book cover rather than a generic illustration.
_BOOK_COVER_PROMPT = (
    "Design a professional, eye-catching FRONT BOOK COVER based on the book "
    "description below. Portrait 2:3 book-cover proportions. Create a striking "
    "central illustration or photographic composition that captures the book's "
    "theme, genre, and mood, with strong visual hierarchy and clear space near "
    "the top or center for a title and author name. Use genre-appropriate "
    "typography and a cohesive color palette, high production value, suitable "
    "for both print and small e-book thumbnails. Do NOT render placeholder or "
    "lorem ipsum text; if you include a title, keep it short, real, and legible."
    "\n\nBOOK DESCRIPTION:\n"
)


# ─── Request / response models ───────────────────────────────────────────────


class VideoScriptRequest(BaseModel):
    topic: str = Field(..., min_length=3, max_length=4000)
    tone: str = "explainer"
    length: str = "medium"


class VideoScriptResponse(BaseModel):
    video_title: str
    script_markdown: str
    used: int
    limit: int


class ThumbnailTextRequest(BaseModel):
    topic: str = Field(..., min_length=3, max_length=500)


class ThumbnailTextResponse(BaseModel):
    options: list[str]
    used: int
    limit: int


class YouTubeDescriptionRequest(BaseModel):
    topic: str = Field(..., min_length=3, max_length=8000)


class YouTubeDescriptionResponse(BaseModel):
    description: str
    tags: list[str]
    used: int
    limit: int


class BookCoverRequest(BaseModel):
    description: str = Field(..., min_length=20, max_length=2500)


class BookCoverResponse(BaseModel):
    image_base64: str
    covers_used: int
    # Kept nullable for older clients that treated None as "unlimited"; every plan
    # now has a finite allowance so this is always a number.
    covers_limit: int | None


class ToolQuota(BaseModel):
    used: int
    limit: int


class ToolQuotasResponse(BaseModel):
    """Current allowance for every /tools generator, keyed by TOOL_QUOTAS key."""

    quotas: dict[str, ToolQuota]


# ─── Endpoints ───────────────────────────────────────────────────────────────


@router.get("/quota", response_model=ToolQuotasResponse)
def get_tool_quotas(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Current usage/allowance for every tool, so widgets can show the remaining
    count (and disable themselves when exhausted) on load rather than only after
    a generation."""
    # Annual/lifetime allowances roll in-app, not via a Stripe invoice — refresh
    # first so a user whose window just rolled isn't shown a stale (spent) count.
    user.roll_video_period_if_due(db)
    return {
        "quotas": {
            tool: {"used": user.tool_used(tool), "limit": user.tool_limit(tool)}
            for tool in TOOL_QUOTAS
        }
    }


@router.post("/video-script", response_model=VideoScriptResponse)
async def generate_video_script(
    payload: VideoScriptRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _used, limit = _check_quota(user, "video_script", db)
    try:
        result = await VideoScriptGenerator().generate(
            topic=payload.topic, tone=payload.tone, length=payload.length
        )
    except Exception:
        logger.exception("free-tools video-script generation failed")
        raise HTTPException(status_code=502, detail=_GENERIC_FAIL)
    if not result.get("script_markdown"):
        raise HTTPException(status_code=502, detail=_GENERIC_FAIL)
    # Charge only on success — a failed generation must not consume quota.
    return {**result, "used": _charge(user, "video_script", db), "limit": limit}


@router.post("/thumbnail-text", response_model=ThumbnailTextResponse)
async def generate_thumbnail_text(
    payload: ThumbnailTextRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _used, limit = _check_quota(user, "thumbnail_text", db)
    try:
        result = await ThumbnailTextGenerator().generate(topic=payload.topic)
    except Exception:
        logger.exception("free-tools thumbnail-text generation failed")
        raise HTTPException(status_code=502, detail=_GENERIC_FAIL)
    if not result.get("options"):
        raise HTTPException(status_code=502, detail=_GENERIC_FAIL)
    # Charge only on success — a failed generation must not consume quota.
    return {**result, "used": _charge(user, "thumbnail_text", db), "limit": limit}


@router.post("/youtube-description", response_model=YouTubeDescriptionResponse)
async def generate_youtube_description(
    payload: YouTubeDescriptionRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _used, limit = _check_quota(user, "youtube_description", db)
    try:
        result = await YouTubeDescriptionGenerator().generate(topic=payload.topic)
    except Exception:
        logger.exception("free-tools youtube-description generation failed")
        raise HTTPException(status_code=502, detail=_GENERIC_FAIL)
    if not result.get("description"):
        raise HTTPException(status_code=502, detail=_GENERIC_FAIL)
    # Charge only on success — a failed generation must not consume quota.
    return {**result, "used": _charge(user, "youtube_description", db), "limit": limit}


@router.post("/book-cover", response_model=BookCoverResponse)
async def generate_book_cover(
    payload: BookCoverRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Reuses the same image provider + aspect-size helpers as the core
    # scene-image generator (app/routers/projects.py), fixed to portrait
    # 2:3 book-cover proportions.
    from app.services.image_gen import get_image_provider
    from app.services.image_dimensions import (
        get_gemini_image_config,
        get_glm_size,
        get_openai_size,
    )

    used, limit = _check_quota(user, "book_cover", db)

    try:
        provider = get_image_provider()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    if not provider:
        raise HTTPException(
            status_code=503,
            detail=(
                "Image generation is not configured. Set IMAGE_PROVIDER and the "
                "matching API key (OPENAI_API_KEY, GEMINI_API_KEY, or ZAI_API_KEY)."
            ),
        )

    aspect = "2:3"  # classic portrait book-cover proportions
    provider_name = (settings.IMAGE_PROVIDER or "openai").strip().lower()
    if provider_name == "openai":
        gen_kwargs = {"size": get_openai_size(aspect), "quality": "high", "n": 1}
    elif provider_name == "glm":
        gen_kwargs = {"size": get_glm_size(aspect)}
    else:
        gen_kwargs = {"generation_config": get_gemini_image_config(aspect)}

    prompt = _BOOK_COVER_PROMPT + payload.description.strip()
    try:
        image_base64 = await run_in_threadpool(provider.generate, prompt, **gen_kwargs)
    except Exception:
        logger.exception("free-tools book-cover generation failed")
        raise HTTPException(status_code=502, detail=_GENERIC_FAIL)
    if not image_base64:
        raise HTTPException(status_code=502, detail=_GENERIC_FAIL)

    # Charge only on success — a failed generation must not consume quota.
    used = _charge(user, "book_cover", db)

    return {
        "image_base64": image_base64,
        "covers_used": used,
        "covers_limit": limit,
    }


# ─── pdf2vid.com document tools ──────────────────────────────────────────────
# Same auth + quota contract as the generators above. The difference is the
# input: these operate on a document the user uploaded, so every one of them
# starts from extracted text rather than a topic string.
#
# Extraction is a separate endpoint from generation on purpose. It is cheap and
# unmetered, it is the step most likely to fail (scans, DRM, odd encodings), and
# separating it means a user whose PDF will not parse finds out immediately
# rather than after spending a generation.

# Upload ceiling for the extraction endpoint. Generous enough for a long report,
# small enough that a mis-drop does not tie up a worker.
_MAX_UPLOAD_BYTES = 25 * 1024 * 1024
_ALLOWED_DOC_EXTENSIONS = (".pdf", ".docx", ".pptx", ".txt", ".md", ".markdown", ".vtt")

# Narration is synthesized in a single call, so it has to fit in one request.
_MAX_NARRATION_CHARS = 5000


class ExtractedDocument(BaseModel):
    text: str
    characters: int
    words: int


class PdfSummaryRequest(BaseModel):
    document: str = Field(..., min_length=200, max_length=200_000)
    length: str = "standard"


class PdfSummaryResponse(BaseModel):
    summary: str
    key_points: list[str]
    key_terms: list[str]
    truncated: bool


class PdfScriptRequest(BaseModel):
    document: str = Field(..., min_length=200, max_length=200_000)
    length: str = "standard"
    max_words_per_scene: int = Field(90, ge=30, le=200)


class ScriptScene(BaseModel):
    title: str
    narration: str


class PdfScriptResponse(BaseModel):
    video_title: str
    scenes: list[ScriptScene]
    truncated: bool


class PdfStoryboardRequest(BaseModel):
    document: str = Field(..., min_length=200, max_length=200_000)
    slide_count: int = Field(10, ge=3, le=30)


class StoryboardSlide(BaseModel):
    headline: str
    on_screen: str
    narration: str


class PdfStoryboardResponse(BaseModel):
    deck_title: str
    slides: list[StoryboardSlide]
    truncated: bool


class PdfNarrationRequest(BaseModel):
    text: str = Field(..., min_length=20, max_length=_MAX_NARRATION_CHARS)
    voice_gender: str | None = "female"
    voice_accent: str | None = None


@router.post("/extract-document", response_model=ExtractedDocument)
async def extract_document(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    """Extract text from an uploaded document. Auth-gated, unmetered.

    Reuses the same extractor the main pipeline runs
    (services/doc_extractor), so what the tools see is exactly what a real
    project would see — including its table handling, which a browser-side
    parser cannot match.
    """
    filename = file.filename or "document"
    if not filename.lower().endswith(_ALLOWED_DOC_EXTENSIONS):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Use one of: {', '.join(_ALLOWED_DOC_EXTENSIONS)}.",
        )

    # UploadFile.size is populated by Starlette for buffered uploads; fall back
    # to measuring the body when it is absent rather than trusting a null.
    size = file.size
    if size is None:
        size = len(await file.read())
        await file.seek(0)
    if size > _MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"'{filename}' is larger than {_MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
        )

    # Parsing is synchronous and CPU-bound — keep it off the event loop.
    text = await run_in_threadpool(extract_text_from_upload, file)

    stripped = (text or "").strip()
    if len(stripped) < 200:
        raise HTTPException(
            status_code=422,
            detail=(
                "Not enough text to work with. If this is a scanned PDF it has no "
                "text layer, so it needs OCR before these tools can read it."
            ),
        )
    return {
        "text": stripped,
        "characters": len(stripped),
        "words": len(stripped.split()),
    }


@router.post("/pdf-summary", response_model=PdfSummaryResponse)
async def generate_pdf_summary(
    payload: PdfSummaryRequest,
    user: User = Depends(get_current_user),
):
    try:
        result = await DocumentSummarizer().generate(
            document=payload.document, length=payload.length
        )
    except Exception:
        logger.exception("pdf-tools summary generation failed")
        raise HTTPException(status_code=502, detail=_GENERIC_FAIL)
    if not result.get("summary"):
        raise HTTPException(status_code=502, detail=_GENERIC_FAIL)
    return result


@router.post("/pdf-video-script", response_model=PdfScriptResponse)
async def generate_pdf_video_script(
    payload: PdfScriptRequest,
    user: User = Depends(get_current_user),
):
    try:
        result = await DocumentToVideoScript().generate(
            document=payload.document,
            length=payload.length,
            max_words_per_scene=payload.max_words_per_scene,
        )
    except Exception:
        logger.exception("pdf-tools video-script generation failed")
        raise HTTPException(status_code=502, detail=_GENERIC_FAIL)
    if not result.get("scenes"):
        raise HTTPException(status_code=502, detail=_GENERIC_FAIL)
    return result


@router.post("/pdf-storyboard", response_model=PdfStoryboardResponse)
async def generate_pdf_storyboard(
    payload: PdfStoryboardRequest,
    user: User = Depends(get_current_user),
):
    try:
        result = await DocumentToStoryboard().generate(
            document=payload.document, slide_count=payload.slide_count
        )
    except Exception:
        logger.exception("pdf-tools storyboard generation failed")
        raise HTTPException(status_code=502, detail=_GENERIC_FAIL)
    if not result.get("slides"):
        raise HTTPException(status_code=502, detail=_GENERIC_FAIL)
    return result


@router.post("/pdf-narration")
def generate_pdf_narration(
    payload: PdfNarrationRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """Synthesize narration for a document excerpt and return it as an mp3.

    Unlike /api/voice/preview this is available on FREE (with a small lifetime
    allowance) and reads the user's own text rather than a fixed sample. It is
    the half of the pdf-to-audio tool a browser cannot do: the Web Speech API
    can play audio but exposes no way to capture it to a file.

    Every plan gets exactly one synthesis, for the lifetime of the account —
    this is a metered ElevenLabs call, not a local generation. Because the
    response body is the mp3 itself, the usage counts ride back on the
    ``x-tool-used`` / ``x-tool-limit`` headers rather than in JSON.
    """
    from app.services.voiceover import synthesize_voice_preview

    _used, limit = _check_quota(user, "pdf_narration", db)

    try:
        audio = synthesize_voice_preview(
            gender=payload.voice_gender or "female",
            accent=payload.voice_accent,
            custom_voice_id=None,
            voice_emotion=None,
            video_style=None,
            text=payload.text.strip(),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception:
        logger.exception("pdf-tools narration synthesis failed")
        raise HTTPException(status_code=502, detail=_GENERIC_FAIL)
    if not audio:
        raise HTTPException(status_code=502, detail=_GENERIC_FAIL)

    # Charged only here, past every failure path: a provider outage must not
    # cost the user the one narration they are ever allowed.
    used = _charge(user, "pdf_narration", db)

    return StreamingResponse(
        io.BytesIO(audio),
        media_type="audio/mpeg",
        headers={
            "Cache-Control": "no-store",
            "Content-Disposition": 'attachment; filename="narration.mp3"',
            "x-tool-used": str(used),
            "x-tool-limit": str(limit),
        },
    )
