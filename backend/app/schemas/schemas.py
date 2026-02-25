from datetime import datetime
from pydantic import BaseModel, HttpUrl
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
    animation_instructions: Optional[str] = None
    logo_position: Optional[str] = "bottom_right"  # top_left, top_right, bottom_left, bottom_right
    logo_opacity: Optional[float] = 0.9  # 0.0 - 1.0
    custom_voice_id: Optional[str] = None    # ElevenLabs voice ID (Pro users)
    aspect_ratio: Optional[str] = "landscape"  # "landscape" or "portrait"
    video_style: Optional[str] = "explainer"   # explainer | promotional | storytelling


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
    animation_instructions: Optional[str] = None
    studio_unlocked: bool = False
    studio_port: Optional[int] = None
    player_port: Optional[int] = None
    r2_video_key: Optional[str] = None
    r2_video_url: Optional[str] = None
    logo_r2_url: Optional[str] = None
    logo_position: str = "bottom_right"
    logo_opacity: float = 0.9
    custom_voice_id: Optional[str] = None
    aspect_ratio: str = "landscape"
    video_style: str = "explainer"
    ai_assisted_editing_count: int = 0
    created_at: datetime
    updated_at: datetime
    scenes: list[SceneOut] = []
    assets: list[AssetOut] = []

    class Config:
        from_attributes = True


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

class SceneUpdate(BaseModel):
    title: Optional[str] = None
    narration_text: Optional[str] = None
    display_text: Optional[str] = None
    visual_description: Optional[str] = None
    remotion_code: Optional[str] = None
    duration_seconds: Optional[float] = None


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
