"""Poster frames and metadata for a rendered MP4.

Used by publish-back: Ghost's video card wants a thumbnail plus the video's
dimensions and duration, and the newsletter snippet wants a still with a play
badge (email clients can't play video, so the snippet is a linked image).
"""
import json
import shutil
import subprocess

from PIL import Image, ImageDraw

_TIMEOUT = 60


def _ffmpeg() -> str:
    return shutil.which("ffmpeg") or "ffmpeg"


def _ffprobe() -> str:
    return shutil.which("ffprobe") or "ffprobe"


def probe_video(path: str) -> tuple[int, int, float]:
    """(width, height, duration_seconds). Falls back to 1920x1080 / 0.0."""
    try:
        out = subprocess.run(
            [
                _ffprobe(), "-v", "error", "-select_streams", "v:0",
                "-show_entries", "stream=width,height:format=duration",
                "-of", "json", path,
            ],
            capture_output=True, text=True, timeout=_TIMEOUT,
        ).stdout
        data = json.loads(out or "{}")
        stream = (data.get("streams") or [{}])[0]
        duration = float((data.get("format") or {}).get("duration") or 0.0)
        return int(stream.get("width") or 1920), int(stream.get("height") or 1080), duration
    except Exception:
        return 1920, 1080, 0.0


def extract_frame(video_path: str, out_path: str, at_seconds: float = 1.0) -> bool:
    """Write one JPEG frame from ``at_seconds`` in. Returns False on failure."""
    try:
        result = subprocess.run(
            [
                _ffmpeg(), "-y", "-ss", f"{max(0.0, at_seconds):.2f}", "-i", video_path,
                "-frames:v", "1", "-q:v", "3", out_path,
            ],
            capture_output=True, timeout=_TIMEOUT,
        )
        return result.returncode == 0
    except Exception:
        return False


def add_play_badge(image_path: str, out_path: str) -> None:
    """Overlay a centred circular play button, the universal "this is a video" cue."""
    with Image.open(image_path) as src:
        img = src.convert("RGBA")
    w, h = img.size
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    r = max(24, min(w, h) // 9)
    cx, cy = w // 2, h // 2
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(0, 0, 0, 150))
    # Triangle nudged right so it reads as optically centred.
    t = int(r * 0.55)
    off = int(r * 0.12)
    draw.polygon(
        [(cx - t // 2 + off, cy - t), (cx - t // 2 + off, cy + t), (cx + t + off, cy)],
        fill=(255, 255, 255, 235),
    )
    Image.alpha_composite(img, overlay).convert("RGB").save(out_path, "JPEG", quality=88)
