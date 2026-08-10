"""Per-scene talking-head avatar rendering.

Avatars are ON DEMAND and PER SCENE: the user opens the Scene Edit modal, picks a
presenter and hits Generate, which starts a SceneAvatarJob. That job calls
``generate_scene_avatar_sync`` here, which renders a lip-synced clip from THAT
scene's voiceover mp3 via the self-hosted OmniAvatar HuggingFace Space, saves it
to R2, and records it on the scene (avatar_video_path) + an AssetType.AVATAR row.
The Remotion composition overlays the clip (see remotion.py emit and AvatarOverlay).

Design:
  - `requests` (already a dependency) is used rather than an async client so this
    needs no new package. The render is a long, blocking HTTP call (~2.6 min), so
    the caller must run it off the event loop.
  - A DB session is NEVER held across the render — Neon drops idle SSL
    connections, so inputs are read in one short-lived session and the results
    written in a fresh one (see _read_scene_render_inputs / _persist_render_result).
  - Failures return a human-readable reason rather than raising, so the job can
    surface it to the user. A scene with no clip simply plays with no overlay.

The reference portrait is chosen by preset id (Scene.avatar_preset), and the render
is a SINGLE request:

  - roster preset: the portrait bytes are bundled inside the service image, so we
    send only the preset id and it self-stages the file. See avatar_presets.py.
  - custom: the service has never seen the user's photo, so its bytes are uploaded
    as part of the same /render call.

There is no separate /prepare step. There used to be, and it was the source of a
whole class of failures: it staged the photo on container-local disk, but the
service scales to zero ~2s after idle, so /prepare and /render routinely landed on
different containers and the second found nothing.
"""
from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass
from datetime import datetime

import requests

from app.config import settings
from app.database import SessionLocal
from app.models.asset import Asset, AssetType
from app.models.project import Project
from app.models.scene import Scene
from app.services import r2_storage
from app.services.avatar_presets import is_custom_preset, normalize_preset

logger = logging.getLogger(__name__)


@dataclass
class AvatarRenderError:
    """A failure reason paired with whether trying again is worth it.

    ``retryable=True`` means the failure is transient (Space cold-start, 5xx,
    network blip) — the same job run already retries these internally a few
    times, and it is also safe to let the user hit Retry afterward.
    ``retryable=False`` means the failure will reproduce identically on any
    retry (missing voiceover file, missing custom portrait, scene deleted,
    service disabled) — retrying is pure wasted time, so callers should not
    offer or perform one automatically.
    """

    reason: str
    retryable: bool

# Calibrated default prompt (P7/P8 from the OmniAvatar test-set iteration): lip
# movement and expression that subtly match the actual volume/pacing of the voice,
# no exaggerated or theatrical motion, natural head/neck movement, no hand mention.
# What the USER is told when a render fails. The real reason stays in
# SceneAvatarJob.error_message and the logs, which is where it is useful:
# "Could not reach the avatar service: ChunkedEncodingError" tells a user
# nothing they can act on, and reads as the product being broken. Sanitising at
# the API boundary (see /avatar-status and /avatar-progress) fixes every
# consumer at once and cannot be reintroduced by a new one.
AVATAR_GENERIC_FAILURE = "We couldn't generate an avatar for this scene."

DEFAULT_AVATAR_PROMPT = (
    "A person looking at the camera, speaking naturally with lip movements and "
    "facial expressions that closely and subtly match the actual volume and pacing "
    "of their voice, with natural head and neck movement, without exaggerated or "
    "theatrical motion."
)


def _headers() -> dict[str, str]:
    return {"x-avatar-key": settings.AVATAR_SERVICE_SECRET}


def _base_url() -> str:
    return settings.AVATAR_SERVICE_URL.rstrip("/")


