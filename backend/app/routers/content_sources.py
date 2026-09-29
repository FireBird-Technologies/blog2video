"""Content-source integrations: Ghost, Beehiiv and WordPress.

Users connect an account with an API key, browse their posts (drafts and
paywalled posts included, which a scraper can never reach), and import one or
several as projects. Imported projects start already SCRAPED, so generation
proceeds as for any URL.

WordPress has two ways in: self-hosted sites connect with an application
password (POST /wordpress/connect), WordPress.com sites through an OAuth popup
(GET /wordpress/connect-url → /wordpress/callback). Both end as one
"wordpress" connection, told apart by ``auth_kind``.

Credentials live on SocialConnection rows (platform "ghost" / "beehiiv" / "wordpress"),
Fernet-encrypted via token_crypto exactly like the OAuth publishing grants, and
are never returned by any endpoint. These platforms are deliberately NOT in
social_oauth.SUPPORTED_PLATFORMS: they have no OAuth dance, and the publish
modal's connection list must not grow cards it can't drive.

Publishing back: Ghost goes through the shared publish queue
(routers/integrations.py → publish_queue._publish_ghost). Beehiiv's API cannot
edit posts, so it — and any other project — gets the newsletter snippet below.

Connecting is free on every plan; each imported post costs one video credit,
and multi-post imports follow the bulk-create quota rule.
"""
import hashlib
import os
import re
import secrets
import shutil
import tempfile
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models.project import Project
from app.models.social_connection import (
    PLATFORM_BEEHIIV,
    PLATFORM_GHOST,
    PLATFORM_WORDPRESS,
    STATUS_ACTIVE,
    STATUS_REVOKED,
    WP_AUTH_APP_PASSWORD,
    WP_AUTH_WPCOM_OAUTH,
    SocialConnection,
)
from app.models.user import PlanTier, User
from app.observability.logging import get_logger
from app.schemas.schemas import ProjectCreate
from app.services import (
    beehiiv_api,
    ghost_api,
    r2_storage,
    social_oauth,
    source_importer,
    token_crypto,
    wordpress_api,
)
from app.services.access import get_accessible_project
from app.services.project_cleanup import remove_failed_generation_project
from app.services.source_common import SourceError, normalize_site_url

logger = get_logger(__name__)

router = APIRouter(prefix="/api/sources", tags=["content-sources"])

SOURCE_PLATFORMS = (PLATFORM_GHOST, PLATFORM_BEEHIIV, PLATFORM_WORDPRESS)
SOURCE_LABELS = {PLATFORM_GHOST: "Ghost", PLATFORM_BEEHIIV: "Beehiiv", PLATFORM_WORDPRESS: "WordPress"}
MAX_IMPORT_POSTS = 20
# Ghost ids are 24-hex ObjectIds; Beehiiv ids look like "post_<uuid>". This is
# a shape check, not validation — it only keeps path segments path-safe.
_POST_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")

# SourceError.code → HTTP status. 401 is deliberately absent: the frontend's
# axios interceptor treats any 401 as "your session expired" and logs out.
_ERROR_STATUS = {
    "invalid_key": 409,
    "invalid_site": 400,
    "post_not_found": 404,
    "empty_post": 422,
    "rate_limited": 429,
    "upload_too_large": 413,
    "unsupported_editor": 422,
    "conflict": 409,
    # Beehiiv: the publication's plan can't write posts. Not 401 — the
    # frontend logs out on any 401.
    "plan_required": 402,
    "publication_not_found": 409,
    # WordPress
    "auth_header_stripped": 409,
    "app_passwords_disabled": 409,
    "permission_denied": 403,
    "blocked_by_firewall": 502,
    "storage_full": 413,
    "video_not_supported": 422,
}


# ─── Models ──────────────────────────────────────────────────────────────────


