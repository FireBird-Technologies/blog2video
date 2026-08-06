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


def _read_scene_render_inputs(scene_id: int):
    """Short-lived DB read: pull the fields we need for the render, then CLOSE the
    session immediately. We must NOT hold a DB connection across the ~2.6-min
    render — Neon (serverless Postgres) drops idle SSL connections, so a session
    held open across the render is dead by commit time
    ('SSL connection has been closed unexpectedly'). Returns
    (order, voiceover_path, user_id) or None."""
    db = SessionLocal()
    try:
        scene = db.query(Scene).filter(Scene.id == scene_id).first()
        if not scene:
            return None
        user_id = scene.project.user_id if scene.project else None
        return (scene.order, scene.voiceover_path, user_id)
    finally:
        db.close()


def _persist_render_result(scene_id: int, project_id: int, order: int,
                           output_path: str, filename: str, r2_key_val, r2_url_val) -> None:
    """FRESH short-lived session for the writes AFTER the render finished, so the
    connection is new (not one that went stale during the long render)."""
    db = SessionLocal()
    try:
        scene = db.query(Scene).filter(Scene.id == scene_id).first()
        if scene:
            scene.avatar_video_path = output_path
        db.add(Asset(
            project_id=project_id,
            asset_type=AssetType.AVATAR,
            original_url=None,
            local_path=output_path,
            filename=filename,
            r2_key=r2_key_val,
            r2_url=r2_url_val,
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
        order, voiceover_path, user_id = inputs
        if not voiceover_path or not os.path.exists(voiceover_path):
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
            if resp.status_code in (500, 502, 503, 504):
                # A 500 here is virtually always the Space itself crashing (an
                # unhandled exception in the Gradio app, an OOM, a container
                # fault) rather than us sending a malformed request — the body
                # is typically HF's own generic error page (raw HTML), not a
                # JSON error from our /render handler. That is the same kind
                # of transient, environment-level failure as 502/503/504, so
                # it gets the same retry treatment rather than failing fast.
                return AvatarRenderError(
                    "The avatar service is unavailable right now. Please try again.",
                    retryable=True,
                )
            return AvatarRenderError(
                f"The avatar service rejected the render (HTTP {resp.status_code}): {detail}",
                retryable=False,
            )
        mp4_bytes = resp.content
        if not mp4_bytes:
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
            f.write(mp4_bytes)

        r2_key_val = None
        r2_url_val = None
        if r2_storage.is_r2_configured() and user_id is not None:
            try:
                r2_url_val = r2_storage.upload_project_avatar(
                    user_id, project_id, output_path, filename
                )
                r2_key_val = r2_storage.avatar_key(user_id, project_id, filename)
            except Exception as e:
                logger.warning(
                    "[AVATAR] R2 upload failed for %s: %s", filename, e,
                    extra={"project_id": project_id},
                )

        # --- FRESH session for the writes ---
        _persist_render_result(scene_id, project_id, order, output_path, filename, r2_key_val, r2_url_val)
        # elapsed is measured HERE (wall time of the whole call, including upload
        # and download); the X-Render-* headers are the Space's own view of where
        # that time went. Logging both makes network vs GPU time distinguishable.
        elapsed = time.time() - started_at
        logger.info(
            "[AVATAR] Scene %s: avatar clip saved in %.1fs "
            "(space total=%ss queue=%ss gpu=%ss audio=%ss) (%d bytes)%s",
            order, elapsed,
            resp.headers.get("X-Render-Seconds", "?"),
            resp.headers.get("X-Render-Queue-Seconds", "?"),
            resp.headers.get("X-Render-Gpu-Seconds", "?"),
            resp.headers.get("X-Render-Audio-Seconds", "?"),
            len(mp4_bytes), " + R2" if r2_url_val else "",
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
