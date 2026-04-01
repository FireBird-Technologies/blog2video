"""
Theme Scraper — Scrapes a URL using Firecrawl to extract HTML/CSS/metadata
for theme analysis. Returns raw content for the ThemeExtractor DSPy module.
"""

import base64
import logging
import time
from dataclasses import dataclass, field
from urllib.parse import urljoin

import requests
from firecrawl import Firecrawl
from app.config import settings

logger = logging.getLogger(__name__)

# Shown to end users — never surface raw Firecrawl or stack traces in API responses.
USER_THEME_SCRAPE_FAILED = (
    "We couldn't load that website from here. Try another URL, or try again in a moment."
)
USER_THEME_SCRAPE_EMPTY = (
    "We couldn't read any content from that page. Try a different URL."
)
USER_THEME_NOT_EXTRACTABLE = (
    "We couldn't pull a usable theme from this page. Try a different URL."
)
USER_THEME_AI_ERROR = (
    "Something went wrong while analyzing the page. Please try again."
)
USER_THEME_SCRAPE_NOT_CONFIGURED = (
    "Theme extraction isn't available on this server. Please contact support."
)

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


_NAV_TAGS = {"header", "nav"}
_NAV_ATTRS = {"header", "nav", "navbar", "navigation", "topbar", "top-bar", "site-header"}


def _is_in_nav(tag) -> bool:  # type: ignore[no-untyped-def]
    """Return True if this tag lives inside a <header> or <nav>, or a container
    whose class/id contains nav-like keywords. These are almost certainly the
    brand's own primary logo, not a partner/sponsor logo."""
    for parent in tag.parents:
        name = getattr(parent, "name", None)
        if name in _NAV_TAGS:
            return True
        classes = " ".join(parent.get("class", [])).lower() if hasattr(parent, "get") else ""
        pid = (parent.get("id", "") or "").lower() if hasattr(parent, "get") else ""
        combined = classes + " " + pid
        if any(kw in combined for kw in _NAV_ATTRS):
            return True
    return False


def _svg_to_data_uri(svg_tag) -> str | None:  # type: ignore[no-untyped-def]
    """Serialize a BeautifulSoup SVG tag to a base64 data URI. Returns None if too large."""
    svg_str = str(svg_tag)
    if len(svg_str) >= 50_000:
        return None
    b64 = base64.b64encode(svg_str.encode("utf-8")).decode("ascii")
    return f"data:image/svg+xml;base64,{b64}"


def _extract_logo_urls(html: str, base_url: str, og_image: str = "") -> list[str]:
    """Extract probable logo image URLs from HTML, ordered by confidence.

    Priority buckets (index 0 = highest confidence = used as main logo):
      Tier 1 — SVG logo inside header/nav             (brand's own inline SVG)
      Tier 2 — <img> logo inside header/nav           (brand's own raster/SVG file)
      Tier 3 — SVG logo anywhere on page              (likely brand, may be footer copy)
      Tier 4 — <img> logo anywhere on page            (may include partner logos)
      Tier 5 — apple-touch-icon                       (brand icon, no partner risk)
      Tier 6 — og:image                               (open-graph brand image)
      Tier 7 — <link rel="icon"> favicon              (tiny, last resort)
      Tier 8 — /favicon.ico                           (absolute last resort)
    """
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        return []

    # One list per tier — filled independently, merged at the end
    tiers: list[list[str]] = [[] for _ in range(8)]

    try:
        soup = BeautifulSoup(html[:100_000], "html.parser")

        # ── Tier 1 & 3: inline SVG logos ──────────────────────────────────
        for svg in soup.find_all("svg"):
            svg_attrs = " ".join([
                " ".join(svg.get("class", [])),
                svg.get("id", ""),
                svg.get("aria-label", ""),
            ]).lower()
            if "logo" in svg_attrs:
                uri = _svg_to_data_uri(svg)
                if uri:
                    (tiers[0] if _is_in_nav(svg) else tiers[2]).append(uri)

        # ── Tier 2 & 4: <img> tags with logo-related attributes ───────────
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
                    url = urljoin(base_url, src)
                    (tiers[1] if _is_in_nav(img) else tiers[3]).append(url)

        # ── Tier 5: apple-touch-icon ───────────────────────────────────────
        for link in soup.find_all("link", rel=True):
            rels = link.get("rel", [])
            href = link.get("href", "")
            if not href:
                continue
            if any(r == "apple-touch-icon" for r in rels):
                tiers[4].append(urljoin(base_url, href))
            elif any(r in ("icon", "shortcut") for r in rels):
                tiers[6].append(urljoin(base_url, href))

    except Exception:
        pass  # Never let logo extraction break the scrape

    # ── Tier 6: og:image ──────────────────────────────────────────────────
    if og_image:
        tiers[5].append(og_image)

    # ── Tier 8: /favicon.ico ──────────────────────────────────────────────
    tiers[7].append(urljoin(base_url, "/favicon.ico"))

    # Merge tiers in order, deduplicate, cap at 5
    seen: set[str] = set()
    result: list[str] = []
    for tier in tiers:
        for url in tier:
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
                resp = requests.get(css_url, timeout=5, headers={"User-Agent": "Mozilla/5.0"})
                if resp.status_code == 200 and resp.headers.get("content-type", "").startswith("text/css"):
                    remaining = _MAX_CSS_CHARS - total
                    text = resp.text[:remaining].strip()
                    if text:
                        css_parts.append(f"/* from {css_url} */\n{text}")
                        total += len(text)
            except Exception:
                pass  # Never let external CSS fetch break the scrape

    return "\n".join(css_parts)