class SourcesConfig(BaseModel):
    # False when SOCIAL_TOKEN_ENC_KEY is unset: we refuse to store keys in
    # plaintext, so the UI hides connect forms instead of letting them 503.
    enabled: bool
    platforms: list[str]
    # False when the WordPress.com OAuth app isn't configured: the "Connect
    # with WordPress.com" button is disabled (self-hosted still works).
    wordpress_com_enabled: bool = False


class SourceConnectionOut(BaseModel):
    platform: str
    connected: bool
    status: str = STATUS_ACTIVE
    account_name: str | None = None
    account_avatar_url: str | None = None
    site_url: str | None = None
    publication_id: str | None = None
    # WordPress: "app_password" (self-hosted) or "wpcom_oauth" (WordPress.com),
    # and the WordPress username for self-hosted connections.
    auth_kind: str | None = None
    username: str | None = None
    connected_at: datetime | None = None


class ConnectRequest(BaseModel):
    # Ghost Admin API key / Beehiiv API key / WordPress application password.
    api_key: str = Field(min_length=1, max_length=500)
    site_url: str | None = Field(default=None, max_length=500)  # Ghost, WordPress
    publication_id: str | None = Field(default=None, max_length=128)  # Beehiiv only
    username: str | None = Field(default=None, max_length=200)  # WordPress only


class ImportRequest(ProjectCreate):
    post_ids: list[str] = Field(min_length=1, max_length=MAX_IMPORT_POSTS)
    # Set when the client splits one multi-post import (per-post settings) into
    # several single-post requests, so each project is still marked bulk.
    bulk: bool = False


class ImportFailure(BaseModel):
    post_id: str
    error_code: str
    message: str


class ImportResponse(BaseModel):
    project_ids: list[int]
    failed: list[ImportFailure] = Field(default_factory=list)


class NewsletterSnippetOut(BaseModel):
    html: str
    thumbnail_url: str
    watch_url: str


# ─── Helpers ─────────────────────────────────────────────────────────────────


def _validate_platform(platform: str) -> str:
    if platform not in SOURCE_PLATFORMS:
        raise HTTPException(status_code=404, detail="Unknown content source")
    return platform


def _source_http_error(exc: SourceError) -> HTTPException:
    return HTTPException(
        status_code=_ERROR_STATUS.get(exc.code, 502),
        detail={"error_code": exc.code, "message": str(exc)},
    )


def _get_connection(db: Session, user_id: int, platform: str) -> SocialConnection | None:
    return (
        db.query(SocialConnection)
        .filter(SocialConnection.user_id == user_id, SocialConnection.platform == platform)
        .first()
    )


def _require_connection(db: Session, user: User, platform: str) -> SocialConnection:
    conn = _get_connection(db, user.id, platform)
    if conn is None or conn.status != STATUS_ACTIVE:
        label = SOURCE_LABELS.get(platform, platform)
        raise HTTPException(
            status_code=409,
            detail={
                "error_code": "not_connected",
                "message": f"Connect your {label} account first.",
            },
        )
    return conn


def _mark_revoked_on_bad_key(db: Session, conn: SocialConnection, exc: SourceError) -> None:
    """A key the provider rejects won't start working again: flag it so the UI
    shows "Reconnect" instead of failing every subsequent list/import."""
    if exc.code in ("invalid_key", "auth_header_stripped", "app_passwords_disabled"):
        conn.status = STATUS_REVOKED
        conn.last_error = str(exc)[:500]
        db.commit()


def _connection_out(conn: SocialConnection | None, platform: str) -> SourceConnectionOut:
    if conn is None:
        return SourceConnectionOut(platform=platform, connected=False)
    return SourceConnectionOut(
        platform=platform,
        connected=True,
        status=conn.status,
        account_name=conn.account_name,
        account_avatar_url=conn.account_avatar_url,
        site_url=conn.site_url,
        publication_id=conn.account_id if platform == PLATFORM_BEEHIIV else None,
        auth_kind=conn.auth_kind if platform == PLATFORM_WORDPRESS else None,
        username=(
            conn.account_handle
            if platform == PLATFORM_WORDPRESS and conn.auth_kind == WP_AUTH_APP_PASSWORD
            else None
        ),
        connected_at=conn.updated_at or conn.created_at,
    )


