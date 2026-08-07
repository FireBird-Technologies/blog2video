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
import re
import shutil
import subprocess
import tempfile
import threading
import time
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, asdict
from typing import Any, Literal
from urllib.parse import urlparse

import requests

from app.config import settings

logger = logging.getLogger(__name__)

# The compositions' frame rate. Must match NewscastVideo.tsx /
# NewscastVideoComposition.tsx — see the module docstring for why.
TARGET_FPS = 30

# Renders top out at 1080p (RESOLUTION_PRESETS in services/remotion.py), so a
# 4K source (50-150 MB) buys nothing but download time and disk.
MAX_HEIGHT = 1080

# Hard ceiling on what we will pull from a provider. Generous enough for a 30 s
# 1080p clip, tight enough that a pathological URL cannot fill the disk.
MAX_DOWNLOAD_BYTES = 60 * 1024 * 1024

# Search result caps, applied centrally in search() so every caller/provider
# obeys them. Clips loop to the scene duration, so a long source buys nothing but
# a bigger download; longer than this is excluded via provider API params.
MAX_SEARCH_RESULTS = 6
MAX_CLIP_DURATION_SECONDS = 12.0
DEFAULT_SEARCH_PER_PAGE = 6

# Pixabay ignores `max_duration`, so the ceiling is applied client-side and most
# of every page is discarded — measured across 12 real queries, per_page=40 left
# 2 unable to fill a pool of 8 (one returned only 3), per_page=64 left 1, and
# per_page=80 filled every one. With a single provider there is no second source
# to cover a shortfall, so size for the worst query, not the median. Latency is
# effectively flat in per_page (~540ms at 3, ~670ms at 50), so the wide page is
# close to free.
_PIXABAY_DURATION_OVERFETCH = 10
AUTO_SEARCH_PER_PAGE = 8

# The auto-pick ranks a pool locally instead of trusting the first hit. Eight
# usable candidates, which a single provider must be able to fill on its own:
# with only one key configured there is no second provider to make up a
# shortfall, and a thin pool means the ranker chooses from whatever happened to
# come back rather than from a real field.
AUTO_CANDIDATE_POOL_SIZE = 8

# Ceiling on the per-provider page once cross-scene exclusions widen the request.
# Pexels caps per_page at 80; a long video would otherwise keep growing the page
# for every scene already assigned.
_MAX_AUTO_PER_PAGE = 40
# Pexels ``size=medium`` = Full HD catalog floor; prefer these heights when
# picking a ``video_files`` rendition for download/preview.
PREFERRED_RENDITION_HEIGHTS = (720, 1080, 540, 360)

_SEARCH_TIMEOUT = 12
_DOWNLOAD_TIMEOUT = 120
_FFMPEG_TIMEOUT = 300

# Pixabay's terms require search responses to be cached for 24 hours, and the
# same discipline is good manners toward Pexels. Beyond compliance it is a real
# speed win: a provider round-trip is ~650 ms and scenes in one video routinely
# extract to the same query, so repeats collapse to a dict lookup.
#
# Deliberately in-process rather than Redis — entries are small, a cold worker
# simply re-fetches, and this keeps the module dependency-free.
_SEARCH_CACHE_TTL_SECONDS = 24 * 60 * 60
_SEARCH_CACHE_MAX_ENTRIES = 512
_search_cache: "OrderedDict[tuple, tuple[float, list]]" = OrderedDict()
_search_cache_lock = threading.Lock()

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
    # Relevance signals for the local ranker. Defaulted so existing keyword
    # constructions keep working; surfaced through to_dict() but unused by the UI.
    tags: str = ""          # comma-separated keywords, provider-supplied
    description: str = ""   # human-readable title/alt, provider-supplied

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
        for height in PREFERRED_RENDITION_HEIGHTS:
            matches = [f for f in under if (f.get("height") or 0) == height]
            if matches:
                return matches[0]
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


