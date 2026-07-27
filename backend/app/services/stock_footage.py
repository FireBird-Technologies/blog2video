"""Stock footage (Pexels / Pixabay) search, download and normalisation.

The single most important thing this module does is **normalise every clip to
constant-frame-rate 30 fps on ingest**, because both Newscast compositions are
hard-locked to ``FPS = 30`` while stock clips ship at 24/25/29.97/30/60.

Remotion samples ``frame / fps`` seconds into a clip. If the source is VFR or
29.97, that sample lands *between* source frames and the result judders. Fixing
that at render time is not possible without resampling every frame, so we pay
the cost once, at selection time, with ffmpeg.

API shapes here were verified against the live provider docs on 2026-07-23:
  * Pexels  https://api.pexels.com/v1/videos/search   (note the /v1/ segment)
  * Pixabay https://pixabay.com/api/videos/
"""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, asdict
from typing import Any, Literal

import requests

from app.config import settings

logger = logging.getLogger(__name__)

# The compositions' frame rate. Must match NewscastVideo.tsx /
# NewscastVideoComposition.tsx — see the module docstring for why.
TARGET_FPS = 30

# Renders top out at 1080p (RESOLUTION_PRESETS in services/remotion.py), so a
# 4K source (50-150 MB) buys nothing but download time and disk.
MAX_HEIGHT = 1080

# Pilot scope: templates whose layouts render a clip (ZoomCropVideo is wired
# through Newscast only). Lives here rather than in a router so both the editor
# endpoints and the generation pipeline can gate on it without importing each
# other. Widen this — and the frontend gates — to roll the feature out.
STOCK_FOOTAGE_TEMPLATES = {"newscast", "newspaper"}

# Hard ceiling on what we will pull from a provider. Generous enough for a 30 s
# 1080p clip, tight enough that a pathological URL cannot fill the disk.
MAX_DOWNLOAD_BYTES = 60 * 1024 * 1024

_SEARCH_TIMEOUT = 12
_DOWNLOAD_TIMEOUT = 120
_FFMPEG_TIMEOUT = 300

Provider = Literal["pexels", "pixabay"]


class StockFootageError(RuntimeError):
    """Raised for any user-visible failure in this module."""


@dataclass
class StockClip:
    """A provider-agnostic search result."""

    provider: str
    id: str
    preview_url: str        # small mp4 for hover-preview in the picker
    thumbnail_url: str      # still image for the grid
    download_url: str       # the <=1080p variant we will actually fetch
    width: int
    height: int
    duration: float
    fps: float | None
    author: str
    page_url: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


# ─────────────────────────── Providers ────────────────────────────


def _pick_rendition(
    files: list[dict],
    box_w: float | None = None,
    box_h: float | None = None,
) -> dict:
    """Choose the smallest Pexels rendition that still covers the target box.

    Pexels pre-generates each video at several resolutions (426x240 … 1920x1080),
    all sharing the source's aspect — picking one changes resolution, never shape.

    The renderer scales a clip to *cover* its scene box, so a rendition only needs
    to be at least as large as the box is on the 1080p render canvas. Anything
    bigger is bytes downloaded for pixels that get cropped or downscaled away.

    ``box_w`` / ``box_h`` are the box's size in pixels on the 1080p canvas. When
    unknown, fall back to the largest rendition at or under 1080p.

    Note many layouts are full-bleed (1920x1080), and even a narrow *full-height*
    panel still needs a 1080-tall source — so this often still selects 1080p.
    The saving is real only for boxes that are short as well as narrow.
    """
    if not files:
        return {}

    under = [f for f in files if (f.get("height") or 0) <= MAX_HEIGHT]
    # Every rendition is above our ceiling (rare, 4K-only uploads): take the
    # smallest and let ffmpeg downscale rather than skip a good result.
    if not under:
        return min(files, key=lambda f: f.get("height") or 0)

    if not box_w or not box_h or box_w <= 0 or box_h <= 0:
        return max(under, key=lambda f: f.get("height") or 0)

    covering = [
        f
        for f in under
        if (f.get("width") or 0) >= box_w and (f.get("height") or 0) >= box_h
    ]
    if covering:
        return min(covering, key=lambda f: (f.get("width") or 0) * (f.get("height") or 0))
    # Nothing fully covers the box — the largest available is the closest we get.
    return max(under, key=lambda f: f.get("height") or 0)


