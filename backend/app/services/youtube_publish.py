"""YouTube upload over the raw resumable protocol.

Deliberately not google-api-python-client: that pulls httplib2 and
google-api-core for a protocol that is about sixty lines, its MediaFileUpload is
synchronous in a way that makes per-chunk progress reporting awkward, and it is
hard to exercise under the test suite's socket kill-switch. ``google-auth`` is
already a dependency for sign-in and gives us nothing we need here beyond what a
plain token POST does.

THE TWO THINGS THAT ARE EASY TO GET WRONG
-----------------------------------------
1. On a 308 the server tells you how much it actually stored, in the ``Range``
   response header. That can be LESS than what you sent. Always continue from
   the server's offset, never from your own counter, or the upload silently
   corrupts: bytes get skipped and YouTube finalizes a truncated file.

2. An upload can outlive the access token. A long render at slow upstream can
   easily exceed the hour a Google access token lives, so a 401 mid-upload is
   normal, not exceptional — refresh and retry the chunk rather than failing.
"""
import logging
import os
import time
from datetime import datetime, timedelta

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.models.social_connection import STATUS_REVOKED, SocialConnection
from app.services import social_oauth, token_crypto

logger = logging.getLogger(__name__)

UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos"

# Must be a multiple of 256 KiB (Google's requirement).
#
# 2 MiB rather than something larger because the chunk size IS the progress
# resolution: a typical rendered video here is 8-30 MB, so 8 MiB chunks meant
# only one or two progress reports for a whole upload and the bar appeared
# frozen at 0% until it jumped to done. Smaller chunks cost a few more requests
# and re-send less on failure.
CHUNK_SIZE = 2 * 1024 * 1024
# Refresh this far ahead of expiry so a chunk never starts on a token that dies
# mid-flight.
TOKEN_REFRESH_MARGIN_SECONDS = 120
MAX_CHUNK_ATTEMPTS = 5
# Uploading is slow by nature; the read timeout has to tolerate a large PUT.
HTTP_TIMEOUT = httpx.Timeout(connect=20.0, read=300.0, write=300.0, pool=20.0)

# Default category: 22 = "People & Blogs", the safest generic choice.
DEFAULT_CATEGORY_ID = "22"


class PublishError(Exception):
    """A publish attempt failed.

    ``code`` is what the UI keys its copy and its affordance off; ``retryable``
    decides whether the queue tries again.
    """

    def __init__(self, message: str, *, code: str, retryable: bool = True):
        super().__init__(message)
        self.code = code
        self.retryable = retryable


def _utcnow() -> datetime:
    return datetime.utcnow()


# ─── Tokens ──────────────────────────────────────────────────────────────────


def get_access_token(conn: SocialConnection, db: Session, *, force: bool = False) -> str:
    """Return a usable access token, refreshing when needed.

    ``force`` skips the freshness check, for the mid-upload 401 path where the
    token is known bad even though it has not formally expired (a revoked grant,
    or clock skew).
    """
    if not force and conn.token_expires_at:
        remaining = (conn.token_expires_at - _utcnow()).total_seconds()
        if remaining > TOKEN_REFRESH_MARGIN_SECONDS:
            try:
                token = token_crypto.decrypt(conn.access_token_enc)
            except token_crypto.TokenCryptoError as exc:
                raise _undecryptable(conn, db, exc)
            if token:
                return token

    try:
        refresh_token = token_crypto.decrypt(conn.refresh_token_enc)
    except token_crypto.TokenCryptoError as exc:
        raise _undecryptable(conn, db, exc)

    if not refresh_token:
        # No way to renew. Happens when Google issued no refresh token (a grant
        # made without prompt=consent) — the connection is effectively expired.
        raise PublishError(
            "This YouTube connection has expired. Please reconnect your account.",
            code="reauth_required",
            retryable=False,
        )

    with httpx.Client(timeout=HTTP_TIMEOUT) as client:
        resp = client.post(
            social_oauth.GOOGLE_TOKEN_URL,
            data={
                "refresh_token": refresh_token,
                "client_id": social_oauth.youtube_client_id(),
                "client_secret": social_oauth.youtube_client_secret(),
                "grant_type": "refresh_token",
            },
        )

    if resp.status_code >= 400:
        body = resp.text[:500]
        if "invalid_grant" in body or resp.status_code in (400, 401):
            # The user revoked access, changed their password, or the grant aged
            # out. Nothing to retry — they must reconnect.
            conn.status = STATUS_REVOKED
            conn.last_error = "Google rejected the refresh token"
            db.commit()
            raise PublishError(
                "Your YouTube connection is no longer valid. Please reconnect.",
                code="reauth_required",
                retryable=False,
            )
        raise PublishError(
            f"Could not refresh the YouTube connection ({resp.status_code}).",
            code="token_refresh_failed",
            retryable=True,
        )

    data = resp.json()
    access_token = data.get("access_token")
    if not access_token:
        raise PublishError(
            "Google did not return an access token.",
            code="token_refresh_failed",
            retryable=True,
        )

    conn.access_token_enc = token_crypto.encrypt(access_token)
    if data.get("expires_in"):
        conn.token_expires_at = _utcnow() + timedelta(seconds=int(data["expires_in"]))
    # Google normally omits refresh_token on a refresh; keep the existing one.
    # Overwriting with NULL here would break the connection on the next cycle.
    if data.get("refresh_token"):
        conn.refresh_token_enc = token_crypto.encrypt(data["refresh_token"])
    db.commit()
    return access_token


