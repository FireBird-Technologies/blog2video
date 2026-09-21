"""Post a video to LinkedIn via the versioned REST Videos + Posts APIs.

Ships complete but dark: ``LINKEDIN_CLIENT_ID``/``LINKEDIN_CLIENT_SECRET`` being
empty is the feature flag, so the routes refuse the platform and the frontend
never renders the menu item. Turning it on is a config change, not a deploy.

Flow: initializeUpload -> PUT each part to its pre-signed URL -> finalizeUpload
with the part ETags -> poll until the video is AVAILABLE -> POST /rest/posts.

Member (personal profile) posting only. Company-page posting needs the Community
Management API, which LinkedIn grants only after a manual review — see the note
on LINKEDIN_SCOPES in social_oauth.py for why those scopes are not requested.

THREE TRAPS, all of which fail quietly rather than loudly:

1. ``uploadedPartIds`` must be the part ETags IN INSTRUCTION ORDER. Submit them
   out of order and finalize returns 200 on a video whose bytes are scrambled.
2. ``uploadToken`` from initializeUpload must be echoed back to finalizeUpload.
   It is "" in LinkedIn's single-part samples, so hardcoding "" appears to work
   right up until a file is big enough to need two parts.
3. The part upload URLs are PRE-SIGNED and must NOT carry our Authorization
   header — they point at a different host, so sending the bearer token there
   leaks it for no benefit.

And one operational reality: LinkedIn access tokens last 60 days and programmatic
refresh is limited to approved partners, so for most deployments there IS no
refresh token and ``get_access_token`` surfaces ``reauth_required`` on expiry.
That is the expected path, not a misconfiguration.
"""
import json
import logging
import re
import time
from datetime import datetime, timedelta
from urllib.parse import quote

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.models.social_connection import STATUS_REVOKED, SocialConnection
from app.services import social_oauth, token_crypto
from app.services.youtube_publish import PublishError

logger = logging.getLogger(__name__)

API_BASE = "https://api.linkedin.com"
VIDEOS_URL = f"{API_BASE}/rest/videos"
POSTS_URL = f"{API_BASE}/rest/posts"
USERINFO_URL = f"{API_BASE}/v2/userinfo"

# LinkedIn's feed limit for post commentary.
COMMENTARY_MAX = 3000
# Feed videos: 75 KB - 500 MB, 3s - 30min. (The fileSizeBytes field doc mentions
# 5 GB, but that is the ads path — the feed ceiling is 500 MB.)
MAX_VIDEO_BYTES = 500 * 1024 * 1024
MIN_VIDEO_BYTES = 75 * 1024
# LinkedIn allows 30-minute videos, so X's 600s processing cap is too tight.
MAX_PROCESSING_SECONDS = 900
PROCESSING_POLL_SECONDS = 5
TOKEN_REFRESH_MARGIN_SECONDS = 120
MAX_PART_ATTEMPTS = 4
# Refuse to start a part if the pre-signed URLs are about to expire mid-flight.
UPLOAD_URL_EXPIRY_MARGIN_SECONDS = 60

HTTP_TIMEOUT = httpx.Timeout(connect=20.0, read=180.0, write=300.0, pool=20.0)


def api_version() -> str:
    return settings.LINKEDIN_API_VERSION or "202609"


def _rest_headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "LinkedIn-Version": api_version(),
        "X-Restli-Protocol-Version": "2.0.0",
        "Content-Type": "application/json",
    }


def compose_commentary(title: str, description: str | None) -> str:
    """Build the post body. LinkedIn has no title field, so the title leads.

    No angle-bracket stripping here: that is a YouTube quirk (it rejects them
    outright), and applying it to LinkedIn would silently mangle legitimate text.
    Note that LinkedIn's "little" text format does treat ``@[name](urn)`` as a
    mention template, but a bare ``@`` or ``#`` in ordinary prose is fine.
    """
    text = (title or "").strip()
    extra = (description or "").strip()
    if extra:
        text = f"{text}\n\n{extra}" if text else extra
    if len(text) > COMMENTARY_MAX:
        text = text[: COMMENTARY_MAX - 1].rstrip() + "…"
    return text


