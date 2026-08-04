from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import get_current_user
from app.models.user import User
from app.dspy_modules.free_tools_gen import FreeToolsGenerator

router = APIRouter(prefix="/api/free-tools", tags=["free-tools"])

_generator = FreeToolsGenerator()


class VideoScriptRequest(BaseModel):
    topic_or_text: str
    tone: str = "explainer"


class VideoScriptResponse(BaseModel):
    hook: str
    scenes: list[str]
    cta: str


class ThumbnailTextRequest(BaseModel):
    topic: str


class ThumbnailTextResponse(BaseModel):
    options: list[str]


class YoutubeDescriptionRequest(BaseModel):
    topic: str
    keywords: str = ""


class YoutubeDescriptionResponse(BaseModel):
    description: str
    tags: list[str]


def _validate_input(value: str, field_name: str, max_length: int = 2000):
    cleaned = (value or "").strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail=f"{field_name} is required.")
    if len(cleaned) > max_length:
        raise HTTPException(status_code=400, detail=f"{field_name} is too long (max {max_length} characters).")
    return cleaned


@router.post("/video-script-generator", response_model=VideoScriptResponse)
async def video_script_generator(
    body: VideoScriptRequest,
    current_user: User = Depends(get_current_user),
):
    topic_or_text = _validate_input(body.topic_or_text, "topic_or_text")
    tone = (body.tone or "explainer").strip().lower()
    if tone not in ("explainer", "promotional", "storytelling"):
        tone = "explainer"
    try:
        result = await _generator.generate_video_script(topic_or_text, tone)
    except Exception:
        raise HTTPException(status_code=502, detail="Script generation failed. Please try again.")
    return result


@router.post("/thumbnail-text-generator", response_model=ThumbnailTextResponse)
async def thumbnail_text_generator(
    body: ThumbnailTextRequest,
    current_user: User = Depends(get_current_user),
):
    topic = _validate_input(body.topic, "topic", max_length=300)
    try:
        result = await _generator.generate_thumbnail_text(topic)
    except Exception:
        raise HTTPException(status_code=502, detail="Thumbnail text generation failed. Please try again.")
    return result


@router.post("/youtube-description-generator", response_model=YoutubeDescriptionResponse)
async def youtube_description_generator(
    body: YoutubeDescriptionRequest,
    current_user: User = Depends(get_current_user),
):
    topic = _validate_input(body.topic, "topic", max_length=300)
    keywords = (body.keywords or "").strip()[:300]
    try:
        result = await _generator.generate_youtube_description(topic, keywords)
    except Exception:
        raise HTTPException(status_code=502, detail="Description generation failed. Please try again.")
    return result
