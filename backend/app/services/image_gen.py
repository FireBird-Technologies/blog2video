"""
AI image generation providers (OpenAI, Gemini, GLM). Returns base64 image data.
"""
import base64
import time
from abc import ABC, abstractmethod
from typing import Optional

import requests

from app.config import settings

# z.ai OpenAI-compatible base URL for GLM-Image generation.
GLM_BASE_URL = "https://api.z.ai/api/paas/v4/"


class _TransientDownloadError(Exception):
    """A retryable image-download failure (object not yet available, 5xx, empty body)."""


def _looks_like_image(data: bytes) -> bool:
    """True if the bytes start with a known raster-image magic number."""
    return (
        data.startswith(b"\x89PNG\r\n\x1a\n")       # PNG
        or data.startswith(b"\xff\xd8\xff")          # JPEG
        or data.startswith(b"GIF87a")                # GIF
        or data.startswith(b"GIF89a")                # GIF
        or (data[:4] == b"RIFF" and data[8:12] == b"WEBP")  # WEBP
    )


class ImageProvider(ABC):
    """Generate an image from a text prompt. Returns base64-encoded image string."""

    @abstractmethod
    def generate(self, prompt: str, **kwargs) -> str:
        raise NotImplementedError


class OpenAIProvider(ImageProvider):
    """OpenAI image generation (gpt-image-1)."""

    def __init__(self, api_key: str):
        from openai import OpenAI
        self._client = OpenAI(api_key=api_key)

    def generate(self, prompt: str, **kwargs) -> str:
        # Default size/quality if not provided (layout-based caller usually passes size)
        if "size" not in kwargs:
            kwargs.setdefault("size", "1536x1024")
        if "quality" not in kwargs:
            kwargs.setdefault("quality", "high")
        if "n" not in kwargs:
            kwargs.setdefault("n", 1)
        response = self._client.images.generate(
            model="gpt-image-1",
            prompt=prompt,
            **kwargs,
        )
        return response.data[0].b64_json


class GeminiProvider(ImageProvider):
    """Gemini image generation (gemini-2.5-flash-image). Requires: pip install google-genai"""

    def __init__(self, api_key: str):
        try:
            from google import genai
        except ImportError as e:
            raise RuntimeError(
                "Gemini provider requires the google-genai package. "
                "Install it with: pip install google-genai"
            ) from e
        self._client = genai.Client(api_key=api_key)

    def generate(self, prompt: str, **kwargs) -> str:
        generation_config = kwargs.pop("generation_config", None)
        config = None
        if generation_config and isinstance(generation_config, dict):
            config = self._build_gemini_config(generation_config)
        if config is not None:
            kwargs["config"] = config
        response = self._client.models.generate_content(
            model="gemini-2.5-flash-image",
            contents=[prompt],
            **kwargs,
        )
        for candidate in response.candidates:
            for part in candidate.content.parts:
                if part.inline_data is not None:
                    data = part.inline_data.data
                    if isinstance(data, bytes):
                        return base64.b64encode(data).decode("ascii")
                    return data
        raise RuntimeError("No image returned from Gemini")

    def _build_gemini_config(self, gen_config: dict):
        """Build SDK config from our generation_config dict (aspect_ratio, image_size)."""
        try:
            from google.genai import types
            aspect_ratio = gen_config.get("aspect_ratio") or "16:9"
            image_size = gen_config.get("image_size") or "2k"
            if hasattr(types, "GenerateContentConfig"):
                kwargs = {}
                if hasattr(types, "ImageGenerationConfig"):
                    kwargs["image_generation_config"] = types.ImageGenerationConfig(
                        aspect_ratio=aspect_ratio,
                        image_size=image_size,
                    )
                elif hasattr(types, "ImageConfig"):
                    kwargs["image_config"] = types.ImageConfig(
                        aspect_ratio=aspect_ratio,
                        image_size=image_size,
                    )
                if kwargs:
                    return types.GenerateContentConfig(**kwargs)
            if hasattr(types, "GenerationConfig") and hasattr(types, "ImageConfig"):
                return types.GenerateContentConfig(
                    generation_config=types.GenerationConfig(
                        image_config=types.ImageConfig(
                            aspect_ratio=aspect_ratio,
                            image_size=image_size,
                        )
                    )
                )
        except Exception:
            pass
        return None