def _ping_service(timeout: int = 20) -> bool:
    """True when the Space is up and serving. Cheap: no GPU work, and it is also
    what nudges a sleeping Space to start waking."""
    try:
        resp = requests.get(f"{_base_url()}/ping", headers=_headers(), timeout=timeout)
        return resp.status_code == 200
    except Exception:
        return False


def _wait_for_service(on_status=None) -> bool:
    """Block until the avatar Space answers /ping, or give up.

    Returns True once it is serving. The first ping is what wakes a sleeping
    Space; the rest are just polling. Cheap GET requests, so polling costs
    nothing — the GPU only bills once the container is actually up, which is
    exactly when we want to start using it.
    """
    deadline = time.time() + settings.AVATAR_SERVICE_WAIT_SECONDS
    attempt = 0
    while time.time() < deadline:
        attempt += 1
        if _ping_service():
            if attempt > 1:
                logger.info("[AVATAR] Service ready after %s ping(s).", attempt)
            return True
        if attempt == 1 and on_status:
            # Only now do we know it was asleep — tell the UI so the user sees
            # "starting up" rather than a silent multi-minute "generating".
            on_status("starting_service")
        time.sleep(settings.AVATAR_SERVICE_POLL_SECONDS)
    logger.warning(
        "[AVATAR] Service did not become ready within %ss (%s pings).",
        settings.AVATAR_SERVICE_WAIT_SECONDS, attempt,
    )
    return False


def _read_project_custom_image(project_id: int) -> str | None:
    """The user's uploaded presenter portrait, or None.

    Its own short-lived session, like every other read here — a connection must
    never be held across the long render (see the module docstring).

    Falls back to re-downloading the R2 copy when the local file is missing, which
    is the normal case on a fresh container: the upload landed on a different
    instance, so only R2 still has the bytes.
    """
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            return None
        path = project.avatar_custom_image_path
        url = project.avatar_custom_image_url
    finally:
        db.close()

    if path and os.path.exists(path):
        return path
    if not url:
        return None
    try:
        dest = path or os.path.join(
            settings.MEDIA_DIR, f"projects/{project_id}/avatars/custom_source.jpg"
        )
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with requests.get(url, timeout=60, stream=True) as resp:
            resp.raise_for_status()
            with open(dest, "wb") as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    f.write(chunk)
        return dest
    except Exception as e:
        logger.warning(
            "[AVATAR] Could not fetch custom portrait for project %s: %s",
            project_id, e, extra={"project_id": project_id},
        )
        return None


def voiceover_r2_url(scene, db) -> str | None:
    """The R2 URL of ``scene``'s voiceover mp3, or None.

    Scenes have no FK to their audio Asset — the link is the FILENAME, exactly
    the join _read_matte_inputs uses for the AVATAR asset. Kept public because
    the enqueue endpoint needs the same lookup to decide whether a scene is
    renderable before charging for it.
    """
    if not scene or not scene.voiceover_path:
        return None
    asset = (
        db.query(Asset)
        .filter(
            Asset.project_id == scene.project_id,
            Asset.asset_type == AssetType.AUDIO,
            Asset.filename == os.path.basename(scene.voiceover_path),
        )
        .first()
    )
    return asset.r2_url if asset else None


def ensure_local_voiceover(voiceover_path: str | None, r2_url: str | None) -> str | None:
    """Local path to the scene's voiceover, re-downloading from R2 if needed.

    MEDIA_DIR is container-local and ephemeral (on HF Spaces it is /tmp), so the
    mp3 written by a previous container is simply gone after a restart while the
    DB still records its path. R2 is the durable copy, so a missing local file is
    a CACHE MISS, not missing audio — treating it as the latter is what rejected
    a whole paid batch with "this scene has no voiceover yet".

    Returns the usable path, or None only when the audio exists nowhere.
    """
    if voiceover_path and os.path.exists(voiceover_path):
        return voiceover_path
    if not voiceover_path or not r2_url:
        return None
    try:
        os.makedirs(os.path.dirname(voiceover_path), exist_ok=True)
        with requests.get(r2_url, timeout=60, stream=True) as resp:
            resp.raise_for_status()
            with open(voiceover_path, "wb") as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    f.write(chunk)
        return voiceover_path
    except Exception as e:
        logger.warning("[AVATAR] Could not fetch voiceover from R2 (%s): %s", r2_url, e)
        return None