def _cache_get(key: tuple) -> list | None:
    """Return a cached provider response, or None when absent/expired."""
    with _search_cache_lock:
        entry = _search_cache.get(key)
        if entry is None:
            return None
        stored_at, clips = entry
        if time.time() - stored_at > _SEARCH_CACHE_TTL_SECONDS:
            _search_cache.pop(key, None)
            return None
        _search_cache.move_to_end(key)  # LRU
        # Copy: callers filter and sort the list in place.
        return list(clips)


def _cache_put(key: tuple, clips: list) -> None:
    with _search_cache_lock:
        _search_cache[key] = (time.time(), list(clips))
        _search_cache.move_to_end(key)
        while len(_search_cache) > _SEARCH_CACHE_MAX_ENTRIES:
            _search_cache.popitem(last=False)


def clear_search_cache() -> None:
    """Drop every cached provider response (used by tests)."""
    with _search_cache_lock:
        _search_cache.clear()


_PEXELS_SLUG_ID_RE = re.compile(r"-\d+$")


def _pexels_description(page_url: str) -> str:
    """Derive a text description from a Pexels video page URL.

    Pexels' *video* search returns no title/alt field — the URL slug is the only
    human-readable text on the hit, so it is all the ranker has to work with:
    ``.../video/a-woman-typing-3209828/`` -> ``a woman typing``.
    """
    if not page_url:
        return ""
    try:
        path = urlparse(page_url).path.strip("/")
    except (ValueError, AttributeError):
        return ""
    if not path:
        return ""
    slug = path.rsplit("/", 1)[-1]
    slug = _PEXELS_SLUG_ID_RE.sub("", slug)
    return slug.replace("-", " ").strip()


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

    params: dict[str, Any] = {
        "query": query,
        "per_page": per_page,
        "page": page,
        "max_duration": int(MAX_CLIP_DURATION_SECONDS),
        "size": "medium",
    }
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
        # Pexels honours `max_duration` server-side (verified), but re-check:
        # a long clip costs download time and two ffmpeg passes, and the renderer
        # loops short clips anyway, so an over-length source buys nothing.
        if float(hit.get("duration") or 0) > MAX_CLIP_DURATION_SECONDS:
            continue

        files = [f for f in (hit.get("video_files") or []) if f.get("link")]
        if not files:
            continue

        best = _pick_rendition(files, box_w, box_h)
        if not best:
            continue

        user = hit.get("user") or {}
        page_url = hit.get("url") or "https://www.pexels.com"
        # Videos usually carry no tags at all (that is the photo API); read
        # defensively so a future/partial response still contributes signal.
        raw_tags = hit.get("tags") or []
        if isinstance(raw_tags, str):
            tags = raw_tags.strip()
        else:
            tags = ", ".join(str(t).strip() for t in raw_tags if str(t).strip())
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
                page_url=page_url,
                tags=tags,
                description=_pexels_description(page_url),
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
            # The API caps q at 100 chars and 400s past it.
            "q": query[:100],
            # Over-fetch, because the duration ceiling is enforced below rather
            # than by the API: only ~30-50% of hits come back at or under 12s
            # (for some queries, none in the first six). Requesting per_page
            # directly would quietly starve Pixabay out of the pool. Latency is
            # effectively flat in per_page (~540ms at 3, ~670ms at 50), so the
            # wider page is free. Documented range is 3-200; below 3 is a 400.
            "per_page": max(3, min(per_page * _PIXABAY_DURATION_OVERFETCH, 200)),
            "page": page,
            "video_type": "film",
            # Videos are rendered into customer-facing content, so exclude
            # anything not suitable for all audiences.
            "safesearch": "true",
            # Community-vetted clips first. The relevance ranker reorders the
            # pool afterwards, so this only decides *which* clips we see, not
            # which one wins.
            "order": "popular",
        },
        timeout=_SEARCH_TIMEOUT,
    )
    resp.raise_for_status()
    payload = resp.json() or {}

    clips: list[StockClip] = []
    for hit in payload.get("hits") or []:
        # Pixabay accepts `max_duration` and silently ignores it — verified live:
        # a request capped at 12s returned clips of 14, 30, 41 and 169 seconds.
        # (It is an *images* API parameter; the video endpoint 200s and drops it.)
        # Clips loop to the scene duration, so a long source only costs download
        # time and disk, hence the same ceiling Pexels enforces server-side.
        duration = float(hit.get("duration") or 0)
        if duration > MAX_CLIP_DURATION_SECONDS:
            continue

        variants = hit.get("videos") or {}
        chosen = None
        for name in ("medium", "small", "large", "tiny"):
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

        # Pixabay now ships a still per variant (``videos.<size>.thumbnail``) and
        # leaves the legacy ``picture_id`` null, so the old vimeocdn URL could
        # not be built and this fell through to a *video* URL — the picker grid
        # was loading multi-MB MP4s where it wanted a JPEG.
        thumbnail = ""
        for name in ("medium", "large", "small", "tiny"):
            thumb = (variants.get(name) or {}).get("thumbnail")
            if thumb:
                thumbnail = thumb
                break
        if not thumbnail:
            picture_id = hit.get("picture_id") or ""
            if picture_id:
                thumbnail = f"https://i.vimeocdn.com/video/{picture_id}_640x360.jpg"
            else:
                thumbnail = (variants.get("tiny") or {}).get("url", "")

        clips.append(
            StockClip(
                provider="pixabay",
                id=str(hit.get("id")),
                preview_url=(variants.get("tiny") or chosen).get("url", ""),
                thumbnail_url=thumbnail,
                download_url=chosen["url"],
                width=w,
                height=h,
                duration=duration,
                fps=None,  # Pixabay does not report source fps.
                author=hit.get("user") or "Pixabay contributor",
                page_url=hit.get("pageURL") or "https://pixabay.com",
                # Already a comma-separated keyword string, e.g. "nature, forest".
                # This is the richest relevance signal either provider gives us.
                tags=(hit.get("tags") or "").strip(),
            )
        )
        # We over-fetched to survive the duration filter — hand back only what
        # the caller asked for, so neither provider dominates the interleave.
        if len(clips) >= per_page:
            break
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
    per_page: int = DEFAULT_SEARCH_PER_PAGE,
    page: int = 1,
    orientation: str | None = None,
    box_w: float | None = None,
    box_h: float | None = None,
    max_results: int | None = None,
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

    per_page = max(1, min(int(per_page or DEFAULT_SEARCH_PER_PAGE), 80))  # Pexels caps per_page at 80
    page = max(1, int(page or 1))

    # A provider with no key configured is *off*, not broken: skip it rather than
    # dispatching a thread and logging a failure for every search. This is the
    # difference between "Pixabay-only by choice" and "Pexels is down".
    wanted: list[str] = []
    if provider in ("all", "pexels") and settings.PEXELS_API_KEY:
        wanted.append("pexels")
    if provider in ("all", "pixabay") and settings.PIXABAY_API_KEY:
        wanted.append("pixabay")
    if not wanted:
        logger.error("[STOCK] no provider API keys configured — cannot search")
        return []

    def _run(name: str) -> list[StockClip]:
        # Cache per provider, not per search(), so a repeat still pays off when
        # only one provider's parameters differ (e.g. a different scene box).
        key = (name, query.lower(), per_page, page, orientation, box_w, box_h)
        hit = _cache_get(key)
        if hit is not None:
            return hit
        if name == "pexels":
            clips = _pexels_search(query, per_page, page, orientation, box_w, box_h)
        else:
            clips = _pixabay_search(query, per_page, page, orientation)
        # Only cache successful, non-empty responses: a transient failure or an
        # empty page should not be pinned for 24 hours.
        if clips:
            _cache_put(key, clips)
        return clips

    results: dict[str, list[StockClip]] = {}
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = {name: pool.submit(_run, name) for name in wanted}
        for name, fut in futures.items():
            try:
                results[name] = fut.result()
            except Exception:
                # Loud on purpose: a provider dropping out silently halves the
                # pool and strips its metadata, which reads downstream as "the
                # ranking got worse" rather than "a key expired". An HTTP 400
                # from a bad key looked identical to a genuinely empty search.
                logger.error(
                    "[STOCK] %s search FAILED for %r — pool will be %s-only",
                    name, query,
                    " + ".join(n for n in wanted if n != name) or "empty",
                    exc_info=True,
                )
                results[name] = []

    for name in wanted:
        if not results.get(name):
            logger.warning("[STOCK] %s returned 0 clips for %r", name, query)

    # Interleave so neither provider dominates the top of the grid.
    interleaved: list[StockClip] = []
    lists = [results.get(n, []) for n in wanted]
    for i in range(max((len(l) for l in lists), default=0)):
        for l in lists:
            if i < len(l):
                interleaved.append(l[i])

    # Single enforcement point for the duration ceiling: Pexels applies it
    # server-side, Pixabay ignores the parameter entirely, and the manual picker
    # calls straight through here. Re-checking once means no parsing change in
    # either provider can leak an over-length clip into a download.
    interleaved = [
        c for c in interleaved if 0 < c.duration <= MAX_CLIP_DURATION_SECONDS
    ]

    # Then pull the cleanest frame rates to the front. Stable sort, so the
    # provider interleave survives as the tiebreak within each rank.
    interleaved.sort(key=lambda c: fps_rank(c.fps))

    # Cap the grid regardless of how many each provider returned.
    limit = MAX_SEARCH_RESULTS if max_results is None else max(1, int(max_results))
    return interleaved[:limit]


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
        per_page=AUTO_SEARCH_PER_PAGE,
        page=1,
        orientation=orientation,
        box_w=box_w,
        box_h=box_h,
        max_results=1,
    )
    return clips[0] if clips else None