def _pexels_search(
    query: str,
    per_page: int,
    page: int,
    orientation: str | None,
    box_w: float | None = None,
    box_h: float | None = None,
) -> list[StockClip]:
    if not settings.PEXELS_API_KEY:
        return []

    params: dict[str, Any] = {"query": query, "per_page": per_page, "page": page}
    if orientation in ("landscape", "portrait", "square"):
        params["orientation"] = orientation

    resp = requests.get(
        "https://api.pexels.com/v1/videos/search",
        params=params,
        headers={"Authorization": settings.PEXELS_API_KEY},
        timeout=_SEARCH_TIMEOUT,
    )
    resp.raise_for_status()
    payload = resp.json() or {}

    clips: list[StockClip] = []
    for hit in payload.get("videos") or []:
        files = [f for f in (hit.get("video_files") or []) if f.get("link")]
        if not files:
            continue

        best = _pick_rendition(files, box_w, box_h)
        if not best:
            continue

        user = hit.get("user") or {}
        clips.append(
            StockClip(
                provider="pexels",
                id=str(hit.get("id")),
                preview_url=best["link"],
                thumbnail_url=hit.get("image") or "",
                download_url=best["link"],
                width=int(best.get("width") or hit.get("width") or 0),
                height=int(best.get("height") or hit.get("height") or 0),
                duration=float(hit.get("duration") or 0),
                fps=float(best["fps"]) if best.get("fps") else None,
                author=user.get("name") or "Pexels contributor",
                page_url=hit.get("url") or "https://www.pexels.com",
            )
        )
    return clips


def _pixabay_search(query: str, per_page: int, page: int, orientation: str | None) -> list[StockClip]:
    if not settings.PIXABAY_API_KEY:
        return []

    resp = requests.get(
        "https://pixabay.com/api/videos/",
        params={
            "key": settings.PIXABAY_API_KEY,
            "q": query,
            "per_page": per_page,
            "page": page,
            "video_type": "all",
        },
        timeout=_SEARCH_TIMEOUT,
    )
    resp.raise_for_status()
    payload = resp.json() or {}

    clips: list[StockClip] = []
    for hit in payload.get("hits") or []:
        variants = hit.get("videos") or {}
        chosen = None
        for name in ("large", "medium", "small", "tiny"):
            v = variants.get(name) or {}
            if v.get("url"):
                chosen = v
                # Prefer the first variant at or under our height ceiling.
                if (v.get("height") or 0) <= MAX_HEIGHT:
                    break
        if not chosen:
            continue

        w = int(chosen.get("width") or 0)
        h = int(chosen.get("height") or 0)

        # Pixabay's video API exposes no `orientation` parameter, so honour the
        # caller's request by filtering on the variant's own aspect here.
        if orientation == "portrait" and w >= h:
            continue
        if orientation == "landscape" and h > w:
            continue

        picture_id = hit.get("picture_id") or ""
        thumbnail = (
            f"https://i.vimeocdn.com/video/{picture_id}_640x360.jpg"
            if picture_id
            else (variants.get("tiny") or {}).get("url", "")
        )

        clips.append(
            StockClip(
                provider="pixabay",
                id=str(hit.get("id")),
                preview_url=(variants.get("tiny") or chosen).get("url", ""),
                thumbnail_url=thumbnail,
                download_url=chosen["url"],
                width=w,
                height=h,
                duration=float(hit.get("duration") or 0),
                fps=None,  # Pixabay does not report source fps.
                author=hit.get("user") or "Pixabay contributor",
                page_url=hit.get("pageURL") or "https://pixabay.com",
            )
        )
    return clips