def post_url(post_urn: str) -> str:
    """Public URL for a created post.

    The URN goes in verbatim — LinkedIn's own docs show the un-escaped
    ``urn:li:ugcPost:<id>`` form in this path.
    """
    return f"https://www.linkedin.com/feed/update/{post_urn}/"


# ─── Tokens ──────────────────────────────────────────────────────────────────


def get_access_token(conn: SocialConnection, db: Session, *, force: bool = False) -> str:
    """Return a usable access token, refreshing only if we were given the means.

    Unlike YouTube and X, a missing refresh token here is NORMAL: LinkedIn issues
    them only to approved partners. So an expired connection is a reconnect
    prompt rather than an error worth logging loudly.
    """
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
            "Your LinkedIn connection could not be read. Please reconnect.",
            code="reauth_required", retryable=False,
        ) from exc

    if not refresh_token:
        # The common case. LinkedIn tokens last 60 days; without partner-level
        # refresh access there is nothing to renew with.
        conn.status = STATUS_REVOKED
        conn.last_error = "LinkedIn access token expired and no refresh token is available"
        db.commit()
        raise PublishError(
            "Your LinkedIn connection has expired. Please reconnect your account.",
            code="reauth_required", retryable=False,
        )

    with httpx.Client(timeout=HTTP_TIMEOUT) as client:
        resp = client.post(
            social_oauth.LINKEDIN_TOKEN_URL,
            data={
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "client_id": settings.LINKEDIN_CLIENT_ID,
                "client_secret": settings.LINKEDIN_CLIENT_SECRET,
            },
        )

    if resp.status_code >= 400:
        if resp.status_code in (400, 401):
            conn.status = STATUS_REVOKED
            conn.last_error = "LinkedIn rejected the refresh token"
            db.commit()
            raise PublishError(
                "Your LinkedIn connection is no longer valid. Please reconnect.",
                code="reauth_required", retryable=False,
            )
        raise PublishError(
            f"Could not refresh the LinkedIn connection ({resp.status_code}).",
            code="token_refresh_failed", retryable=True,
        )

    data = resp.json() or {}
    access_token = data.get("access_token")
    if not access_token:
        raise PublishError(
            "LinkedIn did not return an access token.",
            code="token_refresh_failed", retryable=True,
        )

    conn.access_token_enc = token_crypto.encrypt(access_token)
    if data.get("expires_in"):
        conn.token_expires_at = datetime.utcnow() + timedelta(
            seconds=int(data["expires_in"])
        )
    # Keep the existing refresh token when the response omits one.
    if data.get("refresh_token"):
        conn.refresh_token_enc = token_crypto.encrypt(data["refresh_token"])
    db.commit()
    return access_token


# ─── Errors ──────────────────────────────────────────────────────────────────

_ERROR_TOKEN_RE = re.compile(r"\b([A-Z][A-Z0-9_]{4,})\b")


def _error_detail(resp) -> tuple[str | None, str]:
    """Best-effort (error_token, message) from a LinkedIn error response.

    LinkedIn is inconsistent here: some errors carry `serviceErrorCode`, some
    `code`, and the documented condition names (EXPIRED_UPLOAD_URL and friends)
    often appear only inside `message`. Read all three rather than trusting one.
    """
    try:
        body = resp.json() or {}
    except (ValueError, json.JSONDecodeError):
        return None, (resp.text or "")[:400]

    message = str(body.get("message") or "")
    token = body.get("serviceErrorCode") or body.get("code")
    if token is not None:
        token = str(token)
    if not token or not token.replace("_", "").isalpha():
        match = _ERROR_TOKEN_RE.search(message)
        token = match.group(1) if match else token
    return (str(token) if token else None), (message or (resp.text or "")[:400])


