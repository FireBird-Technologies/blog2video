"""Social publishing account connections (YouTube, X, LinkedIn).

Owns the OAuth dance and the connection records. The uploads themselves live in
services/youtube_publish.py, services/x_publish.py and
services/linkedin_publish.py; the queue that runs them is
services/publish_queue.py.

The callback endpoint is intentionally unauthenticated: the provider redirects
the user's browser here with no Authorization header. Its authenticity comes
from the signed ``state`` (services/social_oauth.py), which names the user who
started the flow.
"""
import json
import logging
import re
from datetime import datetime, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models.social_connection import (
    PLATFORM_LINKEDIN,
    PLATFORM_X,
    PLATFORM_YOUTUBE,
    STATUS_ACTIVE,
    SocialConnection,
)
from app.models.social_publish_job import (
    ACTIVE_STATUSES,
    SOURCE_EXISTING,
    SOURCE_RERENDER,
    STATUS_CANCELLED,
    STATUS_PENDING_RENDER,
    STATUS_QUEUED,
    SocialPublishJob,
)
from app.models.user import PAID_TIERS, User
from app.services import publish_queue, social_oauth, token_crypto
from app.services.access import get_accessible_project

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/integrations", tags=["integrations"])

HTTP_TIMEOUT = httpx.Timeout(20.0)


# ─── Response models ─────────────────────────────────────────────────────────


class IntegrationsConfig(BaseModel):
    youtube_enabled: bool
    x_enabled: bool
    linkedin_enabled: bool


class ConnectionOut(BaseModel):
    platform: str
    connected: bool
    account_name: str | None = None
    account_handle: str | None = None
    account_avatar_url: str | None = None
    status: str = STATUS_ACTIVE
    # False when the stored grant is missing a scope we need (the user unticked
    # a box, or the required scopes changed since they connected). Surfaced so
    # the UI can ask for a reconnect BEFORE they fill in a whole upload form.
    scopes_ok: bool = True
    # When the ACCESS token dies. Only meaningful for a connection we cannot
    # refresh on the user's behalf — hence expires_soon below.
    expires_at: datetime | None = None
    # True when this grant will expire shortly AND we have no refresh token to
    # renew it with. LinkedIn is the case that matters: 60-day tokens with
    # partner-gated refresh, so most connections simply run out. YouTube and X
    # refresh silently and must never nag.
    expires_soon: bool = False


class ConnectUrlOut(BaseModel):
    authorize_url: str


class PublishRequest(BaseModel):
    platform: str
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    tags: list[str] = Field(default_factory=list)
    privacy_status: str = "private"
    made_for_kids: bool = False
    category_id: str | None = None
    # "existing" publishes the MP4 already in R2; "rerender" re-renders first;
    # "auto" picks: existing when there is one, otherwise render.
    source: str = "auto"
    resolution: str = "1080p"


class PublishJobOut(BaseModel):
    id: int
    platform: str
    status: str
    progress: float
    uploaded_bytes: int
    total_bytes: int
    title: str
    # Echoed back so a re-upload can prefill the form from the last attempt
    # instead of making the user retype everything.
    description: str | None = None
    tags: list[str] = Field(default_factory=list)
    privacy_status: str
    source: str
    post_id: str | None = None
    post_url: str | None = None
    forced_private: bool = False
    error_code: str | None = None
    error_message: str | None = None
    retryable: bool = True
    created_at: datetime | None = None
    completed_at: datetime | None = None


def _job_tags(job: SocialPublishJob) -> list[str]:
    """Stored as a JSON array string; tolerate anything unparseable."""
    if not job.tags:
        return []
    try:
        parsed = json.loads(job.tags)
    except (ValueError, TypeError):
        return []
    return [str(t) for t in parsed] if isinstance(parsed, list) else []


def _job_out(job: SocialPublishJob) -> PublishJobOut:
    return PublishJobOut(
        id=job.id,
        platform=job.platform,
        status=job.status,
        progress=job.progress,
        uploaded_bytes=job.uploaded_bytes or 0,
        total_bytes=job.total_bytes or 0,
        title=job.title,
        description=job.description,
        tags=_job_tags(job),
        privacy_status=job.privacy_status,
        source=job.source,
        post_id=job.platform_post_id,
        post_url=job.platform_post_url,
        forced_private=bool(job.forced_private),
        error_code=job.error_code,
        error_message=job.error_message,
        retryable=bool(job.retryable),
        created_at=job.created_at,
        completed_at=job.completed_at,
    )