def _undecryptable(conn: SocialConnection, db: Session, exc: Exception) -> PublishError:
    """Mark a connection whose tokens no longer decrypt (rotated key)."""
    conn.status = "error"
    conn.last_error = "Stored tokens could not be decrypted"
    db.commit()
    logger.warning("[YOUTUBE] Undecryptable tokens for connection %s: %s", conn.id, exc)
    return PublishError(
        "Your YouTube connection could not be read. Please reconnect.",
        code="reauth_required",
        retryable=False,
    )


# ─── Resumable upload ────────────────────────────────────────────────────────


def start_resumable_session(
    access_token: str,
    *,
    title: str,
    description: str | None,
    tags: list[str] | None,
    privacy_status: str,
    made_for_kids: bool,
    category_id: str | None,
    total_bytes: int,
) -> str:
    """Open a resumable session and return its upload URL."""
    metadata = {
        "snippet": {
            # YouTube rejects < and > outright with an opaque 400, so they are
            # stripped at the boundary rather than surfacing as a mystery failure.
            "title": sanitize_text(title)[:100],
            "description": sanitize_text(description or "")[:5000],
            "tags": [t for t in (tags or []) if t][:500],
            "categoryId": category_id or DEFAULT_CATEGORY_ID,
        },
        "status": {
            "privacyStatus": privacy_status,
            "selfDeclaredMadeForKids": bool(made_for_kids),
        },
    }

    with httpx.Client(timeout=HTTP_TIMEOUT) as client:
        resp = client.post(
            UPLOAD_URL,
            params={"uploadType": "resumable", "part": "snippet,status"},
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json; charset=UTF-8",
                "X-Upload-Content-Length": str(total_bytes),
                "X-Upload-Content-Type": "video/*",
            },
            json=metadata,
        )

    if resp.status_code >= 400:
        logger.warning("[YOUTUBE] Session start %s: %s", resp.status_code, resp.text[:500])
        # Classify BEFORE assuming a 401 means bad credentials. YouTube returns
        # youtubeSignupRequired — the account simply has no channel — as a 401,
        # and reporting that as "reconnect your account" sends the user round a
        # loop that cannot possibly fix it.
        raise _classify_error(resp.text, resp.status_code)

    upload_url = resp.headers.get("Location")
    if not upload_url:
        raise PublishError(
            "YouTube did not return an upload URL.",
            code="upload_start_failed",
            retryable=True,
        )
    return upload_url


def query_offset(upload_url: str, access_token: str, total_bytes: int) -> int:
    """Ask the server how many bytes it already holds.

    Used when resuming a session after a restart or a network error, so we never
    guess where to continue from.
    """
    with httpx.Client(timeout=HTTP_TIMEOUT) as client:
        resp = client.put(
            upload_url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Length": "0",
                "Content-Range": f"bytes */{total_bytes}",
            },
            content=b"",
        )
    if resp.status_code in (200, 201):
        return total_bytes  # Already complete.
    if resp.status_code == 308:
        return _parse_range_end(resp.headers.get("Range"))
    if resp.status_code == 404:
        # The session expired (they last about a week). It cannot be resumed.
        raise PublishError(
            "The upload session expired. Please publish again.",
            code="session_expired",
            retryable=False,
        )
    raise PublishError(
        f"Could not resume the upload ({resp.status_code}).",
        code="upload_failed",
        retryable=True,
    )


