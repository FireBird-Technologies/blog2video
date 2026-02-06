"""
Google OAuth authentication router.
Frontend sends the Google ID token, backend verifies it and returns a JWT.
"""
import os
import shutil
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from app.config import settings
from app.database import get_db
from app.models.user import User, PlanTier
from app.models.project import Project
from app.auth import create_access_token, get_current_user
from app.services.remotion import safe_remove_workspace, get_workspace_dir

router = APIRouter(prefix="/api/auth", tags=["auth"])


class GoogleLoginRequest(BaseModel):
    credential: str  # Google ID token from frontend


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(BaseModel):
    id: int
    email: str
    name: str
    picture: str | None
    plan: str
    videos_used_this_period: int
    video_limit: int
    can_create_video: bool

    class Config:
        from_attributes = True


# Fix forward ref
AuthResponse.model_rebuild()


@router.post("/google", response_model=AuthResponse)
def google_login(body: GoogleLoginRequest, db: Session = Depends(get_db)):
    """
    Verify Google ID token and create/login user.
    Returns a JWT access token.
    """
    try:
        idinfo = id_token.verify_oauth2_token(
            body.credential,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except ValueError as e:
        print(f"[AUTH ERROR] Google token verification failed: {e}")
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {e}")

    google_id = idinfo["sub"]
    email = idinfo.get("email", "")
    name = idinfo.get("name", email.split("@")[0])
    picture = idinfo.get("picture")

    if not email:
        raise HTTPException(status_code=400, detail="Email not provided by Google")

    # Find or create user
    user = db.query(User).filter(User.google_id == google_id).first()

    if not user:
        # Check if email already exists (shouldn't happen with Google, but safe)
        user = db.query(User).filter(User.email == email).first()
        if user:
            # Link Google ID to existing account
            user.google_id = google_id
            user.picture = picture or user.picture
        else:
            # Create new user
            user = User(
                email=email,
                name=name,
                picture=picture,
                google_id=google_id,
                plan=PlanTier.FREE,
                videos_used_this_period=0,
            )
            db.add(user)
    else:
        # Update name/picture on login
        user.name = name
        user.picture = picture or user.picture

    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)

    return AuthResponse(
        access_token=token,
        user=UserOut(
            id=user.id,
            email=user.email,
            name=user.name,
            picture=user.picture,
            plan=user.plan.value,
            videos_used_this_period=user.videos_used_this_period,
            video_limit=user.video_limit,
            can_create_video=user.can_create_video,
        ),
    )


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    """Get the current authenticated user."""
    return UserOut(
        id=user.id,
        email=user.email,
        name=user.name,
        picture=user.picture,
        plan=user.plan.value,
        videos_used_this_period=user.videos_used_this_period,
        video_limit=user.video_limit,
        can_create_video=user.can_create_video,
    )


@router.post("/logout")
def logout_cleanup(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Handle logout. For free-tier users, delete all project data and files
    so no data is retained after they leave.
    """
    if user.plan == PlanTier.FREE:
        _cleanup_free_user_data(user, db)
    return {"detail": "Logged out"}


def _cleanup_free_user_data(user: User, db: Session) -> None:
    """Delete all projects and associated media/workspace files for a free user."""
    projects = db.query(Project).filter(Project.user_id == user.id).all()

    for project in projects:
        # Remove the entire project media directory (images, audio, output, workspace)
        project_media = os.path.join(settings.MEDIA_DIR, f"projects/{project.id}")
        if os.path.exists(project_media):
            # Safely handle workspace junction before rmtree
            workspace = get_workspace_dir(project.id)
            safe_remove_workspace(workspace)
            shutil.rmtree(project_media, ignore_errors=True)

    # Delete all project records (cascades to scenes, assets, chat messages)
    db.query(Project).filter(Project.user_id == user.id).delete()
    db.commit()
