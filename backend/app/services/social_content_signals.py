"""
Heuristics for signals derived from scraped blog text (e.g. which social platforms are referenced).
"""

from __future__ import annotations

import re

ALL_SOCIAL_KEYS: tuple[str, ...] = (
    "facebook",
    "instagram",
    "youtube",
    "medium",
    "substack",
    "linkedin",
    "tiktok",
)


def detect_social_platforms_in_text(text: str | None) -> dict[str, bool]:
    """
    Return which known social platforms appear to be referenced in the scraped content.
    Used to toggle ending-scene icons and to avoid naming platforms in voiceover when absent.
    """
    if not text or not text.strip():
        return {k: False for k in ALL_SOCIAL_KEYS}

    low = text.lower()

    def _has(pat: str) -> bool:
        return re.search(pat, low, re.IGNORECASE) is not None

    return {
        "facebook": _has(
            r"\bfacebook\b|meta\.com/(facebook|people)|fb\.com/|facebook\.com/|\bfollow us on fb\b"
        ),
        "instagram": _has(
            r"\binstagram\b|instagr\.am/|instagram\.com/|\binsta\b(?!\w)|@[\w.]+(?:\s+on\s+)?instagram"
        ),
        "youtube": _has(
            r"\byoutube\b|youtu\.be/|youtube\.com/|\byou\s+tube\b|subscribe\s+on\s+youtube"
        ),
        "medium": _has(r"\bmedium\b|medium\.com/"),
        "substack": _has(r"\bsubstack\b|substack\.com/"),
        "linkedin": _has(r"\blinkedin\b|linked\.in/|linkedin\.com/"),
        "tiktok": _has(r"\btiktok\b|tik\s*tok\b|tiktok\.com/"),
    }


def format_social_platforms_for_script_prompt(flags: dict[str, bool]) -> str:
    """Human-readable hint for the script LLM."""
    labels = []
    mapping = [
        ("facebook", "Facebook"),
        ("instagram", "Instagram"),
        ("youtube", "YouTube"),
        ("medium", "Medium"),
        ("substack", "Substack"),
        ("linkedin", "LinkedIn"),
        ("tiktok", "TikTok"),
    ]
    for key, label in mapping:
        if flags.get(key):
            labels.append(label)
    if not labels:
        return (
            "NONE — the scraped text does not clearly reference specific social platforms. "
            "In the final CTA scene, do NOT invite viewers to follow on Facebook, Instagram, "
            "YouTube, or other networks by name. Ground the CTA in the article topic instead "
            "(e.g. next step, takeaway, revisit the ideas)."
        )
    return (
        "The scraped content references these platforms (only these may be named if you invite "
        "followers): " + ", ".join(labels) + "."
    )