def _raise_for_status(resp, *, stage: str) -> None:
    """Map an api.linkedin.com failure onto the shared error vocabulary.

    NOT used for part uploads — those go to a different host where a 401 means
    "this pre-signed URL expired", not "your credentials are bad".
    """
    if resp.status_code < 400:
        return

    token, message = _error_detail(resp)
    logger.warning(
        "[LINKEDIN] %s failed %s (%s): %s", stage, resp.status_code, token, message[:300]
    )

    if resp.status_code == 401 or (resp.status_code == 403 and token == "ACCESS_DENIED"):
        raise PublishError(
            "LinkedIn rejected the credentials. Please reconnect your account.",
            code="reauth_required", retryable=False,
        )
    if resp.status_code == 429:
        raise PublishError(
            "LinkedIn is rate limiting uploads. We'll try again shortly.",
            code="rate_limited", retryable=True,
        )
    if resp.status_code == 426 or token == "NONEXISTENT_VERSION":
        # LinkedIn sunsets each YYYYMM version ~12 months after release and then
        # answers every call with 426. No retry can fix it and it is not the
        # user's account at fault, so say plainly that the server needs a bump
        # rather than leaving an operator to decode "refused the upload (426)".
        raise PublishError(
            f"LinkedIn no longer supports API version {api_version()}. "
            "Set LINKEDIN_API_VERSION to a current version to publish again.",
            code="api_version_retired", retryable=False,
        )
    if token == "EXPIRED_UPLOAD_URL":
        raise PublishError(
            "The LinkedIn upload session expired. Starting a fresh one.",
            code="upload_session_expired", retryable=True,
        )
    if token == "MEDIA_ASSET_PROCESSING_FAILED":
        raise PublishError(
            "LinkedIn could not process the video.",
            code="processing_failed", retryable=False,
        )
    if token == "MEDIA_ASSET_WAITING_UPLOAD":
        raise PublishError(
            "LinkedIn is still receiving the video. We'll try again shortly.",
            code="upload_failed", retryable=True,
        )
    if token == "FIELD_LENGTH_TOO_LONG":
        raise PublishError(
            "The post text is too long for LinkedIn.",
            code="invalid_metadata", retryable=False,
        )

    raise PublishError(
        f"LinkedIn refused the upload during {stage} ({resp.status_code}).",
        code="upload_failed",
        retryable=resp.status_code >= 500,
    )


# ─── Upload ──────────────────────────────────────────────────────────────────


def _initialize_upload(client, token: str, *, owner: str, file_size: int) -> dict:
    resp = client.post(
        VIDEOS_URL,
        params={"action": "initializeUpload"},
        headers=_rest_headers(token),
        json={
            "initializeUploadRequest": {
                "owner": owner,
                "fileSizeBytes": file_size,
                "uploadCaptions": False,
                "uploadThumbnail": False,
            }
        },
    )
    _raise_for_status(resp, stage="initializeUpload")

    value = ((resp.json() or {}).get("value")) or {}
    video_urn = value.get("video")
    instructions = value.get("uploadInstructions") or []
    if not video_urn or not instructions:
        raise PublishError(
            "LinkedIn did not return an upload session.",
            code="upload_start_failed", retryable=True,
        )
    return {
        "video": video_urn,
        # Echoed back at finalize. "" is legitimate for single-part uploads, so
        # the falsy default is correct — but it must come from the response.
        "upload_token": value.get("uploadToken") or "",
        "instructions": instructions,
        # Single top-level field (plural), epoch ms — NOT per-instruction.
        "expires_at": value.get("uploadUrlsExpireAt"),
    }


def _check_urls_unexpired(expires_at) -> None:
    # `is None` rather than a truthiness check: 0 is a real (expired) timestamp,
    # and treating it as "no expiry given" would skip the guard entirely.
    if expires_at is None:
        return
    try:
        deadline = int(expires_at) / 1000.0
    except (TypeError, ValueError):
        return
    if time.time() + UPLOAD_URL_EXPIRY_MARGIN_SECONDS > deadline:
        # Retryable: the queue re-enters publish_video, which re-initializes and
        # gets a fresh set of URLs.
        raise PublishError(
            "The LinkedIn upload session expired. Starting a fresh one.",
            code="upload_session_expired", retryable=True,
        )


