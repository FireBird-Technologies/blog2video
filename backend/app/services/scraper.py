import os
import re
import hashlib
import requests
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from app.config import settings
from app.models.project import Project, ProjectStatus
from app.models.asset import Asset, AssetType


def scrape_blog(project: Project, db: Session) -> Project:
    """
    Scrape blog content and images from the project's blog_url.
    Updates the project with extracted text and downloads images.
    """
    url = project.blog_url
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    response = requests.get(url, headers=headers, timeout=30)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "lxml")

    # Extract main text content
    blog_text = _extract_text(soup)

    # Extract and download images
    image_urls = _extract_image_urls(soup, url)
    _download_images(project.id, image_urls, db)

    # Update project
    project.blog_content = blog_text
    project.status = ProjectStatus.SCRAPED
    db.commit()
    db.refresh(project)

    return project


def _extract_text(soup: BeautifulSoup) -> str:
    """Extract the main article text from the page."""
    # Remove script and style elements
    for element in soup(["script", "style", "nav", "footer", "header", "aside"]):
        element.decompose()

    # Try to find the article content using common selectors
    article = (
        soup.find("article")
        or soup.find("main")
        or soup.find("div", class_=re.compile(r"(post|article|content|entry)", re.I))
        or soup.find("div", id=re.compile(r"(post|article|content|entry)", re.I))
    )

    if article:
        text = article.get_text(separator="\n", strip=True)
    else:
        # Fallback: get body text
        body = soup.find("body")
        text = body.get_text(separator="\n", strip=True) if body else soup.get_text(separator="\n", strip=True)

    # Clean up multiple newlines
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

        # Resolve relative URLs
        full_url = urljoin(base_url, src)

        # Skip tiny icons, tracking pixels, etc.
        width = img.get("width")
        height = img.get("height")
        if width and height:
            try:
                if int(width) < 50 or int(height) < 50:
                    continue
            except ValueError:
                pass

        # Skip data URIs and duplicates
        if full_url.startswith("data:") or full_url in seen:
            continue

        # Skip common non-content images
        skip_patterns = ["avatar", "logo", "icon", "emoji", "gravatar", "pixel", "tracking"]
        if any(p in full_url.lower() for p in skip_patterns):
            continue

        seen.add(full_url)
        image_urls.append(full_url)

    return image_urls


def _download_images(project_id: int, image_urls: list[str], db: Session) -> list[str]:
    """Download images and save them locally. Returns list of local paths."""
    project_media_dir = os.path.join(settings.MEDIA_DIR, f"projects/{project_id}/images")
    os.makedirs(project_media_dir, exist_ok=True)

    local_paths = []
    for url in image_urls:
        try:
            response = requests.get(url, timeout=15, stream=True)
            response.raise_for_status()

            # Determine filename
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

            # Create asset record
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
            print(f"Failed to download image {url}: {e}")
            continue

    db.commit()
    return local_paths
