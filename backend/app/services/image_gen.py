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
