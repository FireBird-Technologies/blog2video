"""Post a video to X (Twitter) via chunked media upload.

Ships complete but dark: ``X_CLIENT_ID`` being empty is the feature flag, so the
routes refuse the platform and the frontend never renders the menu item. Turning
it on is a config change, not a deploy.

Flow: INIT -> APPEND (segments under 5 MB) -> FINALIZE -> poll STATUS until the
transcode finishes -> POST /2/tweets with the media_id.

THE TRAP: X ROTATES REFRESH TOKENS. Every refresh returns a NEW refresh token
and invalidates the old one. Failing to persist it means the connection works
exactly once more and then dies with an opaque invalid_grant — the single most
common way these integrations break.
"""
import logging
import time
from datetime import datetime, timedelta

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.models.social_connection import STATUS_REVOKED, SocialConnection
from app.services import social_oauth, token_crypto
from app.services.youtube_publish import PublishError

logger = logging.getLogger(__name__)

MEDIA_UPLOAD_URL = "https://api.x.com/2/media/upload"
TWEETS_URL = "https://api.x.com/2/tweets"

# X caps a segment at 5 MB; 4 MiB leaves room for multipart overhead.
SEGMENT_SIZE = 4 * 1024 * 1024
TOKEN_REFRESH_MARGIN_SECONDS = 120
# Transcoding a long video is slow, but it must not hold a queue slot forever.
MAX_PROCESSING_SECONDS = 600
TWEET_MAX_CHARS = 280

HTTP_TIMEOUT = httpx.Timeout(connect=20.0, read=180.0, write=300.0, pool=20.0)


def _basic_auth():
    if settings.X_CLIENT_SECRET:
        return (settings.X_CLIENT_ID, settings.X_CLIENT_SECRET)
    return None


def compose_text(title: str, description: str | None) -> str:
    """Build the tweet body. X has no title field, so title leads."""
    text = (title or "").strip()
    extra = (description or "").strip()
    if extra and len(text) + len(extra) + 2 <= TWEET_MAX_CHARS:
        text = f"{text}\n\n{extra}" if text else extra
    if len(text) > TWEET_MAX_CHARS:
        text = text[: TWEET_MAX_CHARS - 1].rstrip() + "…"
    return text


def get_access_token(conn: SocialConnection, db: Session, *, force: bool = False) -> str:
    """Return a usable access token, refreshing (and rotating) when needed."""
    if not force and conn.token_expires_at:
        remaining = (conn.token_expires_at - datetime.utcnow()).total_seconds()
        if remaining > TOKEN_REFRESH_MARGIN_SECONDS:
            try:
                token = token_crypto.decrypt(conn.access_token_enc)
            except token_crypto.TokenCryptoError:
                token = None
            if token:
                return token

    try:
        refresh_token = token_crypto.decrypt(conn.refresh_token_enc)
    except token_crypto.TokenCryptoError as exc:
        conn.status = "error"
        conn.last_error = "Stored tokens could not be decrypted"
        db.commit()
        raise PublishError(
            "Your X connection could not be read. Please reconnect.",
            code="reauth_required", retryable=False,
        ) from exc

    if not refresh_token:
        raise PublishError(
            "This X connection has expired. Please reconnect your account.",
            code="reauth_required", retryable=False,
        )

    with httpx.Client(timeout=HTTP_TIMEOUT) as client:
        resp = client.post(
            social_oauth.X_TOKEN_URL,
            data={
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
                "client_id": settings.X_CLIENT_ID,
            },
            auth=_basic_auth(),
        )

    if resp.status_code >= 400:
        if resp.status_code in (400, 401):
            conn.status = STATUS_REVOKED
            conn.last_error = "X rejected the refresh token"
            db.commit()
            raise PublishError(
                "Your X connection is no longer valid. Please reconnect.",
                code="reauth_required", retryable=False,
            )
        raise PublishError(
            f"Could not refresh the X connection ({resp.status_code}).",
            code="token_refresh_failed", retryable=True,
        )

    data = resp.json()
    access_token = data.get("access_token")
    if not access_token:
        raise PublishError(
            "X did not return an access token.",
            code="token_refresh_failed", retryable=True,
        )

    conn.access_token_enc = token_crypto.encrypt(access_token)
    if data.get("expires_in"):
        conn.token_expires_at = datetime.utcnow() + timedelta(
            seconds=int(data["expires_in"])
        )
    # MUST persist: X invalidates the old refresh token on every refresh. Drop
    # this and the connection dies on the following cycle.
    if data.get("refresh_token"):
        conn.refresh_token_enc = token_crypto.encrypt(data["refresh_token"])
    db.commit()
    return access_token


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _raise_for_status(resp, *, stage: str) -> None:
    if resp.status_code < 400:
        return
    if resp.status_code in (401, 403):
        raise PublishError(
            "X rejected the credentials. Please reconnect your account.",
            code="reauth_required", retryable=False,
        )
    if resp.status_code == 429:
        raise PublishError(
            "X is rate limiting uploads. We'll try again shortly.",
            code="rate_limited", retryable=True,
        )
    logger.warning("[X] %s failed %s: %s", stage, resp.status_code, resp.text[:400])
    raise PublishError(
        f"X refused the upload during {stage} ({resp.status_code}).",
        code="upload_failed",
        retryable=resp.status_code >= 500,
    )


