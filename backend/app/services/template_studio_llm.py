"""Anthropic Claude backend for Template Studio **template creation**.

Used for design-doc normalization, JSON plan extraction, per-layout TSX codegen
during `template/create`, the same for **`ai-layout/create` (new layout)**,
and matching prompt.md section generation. Text-only Anthropic Messages API.

Uses **TEMPLATE_CREATION_ANTHROPIC_API_KEY** only (not the general
`ANTHROPIC_API_KEY`).

**Scene edit** and **layout rebuild** still use Gemini — see `_call_gemini_*`.
"""
from __future__ import annotations

import anthropic
from fastapi import HTTPException

from app.config import settings

_client: anthropic.Anthropic | None = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is not None:
        return _client
    key = (settings.TEMPLATE_CREATION_ANTHROPIC_API_KEY or "").strip()
    if not key:
        raise HTTPException(
            status_code=400,
            detail="TEMPLATE_CREATION_ANTHROPIC_API_KEY is not configured.",
        )
    _client = anthropic.Anthropic(api_key=key, timeout=600.0)
    return _client


def _response_text(message: anthropic.types.Message) -> str:
    chunks: list[str] = []
    for block in message.content:
        if getattr(block, "type", None) == "text":
            chunks.append(block.text)
    return "".join(chunks).strip()


def template_studio_chat(
    *,
    system: str,
    user: str,
    max_tokens: int,
    temperature: float = 0.2,
    log_label: str | None = None,
) -> str:
    """One chat completion: Claude (see `CLAUDE_CODE_MODEL` in settings).

    Raises HTTPException on missing API key, API failure, or empty assistant text.

    log_label: if set, included in stdout when the model is printed (e.g. layout_id).
    """
    client = _get_client()
    model = (settings.CLAUDE_CODE_MODEL or "claude-sonnet-4-6").strip()
    step = log_label or "template_studio"
    print(
        f"[template-studio] Anthropic model={model} step={step}",
        flush=True,
    )
    try:
        message = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Anthropic request failed ({model}): {e}",
        ) from e
    text = _response_text(message)
    if not text:
        raise HTTPException(
            status_code=502,
            detail=f"Anthropic returned empty output ({model}).",
        )
    return text
