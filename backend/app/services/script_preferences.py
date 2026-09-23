"""Durable, non-blocking learning of reusable writing preferences."""
import asyncio
import re
import threading
from datetime import datetime

import dspy
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.dspy_modules import ensure_dspy_configured, get_preference_lm, get_scene_lm
from app.models.custom_video_style import CustomVideoStyle
from app.models.script_preference_learning_job import ScriptPreferenceLearningJob
from app.models.user import User
from app.models.user_video_style import UserBuiltinVideoStyle
from app.observability.logging import get_logger

logger = get_logger(__name__)
MAX_PROFILE_CHARS = 2000
MAX_ATTEMPTS = 3


def resolve_pinned_target(db: Session, user: User) -> tuple[str, int]:
    """Returns (target_ref, current_version) for the user's active learning target.

    target_ref is a VideoStyleId string: "your_style", an editable builtin key,
    or "custom:N". Falls back to "your_style" if the user has never pinned
    anything, or if the pinned style was since deleted/is otherwise invalid.
    """
    from app.services.video_styles import (
        EDITABLE_BUILTIN_STYLE_IDS,
        _settings,
        parse_custom_style_ref,
    )

    settings = _settings(db, user.id)
    target_ref = (settings.pinned_learning_target if settings else None) or "your_style"

    if target_ref == "your_style":
        return "your_style", user.script_preferences_version or 0

    if target_ref in EDITABLE_BUILTIN_STYLE_IDS:
        override = (
            db.query(UserBuiltinVideoStyle)
            .filter(
                UserBuiltinVideoStyle.user_id == user.id,
                UserBuiltinVideoStyle.builtin_key == target_ref,
            )
            .first()
        )
        return target_ref, (override.version if override else 0)

    custom_id = parse_custom_style_ref(target_ref)
    if custom_id is not None:
        custom = (
            db.query(CustomVideoStyle)
            .filter(CustomVideoStyle.id == custom_id, CustomVideoStyle.user_id == user.id)
            .first()
        )
        if custom is not None:
            return target_ref, custom.version

    # Pinned target no longer resolves to anything real (deleted custom style,
    # unrecognized ref) — degrade gracefully to the default rather than fail.
    return "your_style", user.script_preferences_version or 0


def read_target_guidance(db: Session, user: User, target_ref: str) -> str:
    """Current guidance text for target_ref, or "" if none yet."""
    from app.services.video_styles import EDITABLE_BUILTIN_STYLE_IDS, parse_custom_style_ref

    if target_ref == "your_style":
        return user.script_preferences or ""

    if target_ref in EDITABLE_BUILTIN_STYLE_IDS:
        override = (
            db.query(UserBuiltinVideoStyle)
            .filter(
                UserBuiltinVideoStyle.user_id == user.id,
                UserBuiltinVideoStyle.builtin_key == target_ref,
            )
            .first()
        )
        return override.guidance if override else ""

    custom_id = parse_custom_style_ref(target_ref)
    if custom_id is not None:
        custom = (
            db.query(CustomVideoStyle)
            .filter(CustomVideoStyle.id == custom_id, CustomVideoStyle.user_id == user.id)
            .first()
        )
        if custom is not None:
            return custom.guidance or ""

    return ""


def write_target_guidance(
    db: Session, user_id: int, target_ref: str, base_version: int, merged: str
) -> bool:
    """Optimistic-concurrency write. Returns True if it won the race (rowcount==1
    for User/CustomVideoStyle, or a successful insert/update for a first-time
    UserBuiltinVideoStyle override)."""
    from app.services.video_styles import EDITABLE_BUILTIN_STYLE_IDS, parse_custom_style_ref

    now = datetime.utcnow()

    if target_ref == "your_style":
        updated = db.execute(
            update(User)
            .where(User.id == user_id, User.script_preferences_version == base_version)
            .values(
                script_preferences=merged,
                script_preferences_version=base_version + 1,
                script_preferences_updated_at=now,
            )
        )
        return updated.rowcount == 1

    if target_ref in EDITABLE_BUILTIN_STYLE_IDS:
        existing = (
            db.query(UserBuiltinVideoStyle)
            .filter(
                UserBuiltinVideoStyle.user_id == user_id,
                UserBuiltinVideoStyle.builtin_key == target_ref,
            )
            .first()
        )
        if existing is None:
            if base_version != 0:
                return False
            db.add(UserBuiltinVideoStyle(
                user_id=user_id, builtin_key=target_ref, guidance=merged, version=1,
            ))
            return True
        updated = db.execute(
            update(UserBuiltinVideoStyle)
            .where(
                UserBuiltinVideoStyle.user_id == user_id,
                UserBuiltinVideoStyle.builtin_key == target_ref,
                UserBuiltinVideoStyle.version == base_version,
            )
            .values(guidance=merged, version=base_version + 1, updated_at=now)
        )
        return updated.rowcount == 1

    custom_id = parse_custom_style_ref(target_ref)
    if custom_id is not None:
        updated = db.execute(
            update(CustomVideoStyle)
            .where(CustomVideoStyle.id == custom_id, CustomVideoStyle.version == base_version)
            .values(guidance=merged, version=base_version + 1, updated_at=now)
        )
        return updated.rowcount == 1

    return False


