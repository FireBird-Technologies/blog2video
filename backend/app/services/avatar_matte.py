"""Cut the presenter out of an already-rendered avatar clip.

WHY THIS EXISTS
The roster portraits are ordinary photographs — real rooms, brick walls, shelves
(see avatar_presets.py). OmniAvatar animates the whole frame, so the mp4 it returns
has that room baked into every pixel. There is no alpha channel and nothing
chroma-keyable, so showing the presenter over a colour of the user's choosing means
literally segmenting them out of the footage.

WHY IT RUNS HERE AND NOT IN THE SPACE
Matting could live in the OmniAvatar Space, next to the GPU. It deliberately does
not:
  - the Space was deployed by OVERWRITING avtr1-service (new Docker Spaces are
    402-paywalled), so every redeploy is a risk we take only when forced;
  - matting there would occupy the L40S with work that is not generation;
  - and crucially, running it here lets us matte an EXISTING clip. Changing the
    background costs ~1 min of CPU instead of a ~3.5 min re-render, and makes no
    Space call at all.

WHEN IT RUNS — THIS IS NOW THE FALLBACK PATH, NOT THE MAIN ONE
Matting normally happens INSIDE the Modal render container, so /render returns the
mp4 and both transparent twins in one call and a scene's cutout exists the moment
its render lands (see modal-service/omniavatar/app.py's _matte_mp4, which is a port
of the pipeline below — keep the two in sync).

This module still runs, as a SceneAvatarJob(kind="matte"), for the cases inline
matting cannot cover:
  - clips rendered BEFORE inline matting existed;
  - AVATAR_INLINE_MATTE turned off;
  - a scene whose inline matte failed (Scene.avatar_matte_error records why — the
    inline matte gets exactly one attempt, because its failures are deterministic);
  - a deliberate re-matte, e.g. after changing the model.

Because it runs in the API process it is still the one thing here that can OOM the
server (see _peak_rss_mb), which is why AVATAR_MATTE_CONCURRENCY stays at 1. That
is now a rare path rather than the routine one.

The mp4 is READ, never modified: TWO transparent twins are written beside it (see
step 3 below for why there are two), so the original always survives for re-matting
or fallback.

Cost is paid once per scene. Once a scene has a matte, further colour changes are a
CSS repaint in the overlay — no job at all.
"""
from __future__ import annotations

import logging
import os
import resource
import shutil
import subprocess
import tempfile
import time

import requests

from app.config import settings
from app.database import SessionLocal
from app.models.asset import Asset, AssetType
from app.models.scene import Scene
from app.services import r2_storage

logger = logging.getLogger(__name__)

# u2netp is the lightweight u2net variant. It replaced u2net_human_seg (the
# human-specific one) on MEASURED evidence, not preference — the same 351-frame
# clip, each model in its own process so the RSS high-water mark was not inherited:
#
#     model              351 frames   per frame   peak RSS
#     u2net_human_seg       167.1s      0.476s      1358MB
#     u2netp                 34.0s      0.097s       862MB   <- 4.9x faster, 1.6x lighter
#
# Quality was compared frame-by-frame over a grey plate (the neutral background —
# black and white both hide alpha errors at the edges) on the hard case: a busy
# room with brick, shelving and plants behind the presenter. No visible difference
# in hair, beard or collar edges, and no background bleed on either. The prior
# assumption recorded here was that a general-purpose matte would fringe on hair;
# at the size an avatar overlay actually renders (16-32% of frame width) it does not.
#
# Worth re-checking if the roster gains a long-haired preset — both test clips were
# short-haired, which is the easy case for any matte.
_REMBG_MODEL = "u2netp"

# Built lazily and reused for the process lifetime. Constructing a session loads
# the ONNX weights (~4.6MB for u2netp, ~176MB for the full u2net models); doing
# that per frame (or even per job) would dominate the runtime. Guarded rather than
# imported at module scope so that a backend without rembg installed still boots —
# matting is opt-in, so it must not be a hard import.
_session = None


def _get_session():
    global _session
    if _session is None:
        from rembg import new_session  # imported lazily; see _session comment
        _session = new_session(_REMBG_MODEL)
    return _session


def _read_matte_inputs(scene_id: int):
    """Short-lived DB read, mirroring avatar.py's _read_scene_render_inputs.

    A session must NOT be held across the matte: Neon (serverless Postgres) drops
    idle SSL connections, so a session opened before a minute of CPU work is dead
    by commit time. Returns (order, mp4_path, r2_url, user_id) or None.
    """
    db = SessionLocal()
    try:
        scene = db.query(Scene).filter(Scene.id == scene_id).first()
        if not scene or not scene.avatar_video_path:
            return None
        user_id = scene.project.user_id if scene.project else None
        # The local file may be gone on a fresh container; fall back to the R2 copy
        # recorded on the AVATAR asset, exactly as the render workspace build does.
        filename = os.path.basename(scene.avatar_video_path)
        asset = (
            db.query(Asset)
            .filter(
                Asset.project_id == scene.project_id,
                Asset.asset_type == AssetType.AVATAR,
                Asset.filename == filename,
            )
            .first()
        )
        r2_url = asset.r2_url if asset else None
        return (scene.order, scene.avatar_video_path, r2_url, user_id)
    finally:
        db.close()