def _connection_out(conn: SocialConnection | None, platform: str) -> ConnectionOut:
    if conn is None:
        return ConnectionOut(platform=platform, connected=False, status="disconnected")
    return ConnectionOut(
        platform=conn.platform,
        # A revoked/errored row is a record, not a usable credential.
        connected=conn.status == STATUS_ACTIVE,
        account_name=conn.account_name,
        account_handle=conn.account_handle,
        account_avatar_url=conn.account_avatar_url,
        status=conn.status,
        scopes_ok=_scopes_ok(conn),
        expires_at=conn.token_expires_at,
        expires_soon=_expires_soon(conn),
    )


# A week is long enough that the nudge is actionable rather than an emergency,
# and short enough that it is not permanently on screen for a 60-day token.
EXPIRY_WARNING_DAYS = 7


def _expires_soon(conn: SocialConnection) -> bool:
    """Whether to nudge the user to reconnect before their next upload fails.

    Gated on having no refresh token: a connection we can renew ourselves is not
    the user's problem, so YouTube and X never trip this. LinkedIn issues refresh
    tokens only to approved partners, so for most deployments every LinkedIn
    connection eventually lands here.
    """
    if conn.status != STATUS_ACTIVE or not conn.token_expires_at:
        return False
    if conn.refresh_token_enc:
        return False
    return conn.token_expires_at < datetime.utcnow() + timedelta(
        days=EXPIRY_WARNING_DAYS
    )


def _scopes_ok(conn: SocialConnection) -> bool:
    # Split on commas as well as whitespace: RFC 6749 specifies a space-delimited
    # `scope`, and Google and X follow it, but LinkedIn returns its granted scopes
    # comma-delimited ("openid,profile,w_member_social"). Splitting on whitespace
    # alone left that as one unsplit blob, so the `w_member_social` check below
    # missed and every LinkedIn connection looked like it was missing the upload
    # permission — which reconnecting could not fix.
    granted = {s for s in re.split(r"[,\s]+", conn.scopes or "") if s}
    if not granted:
        # Provider did not report scopes; assume the grant is what we asked for
        # rather than nagging the user about something we cannot verify.
        return True
    if conn.platform == PLATFORM_YOUTUBE:
        return "https://www.googleapis.com/auth/youtube.upload" in granted
    if conn.platform == PLATFORM_X:
        return {"tweet.write", "media.write"} <= granted
    if conn.platform == PLATFORM_LINKEDIN:
        # w_member_social is the only load-bearing one — openid/profile just give
        # us the display name, and a grant without them still publishes fine.
        return "w_member_social" in granted
    return True


def _get_connection(db: Session, user_id: int, platform: str) -> SocialConnection | None:
    return (
        db.query(SocialConnection)
        .filter(
            SocialConnection.user_id == user_id,
            SocialConnection.platform == platform,
        )
        .first()
    )


def _validate_platform(platform: str) -> str:
    if platform not in social_oauth.SUPPORTED_PLATFORMS:
        raise HTTPException(status_code=404, detail="Unknown platform")
    return platform


# Publishing to these requires a paid plan. The frontend also hides the flow
# behind an upgrade modal, but that gate is only cosmetic — a free user can post
# to /publish directly, so the plan is enforced here too.
PAID_ONLY_PUBLISH_PLATFORMS: frozenset[str] = frozenset({"youtube", "linkedin"})


# Postgres raises ProgrammingError for an unknown relation, SQLite
# OperationalError. Both are DatabaseError, but catching that would also swallow
# a real outage — so match the two specific types AND the message, and re-raise
# anything else.
_MISSING_TABLE_ERRORS = (ProgrammingError, OperationalError)


def _is_missing_table(exc: Exception) -> bool:
    text = str(exc).lower()
    return "does not exist" in text or "no such table" in text


# ─── Capability + status ─────────────────────────────────────────────────────


