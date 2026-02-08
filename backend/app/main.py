import os
import asyncio
import shutil
from datetime import datetime, timedelta
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import init_db, SessionLocal
from app.models.user import User, PlanTier
from app.models.project import Project
from app.models.subscription import Subscription, SubscriptionStatus
from app.services.remotion import safe_remove_workspace, get_workspace_dir
from app.services import r2_storage
from app.routers import projects, pipeline, chat, auth, billing


# ─── Scheduled cleanup for stale data (free + paid tiers) ────

def _delete_project_storage(project: Project) -> None:
    """Delete all storage (local + R2) for a project."""
    # Delete from R2
    if r2_storage.is_r2_configured():
        try:
            r2_storage.delete_project_files(project.id)
        except Exception as e:
            print(f"[CLEANUP] R2 deletion failed for project {project.id}: {e}")

    # Delete local files
    project_media = os.path.join(settings.MEDIA_DIR, f"projects/{project.id}")
    if os.path.exists(project_media):
        safe_remove_workspace(get_workspace_dir(project.id))
        shutil.rmtree(project_media, ignore_errors=True)


async def _periodic_free_tier_cleanup():
    """
    Every hour, delete projects for FREE-tier users that haven't been
    updated in 24 hours. Deletes from both local storage and R2.
    """
    while True:
        await asyncio.sleep(3600)  # run every hour
        db = SessionLocal()
        try:
            cutoff = datetime.utcnow() - timedelta(hours=24)
            free_users = db.query(User).filter(User.plan == PlanTier.FREE).all()

            deleted_count = 0
            for user in free_users:
                stale_projects = (
                    db.query(Project)
                    .filter(
                        Project.user_id == user.id,
                        Project.updated_at < cutoff,
                    )
                    .all()
                )
                for project in stale_projects:
                    _delete_project_storage(project)
                    db.delete(project)
                    deleted_count += 1

            db.commit()
            if deleted_count > 0:
                print(f"[CLEANUP] Free tier: deleted {deleted_count} stale projects")
        except Exception as e:
            print(f"[CLEANUP] Free tier cleanup error: {e}")
            db.rollback()
        finally:
            db.close()


async def _periodic_paid_tier_cleanup():
    """
    Every 6 hours, delete projects for paid users whose subscription
    has been canceled/expired for more than 30 days, OR whose last
    payment (per-video) was more than 30 days ago.

    Retention policy:
    - FREE users: 24 hours after last update (handled above)
    - Paid users: 30 days after subscription end / last payment
    """
    while True:
        await asyncio.sleep(21600)  # run every 6 hours
        db = SessionLocal()
        try:
            cutoff_30d = datetime.utcnow() - timedelta(days=30)

            # Find paid users whose subscription is no longer active
            # (canceled or expired more than 30 days ago)
            expired_subs = (
                db.query(Subscription)
                .filter(
                    Subscription.status.in_([
                        SubscriptionStatus.CANCELED,
                        SubscriptionStatus.EXPIRED,
                    ]),
                    Subscription.canceled_at != None,  # noqa: E711
                    Subscription.canceled_at < cutoff_30d,
                )
                .all()
            )

            user_ids_to_clean = set()
            for sub in expired_subs:
                # Check if the user has any ACTIVE subscription
                active_sub = (
                    db.query(Subscription)
                    .filter(
                        Subscription.user_id == sub.user_id,
                        Subscription.status == SubscriptionStatus.ACTIVE,
                    )
                    .first()
                )
                if not active_sub:
                    user_ids_to_clean.add(sub.user_id)

            # Also clean per-video purchases older than 30 days
            # where the project hasn't been updated in 30 days
            old_per_video = (
                db.query(Subscription)
                .filter(
                    Subscription.status == SubscriptionStatus.COMPLETED,
                    Subscription.created_at < cutoff_30d,
                    Subscription.project_id != None,  # noqa: E711
                )
                .all()
            )

            deleted_count = 0

            # Clean expired subscription users' projects
            for user_id in user_ids_to_clean:
                user = db.query(User).filter(User.id == user_id).first()
                if not user or user.plan == PlanTier.PRO:
                    continue  # Skip if they re-subscribed

                stale_projects = (
                    db.query(Project)
                    .filter(
                        Project.user_id == user_id,
                        Project.updated_at < cutoff_30d,
                    )
                    .all()
                )
                for project in stale_projects:
                    _delete_project_storage(project)
                    db.delete(project)
                    deleted_count += 1

            # Clean old per-video project files (keep DB record, delete storage)
            for sub in old_per_video:
                if sub.project_id:
                    project = db.query(Project).filter(Project.id == sub.project_id).first()
                    if project and project.updated_at < cutoff_30d:
                        _delete_project_storage(project)
                        # Clear R2 references but keep the project record
                        project.r2_video_key = None
                        project.r2_video_url = None
                        for asset in project.assets:
                            asset.r2_key = None
                            asset.r2_url = None
                        deleted_count += 1

            db.commit()
            if deleted_count > 0:
                print(f"[CLEANUP] Paid tier: cleaned {deleted_count} expired projects")
        except Exception as e:
            print(f"[CLEANUP] Paid tier cleanup error: {e}")
            db.rollback()
        finally:
            db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: init DB, start background tasks."""
    init_db()
    free_cleanup = asyncio.create_task(_periodic_free_tier_cleanup())
    paid_cleanup = asyncio.create_task(_periodic_paid_tier_cleanup())
    yield
    free_cleanup.cancel()
    paid_cleanup.cancel()


# ─── App ──────────────────────────────────────────────────────

app = FastAPI(
    title="Blog2Video API",
    description="Convert blog posts into explainer videos using AI",
    version="0.2.0",
    lifespan=lifespan,
)

# CORS — build allowed origins from FRONTEND_URL (comma-separated ok)
_origins = [
    o.strip()
    for o in settings.FRONTEND_URL.split(",")
    if o.strip()
]
# Always allow local dev + production origins
_always_allowed = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://blog2video.vercel.app",
    "https://blog2video-522695462929.us-west1.run.app",
]
for origin in _always_allowed:
    if origin not in _origins:
        _origins.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"https://blog2video.*\.vercel\.app",  # Vercel preview deploys
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount media files for serving images/audio
os.makedirs(settings.MEDIA_DIR, exist_ok=True)
app.mount("/media", StaticFiles(directory=settings.MEDIA_DIR), name="media")

# Include routers
app.include_router(auth.router)
app.include_router(billing.router)
app.include_router(projects.router)
app.include_router(pipeline.router)
app.include_router(chat.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "version": "0.2.0"}


@app.get("/api/config/public")
def public_config():
    """Return non-secret config needed by the frontend."""
    return {
        "google_client_id": settings.GOOGLE_CLIENT_ID,
        "stripe_publishable_key": settings.STRIPE_PUBLISHABLE_KEY,
    }