def pick_best_for_scene(
    query: str,
    *,
    scene_tokens: list[str] | None = None,
    orientation: str | None = None,
    box_w: float | None = None,
    box_h: float | None = None,
    exclude_ids: set[str] | None = None,
) -> StockClip | None:
    """Best clip for a scene: one search, then rank the returned pool locally.

    Unlike :func:`pick_top_for_query` this pulls a real candidate pool (still a
    single ``search`` call — only ``per_page`` differs) so relevance can be
    scored instead of trusting whichever hit the provider happened to return
    first. ``exclude_ids`` holds ``"provider:id"`` strings already used by other
    scenes, so two scenes never land on the same clip.

    Without ``scene_tokens`` the pool is left in ``search`` order (fps-ranked),
    which is the pre-ranking behaviour.
    """
    # Fetch a wider field than the pool, then drop already-used clips *before*
    # capping. Capping first meant the eight best were chosen, the ones earlier
    # scenes had taken were removed from that eight, and a late scene ranked
    # whatever remained — which is how a penguin video drifted to jellyfish by
    # scene 9. Excluding first keeps eight genuine candidates for every scene as
    # long as either provider still has footage on the subject.
    # Ask each provider for the pool *plus* everything already taken, so the
    # eight candidates that survive exclusion are still the eight best available
    # rather than the leftovers. Capped so a long video cannot request an
    # unbounded page.
    already_used = len(exclude_ids or ())
    per_page = min(AUTO_SEARCH_PER_PAGE + already_used, _MAX_AUTO_PER_PAGE)
    clips = search(
        query,
        provider="all",
        per_page=per_page,
        page=1,
        orientation=orientation,
        box_w=box_w,
        box_h=box_h,
        max_results=AUTO_CANDIDATE_POOL_SIZE + already_used,
    )
    if exclude_ids:
        clips = [c for c in clips if f"{c.provider}:{c.id}" not in exclude_ids]
    clips = clips[:AUTO_CANDIDATE_POOL_SIZE]
    if not clips:
        return None

    if scene_tokens:
        from app.services.stock_relevance import (
            _merge_query_tokens,
            rank_clips_by_relevance,
        )

        try:
            # Rank against the terms actually searched for, then the scene's
            # wider vocabulary — otherwise the pick is decided by words the
            # provider never matched on.
            ranked = rank_clips_by_relevance(
                clips, _merge_query_tokens(scene_tokens, query)
            )
            if ranked:
                return ranked[0][0]
        except Exception:
            # Ranking is an optimisation, never a gate — fall through to the
            # provider/fps order rather than losing the clip entirely.
            logger.warning("[STOCK] relevance ranking failed for %r", query, exc_info=True)

    return clips[0]
