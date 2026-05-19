"""Rolling-summary update via Qwen 7B.

Called every ~4 turns to fold older messages into a compact prose summary,
keeping per-turn token cost flat regardless of conversation length.
"""

from __future__ import annotations

import logging

from .llm_client import LLMError, complete_text

logger = logging.getLogger(__name__)


async def update_rolling_summary(
    prev_summary: str,
    folded_turns: list[tuple[str, str]],
) -> str:
    """`folded_turns` is a list of (role, content) pairs being folded into the summary."""
    if not folded_turns:
        logger.debug("[SUMMARIZER] No turns to fold — returning previous summary unchanged")
        return prev_summary

    logger.info(
        "[SUMMARIZER] Folding %d turns into rolling summary (prev summary: %d chars)",
        len(folded_turns),
        len(prev_summary),
    )
    for i, (role, content) in enumerate(folded_turns):
        logger.debug("[SUMMARIZER]   turn[%d] %s: %r", i, role.upper(), content[:80])

    transcript = "\n".join(
        f"{role.upper()}: {content}" for role, content in folded_turns
    )
    system = (
        "You compress conversation history into a 2-3 sentence summary that a "
        "support assistant can use as context for follow-up turns. Capture the "
        "user's goal, what was answered, and any decisions or page navigations. "
        "Be concise. No greetings, no quotes, no bullets."
    )
    user = (
        f"Previous summary: {prev_summary or '(none)'}\n\n"
        f"New turns to fold in:\n{transcript}\n\n"
        f"Updated summary (2-3 sentences):"
    )
    try:
        result = await complete_text(
            [{"role": "system", "content": system}, {"role": "user", "content": user}],
            max_tokens=200,
            temperature=0.2,
        )
        new_summary = result.strip()[:1200]
        logger.info(
            "[SUMMARIZER] Summary updated: %d chars -> %d chars | %r...",
            len(prev_summary),
            len(new_summary),
            new_summary[:100],
        )
        return new_summary
    except LLMError as exc:
        logger.warning("[SUMMARIZER] Rolling-summary update failed, keeping previous (%d chars): %s", len(prev_summary), exc)
        return prev_summary
