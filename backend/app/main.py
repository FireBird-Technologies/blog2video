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
from app.services.remotion import safe_remove_workspace, get_workspace_dir
from app.routers import projects, pipeline, chat, auth, billing


# ─── Scheduled cleanup for stale free-user data ──────────────

async def _periodic_free_tier_cleanup():
    """
    Every hour, delete projects for FREE-tier users that haven't been
    updated in 24 hours. This catches users who closed their browser
    without explicitly logging out.
    """
    while True:
        await asyncio.sleep(3600)  # run every hour
        db = SessionLocal()
        try:
            cutoff = datetime.utcnow() - timedelta(hours=24)
            free_users = db.query(User).filter(User.plan == PlanTier.FREE).all()

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
                    project_media = os.path.join(
                        settings.MEDIA_DIR, f"projects/{project.id}"
                    )
                    if os.path.exists(project_media):
                        safe_remove_workspace(get_workspace_dir(project.id))
                        shutil.rmtree(project_media, ignore_errors=True)
                    db.delete(project)

            db.commit()
        except Exception as e:
            print(f"[CLEANUP] Periodic cleanup error: {e}")
            db.rollback()
        finally:
            db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: init DB, start background tasks."""
    init_db()
    cleanup_task = asyncio.create_task(_periodic_free_tier_cleanup())
    yield
    cleanup_task.cancel()


# ─── App ──────────────────────────────────────────────────────

app = FastAPI(
    title="Blog2Video API",
    description="Convert blog posts into explainer videos using AI",
    version="0.2.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173", "http://localhost:3000"],
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
