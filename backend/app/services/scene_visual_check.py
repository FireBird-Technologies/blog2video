"""Visual verification of a generated scene.

WHY THIS EXISTS
---------------
Every other check in the scene pipeline reads SOURCE CODE. Static analysis cannot
see that text is the same colour as the panel behind it, that a headline is
clipped by the frame edge, or that 80% of the canvas is empty — and those are
exactly the defects users report. This module renders one scene to an image and
asks a vision model whether it is actually broken.

HOW IT STAYS FAST
-----------------
The check is gated in `_informed_retry` to scenes scoring in a narrow band: good
scenes (score 1.0) never touch a browser, and already-failing scenes (below the
retry threshold) already have a concrete textual diagnostic queued, so a
screenshot would only confirm what the scorer said. The renderer is a long-lived
process holding one Chrome, so no per-check browser cold start.

CONTRACT: NEVER RAISES, NEVER BLOCKS
------------------------------------
`visual_check_scene` returns None for "looks fine" AND for every failure mode —
disabled, unconfigured, no browser, timeout, API error, unparseable response.
A visual check must never be able to fail a generation, matching the blueprint
stage and `custom_template_snapshot.request_snapshot`.
"""

from __future__ import annotations

import logging
import uuid

from app.config import settings

logger = logging.getLogger(__name__)

# Wall-clock cap for the whole check (render + vision). Past this the scene ships
# unverified rather than holding up generation.
_TOTAL_TIMEOUT_S = 25.0
# Z.AI's OpenAI-compatible endpoint (same host the GLM codegen calls use).
_ZAI_BASE_URL = "https://api.z.ai/api/paas/v4"
_SHOT_TIMEOUT_S = 18.0

# A narrow DEFECT DETECTOR, not a design critic.
#
# A model asked to "critique this design" will always find something, and every
# finding costs a full LLM rollout. So: a closed question set, explicit
# prohibitions on the things that are not defects, and a PASS default.
_CRITIQUE_PROMPT = """You are a quality inspector for automatically generated 1920x1080 video frames. Your job is to CATCH DEFECTS. Judge only what is visible in this image.

Work through each check and answer it explicitly before giving a verdict.

1. LEGIBILITY — Report ONLY text a viewer genuinely could not read: near-identical text and background colours, or text lost in a busy image. White or near-white text on a dark background IS readable — do not report it. Light-grey secondary text on black IS readable — do not report it.
2. SCALE — Report ONLY when NO text on the frame is large (no element reaching roughly a fifth of the frame height), or when the main copy is so small it is unreadable. A frame with one big headline plus small supporting text is CORRECT — do not report it.
3. EMPTINESS — Report ONLY when a large contiguous region — around a third of the frame or more — is completely bare, with no text, imagery, panel, rule or decoration of any kind. Margins and breathing room around content are CORRECT and are not emptiness.
4. OVERFLOW — Is any text or element clipped by the frame edge, or overlapping another so either becomes unreadable?
5. RENDER FAILURE — Is the frame blank, one flat colour, unstyled text with no layout, or an error message?

Rules:
- This is ONE FROZEN FRAME of an animation. Do NOT report that it "looks static", and do not comment on animation, timing or transitions.
- Do NOT comment on colour taste, font choice, brand fit or composition preference.
- Placeholder copy such as "Preview" or "Lorem ipsum" is expected here — judge its SIZE and CONTRAST, never its wording, and never report it as placeholder text.
- Report a defect ONLY if you can point at it and a viewer would notice it. Do not list a defect merely because a check exists for it.
{context}
Output format — exactly one of:
PASS
or
FAIL
<one line per defect: the defect name, WHERE in the frame it is, and the concrete change that fixes it>

Judge like a demanding art director reviewing a finished frame: most frames are fine, but a frame whose text you must strain to read, or that has no large element anywhere, is NOT fine. Answer PASS unless you found a defect a viewer would actually notice."""


