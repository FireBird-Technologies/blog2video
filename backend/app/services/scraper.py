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
    Use Exa API to get clean text content from a URL, then do a quick
    requests pass to extract code blocks and body images.
    Works reliably with Medium, Substack, and other protected sites.
    The hero/OG image is always first in the returned list.
    """
    exa = Exa(api_key=settings.EXA_API_KEY)

    result = exa.get_contents(
        urls=[url],
        text=True,
    )

    if not result.results:
        raise ValueError("Exa returned no results")

    page = result.results[0]
    text = page.text or ""

    # Hero image first (Exa returns the og:image / hero)
    image_urls = []
    if hasattr(page, "image") and page.image:
        image_urls.append(page.image)

    # Do a quick HTML fetch to extract code blocks and body images
    # (Exa only returns plain text, losing code formatting and inline images)
    try:
        resp = requests.get(url, headers=_BROWSER_HEADERS, timeout=15)
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.text, "lxml")

            # Enrich text with code blocks that Exa strips out
            code_blocks = _extract_code_blocks(soup)
            if code_blocks:
                text = _inject_code_blocks(text, code_blocks)

            # Get hero image if Exa didn't have one
            if not image_urls:
                og_img = _extract_og_image_from_soup(soup, url)
                if og_img:
                    image_urls.append(og_img)

            # Extract body images (Exa doesn't return these)
            body_images = _extract_image_urls(soup, url)
            hero_set = set(image_urls)
            for img_url in body_images:
                if img_url not in hero_set:
                    image_urls.append(img_url)
                    hero_set.add(img_url)
    except Exception as e:
        print(f"[SCRAPER] HTML enrichment pass failed (non-fatal): {e}")

    print(f"[SCRAPER] Exa extracted {len(text)} chars, {len(image_urls)} images (hero: {bool(image_urls)})")
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


def _extract_image_urls(soup: BeautifulSoup, base_url: str) -> list[str]:
    """Extract all meaningful image URLs from the page."""
    image_urls = []
    seen = set()

    for img in soup.find_all("img"):
        src = img.get("src") or img.get("data-src") or img.get("data-lazy-src")
        if not src:
            continue

        full_url = urljoin(base_url, src)

        width = img.get("width")
        height = img.get("height")
        if width and height:
            try:
                if int(width) < 50 or int(height) < 50:
                    continue
            except ValueError:
                pass

        if full_url.startswith("data:") or full_url in seen:
            continue

        skip_patterns = ["avatar", "logo", "icon", "emoji", "gravatar", "pixel", "tracking"]
        if any(p in full_url.lower() for p in skip_patterns):
            continue

        seen.add(full_url)
        image_urls.append(full_url)

    return image_urls


# ─── Image downloading ────────────────────────────────────

def _download_images(project_id: int, image_urls: list[str], db: Session) -> list[str]:
    """Download images and save them locally."""
    project_media_dir = os.path.join(settings.MEDIA_DIR, f"projects/{project_id}/images")
    os.makedirs(project_media_dir, exist_ok=True)

    local_paths = []
    for url in image_urls:
        try:
            response = requests.get(url, headers=_BROWSER_HEADERS, timeout=15, stream=True)
            response.raise_for_status()

            parsed = urlparse(url)
            ext = os.path.splitext(parsed.path)[1] or ".jpg"
            if ext not in (".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"):
                ext = ".jpg"
            url_hash = hashlib.md5(url.encode()).hexdigest()[:10]
            filename = f"img_{url_hash}{ext}"
            local_path = os.path.join(project_media_dir, filename)

            with open(local_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)

            asset = Asset(
                project_id=project_id,
                asset_type=AssetType.IMAGE,
                original_url=url,
                local_path=local_path,
                filename=filename,
            )
            db.add(asset)
            local_paths.append(local_path)

        except Exception as e:
            print(f"[SCRAPER] Failed to download image {url}: {e}")
            continue

    db.commit()
    return local_paths