def _persist_matte_result(scene_id: int, project_id: int, output_path: str,
                          filename: str, r2_key_val, r2_url_val,
                          preview_path: str, preview_filename: str,
                          preview_r2_key_val, preview_r2_url_val) -> None:
    """FRESH short-lived session for the writes, after the long matte finished."""
    db = SessionLocal()
    try:
        scene = db.query(Scene).filter(Scene.id == scene_id).first()
        if scene:
            scene.avatar_matte_path = output_path
            # This path is now the BACKSTOP for a failed inline matte (see the
            # module docstring), so a success here must clear the reason the
            # inline one failed — otherwise the UI would keep offering a retry
            # for a cutout that already exists.
            scene.avatar_matte_error = None
            scene.avatar_matte_failed_at = None
        db.add(Asset(
            project_id=project_id,
            asset_type=AssetType.AVATAR,
            original_url=None,
            local_path=output_path,
            filename=filename,
            r2_key=r2_key_val,
            r2_url=r2_url_val,
        ))
        # Preview-only WebM twin (see step 3 in matte_scene_avatar_sync) — same
        # AssetType.AVATAR bucket, just a different filename/codec, so the
        # frontend's existing filename-based Asset lookup finds it for free.
        db.add(Asset(
            project_id=project_id,
            asset_type=AssetType.AVATAR,
            original_url=None,
            local_path=preview_path,
            filename=preview_filename,
            r2_key=preview_r2_key_val,
            r2_url=preview_r2_url_val,
        ))
        db.commit()
    finally:
        db.close()


def _peak_rss_mb() -> float:
    """Peak resident memory of THIS process, in MB.

    Matting is the only heavy CPU/memory work that runs inside the API process
    (renders go to Modal, video renders to a Remotion subprocess), so it is the
    one thing that can OOM-kill the whole server and take every user's requests
    with it — which is exactly what happened on a 16GB box mid-batch. Logging the
    peak per stage turns "it died" into a number we can act on.

    ru_maxrss is a HIGH-WATER MARK for the process, never decreasing, so a rise
    between stages attributes growth to the stage in between. Bytes on macOS,
    kilobytes on Linux — normalise so the number means the same thing in both.

    CAVEAT that cost us a wrong conclusion once: because it never decreases, this
    reports the SERVER's lifetime peak, not the matte's cost. Every scene in a
    batch therefore logs an identical figure once anything has pushed it up. Read
    it with _rss_mb() below, which does fall, to see what a matte actually adds."""
    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return peak / (1024 * 1024) if peak > 10_000_000 else peak / 1024


def _rss_mb() -> float:
    """CURRENT resident memory, which unlike the peak goes back down when memory
    is released — so (end - start) is the matte's real footprint inside a
    long-lived API process.

    Reads /proc on Linux (the deployment target) and falls back to `ps` on macOS,
    which has no /proc. Returns 0.0 rather than raising if neither works:
    instrumentation must never be able to fail a job."""
    try:
        with open("/proc/self/statm") as f:  # Linux: pages, field 2 = resident
            return int(f.read().split()[1]) * os.sysconf("SC_PAGE_SIZE") / (1024 * 1024)
    except Exception:
        pass
    try:
        out = subprocess.run(
            ["ps", "-o", "rss=", "-p", str(os.getpid())],
            capture_output=True, text=True, timeout=5,
        ).stdout.strip()
        return int(out) / 1024  # ps reports KB
    except Exception:
        return 0.0


def _probe_fps(src: str) -> str:
    """Read the source frame rate so the matte plays at the same speed. Falls back
    to 25 rather than failing — a slightly wrong fps beats losing the whole job."""
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", src],
            capture_output=True, text=True, timeout=30,
        ).stdout.strip()
        # ffprobe reports a rational like "25/1"; keep it as-is, ffmpeg accepts it.
        if out and "/" in out and not out.startswith("0"):
            return out
    except Exception:
        pass
    return "25"


def _matte_frames(frames_dir: str, out_dir: str) -> int:
    """Run rembg over every extracted frame. Returns how many were written."""
    from rembg import remove

    session = _get_session()
    names = sorted(n for n in os.listdir(frames_dir) if n.endswith(".png"))
    written = 0
    for name in names:
        with open(os.path.join(frames_dir, name), "rb") as f:
            data = f.read()
        cut = remove(data, session=session)
        with open(os.path.join(out_dir, name), "wb") as f:
            f.write(cut)
        written += 1
    return written