def _upload_parts(
    client, instructions: list, file_path: str, total_bytes: int, on_progress, expires_at
) -> list[str]:
    """PUT every part in order and return their ETags in that same order.

    Sequential by construction. A thread pool would be faster and would also make
    it possible for the ETags to come back in the wrong order, which produces a
    scrambled video that finalize accepts with a 200.
    """
    part_ids: list[str] = []
    uploaded = 0

    with open(file_path, "rb") as handle:
        for index, inst in enumerate(instructions):
            _check_urls_unexpired(expires_at)

            first = int(inst["firstByte"])
            last = int(inst["lastByte"])
            handle.seek(first)
            # A short read on the final part is correct, not an error: lastByte
            # can overshoot EOF when the file size is not a multiple of the part
            # size.
            chunk = handle.read(last - first + 1)
            if not chunk:
                raise PublishError(
                    "The rendered video ended sooner than expected.",
                    code="video_truncated", retryable=False,
                )

            etag = _put_one_part(client, inst["uploadUrl"], chunk, index=index)
            part_ids.append(etag)
            uploaded += len(chunk)
            if on_progress:
                on_progress(uploaded, total_bytes)

    return part_ids


def _put_one_part(client, upload_url: str, chunk: bytes, *, index: int) -> str:
    """Upload one part, with its own retry. Returns the ETag.

    Retrying is safe because the URL names the byte range: re-PUTting the same
    bytes to the same URL is idempotent, and a retry's fresh ETag simply replaces
    the previous one for this index.

    Note the deliberate absence of an Authorization header — see the module
    docstring.
    """
    attempt = 0
    while True:
        attempt += 1
        try:
            resp = client.put(
                upload_url,
                content=chunk,
                headers={"Content-Type": "application/octet-stream"},
            )
        except httpx.RequestError as exc:
            if attempt >= MAX_PART_ATTEMPTS:
                raise PublishError(
                    "Lost the connection to LinkedIn while uploading.",
                    code="network_error", retryable=True,
                ) from exc
            time.sleep(min(2 ** attempt, 30))
            continue

        if resp.status_code < 400:
            # httpx headers are case-insensitive, but the docs show lowercase
            # `etag` and some proxies are not — check both rather than trust it.
            etag = resp.headers.get("etag") or resp.headers.get("ETag")
            if not etag:
                raise PublishError(
                    "LinkedIn did not acknowledge an uploaded part.",
                    code="upload_failed", retryable=True,
                )
            # The real value is a long `/ambry-video/signedId/...bin` string, not
            # a quoted MD5 — strip surrounding quotes only if they are there.
            return etag.strip('"')

        # On a pre-signed URL a 401/403 means the URL expired, NOT bad
        # credentials. Reporting it as reauth_required would send the user off to
        # reconnect a connection that is perfectly fine.
        if resp.status_code in (401, 403):
            raise PublishError(
                "The LinkedIn upload session expired. Starting a fresh one.",
                code="upload_session_expired", retryable=True,
            )
        if resp.status_code >= 500 and attempt < MAX_PART_ATTEMPTS:
            time.sleep(min(2 ** attempt, 30))
            continue

        logger.warning(
            "[LINKEDIN] part %s failed %s: %s", index, resp.status_code, resp.text[:300]
        )
        raise PublishError(
            f"LinkedIn refused part {index + 1} of the upload ({resp.status_code}).",
            code="upload_failed",
            retryable=resp.status_code >= 500,
        )