@dataclass
class RenderPayload:
    """What one /render call came back with.

    ``mp4`` is always present on success. ``mov``/``webm`` are the transparent
    cutouts the service produced inline; they are None when matting was disabled,
    when the service is an older deployment that only knows how to return an mp4,
    or when the matte failed — in which case ``matte_error`` says why so it can be
    recorded against the scene.
    """

    mp4: bytes
    mov: bytes | None = None
    webm: bytes | None = None
    matte_error: str | None = None
    timings: dict | None = None


def _parse_render_response(resp) -> RenderPayload:
    """Decode a /render response into its (up to) three files.

    TWO SHAPES ARE ACCEPTED, deliberately:

      - ``multipart/form-data`` with parts named video/matte/preview — the current
        service, which mattes inline (see modal-service/omniavatar/app.py).
      - a bare ``video/mp4`` body — what /render returned before inline matting,
        and what it still returns when matting is off or has failed.

    The fallback is not just politeness: the backend and the Modal service deploy
    SEPARATELY, so either can be newer than the other for a while. A backend that
    could only parse multipart would break every render the moment it shipped
    ahead of the service.
    """
    content_type = (resp.headers.get("content-type") or "").lower()
    matte_error = resp.headers.get("X-Matte-Error")
    timings = {
        k: resp.headers[k]
        for k in (
            "X-Render-Seconds", "X-Render-Gpu-Seconds", "X-Render-Wall-Seconds",
            "X-Matte-Seconds", "X-Matte-Explode-Seconds", "X-Matte-Rembg-Seconds",
            "X-Matte-Prores-Seconds", "X-Matte-Webm-Seconds", "X-Matte-Frames",
        )
        if k in resp.headers
    }

    if not content_type.startswith("multipart/"):
        return RenderPayload(
            mp4=resp.content, matte_error=matte_error, timings=timings
        )

    # Parsed with the stdlib `email` package rather than a new dependency, mirroring
    # the hand-rolled encoder on the service side.
    import email

    raw = b"Content-Type: " + content_type.encode() + b"\r\n\r\n" + resp.content
    message = email.message_from_bytes(raw)
    parts: dict[str, bytes] = {}
    for part in message.walk():
        if part.is_multipart():
            continue
        name = part.get_param("name", header="content-disposition")
        payload = part.get_payload(decode=True)
        if name and payload:
            parts[name] = payload

    return RenderPayload(
        mp4=parts.get("video", b""),
        mov=parts.get("matte"),
        webm=parts.get("preview"),
        matte_error=matte_error,
        timings=timings,
    )


def _read_scene_render_inputs(scene_id: int):
    """Short-lived DB read: pull the fields we need for the render, then CLOSE the
    session immediately. We must NOT hold a DB connection across the ~2.6-min
    render — Neon (serverless Postgres) drops idle SSL connections, so a session
    held open across the render is dead by commit time
    ('SSL connection has been closed unexpectedly'). Returns
    (order, voiceover_path, voiceover_r2_url, user_id) or None.

    The R2 url comes back WITH the path because the caller may need to rehydrate
    the file, and by then this session is closed."""
    db = SessionLocal()
    try:
        scene = db.query(Scene).filter(Scene.id == scene_id).first()
        if not scene:
            return None
        user_id = scene.project.user_id if scene.project else None
        return (scene.order, scene.voiceover_path, voiceover_r2_url(scene, db), user_id)
    finally:
        db.close()


