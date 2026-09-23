"""User-managed writing styles and the ordered Step 2 style picker."""
from __future__ import annotations

from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.custom_video_style import CustomVideoStyle
from app.models.user import User
from app.models.user_video_style import (
    UserBuiltinVideoStyle,
    UserVideoStyleSettings,
    UserVideoStyleSlot,
)

MAX_SELECTED_STYLES = 9
MIN_SELECTED_STYLES = 3
DEFAULT_STYLE_IDS = ["explainer", "storytelling", "promotional"]
BUILTIN_STYLE_IDS = set(DEFAULT_STYLE_IDS) | {"your_style", "auto"}
EDITABLE_BUILTIN_STYLE_IDS = {"explainer", "storytelling", "promotional"}
BUILTIN_STYLE_META = {
    "auto": ("Auto", "AI picks the best style for the article."),
    "explainer": ("Explainer", "Educational, clear, and logically structured."),
    "storytelling": ("Storytelling", "Narrative, emotional, and story-driven."),
    "promotional": ("Promotional", "Persuasive, benefit-focused, and action-oriented."),
    "your_style": ("Your Style", "Your learned tone, pacing, and narrative preferences."),
}

# These are the authoritative defaults shown in the editor and supplied to
# generation whenever the user has not customized that preset. Keep style
# behavior here rather than duplicating it across DSPy signatures.
BUILTIN_STYLE_DEFAULT_GUIDANCE = {
    "explainer": """- Use a clear, factual, polished documentary-narrator tone.
- Explain ideas in a logical order: context → key idea → evidence or example → takeaway.
- Use concise, informative phrasing with useful context and insight.
- Keep each scene's narration between 12 and 25 words.
- Avoid advertising language, exaggerated claims, hype, and fictional dramatization.
- Make transitions between scenes feel natural and logically connected.""",
    "storytelling": """- Structure the video as a connected narrative: setup → inciting moment → progression → challenge → resolution.
- Make every scene build naturally on the previous scene.
- Use an engaging, human storyteller voice with emotional continuity.
- Use natural progression cues such as “then,” “next,” “after that,” and “finally.”
- Keep each scene's narration between 15 and 30 words.
- Avoid lecture-style explanations and advertising slogans unless required by the source.""",
    "promotional": """- Use a persuasive, energetic, advertisement-style voice throughout the video.
- Prioritize the value proposition, benefits, transformation, and urgency.
- Structure the video as: hook → problem → solution → benefits or features → call to action.
- Use confident, benefit-led, action-oriented phrasing.
- Keep each scene's narration between 10 and 18 words.
- Do not invent product claims, statistics, benefits, or social proof.""",
}


def builtin_style_overrides(db: Session, user_id: int) -> dict[str, UserBuiltinVideoStyle]:
    return {
        row.builtin_key: row
        for row in db.query(UserBuiltinVideoStyle)
        .filter(UserBuiltinVideoStyle.user_id == user_id)
        .all()
    }


def effective_builtin_guidance(
    db: Session, user_id: int, builtin_key: str
) -> str:
    if builtin_key not in EDITABLE_BUILTIN_STYLE_IDS:
        raise ValueError(f"Not an editable built-in style: {builtin_key}")
    override = (
        db.query(UserBuiltinVideoStyle)
        .filter(
            UserBuiltinVideoStyle.user_id == user_id,
            UserBuiltinVideoStyle.builtin_key == builtin_key,
        )
        .first()
    )
    return (override.guidance if override else BUILTIN_STYLE_DEFAULT_GUIDANCE[builtin_key]).strip()


def custom_style_ref(style_id: int) -> str:
    return f"custom:{style_id}"


def parse_custom_style_ref(value: str) -> int | None:
    if not value.startswith("custom:"):
        return None
    raw = value.removeprefix("custom:")
    if not raw.isdigit():
        return None
    style_id = int(raw)
    if style_id <= 0 or raw != str(style_id):
        return None
    return style_id


def _settings(db: Session, user_id: int, *, create: bool = False) -> UserVideoStyleSettings | None:
    settings = db.get(UserVideoStyleSettings, user_id)
    if settings is None and create:
        settings = UserVideoStyleSettings(user_id=user_id)
        db.add(settings)
    return settings


def explicit_selection(db: Session, user_id: int) -> list[str]:
    rows = (
        db.query(UserVideoStyleSlot)
        .filter(UserVideoStyleSlot.user_id == user_id)
        .order_by(UserVideoStyleSlot.position.asc())
        .all()
    )
    return [
        row.builtin_key if row.builtin_key else custom_style_ref(row.custom_style_id)
        for row in rows
    ]


def effective_selection(db: Session, user: User) -> list[str]:
    selected = explicit_selection(db, user.id)
    if selected:
        # Rows saved while MAX_SELECTED_STYLES was higher (or seeded directly)
        # can exceed today's cap; keep the picker within it without silently
        # dropping the user's stored slot rows.
        return selected[:MAX_SELECTED_STYLES]
    selected = list(DEFAULT_STYLE_IDS)
    settings = _settings(db, user.id)
    if user.script_preferences and not (settings and settings.learned_style_dismissed):
        selected.append("your_style")
    return selected


