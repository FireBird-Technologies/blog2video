from datetime import datetime
from pydantic import BaseModel, Field, HttpUrl, field_validator
from typing import Optional


# ─── Project ───────────────────────────────────────────────

class ProjectCreate(BaseModel):
    blog_url: Optional[str] = None
    name: Optional[str] = None
    template: Optional[str] = "default"
    voice_gender: Optional[str] = "female"   # "male", "female", or "none"
    voice_accent: Optional[str] = "american"  # "american" or "british"
    accent_color: Optional[str] = "#7C3AED"  # purple default
    bg_color: Optional[str] = "#FFFFFF"      # white default
    text_color: Optional[str] = "#000000"    # black default
    font_family: Optional[str] = None        # optional font ID override
    animation_instructions: Optional[str] = None
    logo_position: Optional[str] = "bottom_right"  # top_left, top_right, bottom_left, bottom_right
    logo_opacity: Optional[float] = 0.9  # 0.0 - 1.0
    logo_size: Optional[float] = 100.0  # percentage, e.g. 100 = 100%
    custom_voice_id: Optional[str] = None    # ElevenLabs voice ID (Pro users)
    aspect_ratio: Optional[str] = "landscape"  # "landscape" or "portrait"
    video_style: Optional[str] = "explainer"   # explainer | promotional | storytelling
    video_length: Optional[str] = "auto"  # auto | short (6-8) | medium (12-15) | detailed (15-20)
    content_language: Optional[str] = None     # preferred target language (ISO code or name)