def matte_scene_avatar_sync(scene_id: int, project_id: int) -> str | None:
    """Produce a transparent ProRes 4444 .mov (render) + WebM (preview) twin from
    a scene's existing avatar mp4.

    Returns None on success, or a short human-readable reason on failure — the
    caller (the SceneAvatarJob worker) puts that string in ``job.error_message``.

    Synchronous and blocking (~1 min for a 10s clip on CPU): call it off the event
    loop. Never raises.
    """
    started_at = time.time()
    # Baseline BEFORE any work, so the end-of-job delta is what this matte added
    # to a long-lived API process — the peak alone cannot show that (see
    # _peak_rss_mb's caveat).
    rss_at_start = _rss_mb()
    work_dir = None
    try:
        inputs = _read_matte_inputs(scene_id)
        if not inputs:
            return "This scene has no avatar to change the background of."
        order, mp4_path, r2_url, user_id = inputs

        work_dir = tempfile.mkdtemp(prefix=f"matte_{project_id}_{order}_")
        local_src = mp4_path
        if not os.path.exists(local_src):
            if not r2_url:
                return "The avatar clip is no longer available. Please regenerate it."
            local_src = os.path.join(work_dir, "source.mp4")
            try:
                with requests.get(r2_url, timeout=60, stream=True) as resp:
                    resp.raise_for_status()
                    with open(local_src, "wb") as f:
                        for chunk in resp.iter_content(chunk_size=8192):
                            f.write(chunk)
            except Exception as e:
                logger.warning(
                    "[MATTE] Could not fetch avatar for scene %s: %s", order, e,
                    extra={"project_id": project_id},
                )
                return "Could not fetch the avatar clip. Please try again."

        fps = _probe_fps(local_src)
        frames_dir = os.path.join(work_dir, "in")
        cut_dir = os.path.join(work_dir, "out")
        os.makedirs(frames_dir, exist_ok=True)
        os.makedirs(cut_dir, exist_ok=True)

        # 1. Explode to PNG frames.
        t_explode = time.time()
        subprocess.run(
            ["ffmpeg", "-y", "-i", local_src, os.path.join(frames_dir, "%06d.png")],
            capture_output=True, timeout=600, check=True,
        )
        explode_s = time.time() - t_explode
        # PNG is lossless and uncompressed-ish: a few hundred frames is easily
        # hundreds of MB of disk, which matters as much as RSS on a small box.
        frames_mb = sum(
            os.path.getsize(os.path.join(frames_dir, f))
            for f in os.listdir(frames_dir)
        ) / (1024 * 1024)

        # 2. Cut the presenter out of each one.
        t_rembg = time.time()
        try:
            n = _matte_frames(frames_dir, cut_dir)
        except ImportError:
            logger.error("[MATTE] rembg is not installed — cannot matte.")
            return "Background removal is not available on this server."
        rembg_s = time.time() - t_rembg
        if not n:
            return "The avatar clip had no frames to process."
        logger.info(
            "[MATTE] Scene %s stages: explode=%.1fs (%d frames, %.0fMB) "
            "rembg=%.1fs (%.2fs/frame) | RSS %.0fMB (+%.0fMB) peak %.0fMB",
            order, explode_s, n, frames_mb, rembg_s, rembg_s / max(n, 1),
            _rss_mb(), _rss_mb() - rss_at_start, _peak_rss_mb(),
            extra={"project_id": project_id},
        )

        # 3. Re-encode with alpha, TWICE — one file for render, one for preview.
        #
        # RENDER needs ProRes 4444. VP9/WebM alpha does NOT survive real decode:
        # confirmed with system ffmpeg (`-vf alphaextract` gives a flat, non-varying
        # mask even though the container claims `alpha_mode=1`), and separately
        # confirmed in Remotion's own compositor via a real render (solid black box,
        # no matter the WebM encoding trick used). ProRes 4444 is the only format
        # verified in this codebase to carry a REAL, varying alpha channel through
        # an encode -> decode round trip (`ffprobe`/`alphaextract` on the .mov this
        # step produces). It also requires `transparent` on the `<OffthreadVideo>`
        # that reads it at render time (see remotion-video/src/components/
        # AvatarOverlay.tsx) — without that prop even a correct ProRes source
        # renders as an opaque box, because Remotion's global config
        # (`Config.setVideoImageFormat("jpeg")`) has no alpha channel by default.
        filename = f"avatar_scene_{order}.mov"
        avatar_dir = os.path.dirname(mp4_path) or os.path.join(
            settings.MEDIA_DIR, f"projects/{project_id}/avatars"
        )
        os.makedirs(avatar_dir, exist_ok=True)
        output_path = os.path.join(avatar_dir, filename)
        t_prores = time.time()
        subprocess.run(
            [
                "ffmpeg", "-y",
                "-framerate", fps,
                "-i", os.path.join(cut_dir, "%06d.png"),
                "-c:v", "prores_ks",
                "-profile:v", "4444",
                "-pix_fmt", "yuva444p10le",
                output_path,
            ],
            capture_output=True, timeout=900, check=True,
        )
        prores_s = time.time() - t_prores

        # PREVIEW needs WebM: Chromium's <video> element (used by the Player,
        # frontend/src/components/remotion/AvatarOverlay.tsx) has no ProRes decoder
        # at all, so the editor keeps using this WebM twin purely for the live
        # preview. It is NOT expected to composite pixel-perfectly with the ProRes
        # render — it only needs to look right in a browser <video> tag.
        # -auto-alt-ref 0 is REQUIRED: with alt-ref frames enabled libvpx-vp9
        # silently discards the alpha plane in some players.
        preview_filename = f"avatar_scene_{order}.webm"
        preview_path = os.path.join(avatar_dir, preview_filename)
        t_webm = time.time()
        subprocess.run(
            [
                "ffmpeg", "-y",
                "-framerate", fps,
                "-i", os.path.join(cut_dir, "%06d.png"),
                "-c:v", "libvpx-vp9",
                "-pix_fmt", "yuva420p",
                "-auto-alt-ref", "0",
                "-b:v", "0", "-crf", "30",
                preview_path,
            ],
            capture_output=True, timeout=900, check=True,
        )
        webm_s = time.time() - t_webm
        # libvpx-vp9 is single-threaded by default and slow; if this dominates,
        # -row-mt 1 / -cpu-used are the levers before anything more invasive.
        logger.info(
            "[MATTE] Scene %s encodes: prores=%.1fs webm=%.1fs | RSS %.0fMB (+%.0fMB)",
            order, prores_s, webm_s, _rss_mb(), _rss_mb() - rss_at_start,
            extra={"project_id": project_id},
        )

        r2_key_val = None
        r2_url_val = None
        preview_r2_key_val = None
        preview_r2_url_val = None
        if r2_storage.is_r2_configured() and user_id is not None:
            try:
                r2_url_val = r2_storage.upload_project_avatar(
                    user_id, project_id, output_path, filename
                )
                r2_key_val = r2_storage.avatar_key(user_id, project_id, filename)
            except Exception as e:
                logger.warning(
                    "[MATTE] R2 upload failed for %s: %s", filename, e,
                    extra={"project_id": project_id},
                )
            try:
                preview_r2_url_val = r2_storage.upload_project_avatar(
                    user_id, project_id, preview_path, preview_filename
                )
                preview_r2_key_val = r2_storage.avatar_key(
                    user_id, project_id, preview_filename
                )
            except Exception as e:
                logger.warning(
                    "[MATTE] R2 upload failed for %s: %s", preview_filename, e,
                    extra={"project_id": project_id},
                )

        _persist_matte_result(
            scene_id, project_id, output_path, filename, r2_key_val, r2_url_val,
            preview_path, preview_filename, preview_r2_key_val, preview_r2_url_val,
        )
        total_s = time.time() - started_at
        logger.info(
            "[MATTE] Scene %s: %d frames cut out in %.1fs%s "
            "[explode %.0fs + rembg %.0fs + prores %.0fs + webm %.0fs + upload %.0fs] "
            "RSS %.0f->%.0fMB (this job +%.0fMB) process peak %.0fMB",
            order, n, total_s, " + R2" if r2_url_val else "",
            explode_s, rembg_s, prores_s, webm_s,
            max(0.0, total_s - explode_s - rembg_s - prores_s - webm_s),
            rss_at_start, _rss_mb(), _rss_mb() - rss_at_start, _peak_rss_mb(),
            extra={"project_id": project_id},
        )
        return None
    except subprocess.CalledProcessError as e:
        stderr = (e.stderr or b"")[-400:]
        logger.warning(
            "[MATTE] ffmpeg failed for scene_id=%s: %s", scene_id, stderr,
            extra={"project_id": project_id},
        )
        return "Could not process the avatar video. Please try again."
    except subprocess.TimeoutExpired:
        logger.warning("[MATTE] Timed out for scene_id=%s", scene_id,
                       extra={"project_id": project_id})
        return "Background removal took too long. Please try again."
    except Exception:
        logger.exception("[MATTE] Unexpected failure for scene_id=%s", scene_id)
        return "Could not remove the background. Please try again."
    finally:
        if work_dir:
            shutil.rmtree(work_dir, ignore_errors=True)