def _persist_render_result(scene_id: int, project_id: int, order: int,
                           output_path: str, filename: str, r2_key_val, r2_url_val,
                           matte_files: list | None = None,
                           matte_path: str | None = None,
                           matte_error: str | None = None) -> None:
    """FRESH short-lived session for the writes AFTER the render finished, so the
    connection is new (not one that went stale during the long render).

    Writes the mp4 and — when the service matted inline — its transparent twins, in
    ONE transaction: two Scene columns and up to three AssetType.AVATAR rows. The
    .webm goes in the same asset bucket as the others, differing only by filename
    and codec, so the frontend's existing filename-based Asset lookup finds it for
    free.

    ``matte_error`` is recorded ON THE SCENE rather than on the job row, because
    the JOB SUCCEEDED — the render is there and the video will play; only the
    cutout is missing. Storing it here is what lets the UI explain why a background
    change is unavailable and offer the manual re-matte, instead of the failure
    existing only in a server log. It is cleared on success so a later re-matte
    wipes it.
    """
    db = SessionLocal()
    try:
        scene = db.query(Scene).filter(Scene.id == scene_id).first()
        if scene:
            scene.avatar_video_path = output_path
            if matte_path:
                scene.avatar_matte_path = matte_path
            scene.avatar_matte_error = matte_error
            scene.avatar_matte_failed_at = datetime.utcnow() if matte_error else None
        db.add(Asset(
            project_id=project_id,
            asset_type=AssetType.AVATAR,
            original_url=None,
            local_path=output_path,
            filename=filename,
            r2_key=r2_key_val,
            r2_url=r2_url_val,
        ))
        for path, fname, key, url in (matte_files or []):
            db.add(Asset(
                project_id=project_id,
                asset_type=AssetType.AVATAR,
                original_url=None,
                local_path=path,
                filename=fname,
                r2_key=key,
                r2_url=url,
            ))
        db.commit()
    finally:
        db.close()


