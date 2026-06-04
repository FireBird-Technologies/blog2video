"""
Analyzer for free-form user instructions captured during script regeneration.

Takes raw text (textarea + appended .txt/.md content) and distills it into
structured directives that the downstream script generator + layout planner
can treat as hard constraints. Empty fields mean "not specified" — never invent.
"""
import dspy

from app.dspy_modules import ensure_dspy_configured


class AnalyzeUserInstruction(dspy.Signature):
    """Analyze raw user instructions about a video script regeneration and
    produce structured constraints to guide the downstream generators.

    The user may have written free-form feedback or pasted markdown notes
    (sections, bullet lists, examples). Distill the text into discrete
    directives. If a directive type is not mentioned, return an empty string
    for that field — do NOT invent constraints.
    """

    user_instruction: str = dspy.InputField(
        desc=(
            "Raw text from the user — may include tone changes, focus areas, "
            "things to add/remove, style preferences, or arbitrary notes."
        )
    )
    blog_summary: str = dspy.InputField(
        desc=(
            "One-paragraph or short excerpt summary of the source blog content, "
            "used purely for grounding so directives can be interpreted in context."
        )
    )

    must_include: str = dspy.OutputField(
        desc=(
            "Topics, examples, statistics, or phrases the user wants emphasized or "
            "included. Comma-separated short phrases. Empty if none specified."
        )
    )
    must_avoid: str = dspy.OutputField(
        desc=(
            "Topics, phrases, brands, or angles the user wants excluded. "
            "Comma-separated short phrases. Empty if none."
        )
    )
    tone_directives: str = dspy.OutputField(
        desc=(
            "Voice/tone changes (e.g. 'more casual', 'less jargon', "
            "'more enthusiastic'). Empty if none."
        )
    )
    structural_directives: str = dspy.OutputField(
        desc=(
            "Structural changes (e.g. 'fewer scenes', 'shorter intro', "
            "'add a comparison section', 'lead with the conclusion'). Empty if none."
        )
    )
    summary: str = dspy.OutputField(
        desc=(
            "2-3 sentence summary of all directives, suitable for inlining into a "
            "downstream prompt. Phrased as imperatives to the next LLM "
            "(e.g. 'Emphasize X. Avoid Y. Keep the tone Z.'). Empty if no directives."
        )
    )


class UserInstructionAnalyzer:
    """Async wrapper around the AnalyzeUserInstruction signature.

    Returns a dict of stripped strings. Empty input short-circuits to all-empty
    outputs so callers can always rely on the dict shape.
    """

    def __init__(self) -> None:
        ensure_dspy_configured()
        self._analyze = dspy.ChainOfThought(AnalyzeUserInstruction)
        self.analyze = dspy.asyncify(self._analyze)

    async def run(self, user_instruction: str, blog_summary: str = "") -> dict:
        if not (user_instruction or "").strip():
            return self._empty()
        try:
            result = await self.analyze(
                user_instruction=user_instruction,
                blog_summary=blog_summary or "",
            )
        except Exception:
            # Never fail the whole regeneration if the analyzer errors — fall back
            # to inlining the raw text as the summary so downstream still sees it.
            return {
                "must_include": "",
                "must_avoid": "",
                "tone_directives": "",
                "structural_directives": "",
                "summary": user_instruction.strip()[:1500],
            }
        return {
            "must_include": (getattr(result, "must_include", "") or "").strip(),
            "must_avoid": (getattr(result, "must_avoid", "") or "").strip(),
            "tone_directives": (getattr(result, "tone_directives", "") or "").strip(),
            "structural_directives": (
                getattr(result, "structural_directives", "") or ""
            ).strip(),
            "summary": (getattr(result, "summary", "") or "").strip(),
        }

    @staticmethod
    def _empty() -> dict:
        return {
            "must_include": "",
            "must_avoid": "",
            "tone_directives": "",
            "structural_directives": "",
            "summary": "",
        }
