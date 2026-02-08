import os
import re
import hashlib
import requests
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session
from exa_py import Exa

from app.config import settings
from app.models.project import Project, ProjectStatus
from app.models.asset import Asset, AssetType
from app.services import r2_storage

# Browser headers for image downloads and fallback scraping
_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
}


# ─── Main entry point ─────────────────────────────────────

def scrape_blog(project: Project, db: Session) -> Project:
    """
    Scrape blog content and images from the project's blog_url.
    Uses Exa API as primary method (handles Medium, Substack, etc.),
    falls back to direct requests + BeautifulSoup.
    """
    url = project.blog_url

    # Try Exa first, then fallback to requests
    if settings.EXA_API_KEY:
        try:
            text, image_urls = _scrape_with_exa(url)
        except Exception as e:
            print(f"[SCRAPER] Exa failed, falling back to requests: {e}")
            text, image_urls = _scrape_with_requests(url)
    else:
        text, image_urls = _scrape_with_requests(url)

    if not text or len(text.strip()) < 50:
        raise ValueError("Could not extract meaningful content from the URL.")

    # Download images
    _download_images(project.id, image_urls, db)

    # Update project
    project.blog_content = text
    project.status = ProjectStatus.SCRAPED
    db.commit()
    db.refresh(project)

    return project


# ─── Exa API scraping ─────────────────────────────────────

def _scrape_with_exa(url: str) -> tuple[str, list[str]]:
    """
    Use Exa API to get clean text content, HTML for code blocks, and
    image URLs from a URL.  Exa handles Medium/Substack/paywalled sites.
    The hero/OG image is always first in the returned list.
    """
    exa = Exa(api_key=settings.EXA_API_KEY)

    # Request HTML-tagged text (for code blocks + inline images) plus image_links.
    # Use livecrawl="preferred" so Exa tries a fresh headless-browser crawl first
    # (which executes JS → Medium/Substack images become visible), falling back
    # to cached content if the live crawl fails.
    result = exa.get_contents(
        urls=[url],
        text={"include_html_tags": True, "max_characters": 50000},
        extras={"image_links": 40},
        livecrawl="preferred",
        livecrawl_timeout=15000,  # 15s timeout for live crawl
    )

    if not result.results:
        raise ValueError("Exa returned no results")

    page = result.results[0]
    html_text = page.text or ""

    # If Exa returned very little content, the page might be paywalled/JS-rendered.
    # Retry with livecrawl="always" to force a fresh headless crawl.
    if len(html_text.strip()) < 500:
        print(f"[SCRAPER] Exa returned thin content ({len(html_text)} chars), retrying with forced livecrawl...")
        try:
            result2 = exa.get_contents(
                urls=[url],
                text={"include_html_tags": True, "max_characters": 50000},
                extras={"image_links": 40},
                livecrawl="always",
                livecrawl_timeout=30000,
            )
            if result2.results and len((result2.results[0].text or "").strip()) > len(html_text.strip()):
                page = result2.results[0]
                html_text = page.text or ""
                print(f"[SCRAPER] Forced livecrawl got {len(html_text)} chars (better)")
        except Exception as e2:
            print(f"[SCRAPER] Forced livecrawl failed (using cached): {e2}")

    # --- Parse Exa's HTML (already scoped to article content) ---
    soup_exa = BeautifulSoup(html_text, "lxml") if "<" in html_text else None

    # Extract code blocks
    code_blocks: list[dict] = []
    if soup_exa and ("<pre" in html_text or "<code" in html_text):
        code_blocks = _extract_code_blocks(soup_exa)

    # Convert HTML to clean plain text for the LLM
    if soup_exa:
        text = soup_exa.get_text(separator="\n", strip=True)
        text = re.sub(r"\n{3,}", "\n\n", text).strip()
    else:
        text = html_text

    # Inject code blocks with clear markers
    if code_blocks:
        text = _inject_code_blocks(text, code_blocks)

    # --- Collect images ---
    image_urls: list[str] = []
    seen_images: set[str] = set()

    # 1. Hero / OG image from Exa
    if hasattr(page, "image") and page.image:
        image_urls.append(page.image)
        seen_images.add(page.image)

    # 2. Inline images from Exa's article HTML (best source — already
    #    scoped to the article body, so every image here is near the text)
    if soup_exa:
        for img_url in _extract_all_image_srcs(soup_exa, url):
            if img_url not in seen_images and _is_blog_image(img_url):
                image_urls.append(img_url)
                seen_images.add(img_url)

    # 3. Exa extras.image_links (may include some the HTML didn't have)
    if hasattr(page, "extras") and page.extras:
        exa_images = page.extras.get("image_links") or page.extras.get("imageLinks") or []
        for img_url in exa_images:
            if isinstance(img_url, str) and img_url not in seen_images:
                if _is_blog_image(img_url):
                    image_urls.append(img_url)
                    seen_images.add(img_url)

    # 4. Fallback: direct HTML fetch — only look inside <article>/<main>
    if len(image_urls) < 3:
        try:
            resp = requests.get(url, headers=_BROWSER_HEADERS, timeout=15)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "lxml")

                # Get hero image if we still don't have one
                if not image_urls:
                    og_img = _extract_og_image_from_soup(soup, url)
                    if og_img and og_img not in seen_images:
                        image_urls.insert(0, og_img)
                        seen_images.add(og_img)

                # Extract images ONLY from the article body container
                body_images = _extract_article_image_urls(soup, url)
                for img_url in body_images:
                    if img_url not in seen_images:
                        image_urls.append(img_url)
                        seen_images.add(img_url)
        except Exception as e:
            print(f"[SCRAPER] HTML image fallback failed (non-fatal): {e}")

    print(f"[SCRAPER] Exa extracted {len(text)} chars, {len(code_blocks)} code blocks, {len(image_urls)} images")
    return text, image_urls


