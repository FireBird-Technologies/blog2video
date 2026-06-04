import json
import dspy
from collections import Counter

from sqlalchemy.orm import Session

from app.dspy_modules import ensure_dspy_configured
from app.services.template_service import (
    get_layout_prompt,
    get_prompt,
    get_valid_layouts,
    is_custom_template,
)


# Layout IDs that represent hero / opening / intro slides. Hard-enforced as
# "scene 0 only" by the post-process guard below.
_HERO_LIKE_PREFIXES: tuple[str, ...] = ("hero", "intro", "opening", "title_card")


def _is_hero_like(layout_id: str) -> bool:
    lid = (layout_id or "").lower().strip()
    if not lid:
        return False
    return any(lid.startswith(p) for p in _HERO_LIKE_PREFIXES)


class PlanTemplateLayouts(dspy.Signature):
    """
    Assign preferred layouts for an existing scene sequence.

    You receive scene content, a template layout catalog (the short ID list) and
    the full template prompt (the WHEN-to-use guidance). Return exactly one
    preferred layout per scene, preserving order and minimizing repetition.

    Rules (must mirror script-generation layout policy):
    - Output length MUST equal total_scenes.
    - Use ONLY layout IDs/arrangements present in layout_catalog. The full_prompt
      explains WHEN each is appropriate — consult it for opening / middle /
      closing placement and visual-weight balance.
    - Enforce diversity by video_length:
      - short: >=7 distinct layouts, max 2 uses per layout.
      - medium: >=9 distinct layouts, max 2 uses per layout.
      - detailed: >=10 distinct layouts, max 4 uses per layout.
      - otherwise: >=ceil(total_scenes*0.7) distinct layouts.
    - Never repeat a layout in consecutive scenes.
    - When repeating a layout, keep at least 3-scene spacing where possible.
    - Spread heavy/light layouts across opening/middle/closing; avoid clustering.

    ─── HERO RULE (HARD) ───────────────────────────────────────────────────────
    Hero-like layouts (IDs that are exactly `hero`, or start with `hero_`,
    `intro`, `opening`, or `title_card`) MUST appear AT MOST ONCE in the
    output, and ONLY at index 0. Never assign a hero/opening layout to any
    scene with index > 0. If the catalog contains multiple hero variants
    (e.g. `hero_image`, `hero_split`), pick the most appropriate one for
    scene 0 — do not place the others elsewhere.

    ─── ENDING RULE ────────────────────────────────────────────────────────────
    For templates that support ending_socials, use ending_socials only for the
    last scene if it is clearly a closing CTA; otherwise do not force it.

    ─── USER INSTRUCTION RULE ──────────────────────────────────────────────────
    If user_instruction_summary is non-empty, prefer layouts that best surface
    the user's stated focus areas. The user's directives override stylistic
    defaults when they conflict.
    """

    layout_catalog: str = dspy.InputField(
        desc="Template layout_prompt.md content — the catalog of valid layout IDs."
    )
    full_prompt: str = dspy.InputField(
        desc=(
            "Template's full prompt.md content — contains WHEN-to-use guidance for "
            "each layout (opening vs middle vs closing, weight, frequency limits, "
            "and template-specific rules). Use this to choose layouts that fit each "
            "scene's position and intent, not just the catalog."
        )
    )
    user_instruction_summary: str = dspy.InputField(
        desc=(
            "User's regeneration directives, distilled to imperatives. Empty = no "
            "constraint. If non-empty, prefer layouts that emphasize the user's "
            "focus areas."
        )
    )
    scenes_json: str = dspy.InputField(
        desc='JSON array of scene objects with "title", "narration", "visual_description"'
    )
    total_scenes: int = dspy.InputField(desc="Total number of scenes")
    video_length: str = dspy.InputField(desc="auto | short | medium | detailed | mdetailed")
    content_language: str = dspy.InputField(
        desc="Language for reasoning consistency with scene content"
    )

    preferred_layouts_json: str = dspy.OutputField(
        desc='JSON array of strings: one preferred layout per scene index'
    )


