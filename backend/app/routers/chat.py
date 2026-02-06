from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.scene import Scene
from app.models.chat_message import ChatMessage, MessageRole
from app.schemas.schemas import ChatRequest, ChatResponse, SceneOut
from app.dspy_modules.editor import ScriptEditor

router = APIRouter(prefix="/api/projects/{project_id}/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
def chat_edit(
    project_id: int,
    body: ChatRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Chat endpoint for editing the video script with natural language.
    Uses DSPy with reflexion for quality edits.
    """
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.user_id == user.id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    scenes = project.scenes
    if not scenes:
        raise HTTPException(
            status_code=400,
            detail="No scenes to edit. Generate a script first.",
        )

    # Save user message
    user_msg = ChatMessage(
        project_id=project_id,
        role=MessageRole.USER,
        content=body.message,
    )
    db.add(user_msg)
    db.flush()

    # Get conversation history
    history = [
        {"role": msg.role.value, "content": msg.content}
        for msg in project.chat_messages
    ]

    # Build current scenes data
    current_scenes = [
        {
            "title": s.title,
            "narration": s.narration_text,
            "visual_description": s.visual_description,
            "duration_seconds": s.duration_seconds,
        }
        for s in scenes
    ]

    try:
        editor = ScriptEditor()
        result = editor.edit(
            current_scenes=current_scenes,
            user_request=body.message,
            conversation_history=history,
        )

        # Update scenes with edited data
        updated_scenes_data = result["scenes"]
        _update_scenes(project_id, updated_scenes_data, db)

        # Save assistant reply
        reply = f"{result['changes_made']}\n\n{result['explanation']}"
        assistant_msg = ChatMessage(
            project_id=project_id,
            role=MessageRole.ASSISTANT,
            content=reply,
        )
        db.add(assistant_msg)
        db.commit()

        # Reload scenes
        db.refresh(project)
        scene_outs = [SceneOut.model_validate(s) for s in project.scenes]

        return ChatResponse(
            reply=reply,
            changes_made=result["changes_made"],
            updated_scenes=scene_outs,
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Chat edit failed: {str(e)}"
        )


@router.get("/history")
def get_chat_history(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the chat history for a project."""
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.project_id == project_id)
        .order_by(ChatMessage.created_at)
        .all()
    )
    return [
        {
            "id": m.id,
            "role": m.role.value,
            "content": m.content,
            "created_at": m.created_at.isoformat(),
        }
        for m in messages
    ]


def _update_scenes(project_id: int, scenes_data: list[dict], db: Session):
    """Update or recreate scenes from edited data."""
    # Delete old scenes
    db.query(Scene).filter(Scene.project_id == project_id).delete()
    db.flush()

    # Create new scenes from edited data
    for i, scene_data in enumerate(scenes_data):
        scene = Scene(
            project_id=project_id,
            order=i + 1,
            title=scene_data.get("title", f"Scene {i + 1}"),
            narration_text=scene_data.get("narration", ""),
            visual_description=scene_data.get("visual_description", ""),
            duration_seconds=scene_data.get("duration_seconds", 10),
        )
        db.add(scene)
