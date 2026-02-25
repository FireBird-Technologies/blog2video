"""
AI image generation providers (OpenAI, Gemini). Returns base64 image data.
"""
import base64
from abc import ABC, abstractmethod
from typing import Optional

from app.config import settings


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
    return None