def _render_scene_png(job_id: str, payload: dict) -> bytes | None:
    """Ask the shot server for a screenshot of the scene. None on any failure.

    The payload travels WITH the request: the shot server injects it into the
    page before navigation, so the capture page never has to fetch the job back.
    That removes a round trip and, more importantly, the job store's process
    affinity — it lives in one uvicorn worker, and a fetch could land on another.
    """
    base = (settings.SCENE_SHOT_SERVER_URL or "").strip()
    if not base:
        return None
    try:
        import requests

        resp = requests.post(
            f"{base.rstrip('/')}/shot",
            json={"job": job_id, "secret": settings.CAPTURE_SECRET, "payload": payload},
            timeout=_SHOT_TIMEOUT_S,
        )
        if resp.status_code != 200 or not resp.content:
            logger.warning(
                "[VISUAL] shot server returned %s (%d bytes)", resp.status_code, len(resp.content or b"")
            )
            return None
        return resp.content
    except Exception as e:  # noqa: BLE001
        # Connection refused is the common case (server not running) — that is a
        # disabled feature, not an error worth shouting about.
        logger.warning("[VISUAL] shot server unavailable: %s", type(e).__name__)
        return None


def _critique_image(image_bytes: bytes, context: str) -> str | None:
    """Ask the vision model for defects. Returns a critique, or None for PASS.

    GLM via Z.AI, reusing ZAI_API_KEY — the same key that already drives custom
    template codegen and image generation, so this adds no new provider
    dependency.

    Two model details worth knowing:
      * The codegen model (glm-5.2) does NOT accept images — it rejects
        `image_url` content outright. Vision needs a `-v` model.
      * With thinking enabled, GLM spends its whole budget on `reasoning_content`
        and returns an EMPTY `content`, so thinking is explicitly disabled here.
    """
    if not settings.ZAI_API_KEY:
        return None
    try:
        import base64

        from openai import OpenAI

        b64 = base64.standard_b64encode(image_bytes).decode()
        client = OpenAI(api_key=settings.ZAI_API_KEY, base_url=_ZAI_BASE_URL)
        response = client.chat.completions.create(
            model=settings.SCENE_VISION_MODEL,
            max_tokens=600,
            extra_body={"thinking": {"type": "disabled"}},
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/webp;base64,{b64}"},
                        },
                        {"type": "text", "text": _CRITIQUE_PROMPT.format(context=context)},
                    ],
                }
            ],
        )
        text = (response.choices[0].message.content or "").strip()
    except Exception as e:  # noqa: BLE001
        logger.warning("[VISUAL] vision call failed: %s: %s", type(e).__name__, e)
        return None

    # Fail OPEN: anything that is not an unambiguous FAIL is treated as a pass,
    # including a malformed response. A false FAIL costs a whole rollout.
    if not text:
        return None
    first = text.split("\n", 1)[0].strip().upper()
    if not first.startswith("FAIL"):
        return None
    body = text.split("\n", 1)[1].strip() if "\n" in text else ""
    return body or None


def visual_check_scene(
    code: str,
    *,
    scene_type: str,
    scene_index: int,
    total_scenes: int,
    theme: dict | None = None,
    logo_urls: list[str] | None = None,
    art_hints: str = "",
) -> str | None:
    """Render `code` and return a critique of what is visually wrong, or None.

    None means "no defect found" AND every failure mode. See the module docstring
    for why that conflation is deliberate.
    """
    if not settings.SCENE_VISUAL_CHECK_ENABLED:
        return None
    if not settings.CAPTURE_SECRET or not settings.SCENE_SHOT_SERVER_URL:
        return None
    if not code or len(code.strip()) < 200:
        return None

    try:
        from app.routers.custom_templates import put_scene_capture_job

        job_id = uuid.uuid4().hex
        payload = {
            "code": code,
            "theme": theme or {},
            "scene_type": scene_type,
            "scene_index": scene_index,
            "total_scenes": total_scenes,
            "logo_urls": logo_urls or [],
        }
        # Also stored server-side so the /_capture route stays usable by hand
        # (and as a fallback if injection ever fails).
        put_scene_capture_job(job_id, payload)

        image = _render_scene_png(job_id, payload)
        if not image:
            return None

        context = f"\nThis template's own type system and safe area:\n{art_hints}\n" if art_hints else "\n"
        critique = _critique_image(image, context)
        if critique:
            logger.info("[VISUAL] scene %s FAILED visual check: %s", scene_index, critique[:200])
        return critique
    except Exception as e:  # noqa: BLE001
        logger.warning("[VISUAL] check aborted: %s: %s", type(e).__name__, e)
        return None
