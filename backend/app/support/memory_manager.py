"""Conversation memory: recent turns + rolling summary + structured session_state.

Three layers, all persisted on the conversation row, all rebuilt from Postgres
each request. The LLM is stateless; this module assembles the slice that goes
into the prompt every turn.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models.support_conversation import (
    SupportConversation,
    SupportMessage,
    SupportMessageRole,
)

logger = logging.getLogger(__name__)

# Tunables ---------------------------------------------------------------------
SOFT_HISTORY_HOURS = 24
RECENT_TURNS_MAX = 6  # last 6 messages = ~3 user/assistant turns
SUMMARIZE_EVERY_N_MESSAGES = 8  # roll into summary every 4 turns


def get_or_create_conversation(
    db: Session,
    *,
    user_id: Optional[int],
    session_id: str,
    conversation_id: Optional[int],
) -> SupportConversation:
    """Load an existing conversation (with auth check) or create a new one.

    Authorization rule: a request can read/append iff
    - request.user_id == conversation.user_id (both non-null), OR
    - request.session_id == conversation.session_id AND conversation.user_id IS NULL
    """
    logger.info("[MEMORY] ===== Getting or creating conversation =====")
    logger.info("[MEMORY] Identity: user_id=%s, session_id=%s (last 8 chars)", user_id, session_id[-8:] if session_id else None)

    if conversation_id is not None:
        logger.info("[MEMORY] Loading existing conversation: conv_id=%d", conversation_id)
        conv = (
            db.query(SupportConversation)
            .filter(SupportConversation.id == conversation_id)
            .first()
        )
        if conv is None:
            logger.error("[MEMORY] Conversation not found: conv_id=%d", conversation_id)
            raise PermissionError("conversation not found")
        if conv.user_id is not None and conv.user_id != user_id:
            logger.error("[MEMORY] Authorization failed: conv owned by user_id=%d, request has user_id=%s", conv.user_id, user_id)
            raise PermissionError("conversation does not belong to this user")
        if conv.user_id is None and conv.session_id != session_id:
            logger.error("[MEMORY] Authorization failed: conv owned by session_id=%s, request has session_id=%s", conv.session_id[-8:], session_id[-8:])
            raise PermissionError("conversation does not belong to this session")
        logger.info("[MEMORY] Loaded conversation: conv_id=%d, title=%r, title_len=%d", conv.id, conv.title[:40] if conv.title else "(empty)", len(conv.title or ""))
        return conv

    logger.info("[MEMORY] Creating new conversation")
    conv = SupportConversation(
        user_id=user_id,
        session_id=session_id,
        summary="",
        session_state={},
    )
    db.add(conv)
    db.flush()
    logger.info("[MEMORY] New conversation created: conv_id=%d", conv.id)
    return conv


def load_recent_messages(
    db: Session, conversation_id: int
) -> list[SupportMessage]:
    logger.info("[MEMORY] Loading recent messages: conv_id=%d, window=%dh, max=%d msgs", conversation_id, SOFT_HISTORY_HOURS, RECENT_TURNS_MAX)
    cutoff = datetime.utcnow() - timedelta(hours=SOFT_HISTORY_HOURS)
    rows = (
        db.query(SupportMessage)
        .filter(SupportMessage.conversation_id == conversation_id)
        .filter(SupportMessage.created_at >= cutoff)
        .order_by(desc(SupportMessage.created_at))
        .limit(RECENT_TURNS_MAX)
        .all()
    )
    rows.reverse()
    logger.info("[MEMORY] Loaded %d recent messages: %d user, %d assistant", len(rows), sum(1 for m in rows if m.role == SupportMessageRole.USER), sum(1 for m in rows if m.role == SupportMessageRole.ASSISTANT))
    for msg in rows:
        logger.debug("[MEMORY]   - %s: %r (length=%d, cited_docs=%s)", msg.role.value.upper(), msg.content[:60], len(msg.content), msg.cited_docs or [])
    return rows


def history_user_messages(messages: list[SupportMessage]) -> list[str]:
    user_msgs = [m.content for m in messages if m.role == SupportMessageRole.USER]
    logger.debug("[MEMORY] Extracted %d user messages for history expansion", len(user_msgs))
    return user_msgs


def last_assistant_cited_doc_ids(messages: list[SupportMessage]) -> list[str]:
    for m in reversed(messages):
        if m.role == SupportMessageRole.ASSISTANT and m.cited_docs:
            doc_list = list(m.cited_docs)
            logger.debug("[MEMORY] Last cited doc IDs (for continuity boost): %s", doc_list)
            return doc_list
    logger.debug("[MEMORY] No prior cited docs found")
    return []


def update_session_state(
    state: dict,
    *,
    page_path: Optional[str],
    cited_doc_ids: list[str],
    shown_action_ids: list[str],
    user_authed: bool,
) -> dict:
    out = dict(state or {})
    out["auth"] = "authed" if user_authed else "anonymous"
    if page_path:
        out["current_page"] = page_path
        visited = list(out.get("visited_pages", []))
        if page_path not in visited:
            visited.append(page_path)
            out["visited_pages"] = visited[-10:]  # cap
    if cited_doc_ids:
        out["recent_cited_doc_ids"] = cited_doc_ids
    if shown_action_ids:
        prev = list(out.get("shown_action_ids", []))
        for a in shown_action_ids:
            if a not in prev:
                prev.append(a)
        out["shown_action_ids"] = prev[-20:]
    return out


def session_state_block(state: dict) -> str:
    if not state:
        logger.debug("[MEMORY] Session state is empty")
        return ""
    parts = []
    for key in (
        "current_page",
        "visited_pages",
        "user_goal",
        "shown_action_ids",
        "recent_cited_doc_ids",
        "auth",
        "plan",
    ):
        if key in state and state[key]:
            parts.append(f"  {key}: {state[key]}")
    if not parts:
        logger.debug("[MEMORY] Session state has no meaningful keys")
        return ""
    result = "USER CONTEXT:\n" + "\n".join(parts)
    logger.debug("[MEMORY] Built session_state_block: %d keys with values", len(parts))
    return result


def total_message_count(db: Session, conversation_id: int) -> int:
    return (
        db.query(SupportMessage)
        .filter(SupportMessage.conversation_id == conversation_id)
        .count()
    )


def messages_to_fold(
    db: Session, conversation_id: int, recent: list[SupportMessage]
) -> list[SupportMessage]:
    """Return older messages (outside the recent window) that haven't been folded into the summary yet.

    Heuristic: any message older than the oldest in `recent` is a candidate. We
    pick at most 4 at a time to keep summarization cheap.
    """
    if not recent:
        return []
    oldest_kept = min(m.created_at for m in recent)
    rows = (
        db.query(SupportMessage)
        .filter(SupportMessage.conversation_id == conversation_id)
        .filter(SupportMessage.created_at < oldest_kept)
        .order_by(desc(SupportMessage.created_at))
        .limit(4)
        .all()
    )
    rows.reverse()
    return rows