def validate_style_refs(db: Session, user: User, style_ids: list[str]) -> None:
    if not MIN_SELECTED_STYLES <= len(style_ids) <= MAX_SELECTED_STYLES:
        raise HTTPException(
            status_code=422,
            detail=f"Choose between {MIN_SELECTED_STYLES} and {MAX_SELECTED_STYLES} video styles.",
        )
    if len(style_ids) != len(set(style_ids)):
        raise HTTPException(status_code=422, detail="Video style selections cannot contain duplicates.")
    custom_ids: list[int] = []
    for style_id in style_ids:
        if style_id == "auto":
            raise HTTPException(
                status_code=422, detail="Auto cannot be added to or removed from Video Styles."
            )
        if style_id in DEFAULT_STYLE_IDS:
            continue
        if style_id == "your_style":
            if not (user.script_preferences or "").strip():
                raise HTTPException(status_code=422, detail="Your Style has no saved guidance yet.")
            continue
        custom_id = parse_custom_style_ref(style_id)
        if custom_id is None:
            raise HTTPException(status_code=422, detail=f"Unknown video style: {style_id}")
        custom_ids.append(custom_id)
    if custom_ids:
        owned = {
            row[0]
            for row in db.query(CustomVideoStyle.id)
            .filter(CustomVideoStyle.user_id == user.id, CustomVideoStyle.id.in_(custom_ids))
            .all()
        }
        if owned != set(custom_ids):
            raise HTTPException(status_code=404, detail="One or more custom video styles were not found.")


def replace_selection(db: Session, user: User, style_ids: list[str]) -> list[str]:
    validate_style_refs(db, user, style_ids)
    previous = effective_selection(db, user)
    db.query(UserVideoStyleSlot).filter(UserVideoStyleSlot.user_id == user.id).delete(
        synchronize_session=False
    )
    db.flush()
    for position, style_id in enumerate(style_ids):
        custom_id = parse_custom_style_ref(style_id)
        db.add(UserVideoStyleSlot(
            user_id=user.id,
            position=position,
            builtin_key=None if custom_id is not None else style_id,
            custom_style_id=custom_id,
        ))
    settings = _settings(db, user.id, create=True)
    if "your_style" in style_ids:
        settings.learned_style_dismissed = False
    elif "your_style" in previous or user.script_preferences:
        settings.learned_style_dismissed = True
    settings.updated_at = datetime.utcnow()
    return style_ids


def auto_add_learned_style(db: Session, user: User) -> None:
    """Append Your Style once it has guidance, unless the user dismissed it.

    When all MAX_SELECTED_STYLES slots are already taken, evicts whichever slot
    has occupied its spot the longest (earliest UserVideoStyleSlot.created_at) to
    make room — a freshly learned style must always reach Step 2, not silently
    fail to appear because the user's slots happened to be full.
    """
    if not (user.script_preferences or "").strip():
        return
    settings = _settings(db, user.id)
    if settings and settings.learned_style_dismissed:
        return
    selected = explicit_selection(db, user.id)
    # With no explicit rows the effective virtual selection already includes it.
    if not selected or "your_style" in selected:
        return
    if len(selected) >= MAX_SELECTED_STYLES:
        oldest = (
            db.query(UserVideoStyleSlot)
            .filter(UserVideoStyleSlot.user_id == user.id)
            .order_by(UserVideoStyleSlot.created_at.asc())
            .first()
        )
        if oldest is None:
            return
        db.delete(oldest)
        db.flush()
        remaining = explicit_selection(db, user.id)
        # Repack positions to close the gap left by the deleted slot (position
        # is 0..4 under a UNIQUE(user_id, position) constraint).
        db.query(UserVideoStyleSlot).filter(UserVideoStyleSlot.user_id == user.id).delete(
            synchronize_session=False
        )
        db.flush()
        for pos, style_id in enumerate(remaining):
            custom_id = parse_custom_style_ref(style_id)
            db.add(UserVideoStyleSlot(
                user_id=user.id, position=pos,
                builtin_key=None if custom_id is not None else style_id,
                custom_style_id=custom_id,
            ))
        selected = remaining
    db.add(UserVideoStyleSlot(
        user_id=user.id, position=len(selected), builtin_key="your_style"
    ))


def backfill_to_minimum(selected: list[str]) -> list[str]:
    """Pad a selection back up to MIN_SELECTED_STYLES after a removal.

    Fills with default builtins not already present, in their usual order.
    DEFAULT_STYLE_IDS has exactly MIN_SELECTED_STYLES entries, so this always
    reaches the floor (the style that was just removed can't itself be one of
    the candidates added back, since it's no longer in `selected`... unless it
    was a default, in which case a different default fills its place).
    """
    result = list(selected)
    for candidate in DEFAULT_STYLE_IDS:
        if len(result) >= MIN_SELECTED_STYLES:
            break
        if candidate not in result:
            result.append(candidate)
    return result


def resolve_custom_style(db: Session, user_id: int, style_ref: str) -> CustomVideoStyle | None:
    custom_id = parse_custom_style_ref(style_ref)
    if custom_id is None:
        return None
    return (
        db.query(CustomVideoStyle)
        .filter(CustomVideoStyle.id == custom_id, CustomVideoStyle.user_id == user_id)
        .first()
    )