def _upsert_connection(
    db: Session, user: User, platform: str, *, api_key: str, **fields
) -> SocialConnection:
    try:
        enc = token_crypto.encrypt(api_key)
    except token_crypto.TokenCryptoError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    conn = _get_connection(db, user.id, platform)
    if conn is None:
        conn = SocialConnection(user_id=user.id, platform=platform)
        db.add(conn)
    conn.access_token_enc = enc
    conn.refresh_token_enc = None
    conn.token_expires_at = None
    conn.scopes = None
    conn.status = STATUS_ACTIVE
    conn.last_error = None
    for key, value in fields.items():
        setattr(conn, key, value)
    db.commit()
    db.refresh(conn)
    return conn


# ─── Capability + connections ────────────────────────────────────────────────


@router.get("/config", response_model=SourcesConfig)
def get_sources_config():
    return SourcesConfig(
        enabled=token_crypto.is_configured(),
        platforms=list(SOURCE_PLATFORMS),
        wordpress_com_enabled=token_crypto.is_configured() and wordpress_api.wpcom_enabled(),
    )


@router.get("/connections")
def list_source_connections(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = {
        c.platform: c
        for c in db.query(SocialConnection)
        .filter(
            SocialConnection.user_id == user.id,
            SocialConnection.platform.in_(SOURCE_PLATFORMS),
        )
        .all()
    }
    return {"connections": [_connection_out(rows.get(p), p) for p in SOURCE_PLATFORMS]}


@router.post("/{platform}/connect")
def connect_source(
    platform: str,
    body: ConnectRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Validate a key against the provider and store it (encrypted).

    Beehiiv keys are workspace-wide: when the workspace has several
    publications and none was chosen, nothing is stored and the list comes
    back as ``needs_publication`` for the user to pick from.
    """
    _validate_platform(platform)
    if not token_crypto.is_configured():
        raise HTTPException(
            status_code=503, detail="Integrations are not available on this server."
        )
    api_key = body.api_key.strip()

    try:
        if platform == PLATFORM_GHOST:
            site_url = normalize_site_url(body.site_url or "")
            creds = ghost_api.GhostCredentials(site_url=site_url, admin_key=api_key)
            ghost_api.parse_admin_key(api_key)
            site = ghost_api.get_site(creds)
            conn = _upsert_connection(
                db, user, platform, api_key=api_key,
                site_url=site_url,
                account_id=None,
                account_handle=site_url.split("://", 1)[-1],
                account_name=site["title"],
                account_avatar_url=site.get("icon"),
            )
        elif platform == PLATFORM_WORDPRESS:
            conn, caps = _connect_wordpress(db, user, body)
            logger.info(
                "[SOURCES] User %s connected self-hosted WordPress (%s)",
                user.id, conn.account_name, extra={"user_id": user.id},
            )
            return {"connection": _connection_out(conn, platform), "capabilities": caps}
        else:
            publications = beehiiv_api.list_publications(api_key)
            if not publications:
                raise SourceError(
                    "That Beehiiv key can't see any publications.", code="invalid_key"
                )
            chosen = None
            if body.publication_id:
                chosen = next((p for p in publications if p["id"] == body.publication_id), None)
                if chosen is None:
                    raise HTTPException(status_code=400, detail="Unknown publication.")
            elif len(publications) == 1:
                chosen = publications[0]
            else:
                return {"needs_publication": publications}
            conn = _upsert_connection(
                db, user, platform, api_key=api_key,
                site_url=None,
                account_id=chosen["id"],
                account_handle=None,
                account_name=chosen["name"],
                account_avatar_url=None,
            )
    except SourceError as exc:
        raise _source_http_error(exc)

    logger.info(
        "[SOURCES] User %s connected %s (%s)", user.id, platform, conn.account_name,
        extra={"user_id": user.id},
    )
    return {"connection": _connection_out(conn, platform)}


def _connect_wordpress(db: Session, user: User, body: ConnectRequest):
    """Self-hosted WordPress: find the REST root, prove the application
    password, check the role can at least write drafts, then store it."""
    site_url = normalize_site_url(body.site_url or "", provider="WordPress")
    host = (site_url.split("://", 1)[-1].split("/", 1)[0]).lower()
    # WordPress.com sites on paid plans with hosting features activated offer
    # site application passwords, so a *.wordpress.com address is tried like
    # any site. Free sites (or hosting features off) don't: then point to the
    # OAuth button instead of a self-hosted fix that doesn't apply.
    on_wpcom = host == "wordpress.com" or host.endswith(".wordpress.com")
    wpcom_hint = SourceError(
        "This site can't use application passwords. Use \"Connect with WordPress.com\" instead.",
        code="app_passwords_disabled",
    )
    username = (body.username or "").strip()
    if not username:
        raise SourceError("Enter your WordPress username.", code="invalid_key")
    password = wordpress_api.clean_app_password(body.api_key)
    if len(password) < 8:
        raise SourceError(
            "That doesn't look like an application password.",
            code="invalid_key",
        )

    try:
        site = wordpress_api.discover_site(site_url)
    except SourceError as exc:
        if on_wpcom and exc.code in ("invalid_site", "blocked_by_firewall"):
            raise wpcom_hint
        raise
    if not site["app_passwords"]:
        if on_wpcom:
            raise wpcom_hint
        raise SourceError(
            "Application passwords are turned off on this site.",
            code="app_passwords_disabled",
        )
    creds = wordpress_api.WordPressCredentials(
        auth_kind=WP_AUTH_APP_PASSWORD,
        api_root=site["api_root"],
        site_url=site["site_url"],
        secret=f"{username}:{password}",
    )
    try:
        me = wordpress_api.get_me(creds)
    except SourceError as exc:
        # A WordPress.com site without site application passwords answers Basic
        # auth with "not logged in", which would otherwise read as a host issue.
        if on_wpcom and exc.code == "auth_header_stripped":
            raise wpcom_hint
        raise
    if not (me.get("capabilities") or {}).get("edit_posts"):
        raise SourceError(
            "This account can't write posts. Use an account with more access.",
            code="permission_denied",
        )
    caps = wordpress_api.capabilities(creds)
    conn = _upsert_connection(
        db, user, PLATFORM_WORDPRESS, api_key=creds.secret,
        auth_kind=WP_AUTH_APP_PASSWORD,
        api_root=site["api_root"],
        site_url=site["site_url"],
        account_id=None,
        account_handle=me.get("username") or username,
        account_name=site["name"],
        account_avatar_url=site.get("icon"),
    )
    return conn, caps


# ─── WordPress.com OAuth ─────────────────────────────────────────────────────


@router.get("/wordpress/connect-url")
def wordpress_com_connect_url(user: User = Depends(get_current_user)):
    """The WordPress.com consent URL. Its site picker chooses the one site the
    token is for; the popup lands on /wordpress/callback."""
    if not token_crypto.is_configured() or not wordpress_api.wpcom_enabled():
        raise HTTPException(
            status_code=503, detail="WordPress.com connection isn't available right now."
        )
    state = social_oauth.build_state(user.id, PLATFORM_WORDPRESS)
    return {"authorize_url": wordpress_api.wpcom_authorize_url(state)}


@router.get("/wordpress/callback", response_class=HTMLResponse)
def wordpress_com_callback(
    code: str | None = Query(None),
    state: str | None = Query(None),
    error: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """WordPress.com redirect target. Always renders the self-closing popup page."""
    def popup(ok: bool, *, name: str | None = None, err: str | None = None) -> HTMLResponse:
        return HTMLResponse(
            social_oauth.popup_result_html(PLATFORM_WORDPRESS, ok=ok, account_name=name, error=err)
        )

    if error:
        return popup(False, err=(
            "You cancelled the connection." if error == "access_denied"
            else "WordPress.com couldn't connect. Please try again."
        ))
    try:
        payload = social_oauth.parse_state(state, PLATFORM_WORDPRESS)
    except social_oauth.OAuthStateError as exc:
        return popup(False, err=str(exc))
    if not code:
        return popup(False, err="WordPress.com couldn't connect. Please try again.")
    if not token_crypto.is_configured() or not wordpress_api.wpcom_enabled():
        return popup(False, err="WordPress.com connection isn't available right now.")

    user = db.query(User).filter(User.id == int(payload["uid"]), User.is_active == True).first()  # noqa: E712
    if not user:
        return popup(False, err="Your account is no longer active.")

    try:
        tokens = wordpress_api.exchange_wpcom_code(code)
        logger.info(
            "[SOURCES] WordPress.com token for user %s: blog_id=%r blog_url=%r scope=%r",
            user.id, tokens.get("blog_id"), tokens.get("blog_url"), tokens.get("scope"),
        )
        site = wordpress_api.resolve_wpcom_site(
            tokens["access_token"], tokens.get("blog_id"), tokens.get("blog_url")
        )
        blog_id = str(site["ID"])
        creds = wordpress_api.WordPressCredentials(
            auth_kind=WP_AUTH_WPCOM_OAUTH,
            api_root=wordpress_api.wpcom_api_root(blog_id),
            site_url=str(site.get("URL") or tokens.get("blog_url") or "").rstrip("/"),
            secret=tokens["access_token"],
            blog_id=blog_id,
        )
    except SourceError as exc:
        logger.warning("[SOURCES] WordPress.com connect failed for user %s: %s", user.id, exc)
        return popup(False, err=str(exc))
    except Exception:
        logger.exception("[SOURCES] Unexpected WordPress.com connect failure for user %s", user.id)
        return popup(False, err="Something went wrong connecting WordPress.com.")

    site_url = str(site.get("URL") or creds.site_url or "").rstrip("/")
    name = str(site.get("name") or "") or site_url.split("://", 1)[-1]
    icon = (site.get("icon") or {}).get("img") if isinstance(site.get("icon"), dict) else None
    conn = _upsert_connection(
        db, user, PLATFORM_WORDPRESS, api_key=creds.secret,
        auth_kind=WP_AUTH_WPCOM_OAUTH,
        api_root=creds.api_root,
        site_url=site_url,
        account_id=blog_id,
        account_handle=None,
        account_name=name,
        account_avatar_url=icon,
    )
    logger.info(
        "[SOURCES] User %s connected WordPress.com site %s", user.id, blog_id,
        extra={"user_id": user.id},
    )
    return popup(True, name=conn.account_name)


@router.delete("/{platform}")
def disconnect_source(
    platform: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Forget the key on our side only. Nothing is revoked on the provider: a
    WordPress application password stays on the site, so the user can reuse
    it (or delete it there themselves). Imported projects keep their content;
    past publish jobs keep their history (connection_id is SET NULL)."""
    _validate_platform(platform)
    conn = _get_connection(db, user.id, platform)
    if conn is not None:
        db.delete(conn)
        db.commit()
    return {"ok": True}


# ─── Posts ───────────────────────────────────────────────────────────────────


@router.get("/{platform}/posts")
def list_source_posts(
    platform: str,
    page: int = Query(1, ge=1, le=1000),
    search: str | None = Query(None, max_length=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _validate_platform(platform)
    conn = _require_connection(db, user, platform)
    try:
        if platform == PLATFORM_GHOST:
            return ghost_api.list_posts(
                source_importer.ghost_credentials(conn), page=page, search=search
            )
        if platform == PLATFORM_WORDPRESS:
            return wordpress_api.list_posts(
                source_importer.wordpress_credentials(conn), page=page, search=search
            )
        return beehiiv_api.list_posts(
            source_importer.beehiiv_key(conn), conn.account_id or "", page=page, search=search
        )
    except SourceError as exc:
        _mark_revoked_on_bad_key(db, conn, exc)
        raise _source_http_error(exc)


class PublishCheck(BaseModel):
    """How a publish to Ghost/WordPress/Beehiiv should put the video into the post."""
    # "video": upload the MP4. "embed": our player in an HTML block. "link": a
    # click-to-watch thumbnail. "ask": the video is over a known upload cap —
    # offer ``fallback`` before publishing.
    recommended: str
    fallback: str
    # The site's per-file upload cap in bytes; null when unknown.
    limit_bytes: int | None = None
    # The rendered MP4's size; null when the project isn't rendered yet.
    video_bytes: int | None = None
    # Why the video can't be uploaded, in user terms (WordPress plan/role).
    reason: str | None = None
    # Beehiiv: the plan can't write posts at all (only Max/Enterprise can), so
    # publishing is off and the newsletter snippet is the way in.
    plan_required: bool = False


@router.get("/{platform}/publish-check", response_model=PublishCheck)
def publish_check(
    platform: str,
    project_id: int = Query(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Before publishing: upload the MP4, embed the player, or add a thumbnail?

    Never fails on the provider side — an unreadable site just means "video",
    and the publish itself reports a bad key.
    """
    if platform not in (PLATFORM_GHOST, PLATFORM_WORDPRESS, PLATFORM_BEEHIIV):
        raise HTTPException(status_code=404, detail="Unknown content source")
    project = get_accessible_project(project_id, user, db, required_role="owner")
    conn = _require_connection(db, user, platform)

    if platform == PLATFORM_BEEHIIV:
        # Always a thumbnail; the only question is whether the plan may write.
        # Unlike Ghost/WordPress a failed check is reported: the publish would
        # hit the same bad key or outage.
        try:
            allowed = beehiiv_api.can_write_posts(source_importer.beehiiv_key(conn), conn.account_id or "")
        except SourceError as exc:
            _mark_revoked_on_bad_key(db, conn, exc)
            raise _source_http_error(exc)
        blocked = not allowed
        return PublishCheck(
            recommended="link", fallback="link",
            plan_required=blocked,
            reason=beehiiv_api.PLAN_REQUIRED_MESSAGE if blocked else None,
        )
    video_bytes = r2_storage.object_size(project.r2_video_key) if project.r2_video_key else None

    if platform == PLATFORM_WORDPRESS:
        try:
            caps = wordpress_api.capabilities(source_importer.wordpress_credentials(conn))
        except SourceError:
            return PublishCheck(recommended="video", fallback="link", video_bytes=video_bytes)
        recommended, fallback = wordpress_api.choose_delivery(caps, video_bytes)
        return PublishCheck(
            recommended=recommended, fallback=fallback,
            limit_bytes=caps.get("upload_limit_bytes"), video_bytes=video_bytes,
            reason=caps.get("reason") if recommended != "video" else None,
        )

    try:
        limit_bytes = ghost_api.get_upload_limit(source_importer.ghost_credentials(conn))
    except SourceError:
        limit_bytes = None
    if limit_bytes is not None and limit_bytes <= ghost_api.SMALL_PLAN_MAX:
        recommended = "embed"
    elif limit_bytes is not None and video_bytes is not None and video_bytes > limit_bytes:
        recommended = "ask"
    else:
        recommended = "video"
    return PublishCheck(
        recommended=recommended, fallback="embed",
        limit_bytes=limit_bytes, video_bytes=video_bytes,
    )


@router.post("/{platform}/import", response_model=ImportResponse)
def import_source_posts(
    platform: str,
    body: ImportRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create one project per selected post, already populated and SCRAPED.

    Each post is fetched and checked for readable content BEFORE its project
    is created, so an empty or deleted post costs no credit. With several posts
    the good ones still import; the rest come back in ``failed``. If every
    post fails the request fails with the first error.
    """
    # Imported lazily: routers.projects is large and imports this package's
    # siblings; a module-level import here would make the ordering fragile.
    from app.routers.projects import (
        _DUPLICATE_CREATE_WINDOW,
        _IN_FLIGHT_STATUSES,
        _build_project,
    )

    _validate_platform(platform)
    post_ids = list(dict.fromkeys(pid.strip() for pid in body.post_ids if pid.strip()))
    if not post_ids or any(not _POST_ID_RE.match(pid) for pid in post_ids):
        raise HTTPException(status_code=400, detail="Invalid post id.")

    # Idempotency, as in create_project: a client that timed out and retried
    # gets the in-flight project back instead of a second charge. Resolved
    # BEFORE the quota check so a retry by a user who just spent their last
    # credit on the original still succeeds.
    existing: dict[str, int] = {}
    for post_id in post_ids:
        duplicate = (
            db.query(Project.id)
            .filter(
                Project.user_id == user.id,
                Project.source_platform == platform,
                Project.source_post_id == post_id,
                Project.is_active.is_(True),
                Project.created_at >= datetime.utcnow() - _DUPLICATE_CREATE_WINDOW,
                Project.status.in_(_IN_FLIGHT_STATUSES),
            )
            .order_by(Project.id.desc())
            .first()
        )
        if duplicate is not None:
            existing[post_id] = duplicate.id

    user.roll_video_period_if_due(db)
    user.sync_video_limit_bonus(db)
    needed = len(post_ids) - len(existing)
    remaining = user.video_limit - user.videos_used_this_period
    # Same quota rule as POST /api/projects/bulk.
    if needed > 1 and user.plan == PlanTier.FREE and needed > max(1, remaining):
        raise HTTPException(
            status_code=403,
            detail={
                "code": "upgrade_required_bulk",
                "message": "That many videos at once exceeds your remaining free quota. "
                "Import fewer posts now, or upgrade for higher limits and bulk creation.",
            },
        )
    if needed and user.videos_used_this_period + needed > user.video_limit:
        raise HTTPException(
            status_code=403,
            detail="Sorry, your video limit has been reached. Please upgrade your plan or buy more credits.",
        )

    conn = _require_connection(db, user, platform)
    is_bulk = len(post_ids) > 1 or body.bulk
    project_ids: list[int] = []
    failed: list[ImportFailure] = []
    first_error: SourceError | None = None

    for post_id in post_ids:
        if post_id in existing:
            project_ids.append(existing[post_id])
            continue

        try:
            prepared = source_importer.prepare_post(conn, post_id)
        except SourceError as exc:
            _mark_revoked_on_bad_key(db, conn, exc)
            first_error = first_error or exc
            failed.append(ImportFailure(post_id=post_id, error_code=exc.code, message=str(exc)))
            if exc.code == "invalid_key":
                break  # every remaining post would fail the same way
            continue

        project = _build_project(
            body, user, db,
            name=(body.name or "").strip() or prepared.title[:255] or "Imported post",
            blog_url=prepared.blog_url(platform),
            is_bulk=is_bulk,
        )
        user.videos_used_this_period += 1
        db.commit()
        try:
            source_importer.apply_post(project, conn, prepared, db)
        except Exception:  # noqa: BLE001 — image download / DB hiccup
            logger.exception(
                "[SOURCES] Import of %s post %s failed after project %s was created",
                platform, post_id, project.id,
                extra={"project_id": project.id, "user_id": user.id},
            )
            db.rollback()
            # Soft-delete + refund, the same path a failed generation takes.
            remove_failed_generation_project(db, project)
            failed.append(ImportFailure(
                post_id=post_id, error_code="import_failed",
                message="Something went wrong importing this post.",
            ))
            continue
        project_ids.append(project.id)

    if not project_ids:
        if first_error is not None:
            raise _source_http_error(first_error)
        raise HTTPException(status_code=500, detail="Could not import the selected posts.")
    return ImportResponse(project_ids=project_ids, failed=failed)


# ─── Newsletter snippet ──────────────────────────────────────────────────────


def _frontend_url() -> str:
    raw = getattr(settings, "FRONTEND_URL", "") or ""
    return raw.split(",")[0].strip().rstrip("/") or "https://blog2video.app"


def newsletter_thumbnail_url(project, video_path: str, work_dir: str) -> str | None:
    """Poster frame with a play badge, hosted (R2, else local media). None if no frame.

    Shared by the newsletter snippet and the Beehiiv publisher, which puts the
    same image into a post as a click-to-watch image block.
    """
    from app.services import video_thumbnail

    frame = os.path.join(work_dir, "frame.jpg")
    badged = os.path.join(work_dir, "thumb.jpg")
    if not video_thumbnail.extract_frame(video_path, frame, at_seconds=1.0):
        return None
    video_thumbnail.add_play_badge(frame, badged)

    # Keyed by render so a re-render gets a fresh image instead of an
    # email-client-cached stale one.
    version = hashlib.sha1((project.r2_video_key or "local").encode()).hexdigest()[:12]
    filename = f"newsletter-{version}.jpg"
    thumbnail_url = ""
    if r2_storage.is_r2_configured():
        with open(badged, "rb") as fh:
            thumbnail_url = r2_storage.upload_bytes(
                r2_storage.image_key(project.user_id, project.id, filename),
                fh.read(), content_type="image/jpeg",
            )
    if not thumbnail_url:
        out_dir = os.path.join(settings.MEDIA_DIR, f"projects/{project.id}/output")
        os.makedirs(out_dir, exist_ok=True)
        shutil.copyfile(badged, os.path.join(out_dir, filename))
        thumbnail_url = (
            f"{settings.BACKEND_URL.rstrip('/')}/media/projects/{project.id}/output/{filename}"
        )
    return thumbnail_url


def watch_page_url(db: Session, project) -> str:
    """Public watch page for the project, minting its embed token if needed."""
    if not project.embed_token:
        project.embed_token = secrets.token_hex(32)
        db.commit()
    return f"{_frontend_url()}/preview/{project.embed_token}"


@router.get("/projects/{project_id}/newsletter-snippet", response_model=NewsletterSnippetOut)
def newsletter_snippet(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Email-safe HTML that shows the video in a newsletter.

    Email clients can't play video, so this is the standard pattern: a poster
    frame with a play badge, linked to the hosted watch page. Works in the
    Beehiiv editor (its API can't insert it for us), Ghost newsletters,
    Substack, Mailchimp — anywhere that accepts HTML or an image with a link.
    Owner-only because it mints the public embed token.
    """
    from app.services.youtube_publish import PublishError, resolve_local_video

    project = get_accessible_project(project_id, user, db, required_role="owner")

    work_dir = tempfile.mkdtemp(prefix=f"snippet_{project_id}_")
    try:
        try:
            video_path, _ = resolve_local_video(project.id, project.r2_video_key, work_dir)
        except PublishError:
            raise HTTPException(
                status_code=409,
                detail={"error_code": "video_missing", "message": "Render the video first."},
            )
        thumbnail_url = newsletter_thumbnail_url(project, video_path, work_dir)
        if not thumbnail_url:
            raise HTTPException(status_code=500, detail="Could not create a thumbnail.")
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)

    watch_url = watch_page_url(db, project)

    from html import escape
    title = escape(project.name or "Watch the video")
    html = (
        f'<a href="{escape(watch_url)}" target="_blank" '
        f'style="display:block;text-decoration:none;">'
        f'<img src="{escape(thumbnail_url)}" alt="{title} (video)" width="600" '
        f'style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:8px;" />'
        f"</a>"
        f'<p style="margin:8px 0 0;font-size:14px;">'
        f'<a href="{escape(watch_url)}" target="_blank">▶ Watch the video: {title}</a></p>'
    )
    return NewsletterSnippetOut(html=html, thumbnail_url=thumbnail_url, watch_url=watch_url)