def _render_and_store(
    scene_id: int, project_id: int, preset: str, custom_image_path: str | None = None
) -> AvatarRenderError | None:
    """Render one scene's avatar clip and persist it. Runs in a worker thread.
    NEVER raises — a failure just leaves avatar_video_path null (non-blocking).

    Returns None on success, or an ``AvatarRenderError`` on failure. Returning a
    reason (rather than a bare False) is what lets the job show the user what
    actually went wrong instead of a generic "it failed" — the underlying cause
    is otherwise only visible in the server log. The ``retryable`` flag on the
    error tells the caller whether trying again is worth it: a Space that is
    still waking up will succeed on retry, but a scene missing its voiceover
    file never will.

    Key ordering: read scene inputs with a short-lived session and CLOSE it,
    then do the long (~2.6-min) render with NO DB connection held, then open a
    FRESH session only for the quick final writes. This avoids Neon dropping an
    idle connection mid-render."""
    started_at = time.time()
    try:
        inputs = _read_scene_render_inputs(scene_id)
        if not inputs:
            return AvatarRenderError("That scene no longer exists.", retryable=False)
        order, voiceover_path, voiceover_url, user_id = inputs
        # Cache miss on a fresh container is normal — rehydrate from R2 rather
        # than declaring the audio missing (see ensure_local_voiceover).
        voiceover_path = ensure_local_voiceover(voiceover_path, voiceover_url)
        if not voiceover_path:
            return AvatarRenderError("This scene's voiceover audio is missing.", retryable=False)

        render_id = f"{project_id}_{order}"
        audio_name = os.path.basename(voiceover_path)
        with open(voiceover_path, "rb") as f:
            audio_bytes = f.read()

        # The portrait travels WITH the render for a custom avatar. Read here,
        # beside the audio, so the closure below holds bytes rather than a path —
        # same reason the audio is read here: no file handle or DB session may
        # survive into the multi-minute render.
        #
        # This replaces a separate /prepare call that staged the photo on
        # container-local disk. At scaledown_window=2s the two requests routinely
        # landed on different containers, so the second found nothing and 404'd —
        # it cost one project all five scenes and another two doubled renders.
        # Sending the bytes inline removes the shared state, so there is no window
        # to lose them in. Roster presets need nothing here: their portraits are
        # baked into the service image and it self-stages them.
        image_bytes = None
        image_name = None
        if custom_image_path and os.path.exists(custom_image_path):
            image_name = os.path.basename(custom_image_path)
            with open(custom_image_path, "rb") as f:
                image_bytes = f.read()

        # --- long render: NO DB session open here ---
        def _post_render():
            files = {"audio": (audio_name, audio_bytes, "audio/mpeg")}
            if image_bytes:
                files["image"] = (image_name, image_bytes, "image/jpeg")
            return requests.post(
                f"{_base_url()}/render",
                headers=_headers(),
                data={
                    "avatar_id": preset,
                    "render_id": render_id,
                    "prompt": DEFAULT_AVATAR_PROMPT,
                    # Sent explicitly so matting can be turned off from backend
                    # config alone, with no redeploy of the Modal service.
                    "inline_matte": str(settings.AVATAR_INLINE_MATTE).lower(),
                },
                files=files,
                timeout=settings.AVATAR_RENDER_TIMEOUT_SECONDS,
            )

        try:
            resp = _post_render()
        except requests.exceptions.Timeout:
            logger.warning(
                "[AVATAR] Scene %s render timed out after %ss.",
                order, settings.AVATAR_RENDER_TIMEOUT_SECONDS,
                extra={"project_id": project_id},
            )
            return AvatarRenderError(
                "The render took too long and was stopped. The avatar service may "
                "still be starting up — please try again.",
                retryable=True,
            )
        except Exception as e:
            logger.warning(
                "[AVATAR] Scene %s render errored (%s) — skipping (avatar stays off).",
                order, e, extra={"project_id": project_id},
            )
            return AvatarRenderError(
                f"Could not reach the avatar service: {type(e).__name__}", retryable=True
            )

        # NOTE: there is deliberately no "service lost its staged portrait" retry
        # here any more. That branch existed because /prepare staged the photo on
        # container-local disk and /render could land on a different container —
        # unrecoverable state loss between two requests. The portrait now travels
        # WITH the render (see _post_render above), so a fresh container has
        # everything it needs on the first try and the failure mode is gone rather
        # than merely handled.

        if resp.status_code != 200:
            detail = (resp.text or "")[:200]
            logger.warning(
                "[AVATAR] Scene %s render failed: HTTP %s %s",
                order, resp.status_code, resp.text[:300],
                extra={"project_id": project_id},
            )
            if resp.status_code in (408, 409, 425, 429, 500, 502, 503, 504):
                # A 500 here is virtually always the Space itself crashing (an
                # unhandled exception in the Gradio app, an OOM, a container
                # fault) rather than us sending a malformed request — the body
                # is typically HF's own generic error page (raw HTML), not a
                # JSON error from our /render handler. That is the same kind
                # of transient, environment-level failure as 502/503/504, so
                # it gets the same retry treatment rather than failing fast.
                #
                # The 4xx codes here are transient for the SAME reason, even
                # though 4xx normally means "our request was bad". The provider
                # scales to zero, so a render posted into a cold start can be
                # dropped at the edge before the container is ready:
                #   408 — Modal returns "Missing request, possibly due to expiry
                #         or cancellation" when it drops a queued request. It is
                #         about the request's LIFECYCLE, not its content, so the
                #         identical payload succeeds once a container is warm.
                #   409/425 — raced against a container still starting up.
                #   429 — provider concurrency cap (AVATAR_PROVIDER_MAX_CONTAINERS);
                #         the queue should wait its turn, not kill the job.
                # Treating these as permanent stranded scenes on a dead end that
                # a plain retry would have cleared.
                return AvatarRenderError(
                    "The avatar service is unavailable right now. Please try again.",
                    retryable=True,
                )
            return AvatarRenderError(
                f"The avatar service rejected the render (HTTP {resp.status_code}): {detail}",
                retryable=False,
            )
        payload = _parse_render_response(resp)
        if not payload.mp4:
            logger.warning(
                "[AVATAR] Scene %s render returned empty body — skipping.",
                order, extra={"project_id": project_id},
            )
            return AvatarRenderError(
                "The avatar service returned an empty video.", retryable=True
            )

        avatar_dir = os.path.join(settings.MEDIA_DIR, f"projects/{project_id}/avatars")
        os.makedirs(avatar_dir, exist_ok=True)
        filename = f"avatar_scene_{order}.mp4"
        output_path = os.path.join(avatar_dir, filename)
        with open(output_path, "wb") as f:
            f.write(payload.mp4)

        def _upload(path: str, fname: str):
            """R2 upload for one file, isolated so a single failure cannot cost the
            others. Returns (key, url), either of which may be None — R2 is the
            durable copy, but a local file plus a DB row is still a usable result."""
            if not (r2_storage.is_r2_configured() and user_id is not None):
                return None, None
            try:
                url = r2_storage.upload_project_avatar(user_id, project_id, path, fname)
                return r2_storage.avatar_key(user_id, project_id, fname), url
            except Exception as e:
                logger.warning(
                    "[AVATAR] R2 upload failed for %s: %s", fname, e,
                    extra={"project_id": project_id},
                )
                return None, None

        r2_key_val, r2_url_val = _upload(output_path, filename)

        # The transparent twins, when the service matted inline. Filenames match
        # what avatar_matte.py has always produced, so every existing lookup that
        # joins an Asset by filename keeps working unchanged — and the fallback
        # matte job overwrites exactly these paths on a re-matte.
        matte_files: list = []
        matte_path = None
        for data, ext, mime_label in (
            (payload.mov, "mov", "matte"),
            (payload.webm, "webm", "preview"),
        ):
            if not data:
                continue
            fname = f"avatar_scene_{order}.{ext}"
            path = os.path.join(avatar_dir, fname)
            with open(path, "wb") as f:
                f.write(data)
            key, url = _upload(path, fname)
            matte_files.append((path, fname, key, url))
            if ext == "mov":
                # Only the ProRes is recorded on the scene; the webm is preview-only
                # and is found by filename off the same asset bucket.
                matte_path = path

        if payload.matte_error:
            logger.warning(
                "[AVATAR] Scene %s rendered OK but the inline matte failed: %s",
                order, payload.matte_error, extra={"project_id": project_id},
            )

        # --- FRESH session for the writes ---
        _persist_render_result(
            scene_id, project_id, order, output_path, filename,
            r2_key_val, r2_url_val,
            matte_files=matte_files,
            matte_path=matte_path,
            matte_error=payload.matte_error,
        )
        # elapsed is measured HERE (wall time of the whole call, including upload
        # and download); the X-Render-*/X-Matte-* headers are the SERVICE's own view
        # of where that time went. Logging both is what makes network vs GPU vs
        # matte-CPU time distinguishable — the matte stages in particular are the
        # ones that hold a billed GPU without being able to use it.
        elapsed = time.time() - started_at
        h = resp.headers
        matte_note = ""
        if payload.matte_error:
            matte_note = f" matte=FAILED({payload.matte_error[:80]})"
        elif payload.mov:
            matte_note = (
                f" matte={h.get('X-Matte-Seconds', '?')}s"
                f" [explode={h.get('X-Matte-Explode-Seconds', '?')}s"
                f" rembg={h.get('X-Matte-Rembg-Seconds', '?')}s"
                f" prores={h.get('X-Matte-Prores-Seconds', '?')}s"
                f" webm={h.get('X-Matte-Webm-Seconds', '?')}s"
                f" {h.get('X-Matte-Frames', '?')} frames]"
                f" ({len(payload.mov)}B mov, {len(payload.webm or b'')}B webm)"
            )
        else:
            matte_note = " matte=off"
        logger.info(
            "[AVATAR] Scene %s: avatar clip saved in %.1fs "
            "(service total=%ss queue=%ss gpu=%ss audio=%ss wall=%ss) (%d bytes)%s%s",
            order, elapsed,
            h.get("X-Render-Seconds", "?"),
            h.get("X-Render-Queue-Seconds", "?"),
            h.get("X-Render-Gpu-Seconds", "?"),
            h.get("X-Render-Audio-Seconds", "?"),
            h.get("X-Render-Wall-Seconds", "?"),
            len(payload.mp4), matte_note, " + R2" if r2_url_val else "",
            extra={"project_id": project_id},
        )
        return None
    except Exception as e:
        logger.exception("[AVATAR] Unexpected failure persisting scene_id=%s", scene_id)
        return AvatarRenderError(
            f"Unexpected error while saving the avatar: {type(e).__name__}", retryable=True
        )


