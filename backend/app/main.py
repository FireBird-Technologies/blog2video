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
from app.routers import projects, pipeline, chat, auth, billing, contact


# ─── Scheduled cleanup for stale data (free + paid tiers) ────

def _delete_project_storage(project: Project) -> None:
    """Delete all storage (local + R2) for a project."""
    # Delete from R2
    if r2_storage.is_r2_configured():
        try:
            r2_storage.delete_project_files(project.user_id, project.id)
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
    try:
        print("[STARTUP] Initializing database...")
        init_db()
        print("[STARTUP] Database initialized successfully")
    except Exception as e:
        print(f"[STARTUP] Database initialization failed: {e}")
        import traceback
        traceback.print_exc()
        # Don't raise - let the app start anyway (might be a migration issue)
    
    try:
        free_cleanup = asyncio.create_task(_periodic_free_tier_cleanup())
        paid_cleanup = asyncio.create_task(_periodic_paid_tier_cleanup())
        print("[STARTUP] Background tasks started")
    except Exception as e:
        print(f"[STARTUP] Failed to start background tasks: {e}")
        import traceback
        traceback.print_exc()
    
    yield
    
    try:
        free_cleanup.cancel()
        paid_cleanup.cancel()
    except:
        pass


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
    "https://blog2video-nu.vercel.app",
    "https://blog2video-522695462929.us-west1.run.app",
    "https://blog2video.app",
    "https://www.blog2video.app",
    "https://muhammad-mehdi-backend-b2v.hf.space",
]
for origin in _always_allowed:
    if origin not in _origins:
        _origins.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"https://(blog2video.*\.vercel\.app|.*\.blog2video\.app|.*\.hf\.space|.*\.blog2video\.pages\.dev)",
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
app.include_router(contact.router)


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


@app.get("/api/templates")
def list_templates():
    """Return available video templates (from TemplateService)."""
    from app.services.template_service import list_templates as _list_templates
    return _list_templates()


def _get_voice_preview_url_by_key(key: str) -> str | None:
    """Resolve voice key (e.g. female_american) to ElevenLabs preview URL, or None.
    Uses get(voice_id) so we get full voice details including preview_url (get_all may omit it for some voices).
    """
    from app.services.voiceover import VOICE_MAP
    from elevenlabs import ElevenLabs

    if not settings.ELEVENLABS_API_KEY:
        return None
    parts = key.split("_")
    if len(parts) != 2:
        return None
    gender, accent = parts[0], parts[1]
    voice_id = VOICE_MAP.get((gender, accent))
    if not voice_id:
        return None
    try:
        client = ElevenLabs(api_key=settings.ELEVENLABS_API_KEY)
        # Prefer get(voice_id) so we get full details (e.g. preview_url) for each voice
        voice = None
        if hasattr(client.voices, "get"):
            try:
                voice = client.voices.get(voice_id)
            except Exception:
                pass
        if voice is None:
            voices_response = client.voices.get_all()
            voice = next((v for v in voices_response.voices if v.voice_id == voice_id), None)
        return getattr(voice, "preview_url", None) if voice else None
    except Exception as e:
        print(f"[VOICES] preview-audio lookup failed for {key}: {e}")
        return None


import time as _time

_voice_previews_cache: dict = {}
_voice_previews_cache_ts: float = 0
_VOICE_CACHE_TTL = 3600  # 1 hour

@app.get("/api/voices/previews")
async def get_voice_previews():
    """Return preview audio URLs for each supported voice option (cached 1h)."""
    global _voice_previews_cache, _voice_previews_cache_ts

    if _voice_previews_cache and (_time.time() - _voice_previews_cache_ts) < _VOICE_CACHE_TTL:
        return _voice_previews_cache

    from app.services.voiceover import VOICE_MAP
    from elevenlabs import ElevenLabs

    if not settings.ELEVENLABS_API_KEY:
        return {}

    try:
        client = ElevenLabs(api_key=settings.ELEVENLABS_API_KEY)
        voices_response = client.voices.get_all()
        voice_lookup = {v.voice_id: v for v in voices_response.voices}

        result = {}
        for (gender, accent), voice_id in VOICE_MAP.items():
            key = f"{gender}_{accent}"
            voice = voice_lookup.get(voice_id)
            labels = (voice.labels or {}) if voice else {}
            result[key] = {
                "voice_id": voice_id,
                "name": voice.name if voice else f"{gender.title()} {accent.title()}",
                "preview_url": voice.preview_url if voice else None,
                "description": labels.get("description", ""),
                "gender": gender,
                "accent": accent,
            }
        _voice_previews_cache = result
        _voice_previews_cache_ts = _time.time()
        return result
    except Exception as e:
        print(f"[VOICES] Failed to fetch previews: {e}")
        return {}


@app.get("/api/voices/preview-audio")
async def get_voice_preview_audio(key: str):
    """Stream voice preview audio so playback can start as soon as first bytes arrive."""
    import requests
    from fastapi.responses import StreamingResponse

    preview_url = _get_voice_preview_url_by_key(key)
    if not preview_url:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Voice preview not found")

    try:
        resp = requests.get(preview_url, timeout=10, stream=True)
        resp.raise_for_status()
        media_type = resp.headers.get("Content-Type", "audio/mpeg")

        def chunk_iter():
            for chunk in resp.iter_content(chunk_size=16 * 1024):
                if chunk:
                    yield chunk

        return StreamingResponse(
            chunk_iter(),
            media_type=media_type,
        )
    except Exception as e:
        print(f"[VOICES] preview-audio proxy failed for {key}: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=502, detail="Failed to fetch preview audio")
