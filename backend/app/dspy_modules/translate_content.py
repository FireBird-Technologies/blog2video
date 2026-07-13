"""Strict translation of existing scene copy into a target language.

Unlike the other DSPy modules here, this one does **not** generate content — it
translates copy the user already has (and may have hand-edited), preserving meaning,
structure, and item count. Used by the change-language job.

Why not reuse ``DisplayTextGenerator``? That module *re-derives* display text from
narration, so it would rewrite wording and re-apply template length rules. A language
change must keep the copy the user approved and only change its language.
"""

import asyncio
import json

import dspy

from app.dspy_modules import ensure_dspy_configured
from app.observability.logging import get_logger

logger = get_logger(__name__)


class TranslateSceneContent(dspy.Signature):
    """
    Translate a JSON array of short strings into the target language.

    ═══ INPUTS ═══
    - source_texts: a JSON array of strings, in order. Each item is an independent
      snippet of on-screen text or narration from ONE video scene.
    - target_language: the language to translate into (e.g. 'Spanish', 'Urdu').
    - context: optional scene context to disambiguate terms. Never translate the context
      itself; it is background only.

    ═══ OUTPUT ═══
    - translated_texts: a JSON array of strings.

    ═══ HARD RULES (CRITICAL) ═══
    - Return EXACTLY as many items as source_texts, in the SAME order.
      Never merge, split, reorder, add, or drop items. A one-to-one mapping.
    - If an item should not change (a proper noun, a brand, an acronym), return it
      unchanged rather than dropping it.
    - Output ONLY the JSON array. No prose, no markdown, no code fences.

    ═══ TRANSLATION RULES ═══
    - Translate the MEANING faithfully. Do NOT rewrite, summarize, shorten, expand,
      embellish, localize idioms into new claims, or add facts not present.
    - Preserve verbatim: numbers, currency amounts, percentages, dates, units,
      proper nouns, people/company/product/brand names, code identifiers, file names,
      URLs, email addresses, and ticker symbols.
    - Preserve the shape of each string: leading/trailing whitespace, capitalization
      style where meaningful, and terminal punctuation.
    - Do NOT add quotation marks, bullets, numbering, or markdown that wasn't there.
    - Text is rendered as on-screen typography, so keep it tight — but never at the
      cost of meaning.

    ═══ LANGUAGE RULE (CRITICAL) ═══
    - Write the output EXCLUSIVELY in target_language. Do NOT leave text in the source
      language, and do NOT translate to English unless target_language is English.
    """

    source_texts: str = dspy.InputField(desc="JSON array of strings to translate, in order")
    target_language: str = dspy.InputField(desc="Target language name, e.g. 'Spanish'")
    context: str = dspy.InputField(desc="Optional scene context for disambiguation; do not translate it")

    translated_texts: str = dspy.OutputField(
        desc="JSON array of translated strings — same length and order as source_texts"
    )


def _parse_array(raw: str, expected: int) -> list[str] | None:
    """Parse the model's array output, tolerating code fences. None when unusable."""
    if not raw:
        return None
    text = raw.strip()
    if text.startswith("```"):
        text = text.strip("`")
        # drop a leading language tag like ```json
        if "\n" in text:
            text = text.split("\n", 1)[1]
    start, end = text.find("["), text.rfind("]")
    if start == -1 or end == -1 or end <= start:
        return None
    try:
        parsed = json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None
    if not isinstance(parsed, list) or len(parsed) != expected:
        return None
    return [x if isinstance(x, str) else str(x) for x in parsed]


class ContentTranslator:
    """Translate batches of strings, guaranteeing a same-length, same-order result.

    Degradation ladder — a bad LLM response must never corrupt a scene descriptor:
      1. batch call
      2. one retry of the batch
      3. per-item calls (isolates the one string that broke the array)
      4. the original string
    """

    def __init__(self, target_language: str = "English"):
        ensure_dspy_configured()
        self.target_language = (target_language or "English").strip()
        self._predictor = dspy.ChainOfThought(TranslateSceneContent)
        self.predictor = dspy.asyncify(self._predictor)

    async def _predict(self, texts: list[str], context: str) -> list[str] | None:
        result = await self.predictor(
            source_texts=json.dumps(texts, ensure_ascii=False),
            target_language=self.target_language,
            context=context or "",
        )
        return _parse_array(getattr(result, "translated_texts", "") or "", len(texts))

    async def translate(self, texts: list[str], *, context: str = "") -> list[str]:
        """Translate ``texts``; always returns a list of the same length and order."""
        if not texts:
            return []

        for attempt in (1, 2):
            try:
                parsed = await self._predict(texts, context)
                if parsed is not None:
                    return parsed
                logger.warning(
                    "[LANG] translate batch attempt %s returned a malformed/mis-sized array (n=%s)",
                    attempt, len(texts),
                )
            except Exception:
                logger.exception("[LANG] translate batch attempt %s failed", attempt)

        # Per-item fallback: isolate the offending string instead of losing the batch.
        logger.warning("[LANG] falling back to per-item translation for %s items", len(texts))
        sem = asyncio.Semaphore(4)

        async def _one(text: str) -> str:
            async with sem:
                try:
                    parsed = await self._predict([text], context)
                    if parsed and parsed[0].strip():
                        return parsed[0]
                except Exception:
                    logger.exception("[LANG] per-item translation failed; keeping original")
            return text

        return list(await asyncio.gather(*(_one(t) for t in texts)))
