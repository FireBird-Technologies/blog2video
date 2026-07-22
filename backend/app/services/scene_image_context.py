"""Build read-only scene context for AI image generation."""
from __future__ import annotations

import json
from typing import Any

# Typography keys are edited in Studio, not useful for image prompts.
_LAYOUT_PROP_SKIP = frozenset({"titleFontSize", "descriptionFontSize"})

# Image/media references and other non-visual identifiers must never reach the
# image-prompt refiner: with a vague description the model latches onto them and
# reproduces the scene's *existing* (or placeholder) image instead of generating
# a fresh one. We strip them by exact key and by suffix.
_IMAGE_CONTEXT_DENY_KEYS = frozenset({
    "assignedImage", "imageUrl", "imageSrc", "image", "src", "backgroundImage",
    "logoUrl", "iconUrl", "icon", "avatar", "poster",
    "websiteLink", "secondaryWebsiteLink", "websiteUrl", "websiteDomain",
    "link", "url", "href",
    "socials", "handles", "handle", "username",
})
_IMAGE_CONTEXT_DENY_SUFFIXES = (
    "url", "link", "href", "color", "colour", "image", "src",
    "id", "key", "token",
)


def _is_denied_image_key(key: str) -> bool:
    if key in _LAYOUT_PROP_SKIP or key in _IMAGE_CONTEXT_DENY_KEYS:
        return True
    lowered = key.lower()
    return lowered.endswith(_IMAGE_CONTEXT_DENY_SUFFIXES)


def _compact_layout_props(props: dict[str, Any], max_chars: int = 2000) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, val in props.items():
        if _is_denied_image_key(key):
            continue
        if val is None:
            continue
        if isinstance(val, str) and not val.strip():
            continue
        out[key] = val
    text = json.dumps(out, ensure_ascii=False)
    if len(text) <= max_chars:
        return out
    # Truncate by dropping keys until it fits.
    keys = list(out.keys())
    while keys and len(json.dumps({k: out[k] for k in keys}, ensure_ascii=False)) > max_chars:
        keys.pop()
    return {k: out[k] for k in keys}


def build_scene_context_for_image(scene) -> str:
    """Format scene DB fields + remotion descriptor for the image-prompt refiner."""
    lines: list[str] = []

    title = (getattr(scene, "title", None) or "").strip()
    if title:
        lines.append(f"Title: {title}")

    display = (getattr(scene, "display_text", None) or "").strip()
    if display:
        lines.append(f"Display text (on-screen): {display}")

    narration = (getattr(scene, "narration_text", None) or "").strip()
    if narration:
        lines.append(f"Narration (voiceover): {narration}")

    visual = (getattr(scene, "visual_description", None) or "").strip()
    if visual:
        lines.append(f"Visual description (from script): {visual}")

    raw_code = getattr(scene, "remotion_code", None) or ""
    if raw_code.strip():
        try:
            desc = json.loads(raw_code)
            if isinstance(desc, dict):
                layout = (
                    desc.get("layout")
                    or desc.get("contentArchetype")
                    or (desc.get("layoutConfig") or {}).get("arrangement")
                )
                if layout:
                    lines.append(f"Layout: {layout}")
                props = desc.get("layoutProps")
                if isinstance(props, dict) and props:
                    compact = _compact_layout_props(props)
                    if compact:
                        lines.append(
                            "Layout props: "
                            + json.dumps(compact, ensure_ascii=False)
                        )
        except (json.JSONDecodeError, TypeError):
            pass

    if not lines:
        return "(No additional scene metadata.)"
    return "\n".join(lines)