class ProjectUpdate(BaseModel):
    accent_color: Optional[str] = None
    bg_color: Optional[str] = None
    text_color: Optional[str] = None
    font_family: Optional[str] = None
    content_language: Optional[str] = None
    video_length: Optional[str] = None
    aspect_ratio: Optional[str] = None  # "landscape" | "portrait"

    @field_validator("aspect_ratio")
    @classmethod
    def validate_aspect_ratio(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        n = (v or "").strip().lower()
        if n not in ("landscape", "portrait"):
            raise ValueError("aspect_ratio must be 'landscape' or 'portrait'")
        return n


class ProjectTemplateChangeRequest(BaseModel):
    template: str


class ProjectTemplateChangeJobOut(BaseModel):
    id: int
    project_id: int
    user_id: int
    target_template: str
    status: str
    total_scenes: int
    processed_scenes: int
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class SceneOut(BaseModel):
    id: int
    project_id: int
    order: int
    title: str
    narration_text: str
    display_text: Optional[str] = None
    visual_description: str
    remotion_code: Optional[str] = None
    voiceover_path: Optional[str] = None
    duration_seconds: float
    extra_hold_seconds: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AssetOut(BaseModel):
    id: int
    project_id: int
    asset_type: str
    original_url: Optional[str] = None
    local_path: str
    filename: str
    r2_key: Optional[str] = None
    r2_url: Optional[str] = None
    excluded: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class ChatMessageOut(BaseModel):
    id: int
    project_id: int
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewStateOut(BaseModel):
    project_sequence: int
    has_review_for_project: bool
    should_show_inline: bool


class ReviewOut(BaseModel):
    id: int
    user_id: int
    project_id: int
    rating: int
    suggestion: Optional[str] = None
    source: str
    trigger_event: str
    project_sequence: int
    plan_at_submission: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReviewSubmit(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    suggestion: Optional[str] = None
    source: str
    trigger_event: str

    @field_validator("suggestion")
    @classmethod
    def normalize_suggestion(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        trimmed = v.strip()
        return trimmed or None

    @field_validator("source")
    @classmethod
    def validate_source(cls, v: str) -> str:
        allowed = {"inline_row", "first_project_popup"}
        if v not in allowed:
            raise ValueError("source must be one of: first_project_popup, inline_row")
        return v

    @field_validator("trigger_event")
    @classmethod
    def validate_trigger_event(cls, v: str) -> str:
        allowed = {"manual", "delayed_popup"}
        if v not in allowed:
            raise ValueError("trigger_event must be one of: delayed_popup, manual")
        return v


class ReviewSubmitResponse(BaseModel):
    review: ReviewOut
    review_state: ReviewStateOut


class ProjectOut(BaseModel):
    id: int
    name: str
    blog_url: Optional[str] = None
    blog_content: Optional[str] = None
    status: str
    template: str = "default"
    voice_gender: str = "female"
    voice_accent: str = "american"
    accent_color: str = "#7C3AED"
    bg_color: str = "#FFFFFF"
    text_color: str = "#000000"
    font_family: Optional[str] = None
    animation_instructions: Optional[str] = None
    studio_unlocked: bool = False
    studio_port: Optional[int] = None
    player_port: Optional[int] = None
    r2_video_key: Optional[str] = None
    r2_video_url: Optional[str] = None
    logo_r2_url: Optional[str] = None
    logo_position: str = "bottom_right"
    logo_opacity: float = 0.9
    logo_size: float = 100.0  # percentage
    custom_voice_id: Optional[str] = None
    aspect_ratio: str = "landscape"
    video_style: str = "explainer"
    video_length: str = "auto"
    content_language: Optional[str] = None  # ISO 639-1, e.g. 'en', 'es'. Null = auto-detect from content.
    ai_assisted_editing_count: int = 0
    custom_theme: Optional[dict] = None
    custom_template_missing: bool = False
    review_state: Optional[ReviewStateOut] = None
    created_at: datetime
    updated_at: datetime
    scenes: list[SceneOut] = []
    assets: list[AssetOut] = []

    @field_validator("logo_size", mode="before")
    @classmethod
    def coerce_logo_size(cls, v: object) -> float:
        if v is None:
            return 100.0
        if isinstance(v, (int, float)):
            p = float(v)
            return max(50.0, min(200.0, p))
        return 100.0

    class Config:
        from_attributes = True


class BulkProjectItem(BaseModel):
    """One project in a bulk create request (same fields as ProjectCreate)."""
    blog_url: str
    name: Optional[str] = None
    template: Optional[str] = "default"
    video_style: Optional[str] = "explainer"
    voice_gender: Optional[str] = "female"
    voice_accent: Optional[str] = "american"
    accent_color: Optional[str] = "#7C3AED"
    bg_color: Optional[str] = "#FFFFFF"
    text_color: Optional[str] = "#000000"
    font_family: Optional[str] = None
    animation_instructions: Optional[str] = None
    logo_position: Optional[str] = "bottom_right"
    logo_opacity: Optional[float] = 0.9
    custom_voice_id: Optional[str] = None
    aspect_ratio: Optional[str] = "landscape"
    content_language: Optional[str] = None
    video_length: Optional[str] = "auto"


class BulkCreateResponse(BaseModel):
    project_ids: list[int]


class ProjectLogoUpdate(BaseModel):
    logo_position: Optional[str] = None  # top_left, top_right, bottom_left, bottom_right
    logo_size: Optional[float] = None    # percentage, e.g. 100 = 100% (50-200), REAL for smooth slider
    logo_opacity: Optional[float] = None # 0.0 - 1.0

    @field_validator("logo_size", mode="before")
    @classmethod
    def clamp_logo_size(cls, v: object) -> Optional[float]:
        if v is None:
            return None
        if isinstance(v, (int, float)):
            return max(50.0, min(200.0, float(v)))
        return None


class ProjectListOut(BaseModel):
    id: int
    name: str
    blog_url: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime
    scene_count: int = 0

    class Config:
        from_attributes = True


# ─── Scene Update ──────────────────────────────────────────

class SceneTypographyBulkUpdate(BaseModel):
    title_font_size: Optional[int] = None
    description_font_size: Optional[int] = None

class SceneUpdate(BaseModel):
    title: Optional[str] = None
    narration_text: Optional[str] = None
    display_text: Optional[str] = None
    visual_description: Optional[str] = None
    remotion_code: Optional[str] = None
    duration_seconds: Optional[float] = None
    extra_hold_seconds: Optional[float] = None


# ─── Scene Editing ──────────────────────────────────────────

class SceneOrderItem(BaseModel):
    scene_id: int
    order: int


class ReorderScenesRequest(BaseModel):
    scene_orders: list[SceneOrderItem]


class RegenerateSceneRequest(BaseModel):
    description: str
    layout: Optional[str] = None


# ─── Chat ──────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str
    changes_made: str
    updated_scenes: list[SceneOut] = []


# ─── Pipeline ─────────────────────────────────────────────

class StudioResponse(BaseModel):
    studio_url: str
    port: int


class RenderResponse(BaseModel):
    output_path: str
    status: str


# ─── Custom voices (creation records: prompt/response/form) ───

class CustomVoiceCreate(BaseModel):
    voice_id: str
    source: str  # "prompt" | "form"
    name: Optional[str] = None  # user-provided name; if missing, backend uses "Generated N"
    prompt_text: Optional[str] = None
    response: Optional[dict] = None  # full API response, stored as JSON
    form_gender: Optional[str] = None
    form_age: Optional[str] = None
    form_persona: Optional[str] = None
    form_speed: Optional[str] = None
    form_accent: Optional[str] = None
    preview_url: Optional[str] = None


class CustomVoiceOut(BaseModel):
    id: int
    name: str
    voice_id: str
    source: str
    prompt_text: Optional[str] = None
    form_gender: Optional[str] = None
    form_age: Optional[str] = None
    form_persona: Optional[str] = None
    form_speed: Optional[str] = None
    form_accent: Optional[str] = None
    preview_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Saved voices (user's My Voices; can reference custom_voice) ─

class SavedVoiceCreate(BaseModel):
    voice_id: str
    name: str
    preview_url: Optional[str] = None
    source: Optional[str] = "custom"  # "custom" | "prebuilt"
    plan: Optional[str] = None  # "free" | "paid" for prebuilt (ElevenLabs)
    gender: Optional[str] = None
    accent: Optional[str] = None
    description: Optional[str] = None
    custom_voice_id: Optional[int] = None


class SavedVoiceOut(BaseModel):
    id: int
    voice_id: str
    name: str
    preview_url: Optional[str] = None
    source: str = "custom"
    plan: Optional[str] = None
    gender: Optional[str] = None
    accent: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime
    custom_voice_id: Optional[int] = None

    class Config:
        from_attributes = True