# ─── Requests + BeautifulSoup fallback ────────────────────

def _scrape_with_requests(url: str) -> tuple[str, list[str]]:
    """
    Fallback scraper using requests + BeautifulSoup.
    Hero/OG image is always first in the returned list.
    """
    session = requests.Session()
    session.headers.update(_BROWSER_HEADERS)

    response = session.get(url, timeout=30, allow_redirects=True)

    # Retry once (some sites set cookies on first 403)
    if response.status_code == 403:
        response = session.get(url, timeout=30, allow_redirects=True)

    response.raise_for_status()

    soup = BeautifulSoup(response.text, "lxml")
    text = _extract_text(soup)

    # Extract hero image (og:image) first, then remaining images
    hero_url = _extract_og_image_from_soup(soup, url)
    image_urls = _extract_image_urls(soup, url)

    # Ensure hero image is first and deduplicated
    if hero_url:
        image_urls = [hero_url] + [u for u in image_urls if u != hero_url]

    return text, image_urls


def _extract_og_image(url: str) -> str | None:
    """Quick fetch to extract og:image from a URL's HTML head."""
    try:
        resp = requests.get(url, headers=_BROWSER_HEADERS, timeout=10)
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.text[:10000], "lxml")  # only parse head
            return _extract_og_image_from_soup(soup, url)
    except Exception:
        pass
    return None


def _extract_og_image_from_soup(soup: BeautifulSoup, base_url: str) -> str | None:
    """Extract the og:image or twitter:image from parsed HTML."""
    for prop in ["og:image", "twitter:image", "twitter:image:src"]:
        tag = soup.find("meta", property=prop) or soup.find("meta", attrs={"name": prop})
        if tag and tag.get("content"):
            return urljoin(base_url, tag["content"])
    return None


def _extract_code_blocks(soup: BeautifulSoup) -> list[dict]:
    """
    Extract code blocks (<pre>, <code>, or <pre><code>) from the HTML.
    Returns a list of { "language": str|None, "code": str }.
    """
    blocks = []
    seen_code = set()

    # Find <pre> tags (often wrapping <code>)
    for pre in soup.find_all("pre"):
        code_tag = pre.find("code")
        raw = (code_tag or pre).get_text(strip=False)
        raw = raw.strip()
        if not raw or len(raw) < 10 or raw in seen_code:
            continue
        seen_code.add(raw)

        # Try to detect language from class
        lang = None
        for tag in [code_tag, pre]:
            if tag and tag.get("class"):
                for cls in tag["class"]:
                    m = re.match(r"(?:language-|lang-|highlight-)(\w+)", cls, re.I)
                    if m:
                        lang = m.group(1)
                        break
            if lang:
                break

        blocks.append({"language": lang, "code": raw})

    # Also find standalone <code> blocks that are long enough to be meaningful
    for code_tag in soup.find_all("code"):
        if code_tag.parent and code_tag.parent.name == "pre":
            continue  # Already captured
        raw = code_tag.get_text(strip=False).strip()
        if len(raw) > 40 and raw not in seen_code:
            seen_code.add(raw)
            blocks.append({"language": None, "code": raw})

    return blocks


