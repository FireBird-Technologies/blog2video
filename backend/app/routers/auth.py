"""
Google OAuth authentication router.
Frontend sends the Google ID token, backend verifies it and returns a JWT.
"""
import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from app.config import settings
from app.database import get_db
from app.models.user import User, PlanTier
from app.models.project import Project
from app.models.subscription import Subscription
from app.auth import create_access_token, get_current_user
from app.services.voice_seed import ensure_free_voices_for_user
from app.services import r2_storage
from app.services.remotion import safe_remove_workspace, get_workspace_dir
from app.observability.logging import get_logger

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = get_logger(__name__)


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


def _delete_project_storage(project: Project) -> None:
    """Delete all storage (local + R2) for a project."""
    if r2_storage.is_r2_configured():
        try:
            r2_storage.delete_project_files(project.user_id, project.id)
        except Exception as e:
            logger.error(
                "[DELETE_ACCOUNT] R2 deletion failed for project %s: %s",
                project.id,
                e,
                extra={"project_id": project.id, "user_id": project.user_id},
            )
    project_media = os.path.join(settings.MEDIA_DIR, f"projects/{project.id}")
    if os.path.exists(project_media):
        safe_remove_workspace(get_workspace_dir(project.id))
        shutil.rmtree(project_media, ignore_errors=True)


@router.post("/google", response_model=AuthResponse)
def google_login(
    body: GoogleLoginRequest,
    reactivate: bool = Query(False, description="Confirm reactivation of a previously deleted account"),
    db: Session = Depends(get_db),
):
    """
    Verify Google ID token and create/login user.
    Returns a JWT access token.
    If user was soft-deleted (is_active=False), returns 403 with account_deleted
    unless reactivate=true, in which case the account is reactivated as a free user.
    """
    try:
        idinfo = id_token.verify_oauth2_token(
            body.credential,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except ValueError as e:
        logger.error("[AUTH ERROR] Google token verification failed: %s", e)
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {e}")

    google_id = idinfo["sub"]
    email = idinfo.get("email", "")
    name = idinfo.get("name", email.split("@")[0])
    picture = idinfo.get("picture")

    if not email:
        raise HTTPException(status_code=400, detail="Email not provided by Google")

    # Find or create user
    user = db.query(User).filter(User.google_id == google_id).first()
    created_new_user = False

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
                video_limit_bonus=0,
                is_active=True,
            )
            db.add(user)
            db.flush()
            created_new_user = True

    # User exists — check if soft-deleted (from google_id or email lookup)
    if not created_new_user and not user.is_active:
        if not reactivate:
            raise HTTPException(
                status_code=403,
                detail="account_deleted",
                headers={"X-Account-Deleted": "true"},
            )
        # Reactivate: free user; keep videos_used_this_period (not reset on delete)
        user.is_active = True
        user.plan = PlanTier.FREE
        user.video_limit_bonus = 0
        user.period_start = None
        user.stripe_customer_id = None
        user.stripe_subscription_id = None
    else:
        # Normal login: update name/picture
        user.name = name
        user.picture = picture or user.picture

    # Local testing: override plan if DEFAULT_PLAN is set in .env
    if settings.DEFAULT_PLAN and user.is_active:
        override = settings.DEFAULT_PLAN.upper()
        try:
            user.plan = PlanTier(override.lower())
        except ValueError:
            pass  # ignore invalid values

    db.commit()
    db.refresh(user)

    ensure_free_voices_for_user(db, user.id)

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
    Handle logout. Data is NOT deleted here — the periodic cleanup task
    handles deletion after 24 hours for free-tier users.
    """
    return {"detail": "Logged out"}


@router.post("/delete-account")
def delete_account(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Soft-delete the user account. Permanently deletes all user data
    (projects, scenes, subscriptions, custom templates, voices) and marks
    the user as inactive. Login with reactivate=true will restore as free user.
    videos_used_this_period is left unchanged so free-tier quota is not reset by delete/reactivate.
    """
    from app.models.subscription import Subscription
    from app.models.custom_template import CustomTemplate
    from app.models.saved_voice import SavedVoice
    from app.models.custom_voice import CustomVoice

    try:
        # 1. Cancel Stripe subscription immediately
        if user.stripe_subscription_id:
            try:
                import stripe
                stripe.api_key = settings.STRIPE_SECRET_KEY
                stripe.Subscription.delete(user.stripe_subscription_id)
            except Exception as e:
                logger.error(
                    "[DELETE_ACCOUNT] Stripe cancel failed for user %s: %s",
                    user.id,
                    e,
                    extra={"user_id": user.id},
                )

        # 2. Delete subscriptions (unlink project_id first to avoid FK issues)
        subs = db.query(Subscription).filter(Subscription.user_id == user.id).all()
        for sub in subs:
            sub.project_id = None
        db.flush()
        db.query(Subscription).filter(Subscription.user_id == user.id).delete()

        # 3. Delete project storage and projects
        projects = db.query(Project).filter(Project.user_id == user.id).all()
        for proj in projects:
            _delete_project_storage(proj)
            db.delete(proj)

        # 4. Delete saved voices, custom voices, custom templates
        db.query(SavedVoice).filter(SavedVoice.user_id == user.id).delete()
        db.query(CustomVoice).filter(CustomVoice.user_id == user.id).delete()
        db.query(CustomTemplate).filter(CustomTemplate.user_id == user.id).delete()

        # 5. Soft-delete user
        user.is_active = False
        user.stripe_customer_id = None
        user.stripe_subscription_id = None
        user.plan = PlanTier.FREE
        user.video_limit_bonus = 0
        user.period_start = None

        db.commit()
        return {"detail": "Account deleted successfully"}
    except Exception as e:
        db.rollback()
        logger.error(
            "[DELETE_ACCOUNT] Error for user %s: %s",
            user.id,
            e,
            extra={"user_id": user.id},
        )
        raise HTTPException(status_code=500, detail="Failed to delete account")
