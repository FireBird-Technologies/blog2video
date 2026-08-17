"""
Turn a video scene into a stock-footage search query.

Replaces a keyword-frequency heuristic that matched words rather than meaning.
That approach kept producing queries that were literally correct and visually
wrong: "Why Sleep Matters" scored `sleep` highest and returned a clip of a
pregnant woman sleeping — nothing in the scene was about pregnancy, but nothing
in the text said otherwise either. Deciding what a scene should *look like*
needs comprehension, not term weighting.

The keyword extractor remains in ``services/stock_relevance.py`` as the fallback
for when this call fails, so a model outage degrades quality rather than
dropping footage.
"""
import asyncio
import re

import dspy

from app.dspy_modules import ensure_dspy_configured, get_scene_lm
from app.observability.logging import get_logger

logger = get_logger(__name__)

# Providers match on a handful of words; more than this dilutes the search.
_MAX_QUERY_WORDS = 4
# Matches the manual picker's input cap (StockFootageModal.tsx).
_MAX_QUERY_CHARS = 80
# Long narration adds cost without changing the visual subject.
_MAX_NARRATION_CHARS = 600
# Long videos are the case that matters: at 45 scenes this is the difference
# between ~25s and ~14s wall (measured, uncached, 45/45 succeeding). Kept at 8
# rather than higher because this task runs concurrently with descriptor
# generation, which is the heavier LLM stage — the goal is to fill the gaps in
# that stage's latency, not to compete with it for provider throughput.
_CONCURRENCY = 8

_PUNCT_RE = re.compile(r"[^\w\s-]")


class WriteStockSearchQuery(dspy.Signature):
    """
    Write a stock-footage search query for one scene of a short marketing video.

    ═══ WHAT YOU ARE DOING ═══
    The scene needs background b-roll. You are choosing what that footage shows.
    Stock libraries (Pexels, Pixabay) index what is VISIBLE in a clip — objects,
    people, places, actions. They do not index topics, arguments, or meaning.

    So: do not summarise the scene. Decide what a camera should be pointed at to
    illustrate it, then name that in the plainest possible words.

    ═══ RULES ═══
    1. 2-4 words. Concrete, visible nouns, optionally one verb or setting.
    2. No abstractions: not "innovation", "growth", "success", "efficiency",
       "sustainability". These return meaningless stock imagery.
    3. No proper nouns, brand names, numbers, dates, or currency — unless it is a
       filmable place ("tokyo street" is fine, "Series B" is not).
    4. No words about the video itself: "scene", "intro", "viewer", "explainer".
    5. Nothing requiring on-screen text, charts, logos or UI — the renderer draws
       its own text over this footage.
    6. Prefer what is COMMON in stock libraries. "team meeting office" returns
       thousands of clips; "quarterly synergy alignment" returns nothing.
    7. ENGLISH ONLY, whatever language the scene is written in — the provider
       indexes are English-only, so any other language returns zero results.
    8. Avoid narrowing detail the scene never mentions. For a scene about sleep,
       "person sleeping bed" is right; "pregnant woman sleeping" invents a
       specific it never asked for.

    ═══ EXAMPLES ═══
    Title "Series B closes at $40M" / narration about investors backing a startup
      -> "business handshake office"
    Title "Why Sleep Matters" / narration about memory and immune function
      -> "person sleeping bedroom"
    Title "The Rise of Remote Work" / narration about home offices and cafes
      -> "working laptop cafe"
    Title "The Future of Sustainability" / narration about factory emissions
      -> "factory smokestack sky"

    Output ONLY the query words. No quotes, no punctuation, no explanation.
    """

    scene_title: str = dspy.InputField(desc="Scene title — often rhetorical, not descriptive")
    display_text: str = dspy.InputField(desc="Text rendered on screen for this scene")
    narration: str = dspy.InputField(desc="Voiceover script — the fullest statement of the scene's subject")
    visual_description: str = dspy.InputField(desc="Any visual intent the script already specified")
    video_topic: str = dspy.InputField(desc="What the overall video is about, for disambiguation")
    search_query: str = dspy.OutputField(desc="2-4 plain English words naming what the footage shows")


def _sanitise(raw: str) -> str:
    """Strip the model's stray punctuation/quoting down to bare search words."""
    text = (raw or "").strip()
    if not text:
        return ""
    # Models occasionally answer with a quoted phrase or a trailing period.
    text = _PUNCT_RE.sub(" ", text)
    words = [w for w in text.split() if w]
    if not words:
        return ""
    return " ".join(words[:_MAX_QUERY_WORDS])[:_MAX_QUERY_CHARS].strip()


async def generate_stock_queries(scenes: list[dict], *, video_topic: str = "") -> dict[int, str]:
    """Write a search query for each scene.

    ``scenes`` is a list of ``{"scene_id", "title", "display_text", "narration",
    "visual_description"}``. Returns ``{scene_id: query}``, omitting any scene
    whose call failed — the caller falls back to keyword extraction for those.

    Never raises: stock footage is a best-effort enhancement and must not be able
    to fail scene generation.
    """
    if not scenes:
        return {}

    ensure_dspy_configured()
    predictor = dspy.Predict(WriteStockSearchQuery)
    predictor_async = dspy.asyncify(predictor)
    semaphore = asyncio.Semaphore(_CONCURRENCY)

    async def _one(scene: dict):
        async with semaphore:
            with dspy.context(lm=get_scene_lm()):
                return await predictor_async(
                    scene_title=(scene.get("title") or "").strip(),
                    display_text=(scene.get("display_text") or "").strip(),
                    narration=(scene.get("narration") or "").strip()[:_MAX_NARRATION_CHARS],
                    visual_description=(scene.get("visual_description") or "").strip(),
                    video_topic=(video_topic or "").strip()[:_MAX_NARRATION_CHARS],
                )

    results = await asyncio.gather(
        *(_one(s) for s in scenes), return_exceptions=True
    )

    queries: dict[int, str] = {}
    for scene, result in zip(scenes, results):
        scene_id = scene.get("scene_id")
        if scene_id is None:
            continue
        if isinstance(result, BaseException):
            logger.warning(
                "[STOCK_QUERY_GEN] scene=%s query generation failed: %s", scene_id, result
            )
            continue
        query = _sanitise(getattr(result, "search_query", ""))
        if not query:
            logger.warning("[STOCK_QUERY_GEN] scene=%s produced an empty query", scene_id)
            continue
        queries[scene_id] = query

    logger.info(
        "[STOCK_QUERY_GEN] generated %s/%s queries: %s",
        len(queries), len(scenes), list(queries.values())[:8],
    )
    return queries