class MergeWritingPreferences(dspy.Signature):
    """
    Maintain a concise profile of REUSABLE writing preferences inferred from
    accepted script edits. Each evidence item may include a before/after title,
    on-screen body, and spoken narration; compare before vs after in each to
    infer tone, pacing, sentence length, hooks, transitions, terminology and
    on-screen text density. An accepted AI instruction is strong evidence.

    When the same quality, tone, or emotion is requested across multiple
    scenes' accepted AI instructions in this evidence (even worded
    differently — e.g. "add humor" and "make it funnier", or "sound angrier"
    and "more frustrated"), treat that as a confirmed, high-confidence
    preference and ensure the merged profile includes a bullet naming it
    explicitly. A quality mentioned in only one scene's instruction is weaker
    evidence and may be included at your discretion, but a quality repeated
    across multiple scenes' instructions must not be dropped or generalized
    away into a vaguer statement.

    Never retain article facts, people, brands, places, numbers, topic
    details, layout choices, or isolated typo/fact fixes. Merge and
    deduplicate the current profile. Output each distinct reusable preference
    as its own bullet beginning with "- ", and no heading or commentary.
    """
    current_profile: str = dspy.InputField()
    edit_evidence_json: str = dspy.InputField()
    merged_profile: str = dspy.OutputField()


def normalize_profile(value: str, forbidden_tokens: set[str] | None = None) -> str:
    bullets: list[str] = []
    seen: set[str] = set()
    for raw in (value or "").splitlines():
        text = re.sub(r"^\s*(?:[-*•]|\d+[.)])\s*", "", raw).strip()
        text = re.sub(r"\s+", " ", text)
        if not text:
            continue
        lowered = text.lower()
        if re.search(r"https?://|www\.|[$€£]|\b\d{3,}\b", text):
            continue
        if forbidden_tokens and any(re.search(rf"\b{re.escape(token)}\b", lowered) for token in forbidden_tokens):
            continue
        key = re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()
        if not key or key in seen:
            continue
        candidate = f"- {text[:280].rstrip()}"
        if sum(len(item) + 1 for item in bullets) + len(candidate) > MAX_PROFILE_CHARS:
            break
        bullets.append(candidate)
        seen.add(key)
    return "\n".join(bullets)


async def _merge(current: str, evidence_json: str, *, use_fallback: bool = False) -> str:
    ensure_dspy_configured()
    # GLM 5.3 already performs a mandatory internal reasoning pass. Predict
    # avoids stacking DSPy's explicit ChainOfThought field on top of it.
    predictor = dspy.asyncify(dspy.Predict(MergeWritingPreferences))
    # Flash handles the normal low-risk extraction path. The final durable-job
    # attempt falls back to the existing scene model so a temporary Flash
    # outage or repeated malformed response does not lose accepted edits.
    lm = get_scene_lm() if use_fallback else get_preference_lm()
    with dspy.context(lm=lm):
        result = await predictor(
            current_profile=current or "(none yet)",
            edit_evidence_json=evidence_json,
        )
    # A second, deterministic guard catches obvious article entities even if
    # the model disregards the exclusion rule.
    common_style_words = {
        "use", "keep", "prefer", "avoid", "start", "end", "write", "title",
        "display", "narration", "scene", "tone", "style", "short", "long",
        "conversational", "professional", "warm", "direct", "clear", "make",
        "favor", "emphasize", "open", "close", "create", "structure", "maintain",
    }
    proper_nouns = {
        token.lower()
        for token in re.findall(r"\b[A-Z][a-z]{2,}\b", evidence_json)
        if token.lower() not in common_style_words
    }
    return normalize_profile(
        getattr(result, "merged_profile", "") or "", forbidden_tokens=proper_nouns
    )


