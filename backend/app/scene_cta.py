"""Helpers for persisting ending-scene CTA button label alongside visual_description (no DB migration)."""

from __future__ import annotations

B2V_CTA_PREFIX = "__B2V_CTA_BUTTON__|"


def strip_b2v_cta_from_visual(visual: str | None) -> tuple[str | None, str]:
    """
    If visual starts with B2V_CTA_PREFIX, return (cta_text, rest_of_visual).
    Otherwise (None, original visual).
    """
    v = visual or ""
    if not v.startswith(B2V_CTA_PREFIX):
        return None, v
    newline = v.find("\n")
    if newline == -1:
        return None, v
    first = v[:newline]
    rest = v[newline + 1 :]
    cta = first[len(B2V_CTA_PREFIX) :].strip()
    return (cta or None), rest


def prepend_b2v_cta_to_visual(cta: str, visual: str) -> str:
    """Store CTA label in visual_description for ending scenes."""
    c = (cta or "").strip()
    if not c:
        return visual
    return f"{B2V_CTA_PREFIX}{c}\n{(visual or '').lstrip()}"
