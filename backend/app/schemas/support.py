from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    page_path: Optional[str] = None
    conversation_id: Optional[int] = None


class GuidanceStep(BaseModel):
    selector: str
    tooltip: str
    placement: Optional[str] = "bottom"


class UIGuidance(BaseModel):
    action_id: str
    steps: list[GuidanceStep] = []


class NavigationHint(BaseModel):
    target_route: str
    requires_project_id: bool = False
    description: str


class ChatResponse(BaseModel):
    conversation_id: int
    answer: str
    citations: list[str] = []
    ui_guidance: list[UIGuidance] = []
    navigation: Optional[NavigationHint] = None


class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    page_path: Optional[str] = None
    cited_docs: Optional[list[str]] = None
    ui_guidance: Optional[list[UIGuidance]] = None
    created_at: str


class ConversationOut(BaseModel):
    id: int
    summary: str
    session_state: dict
    messages: list[MessageOut]


class ClaimRequest(BaseModel):
    conversation_id: int