def _parse_range_end(range_header: str | None) -> int:
    """``bytes=0-262143`` -> 262144 (the count stored, i.e. the next offset).

    Absent header means the server holds nothing yet.
    """
    if not range_header:
        return 0
    try:
        return int(range_header.split("-")[-1]) + 1
    except (ValueError, IndexError):
        return 0


def _classify_error(body: str, status_code: int) -> PublishError:
    """Map a YouTube error body onto something the UI can act on.

    Keyed on the ``reason`` in the body rather than the HTTP status, because
    YouTube is not consistent about which status carries which reason —
    ``uploadLimitExceeded`` arrives as a 400 from videos.insert but is
    documented under 403. Reading the status first produced a useless
    "YouTube refused the upload (400)" for the single most likely real-world
    failure.
    """
    lowered = (body or "").lower()

    if "uploadlimitexceeded" in lowered:
        return PublishError(
            "Your YouTube account has hit its upload limit for now. This is a "
            "limit YouTube puts on the channel, not on Blog2Video — it usually "
            "resets within 24 hours. You can try publishing again "
            "later.",
            code="account_upload_limit",
            retryable=False,
        )
    if "quotaexceeded" in lowered or "dailylimitexceeded" in lowered:
        return PublishError(
            "YouTube's daily upload limit has been reached. We'll retry automatically.",
            code="quota_exceeded",
            retryable=True,
        )
    if "youtubesignuprequired" in lowered:
        return PublishError(
            "The connected Google account doesn't have a YouTube channel yet. "
            "Open youtube.com with that account to create one, or disconnect "
            "and connect an account that already has a channel.",
            code="no_channel",
            retryable=False,
        )
    if "mediabodyrequired" in lowered or "invalidvideo" in lowered:
        return PublishError(
            "YouTube could not read the video file. Try re-rendering it.",
            code="invalid_video",
            retryable=False,
        )
    if "forbidden" in lowered or "insufficient" in lowered:
        return PublishError(
            "This YouTube account is not allowed to upload. Please reconnect and "
            "grant upload permission.",
            code="reauth_required",
            retryable=False,
        )

    # A 401 we could not attribute to anything more specific really is a
    # credentials problem, so reconnecting is the right prompt here.
    if status_code == 401:
        return PublishError(
            "YouTube rejected the credentials. Please reconnect your account.",
            code="reauth_required",
            retryable=False,
        )

    # Unrecognised. Surface YouTube's own message when it gave one — it is far
    # more useful to the user than a bare status code.
    detail = ""
    try:
        import json as _json

        detail = ((_json.loads(body) or {}).get("error") or {}).get("message") or ""
    except Exception:
        detail = ""
    return PublishError(
        detail or f"YouTube refused the upload ({status_code}).",
        code="upload_failed",
        # 5xx is transient; a 4xx we do not recognise will not fix itself.
        retryable=status_code >= 500,
    )


def sanitize_text(value: str) -> str:
    """Strip the characters YouTube rejects in titles and descriptions."""
    return (value or "").replace("<", "").replace(">", "")