def fps_rank(fps: float | None) -> int:
    """Rank a source frame rate by how cleanly it maps onto the 30 fps timeline.

    Every template renders at 30 fps and clips are normalised to CFR 30 on ingest,
    so any rate renders *correctly*. This only decides ordering: the closer the
    source is to 30, the fewer frames ffmpeg has to duplicate, and the smoother
    fast motion looks.

      0 — exactly 30: 1:1 mapping, the fps filter is a no-op
      1 — 60 / 120 (clean 2:1 or 4:1 decimation) and 29.97 (sub-frame nudge)
      2 — unknown (Pixabay reports no fps — unknown, not known-bad)
      3 — everything else (25 / 24 / 23.98 / 50): genuine resampling
    """
    if fps is None:
        return 2
    if abs(fps - 30.0) < 0.01:
        return 0
    if abs(fps - 29.97) < 0.05:
        return 1
    # Integer multiples of 30 decimate cleanly (60 -> every 2nd frame).
    if fps > 30 and abs(fps / 30.0 - round(fps / 30.0)) < 0.01:
        return 1
    return 3


def search(
    query: str,
    *,
    provider: str = "all",
    per_page: int = 24,
    page: int = 1,
    orientation: str | None = None,
    box_w: float | None = None,
    box_h: float | None = None,
) -> list[StockClip]:
    """Search one or both providers, interleave, then rank 30 fps sources first.

    A provider with no API key configured, or one that errors, contributes
    nothing rather than failing the whole search — the picker stays usable when
    only one key is present.

    ``box_w`` / ``box_h`` (the scene image box in pixels on the 1080p canvas)
    select the smallest Pexels rendition that still covers the box. Pexels has no
    aspect filter, so this affects rendition choice only, never which clips match.
    """
    query = (query or "").strip()
    if not query:
        return []

    per_page = max(1, min(int(per_page or 24), 80))  # Pexels caps per_page at 80
    page = max(1, int(page or 1))

    wanted: list[str] = []
    if provider in ("all", "pexels"):
        wanted.append("pexels")
    if provider in ("all", "pixabay"):
        wanted.append("pixabay")

    def _run(name: str) -> list[StockClip]:
        if name == "pexels":
            return _pexels_search(query, per_page, page, orientation, box_w, box_h)
        return _pixabay_search(query, per_page, page, orientation)

    results: dict[str, list[StockClip]] = {}
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = {name: pool.submit(_run, name) for name in wanted}
        for name, fut in futures.items():
            try:
                results[name] = fut.result()
            except Exception:
                logger.warning("[STOCK] %s search failed for %r", name, query, exc_info=True)
                results[name] = []

    # Interleave so neither provider dominates the top of the grid.
    interleaved: list[StockClip] = []
    lists = [results.get(n, []) for n in wanted]
    for i in range(max((len(l) for l in lists), default=0)):
        for l in lists:
            if i < len(l):
                interleaved.append(l[i])

    # Then pull the cleanest frame rates to the front. Stable sort, so the
    # provider interleave survives as the tiebreak within each rank.
    interleaved.sort(key=lambda c: fps_rank(c.fps))
    return interleaved


# ─────────────────────── Download + normalise ─────────────────────


def _ffmpeg() -> str:
    return shutil.which("ffmpeg") or "ffmpeg"


def _ffprobe() -> str:
    return shutil.which("ffprobe") or "ffprobe"