def _inject_code_blocks(text: str, code_blocks: list[dict]) -> str:
    """
    Append extracted code blocks to the text content with clear markers
    so the LLM knows code exists in the blog.
    """
    if not code_blocks:
        return text

    code_section = "\n\n═══ CODE BLOCKS FROM THIS BLOG ═══\n"
    for i, block in enumerate(code_blocks, 1):
        lang_label = block["language"] or "code"
        code_section += f"\n--- Code Block {i} ({lang_label}) ---\n"
        # Limit each block to first 60 lines to avoid token explosion
        lines = block["code"].split("\n")
        if len(lines) > 60:
            code_section += "\n".join(lines[:60])
            code_section += f"\n... ({len(lines) - 60} more lines truncated)\n"
        else:
            code_section += block["code"]
        code_section += "\n"

    return text + code_section


def _extract_text(soup: BeautifulSoup) -> str:
    """
    Extract the main article text from the page, preserving code blocks
    with clear markers so the LLM can identify them.
    """
    for element in soup(["script", "style", "nav", "footer", "header", "aside"]):
        element.decompose()

    # Extract code blocks BEFORE decomposing them
    code_blocks = _extract_code_blocks(soup)

    article = (
        soup.find("article")
        or soup.find("main")
        or soup.find("div", class_=re.compile(r"(post|article|content|entry)", re.I))
        or soup.find("div", id=re.compile(r"(post|article|content|entry)", re.I))
    )

    if article:
        text = article.get_text(separator="\n", strip=True)
    else:
        body = soup.find("body")
        text = body.get_text(separator="\n", strip=True) if body else soup.get_text(separator="\n", strip=True)

    text = re.sub(r"\n{3,}", "\n\n", text)
    text = text.strip()

    # Inject code blocks with clear markers
    text = _inject_code_blocks(text, code_blocks)

    return text


def _extract_all_image_srcs(container: BeautifulSoup, base_url: str) -> list[str]:
    """
    Comprehensively extract image URLs from a container, handling:
    - Regular <img src="...">
    - Lazy-loaded <img data-src="..."> / <img data-lazy-src="...">
    - srcset attributes on <img> and <source>
    - <picture><source srcset="..."> wrappers
    - <noscript><img src="..."> fallbacks (Medium uses these)
    - <figure> wrappers with background-image styles

    Returns de-duplicated, filtered URLs in order found.
    """
    urls: list[str] = []
    seen: set[str] = set()

    def _add(raw_url: str):
        if not raw_url or raw_url.startswith("data:"):
            return
        full = urljoin(base_url, raw_url.strip())
        if full not in seen:
            seen.add(full)
            urls.append(full)

    def _parse_srcset(srcset: str):
        """Extract highest-resolution URL from a srcset string."""
        if not srcset:
            return
        candidates = []
        for part in srcset.split(","):
            part = part.strip()
            if not part:
                continue
            pieces = part.split()
            if pieces:
                url_candidate = pieces[0]
                # Parse the width descriptor (e.g. "700w") to pick the largest
                width = 0
                if len(pieces) > 1:
                    desc = pieces[-1]
                    m = re.match(r"(\d+)w", desc)
                    if m:
                        width = int(m.group(1))
                candidates.append((url_candidate, width))
        if candidates:
            # Sort by width descending, pick the largest
            candidates.sort(key=lambda c: c[1], reverse=True)
            _add(candidates[0][0])

    # 1. <img> tags — check src, data-src, data-lazy-src, srcset
    for img in container.find_all("img"):
        src = img.get("src") or img.get("data-src") or img.get("data-lazy-src") or ""
        if src and not src.startswith("data:"):
            _add(src)
        # Also check srcset
        srcset = img.get("srcset") or img.get("data-srcset") or ""
        if srcset:
            _parse_srcset(srcset)

    # 2. <picture> > <source> tags
    for picture in container.find_all("picture"):
        for source in picture.find_all("source"):
            srcset = source.get("srcset") or ""
            if srcset:
                _parse_srcset(srcset)

    # 3. <noscript> fallback images (Medium hides the real src here)
    for noscript in container.find_all("noscript"):
        noscript_html = noscript.string or noscript.decode_contents()
        if "<img" in noscript_html:
            ns_soup = BeautifulSoup(noscript_html, "lxml")
            for img in ns_soup.find_all("img"):
                src = img.get("src") or img.get("data-src") or ""
                if src:
                    _add(src)
                srcset = img.get("srcset") or ""
                if srcset:
                    _parse_srcset(srcset)

    # 4. <figure> with inline background-image style
    for fig in container.find_all("figure"):
        style = fig.get("style") or ""
        m = re.search(r'url\(["\']?(https?://[^"\')\s]+)', style)
        if m:
            _add(m.group(1))

    return urls


