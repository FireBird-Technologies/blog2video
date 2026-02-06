from datetime import datetime
from pydantic import BaseModel, HttpUrl
from typing import Optional


# ─── Project ───────────────────────────────────────────────

class ProjectCreate(BaseModel):
    blog_url: str
    name: Optional[str] = None


class SceneOut(BaseModel):
    id: int
    project_id: int
    order: int
    title: str
    narration_text: str
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
    blog_url: str
    blog_content: Optional[str] = None
    status: str
    studio_port: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    scenes: list[SceneOut] = []
    assets: list[AssetOut] = []

    class Config:
        from_attributes = True


class ProjectListOut(BaseModel):
    id: int
    name: str
    blog_url: str
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
    visual_description: Optional[str] = None
    remotion_code: Optional[str] = None
    duration_seconds: Optional[float] = None


# ─── Chat ──────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str
    changes_made: str
    updated_scenes: list[SceneOut] = []


# ─── Pipeline ─────────────────────────────────────────────

class GenerateScriptRequest(BaseModel):
    target_duration_minutes: int = 3


class StudioResponse(BaseModel):
    studio_url: str
    port: int


class RenderResponse(BaseModel):
    output_path: str
    status: str
