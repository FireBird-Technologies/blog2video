"""OpenAI-SDK client for the support bot, pointed at OpenRouter.

Uses the openai package already installed for the DSPy/LiteLLM stack.
Persistent AsyncOpenAI client reuses TCP/TLS connections across requests.
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, AsyncGenerator

from openai import APIError, AsyncOpenAI, APIConnectionError, APIStatusError, APITimeoutError
from pydantic import BaseModel

from app.config import settings

logger = logging.getLogger(__name__)

DEFAULT_MODEL = os.environ.get("SUPPORT_LLM_MODEL", "qwen/qwen3.5-9b")
SUMMARY_MODEL = os.environ.get("SUPPORT_SUMMARY_MODEL", "qwen/qwen3.5-9b")

# Persistent client — reuses TCP/TLS connections across all requests.
# All traffic is HTTPS/TLS 1.3; the API key travels inside the encrypted channel.
_client = AsyncOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=settings.OPEN_ROUTER_KEY,  # same key DSPy uses
    default_headers={
        "HTTP-Referer": os.environ.get("FRONTEND_URL", "https://blog2video.app"),
        "X-Title": "Blog2Video Support",
    },
    timeout=20.0,
    max_retries=2,
)


class LLMError(RuntimeError):
    pass


class SupportResponse(BaseModel):
    """Typed output from the support LLM. Defaults prevent KeyErrors on missing fields."""
    answer: str = ""
    citations: list[str] = []
    # LLM sometimes returns list of strings, sometimes list of dicts — accept both
    ui_guidance: list[dict[str, Any] | str] = []


def _parse_response(content: str) -> SupportResponse | None:
    """Try increasingly lenient JSON extraction, then validate into SupportResponse."""

    def _try(raw: str) -> SupportResponse | None:
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return None
        try:
            return SupportResponse.model_validate(data)
        except Exception as exc:
            logger.debug("[LLM] Pydantic validation failed: %s", exc)
            return None

    # 1. Direct parse
    result = _try(content)
    if result is not None:
        return result

    # 2. Strip ```json ... ``` or ``` ... ``` fences
    fence = re.search(r"```(?:json)?\s*([\s\S]+?)```", content)
    if fence:
        result = _try(fence.group(1).strip())
        if result is not None:
            logger.debug("[LLM] JSON parsed after fence stripping")
            return result

    # 3. Extract first {...} object anywhere in the response
    obj = re.search(r"\{[\s\S]+\}", content)
    if obj:
        result = _try(obj.group(0))
        if result is not None:
            logger.debug("[LLM] JSON parsed via object extraction")
            return result

    return None


async def complete_json(
    messages: list[dict],
    *,
    model: str | None = None,
    max_tokens: int = 1500,
    temperature: float = 0.2,
    use_json_mode: bool = False,
) -> SupportResponse:
    """Call OpenRouter and return a typed SupportResponse."""
    model = model or DEFAULT_MODEL
    logger.info("[LLM] ===== Starting LLM call =====")
    logger.info("[LLM] Model: %s, max_tokens: %d, temperature: %.1f, json_mode=%s", model, max_tokens, temperature, use_json_mode)
    logger.info("[LLM] Messages: %d total", len(messages))
    for i, msg in enumerate(messages):
        logger.debug("[LLM]   [%d] %s: %r...", i, msg.get("role", "?").upper(), msg.get("content", "")[:100])

    kwargs: dict = dict(
        model=model,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
        extra_body={"reasoning": {"enabled": False}},
    )
    if use_json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    logger.info("[LLM] Sending request to OpenRouter...")
    try:
        resp = await _client.chat.completions.create(**kwargs)
    except APITimeoutError as exc:
        logger.error("[LLM] Request timed out: %s", exc)
        raise LLMError("OpenRouter request timed out") from exc
    except APIConnectionError as exc:
        logger.error("[LLM] Network error: %s", exc)
        raise LLMError(f"OpenRouter network error: {exc}") from exc
    except APIStatusError as exc:
        logger.error("[LLM] OpenRouter error %s: %s", exc.status_code, exc.message)
        raise LLMError(f"OpenRouter returned {exc.status_code}") from exc

    content = resp.choices[0].message.content or ""
    logger.info("[LLM] Response received: length=%d chars, model=%s", len(content), resp.model)

    result = _parse_response(content)
    if result is not None:
        logger.info("[LLM] Parsed successfully — answer=%d chars, citations=%s, ui_guidance=%d actions",
                    len(result.answer), result.citations, len(result.ui_guidance))
        return result

    # Last resort: model returned plain prose — wrap it so the chat still works
    logger.warning("[LLM] Model returned plain text — wrapping as answer. Content: %s", content[:300])
    return SupportResponse(answer=content.strip())


async def complete_text(
    messages: list[dict],
    *,
    model: str | None = None,
    max_tokens: int = 400,
    temperature: float = 0.2,
) -> str:
    """Call OpenRouter expecting plain text. Used by the summarizer."""
    model = model or SUMMARY_MODEL
    logger.info("[LLM-SUMMARY] Starting summary: model=%s, max_tokens=%d, messages=%d", model, max_tokens, len(messages))

    try:
        resp = await _client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
            extra_body={"reasoning": {"enabled": False}},
        )
    except APITimeoutError as exc:
        logger.error("[LLM-SUMMARY] Request timed out: %s", exc)
        raise LLMError("OpenRouter summary request timed out") from exc
    except APIConnectionError as exc:
        logger.error("[LLM-SUMMARY] Network error: %s", exc)
        raise LLMError(f"OpenRouter network error: {exc}") from exc
    except APIStatusError as exc:
        logger.error("[LLM-SUMMARY] OpenRouter error %s: %s", exc.status_code, exc.message)
        raise LLMError(f"OpenRouter returned {exc.status_code}") from exc

    content = (resp.choices[0].message.content or "").strip()
    logger.info("[LLM-SUMMARY] Summary generated: %d chars", len(content))
    return content


async def stream_answer(
    messages: list[dict],
    *,
    model: str | None = None,
) -> AsyncGenerator[str, None]:
    """Stream raw text tokens from the LLM. Used by the SSE streaming endpoint.

    Does NOT use response_format=json_object — streaming and forced JSON don't
    mix reliably. The caller buffers the full text and parses JSON afterwards.
    """
    model = model or DEFAULT_MODEL
    logger.info("[LLM-STREAM] Starting stream: model=%s, messages=%d", model, len(messages))
    try:
        stream = await _client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=1500,
            temperature=0.2,
            stream=True,
            extra_body={"reasoning": {"enabled": False}},
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content or ""
            if delta:
                yield delta
        logger.info("[LLM-STREAM] Stream complete")
    except APITimeoutError as exc:
        logger.error("[LLM-STREAM] Timed out: %s", exc)
        raise LLMError("OpenRouter stream timed out") from exc
    except APIConnectionError as exc:
        logger.error("[LLM-STREAM] Network error: %s", exc)
        raise LLMError(f"OpenRouter network error: {exc}") from exc
    except APIStatusError as exc:
        logger.error("[LLM-STREAM] API error %s: %s", exc.status_code, exc.message)
        raise LLMError(f"OpenRouter returned {exc.status_code}") from exc
    except APIError as exc:
        body = getattr(exc, "body", None) or getattr(exc, "response", None)
        logger.error("[LLM-STREAM] Provider error mid-stream: %s | body: %s", exc, body)
        raise LLMError(f"Provider error: {exc}") from exc
