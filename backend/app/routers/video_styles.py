from datetime import datetime
from typing import Literal

import dspy
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.dspy_modules import ensure_dspy_configured, get_preference_lm
from app.models.custom_video_style import CustomVideoStyle
from app.models.script_preference_learning_job import ScriptPreferenceLearningJob
from app.models.user import User
from app.models.user_video_style import UserBuiltinVideoStyle, UserVideoStyleSettings, UserVideoStyleSlot
from app.services.script_preferences import normalize_profile
from app.services.video_styles import (
    BUILTIN_STYLE_META,
    BUILTIN_STYLE_DEFAULT_GUIDANCE,
    DEFAULT_STYLE_IDS,
    EDITABLE_BUILTIN_STYLE_IDS,
    MAX_SELECTED_STYLES,
    MIN_SELECTED_STYLES,
    auto_add_learned_style,
    backfill_to_minimum,
    builtin_style_overrides,
    custom_style_ref,
    effective_selection,
    explicit_selection,
    parse_custom_style_ref,
    replace_selection,
)

router = APIRouter(prefix="/api/video-styles", tags=["video-styles"])


class CustomStyleBody(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    guidance: str = Field(min_length=1, max_length=2000)
    creation_method: Literal["manual", "ai"] = "manual"
    source_prompt: str | None = Field(default=None, max_length=1000)
    # Optional so creation (which has no prior version) can omit it; required
    # in practice for PATCH via the endpoint's own check below.
    version: int | None = Field(default=None, ge=0)


class SelectionBody(BaseModel):
    style_ids: list[str]


class YourStyleBody(BaseModel):
    guidance: str = Field(min_length=1, max_length=2000)
    version: int = Field(ge=0)


class BuiltinStyleBody(BaseModel):
    guidance: str = Field(min_length=1, max_length=2000)
    version: int = Field(ge=0)


class AIDraftBody(BaseModel):
    prompt: str = Field(min_length=20, max_length=1000)


class DesignVideoStyle(dspy.Signature):
    """
    Turn the user's description into a reusable video-script writing style.
    Capture tone, pacing, hooks, transitions, sentence length, terminology,
    narrative structure, and display-text density. Never include article facts,
    people, brands, places, numbers, visual layouts, or voice-engine settings.
    Return a short distinctive one-word name and concise guidance bullets
    covering every distinct preference.
    If the user's description does not itself state a narration length
    preference, include this bullet verbatim in guidance: "Keep each scene's
    narration between 12 and 25 words." Never include it if the user's own
    description already specifies a different length.
    """
    prompt: str = dspy.InputField()
    name: str = dspy.OutputField()
    guidance: str = dspy.OutputField()


def _serialize_custom(style: CustomVideoStyle, pinned_target: str | None = None) -> dict:
    return {
        "id": custom_style_ref(style.id),
        "custom_id": style.id,
        "name": style.name,
        "description": style.guidance,
        "guidance": style.guidance,
        "kind": "custom",
        "editable": True,
        "creation_method": style.creation_method,
        "source_prompt": style.source_prompt,
        "version": style.version,
        "created_at": style.created_at,
        "updated_at": style.updated_at,
        "pinned": pinned_target == custom_style_ref(style.id),
    }


def _serialize_builtin(
    key: str, override: UserBuiltinVideoStyle | None = None, pinned_target: str | None = None
) -> dict:
    editable = key in EDITABLE_BUILTIN_STYLE_IDS
    default_guidance = BUILTIN_STYLE_DEFAULT_GUIDANCE.get(key)
    return {
        "id": key,
        "name": BUILTIN_STYLE_META[key][0],
        "description": BUILTIN_STYLE_META[key][1],
        "guidance": (
            override.guidance
            if override is not None
            else default_guidance or BUILTIN_STYLE_META[key][1]
        ),
        "kind": "builtin",
        "editable": editable,
        "available": True,
        "customized": override is not None,
        "version": override.version if override is not None else 0,
        "default_guidance": default_guidance,
        "updated_at": override.updated_at if override is not None else None,
        "pinned": key == pinned_target,
    }


def _required_trimmed(value: str, field_name: str, *, minimum: int = 1) -> str:
    cleaned = value.strip()
    if len(cleaned) < minimum:
        raise HTTPException(
            status_code=422,
            detail=f"{field_name} must contain at least {minimum} non-whitespace characters.",
        )
    return cleaned


@router.get("")
def list_video_styles(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.services.script_preferences import resolve_pinned_target
    pinned_target, _ = resolve_pinned_target(db, user)

    selected = effective_selection(db, user)
    overrides = builtin_style_overrides(db, user.id)
    builtins = [_serialize_builtin(key, overrides.get(key), pinned_target) for key in DEFAULT_STYLE_IDS]
    builtins.append({
        "id": "your_style",
        "name": BUILTIN_STYLE_META["your_style"][0],
        "description": BUILTIN_STYLE_META["your_style"][1],
        "guidance": user.script_preferences or "",
        "kind": "learned",
        "editable": True,
        "available": bool((user.script_preferences or "").strip()),
        "version": user.script_preferences_version or 0,
        "pinned": pinned_target == "your_style",
    })
    custom = (
        db.query(CustomVideoStyle)
        .filter(CustomVideoStyle.user_id == user.id)
        .order_by(CustomVideoStyle.updated_at.desc())
        .all()
    )
    return {
        "styles": [*builtins, *[_serialize_custom(style, pinned_target) for style in custom]],
        "selected_ids": selected,
        "auto_style": {
            "id": "auto",
            "name": BUILTIN_STYLE_META["auto"][0],
            "description": BUILTIN_STYLE_META["auto"][1],
        },
        "max_selected": MAX_SELECTED_STYLES,
        "min_selected": MIN_SELECTED_STYLES,
        "your_style_version": user.script_preferences_version or 0,
        "pinned_target": pinned_target,
    }


def _editable_builtin_key(style_key: str) -> str:
    key = (style_key or "").strip().lower()
    if key not in EDITABLE_BUILTIN_STYLE_IDS:
        raise HTTPException(status_code=404, detail="Editable built-in video style not found.")
    return key


@router.patch("/builtin/{style_key}")
def update_builtin_style(
    style_key: str,
    body: BuiltinStyleBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    key = _editable_builtin_key(style_key)
    guidance = _required_trimmed(body.guidance, "Guidance")
    override = (
        db.query(UserBuiltinVideoStyle)
        .filter(
            UserBuiltinVideoStyle.user_id == user.id,
            UserBuiltinVideoStyle.builtin_key == key,
        )
        .first()
    )
    if override is None:
        if body.version != 0:
            raise HTTPException(status_code=409, detail="This style changed while you were editing it. Reload and try again.")
        override = UserBuiltinVideoStyle(
            user_id=user.id,
            builtin_key=key,
            guidance=guidance,
            version=1,
        )
        db.add(override)
    else:
        if override.version != body.version:
            raise HTTPException(status_code=409, detail="This style changed while you were editing it. Reload and try again.")
        override.guidance = guidance
        override.version += 1
        override.updated_at = datetime.utcnow()
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="This style changed while you were editing it. Reload and try again.")
    db.refresh(override)
    return _serialize_builtin(key, override)


@router.delete("/builtin/{style_key}")
def reset_builtin_style(
    style_key: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    key = _editable_builtin_key(style_key)
    db.query(UserBuiltinVideoStyle).filter(
        UserBuiltinVideoStyle.user_id == user.id,
        UserBuiltinVideoStyle.builtin_key == key,
    ).delete(synchronize_session=False)
    db.commit()
    return _serialize_builtin(key)


@router.post("/ai-draft")
async def generate_style_draft(body: AIDraftBody, user: User = Depends(get_current_user)):
    del user
    prompt = _required_trimmed(body.prompt, "Prompt", minimum=20)
    ensure_dspy_configured()
    # This is a short structured writing-style extraction task. GLM 5.3 already
    # performs mandatory internal reasoning, so adding DSPy's ChainOfThought
    # would spend more tokens and latency on a second rationale pass.
    predictor = dspy.asyncify(dspy.Predict(DesignVideoStyle))
    with dspy.context(lm=get_preference_lm()):
        result = await predictor(prompt=prompt)
    name = " ".join((getattr(result, "name", "") or "").split()).strip("-: ")[:80]
    guidance = normalize_profile(getattr(result, "guidance", "") or "")
    if not name or not guidance:
        raise HTTPException(status_code=502, detail="The AI could not create a reusable style. Try a more specific prompt.")
    return {"name": name, "guidance": guidance}


@router.post("/custom")
def create_custom_style(body: CustomStyleBody, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    style = CustomVideoStyle(
        user_id=user.id,
        name=_required_trimmed(body.name, "Name"),
        guidance=_required_trimmed(body.guidance, "Guidance"),
        creation_method=body.creation_method,
        source_prompt=(body.source_prompt or "").strip() or None,
    )
    db.add(style)
    db.flush()
    new_style_ref = custom_style_ref(style.id)

    # A style created from the Video Styles screen is intended for immediate
    # use in Step 2. Keep creation and selection in the same transaction so a
    # successful Save never leaves the new style hidden from the picker.
    selected = explicit_selection(db, user.id)
    if selected:
        if len(selected) >= MAX_SELECTED_STYLES:
            # The uncommon full-capacity case still needs a repack so the new
            # style replaces the oldest visible choice.
            selected_after = replace_selection(
                db, user, [*selected[1:], new_style_ref]
            )
        else:
            # Normal path: append one row instead of deleting and recreating
            # every selected style. This keeps Save to a small DB transaction.
            db.add(UserVideoStyleSlot(
                user_id=user.id,
                position=len(selected),
                custom_style_id=style.id,
            ))
            selected_after = [*selected, new_style_ref]
    else:
        # A user with no persisted slots sees the virtual defaults. Materialize
        # those defaults once, together with the newly created custom style.
        virtual_selection = list(DEFAULT_STYLE_IDS)
        if (user.script_preferences or "").strip():
            settings = db.get(UserVideoStyleSettings, user.id)
            if not (settings and settings.learned_style_dismissed):
                virtual_selection.append("your_style")
        for position, style_ref in enumerate(
            [*virtual_selection, new_style_ref]
        ):
            custom_id = style.id if style_ref == new_style_ref else None
            db.add(UserVideoStyleSlot(
                user_id=user.id,
                position=position,
                builtin_key=None if custom_id is not None else style_ref,
                custom_style_id=custom_id,
            ))
        selected_after = [*virtual_selection, new_style_ref]

    response = _serialize_custom(style)
    response["selected_ids"] = selected_after
    db.commit()
    return response


def _owned_style(db: Session, user_id: int, style_id: int) -> CustomVideoStyle:
    style = db.query(CustomVideoStyle).filter(
        CustomVideoStyle.id == style_id, CustomVideoStyle.user_id == user_id
    ).first()
    if not style:
        raise HTTPException(status_code=404, detail="Custom video style not found.")
    return style


@router.patch("/custom/{style_id}")
def update_custom_style(style_id: int, body: CustomStyleBody, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    style = _owned_style(db, user.id, style_id)
    if body.version is not None and body.version != style.version:
        raise HTTPException(status_code=409, detail="This style changed while you were editing it. Reload and try again.")
    style.name = _required_trimmed(body.name, "Name")
    style.guidance = _required_trimmed(body.guidance, "Guidance")
    style.version += 1
    style.updated_at = datetime.utcnow()
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="This style changed while you were editing it. Reload and try again.")
    db.refresh(style)
    return _serialize_custom(style)


@router.delete("/custom/{style_id}")
def delete_custom_style(style_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    style = _owned_style(db, user.id, style_id)
    deleted_ref = custom_style_ref(style_id)
    stored_selection = explicit_selection(db, user.id)
    was_selected = deleted_ref in stored_selection
    settings = db.get(UserVideoStyleSettings, user.id)

    if was_selected:
        selected = backfill_to_minimum(
            [ref for ref in stored_selection if ref != deleted_ref]
        )
        # These references came from this user's existing slot rows, so there
        # is no need to re-query ownership and validate every style again.
        # Repack once to close the deleted position without issuing the extra
        # reads performed by replace_selection().
        db.query(UserVideoStyleSlot).filter(
            UserVideoStyleSlot.user_id == user.id
        ).delete(synchronize_session=False)
        db.flush()
        for position, style_ref in enumerate(selected):
            custom_id = parse_custom_style_ref(style_ref)
            db.add(UserVideoStyleSlot(
                user_id=user.id,
                position=position,
                builtin_key=None if custom_id is not None else style_ref,
                custom_style_id=custom_id,
            ))
    else:
        # A custom style only appears in an effective selection through an
        # explicit slot, so an unselected deletion does not need to rewrite
        # the user's selection at all.
        selected = list(stored_selection or DEFAULT_STYLE_IDS)
        if (
            not stored_selection
            and (user.script_preferences or "").strip()
            and not (settings and settings.learned_style_dismissed)
        ):
            selected.append("your_style")

    db.delete(style)
    # A pin pointing at a now-deleted custom style would dangle — reset it
    # back to the one fallback value (resolve_pinned_target degrades the same
    # way even if this is ever missed, but clearing it here avoids a
    # confusing "pinned" badge on a style that no longer exists).
    if (
        was_selected
        and settings is None
        and (user.script_preferences or "").strip()
        and "your_style" not in selected
    ):
        settings = UserVideoStyleSettings(user_id=user.id)
        db.add(settings)
    if was_selected and settings:
        if "your_style" in selected:
            settings.learned_style_dismissed = False
        elif (user.script_preferences or "").strip():
            settings.learned_style_dismissed = True
        settings.updated_at = datetime.utcnow()
    if settings and settings.pinned_learning_target == deleted_ref:
        settings.pinned_learning_target = "your_style"
        settings.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True, "selected_ids": selected}


class PinTargetBody(BaseModel):
    target_ref: str = Field(min_length=1)


@router.put("/pin")
def set_pinned_target(body: PinTargetBody, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Pin the active target for background preference-learning merges.

    There is no separate "unpin" — this endpoint is also how a user goes back
    to Your Style, by pinning "your_style" explicitly.
    """
    target_ref = body.target_ref.strip()
    if target_ref == "auto":
        raise HTTPException(status_code=422, detail="Auto cannot be pinned as a learning target.")
    if target_ref == "your_style":
        pass
    elif target_ref in EDITABLE_BUILTIN_STYLE_IDS:
        pass
    else:
        custom_id = None
        if target_ref.startswith("custom:") and target_ref.removeprefix("custom:").isdigit():
            custom_id = int(target_ref.removeprefix("custom:"))
        if custom_id is None:
            raise HTTPException(status_code=422, detail=f"Unknown video style: {target_ref}")
        _owned_style(db, user.id, custom_id)

    settings = db.get(UserVideoStyleSettings, user.id)
    if settings is None:
        settings = UserVideoStyleSettings(user_id=user.id)
        db.add(settings)
    settings.pinned_learning_target = target_ref
    settings.updated_at = datetime.utcnow()
    db.commit()
    return {"pinned_target": target_ref}


@router.put("/selection")
def update_selection(body: SelectionBody, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    selected = replace_selection(db, user, body.style_ids)
    db.commit()
    return {"selected_ids": selected, "max_selected": MAX_SELECTED_STYLES, "min_selected": MIN_SELECTED_STYLES}


@router.patch("/your-style")
def update_your_style(body: YourStyleBody, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    guidance = normalize_profile(_required_trimmed(body.guidance, "Guidance"))
    if not guidance:
        raise HTTPException(status_code=422, detail="Your Style must contain at least one reusable writing preference.")
    now = datetime.utcnow()
    changed = db.execute(
        update(User)
        .where(
            User.id == user.id,
            User.script_preferences_version == body.version,
        )
        .values(
            script_preferences=guidance,
            script_preferences_version=body.version + 1,
            script_preferences_updated_at=now,
        )
    )
    if changed.rowcount != 1:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Your Style changed while you were editing it. Reload and try again.",
        )
    db.refresh(user)
    auto_add_learned_style(db, user)
    db.commit()
    return {
        "guidance": guidance,
        "version": user.script_preferences_version,
        "updated_at": user.script_preferences_updated_at,
    }


@router.delete("/your-style")
def delete_your_style(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Permanently clear the learned "Your Style" profile.

    Erases every trace of it: the profile text, every ScriptPreferenceLearningJob
    row for this user (including completed ones — their evidence_json holds
    the raw scene-edit text that fed the profile), and its slot in the Step-2
    selection. This is also safe against a job mid-merge: every re-fetch of the
    job row in process_preference_learning_job already handles "row is gone"
    by returning early, so deleting the row while a merge is in flight just
    makes that merge a no-op instead of erroring. Future accepted edits start
    learning a fresh profile from scratch, same as a brand-new user.
    """
    now = datetime.utcnow()
    selected = [ref for ref in effective_selection(db, user) if ref != "your_style"]
    selected = backfill_to_minimum(selected)

    # Keep DELETE idempotent so a browser retry or double click still succeeds.
    # Only advance the version when there was a profile to invalidate.
    if (user.script_preferences or "").strip():
        user.script_preferences_version = (user.script_preferences_version or 0) + 1
    user.script_preferences = None
    user.script_preferences_updated_at = None

    # Erase every learning-job row for this user, not just active ones — a
    # completed/failed row's evidence_json still holds raw before/after scene
    # text from the edits that fed the now-deleted profile, and nothing else
    # in the app reads old rows (they're write-once processing records).
    db.query(ScriptPreferenceLearningJob).filter(
        ScriptPreferenceLearningJob.user_id == user.id,
    ).delete(synchronize_session=False)
    db.flush()
    replace_selection(db, user, selected)
    # Deleting the profile is not a "dismissal" — leave the flag clear so a
    # future re-learned profile gets auto-added back without the user having
    # to manually re-select it (mirrors a brand-new user's default state).
    settings = db.get(UserVideoStyleSettings, user.id)
    if settings:
        settings.learned_style_dismissed = False
        settings.updated_at = now
    db.commit()
    return {"ok": True, "selected_ids": selected}