class GLMProvider(ImageProvider):
    """GLM image generation (GLM-Image via z.ai). Uses the OpenAI-compatible endpoint.

    z.ai returns an image URL rather than base64, so we download it and encode.
    """

    def __init__(self, api_key: str):
        from openai import OpenAI
        self._api_key = api_key
        self._client = OpenAI(api_key=api_key, base_url=GLM_BASE_URL)
        self._model = (settings.GLM_IMAGE_MODEL or "glm-image").strip()

    def generate(self, prompt: str, **kwargs) -> str:
        size = kwargs.get("size") or "1024x1024"
        url: Optional[str] = None
        route = "sdk"
        try:
            response = self._client.images.generate(
                model=self._model,
                prompt=prompt,
                size=size,
                n=1,
            )
            if response.data:
                url = getattr(response.data[0], "url", None)
        except Exception as e:
            # OpenAI-compat image route not accepted — fall back to a raw POST.
            print(f"[zai-image] SDK route failed model={self._model} err={type(e).__name__}: {str(e)[:300]}")
            route = "raw"
            url = self._generate_raw(prompt, size)
        if not url:
            route = "raw"
            url = self._generate_raw(prompt, size)
        if not url:
            print(f"[zai-image] FAIL model={self._model} route={route}: no image URL returned")
            raise RuntimeError("No image returned from GLM")
        # Log the (truncated) URL so a failing case can be reproduced with `curl`
        # from different hosts, to tell a bad GLM result apart from a host that
        # can't fetch an otherwise-valid URL.
        print(f"[zai-image] url  model={self._model} route={route} url={url[:160]}")
        image_bytes = self._download_image(url)
        print(f"[zai-image] OK   model={self._model} route={route} bytes={len(image_bytes)}")
        return base64.b64encode(image_bytes).decode("ascii")

    # GLM returns the image URL before the object is finalized on mfile.z.ai, so a
    # fetch immediately after generation often 404s (or returns an empty body). The
    # object appears a moment later, so we re-fetch the SAME url a few times with
    # backoff before giving up. Total added latency in the worst case: ~sum(delays).
    _DOWNLOAD_MAX_ATTEMPTS = 4
    _DOWNLOAD_BACKOFF_SECONDS = (0.75, 1.5, 3.0)

    def _download_image(self, url: str) -> bytes:
        """Download the generated image from GLM's returned URL, validating that the
        response is actually an image. GLM commonly hands back the URL before the
        object is available (404 / empty body), so transient failures are retried
        with backoff. If it still isn't an image after retries (non-2xx, empty body,
        or non-image content), we fail loudly instead of base64-encoding garbage into
        a broken image — the caller turns this into a 502 (no credit charged)."""
        last_error = "unknown error"
        for attempt in range(self._DOWNLOAD_MAX_ATTEMPTS):
            try:
                return self._attempt_download(url)
            except _TransientDownloadError as e:
                last_error = str(e)
                if attempt < len(self._DOWNLOAD_BACKOFF_SECONDS):
                    delay = self._DOWNLOAD_BACKOFF_SECONDS[attempt]
                    print(
                        f"[zai-image] RETRY model={self._model} download "
                        f"attempt={attempt + 1}/{self._DOWNLOAD_MAX_ATTEMPTS} "
                        f"in={delay}s: {last_error}"
                    )
                    time.sleep(delay)
        print(f"[zai-image] FAIL model={self._model} download after "
              f"{self._DOWNLOAD_MAX_ATTEMPTS} attempts: {last_error}")
        raise RuntimeError(f"GLM image download failed: {last_error}")

    def _attempt_download(self, url: str) -> bytes:
        """One download attempt. Raises _TransientDownloadError for retryable
        conditions (object-not-ready 404, 5xx, empty body) and RuntimeError for
        responses that won't improve on retry (a real non-image payload)."""
        resp = requests.get(url, timeout=60)
        # 404 (object not yet written) and 5xx (server hiccup) are worth retrying.
        if resp.status_code == 404 or resp.status_code >= 500:
            raise _TransientDownloadError(f"status {resp.status_code}")
        try:
            resp.raise_for_status()
        except requests.HTTPError as e:
            # Other 4xx (403 expired-signature, etc.) won't improve on retry.
            raise RuntimeError(
                f"GLM image download failed with status {resp.status_code}"
            ) from e

        content_type = (resp.headers.get("Content-Type") or "").lower()
        image_bytes = resp.content
        if not image_bytes:
            raise _TransientDownloadError("empty body")
        # Accept when the server declares an image type, or when the bytes carry a
        # known image magic number (PNG/JPEG/GIF/WEBP) — some CDNs omit/mislabel it.
        if "image/" not in content_type and not _looks_like_image(image_bytes):
            snippet = image_bytes[:120].decode("latin-1", "replace")
            raise RuntimeError(
                f"GLM image download returned non-image content "
                f"(content_type={content_type!r} head={snippet!r})"
            )
        return image_bytes

    def _generate_raw(self, prompt: str, size: str) -> Optional[str]:
        """Raw POST to the z.ai images endpoint; returns the image URL or None."""
        resp = requests.post(
            f"{GLM_BASE_URL}images/generations",
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            },
            json={"model": self._model, "prompt": prompt, "size": size},
            timeout=120,
        )
        try:
            resp.raise_for_status()
        except requests.HTTPError as e:
            print(f"[zai-image] FAIL model={self._model} route=raw status={resp.status_code}: {str(e)[:300]}")
            raise
        data = (resp.json() or {}).get("data") or []
        if data:
            return data[0].get("url")
        return None


def get_image_provider() -> Optional[ImageProvider]:
    """Return the configured image provider from env, or None if not configured."""
    provider = (settings.IMAGE_PROVIDER or "openai").strip().lower()
    if provider == "openai":
        key = (settings.OPENAI_API_KEY or "").strip()
        if not key:
            return None
        return OpenAIProvider(api_key=key)
    if provider == "gemini":
        key = (settings.GEMINI_API_KEY or "").strip()
        if not key:
            return None
        return GeminiProvider(api_key=key)
    if provider == "glm":
        key = (settings.ZAI_API_KEY or "").strip()
        if not key:
            return None
        return GLMProvider(api_key=key)
    return None
