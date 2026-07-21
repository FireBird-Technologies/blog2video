import os
import asyncio
import logging
import warnings
import shutil
from datetime import datetime, timedelta
from contextlib import asynccontextmanager

from fastapi import FastAPI

# Ensure app loggers (e.g. app.services.elevenlabs_voice_design) emit INFO to console
logging.basicConfig(level=logging.INFO)
logging.getLogger("app").setLevel(logging.INFO)

# Suppress LiteLLM's LoggingWorker noise — background telemetry tasks that
# don't affect functionality but flood the console with warnings.
class _SuppressLiteLLMWorkerFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return "LoggingWorker" not in record.getMessage()

logging.getLogger("asyncio").addFilter(_SuppressLiteLLMWorkerFilter())

# Also suppress the RuntimeWarnings about unawaited coroutines from the same source.
warnings.filterwarnings(
    "ignore",
    message="coroutine '(LoggingWorker|Logging\\.async).*' was never awaited",
    category=RuntimeWarning,
    module="litellm",
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import init_db, SessionLocal
from app.models.user import User, PlanTier
from app.models.prebuilt_voice import PrebuiltVoice
from app.models.project import Project
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.update_email import UpdateEmail
from app.models.update_email_send import UpdateEmailSend
from app.services.remotion import safe_remove_workspace, get_workspace_dir
from app.services import r2_storage
from app.services import elevenlabs_keys
from app.routers import projects, pipeline, chat, auth, billing, contact, custom_templates, crafted_templates, saved_voices, template_studio, embed, unsubscribe, affiliate, support, mcp_oauth, mcp_transport, free_templates, voice, background_music, stock_data, collaboration, collab_ws, collab_history, project_shared_assets
from app.observability.tracing import init_tracing
from app.observability.logging import configure_logging


# ─── Scheduled cleanup for stale data (free + paid tiers) ────

def _delete_project_video_storage(project: Project) -> None:
    """Delete rendered video artifacts only; preserve images/audio/logo assets."""
    # Delete rendered video object from R2 only.
    if r2_storage.is_r2_configured() and project.r2_video_key:
        try:
            r2_storage.delete_object(project.r2_video_key)
        except Exception as e:
            print(f"[CLEANUP] R2 video deletion failed for project {project.id}: {e}")

    # Delete local files (workspace + output) under project media folder.
    project_media = os.path.join(settings.MEDIA_DIR, f"projects/{project.id}")
    if os.path.exists(project_media):
        safe_remove_workspace(get_workspace_dir(project.id))
        shutil.rmtree(project_media, ignore_errors=True)


async def _periodic_free_tier_cleanup():
    """
    Every hour, soft-delete projects for FREE-tier users that haven't been
    updated in 7 days. Delete rendered video artifacts only.
    """
    while True:
        await asyncio.sleep(3600)  # run every hour
        db = SessionLocal()
        try:
            cutoff = datetime.utcnow() - timedelta(hours=168)  # 7 days
            free_users = db.query(User).filter(User.plan == PlanTier.FREE).all()

            deactivated_count = 0
            for user in free_users:
                stale_projects = (
                    db.query(Project)
                    .filter(
                        Project.user_id == user.id,
                        Project.updated_at < cutoff,
                        Project.is_active == True,  # noqa: E712
                    )
                    .all()
                )
                for project in stale_projects:
                    _delete_project_video_storage(project)
                    project.is_active = False
                    project.r2_video_key = None
                    project.r2_video_url = None
                    deactivated_count += 1

            db.commit()
            if deactivated_count > 0:
                print(f"[CLEANUP] Free tier: deactivated {deactivated_count} stale projects")
        except Exception as e:
            print(f"[CLEANUP] Free tier cleanup error: {e}")
            db.rollback()
        finally:
            db.close()


async def _periodic_paid_tier_cleanup():
    """
    Every 6 hours, clean projects for paid users whose subscription
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

            deactivated_count = 0

            # Clean expired subscription users' projects
            for user_id in user_ids_to_clean:
                user = db.query(User).filter(User.id == user_id).first()
                if not user or user.plan in (PlanTier.PRO, PlanTier.STANDARD):
                    continue  # Skip if they re-subscribed

                stale_projects = (
                    db.query(Project)
                    .filter(
                        Project.user_id == user_id,
                        Project.updated_at < cutoff_30d,
                        Project.is_active == True,  # noqa: E712
                    )
                    .all()
                )
                for project in stale_projects:
                    _delete_project_video_storage(project)
                    project.is_active = False
                    project.r2_video_key = None
                    project.r2_video_url = None
                    deactivated_count += 1

            # Clean old per-video project render artifacts (keep DB record and media assets).
            for sub in old_per_video:
                if sub.project_id:
                    project = db.query(Project).filter(Project.id == sub.project_id).first()
                    if project and project.updated_at < cutoff_30d:
                        _delete_project_video_storage(project)
                        project.r2_video_key = None
                        project.r2_video_url = None
                        project.is_active = False
                        deactivated_count += 1

            db.commit()
            if deactivated_count > 0:
                print(f"[CLEANUP] Paid tier: soft-deactivated {deactivated_count} stale projects")
        except Exception as e:
            print(f"[CLEANUP] Paid tier cleanup error: {e}")
            db.rollback()
        finally:
            db.close()


async def _periodic_monthly_allotment_reset():
    """Reset the monthly video allotment for ANNUAL and LIFETIME subscribers.

    MONTHLY subscribers are reset by Stripe's ``invoice.paid`` webhook each
    month. Annual subscribers get that webhook only once a YEAR, and lifetime
    buyers never (no recurring subscription), so without this their allotment
    would never refresh mid-year. This task rolls every such user forward by
    whole **calendar months** elapsed since their ``period_start`` anchor.

    Safe to run repeatedly: ``roll_video_period_if_due`` is idempotent — once a
    user is current, re-running it is a no-op. Runs once shortly after startup
    (so users stuck under the old behavior are healed at deploy) and hourly
    thereafter, so a reset lands within an hour of the user's monthly
    anniversary regardless of restarts. (Single-instance deploy, so no leader
    election is needed.)
    """
    # Small grace so the first sweep doesn't contend with the rest of startup,
    # then run the sweep immediately (before the first hourly sleep) so already-
    # stuck users are caught at deploy rather than an hour later.
    await asyncio.sleep(10)
    while True:
        db = SessionLocal()
        try:
            # Only paid tiers can be annual/lifetime; roll_video_period_if_due
            # re-checks the exact eligibility and skips monthly subscribers.
            candidates = (
                db.query(User)
                .filter(User.plan.in_([PlanTier.STANDARD, PlanTier.PRO]))
                .all()
            )
            reset_count = 0
            for user in candidates:
                try:
                    if user.roll_video_period_if_due(db):
                        reset_count += 1
                except Exception as e:
                    # One bad user must not abort the whole sweep.
                    print(f"[BILLING] Monthly reset failed for user {user.id}: {e}")
                    db.rollback()
            if reset_count:
                print(f"[BILLING] Monthly allotment reset for {reset_count} annual/lifetime user(s)")
        except Exception as e:
            print(f"[BILLING] Monthly allotment reset sweep error: {e}")
            db.rollback()
        finally:
            db.close()
        # Sleep AFTER the sweep so the first run happens at startup, not an hour in.
        await asyncio.sleep(3600)  # hourly


async def _periodic_elevenlabs_quota_check():
    """Check the main ElevenLabs key's remaining character quota once on startup,
    then every 24h. Flips TTS synthesis over to the backup key when quota is low,
    and back once it recovers. See app/services/elevenlabs_keys.py.
    """
    while True:
        try:
            elevenlabs_keys.check_and_update_failover_state()
        except Exception as e:
            print(f"[ELEVENLABS QUOTA] periodic check error: {e}")
        finally:
            await asyncio.sleep(86400)  # 24h


from app.constants import FREE_PREMADE_VOICE_IDS as KNOWN_PREMADE_VOICE_IDS
from app.services.email import email_service


def _ensure_prebuilt_voices_seeded() -> None:
    """If prebuilt_voices is empty, fetch premade voices from ElevenLabs and insert. Rachel, Bill, Alice, Daniel = free; others = paid."""
    import json
    db = SessionLocal()
    try:
        if db.query(PrebuiltVoice).count() > 0:
            return
        if not settings.ELEVENLABS_API_KEY:
            print("[STARTUP] ELEVENLABS_API_KEY not set; skipping prebuilt voices seed")
            return
        from elevenlabs import ElevenLabs
        api_key = elevenlabs_keys.get_voice_design_api_key()
        elevenlabs_keys.log_key_usage(api_key, "startup prebuilt voices seed")
        client = ElevenLabs(api_key=api_key)
        try:
            voices_response = client.voices.get_all(show_legacy=True)
        except TypeError:
            voices_response = client.voices.get_all()
        for v in voices_response.voices:
            voice_id = getattr(v, "voice_id", None) or getattr(v, "id", None)
            if not voice_id:
                continue
            category = getattr(v, "category", None)
            if category != "premade" and voice_id not in KNOWN_PREMADE_VOICE_IDS:
                continue
            labels = getattr(v, "labels", None) or {}
            plan = "free" if voice_id in KNOWN_PREMADE_VOICE_IDS else "paid"
            row = PrebuiltVoice(
                voice_id=voice_id,
                name=getattr(v, "name", None) or "",
                preview_url=getattr(v, "preview_url", None),
                labels=json.dumps(labels) if isinstance(labels, dict) else "{}",
                description=(getattr(v, "description", None) or "") or None,
                plan=plan,
            )
            db.add(row)
        db.commit()
        print("[STARTUP] Prebuilt voices seeded successfully")
    except Exception as e:
        print(f"[STARTUP] Prebuilt voices seed failed: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


def _build_update_email_user_query(db, user_filter: str):
    from app.models.user import User, PlanTier
    q = db.query(User).filter(
        User.is_active == True,  # noqa: E712
        User.email.isnot(None),
        User.email != "",
        User.email_unsubscribed == False,  # noqa: E712
    )
    if user_filter == "free":
        q = q.filter(User.plan == PlanTier.FREE)
    elif user_filter == "paid":
        q = q.filter(User.plan != PlanTier.FREE)
    elif user_filter == "standard":
        q = q.filter(User.plan == PlanTier.STANDARD)
    elif user_filter == "pro":
        q = q.filter(User.plan == PlanTier.PRO)
    return q


async def _run_update_email_batch(email_id: int):
    """Send one daily batch for the given update email."""
    db = SessionLocal()
    try:
        update_email = db.get(UpdateEmail, email_id)
        if not update_email or update_email.status not in ("scheduled", "running"):
            return

        # Users in the target segment who haven't received this email yet
        from sqlalchemy import select
        already_sent_subq = (
            select(UpdateEmailSend.user_id)
            .where(UpdateEmailSend.update_email_id == email_id)
            .scalar_subquery()
        )
        remaining_users = (
            _build_update_email_user_query(db, update_email.user_filter)
            .filter(User.id.notin_(already_sent_subq))
            .order_by(User.created_at.asc())
            .limit(update_email.batch_size)
            .all()
        )

        # Snapshot total_users on first run (scheduled → running transition)
        if update_email.status == "scheduled":
            update_email.total_users = _build_update_email_user_query(db, update_email.user_filter).count()
            update_email.status = "running"
            db.commit()

        if not remaining_users:
            update_email.status = "completed"
            update_email.updated_at = datetime.utcnow()
            db.commit()
            print(f"[UPDATE_EMAIL] id={email_id} completed — all users have been sent this email")
            return

        print(f"[UPDATE_EMAIL] id={email_id} sending batch of {len(remaining_users)} users")

        for i, user in enumerate(remaining_users):
            send_status = "sent"
            try:
                email_service.send_blast_email(user.email, user.name or "", update_email.subject, update_email.body)
                update_email.sent_count += 1
                print(f"[UPDATE_EMAIL] ✓ {user.email}")
            except Exception as exc:
                send_status = "failed"
                update_email.failed_count += 1
                print(f"[UPDATE_EMAIL] ✗ {user.email}: {exc}")

            send_record = UpdateEmailSend(
                update_email_id=email_id,
                user_id=user.id,
                status=send_status,
                sent_at=datetime.utcnow(),
            )
            db.add(send_record)
            update_email.updated_at = datetime.utcnow()
            db.commit()

            if i + 1 < len(remaining_users):
                await asyncio.sleep(0.25)  # stay under Resend 5/sec limit

        # Check if all eligible users have now been sent
        total_sent = db.query(UpdateEmailSend).filter(UpdateEmailSend.update_email_id == email_id).count()
        total_eligible = _build_update_email_user_query(db, update_email.user_filter).count()
        if total_sent >= total_eligible:
            update_email.status = "completed"
            db.commit()
            print(f"[UPDATE_EMAIL] id={email_id} completed after this batch")

    except Exception as exc:
        print(f"[UPDATE_EMAIL] id={email_id} scheduler error: {exc}")
        db.rollback()
    finally:
        db.close()


async def _periodic_update_email_sender():
    """Check hourly whether it's time to send the daily batch for each active update email."""
    # Tracks the last date each email's batch ran. On restart this resets, but
    # _run_update_email_batch excludes already-sent users via update_email_sends,
    # so a spurious re-fire just finds remaining_users empty and exits safely.
    last_run_dates: dict[int, object] = {}
    while True:
        try:
            now_utc = datetime.utcnow()
            today = now_utc.date()

            db = SessionLocal()
            try:
                active_emails = (
                    db.query(UpdateEmail)
                    .filter(UpdateEmail.status.in_(["scheduled", "running"]))
                    .order_by(UpdateEmail.created_at.asc())
                    .all()
                )
                active_ids = [
                    (e.id, e.send_hour if e.send_hour >= 0 else settings.UPDATE_EMAIL_SEND_HOUR)
                    for e in active_emails
                ]
            finally:
                db.close()

            for email_id, send_hour in active_ids:
                if now_utc.hour != send_hour:
                    continue
                if last_run_dates.get(email_id) == today:
                    continue
                # Survives restarts: check DB for any sends recorded today for this email
                today_midnight = datetime(today.year, today.month, today.day)
                db3 = SessionLocal()
                try:
                    already_ran_today = (
                        db3.query(UpdateEmailSend)
                        .filter(
                            UpdateEmailSend.update_email_id == email_id,
                            UpdateEmailSend.sent_at >= today_midnight,
                        )
                        .first()
                    )
                finally:
                    db3.close()
                if already_ran_today:
                    last_run_dates[email_id] = today  # sync in-memory state
                    continue
                last_run_dates[email_id] = today
                await _run_update_email_batch(email_id)

        except Exception as exc:
            print(f"[UPDATE_EMAIL] periodic check error: {exc}")
        finally:
            await asyncio.sleep(3600)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: init DB and start background tasks."""
    free_cleanup = None
    paid_cleanup = None
    support_cleanup = None
    monthly_reset = None

    # Raise the open-file-descriptor soft limit toward the hard limit. Headless
    # Chrome + node subprocesses (Remotion) plus HTTP connection pools can blow
    # through the default soft limit (often 1024). Done in-process so it applies
    # regardless of how the container is launched. Best-effort.
    try:
        import resource
        soft, hard = resource.getrlimit(resource.RLIMIT_NOFILE)
        target = min(65536, hard) if hard != resource.RLIM_INFINITY else 65536
        if soft < target:
            resource.setrlimit(resource.RLIMIT_NOFILE, (target, hard))
        new_soft, _ = resource.getrlimit(resource.RLIMIT_NOFILE)
    except Exception as e:
        print(f"[STARTUP] Could not raise RLIMIT_NOFILE: {e}")

    try:
        print("[STARTUP] Initializing database...")
        init_db()
        print("[STARTUP] Database initialized successfully")
        _ensure_prebuilt_voices_seeded()
        # Recover background jobs orphaned by a previous crash/restart: roll them back
        # so projects aren't stuck "busy" forever and the reserved credit is refunded.
        # With --workers 1, any active job at boot is orphaned (its process is gone).
        # Best-effort.
        try:
            from app.routers.projects import (
                recover_orphaned_regenerate_script_jobs,
                reap_orphaned_template_change_jobs,
                reap_orphaned_voice_change_jobs,
                reap_orphaned_language_change_jobs,
            )
            recover_orphaned_regenerate_script_jobs()
            reap_orphaned_template_change_jobs()
            reap_orphaned_voice_change_jobs()
            reap_orphaned_language_change_jobs()
        except Exception as e:
            print(f"[STARTUP] Orphaned-job recovery failed: {e}")
    except Exception as e:
        print(f"[STARTUP] Database initialization failed: {e}")
        import traceback
        traceback.print_exc()
        raise

    update_email_sender = None
    elevenlabs_quota_check = None
    try:
        free_cleanup = asyncio.create_task(_periodic_free_tier_cleanup())
        paid_cleanup = asyncio.create_task(_periodic_paid_tier_cleanup())
        monthly_reset = asyncio.create_task(_periodic_monthly_allotment_reset())
        update_email_sender = asyncio.create_task(_periodic_update_email_sender())
        elevenlabs_quota_check = asyncio.create_task(_periodic_elevenlabs_quota_check())
        from app.support.cleanup import periodic_support_cleanup
        support_cleanup = asyncio.create_task(periodic_support_cleanup())
        # Pre-load corpus + UI catalog so first request is fast and config errors fail loudly at boot.
        try:
            from app.support.corpus_loader import load_corpus
            from app.support.ui_catalog import load_catalog
            load_corpus()
            load_catalog()
        except Exception as e:
            print(f"[STARTUP] Support bot warm-up failed: {e}")
        print("[STARTUP] Background tasks started")
    except Exception as e:
        print(f"[STARTUP] Failed to start background tasks: {e}")
        import traceback
        traceback.print_exc()

    # Start the MCP Streamable HTTP session manager — claude.ai POSTs JSON-RPC
    # to /mcp/sse and the session manager handles connection lifecycle.
    from app.routers.mcp_transport import streamable_session_manager
    async with streamable_session_manager.run():
        yield

    try:
        if free_cleanup:
            free_cleanup.cancel()
        if paid_cleanup:
            paid_cleanup.cancel()
        if monthly_reset:
            monthly_reset.cancel()
        if update_email_sender:
            update_email_sender.cancel()
        if elevenlabs_quota_check:
            elevenlabs_quota_check.cancel()
        if support_cleanup:
            support_cleanup.cancel()
    except Exception:
        pass


# ─── App ──────────────────────────────────────────────────────

app = FastAPI(
    title="Blog2Video API",
    description="Convert blog posts into explainer videos using AI",
    version="0.2.0",
    lifespan=lifespan,
)

# Configure logging + tracing at import time (before the app starts serving)
try:
    configure_logging()
    init_tracing(app)
except Exception as e:
    print(f"[STARTUP] Observability init failed: {e}")

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
    "https://blog2video.pages.dev",
    "https://blog2video-prod-frontend.pages.dev",
    # MCP — Claude clients
    "https://claude.ai",
    "https://app.anthropic.com",
    # MCP — Inspector (local dev)
    "http://localhost:6274",
    "http://127.0.0.1:6274",
    # MCP — ChatGPT
    "https://chatgpt.com",
    "https://chat.openai.com",
]
for origin in _always_allowed:
    if origin not in _origins:
        _origins.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    # Vercel previews + subdomains + HF Spaces + Anthropic subdomains (for MCP)
    allow_origin_regex=r"https://(blog2video.*\.vercel\.app|.*\.blog2video\.app|.*\.hf\.space|.*\.anthropic\.com|.*\.claude\.ai)",
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
# Collaboration routes are registered before projects so the more specific
# /api/projects/{id}/members and /api/projects/{id}/history|finalise|... paths
# are matched ahead of the projects catch-all.
app.include_router(collaboration.router)
app.include_router(collaboration.accept_router)
app.include_router(collab_history.router)
app.include_router(collab_ws.router)
app.include_router(projects.router)
app.include_router(pipeline.router)
app.include_router(chat.router)
app.include_router(contact.router)
app.include_router(custom_templates.router)
app.include_router(crafted_templates.router)
app.include_router(project_shared_assets.router)
app.include_router(free_templates.router)
app.include_router(saved_voices.router)
app.include_router(voice.router)
app.include_router(template_studio.router)
app.include_router(background_music.router)
app.include_router(embed.router)
app.include_router(unsubscribe.router)
app.include_router(affiliate.router)
app.include_router(stock_data.router)
app.include_router(support.router)
# Hosted MCP server: OAuth 2.1 + SSE transport
app.include_router(mcp_oauth.router)
# Root-level OAuth discovery endpoints (RFC 8414 + RFC 9728 require these to
# live at the host root, not under /mcp). Must be included BEFORE the /mcp
# mount below so the routes aren't shadowed.
app.include_router(mcp_oauth.root_router)
# Mount a single Starlette sub-app at /mcp that bundles:
#   - The SDK's OAuth routes (/authorize, /token, /register)
#   - Raw ASGI handlers for /sse (GET, opens SSE stream) and /messages/ (POST)
# Using raw ASGI handlers lets the MCP SDK write its own responses without
# FastAPI trying to write a second one on top. The OAuth-router FastAPI
# routes (/mcp/.well-known/oauth-authorization-server, /mcp/google-start,
# /mcp/google-callback) are matched first because include_router runs before
# the mount.
app.mount("/mcp", mcp_oauth.build_sdk_starlette_app(
    extra_routes=mcp_transport.starlette_routes(),
))


@app.get("/api/health")
def health_check():
    return {"status": "ok", "version": "0.2.0"}


@app.get("/api/config/public")
def public_config():
    """Return non-secret config needed by the frontend."""
    return {
        "google_client_id": settings.GOOGLE_CLIENT_ID,
        "stripe_publishable_key": settings.STRIPE_PUBLISHABLE_KEY,
        "survey_promo_code": settings.SURVEY_PROMO_CODE,
    }


@app.get("/api/templates")
def list_templates():
    """Return all built-in video templates. Genre-based filtering is applied client-side from each template's `genres` array."""
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
        api_key = elevenlabs_keys.get_voice_design_api_key()
        elevenlabs_keys.log_key_usage(api_key, "voice preview URL by key")
        client = ElevenLabs(api_key=api_key)
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
        api_key = elevenlabs_keys.get_voice_design_api_key()
        elevenlabs_keys.log_key_usage(api_key, "voices previews list")
        client = ElevenLabs(api_key=api_key)
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


@app.get("/api/voices/prebuilt")
def list_prebuilt_voices():
    """Return prebuilt voices from the database only (no ElevenLabs API call). Each voice includes plan: 'free' | 'paid'."""
    import json
    db = SessionLocal()
    try:
        rows = db.query(PrebuiltVoice).order_by(PrebuiltVoice.name).all()
        out = []
        for r in rows:
            try:
                labels = json.loads(r.labels) if r.labels else {}
            except (json.JSONDecodeError, TypeError):
                labels = {}
            out.append({
                "voice_id": r.voice_id,
                "name": r.name,
                "preview_url": r.preview_url,
                "labels": labels,
                "description": r.description or "",
                "plan": r.plan,
            })
        return {"voices": out, "has_more": False}
    finally:
        db.close()


@app.get("/api/voices")
def list_voices(show_legacy: bool = True, premade_only: bool = False):
    """Return voices. premade_only=True: from DB (prebuilt_voices). Otherwise: from ElevenLabs API."""
    import json
    from fastapi import HTTPException

    if premade_only:
        return list_prebuilt_voices()

    if not settings.ELEVENLABS_API_KEY:
        raise HTTPException(status_code=503, detail="ElevenLabs API key not configured")
    try:
        from elevenlabs import ElevenLabs
        api_key = elevenlabs_keys.get_voice_design_api_key()
        elevenlabs_keys.log_key_usage(api_key, "voices list")
        client = ElevenLabs(api_key=api_key)
        try:
            voices_response = client.voices.get_all(show_legacy=show_legacy)
        except TypeError:
            voices_response = client.voices.get_all()
        out = []
        for v in voices_response.voices:
            item = {
                "voice_id": getattr(v, "voice_id", None) or getattr(v, "id", None),
                "name": getattr(v, "name", None) or "",
                "preview_url": getattr(v, "preview_url", None),
                "labels": getattr(v, "labels", None) or {},
                "category": getattr(v, "category", None),
                "description": getattr(v, "description", None) or "",
            }
            if item["voice_id"]:
                out.append(item)
        return {"voices": out, "has_more": getattr(voices_response, "has_more", False)}
    except Exception as e:
        print(f"[VOICES] list voices failed: {e}")
        raise HTTPException(status_code=502, detail="Failed to fetch voices from ElevenLabs")


def _call_elevenlabs_voice_design(voice_description: str) -> dict:
    """Call ElevenLabs text-to-voice design API. Returns JSON with previews (audio_base_64, etc.)."""
    import requests as _req
    url = "https://api.elevenlabs.io/v1/text-to-voice/design"
    api_key = elevenlabs_keys.get_voice_design_api_key()
    elevenlabs_keys.log_key_usage(api_key, "voice design (preset/prompt)")
    headers = {"xi-api-key": api_key, "Content-Type": "application/json"}
    body = {
        "voice_description": voice_description,
        "auto_generate_text": True,
    }
    resp = _req.post(url, json=body, headers=headers, timeout=60)
    resp.raise_for_status()
    return resp.json()


@app.post("/api/voices/design-from-preset")
def design_voice_from_preset(body: dict):
    """Build a voice description from options (gender, age, persona, speed, accent) and return previews."""
    from fastapi import HTTPException

    if not settings.ELEVENLABS_API_KEY:
        raise HTTPException(status_code=503, detail="ElevenLabs API key not configured")

    gender = (body.get("gender") or "").strip()
    age = (body.get("age") or "").strip()
    persona = (body.get("persona") or "").strip()
    speed = (body.get("speed") or "").strip()
    accent = (body.get("accent") or "").strip()

    parts = []
    if gender:
        parts.append(f"A {gender} voice.")
    if age:
        parts.append(f"Voice age: {age}.")
    if persona:
        parts.append(f"Persona: {persona}.")
    if speed:
        parts.append(f"Speaking speed: {speed}.")
    if accent:
        parts.append(f"Accent of a person from country: {accent}.")

    description = " ".join(parts).strip() if parts else "A clear, neutral, professional voice."
    if len(description) < 20:
        description = "A clear, neutral, professional voice suitable for narration and explainers."
    if len(description) > 1000:
        description = description[:997] + "..."

    try:
        data = _call_elevenlabs_voice_design(description)
        return data
    except Exception as e:
        print(f"[VOICES] design-from-preset failed: {e}")
        raise HTTPException(status_code=502, detail="Voice design failed. Try a different description.")


@app.post("/api/voices/design-from-prompt")
def design_voice_from_prompt(body: dict):
    """Generate voice previews from a custom text description (20–1000 characters)."""
    from fastapi import HTTPException

    if not settings.ELEVENLABS_API_KEY:
        raise HTTPException(status_code=503, detail="ElevenLabs API key not configured")

    prompt = (body.get("prompt") or body.get("voice_description") or "").strip()
    if len(prompt) < 20:
        raise HTTPException(status_code=400, detail="Prompt must be at least 20 characters.")
    if len(prompt) > 1000:
        prompt = prompt[:1000]

    try:
        data = _call_elevenlabs_voice_design(prompt)
        return data
    except Exception as e:
        print(f"[VOICES] design-from-prompt failed: {e}")
        raise HTTPException(status_code=502, detail="Voice design failed. Try a different prompt.")


def _build_voice_preview_session():
    """Shared HTTP session for the voice-preview proxy.

    Created once and reused across requests so each preview does NOT open (and
    leak) a fresh connection pool. Previously a per-request Session was closed
    only inside the streaming generator's finally, so an early client disconnect
    leaked the socket and exhausted file descriptors under load.
    """
    import requests
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry

    session = requests.Session()
    retry = Retry(
        total=2,
        connect=2,
        read=2,
        status=2,
        backoff_factor=0.4,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset(["GET"]),
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


_voice_preview_session = _build_voice_preview_session()


@app.get("/api/voices/preview-audio")
async def get_voice_preview_audio(key: str):
    """Stream voice preview audio so playback can start as soon as first bytes arrive."""
    from fastapi.responses import RedirectResponse
    from fastapi.responses import StreamingResponse

    preview_url = _get_voice_preview_url_by_key(key)
    if not preview_url:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Voice preview not found")

    try:
        resp = _voice_preview_session.get(
            preview_url,
            timeout=(5, 20),
            stream=True,
            headers={"Accept": "audio/mpeg,audio/*;q=0.9,*/*;q=0.1"},
        )
        resp.raise_for_status()
        media_type = resp.headers.get("Content-Type", "audio/mpeg")

        def chunk_iter():
            # Starlette closes this generator (GeneratorExit) when the client
            # disconnects, so the finally runs and releases the socket even on
            # early abort. The shared session is intentionally NOT closed here.
            try:
                for chunk in resp.iter_content(chunk_size=16 * 1024):
                    if chunk:
                        yield chunk
            finally:
                resp.close()

        return StreamingResponse(
            chunk_iter(),
            media_type=media_type,
        )
    except Exception as e:
        print(f"[VOICES] preview-audio proxy failed for {key}: {e}")
        # Fallback: let browser fetch directly; useful when proxy-side TLS fails intermittently.
        return RedirectResponse(url=preview_url, status_code=307)
