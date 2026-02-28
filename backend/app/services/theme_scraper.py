"""
Theme Scraper — Scrapes a URL using Firecrawl to extract HTML/CSS/metadata
for theme analysis. Returns raw content for the ThemeExtractor DSPy module.
"""

from dataclasses import dataclass
from firecrawl import Firecrawl
from app.config import settings


_MAX_HTML_CHARS = 20_000
_MAX_MARKDOWN_CHARS = 5_000


@dataclass
class ScrapedThemeData:
    """Raw scraped data ready for theme extraction."""
    url: str
    html: str          # First 15K chars of rendered HTML (for CSS/color analysis)
    markdown: str      # First 5K chars of markdown (for content category analysis)
    title: str         # Page title from metadata
    description: str   # Meta description


def scrape_for_theme(url: str) -> ScrapedThemeData:
    """
    Scrape a URL using Firecrawl and return raw content for theme extraction.
    Focuses on HTML (for style/color info) and markdown (for content category).

    Raises:
        ValueError: If Firecrawl API key is not configured
        RuntimeError: If scraping fails or returns no usable content
    """
    if not settings.FIRECRAWL_API_KEY:
        raise ValueError("FIRECRAWL_API_KEY is not configured")

    app = Firecrawl(api_key=settings.FIRECRAWL_API_KEY)

    try:
        doc = app.scrape(url, formats=["html", "markdown"])
    except Exception as e:
        raise RuntimeError(f"Firecrawl scrape failed for {url}: {e}") from e

    html_content = (getattr(doc, "html", None) or "").strip()
    markdown_text = (getattr(doc, "markdown", None) or "").strip()
    metadata = getattr(doc, "metadata", None) or {}
    if not isinstance(metadata, dict):
        metadata = metadata.__dict__ if hasattr(metadata, "__dict__") else {}

    if not html_content and not markdown_text:
        raise RuntimeError(f"No content extracted from {url}")

    return ScrapedThemeData(
        url=url,
        html=html_content[:_MAX_HTML_CHARS],
        markdown=markdown_text[:_MAX_MARKDOWN_CHARS],
        title=str(metadata.get("title", "") or ""),
        description=str(metadata.get("description", "") or metadata.get("ogDescription", "") or ""),
    )