async def process_preference_learning_job(job_id: int) -> None:
    """Process one job; retries include transient LLM and optimistic conflicts."""
    for _ in range(MAX_ATTEMPTS):
        db = SessionLocal()
        try:
            job = db.get(ScriptPreferenceLearningJob, job_id)
            if not job or job.status in {"completed", "cancelled"}:
                return
            job.status = "running"
            job.attempts = (job.attempts or 0) + 1
            use_fallback = job.attempts >= MAX_ATTEMPTS
            job.updated_at = datetime.utcnow()
            db.commit()
            logger.info(
                "[SCRIPT_PREFERENCES] job=%s status=running attempt=%s/%s model=%s",
                job_id,
                job.attempts,
                MAX_ATTEMPTS,
                "scene-lm-fallback" if use_fallback else "preference-flash",
            )

            user = db.get(User, job.user_id)
            if not user:
                job.status = "cancelled"
                db.commit()
                return
            target_ref = job.target_ref or "your_style"
            _, current_target_version = resolve_pinned_target(db, user)
            current_guidance = read_target_guidance(db, user, target_ref)
            # Clearing increments the version and cancels queued/running rows.
            # This guard also catches a worker that was already holding the job.
            if current_target_version != job.target_version_at_enqueue and not current_guidance:
                job.status = "cancelled"
                job.completed_at = datetime.utcnow()
                db.commit()
                return
            base_version = job.target_version_at_enqueue
            current = current_guidance
            evidence = job.evidence_json
            db.close()
            db = None

            merged = await _merge(
                current,
                evidence,
                use_fallback=use_fallback,
            )
            if not merged:
                raise ValueError("Preference model returned no reusable preferences")

            db = SessionLocal()
            job = db.get(ScriptPreferenceLearningJob, job_id)
            if not job or job.status == "cancelled":
                return
            won_race = write_target_guidance(db, job.user_id, target_ref, base_version, merged)
            if not won_race:
                # Another job won the race. Rebase this job on the new target state.
                db.rollback()
                fresh = db.get(ScriptPreferenceLearningJob, job_id)
                if fresh:
                    latest_user = db.get(User, fresh.user_id)
                    _, latest_version = resolve_pinned_target(db, latest_user)
                    fresh.target_version_at_enqueue = latest_version
                    fresh.status = "queued"
                    db.commit()
                continue
            job.status = "completed"
            job.error_message = None
            job.completed_at = datetime.utcnow()
            if target_ref == "your_style":
                from app.services.video_styles import auto_add_learned_style
                updated_user = db.get(User, job.user_id)
                if updated_user:
                    auto_add_learned_style(db, updated_user)
            db.commit()
            logger.info(
                "[SCRIPT_PREFERENCES] job=%s status=completed target=%s version=%s",
                job_id,
                target_ref,
                base_version + 1,
            )
            return
        except Exception as exc:  # noqa: BLE001 - durable retry boundary
            logger.exception("[SCRIPT_PREFERENCES] job=%s attempt failed", job_id)
            if db is None:
                db = SessionLocal()
            db.rollback()
            failed = db.get(ScriptPreferenceLearningJob, job_id)
            if not failed or failed.status == "cancelled":
                return
            failed.error_message = str(exc)[:2000]
            failed.status = "failed" if (failed.attempts or 0) >= MAX_ATTEMPTS else "queued"
            failed.updated_at = datetime.utcnow()
            db.commit()
            if failed.status == "failed":
                return
        finally:
            if db is not None:
                db.close()


def dispatch_preference_learning_job(job_id: int) -> None:
    thread = threading.Thread(
        target=lambda: asyncio.run(process_preference_learning_job(job_id)),
        name=f"script-preference-{job_id}",
        daemon=True,
    )
    thread.start()


def build_edit_evidence(before: list[dict], after: list[dict], instructions: dict[int, list[str]]) -> list[dict]:
    """Return only evidence capable of teaching reusable writing choices."""
    evidence: list[dict] = []
    by_id = {int(item["id"]): item for item in before}
    for edited in after:
        scene_id = int(edited["id"])
        original = by_id.get(scene_id)
        if not original:
            continue
        title_changed = (original.get("title") or "").strip() != (edited.get("title") or "").strip()
        display_changed = (original.get("display_text") or "").strip() != (edited.get("display_text") or "").strip()
        narration_changed = (original.get("narration") or "").strip() != (edited.get("narration") or "").strip()
        prompts = [p.strip()[:1000] for p in instructions.get(scene_id, []) if p.strip()]
        if not title_changed and not display_changed and not narration_changed and not prompts:
            continue
        evidence.append({
            "before": {
                "title": original.get("title") or "",
                "display_text": original.get("display_text") or "",
                "narration": original.get("narration") or "",
            },
            "after": {
                "title": edited.get("title") or "",
                "display_text": edited.get("display_text") or "",
                "narration": edited.get("narration") or "",
            },
            "accepted_ai_instructions": prompts,
        })
    return evidence