@router.get("/config", response_model=IntegrationsConfig)
def get_integrations_config():
    """What this server can offer. Drives whether the menu items render at all.

    Unauthenticated because it describes the deployment, not the user, and the
    frontend needs it before it can decide what to show.
    """
    return IntegrationsConfig(
        youtube_enabled=social_oauth.platform_enabled(PLATFORM_YOUTUBE),
        x_enabled=social_oauth.platform_enabled(PLATFORM_X),
        linkedin_enabled=social_oauth.platform_enabled(PLATFORM_LINKEDIN),
    )


@router.get("/connections")
def list_connections(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The caller's connections. Never returns tokens.

    Degrades to "nothing connected" if the table is missing (see publish_status
    for why that is preferable to a 500).
    """
    try:
        rows = {
            c.platform: c
            for c in db.query(SocialConnection)
            .filter(SocialConnection.user_id == user.id)
            .all()
        }
    except _MISSING_TABLE_ERRORS as exc:
        if not _is_missing_table(exc):
            raise
        db.rollback()
        logger.warning(
            "[INTEGRATIONS] social_connections is missing — has the "
            "add_social_publishing_tables migration been applied?"
        )
        rows = {}
    return {
        "connections": [
            _connection_out(rows.get(p), p) for p in social_oauth.SUPPORTED_PLATFORMS
        ]
    }


@router.get("/{platform}/connect-url", response_model=ConnectUrlOut)
def get_connect_url(
    platform: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Build the provider's consent URL for the frontend to open in a popup.

    Returning the URL rather than redirecting keeps the caller's bearer token in
    an Authorization header — a redirecting endpoint would need the JWT in the
    query string, where it would end up in history and referrer headers.
    """
    _validate_platform(platform)
    try:
        return ConnectUrlOut(
            authorize_url=social_oauth.build_authorize_url(platform, user.id)
        )
    except social_oauth.OAuthConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


# ─── Callback ────────────────────────────────────────────────────────────────


@router.get("/{platform}/callback", response_class=HTMLResponse)
async def oauth_callback(
    platform: str,
    code: str | None = Query(None),
    state: str | None = Query(None),
    error: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """Provider redirect target. Always renders HTML — never raises to the user.

    A raw HTTPException here would show a JSON blob in a popup with no way back,
    so every failure path returns the same self-closing page carrying an error
    for the opener to react to.
    """
    _validate_platform(platform)

    if error:
        # The ordinary case is the user pressing "Cancel" on the consent screen.
        friendly = (
            "You cancelled the connection."
            if error in ("access_denied", "user_cancelled_authorize")
            else f"The provider reported an error: {error}"
        )
        return HTMLResponse(
            social_oauth.popup_result_html(platform, ok=False, error=friendly)
        )

    try:
        social_oauth.assert_platform_enabled(platform)
        payload = social_oauth.parse_state(state, platform)
    except (social_oauth.OAuthConfigError, social_oauth.OAuthStateError) as exc:
        return HTMLResponse(
            social_oauth.popup_result_html(platform, ok=False, error=str(exc))
        )

    if not code:
        return HTMLResponse(
            social_oauth.popup_result_html(
                platform, ok=False, error="The provider did not return an authorization code."
            )
        )

    user_id = int(payload["uid"])
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()  # noqa: E712
    if not user:
        return HTMLResponse(
            social_oauth.popup_result_html(
                platform, ok=False, error="Your account is no longer active."
            )
        )

    try:
        if platform == PLATFORM_YOUTUBE:
            tokens = await _exchange_youtube_code(code)
            identity = await _fetch_youtube_identity(tokens["access_token"])
        elif platform == PLATFORM_X:
            tokens = await _exchange_x_code(code, payload.get("cv"))
            identity = await _fetch_x_identity(tokens["access_token"])
        elif platform == PLATFORM_LINKEDIN:
            tokens = await _exchange_linkedin_code(code)
            identity = await _fetch_linkedin_identity(tokens["access_token"])
        else:
            # Explicit rather than an else-means-X fall-through: a platform added
            # to SUPPORTED_PLATFORMS but not here should fail visibly, not quietly
            # exchange its code against the wrong provider.
            raise _ProviderError(f"Unsupported platform '{platform}'.")
    except _ProviderError as exc:
        logger.warning("[INTEGRATIONS] %s connect failed for user %s: %s", platform, user_id, exc)
        return HTMLResponse(
            social_oauth.popup_result_html(platform, ok=False, error=str(exc))
        )
    except Exception:
        logger.exception("[INTEGRATIONS] Unexpected %s connect failure for user %s", platform, user_id)
        return HTMLResponse(
            social_oauth.popup_result_html(
                platform, ok=False, error="Something went wrong connecting your account."
            )
        )

    refresh_token = tokens.get("refresh_token")
    try:
        access_enc = token_crypto.encrypt(tokens["access_token"])
        refresh_enc = token_crypto.encrypt(refresh_token)
    except token_crypto.TokenCryptoError as exc:
        logger.error("[INTEGRATIONS] Cannot encrypt %s tokens: %s", platform, exc)
        return HTMLResponse(
            social_oauth.popup_result_html(
                platform, ok=False, error="This server cannot securely store the connection."
            )
        )

    conn = _get_connection(db, user_id, platform)
    if conn is None:
        conn = SocialConnection(user_id=user_id, platform=platform)
        db.add(conn)

    conn.access_token_enc = access_enc
    # Keep the previous refresh token when the provider declines to send a new
    # one. Google omits it on repeat grants; overwriting with NULL would silently
    # turn a working connection into one that dies at the next access-token
    # expiry. X rotates instead, and always sends one.
    if refresh_enc:
        conn.refresh_token_enc = refresh_enc
    expires_in = tokens.get("expires_in")
    conn.token_expires_at = (
        datetime.utcnow() + timedelta(seconds=int(expires_in)) if expires_in else None
    )
    granted_scope = tokens.get("scope")
    if platform == PLATFORM_LINKEDIN and not granted_scope:
        # LinkedIn's token response routinely omits `scope`. Recording what we
        # asked for beats recording nothing: _scopes_ok reads an empty string as
        # "assume the grant is fine", which would mask a genuinely partial grant.
        granted_scope = social_oauth.LINKEDIN_SCOPES
    conn.scopes = granted_scope
    conn.account_id = identity.get("account_id")
    conn.account_handle = identity.get("account_handle")
    conn.account_name = identity.get("account_name")
    conn.account_avatar_url = identity.get("account_avatar_url")
    conn.status = STATUS_ACTIVE
    conn.last_error = None
    db.commit()

    if not conn.refresh_token_enc:
        # Uploads still work until the access token expires, so this is a warning
        # rather than a failure — but it means the connection is short-lived.
        # For LinkedIn this is the EXPECTED state, not an anomaly: refresh tokens
        # go only to approved partners, so info-level keeps it out of the alert
        # path while still recording it. ConnectionOut.expires_soon is what
        # actually gets the user to reconnect in time.
        log = logger.info if platform == PLATFORM_LINKEDIN else logger.warning
        log(
            "[INTEGRATIONS] %s connection for user %s has no refresh token", platform, user_id
        )

    return HTMLResponse(
        social_oauth.popup_result_html(
            platform, ok=True, account_name=conn.account_name
        )
    )


@router.delete("/{platform}")
async def disconnect(
    platform: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revoke at the provider (best effort) and delete the local connection.

    Provider revocation failing must not strand the row: the user asked to
    disconnect, so the local grant goes regardless and the worst case is a
    credential the provider still honours but we no longer hold.
    """
    _validate_platform(platform)
    conn = _get_connection(db, user.id, platform)
    if conn is None:
        return {"detail": "Not connected"}

    try:
        token = token_crypto.decrypt(conn.refresh_token_enc or conn.access_token_enc)
    except token_crypto.TokenCryptoError:
        token = None  # Undecryptable (rotated key) — nothing to revoke with.

    if token:
        try:
            async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
                if platform == PLATFORM_YOUTUBE:
                    await client.post(
                        social_oauth.GOOGLE_REVOKE_URL, params={"token": token}
                    )
                elif platform == PLATFORM_X:
                    await client.post(
                        social_oauth.X_REVOKE_URL,
                        data={"token": token, "client_id": settings.X_CLIENT_ID},
                        auth=_x_basic_auth(),
                    )
                elif platform == PLATFORM_LINKEDIN:
                    # LinkedIn publishes no revocation endpoint for 3-legged
                    # OAuth. Deleting our row is all we can do; the member
                    # withdraws the grant at linkedin.com/psettings/permitted-services.
                    logger.info(
                        "[INTEGRATIONS] LinkedIn has no revoke endpoint; "
                        "deleting the local connection only"
                    )
                else:
                    logger.warning(
                        "[INTEGRATIONS] No revoke path for platform %r", platform
                    )
        except Exception as exc:
            logger.warning(
                "[INTEGRATIONS] %s revoke failed for user %s (deleting locally): %s",
                platform, user.id, exc,
            )

    db.delete(conn)
    db.commit()
    return {"detail": "Disconnected"}


# ─── Provider calls ──────────────────────────────────────────────────────────


class _ProviderError(Exception):
    """A provider rejected the exchange, with a message safe to show the user."""


def _x_basic_auth():
    """X uses HTTP Basic for confidential clients; public PKCE clients send none."""
    if settings.X_CLIENT_SECRET:
        return (settings.X_CLIENT_ID, settings.X_CLIENT_SECRET)
    return None


async def _exchange_youtube_code(code: str) -> dict:
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        resp = await client.post(
            social_oauth.GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": social_oauth.youtube_client_id(),
                "client_secret": social_oauth.youtube_client_secret(),
                "redirect_uri": social_oauth.redirect_uri(PLATFORM_YOUTUBE),
                "grant_type": "authorization_code",
            },
        )
    if resp.status_code >= 400:
        logger.warning("[INTEGRATIONS] Google token exchange %s: %s", resp.status_code, resp.text[:500])
        raise _ProviderError("Google rejected the connection. Please try again.")
    data = resp.json()
    if not data.get("access_token"):
        raise _ProviderError("Google did not return an access token.")
    return data


async def _fetch_youtube_identity(access_token: str) -> dict:
    """Read the channel so the UI can say which channel uploads will go to.

    Also falls back to the Google account's email when there is no channel.
    That matters: an account with no YouTube channel CANNOT upload — videos.insert
    rejects it with youtubeSignupRequired — and the usual cause is connecting the
    wrong Google account. Recording the email lets the UI say which account is
    connected, so the mistake is visible before an upload is attempted rather
    than after it fails.
    """
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            resp = await client.get(
                "https://www.googleapis.com/youtube/v3/channels",
                params={"part": "snippet", "mine": "true"},
                headers={"Authorization": f"Bearer {access_token}"},
            )
        if resp.status_code >= 400:
            logger.warning("[INTEGRATIONS] YouTube channels lookup %s: %s", resp.status_code, resp.text[:300])
            return {}
        items = resp.json().get("items") or []
        if not items:
            # No channel on this account. Record the email anyway so the UI can
            # show WHICH account is connected — otherwise the user sees a blank
            # connection and no way to tell they picked the wrong one.
            return {"account_handle": await _fetch_google_email(access_token)}
        snippet = items[0].get("snippet") or {}
        thumbs = (snippet.get("thumbnails") or {}).get("default") or {}
        return {
            "account_id": items[0].get("id"),
            "account_name": snippet.get("title"),
            "account_handle": (snippet.get("customUrl") or None),
            "account_avatar_url": thumbs.get("url"),
        }
    except Exception as exc:
        logger.warning("[INTEGRATIONS] YouTube identity lookup failed: %s", exc)
        return {}


async def _fetch_google_email(access_token: str) -> str | None:
    """The Google account's email, for identifying a channel-less connection."""
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            resp = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
        if resp.status_code >= 400:
            return None
        return (resp.json() or {}).get("email")
    except Exception:
        return None


async def _exchange_x_code(code: str, code_verifier: str | None) -> dict:
    if not code_verifier:
        raise _ProviderError("This connection link is incomplete. Please try again.")
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        resp = await client.post(
            social_oauth.X_TOKEN_URL,
            data={
                "code": code,
                "grant_type": "authorization_code",
                "client_id": settings.X_CLIENT_ID,
                "redirect_uri": social_oauth.redirect_uri(PLATFORM_X),
                "code_verifier": code_verifier,
            },
            auth=_x_basic_auth(),
        )
    if resp.status_code >= 400:
        logger.warning("[INTEGRATIONS] X token exchange %s: %s", resp.status_code, resp.text[:500])
        raise _ProviderError("X rejected the connection. Please try again.")
    data = resp.json()
    if not data.get("access_token"):
        raise _ProviderError("X did not return an access token.")
    return data


async def _fetch_x_identity(access_token: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            resp = await client.get(
                "https://api.x.com/2/users/me",
                params={"user.fields": "profile_image_url"},
                headers={"Authorization": f"Bearer {access_token}"},
            )
        if resp.status_code >= 400:
            logger.warning("[INTEGRATIONS] X users/me %s: %s", resp.status_code, resp.text[:300])
            return {}
        data = (resp.json() or {}).get("data") or {}
        return {
            "account_id": data.get("id"),
            "account_name": data.get("name"),
            "account_handle": data.get("username"),
            "account_avatar_url": data.get("profile_image_url"),
        }
    except Exception as exc:
        logger.warning("[INTEGRATIONS] X identity lookup failed: %s", exc)
        return {}


async def _exchange_linkedin_code(code: str) -> dict:
    """Trade the code for tokens.

    Plain RFC 6749: credentials in the body, no Basic auth and no PKCE. Closer to
    Google's exchange than to X's despite LinkedIn's flow looking X-shaped.
    """
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        resp = await client.post(
            social_oauth.LINKEDIN_TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": settings.LINKEDIN_CLIENT_ID,
                "client_secret": settings.LINKEDIN_CLIENT_SECRET,
                "redirect_uri": social_oauth.redirect_uri(PLATFORM_LINKEDIN),
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    if resp.status_code >= 400:
        logger.warning(
            "[INTEGRATIONS] LinkedIn token exchange %s: %s",
            resp.status_code, resp.text[:500],
        )
        raise _ProviderError("LinkedIn rejected the connection. Please try again.")
    data = resp.json()
    if not data.get("access_token"):
        raise _ProviderError("LinkedIn did not return an access token.")
    return data


async def _fetch_linkedin_identity(access_token: str) -> dict:
    """Who this grant belongs to, via the OIDC userinfo endpoint.

    ``account_id`` holds the FULL member URN rather than the bare ``sub``,
    because that is the value the publish path needs verbatim as the post author.
    Storing the bare id would leave every consumer to re-derive the prefix, and
    one of them would eventually get it wrong.
    """
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            resp = await client.get(
                "https://api.linkedin.com/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
        if resp.status_code >= 400:
            logger.warning(
                "[INTEGRATIONS] LinkedIn userinfo %s: %s",
                resp.status_code, resp.text[:300],
            )
            return {}
        data = resp.json() or {}
        sub = data.get("sub")
        return {
            "account_id": f"urn:li:person:{sub}" if sub else None,
            "account_name": data.get("name"),
            # LinkedIn has no @handle; the profile URL is not in userinfo either.
            "account_handle": None,
            "account_avatar_url": data.get("picture"),
        }
    except Exception as exc:
        logger.warning("[INTEGRATIONS] LinkedIn identity lookup failed: %s", exc)
        return {}


# ─── Publishing ──────────────────────────────────────────────────────────────

VALID_PRIVACY = ("public", "unlisted", "private")
# Visibility is per-platform, not universal. LinkedIn has no unlisted/private
# notion; it has "anyone" vs "your connections". Reusing privacy_status for that
# keeps the column honest (it answers "who can see it" either way) and needs no
# migration — "connections" is 11 chars and the column is String(12).
VALID_PRIVACY_BY_PLATFORM = {
    PLATFORM_LINKEDIN: ("public", "connections"),
}


@router.post("/projects/{project_id}/publish")
async def publish_project(
    project_id: int,
    body: PublishRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Publish a project's video, rendering first if needed.

    Owner-only. A connection is a personal credential, so letting an editor push
    a video to the owner's channel (or the owner's video to an editor's) is an
    authorisation problem, not a convenience. Collaborators can still watch
    progress via /publish-status.
    """
    platform = _validate_platform(body.platform)
    try:
        social_oauth.assert_platform_enabled(platform)
    except social_oauth.OAuthConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    # Before any connection or render work: a free user must not be able to
    # start a paid-only upload by calling this endpoint directly.
    if platform in PAID_ONLY_PUBLISH_PLATFORMS and user.plan not in PAID_TIERS:
        raise HTTPException(
            status_code=403,
            detail={
                "error_code": "upgrade_required",
                "message": f"Publishing to {platform} requires a paid plan.",
            },
        )

    allowed_privacy = VALID_PRIVACY_BY_PLATFORM.get(platform, VALID_PRIVACY)
    if body.privacy_status not in allowed_privacy:
        raise HTTPException(status_code=400, detail="Invalid privacy setting")

    project = get_accessible_project(project_id, user, db, required_role="owner")

    conn = _get_connection(db, user.id, platform)
    if conn is None or conn.status != STATUS_ACTIVE:
        raise HTTPException(
            status_code=409,
            detail={
                "error_code": "not_connected",
                "message": f"Connect your {platform} account first.",
            },
        )
    if not _scopes_ok(conn):
        raise HTTPException(
            status_code=409,
            detail={
                "error_code": "insufficient_scope",
                "message": f"Reconnect your {platform} account and allow uploads.",
            },
        )

    # One in-flight job per (project, platform): a second click must not double-post.
    existing = (
        db.query(SocialPublishJob)
        .filter(
            SocialPublishJob.project_id == project_id,
            SocialPublishJob.platform == platform,
            SocialPublishJob.status.in_(ACTIVE_STATUSES),
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail={
                "error_code": "already_publishing",
                "message": "This video is already being published.",
                "job_id": existing.id,
            },
        )

    has_video = bool(project.r2_video_url and project.r2_video_key)
    if body.source == SOURCE_EXISTING and not has_video:
        raise HTTPException(
            status_code=400,
            detail="This video hasn't been rendered yet.",
        )
    needs_render = body.source == SOURCE_RERENDER or (
        body.source == "auto" and not has_video
    )

    job = SocialPublishJob(
        project_id=project_id,
        user_id=user.id,
        connection_id=conn.id,
        platform=platform,
        title=body.title.strip(),
        description=(body.description or "").strip() or None,
        tags=json.dumps([t for t in body.tags if t][:500]) if body.tags else None,
        privacy_status=body.privacy_status,
        made_for_kids=body.made_for_kids,
        category_id=body.category_id,
        source=SOURCE_RERENDER if needs_render else SOURCE_EXISTING,
    )

    if not needs_render:
        # The bytes already exist: snapshot the key so a later re-render that
        # replaces (and deletes) this version is detectable rather than silent.
        job.status = STATUS_QUEUED
        job.r2_video_key = project.r2_video_key
        db.add(job)
        db.commit()
        db.refresh(job)
        publish_queue.wake()
        return {"job": _job_out(job), "render_started": False, "render_run_id": None}

    # Render first. The row goes in as pending_render BEFORE the render starts,
    # so a render that finishes quickly still finds the intent waiting for it.
    job.status = STATUS_PENDING_RENDER
    db.add(job)
    db.commit()
    db.refresh(job)

    from app.routers.pipeline import start_render_for_project

    try:
        result = await start_render_for_project(
            project,
            resolution=body.resolution,
            # A re-render of an existing video is billed and must be forced; a
            # first render of a never-rendered project is neither.
            force_render=bool(body.source == SOURCE_RERENDER and has_video),
            user=user,
            db=db,
        )
    except HTTPException:
        # Billing refusal, a competing job, a broken template — the intent is
        # void, so don't leave a row waiting for a render that never starts.
        db.delete(job)
        db.commit()
        raise

    render_run_id = result.get("render_run_id")
    job.render_run_id = render_run_id
    db.commit()
    db.refresh(job)

    return {
        "job": _job_out(job),
        "render_started": True,
        "render_run_id": render_run_id,
    }


@router.get("/projects/{project_id}/publish-status")
def publish_status(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Recent publish jobs for a project. Readable by collaborators.

    Reports "no jobs" rather than failing when the publishing tables are absent.
    Every open project page polls this on a timer, so during the window between
    a deploy and its migration an unguarded query here would turn one missing
    table into a constant stream of 500s across the whole app — for a feature
    the user may not even be using.
    """
    get_accessible_project(project_id, user, db, required_role="viewer")
    try:
        jobs = (
            db.query(SocialPublishJob)
            .filter(SocialPublishJob.project_id == project_id)
            # id DESC breaks ties on created_at. Two jobs for one project can
            # share a timestamp (re-uploading right after a publish), and
            # without this the client's "newest job" could resolve to the older
            # row — showing a finished upload while a new one runs unseen.
            .order_by(SocialPublishJob.created_at.desc(), SocialPublishJob.id.desc())
            .limit(20)
            .all()
        )
    except _MISSING_TABLE_ERRORS as exc:
        if not _is_missing_table(exc):
            raise
        # Table not created yet (migration pending). Roll back so the session is
        # usable again — Postgres aborts the whole transaction on a failed
        # statement, and get_db reuses this session for the rest of the request.
        db.rollback()
        logger.warning(
            "[INTEGRATIONS] social_publish_jobs is missing — has the "
            "add_social_publishing_tables migration been applied?"
        )
        return {"jobs": []}
    return {"jobs": [_job_out(j) for j in jobs]}


@router.post("/projects/{project_id}/publish/{job_id}/cancel")
def cancel_publish(
    project_id: int,
    job_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cancel a job that has not started uploading.

    A `running` job is deliberately not cancellable: the bytes are already
    moving and the platform may finalize regardless, so a "cancelled" that did
    not cancel would be a lie.
    """
    get_accessible_project(project_id, user, db, required_role="owner")
    job = (
        db.query(SocialPublishJob)
        .filter(
            SocialPublishJob.id == job_id,
            SocialPublishJob.project_id == project_id,
        )
        .first()
    )
    if job is None:
        raise HTTPException(status_code=404, detail="Publish job not found")
    if job.status not in (STATUS_PENDING_RENDER, STATUS_QUEUED):
        raise HTTPException(
            status_code=409, detail="This upload has already started."
        )

    job.status = STATUS_CANCELLED
    job.error_code = "cancelled_by_user"
    job.completed_at = datetime.utcnow()
    db.commit()
    return {"detail": "Cancelled", "status": job.status}


@router.post("/projects/{project_id}/publish/{job_id}/retry")
def retry_publish(
    project_id: int,
    job_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Requeue a failed job, reusing its metadata."""
    project = get_accessible_project(project_id, user, db, required_role="owner")
    job = (
        db.query(SocialPublishJob)
        .filter(
            SocialPublishJob.id == job_id,
            SocialPublishJob.project_id == project_id,
        )
        .first()
    )
    if job is None:
        raise HTTPException(status_code=404, detail="Publish job not found")
    # A retry starts a fresh upload, so it needs the same plan as the original
    # publish did — the job may predate a downgrade.
    if job.platform in PAID_ONLY_PUBLISH_PLATFORMS and user.plan not in PAID_TIERS:
        raise HTTPException(
            status_code=403,
            detail={
                "error_code": "upgrade_required",
                "message": f"Publishing to {job.platform} requires a paid plan.",
            },
        )
    if job.status in ACTIVE_STATUSES:
        raise HTTPException(status_code=409, detail="This upload is still running.")
    if not job.retryable:
        raise HTTPException(
            status_code=409,
            detail="This upload can't be retried — please publish again.",
        )
    if not project.r2_video_key:
        raise HTTPException(status_code=400, detail="This video hasn't been rendered yet.")

    # Point at the current render and reset the attempt budget: the user asking
    # again is a fresh decision, not a continuation of the automatic retries.
    job.status = STATUS_QUEUED
    job.r2_video_key = project.r2_video_key
    job.attempt_count = 0
    job.uploaded_bytes = 0
    job.resumable_url = None
    job.error_code = None
    job.error_message = None
    job.completed_at = None
    db.commit()
    db.refresh(job)
    publish_queue.wake()
    return _job_out(job)
