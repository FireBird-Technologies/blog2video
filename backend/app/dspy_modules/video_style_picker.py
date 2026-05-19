"""
Pick the best video_style for a piece of scraped blog content.

Invoked when the user selects "Auto" in the blog URL form. Resolves to one of
{explainer, promotional, storytelling} based on the article's tone and content.
Runs between scrape and script generation.
"""
import dspy

from app.dspy_modules import ensure_dspy_configured, get_scene_lm
from app.observability.logging import get_logger

logger = get_logger(__name__)

_VALID_STYLES = {"explainer", "promotional", "storytelling"}
_DEFAULT_STYLE = "explainer"
_MAX_CONTENT_CHARS = 2000


class PickVideoStyle(dspy.Signature):
    """
    You are choosing the video style that best fits a blog article that will be turned into a short video.

    ═══ STYLE OPTIONS ═══
    - "explainer": educational, tutorial, technical breakdown, how-to, deep-dive. Article teaches, defines, or analyzes a concept.
    - "promotional": product launch, marketing announcement, brand story, feature highlight, hype-piece. Article sells or celebrates.
    - "storytelling": narrative, opinion essay, history piece, case study, personal journey. Article tells a story or argues a point.

    ═══ YOUR TASK ═══
    Read the article excerpt and pick the SINGLE best style. Output one of: explainer, promotional, storytelling.
    No other words. Lowercase. No punctuation.
    """

    blog_content: str = dspy.InputField(desc="Article text (may be truncated)")
    video_style: str = dspy.OutputField(desc="One of: explainer, promotional, storytelling")


async def resolve_auto_video_style(blog_content: str) -> str:
    """Resolve video_style="auto" to a concrete style based on scraped content.

    Falls back to "explainer" on empty content, LLM failure, or unrecognized output.
    """
    content = (blog_content or "").strip()
    if not content:
        return _DEFAULT_STYLE

    ensure_dspy_configured()
    predictor = dspy.Predict(PickVideoStyle)
    predictor_async = dspy.asyncify(predictor)

    excerpt = content[:_MAX_CONTENT_CHARS]
    try:
        with dspy.context(lm=get_scene_lm()):
            result = await predictor_async(blog_content=excerpt)
    except Exception as e:
        logger.warning("[VIDEO_STYLE_PICKER] LLM call failed, defaulting to %s: %s", _DEFAULT_STYLE, e)
        return _DEFAULT_STYLE

    style = (result.video_style or "").strip().lower()
    if style not in _VALID_STYLES:
        logger.warning("[VIDEO_STYLE_PICKER] Unrecognized style %r, defaulting to %s", style, _DEFAULT_STYLE)
        return _DEFAULT_STYLE
    return style
