from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User, PlanTier
from app.models.project import Project, ProjectStatus
from app.models.scene import Scene
from app.models.chat_message import ChatMessage, MessageRole
from app.schemas.schemas import ChatRequest, ChatResponse, SceneOut
from app.dspy_modules.editor import ScriptEditor
from app.services.remotion import write_remotion_data

router = APIRouter(prefix="/api/projects/{project_id}/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def chat_edit(
    project_id: int,
    body: ChatRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Chat endpoint for editing the video script with natural language.
    Uses DSPy with reflexion for quality edits (async).
    Only modifies the specific scenes requested -- voiceover and remotion code
    for untouched scenes are preserved.
    """
    # Chat editing is a Pro-only feature
    if user.plan != PlanTier.PRO:
        raise HTTPException(
            status_code=403,
            detail="AI chat editing is available on the Pro plan. Upgrade to edit your videos.",
        )

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

    # Build current scenes data (include order so editor knows which scene is which)
    current_scenes = [
        {
            "order": s.order,
            "title": s.title,
            "narration": s.narration_text,
            "visual_description": s.visual_description,
            "duration_seconds": s.duration_seconds,
        }
        for s in scenes
    ]

    try:
        editor = ScriptEditor()
        result = await editor.edit(
            current_scenes=current_scenes,
            user_request=body.message,
            conversation_history=history,
        )

        # Apply ONLY the changed scenes -- leave everything else intact
        changed_scenes = result["changed_scenes"]
        _apply_scene_changes(scenes, changed_scenes, db)

        # Invalidate cached render — project was edited, video is stale
        if project.r2_video_url:
            project.r2_video_url = None
            project.r2_video_key = None
            project.status = ProjectStatus.GENERATED

        # Save assistant reply
        reply = f"{result['changes_made']}\n\n{result['explanation']}"
        assistant_msg = ChatMessage(
            project_id=project_id,
            role=MessageRole.ASSISTANT,
            content=reply,
        )
        db.add(assistant_msg)
        db.commit()

        # Reload scenes and re-write Remotion files so Studio hot-reloads
        db.refresh(project)
        try:
            write_remotion_data(project, project.scenes, db)
        except Exception as file_err:
            print(f"[CHAT] Warning: Failed to update Remotion files: {file_err}")

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


def _apply_scene_changes(
    existing_scenes: list[Scene],
    changed_scenes: list[dict],
    db: Session,
):
    """
    Apply partial edits to existing scenes. Only updates scenes whose 'order'
    matches a changed scene. Preserves voiceover_path and remotion_code for
    untouched scenes.
    """
    # Build lookup by order
    scene_by_order = {s.order: s for s in existing_scenes}

    for change in changed_scenes:
        order = change.get("order")
        if order is None:
            continue

        scene = scene_by_order.get(order)
        if not scene:
            continue

        # Update only the script fields -- keep voiceover_path and remotion_code
        if "title" in change:
            scene.title = change["title"]
        if "narration" in change:
            scene.narration_text = change["narration"]
        if "visual_description" in change:
            scene.visual_description = change["visual_description"]
        if "duration_seconds" in change:
            scene.duration_seconds = change["duration_seconds"]

    db.flush()