def upload_file(
    *,
    upload_url: str,
    file_path: str,
    total_bytes: int,
    access_token: str,
    refresh_access_token=None,
    start_offset: int = 0,
    on_progress=None,
) -> dict:
    """Push the file to an open resumable session and return the video resource.

    ``refresh_access_token`` is a zero-arg callable returning a fresh token; it
    is called on a 401 so an upload longer than the token's life survives.
    ``on_progress(uploaded, total)`` is called after each accepted chunk.
    """
    offset = start_offset
    token = access_token
    attempts = 0

    with open(file_path, "rb") as handle, httpx.Client(timeout=HTTP_TIMEOUT) as client:
        # Report the starting offset before sending anything, so a resumed
        # upload shows where it actually is instead of 0% until its first chunk
        # completes.
        if on_progress and offset:
            on_progress(offset, total_bytes)

        while offset < total_bytes:
            handle.seek(offset)
            chunk = handle.read(CHUNK_SIZE)
            if not chunk:
                # The file is shorter than the length we told YouTube about.
                raise PublishError(
                    "The video file ended unexpectedly.",
                    code="video_truncated",
                    retryable=False,
                )
            end = offset + len(chunk) - 1

            try:
                resp = client.put(
                    upload_url,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Length": str(len(chunk)),
                        "Content-Range": f"bytes {offset}-{end}/{total_bytes}",
                    },
                    content=chunk,
                )
            except httpx.RequestError as exc:
                attempts += 1
                if attempts >= MAX_CHUNK_ATTEMPTS:
                    raise PublishError(
                        f"The connection to YouTube kept failing ({exc}).",
                        code="network_error",
                        retryable=True,
                    )
                time.sleep(min(2 ** attempts, 30))
                # Re-ask where the server got to; a request that errored may
                # still have been partially stored.
                offset = query_offset(upload_url, token, total_bytes)
                continue

            if resp.status_code in (200, 201):
                if on_progress:
                    on_progress(total_bytes, total_bytes)
                return resp.json()

            if resp.status_code == 308:
                # Authoritative: continue from what the server actually holds,
                # which may be less than we just sent.
                new_offset = _parse_range_end(resp.headers.get("Range"))
                if new_offset <= offset and new_offset != 0:
                    attempts += 1
                    if attempts >= MAX_CHUNK_ATTEMPTS:
                        raise PublishError(
                            "The upload stopped making progress.",
                            code="upload_stalled",
                            retryable=True,
                        )
                    time.sleep(min(2 ** attempts, 30))
                else:
                    attempts = 0
                offset = max(new_offset, 0)
                if on_progress:
                    on_progress(offset, total_bytes)
                continue

            if resp.status_code == 401:
                # Expected on long uploads: the access token aged out mid-file.
                if refresh_access_token is None:
                    raise PublishError(
                        "The YouTube credentials expired during the upload.",
                        code="reauth_required",
                        retryable=True,
                    )
                attempts += 1
                if attempts >= MAX_CHUNK_ATTEMPTS:
                    raise PublishError(
                        "Could not keep the YouTube connection alive.",
                        code="reauth_required",
                        retryable=False,
                    )
                token = refresh_access_token()
                offset = query_offset(upload_url, token, total_bytes)
                continue

            if resp.status_code == 403:
                raise _classify_error(resp.text, resp.status_code)

            if resp.status_code == 404:
                raise PublishError(
                    "The upload session expired. Please publish again.",
                    code="session_expired",
                    retryable=False,
                )

            if resp.status_code >= 500:
                attempts += 1
                if attempts >= MAX_CHUNK_ATTEMPTS:
                    raise PublishError(
                        f"YouTube kept returning errors ({resp.status_code}).",
                        code="upload_failed",
                        retryable=True,
                    )
                time.sleep(min(2 ** attempts, 30))
                offset = query_offset(upload_url, token, total_bytes)
                continue

            logger.warning("[YOUTUBE] Chunk PUT %s: %s", resp.status_code, resp.text[:400])
            raise PublishError(
                f"The upload failed ({resp.status_code}).",
                code="upload_failed",
                retryable=False,
            )

    # offset reached total without a 200 — ask the server to confirm.
    return {"_incomplete": True}


def video_url(video_id: str) -> str:
    return f"https://www.youtube.com/watch?v={video_id}"


def studio_url(video_id: str) -> str:
    """Where a user goes to flip a forced-private upload to public."""
    return f"https://studio.youtube.com/video/{video_id}/edit"


def daily_upload_cap() -> int:
    return max(1, int(settings.YOUTUBE_UPLOAD_DAILY_CAP or 90))


def resolve_local_video(project_id: int, r2_video_key: str | None, work_dir: str) -> tuple[str, bool]:
    """Return (path, is_temp) for the MP4 to upload.

    Prefers the file the render just wrote, which is on this box already; only
    falls back to R2 when it is missing (a different container, or a publish of
    an older render). Returns is_temp=True when the caller must clean up.
    """
    from app.services import r2_storage

    local_path = os.path.join(
        settings.MEDIA_DIR, f"projects/{project_id}/output/video.mp4"
    )
    if os.path.exists(local_path) and os.path.getsize(local_path) > 0:
        return local_path, False

    if not r2_video_key:
        raise PublishError(
            "The rendered video could not be found.",
            code="video_missing",
            retryable=False,
        )

    os.makedirs(work_dir, exist_ok=True)
    dest = os.path.join(work_dir, f"publish_{project_id}.mp4")
    if not r2_storage.download_to_file(r2_video_key, dest):
        # Usually means a re-render replaced this version and deleted the key.
        raise PublishError(
            "This version of the video is no longer available — it may have been "
            "re-rendered. Please publish again.",
            code="video_superseded",
            retryable=False,
        )
    return dest, True
