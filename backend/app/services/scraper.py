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
    Use Exa API to get clean text content and images from a URL.
    Works reliably with Medium, Substack, and other protected sites.
    """
    exa = Exa(api_key=settings.EXA_API_KEY)

    result = exa.get_contents(
        ids=[url],
        text=True,
        # Exa returns clean markdown text by default
    )

    if not result.results:
        raise ValueError("Exa returned no results")

    page = result.results[0]
    text = page.text or ""

    # Extract image URLs from the Exa result if available
    image_urls = []
    if hasattr(page, "image") and page.image:
        image_urls.append(page.image)

    print(f"[SCRAPER] Exa extracted {len(text)} chars, {len(image_urls)} images")
    return text, image_urls


# ─── Requests + BeautifulSoup fallback ────────────────────

def _scrape_with_requests(url: str) -> tuple[str, list[str]]:
    """
    Fallback scraper using requests + BeautifulSoup.
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
    image_urls = _extract_image_urls(soup, url)

    return text, image_urls


def _extract_text(soup: BeautifulSoup) -> str:
    """Extract the main article text from the page."""
    for element in soup(["script", "style", "nav", "footer", "header", "aside"]):
        element.decompose()

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
    return text.strip()


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
