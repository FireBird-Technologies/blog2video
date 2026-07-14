"""Support chatbot endpoints.

POST /api/support/chat               — main turn endpoint
GET  /api/support/conversations/{id} — restore chat on refresh
POST /api/support/conversations/new  — clear conversation pointer (no-op server-side)
POST /api/support/conversations/claim — migrate anonymous → authed
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.support_conversation import (
    SupportConversation,
    SupportMessage,
    SupportMessageRole,
)
from app.schemas.support import (
    ChatRequest,
    ChatResponse,
    ClaimRequest,
    ConversationOut,
    GuidanceStep,
    MessageOut,
    NavigationHint,
    UIGuidance,
)
from app.support.identity import SupportIdentity, get_support_identity
from app.support.llm_client import LLMError, SupportResponse, complete_json, stream_answer
from app.support.memory_manager import (
    SUMMARIZE_EVERY_N_MESSAGES,
    get_or_create_conversation,
    history_user_messages,
    last_assistant_cited_doc_ids,
    load_recent_messages,
    messages_to_fold,
    session_state_block,
    total_message_count,
    update_session_state,
)
from app.support.retriever import get_retriever
from app.support.summarizer import update_rolling_summary
from app.support.ui_catalog import (
    catalog_summary_for_prompt,
    hydrate,
    page_matches,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/support", tags=["support"])


# --- Prompt assembly ----------------------------------------------------------

SYSTEM_PROMPT_TEMPLATE = """You are the Blog2Video support assistant.

IMPORTANT: You MUST respond with ONLY a valid JSON object. No prose before or after it. No markdown fences. The very first character of your response must be {{ and the last must be }}.

Required shape:
{{
  "answer": "string — your reply in markdown",
  "citations": ["doc-id", ...],
  "ui_guidance": [{{"action_id": "..."}}]
}}

Blog2Video turns articles, blog posts, PDFs, newsletters, and other written content into videos.

GREETING RULE: If the user sends only a greeting (hi, hello, hey, thanks, etc.) with no question, set "answer" to a short friendly reply like "Hi! How can I help you today?", set "citations" to [], set "ui_guidance" to []. No steps, no headings.

For all other messages, answer using ONLY the documents below. If the answer is not in the documents, say you do not know.

OFF-TOPIC RULE: You are the Blog2Video support assistant ONLY — not a general-purpose chatbot. You have no internet access, no real-time information, and no knowledge outside the documents below. If the user's message is not about Blog2Video (its features, pricing, account, billing, how-to steps, or troubleshooting) — including general-knowledge questions (e.g. current events, facts, people, definitions unrelated to Blog2Video), requests to perform unrelated tasks, or anything the documents below do not cover — set "answer" to exactly "I cannot answer that.", set "citations" to [], set "ui_guidance" to []. Do not explain why, do not guess, do not describe what you think the user might mean, and never invent steps, buttons, or UI flows that are not explicitly in the documents.

FEATURE-TRUTH RULE: Only describe features and steps that the documents present as Blog2Video's OWN capabilities. Some documents mention other tools (e.g. HeyGen, Synthesia, Lumen5) or capabilities Blog2Video does NOT have — most notably AI avatars / talking-head presenters. Never tell the user that Blog2Video can do something it cannot. If the user asks about a capability that only appears as a competitor's feature (like avatars), do NOT claim Blog2Video has it. Instead, briefly clarify that Blog2Video does not use avatars and redirect to what it actually does: it turns your articles, blog posts, PDFs, and newsletters into narrated videos with templates, scenes, voiceover, and branding.

NEVER-PROMOTE-COMPETITORS RULE: You represent Blog2Video ONLY. Never recommend, suggest, name, or link to any other product or service (HeyGen, Synthesia, Pictory, Lumen5, VEED, etc.), even if a document mentions one and even if Blog2Video lacks the requested feature. Do not tell the user to "use another tool" or "integrate with" a competitor. If Blog2Video can't do something, say so plainly and pivot to what Blog2Video does — nothing more.

