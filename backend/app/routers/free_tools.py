"""
Login-gated endpoints for the free public SEO tools.

Each endpoint requires a valid JWT (Depends(get_current_user)) so anonymous
callers get a 401 — this is the server-side backstop behind the frontend login
gate. The generators are stateless single-shot DSPy calls (no Project row).
"""
import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.config import settings
from app.dspy_modules.free_tool_gen import (
    ThumbnailTextGenerator,
    VideoScriptGenerator,
    YouTubeDescriptionGenerator,
)
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/free-tools", tags=["free-tools"])

_GENERIC_FAIL = "Generation failed. Please try again in a moment."

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


class ThumbnailTextRequest(BaseModel):
    topic: str = Field(..., min_length=3, max_length=500)


class ThumbnailTextResponse(BaseModel):
    options: list[str]


class YouTubeDescriptionRequest(BaseModel):
    topic: str = Field(..., min_length=3, max_length=8000)


class YouTubeDescriptionResponse(BaseModel):
    description: str
    tags: list[str]


class BookCoverRequest(BaseModel):
    description: str = Field(..., min_length=20, max_length=2500)


class BookCoverResponse(BaseModel):
    image_base64: str


# ─── Endpoints ───────────────────────────────────────────────────────────────


@router.post("/video-script", response_model=VideoScriptResponse)
async def generate_video_script(
    payload: VideoScriptRequest,
    user: User = Depends(get_current_user),
):
    try:
        result = await VideoScriptGenerator().generate(
            topic=payload.topic, tone=payload.tone, length=payload.length
        )
    except Exception:
        logger.exception("free-tools video-script generation failed")
        raise HTTPException(status_code=502, detail=_GENERIC_FAIL)
    if not result.get("script_markdown"):
        raise HTTPException(status_code=502, detail=_GENERIC_FAIL)
    return result


@router.post("/thumbnail-text", response_model=ThumbnailTextResponse)
async def generate_thumbnail_text(
    payload: ThumbnailTextRequest,
    user: User = Depends(get_current_user),
):
    try:
        result = await ThumbnailTextGenerator().generate(topic=payload.topic)
    except Exception:
        logger.exception("free-tools thumbnail-text generation failed")
        raise HTTPException(status_code=502, detail=_GENERIC_FAIL)
    if not result.get("options"):
        raise HTTPException(status_code=502, detail=_GENERIC_FAIL)
    return result


@router.post("/youtube-description", response_model=YouTubeDescriptionResponse)
async def generate_youtube_description(
    payload: YouTubeDescriptionRequest,
    user: User = Depends(get_current_user),
):
    try:
        result = await YouTubeDescriptionGenerator().generate(topic=payload.topic)
    except Exception:
        logger.exception("free-tools youtube-description generation failed")
        raise HTTPException(status_code=502, detail=_GENERIC_FAIL)
    if not result.get("description"):
        raise HTTPException(status_code=502, detail=_GENERIC_FAIL)
    return result


@router.post("/book-cover", response_model=BookCoverResponse)
async def generate_book_cover(
    payload: BookCoverRequest,
    user: User = Depends(get_current_user),
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
    return {"image_base64": image_base64}