def _finalize_upload(
    client, token: str, *, video_urn: str, upload_token: str, part_ids: list[str]
) -> None:
    resp = client.post(
        VIDEOS_URL,
        params={"action": "finalizeUpload"},
        headers=_rest_headers(token),
        json={
            "finalizeUploadRequest": {
                "video": video_urn,
                "uploadToken": upload_token,
                "uploadedPartIds": part_ids,
            }
        },
    )
    _raise_for_status(resp, stage="finalizeUpload")


def _await_processing(client, token: str, video_urn: str) -> None:
    """Block until LinkedIn finishes processing the video.

    Not optional: posting against a video still in PROCESSING is refused with
    MEDIA_ASSET_WAITING_UPLOAD.
    """
    deadline = time.time() + MAX_PROCESSING_SECONDS
    encoded = quote(video_urn, safe="")

    while True:
        resp = client.get(
            f"{VIDEOS_URL}/{encoded}",
            headers=_rest_headers(token),
        )
        _raise_for_status(resp, stage="video status")
        body = resp.json() or {}
        status = body.get("status")

        if status == "AVAILABLE":
            return
        if status == "PROCESSING_FAILED":
            reason = body.get("processingFailureReason") or "unknown error"
            raise PublishError(
                f"LinkedIn could not process the video ({reason}).",
                code="processing_failed", retryable=False,
            )
        if time.time() > deadline:
            raise PublishError(
                "LinkedIn took too long to process the video.",
                code="processing_timeout", retryable=True,
            )
        time.sleep(PROCESSING_POLL_SECONDS)


def _create_post(
    client,
    token: str,
    *,
    author: str,
    commentary: str,
    visibility: str,
    video_urn: str,
    title: str | None,
) -> str:
    media: dict = {"id": video_urn}
    if title:
        # Shown on the video player itself, separate from the feed commentary.
        media["title"] = title[:200]

    resp = client.post(
        POSTS_URL,
        headers=_rest_headers(token),
        json={
            "author": author,
            "commentary": commentary,
            "visibility": visibility,
            "distribution": {
                "feedDistribution": "MAIN_FEED",
                "targetEntities": [],
                "thirdPartyDistributionChannels": [],
            },
            "content": {"media": media},
            "lifecycleState": "PUBLISHED",
            "isReshareDisabledByAuthor": False,
        },
    )
    _raise_for_status(resp, stage="post")

    post_urn = resp.headers.get("x-restli-id") or resp.headers.get("X-RestLi-Id")
    if not post_urn:
        # The post almost certainly exists — LinkedIn returns the URN only in
        # this header, so a stripping proxy loses our handle on it, not the post.
        # Non-retryable on purpose: retrying would publish a second copy.
        raise PublishError(
            "LinkedIn accepted the post but did not return its id, so we can't "
            "link to it. Check your LinkedIn feed before publishing again.",
            code="upload_failed", retryable=False,
        )
    return post_urn


def publish_video(
    *,
    conn: SocialConnection,
    db: Session,
    file_path: str,
    total_bytes: int,
    text: str,
    visibility: str = "PUBLIC",
    title: str | None = None,
    on_progress=None,
) -> dict:
    """Upload the video and post it. Returns {"post_id", "post_url"}."""
    author = conn.account_id
    if not author:
        raise PublishError(
            "We don't know which LinkedIn profile to post as. Please reconnect.",
            code="reauth_required", retryable=False,
        )

    token = get_access_token(conn, db)

    with httpx.Client(timeout=HTTP_TIMEOUT) as client:
        init = _initialize_upload(client, token, owner=author, file_size=total_bytes)
        part_ids = _upload_parts(
            client,
            init["instructions"],
            file_path,
            total_bytes,
            on_progress,
            init["expires_at"],
        )
        _finalize_upload(
            client,
            token,
            video_urn=init["video"],
            upload_token=init["upload_token"],
            part_ids=part_ids,
        )
        _await_processing(client, token, init["video"])
        post_urn = _create_post(
            client,
            token,
            author=author,
            commentary=text,
            visibility=visibility,
            video_urn=init["video"],
            title=title,
        )

    return {"post_id": post_urn, "post_url": post_url(post_urn)}