class TemplateLayoutPlanner:
    def __init__(
        self,
        template_id: str,
        db: Session | None = None,
        user_id: int | None = None,
        user_instruction_summary: str = "",
    ):
        ensure_dspy_configured()
        self.template_id = template_id
        # Pass db/user_id so custom and crafted templates can load their
        # per-user prompts (previously this defaulted to None and produced
        # an empty catalog for non-built-in templates).
        self.layout_catalog = get_layout_prompt(template_id, db=db, user_id=user_id)
        try:
            self.full_prompt = get_prompt(template_id, db=db, user_id=user_id)
        except Exception:
            self.full_prompt = ""
        self.user_instruction_summary = (user_instruction_summary or "").strip()
        self._planner = dspy.ChainOfThought(PlanTemplateLayouts)
        self.plan = dspy.asyncify(self._planner)

        if is_custom_template(template_id):
            # Custom templates use universal arrangements, validated by scene generator.
            self.valid_layouts = set()
        else:
            self.valid_layouts = get_valid_layouts(template_id)
        if "ending_socials" in self.valid_layouts:
            self.ending_layout: str | None = "ending_socials"
        elif "ending_cta" in self.valid_layouts:
            self.ending_layout = "ending_cta"
        else:
            self.ending_layout = None

    def _normalize_layout(self, raw: object) -> str:
        if not isinstance(raw, str):
            return ""
        return raw.strip()

    @staticmethod
    def _targets(total_scenes: int, video_length: str) -> tuple[int, int]:
        v = (video_length or "auto").strip().lower()
        if v == "short":
            return 7, 2
        if v == "medium":
            return 9, 2
        if v == "detailed":
            return 10, 4
        return int((total_scenes * 0.7) + 0.9999), 2

    def _catalog_candidates(self, layouts: list[str]) -> list[str]:
        if self.valid_layouts:
            return sorted(self.valid_layouts)
        seen = []
        for v in layouts:
            if v and v not in seen:
                seen.append(v)
        return seen

    @staticmethod
    def _pick_replacement(
        idx: int,
        candidates: list[str],
        current: list[str],
        usage: Counter,
        max_per_layout: int,
    ) -> str:
        prev = current[idx - 1] if idx > 0 else None
        best = ""
        best_score = 10**9
        for c in candidates:
            if not c:
                continue
            if c == prev:
                continue
            if usage[c] >= max_per_layout:
                continue
            # Prefer layouts used less and with better spacing from last use.
            last_pos = -1000
            for p in range(idx - 1, -1, -1):
                if current[p] == c:
                    last_pos = p
                    break
            distance = idx - last_pos
            penalty = 0 if distance >= 3 else (3 - distance) * 10
            score = usage[c] * 5 + penalty
            if score < best_score:
                best_score = score
                best = c
        return best

    def _enforce_policy(self, layouts: list[str], total_scenes: int, video_length: str) -> list[str]:
        target_distinct, max_per_layout = self._targets(total_scenes, video_length)
        out = list(layouts)
        candidates = self._catalog_candidates(out)
        if not candidates:
            return out

        usage = Counter([x for x in out if x])

        # Fill blanks and break consecutive repeats.
        for i in range(total_scenes):
            if not out[i] or (i > 0 and out[i] == out[i - 1]):
                replacement = self._pick_replacement(i, candidates, out, usage, max_per_layout)
                if replacement:
                    if out[i]:
                        usage[out[i]] -= 1
                    out[i] = replacement
                    usage[replacement] += 1

        # Enforce max repeats.
        for layout, count in list(usage.items()):
            while count > max_per_layout:
                changed = False
                for i in range(total_scenes - 1, -1, -1):
                    if out[i] != layout:
                        continue
                    replacement = self._pick_replacement(i, candidates, out, usage, max_per_layout)
                    if replacement and replacement != layout:
                        out[i] = replacement
                        usage[layout] -= 1
                        usage[replacement] += 1
                        count -= 1
                        changed = True
                        break
                if not changed:
                    break

        # Raise distinct count toward target.
        distinct = len({x for x in out if x})
        if distinct < target_distinct:
            unused = [c for c in candidates if c not in set(out)]
            for new_layout in unused:
                if distinct >= target_distinct:
                    break
                # Replace from most frequent layout (respect no consecutive)
                most_common = usage.most_common()
                swapped = False
                for old_layout, _ in most_common:
                    for i in range(total_scenes - 1, -1, -1):
                        if out[i] != old_layout:
                            continue
                        if i > 0 and out[i - 1] == new_layout:
                            continue
                        if i < total_scenes - 1 and out[i + 1] == new_layout:
                            continue
                        out[i] = new_layout
                        usage[old_layout] -= 1
                        usage[new_layout] += 1
                        distinct = len({x for x in out if x})
                        swapped = True
                        break
                    if swapped:
                        break

        # Templates declaring a closer layout (ending_socials or ending_cta) must end on it.
        if self.ending_layout and total_scenes > 0:
            closer = self.ending_layout
            for i in range(total_scenes - 1):
                if out[i] == closer:
                    replacement = ""
                    for c in candidates:
                        if c == closer:
                            continue
                        if i > 0 and out[i - 1] == c:
                            continue
                        if i < total_scenes - 1 and out[i + 1] == c:
                            continue
                        replacement = c
                        break
                    if replacement:
                        out[i] = replacement
            out[-1] = closer

        return out

    def _coerce_output(self, raw_json: str, total_scenes: int) -> list[str]:
        try:
            parsed = json.loads(raw_json or "[]")
        except Exception:
            parsed = []
        if not isinstance(parsed, list):
            parsed = []

        result: list[str] = []
        for i in range(total_scenes):
            value = self._normalize_layout(parsed[i] if i < len(parsed) else "")
            if self.valid_layouts and value not in self.valid_layouts:
                value = ""
            result.append(value)
        return result

    async def plan_preferred_layouts(
        self,
        scenes_data: list[dict],
        video_length: str = "auto",
        content_language: str = "English",
    ) -> list[str]:
        total_scenes = len(scenes_data)
        if total_scenes == 0:
            return []

        try:
            result = await self.plan(
                layout_catalog=self.layout_catalog or "",
                full_prompt=self.full_prompt or "",
                user_instruction_summary=self.user_instruction_summary,
                scenes_json=json.dumps(scenes_data, ensure_ascii=False),
                total_scenes=total_scenes,
                video_length=(video_length or "auto").strip().lower(),
                content_language=(content_language or "English").strip(),
            )
            coerced = self._coerce_output(result.preferred_layouts_json, total_scenes)
            enforced = self._enforce_policy(coerced, total_scenes, video_length)
            return self._enforce_hero_rule(enforced)
        except Exception:
            return [""] * total_scenes

    def _enforce_hero_rule(self, layouts: list[str]) -> list[str]:
        """Guarantee hero-like layouts appear at most once and only at index 0.

        Even with the signature docstring spelling this out, models occasionally
        leak hero layouts into middle scenes — this is the deterministic backstop.
        """
        if not layouts:
            return layouts

        out = list(layouts)
        # If scene 0 is not hero-like but a later scene is, promote it: move the
        # later hero layout to slot 0 and replace its old slot with a fallback.
        if not _is_hero_like(out[0]):
            for i in range(1, len(out)):
                if _is_hero_like(out[i]):
                    leaked = out[i]
                    out[i] = ""
                    out[0] = leaked
                    break

        # Now strip any remaining hero-like layouts from non-zero slots.
        for i in range(1, len(out)):
            if _is_hero_like(out[i]):
                out[i] = self._pick_fallback_non_hero(used=out, scene_index=i)

        # Re-run blank-fill + repeat-break to keep variety intact after the
        # rewrites above (cheap; idempotent if no changes were made).
        candidates = self._catalog_candidates(out)
        if candidates:
            usage = Counter([x for x in out if x])
            for i in range(len(out)):
                if not out[i] or (i > 0 and out[i] == out[i - 1]):
                    repl = self._pick_replacement(
                        i, candidates, out, usage, max_per_layout=99
                    )
                    if repl:
                        if out[i]:
                            usage[out[i]] -= 1
                        out[i] = repl
                        usage[repl] += 1
        return out

    def _pick_fallback_non_hero(self, used: list[str], scene_index: int) -> str:
        """Pick a non-hero layout that isn't used in the immediately-prior 2 scenes."""
        candidates = self._catalog_candidates(used)
        avoid = {used[scene_index - 1] if scene_index - 1 >= 0 else "",
                 used[scene_index - 2] if scene_index - 2 >= 0 else ""}
        # Preference order: text_narration if present, then any non-hero non-avoid.
        if "text_narration" in candidates and "text_narration" not in avoid:
            return "text_narration"
        for c in candidates:
            if not c:
                continue
            if _is_hero_like(c):
                continue
            if c in avoid:
                continue
            return c
        # Last resort: first non-hero in candidates, even if recently used.
        for c in candidates:
            if c and not _is_hero_like(c):
                return c
        return ""