For how-to questions, use markdown in the "answer" field:
- **Bold** for UI element names
- Numbered lists for steps
- ### headings only when there are 3+ distinct steps
- Do NOT write out navigation instructions like "click the pricing link in the nav menu" — the UI guidance buttons handle navigation automatically
- DOC PRIORITY: when both a "help:"/"support:" document and a "blog:"/"marketing:" document are provided for the same how-to question, the "help:"/"support:" document describes the ACTUAL product steps (real buttons, real screens) and is authoritative. The "blog:"/"marketing:" documents are SEO/thought-leadership prose and may be vague or non-literal. Base the numbered steps on the "help:"/"support:" document; only use "blog:"/"marketing:" content for framing or context, never for step details.

FIELD RULES:
1. "citations" — only document IDs you actually used (e.g. "support:error-reference", "blog:slug"). Never put action_ids here.
2. "ui_guidance" — only action_ids from the UI ACTION CATALOG below when the user asks how to do something. Use [] otherwise. Never invent action_ids.
3. Output nothing outside the JSON object.

RELEVANT DOCUMENTS:
{docs}

UI ACTION CATALOG:
{catalog}

{user_context}

PRIOR CONVERSATION SUMMARY:
{summary}
"""

STREAM_SYSTEM_PROMPT_TEMPLATE = """You are the Blog2Video support assistant.

Write your answer as plain markdown prose — no JSON, no fences. Stream it naturally, word by word.

Blog2Video turns articles, blog posts, PDFs, newsletters, and other written content into videos.

GREETING RULE: If the user sends only a greeting (hi, hello, hey, thanks, etc.) with no question, reply with a short friendly sentence. No lists, no headings.

For all other messages, answer using ONLY the documents below. If the answer is not in the documents, say you do not know.

OFF-TOPIC RULE: You are the Blog2Video support assistant ONLY — not a general-purpose chatbot. You have no internet access, no real-time information, and no knowledge outside the documents below. If the user's message is not about Blog2Video (its features, pricing, account, billing, how-to steps, or troubleshooting) — including general-knowledge questions (e.g. current events, facts, people, definitions unrelated to Blog2Video), requests to perform unrelated tasks, or anything the documents below do not cover — reply with EXACTLY: "I cannot answer that." Nothing else. Do not explain why, do not guess, do not describe what you think the user might mean, and never invent steps, buttons, or UI flows that are not explicitly in the documents.

FEATURE-TRUTH RULE: Only describe features and steps that the documents present as Blog2Video's OWN capabilities. Some documents mention other tools (e.g. HeyGen, Synthesia, Lumen5) or capabilities Blog2Video does NOT have — most notably AI avatars / talking-head presenters. Never tell the user that Blog2Video can do something it cannot. If the user asks about a capability that only appears as a competitor's feature (like avatars), do NOT claim Blog2Video has it. Instead, briefly clarify that Blog2Video does not use avatars and redirect to what it actually does: it turns your articles, blog posts, PDFs, and newsletters into narrated videos with templates, scenes, voiceover, and branding.

NEVER-PROMOTE-COMPETITORS RULE: You represent Blog2Video ONLY. Never recommend, suggest, name, or link to any other product or service (HeyGen, Synthesia, Pictory, Lumen5, VEED, etc.), even if a document mentions one and even if Blog2Video lacks the requested feature. Do not tell the user to "use another tool" or "integrate with" a competitor. If Blog2Video can't do something, say so plainly and pivot to what Blog2Video does — nothing more.

For how-to answers use markdown:
- **Bold** for UI element names
- Numbered lists for steps
- ### headings only when there are 3+ distinct steps
- Do NOT write out navigation instructions like "click the pricing link" — the UI guidance buttons handle navigation

RELEVANT DOCUMENTS:
{docs}

{user_context}

PRIOR CONVERSATION SUMMARY:
{summary}
"""

METADATA_SYSTEM_PROMPT_TEMPLATE = """You are a metadata extractor. Output ONLY a JSON object — no prose, no fences.

Required shape (include ALL three fields):
{{"answer":"","citations":["doc-id",...],"ui_guidance":[{{"action_id":"..."}}]}}