def generate_scene_avatar_sync(
    scene_id: int, project_id: int, avatar_preset: str | None,
    on_status=None,
) -> AvatarRenderError | None:
    """Render + store the avatar clip for ONE scene.

    Returns None on success, or an ``AvatarRenderError`` on failure — the
    caller (the avatar queue dispatcher) puts ``.reason`` in
    ``job.error_message`` and ``.retryable`` in ``job.retryable`` so the UI can
    say what went wrong and whether Retry is worth offering, instead of
    silently doing nothing.

    ``on_status(phase)`` is called as the job moves between phases
    ("starting_service" -> "rendering") so the UI can explain a long wait
    instead of showing an unchanging spinner.

    Synchronous and blocking (~2.6 min): call it off the event loop.
    """
    if not settings.AVATAR_ENABLED:
        return AvatarRenderError("Avatar generation is disabled.", retryable=False)
    if not settings.AVATAR_SERVICE_URL or not settings.AVATAR_SERVICE_SECRET:
        return AvatarRenderError("Avatar service is not configured.", retryable=False)

    preset = normalize_preset(avatar_preset)

    # A custom preset has no bundled file on the service, so the user's own
    # portrait has to be uploaded with the render. Read it in its own short-lived
    # session (same Neon discipline as everything else here) BEFORE the long wait
    # below — a missing photo should fail in milliseconds with something the user
    # can act on, not after minutes of waiting for a GPU.
    custom_image_path = None
    if is_custom_preset(preset):
        custom_image_path = _read_project_custom_image(project_id)
        if not custom_image_path:
            return AvatarRenderError(
                "This project has no uploaded presenter photo. Upload one in the "
                "Avatar tab, or pick one of the built-in presenters.",
                retryable=False,
            )

    # WAIT for the Space before doing anything else.
    #
    # The Space sleeps after ~5 min idle, and the user's Generate click is what
    # wakes it. Waking is queued behind HF allocating a GPU, which is unbounded
    # and has been observed to fail and fall back to SLEEPING. Rather than firing
    # a render at a service that may never answer — and burning the job on a
    # timeout — poll cheap /ping calls until it is genuinely serving.
    #
    # This is deliberately NOT a pre-warm ping when the modal opens: that bills
    # ~5 min of idle GPU every time somebody looks and walks away. Waiting here
    # means every second of GPU time belongs to a render a user actually asked for.
    if not _wait_for_service(on_status=on_status):
        return AvatarRenderError(
            "The avatar service could not be started. It may be out of capacity "
            "— please try again in a few minutes.",
            retryable=True,
        )

    if on_status:
        on_status("rendering")

    # ONE request. There is no /prepare step any more: the portrait (when there is
    # one) rides along with the render, so nothing has to survive between two calls
    # against a service that scales to zero after 2 seconds.
    #
    # Pass the error straight through — this is what reaches job.error_message
    # (and job.retryable) and therefore the user, so it must not be flattened.
    return _render_and_store(scene_id, project_id, preset, custom_image_path)