_CF_BROWSER_BASE = "https://api.cloudflare.com/client/v4/accounts/{account_id}/browser-rendering"
_CF_REQUEST_TIMEOUT = 30  # seconds per HTTP call


def _scrape_with_cloudflare_browser(url: str) -> ScrapedThemeData:
    """
    Scrape a URL using the Cloudflare Browser Rendering REST API.

    Makes two sequential POST requests:
      - /render   → JavaScript-rendered HTML (full DOM after JS execution)
      - /markdown → markdown version of the same page

    Raises RuntimeError on any failure — caller catches and falls back to Firecrawl.
    """
    from bs4 import BeautifulSoup

    account_id = settings.CLOUDFLARE_ACCOUNT_ID
    api_token  = settings.CLOUDFLARE_API_TOKEN
    base       = _CF_BROWSER_BASE.format(account_id=account_id)
    headers    = {"Authorization": f"Bearer {api_token}", "Content-Type": "application/json"}
    payload    = {"url": url}

    print(f"[F7-DEBUG] [CF-SCRAPE] Attempting Cloudflare Browser Rendering for {url}")
    t_start = time.time()

    # ── Fetch rendered HTML (/render) ─────────────────────────────────────
    try:
        html_resp = requests.post(
            f"{base}/content",
            json=payload,
            headers=headers,
            timeout=_CF_REQUEST_TIMEOUT,
        )
        if not html_resp.ok:
            print(f"[F7-DEBUG] [CF-SCRAPE] /content error body: {html_resp.text[:500]}")
        html_resp.raise_for_status()
    except Exception as e:
        raise RuntimeError(f"Cloudflare /content failed: {e}") from e

    html_content = (html_resp.json().get("result") or "").strip()
    print(f"[F7-DEBUG] [CF-SCRAPE] /content done in {time.time()-t_start:.1f}s — HTML={len(html_content)} chars")

    if not html_content:
        raise RuntimeError("Cloudflare /content returned empty HTML")

    # ── Extract plain text from HTML (no second API call needed) ─────────
    # Parse the full HTML but extract from <body> only — skips <head> which
    # is mostly <script> bundles. This avoids the 27-char problem on SPAs
    # where the first 200K chars is entirely JS bundles with no visible text.
    try:
        from bs4 import BeautifulSoup as _BS
        _soup = _BS(html_content, "html.parser")
        for tag in _soup(["script", "style", "noscript"]):
            tag.decompose()
        _body = _soup.find("body") or _soup
        markdown_text = _body.get_text(separator="\n", strip=True)
    except Exception:
        markdown_text = ""
    print(f"[F7-DEBUG] [CF-SCRAPE] text extracted from HTML — {len(markdown_text)} chars")

    # ── Parse metadata from fully rendered DOM ────────────────────────────
    title = description = og_image = ""
    if html_content:
        try:
            soup = BeautifulSoup(html_content[:100_000], "html.parser")

            title_tag = soup.find("title")
            title = title_tag.get_text(strip=True) if title_tag else ""

            desc_tag = (
                soup.find("meta", attrs={"name": "description"})
                or soup.find("meta", attrs={"property": "og:description"})
            )
            description = (desc_tag.get("content") or "") if desc_tag else ""

            og_tag = soup.find("meta", attrs={"property": "og:image"})
            og_image = (og_tag.get("content") or "") if og_tag else ""
        except Exception:
            pass  # Never let metadata parsing break the scrape

    print(
        f"[F7-DEBUG] [CF-SCRAPE] metadata — title={repr(title[:40])} "
        f"desc={len(description)} chars og_image={'yes' if og_image else 'no'}"
    )

    # ── Reuse existing helpers on the fully rendered HTML ─────────────────
    css_content   = _extract_css_content(html_content, base_url=url)
    html_with_css = (f"<style>{css_content}</style>\n" + html_content) if css_content else html_content
    logo_urls     = _extract_logo_urls(html_content, url, og_image=og_image)

    print(
        f"[F7-DEBUG] [CF-SCRAPE] CSS extracted: {len(css_content)} chars | "
        f"logos found: {len(logo_urls)} | total time: {time.time()-t_start:.1f}s"
    )

    return ScrapedThemeData(
        url=url,
        html=html_with_css[:_MAX_HTML_CHARS],
        markdown=markdown_text[:_MAX_MARKDOWN_CHARS],
        title=title,
        description=description,
        logo_urls=logo_urls,
        og_image=og_image,
        screenshot_url="",
        branding=None,
    )