RULES:
1. "answer" — always empty string "".
2. "citations" — list of document IDs from below that the answer actually used. Empty list if none.
3. "ui_guidance" — if the user asked HOW TO DO something, include the most relevant action_id from the UI ACTION CATALOG. Empty list if the question was not a how-to. NEVER invent action_ids.

EXAMPLE — user asks "how do I render my video?":
{{"answer":"","citations":["support:user-manual"],"ui_guidance":[{{"action_id":"project.render"}}]}}

EXAMPLE — user asks "why does rendering fail?":
{{"answer":"","citations":["support:error-reference"],"ui_guidance":[]}}

AVAILABLE DOCUMENT IDs:
{doc_ids}

UI ACTION CATALOG (only these action_ids are valid):
{catalog}
"""


def _build_doc_section(scored_docs) -> str:
    parts = []
    for s in scored_docs:
        d = s.doc
        parts.append(
            f"--- id: {d.id}\n"
            f"title: {d.title}\n"
            f"route: {d.route}\n"
            f"{d.body[:5000]}"
        )
    return "\n\n".join(parts) if parts else "(no matching documents)"


def _build_messages(
    *,
    system: str,
    recent: list[SupportMessage],
    current: str,
    page_path: Optional[str],
) -> list[dict]:
    msgs: list[dict] = [{"role": "system", "content": system}]
    for m in recent:
        msgs.append(
            {
                "role": "user" if m.role == SupportMessageRole.USER else "assistant",
                "content": m.content,
            }
        )
    user_content = current
    if page_path:
        user_content = f"[on {page_path}]\n{current}"
    msgs.append({"role": "user", "content": user_content})
    return msgs


def _hydrate_ui_guidance(
    raw_guidance: list[dict],
    *,
    page_path: Optional[str],
) -> tuple[list[UIGuidance], Optional[NavigationHint], list[str]]:
    """Validate action_ids against the catalog, hydrate selectors, detect navigation."""
    hydrated: list[UIGuidance] = []
    nav: Optional[NavigationHint] = None
    shown_ids: list[str] = []
    for item in raw_guidance or []:
        # LLM sometimes returns plain string action_ids instead of {"action_id": "..."}
        if isinstance(item, str):
            action_id = item
        else:
            action_id = (item or {}).get("action_id")
        if not action_id:
            continue
        action = hydrate(action_id)
        if action is None:
            logger.info("[CHAT] Dropping hallucinated action_id=%r", action_id)
            continue
        on_wrong_page = action.page_pattern != "*" and not page_matches(action.page_pattern, page_path)
        steps = [
            GuidanceStep(
                selector=s.selector, tooltip=s.tooltip, placement=s.placement
            )
            for s in action.steps
        ]
        if on_wrong_page:
            # User is on the wrong page — emit a navigation hint.
            # Still include steps in ui_guidance so the frontend can run the tour after navigating.
            if nav is None:
                _route = action.page_pattern
                _clean = re.sub(r"/:id(?:/|$)", "/", _route).strip("/")
                _label = _clean.replace("-", " ").replace("/", " › ").title() or "the right page"
                nav = NavigationHint(
                    target_route=_route,
                    requires_project_id=":id" in _route,
                    description=f"This option is on the {_label} page.",
                )
        hydrated.append(UIGuidance(action_id=action.action_id, steps=steps))
        shown_ids.append(action.action_id)
    return hydrated, nav, shown_ids


# --- Endpoints ----------------------------------------------------------------


@router.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    identity: SupportIdentity = Depends(get_support_identity),
    db: Session = Depends(get_db),
) -> ChatResponse:
    logger.info("=" * 80)
    logger.info("[CHAT] ===== START NEW SUPPORT REQUEST =====")
    logger.info("[CHAT] User message: %r (length=%d)", body.message[:100], len(body.message))
    logger.info("[CHAT] Page context: %s", body.page_path or "(none)")
    logger.info("[CHAT] Identity: user_id=%s, session_id=%s", identity.user_id, identity.session_id[-8:] if identity.session_id else None)

    try:
        conv = get_or_create_conversation(
            db,
            user_id=identity.user_id,
            session_id=identity.session_id,
            conversation_id=body.conversation_id,
        )
    except PermissionError as exc:
        logger.error("[CHAT] Permission denied: %s", exc)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))

    # Title the conversation from the first user message.
    if not conv.title:
        conv.title = body.message[:120]
        logger.info("[CHAT] Set conversation title: %r", conv.title[:60])

    logger.info("[CHAT] Step 1: Load recent message history")
    recent = load_recent_messages(db, conv.id)
    history = history_user_messages(recent)
    last_cited = last_assistant_cited_doc_ids(recent)

    logger.info("[CHAT] Step 2: BM25 retrieval")
    retriever = get_retriever()
    scored = retriever.retrieve(
        body.message,
        history=history,
        page_path=body.page_path,
        last_cited_doc_ids=last_cited,
        top_k=3,
        min_score=1.0,
    )

    logger.info("[CHAT] Step 3: Build prompt context")
    docs_section = _build_doc_section(scored)
    logger.info("[CHAT] Retrieved %d docs for prompt: %s", len(scored), [s.doc.id for s in scored])
    catalog_section = catalog_summary_for_prompt()
    summary = conv.summary or "(none)"
    user_context = session_state_block(conv.session_state or {})
    logger.info("[CHAT] Summary length: %d chars, session_state keys: %s", len(summary), list(conv.session_state.keys()) if conv.session_state else [])

    system = SYSTEM_PROMPT_TEMPLATE.format(
        docs=docs_section,
        catalog=catalog_section,
        summary=summary,
        user_context=user_context or "USER CONTEXT: (none)",
    )
    messages = _build_messages(
        system=system,
        recent=recent,
        current=body.message,
        page_path=body.page_path,
    )
    logger.info("[CHAT] Prompt assembled: system=%d chars, %d total messages", len(system), len(messages))

    # Pretty-print retrieved docs to terminal for debugging
    sep = "─" * 60
    print(f"\n{sep}")
    print(f"[DOCS] {len(scored)} document(s) retrieved for: {body.message[:80]!r}")
    print(sep)
    for i, s in enumerate(scored, 1):
        d = s.doc
        print(f"\n  #{i}  id={d.id}  score={s.score:.3f}")
        print(f"       title: {d.title}")
        print(f"       route: {d.route}")
        print(f"       score breakdown: high_signal={s.breakdown['high_signal']:.3f}  body={s.breakdown['body']:.3f}  route={s.breakdown['route']:.1f}  continuity={s.breakdown['continuity']:.1f}")
        print(f"       body preview: {d.body[:200].replace(chr(10), ' ')!r}")
    print(f"\n{sep}\n")

    logger.info("[CHAT] Step 4: Call LLM")
    try:
        llm_out = await complete_json(messages, use_json_mode=False)
    except LLMError as exc:
        logger.exception("[CHAT] LLM call failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="Support model unavailable"
        )

    logger.info("[CHAT] Step 5: Validate and hydrate LLM response")
    answer = llm_out.answer.strip()
    if not answer:
        answer = "Sorry — I couldn't form an answer. Please try rephrasing."
        logger.warning("[CHAT] LLM returned empty answer, using fallback")
    else:
        logger.info("[CHAT] LLM answer: %d chars", len(answer))

    valid_ids = {s.doc.id for s in scored}
    citations = [c for c in llm_out.citations if c in valid_ids]
    logger.info("[CHAT] Citations: raw=%s, valid=%s", llm_out.citations, citations)

    ui_guidance, navigation, shown_ids = _hydrate_ui_guidance(
        llm_out.ui_guidance, page_path=body.page_path
    )
    logger.info("[CHAT] UI guidance: %d actions, navigation=%s", len(ui_guidance), "yes" if navigation else "no")

    logger.info("[CHAT] Step 6: Persist messages to database")
    # Persist messages.
    user_msg = SupportMessage(
        conversation_id=conv.id,
        role=SupportMessageRole.USER,
        content=body.message,
        page_path=body.page_path,
    )
    db.add(user_msg)
    assistant_msg = SupportMessage(
        conversation_id=conv.id,
        role=SupportMessageRole.ASSISTANT,
        content=answer,
        page_path=body.page_path,
        cited_docs=citations,
        ui_guidance=[g.model_dump() for g in ui_guidance],
    )
    db.add(assistant_msg)

    conv.session_state = update_session_state(
        conv.session_state or {},
        page_path=body.page_path,
        cited_doc_ids=citations,
        shown_action_ids=shown_ids,
        user_authed=identity.user_id is not None,
    )
    conv.last_seen_at = datetime.utcnow()
    db.commit()
    logger.info("[CHAT] Messages persisted: user_msg_id=%d, assistant_msg_id=%d", user_msg.id, assistant_msg.id)

    logger.info("[CHAT] Step 7: Check if rolling summary update needed")
    # Maybe roll older messages into the summary.
    total = total_message_count(db, conv.id)
    logger.info("[CHAT] Total messages in conversation: %d (summarize threshold: %d)", total, SUMMARIZE_EVERY_N_MESSAGES)
    if total >= SUMMARIZE_EVERY_N_MESSAGES:
        to_fold = messages_to_fold(db, conv.id, recent)
        if to_fold:
            logger.info("[CHAT] Folding %d older messages into rolling summary", len(to_fold))
            new_summary = await update_rolling_summary(
                conv.summary or "",
                [(m.role.value, m.content) for m in to_fold],
            )
            if new_summary != conv.summary:
                logger.info("[CHAT] Summary updated: %d -> %d chars", len(conv.summary or ""), len(new_summary))
                conv.summary = new_summary
                db.commit()
    else:
        logger.debug("[CHAT] Summary update not needed yet (total < threshold)")

    logger.info("[CHAT] ===== REQUEST COMPLETE =====")
    logger.info("=" * 80)
    return ChatResponse(
        conversation_id=conv.id,
        answer=answer,
        citations=citations,
        ui_guidance=ui_guidance,
        navigation=navigation,
    )


@router.post("/chat/stream")
async def chat_stream(
    body: ChatRequest,
    identity: SupportIdentity = Depends(get_support_identity),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """SSE endpoint that streams the answer token-by-token, then sends a done event."""
    logger.info("[STREAM] ===== START STREAMING REQUEST =====")
    logger.info("[STREAM] User message: %r", body.message[:100])
    logger.info("[STREAM] Page context: %s", body.page_path or "(none)")

    try:
        conv = get_or_create_conversation(
            db,
            user_id=identity.user_id,
            session_id=identity.session_id,
            conversation_id=body.conversation_id,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))

    if not conv.title:
        conv.title = body.message[:120]

    recent = load_recent_messages(db, conv.id)
    history = history_user_messages(recent)
    last_cited = last_assistant_cited_doc_ids(recent)

    retriever = get_retriever()
    scored = retriever.retrieve(
        body.message,
        history=history,
        page_path=body.page_path,
        last_cited_doc_ids=last_cited,
        top_k=3,
        min_score=1.0,
    )

    docs_section = _build_doc_section(scored)
    catalog_section = catalog_summary_for_prompt()
    summary = conv.summary or "(none)"
    user_context = session_state_block(conv.session_state or {})

    system = STREAM_SYSTEM_PROMPT_TEMPLATE.format(
        docs=docs_section,
        catalog=catalog_section,
        summary=summary,
        user_context=user_context or "USER CONTEXT: (none)",
    )
    messages = _build_messages(
        system=system,
        recent=recent,
        current=body.message,
        page_path=body.page_path,
    )
    logger.info("[STREAM] Prompt assembled, starting stream")

    # Capture locals needed inside the generator
    _conv_id = conv.id
    _conv = conv
    _scored = scored
    _identity = identity
    _page_path = body.page_path

    def _sse_token(text: str) -> str:
        """Emit text as SSE token frames — one frame per line to avoid breaking SSE format."""
        lines = text.split("\n")
        frames = []
        for i, line in enumerate(lines):
            frames.append(f"event: token\ndata: {line}\n\n")
            if i < len(lines) - 1:
                frames.append("event: token\ndata: \n\n")
        return "".join(frames)

    async def generate():
        full_text = ""

        # --- Phase 1: stream prose answer to the client ---
        try:
            async for token in stream_answer(messages):
                full_text += token
                yield _sse_token(token)
        except LLMError as exc:
            logger.error("[STREAM] LLM error: %s", exc)
            yield f"event: error\ndata: LLM unavailable\n\n"
            return

        answer = full_text.strip() or "Sorry — I couldn't form an answer."

        # --- Phase 2: fast structured call for citations + ui_guidance ---
        doc_ids_text = "\n".join(f"- {s.doc.id}: {s.doc.title}" for s in _scored)
        meta_system = METADATA_SYSTEM_PROMPT_TEMPLATE.format(
            doc_ids=doc_ids_text or "(none)",
            catalog=catalog_summary_for_prompt(),
        )
        meta_messages = [
            {"role": "system", "content": meta_system},
            {"role": "user", "content": body.message},
            {"role": "assistant", "content": answer},
        ]
        try:
            raw_llm = await complete_json(meta_messages, max_tokens=300, temperature=0.0, use_json_mode=False)
            logger.info("[STREAM] Metadata: citations=%s, ui_guidance=%s", raw_llm.citations, raw_llm.ui_guidance)
        except LLMError:
            logger.warning("[STREAM] Metadata call failed, using empty citations/ui_guidance")
            raw_llm = SupportResponse(answer=answer)

        # Keep the streamed prose as the answer — metadata call only gives us citations/ui_guidance
        valid_ids = {s.doc.id for s in _scored}
        citations = [c for c in raw_llm.citations if c in valid_ids]
        raw_guidance = raw_llm.ui_guidance

        ui_guidance, navigation, shown_ids = _hydrate_ui_guidance(raw_guidance, page_path=_page_path)
        logger.info("[STREAM] Hydrated: citations=%s, ui_guidance=%d actions, navigation=%s", citations, len(ui_guidance), navigation)

        # Persist to DB
        user_msg = SupportMessage(
            conversation_id=_conv_id,
            role=SupportMessageRole.USER,
            content=body.message,
            page_path=_page_path,
        )
        db.add(user_msg)
        assistant_msg = SupportMessage(
            conversation_id=_conv_id,
            role=SupportMessageRole.ASSISTANT,
            content=answer,
            page_path=_page_path,
            cited_docs=citations,
            ui_guidance=[g.model_dump() for g in ui_guidance],
        )
        db.add(assistant_msg)
        _conv.session_state = update_session_state(
            _conv.session_state or {},
            page_path=_page_path,
            cited_doc_ids=citations,
            shown_action_ids=shown_ids,
            user_authed=_identity.user_id is not None,
        )
        _conv.last_seen_at = datetime.utcnow()
        db.commit()
        logger.info("[STREAM] DB persisted: user_msg_id=%d, assistant_msg_id=%d", user_msg.id, assistant_msg.id)

        # Maybe roll summary
        total = total_message_count(db, _conv_id)
        if total >= SUMMARIZE_EVERY_N_MESSAGES:
            to_fold = messages_to_fold(db, _conv_id, recent)
            if to_fold:
                new_summary = await update_rolling_summary(
                    _conv.summary or "",
                    [(m.role.value, m.content) for m in to_fold],
                )
                if new_summary != _conv.summary:
                    _conv.summary = new_summary
                    db.commit()

        done_payload = json.dumps({
            "conversation_id": _conv_id,
            "citations": citations,
            "ui_guidance": [g.model_dump() for g in ui_guidance],
            "navigation": navigation.model_dump() if navigation else None,
        })
        yield f"event: done\ndata: {done_payload}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/conversations/{conversation_id}", response_model=ConversationOut)
def get_conversation(
    conversation_id: int,
    identity: SupportIdentity = Depends(get_support_identity),
    db: Session = Depends(get_db),
) -> ConversationOut:
    logger.info("[RESTORE] Loading conversation: conv_id=%d, identity: user_id=%s session_id=%s", conversation_id, identity.user_id, identity.session_id[-8:] if identity.session_id else None)
    conv = (
        db.query(SupportConversation)
        .filter(SupportConversation.id == conversation_id)
        .first()
    )
    if conv is None:
        logger.warning("[RESTORE] Conversation not found: conv_id=%d", conversation_id)
        raise HTTPException(status_code=404, detail="Not found")
    if conv.user_id is not None and conv.user_id != identity.user_id:
        logger.warning("[RESTORE] Forbidden: conv owned by user_id=%d, request has user_id=%s", conv.user_id, identity.user_id)
        raise HTTPException(status_code=403, detail="Forbidden")
    if conv.user_id is None and conv.session_id != identity.session_id:
        logger.warning("[RESTORE] Forbidden: session mismatch for conv_id=%d", conversation_id)
        raise HTTPException(status_code=403, detail="Forbidden")

    msgs = (
        db.query(SupportMessage)
        .filter(SupportMessage.conversation_id == conv.id)
        .order_by(SupportMessage.created_at)
        .all()
    )
    logger.info(
        "[RESTORE] Returning conv_id=%d: %d messages, summary=%d chars, session_state_keys=%s",
        conv.id,
        len(msgs),
        len(conv.summary or ""),
        list(conv.session_state.keys()) if conv.session_state else [],
    )
    return ConversationOut(
        id=conv.id,
        summary=conv.summary or "",
        session_state=conv.session_state or {},
        messages=[
            MessageOut(
                id=m.id,
                role=m.role.value,
                content=m.content,
                page_path=m.page_path,
                cited_docs=list(m.cited_docs) if m.cited_docs else None,
                ui_guidance=[UIGuidance(**g) for g in (m.ui_guidance or [])] or None,
                created_at=m.created_at.isoformat(),
            )
            for m in msgs
        ],
    )


@router.post("/conversations/new")
def new_conversation(
    identity: SupportIdentity = Depends(get_support_identity),
) -> dict:
    """Server-side no-op. Frontend simply forgets its current conversation_id;
    the next /chat call with `conversation_id: null` creates a fresh row."""
    return {"ok": True}


@router.post("/conversations/claim")
def claim_conversation(
    body: ClaimRequest,
    identity: SupportIdentity = Depends(get_support_identity),
    db: Session = Depends(get_db),
) -> dict:
    logger.info("[CLAIM] Attempting to claim conv_id=%d for user_id=%s", body.conversation_id, identity.user_id)
    if identity.user_id is None:
        logger.warning("[CLAIM] Rejected — user not authenticated")
        raise HTTPException(status_code=401, detail="Login required to claim")
    conv = (
        db.query(SupportConversation)
        .filter(SupportConversation.id == body.conversation_id)
        .first()
    )
    if conv is None:
        logger.warning("[CLAIM] Conversation not found: conv_id=%d", body.conversation_id)
        raise HTTPException(status_code=404, detail="Not found")
    if conv.user_id is not None:
        if conv.user_id != identity.user_id:
            logger.warning("[CLAIM] Rejected — conv_id=%d already owned by user_id=%d", body.conversation_id, conv.user_id)
            raise HTTPException(status_code=403, detail="Already claimed by another user")
        logger.info("[CLAIM] Conv_id=%d already owned by requesting user_id=%d — no-op", body.conversation_id, identity.user_id)
        return {"ok": True, "already_owned": True}
    if conv.session_id != identity.session_id:
        logger.warning("[CLAIM] Rejected — session mismatch for conv_id=%d", body.conversation_id)
        raise HTTPException(status_code=403, detail="Session mismatch")
    conv.user_id = identity.user_id
    db.commit()
    logger.info("[CLAIM] Successfully claimed conv_id=%d for user_id=%d", body.conversation_id, identity.user_id)
    return {"ok": True, "claimed": True}