def download_to_temp(url: str) -> str:
    """Stream a provider URL to a temp file, enforcing type and size limits."""
    try:
        resp = requests.get(url, stream=True, timeout=_DOWNLOAD_TIMEOUT)
        resp.raise_for_status()
    except requests.RequestException as e:
        raise StockFootageError(f"Could not download the clip: {e}") from e

    ctype = (resp.headers.get("Content-Type") or "").lower()
    # Some CDNs answer with octet-stream; accept that but reject obvious HTML
    # error pages, which is what an expired/rotated URL usually returns.
    if "video" not in ctype and "octet-stream" not in ctype:
        resp.close()
        raise StockFootageError("That link did not return a video file.")

    fd, tmp_path = tempfile.mkstemp(suffix=".mp4")
    written = 0
    try:
        with os.fdopen(fd, "wb") as out:
            for chunk in resp.iter_content(chunk_size=1 << 20):
                if not chunk:
                    continue
                written += len(chunk)
                if written > MAX_DOWNLOAD_BYTES:
                    raise StockFootageError("That clip is too large (limit 60 MB).")
                out.write(chunk)
    except Exception:
        _quiet_unlink(tmp_path)
        raise
    finally:
        resp.close()

    if written == 0:
        _quiet_unlink(tmp_path)
        raise StockFootageError("The downloaded clip was empty.")
    return tmp_path


def has_audio_stream(path: str) -> bool:
    """True when the file carries at least one audio stream."""
    try:
        result = subprocess.run(
            [
                _ffprobe(), "-v", "error",
                "-select_streams", "a:0",
                "-show_entries", "stream=codec_type",
                "-of", "csv=p=0",
                path,
            ],
            capture_output=True, text=True, timeout=30,
        )
        return "audio" in (result.stdout or "")
    except Exception:
        return False


def normalise(src_path: str, dest_path: str, *, with_audio: bool = False) -> None:
    """Transcode ``src_path`` to CFR 30 fps H.264 at ``dest_path``.

    Flags that matter:
      ``-vf fps=30`` + ``-r 30``  constant frame rate; the whole point (see docstring)
      ``-g 60``                   keyframe every 2 s — OffthreadVideo seeks per
                                  frame during render, and sparse keyframes are
                                  the main cause of slow video renders
      ``-pix_fmt yuv420p``,
      ``-movflags +faststart``    playable in the browser <video> the preview uses
    """
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)

    cmd = [
        _ffmpeg(), "-y", "-i", src_path,
        "-vf", f"fps={TARGET_FPS},scale='min({MAX_HEIGHT*16//9},iw)':-2:flags=lanczos",
        "-r", str(TARGET_FPS),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-profile:v", "high",
        "-crf", "20", "-preset", "medium",
        "-g", str(TARGET_FPS * 2),
        "-movflags", "+faststart",
    ]
    cmd += ["-c:a", "aac", "-b:a", "128k"] if with_audio else ["-an"]
    cmd.append(dest_path)

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=_FFMPEG_TIMEOUT)
    except subprocess.TimeoutExpired as e:
        raise StockFootageError("Processing the clip timed out.") from e

    if result.returncode != 0:
        logger.error("[STOCK] ffmpeg normalise failed: %s", result.stderr or result.stdout)
        raise StockFootageError("Could not process that clip.")