def _extract_article_image_urls(soup: BeautifulSoup, base_url: str) -> list[str]:
    """
    Extract images ONLY from the article/main content area — not the
    sidebar, header, footer, nav, or other page chrome.
    This ensures we only get images that sit next to the blog text.
    """
    # Find the article body container
    article = (
        soup.find("article")
        or soup.find("main")
        or soup.find("div", class_=re.compile(r"(post|article|content|entry|story)", re.I))
        or soup.find("div", id=re.compile(r"(post|article|content|entry|story)", re.I))
    )

    # If we can't find a specific container, fall back to body
    # but strip nav/footer/aside/header first
    if not article:
        article = soup.find("body") or soup
        for tag_name in ["nav", "footer", "header", "aside"]:
            for el in article.find_all(tag_name):
                el.decompose()

    # Use comprehensive image extraction
    raw_urls = _extract_all_image_srcs(article, base_url)

    # Filter: only keep actual blog images
    image_urls = []
    for img_url in raw_urls:
        if not _is_blog_image(img_url):
            continue
        image_urls.append(img_url)

    return image_urls


def _extract_image_urls(soup: BeautifulSoup, base_url: str) -> list[str]:
    """Legacy wrapper — delegates to article-scoped extraction."""
    return _extract_article_image_urls(soup, base_url)


# ─── Image filtering ──────────────────────────────────────

# URL substrings that indicate non-blog images (icons, UI chrome, tracking)
_SKIP_URL_PATTERNS = [
    "avatar", "logo", "icon", "emoji", "gravatar", "pixel", "tracking",
    "1x1", "badge", "button", "spinner", "loader", "arrow", "caret",
    "chevron", "close", "hamburger", "menu", "nav-", "social",
    "share", "like", "clap", "bookmark", "follow", "subscribe",
    "profile", "author", "user-image", "thumbnail", "favicon",
    "sprite", "widget", "ad-", "ads/", "banner-ad", "doubleclick",
    "googlesyndication", "analytics", "stat", "beacon",
    "placeholder", "spacer", "blank", "transparent",
    "shield.io", "shields.io", "img.shields", "badge/",
    "buymeacoffee", "ko-fi", "patreon", "paypal",
    "github-mark", "twitter-logo", "linkedin-logo", "facebook-logo",
]

# File extensions that are never blog content images
_SKIP_EXTENSIONS = {".svg", ".ico", ".gif"}

# Minimum URL path length (very short paths are usually generic assets)
_MIN_PATH_LEN = 10