def scrape_for_theme(url: str) -> ScrapedThemeData:
    """
    Scrape a URL and return raw content for theme extraction.

    Scraper priority:
      1. Cloudflare Browser Rendering REST API  (if CLOUDFLARE_API_TOKEN +
         CLOUDFLARE_ACCOUNT_ID are both set) — renders full JS, captures all
         external CSS and dynamic logos Firecrawl misses.
      2. Firecrawl (fallback)                  — if FIRECRAWL_API_KEY is set.

    Raises ValueError  if neither scraper is configured (→ HTTP 400 at router).
    Raises RuntimeError if a configured scraper fails   (→ HTTP 502 at router).
    """
    cf_configured = bool(settings.CLOUDFLARE_API_TOKEN and settings.CLOUDFLARE_ACCOUNT_ID)
    fc_configured = bool(settings.FIRECRAWL_API_KEY)

    if not cf_configured and not fc_configured:
        raise ValueError(USER_THEME_SCRAPE_NOT_CONFIGURED)

    # ── Attempt 1: Cloudflare Browser Rendering REST API ─────────────────
    if cf_configured:
        try:
            return _scrape_with_cloudflare_browser(url)
        except Exception as e:
            print(f"[F7-DEBUG] [CF-SCRAPE] FAILED — {e} — {'falling back to Firecrawl' if fc_configured else 'no fallback available'}")
            logger.warning(
                "Cloudflare Browser Rendering failed for %s: %s — falling back to Firecrawl",
                url, e, exc_info=True,
            )
            if not fc_configured:
                raise RuntimeError(USER_THEME_SCRAPE_FAILED) from e
    else:
        print(f"[F7-DEBUG] [SCRAPE] Cloudflare not configured — using Firecrawl directly")

    # ── Attempt 2: Firecrawl (fallback or sole scraper) ───────────────────
    print(f"[F7-DEBUG] [SCRAPE] Attempting Firecrawl for {url}")
    t_scrape_start = time.time()
    try:
        app = Firecrawl(api_key=settings.FIRECRAWL_API_KEY)
        doc = app.scrape(url, formats=["html", "markdown"])
    except Exception as e:
        logger.warning("Firecrawl scrape failed for %s: %s", url, e, exc_info=True)
        raise RuntimeError(USER_THEME_SCRAPE_FAILED) from e

    html_content = (getattr(doc, "html", None) or "").strip()
    markdown_text = (getattr(doc, "markdown", None) or "").strip()
    metadata = getattr(doc, "metadata", None) or {}
    if not isinstance(metadata, dict):
        metadata = metadata.__dict__ if hasattr(metadata, "__dict__") else {}

    if not html_content and not markdown_text:
        logger.warning("Firecrawl returned no HTML or markdown for %s", url)
        raise RuntimeError(USER_THEME_SCRAPE_EMPTY)

    og_image = str(metadata.get("ogImage", "") or metadata.get("og:image", "") or "")
    css_content = _extract_css_content(html_content, base_url=url)
    html_with_css = (f"<style>{css_content}</style>\n" + html_content) if css_content else html_content
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