def probe(path: str) -> dict[str, Any]:
    """Read duration/width/height/fps back from the NORMALISED file.

    Never trust the provider's duration: it describes the source, and our
    transcode can shift it by a frame or two. The renderer turns this value into
    ``<Loop durationInFrames>``, so a wrong number shows up as a visible jump at
    the loop point.

    Always probe the SILENT variant. AAC frame padding stretches the container
    duration of the audio variant (measured: 3.000 s silent vs 3.018 s with
    audio for the same source), and the silent file is the one whose frames the
    renderer actually loops.
    """
    try:
        result = subprocess.run(
            [
                _ffprobe(), "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "stream=width,height,avg_frame_rate:format=duration",
                "-of", "default=noprint_wrappers=1",
                path,
            ],
            capture_output=True, text=True, timeout=30,
        )
    except Exception as e:
        raise StockFootageError("Could not read the processed clip.") from e

    if result.returncode != 0:
        raise StockFootageError("Could not read the processed clip.")

    fields: dict[str, str] = {}
    for line in (result.stdout or "").splitlines():
        if "=" in line:
            k, _, v = line.partition("=")
            fields[k.strip()] = v.strip()

    fps = None
    raw_fps = fields.get("avg_frame_rate") or ""
    if "/" in raw_fps:
        num, _, den = raw_fps.partition("/")
        try:
            fps = float(num) / float(den) if float(den) else None
        except (ValueError, ZeroDivisionError):
            fps = None

    try:
        duration = float(fields.get("duration") or 0.0)
    except ValueError:
        duration = 0.0

    if duration <= 0:
        raise StockFootageError("The processed clip has no usable duration.")

    return {
        "duration_seconds": round(duration, 3),
        "width": int(fields.get("width") or 0),
        "height": int(fields.get("height") or 0),
        "fps": fps,
    }


def _quiet_unlink(path: str | None) -> None:
    if not path:
        return
    try:
        os.unlink(path)
    except OSError:
        pass


# ───────────────────── Ingest (download → asset) ──────────────────


@dataclass
class IngestedClip:
    """Result of turning a provider URL into normalised local files."""

    filename: str
    local_path: str
    audio_filename: str | None
    audio_local_path: str | None
    duration_seconds: float
    width: int
    height: int


def ingest_clip(
    download_url: str,
    dest_dir: str,
    basename: str,
) -> IngestedClip:
    """Download a provider clip and normalise it to CFR 30 fps on disk.

    THE single ingest path — both the per-scene editor endpoint and the
    generation-time auto-pick call this, so the frame-rate contract (and the
    silent/audio variant split) cannot drift between them.

    Produces ``<basename>.mp4`` (silent, always) and, when the source carries
    audio, ``<basename>_audio.mp4`` (AAC). Blocking: run it off the event loop.

    Raises :class:`StockFootageError` for anything the caller should surface.
    """
    filename = f"{basename}.mp4"
    audio_filename = f"{basename}_audio.mp4"
    local_path = os.path.join(dest_dir, filename)
    audio_local_path = os.path.join(dest_dir, audio_filename)

    wrote_audio = False
    tmp_path = download_to_temp(download_url)
    try:
        # Probe the SILENT variant: it is what the renderer loops, and AAC
        # padding would stretch the audio variant's duration (see probe()).
        normalise(tmp_path, local_path, with_audio=False)
        info = probe(local_path)

        if has_audio_stream(tmp_path):
            try:
                normalise(tmp_path, audio_local_path, with_audio=True)
                wrote_audio = True
            except StockFootageError:
                # An unusable audio variant must not fail the whole ingest — the
                # scene simply cannot be unmuted.
                logger.warning("[STOCK] audio variant failed for %s", basename, exc_info=True)
    finally:
        _quiet_unlink(tmp_path)

    return IngestedClip(
        filename=filename,
        local_path=local_path,
        audio_filename=audio_filename if wrote_audio else None,
        audio_local_path=audio_local_path if wrote_audio else None,
        duration_seconds=float(info.get("duration_seconds") or 0.0),
        width=int(info.get("width") or 0),
        height=int(info.get("height") or 0),
    )


def pick_top_for_query(
    query: str,
    *,
    orientation: str | None = None,
    box_w: float | None = None,
    box_h: float | None = None,
) -> StockClip | None:
    """Best clip for a query, or None when nothing matches.

    "Best" is whatever :func:`search` ranks first — already fps-ordered, so a
    native 30 fps source wins when one exists.
    """
    clips = search(
        query,
        provider="all",
        per_page=24,
        page=1,
        orientation=orientation,
        box_w=box_w,
        box_h=box_h,
    )
    return clips[0] if clips else None