def _is_blog_image(url: str) -> bool:
    """Return True only if the URL looks like an actual blog content image."""
    lower = url.lower()

    # Skip by extension
    parsed = urlparse(lower)
    ext = os.path.splitext(parsed.path)[1]
    if ext in _SKIP_EXTENSIONS:
        return False

    # Skip by URL pattern
    if any(p in lower for p in _SKIP_URL_PATTERNS):
        return False

    # Medium-specific: resize:fill with small dimensions = avatars/icons
    # e.g. miro.medium.com/v2/resize:fill:64:64/...  → icon
    # but  miro.medium.com/v2/resize:fit:700/...      → content image
    fill_match = re.search(r"resize:fill:(\d+):(\d+)", lower)
    if fill_match:
        w, h = int(fill_match.group(1)), int(fill_match.group(2))
        if w < 200 or h < 200:
            return False

    # Skip very short paths (e.g. /img.png, /x.jpg — usually site assets)
    path = parsed.path.strip("/")
    if len(path) < _MIN_PATH_LEN and "." in path:
        return False

    # Skip base64/data URIs
    if lower.startswith("data:"):
        return False

    return True


# Minimum file size in bytes to keep a downloaded image (skip tiny icons)
_MIN_IMAGE_BYTES = 15_000  # 15 KB — real blog images are usually 50 KB+


# ─── Image downloading ────────────────────────────────────

def _download_images(project_id: int, image_urls: list[str], db: Session) -> list[str]:
    """Download images, discard anything that's too small to be a real blog image."""
    project_media_dir = os.path.join(settings.MEDIA_DIR, f"projects/{project_id}/images")
    os.makedirs(project_media_dir, exist_ok=True)

    # Use image-specific Accept header so servers like Medium
    # respond with the correct Content-Type (including webp)
    _IMAGE_HEADERS = {
        **_BROWSER_HEADERS,
        "Accept": "image/webp,image/avif,image/png,image/jpeg,image/*,*/*;q=0.8",
    }

    local_paths = []
    for url in image_urls:
        try:
            response = requests.get(url, headers=_IMAGE_HEADERS, timeout=15, stream=True)
            response.raise_for_status()

            # Check Content-Type — only keep actual images
            ctype = (response.headers.get("Content-Type") or "").lower()
            if ctype and "image" not in ctype:
                print(f"[SCRAPER] Skipping non-image content-type ({ctype}): {url[:80]}")
                continue

            # Determine correct extension from Content-Type first (Medium
            # serves WebP images from URLs with no extension at all)
            _CTYPE_TO_EXT = {
                "image/webp": ".webp",
                "image/png": ".png",
                "image/jpeg": ".jpg",
                "image/jpg": ".jpg",
                "image/gif": ".gif",
                "image/avif": ".avif",
            }
            ext = None
            for ct_key, ct_ext in _CTYPE_TO_EXT.items():
                if ct_key in ctype:
                    ext = ct_ext
                    break

            # Fallback: try to get extension from the URL path
            if not ext:
                parsed = urlparse(url)
                ext = os.path.splitext(parsed.path)[1] or ".jpg"
                if ext not in (".jpg", ".jpeg", ".png", ".webp", ".avif"):
                    ext = ".jpg"
            url_hash = hashlib.md5(url.encode()).hexdigest()[:10]
            filename = f"img_{url_hash}{ext}"
            local_path = os.path.join(project_media_dir, filename)

            with open(local_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)

            # Discard tiny files — they are icons/badges, not blog images
            file_size = os.path.getsize(local_path)
            if file_size < _MIN_IMAGE_BYTES:
                os.remove(local_path)
                print(f"[SCRAPER] Discarded tiny image ({file_size} bytes): {url[:80]}")
                continue

            # Upload to R2 if configured
            r2_key = None
            r2_url = None
            if r2_storage.is_r2_configured():
                try:
                    r2_url = r2_storage.upload_project_image(project_id, local_path, filename)
                    r2_key = r2_storage.image_key(project_id, filename)
                except Exception as e:
                    print(f"[SCRAPER] R2 upload failed for {filename}: {e}")

            asset = Asset(
                project_id=project_id,
                asset_type=AssetType.IMAGE,
                original_url=url,
                local_path=local_path,
                filename=filename,
                r2_key=r2_key,
                r2_url=r2_url,
            )
            db.add(asset)
            local_paths.append(local_path)

        except Exception as e:
            print(f"[SCRAPER] Failed to download image {url}: {e}")
            continue

    db.commit()
    print(f"[SCRAPER] Downloaded {len(local_paths)} blog images (discarded icons/small files)")
    return local_paths
