"""
Pick the best template for a page that will be turned into a video.

Called by the MCP `auto_video` tool BEFORE the project is created, so it can
pass a concrete template id like any other caller. Nothing in the pipeline or
the project router needs to know this exists — no "auto" sentinel, no mid-run
resolution.

One Firecrawl call supplies both signals:

  1. the site's *visual identity* — brand colours, fonts, category
  2. the page *markdown* — what the page is actually about

The chosen template keeps its OWN palette. The scraped brand colours only
inform *which* template fits; they are never applied to the video.

Mirrors video_style_picker.py, which does the same job for video_style.
"""
import asyncio

import dspy

from app.dspy_modules import ensure_dspy_configured, get_scene_lm
from app.observability.logging import get_logger
from app.services.template_service import list_templates

logger = get_logger(__name__)

_DEFAULT_TEMPLATE = "default"
_MAX_CONTENT_CHARS = 2000


class PickTemplate(dspy.Signature):
    """
    You are choosing the visual template that best fits a web page that will be turned into a short video.

    ═══ YOUR TASK ═══
    You are given a catalog of templates, one per line, as `id — genres`.
    You are also given TWO signals about the source page:
      1. `site_theme` — the site's own visual identity (brand colours, fonts,
         category, overall mood), scraped from the live page. This tells you how
         the brand LOOKS and what kind of organisation it is.
      2. `blog_content` — the article text. This tells you what the page is ABOUT.

    Weigh BOTH. A dark, technical brand writing about finance should not get the
    same template as a bright, playful consumer brand writing about finance.
    When the two signals conflict, prefer the one that will make a better-looking
    video: visual identity for look-and-feel, content for subject matter.

    Output ONLY the template id exactly as it appears in the catalog.
    No other words. No punctuation. No explanation.
    """

    catalog: str = dspy.InputField(desc="Available templates, one per line: 'id — genre, genre'")
    site_theme: str = dspy.InputField(desc="The source site's scraped visual identity: category, brand colours, fonts, mood")
    blog_content: str = dspy.InputField(desc="Article text (may be truncated)")
    template_id: str = dspy.OutputField(desc="One template id from the catalog")


def _build_catalog() -> tuple[str, set[str]]:
    """Return (prompt-ready catalog text, set of valid ids)."""
    lines: list[str] = []
    valid: set[str] = set()
    for meta in list_templates():
        tid = (meta or {}).get("id")
        if not tid:
            continue
        valid.add(tid)
        genres = ", ".join((meta.get("genres") or [])) or "general"
        lines.append(f"{tid} — {genres}")
    return "\n".join(lines), valid


async def _scrape_signals(url: str) -> tuple[str, str]:
    """Scrape the URL once. Returns (theme description, page markdown).

    Reuses the custom-template flow's machinery (theme_scraper + theme_extractor)
    so template choice reflects how the brand actually LOOKS, not just what the
    page says. Returns ("", "") on failure — the caller then falls back to the
    default template rather than raising.
    """
    if not (url or "").strip():
        return "", ""
    try:
        from app.dspy_modules.theme_extractor import ThemeExtractor
        from app.services.theme_scraper import scrape_for_theme

        scraped = await asyncio.to_thread(scrape_for_theme, url)
        result = await ThemeExtractor().extract_theme(scraped)
    except Exception as e:  # noqa: BLE001 - never fatal; caller falls back
        logger.warning("[TEMPLATE_PICKER] Scrape failed for %s: %s", url, e)
        return "", ""

    markdown = (scraped.markdown or "").strip()
    if not result.get("extractable") or not result.get("theme"):
        logger.info("[TEMPLATE_PICKER] No theme extractable for %s: %s", url, result.get("reason"))
        return "", markdown

    theme = result["theme"]
    colors = theme.get("colors") or {}
    fonts = theme.get("fonts") or {}
    parts = [
        f"category: {theme.get('category') or 'unknown'}",
        f"brand colours: accent={colors.get('accent', '?')} bg={colors.get('bg', '?')} text={colors.get('text', '?')}",
        f"fonts: heading={fonts.get('heading', '?')} body={fonts.get('body', '?')}",
    ]
    if result.get("template_name"):
        parts.append(f"brand style name: {result['template_name']}")
    return " | ".join(parts), markdown


async def pick_template_for_url(url: str) -> str:
    """Choose the best-fitting template id for a URL.

    Scrapes the page once for both its visual identity and its content, then
    lets the LLM pick from the built-in catalog. Always returns a valid template
    id — falls back to "default" on scrape failure, LLM failure, or an id that
    is not in the catalog.
    """
    catalog, valid_ids = _build_catalog()
    if not catalog:
        logger.warning("[TEMPLATE_PICKER] Empty template catalog, defaulting to %s", _DEFAULT_TEMPLATE)
        return _DEFAULT_TEMPLATE

    site_theme, content = await _scrape_signals(url)
    if not site_theme and not content:
        logger.info("[TEMPLATE_PICKER] No signals for %s, defaulting to %s", url, _DEFAULT_TEMPLATE)
        return _DEFAULT_TEMPLATE
    if site_theme:
        logger.info("[TEMPLATE_PICKER] Site theme for %s → %s", url, site_theme)

    ensure_dspy_configured()
    predictor = dspy.Predict(PickTemplate)
    predictor_async = dspy.asyncify(predictor)

    try:
        with dspy.context(lm=get_scene_lm()):
            result = await predictor_async(
                catalog=catalog,
                site_theme=site_theme or "unknown (not scraped)",
                blog_content=content[:_MAX_CONTENT_CHARS] or "(no content)",
            )
    except Exception as e:
        logger.warning("[TEMPLATE_PICKER] LLM call failed, defaulting to %s: %s", _DEFAULT_TEMPLATE, e)
        return _DEFAULT_TEMPLATE

    tid = (result.template_id or "").strip().lower()
    if tid not in valid_ids:
        logger.warning("[TEMPLATE_PICKER] Unrecognized template %r, defaulting to %s", tid, _DEFAULT_TEMPLATE)
        return _DEFAULT_TEMPLATE
    return tid
