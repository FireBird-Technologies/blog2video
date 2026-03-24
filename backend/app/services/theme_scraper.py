"""
Theme Scraper — Scrapes a URL using Firecrawl to extract HTML/CSS/metadata
for theme analysis. Returns raw content for the ThemeExtractor DSPy module.
"""

import logging
import time
from dataclasses import dataclass, field
from urllib.parse import urljoin

from firecrawl import Firecrawl
from app.config import settings

logger = logging.getLogger(__name__)


_MAX_HTML_CHARS = 15_000
_MAX_MARKDOWN_CHARS = 2_000
_MAX_CSS_CHARS = 10_000


@dataclass
class ScrapedThemeData:
    """Raw scraped data ready for theme extraction."""
    url: str
    html: str          # First 20K chars of rendered HTML (for CSS/color analysis)
    markdown: str      # First 5K chars of markdown (for content category analysis)
    title: str         # Page title from metadata
    description: str   # Meta description
    # Enhanced fields for AI code generation (Phase 2)
    logo_urls: list[str] = field(default_factory=list)   # Probable logo image URLs
    og_image: str = ""                                    # Open Graph image URL
    screenshot_url: str = ""                              # Firecrawl screenshot if available
    branding: dict | None = None                          # Firecrawl branding format data (if plan supports it)


def _extract_logo_urls(html: str, base_url: str, og_image: str = "") -> list[str]:
    """Extract probable logo image URLs from HTML with multiple fallbacks."""
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        return []

    logos: list[str] = []
    try:
        # Only parse first 100K — logos are in <head> or early <body>
        soup = BeautifulSoup(html[:100_000], "html.parser")

        # <link rel="icon"> and apple-touch-icon
        for link in soup.find_all("link", rel=True):
            rels = link.get("rel", [])
            if any(r in ("icon", "apple-touch-icon", "shortcut") for r in rels):
                href = link.get("href", "")
                if href:
                    logos.append(urljoin(base_url, href))

        # <img> tags with logo-related attributes
        for img in soup.find_all("img"):
            attrs_text = " ".join([
                img.get("src", ""),
                img.get("alt", ""),
                " ".join(img.get("class", [])),
                img.get("id", ""),
            ]).lower()
            if "logo" in attrs_text:
                src = img.get("src", "")
                if src and not src.startswith("data:"):
                    logos.append(urljoin(base_url, src))

        # SVG elements with logo-like classes/ids
        for svg in soup.find_all("svg"):
            svg_attrs = " ".join([
                " ".join(svg.get("class", [])),
                svg.get("id", ""),
                svg.get("aria-label", ""),
            ]).lower()
            if "logo" in svg_attrs:
                # SVG logos can't be used as URLs, but parent <a> may have an img nearby
                parent = svg.find_parent("a")
                if parent:
                    nearby_img = parent.find("img")
                    if nearby_img and nearby_img.get("src"):
                        logos.append(urljoin(base_url, nearby_img["src"]))

    except Exception:
        pass  # Never let logo extraction break the scrape

    # Fallback: og:image as logo candidate
    if og_image and og_image not in logos:
        logos.append(og_image)

    # Fallback: favicon.ico
    favicon_url = urljoin(base_url, "/favicon.ico")
    if favicon_url not in logos:
        logos.append(favicon_url)

    # Deduplicate and limit to 5
    seen: set[str] = set()
    result: list[str] = []
    for url in logos:
        if url not in seen and len(result) < 5:
            seen.add(url)
            result.append(url)
    return result


_MAX_HTML_FOR_CSS = 500_000  # Don't parse more than 500K for CSS extraction


def _extract_css_content(html: str, base_url: str = "") -> str:
    """Extract CSS from inline <style> tags AND external <link rel="stylesheet"> files.

    CSS color definitions often appear in external stylesheets that Firecrawl's
    rendered HTML doesn't include as <style> blocks. Fetching the first few
    external CSS files ensures brand colors/fonts are available to the AI.

    Limits HTML parsing to first 500K chars to avoid hanging on huge pages.
    """
    if not html or len(html) < 20:
        return ""

    import re
    import requests as _requests

    css_parts: list[str] = []
    total = 0
    search_html = html[:_MAX_HTML_FOR_CSS]

    # 1. Inline <style> tags
    for match in re.finditer(r"<style[^>]*>(.*?)</style>", search_html, re.DOTALL | re.IGNORECASE):
        text = match.group(1).strip()
        if text and total + len(text) <= _MAX_CSS_CHARS:
            css_parts.append(text)
            total += len(text)

    # 2. External <link rel="stylesheet"> — fetch first 3 CSS files
    if base_url and total < _MAX_CSS_CHARS:
        css_urls: list[str] = []
        for match in re.finditer(
            r'<link[^>]+rel=["\']stylesheet["\'][^>]+href=["\']([^"\']+)["\']|'
            r'<link[^>]+href=["\']([^"\']+)["\'][^>]+rel=["\']stylesheet["\']',
            search_html, re.IGNORECASE,
        ):
            href = match.group(1) or match.group(2)
            if href:
                css_urls.append(urljoin(base_url, href))

        for css_url in css_urls[:3]:
            if total >= _MAX_CSS_CHARS:
                break
            try:
                resp = _requests.get(css_url, timeout=5, headers={"User-Agent": "Mozilla/5.0"})
                if resp.status_code == 200 and resp.headers.get("content-type", "").startswith("text/css"):
                    remaining = _MAX_CSS_CHARS - total
                    text = resp.text[:remaining].strip()
                    if text:
                        css_parts.append(f"/* from {css_url} */\n{text}")
                        total += len(text)
            except Exception:
                pass  # Never let external CSS fetch break the scrape

    return "\n".join(css_parts)


def scrape_for_theme(url: str) -> ScrapedThemeData:
    """
    Scrape a URL using Firecrawl and return raw content for theme extraction.
    Focuses on HTML (for style/color info) and markdown (for content category).
    """
    if not settings.FIRECRAWL_API_KEY:
        raise ValueError("FIRECRAWL_API_KEY is not configured")

    app = Firecrawl(api_key=settings.FIRECRAWL_API_KEY)

    t_scrape_start = time.time()
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

    # Extract OG image from metadata
    og_image = str(
        metadata.get("ogImage", "")
        or metadata.get("og:image", "")
        or ""
    )

    # Extract CSS from full HTML (inline + external stylesheets) and prepend to truncated HTML
    css_content = _extract_css_content(html_content, base_url=url)
    html_with_css = (f"<style>{css_content}</style>\n" + html_content) if css_content else html_content

    # Extract logos from HTML (with og:image and favicon fallbacks)
    logo_urls = _extract_logo_urls(html_content, url, og_image=og_image)

    t_scrape_total = time.time() - t_scrape_start
    print(f"[F7-DEBUG] [SCRAPE] Done in {t_scrape_total:.1f}s — HTML={len(html_content)} chars, CSS={len(css_content)} chars, logos={len(logo_urls)}")

    return ScrapedThemeData(
        url=url,
        html=html_with_css[:_MAX_HTML_CHARS],
        markdown=markdown_text[:_MAX_MARKDOWN_CHARS],
        title=str(metadata.get("title", "") or ""),
        description=str(metadata.get("description", "") or metadata.get("ogDescription", "") or ""),
        logo_urls=logo_urls,
        og_image=og_image,
        screenshot_url="",
        branding=None,
    )
