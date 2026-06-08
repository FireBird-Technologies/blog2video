"""
Relevance gate for free-form user instructions captured during script regeneration.

Rejects instructions that are *completely* out of context — i.e. unrelated to both
the blog's subject and the task of editing a video script (e.g. "write me a poem about
cats", "what's the weather"). It is deliberately lenient: any tone/length/structure/
emphasis/wording/"add or remove X" feedback is always in context. On any classifier
error (or when there's no blog text to judge against) it fails OPEN — accepting the
instruction — so a model hiccup can never block a legitimate regeneration.
"""
import dspy

from app.dspy_modules import ensure_dspy_configured, get_scene_lm


class CheckInstructionRelevance(dspy.Signature):
    """Decide whether a user's script-regeneration instruction is in context.

    The user is giving feedback to regenerate the video script for a specific blog.
    Return ``in_context=True`` UNLESS the instruction is entirely unrelated to BOTH:
      (a) the blog's subject matter, AND
      (b) the task of editing/regenerating a video script.

    Instructions about tone, length, pacing, structure, emphasis, wording, or what to
    add/remove/rephrase are ALWAYS in context (they are valid script edits) — even if
    they don't name a specific blog topic. Reject ONLY clear nonsense/gibberish or
    instructions about a completely different subject or task (e.g. "book me a flight",
    "write a poem about cats", "what is 2+2", "translate this song"). When unsure,
    return True.
    """

    user_instruction: str = dspy.InputField(
        desc="Raw free-form text the user submitted to regenerate the script."
    )
    blog_summary: str = dspy.InputField(
        desc="Excerpt of the source blog content, for judging whether the instruction relates to it."
    )

    in_context: bool = dspy.OutputField(
        desc="True if the instruction is a plausible script-editing instruction for this blog; False only if completely unrelated."
    )
    reason: str = dspy.OutputField(
        desc="One short, friendly user-facing sentence explaining the rejection. Only meaningful when in_context is False."
    )


def _coerce_bool(value, default: bool = True) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in ("true", "yes", "1")
    return default


class InstructionRelevanceChecker:
    """Async wrapper around CheckInstructionRelevance. Lenient + fail-open."""

    def __init__(self) -> None:
        ensure_dspy_configured()
        self._check = dspy.Predict(CheckInstructionRelevance)
        self.check_fn = dspy.asyncify(self._check)

    async def check(self, user_instruction: str, blog_summary: str = "") -> dict:
        # Nothing to judge against (e.g. upload-based projects without scraped text) → accept.
        if not (user_instruction or "").strip() or not (blog_summary or "").strip():
            return {"in_context": True, "reason": ""}
        try:
            with dspy.context(lm=get_scene_lm()):
                result = await self.check_fn(
                    user_instruction=user_instruction,
                    blog_summary=blog_summary,
                )
        except Exception:
            # Never block a regeneration because the classifier errored — fail open.
            return {"in_context": True, "reason": ""}
        return {
            "in_context": _coerce_bool(getattr(result, "in_context", True), default=True),
            "reason": (getattr(result, "reason", "") or "").strip(),
        }