def publish_video(
    *,
    conn: SocialConnection,
    db: Session,
    file_path: str,
    total_bytes: int,
    text: str,
    on_progress=None,
) -> dict:
    """Upload the video and post it. Returns {"post_id", "post_url"}."""
    token = get_access_token(conn, db)

    with httpx.Client(timeout=HTTP_TIMEOUT) as client:
        # INIT
        resp = client.post(
            MEDIA_UPLOAD_URL,
            headers=_auth_headers(token),
            data={
                "command": "INIT",
                "total_bytes": str(total_bytes),
                "media_type": "video/mp4",
                "media_category": "tweet_video",
            },
        )
        _raise_for_status(resp, stage="INIT")
        media_id = ((resp.json() or {}).get("data") or {}).get("id") or resp.json().get("media_id_string")
        if not media_id:
            raise PublishError(
                "X did not return a media id.", code="upload_failed", retryable=True
            )

        # APPEND
        uploaded = 0
        segment_index = 0
        with open(file_path, "rb") as handle:
            while True:
                chunk = handle.read(SEGMENT_SIZE)
                if not chunk:
                    break
                resp = client.post(
                    MEDIA_UPLOAD_URL,
                    headers=_auth_headers(token),
                    data={
                        "command": "APPEND",
                        "media_id": media_id,
                        "segment_index": str(segment_index),
                    },
                    files={"media": ("chunk", chunk, "application/octet-stream")},
                )
                _raise_for_status(resp, stage="APPEND")
                uploaded += len(chunk)
                segment_index += 1
                if on_progress:
                    on_progress(uploaded, total_bytes)

        # FINALIZE
        resp = client.post(
            MEDIA_UPLOAD_URL,
            headers=_auth_headers(token),
            data={"command": "FINALIZE", "media_id": media_id},
        )
        _raise_for_status(resp, stage="FINALIZE")
        _await_processing(client, token, media_id, resp.json())

        # Post
        resp = client.post(
            TWEETS_URL,
            headers={**_auth_headers(token), "Content-Type": "application/json"},
            json={"text": text, "media": {"media_ids": [str(media_id)]}},
        )
        _raise_for_status(resp, stage="post")
        data = (resp.json() or {}).get("data") or {}
        post_id = data.get("id")
        if not post_id:
            raise PublishError(
                "X did not confirm the post.", code="upload_failed", retryable=True
            )

    handle_name = conn.account_handle or "i"
    return {
        "post_id": post_id,
        "post_url": f"https://x.com/{handle_name}/status/{post_id}",
    }


def _await_processing(client, token: str, media_id: str, finalize_body: dict) -> None:
    """Block until X finishes transcoding, honouring its check_after_secs."""
    info = (
        (finalize_body or {}).get("data", {}).get("processing_info")
        or (finalize_body or {}).get("processing_info")
        or {}
    )
    deadline = time.time() + MAX_PROCESSING_SECONDS

    while info and info.get("state") in ("pending", "in_progress"):
        if time.time() > deadline:
            raise PublishError(
                "X took too long to process the video.",
                code="processing_timeout", retryable=True,
            )
        time.sleep(max(1, int(info.get("check_after_secs") or 5)))
        resp = client.get(
            MEDIA_UPLOAD_URL,
            headers=_auth_headers(token),
            params={"command": "STATUS", "media_id": media_id},
        )
        _raise_for_status(resp, stage="STATUS")
        body = resp.json() or {}
        info = (body.get("data") or {}).get("processing_info") or body.get(
            "processing_info"
        ) or {}

    if info and info.get("state") == "failed":
        error = (info.get("error") or {}).get("message") or "unknown error"
        raise PublishError(
            f"X could not process the video ({error}).",
            code="processing_failed", retryable=False,
        )
