"""Support chatbot endpoints.

POST /api/support/chat               — main turn endpoint
GET  /api/support/conversations/{id} — restore chat on refresh
POST /api/support/conversations/new  — clear conversation pointer (no-op server-side)
POST /api/support/conversations/claim — migrate anonymous → authed
"""

from __future__ import annotations

import json
import logging
import math
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
from app.models.user import User
from app.schemas.support import (
    ChatRequest,
    ChatResponse,
    ClaimRequest,
    ConversationOut,
    EscalateRequest,
    GuidanceStep,
    MessageOut,
    NavigationHint,
    UIGuidance,
)
from app.services.email import EmailServiceError, email_service
from app.support.identity import (
    SupportIdentity,
    get_authed_support_identity,
    get_support_identity,
)
from app.support.escalation import (
    EscalationReason,
    classify_answer,
    classify_question,
    confirm_feature_request,
    handoff_line_is_safe,
    handoff_prompt,
    short_circuit_reply,
    should_short_circuit,
)
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

For all other messages, answer using the documents below.

BE HELPFUL FIRST: If the documents contain ANYTHING relevant — even a partial answer — use it. A partial answer is always better than a refusal. Do not refuse just because the documents don't cover every detail of the question.

PARTIAL-ANSWER RULE: When the documents cover part of the question, answer that part directly in "answer", then name the specific missing piece in one short sentence. Do not open with an apology and do not refuse the whole question because one detail is missing.

UNKNOWN RULE: Only when the documents contain nothing relevant at all, set "answer" to a short, human reply that names the specific thing you can't confirm and offers to put the user in touch with the team — e.g. "I'm not sure about the annual billing discount. I can pass this to our team if you'd like." Never mention documents, documentation, sources, context, or what you were "given" — the user doesn't know those exist and doesn't care. Never say "I apologise" or "I do not have enough information". Only ever OFFER to contact the team — never claim you have already sent, forwarded, escalated, or opened a ticket. Nothing is sent unless the user fills in the form themselves, so past-tense claims like "I've passed this on" or "I've opened a ticket for you" are always false. Set "citations" to [] and "ui_guidance" to []. Never guess, and never invent steps, buttons, or UI flows.

OFF-TOPIC RULE: If the user's message has nothing to do with Blog2Video or videos — general-knowledge questions (current events, facts, people, definitions), requests to perform unrelated tasks, or random/nonsense messages — set "answer" to ONE short line redirecting to Blog2Video. Do not answer the off-topic content, do not explain who you are or what you can't do, and never invent steps, buttons, or UI flows. Set "citations" to [] and "ui_guidance" to [].

CAPABILITY RULE: If the user asks for something Blog2Video genuinely does not do, say so plainly in one sentence and briefly point to the closest thing it does do. Do not apologise at length.

FEATURE-TRUTH RULE: Only describe features and steps that the documents present as Blog2Video's OWN capabilities. Some documents mention other tools (e.g. HeyGen, Synthesia, Lumen5) or capabilities Blog2Video does NOT have — most notably AI avatars / talking-head presenters. Never tell the user that Blog2Video can do something it cannot. If the user asks about a capability that only appears as a competitor's feature (like avatars), do NOT claim Blog2Video has it. Instead, briefly clarify that Blog2Video does not use avatars and redirect to what it actually does: it turns your articles, blog posts, PDFs, and newsletters into narrated videos with templates, scenes, voiceover, and branding.

NEVER-PROMOTE-COMPETITORS RULE: You represent Blog2Video ONLY. Never recommend, suggest, name, or link to any other product or service (HeyGen, Synthesia, Pictory, Lumen5, VEED, etc.), even if a document mentions one and even if Blog2Video lacks the requested feature. Do not tell the user to "use another tool" or "integrate with" a competitor. If Blog2Video can't do something, say so plainly and pivot to what Blog2Video does — nothing more.

BRAND-DISAMBIGUATION RULE: Our real product is at blog2video.app. "blog2video.ai" is a DIFFERENT, unaffiliated site — an imposter/copycat using a confusingly similar name — and so is any other close spelling variant ("blogtovideo.ai", "blog2vide.ai", "blog to video .ai", etc.). We have no relationship to any of them. If the user's message names one of these, or otherwise treats it as the same product (e.g. compares its pricing to ours, asks about "the .ai version"), state plainly and in one short sentence that it is an unaffiliated imposter/copycat, not us — do NOT treat it as "the same service" or say pricing is identical. Then continue helping with their actual question about the real Blog2Video (blog2video.app) if there is one. Never answer on behalf of that other site, never describe its features or pricing as if they were ours, and never present the two as interchangeable.

HOW-TO FORMAT RULE: When the user asks how to do something and the answer has more than one step, the "answer" field MUST present the steps as a numbered markdown list — one step per line, each line starting with "1.", "2.", "3.", etc. NEVER join the steps into one flowing paragraph with words like "start by", "then", "next", "finally". Apply this rule even if earlier replies in this conversation used paragraphs. Format:
- One short intro sentence, then the numbered steps (1., 2., 3., ...)
- **Bold** for UI element names
- ### headings only when there are 3+ distinct sections
- Do NOT write out navigation instructions like "click the pricing link in the nav menu" — the UI guidance buttons handle navigation automatically
WRONG answer value (never do this): "To turn an article into a video, start by clicking **New** on your dashboard. Then, paste your article URL. Next, pick a template. Finally, click **Generate**."
RIGHT answer value: "To turn an article into a video:\n1. Click **New** on your dashboard.\n2. Paste your article URL or upload a PDF.\n3. Pick a template and a voice.\n4. Click **Generate**, then review your scenes and export."
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

FINAL REMINDER: If your answer contains steps, format them in the "answer" field as a numbered markdown list ("1.", "2.", "3." each on its own line) — never as one paragraph.
"""

STREAM_SYSTEM_PROMPT_TEMPLATE = """You are the Blog2Video support assistant.

Write your answer as plain markdown prose — no JSON, no fences. Stream it naturally, word by word.

Blog2Video turns articles, blog posts, PDFs, newsletters, and other written content into videos.

GREETING RULE: If the user sends only a greeting (hi, hello, hey, thanks, etc.) with no question, reply with a short friendly sentence. No lists, no headings.

For all other messages, answer using the documents below.

BE HELPFUL FIRST: If the documents contain ANYTHING relevant — even a partial answer — use it. A partial answer is always better than a refusal. Do not refuse just because the documents don't cover every detail of the question.

PARTIAL-ANSWER RULE: When the documents cover part of the question, answer that part directly, then name the specific missing piece in one short sentence. Do not open with an apology and do not refuse the whole question because one detail is missing.

UNKNOWN RULE: Only when the documents contain nothing relevant at all, reply in one or two short, human sentences: name the specific thing you can't confirm, then offer to put the user in touch with the team — e.g. "I'm not sure about the annual billing discount. I can pass this to our team if you'd like." Never mention documents, documentation, sources, context, or what you were "given" — the user doesn't know those exist and doesn't care. Never say "I apologise" or "I do not have enough information". Only ever OFFER to contact the team — never claim you have already sent, forwarded, escalated, or opened a ticket. Nothing is sent unless the user fills in the form themselves, so past-tense claims like "I've passed this on" or "I've opened a ticket for you" are always false. Never guess, and never invent steps, buttons, or UI flows.

OFF-TOPIC RULE: If the user's message has nothing to do with Blog2Video or videos — general-knowledge questions (current events, facts, people, definitions), requests to perform unrelated tasks, or random/nonsense messages — reply with ONE short line redirecting to Blog2Video. Do not answer the off-topic content, do not explain who you are or what you can't do, and never invent steps, buttons, or UI flows.

CAPABILITY RULE: If the user asks for something Blog2Video genuinely does not do, say so plainly in one sentence and briefly point to the closest thing it does do. Do not apologise at length.

FEATURE-TRUTH RULE: Only describe features and steps that the documents present as Blog2Video's OWN capabilities. Some documents mention other tools (e.g. HeyGen, Synthesia, Lumen5) or capabilities Blog2Video does NOT have — most notably AI avatars / talking-head presenters. Never tell the user that Blog2Video can do something it cannot. If the user asks about a capability that only appears as a competitor's feature (like avatars), do NOT claim Blog2Video has it. Instead, briefly clarify that Blog2Video does not use avatars and redirect to what it actually does: it turns your articles, blog posts, PDFs, and newsletters into narrated videos with templates, scenes, voiceover, and branding.

NEVER-PROMOTE-COMPETITORS RULE: You represent Blog2Video ONLY. Never recommend, suggest, name, or link to any other product or service (HeyGen, Synthesia, Pictory, Lumen5, VEED, etc.), even if a document mentions one and even if Blog2Video lacks the requested feature. Do not tell the user to "use another tool" or "integrate with" a competitor. If Blog2Video can't do something, say so plainly and pivot to what Blog2Video does — nothing more.

BRAND-DISAMBIGUATION RULE: Our real product is at blog2video.app. "blog2video.ai" is a DIFFERENT, unaffiliated site — an imposter/copycat using a confusingly similar name — and so is any other close spelling variant ("blogtovideo.ai", "blog2vide.ai", "blog to video .ai", etc.). We have no relationship to any of them. If the user's message names one of these, or otherwise treats it as the same product (e.g. compares its pricing to ours, asks about "the .ai version"), state plainly and in one short sentence that it is an unaffiliated imposter/copycat, not us — do NOT treat it as "the same service" or say pricing is identical. Then continue helping with their actual question about the real Blog2Video (blog2video.app) if there is one. Never answer on behalf of that other site, never describe its features or pricing as if they were ours, and never present the two as interchangeable.

HOW-TO FORMAT RULE: When the user asks how to do something and the answer has more than one step, you MUST present the steps as a numbered markdown list — one step per line, each line starting with "1.", "2.", "3.", etc. NEVER join the steps into one flowing paragraph with words like "start by", "then", "next", "finally". Apply this rule even if earlier replies in this conversation used paragraphs. Format:
- One short intro sentence, then the numbered steps (1., 2., 3., ...)
- **Bold** for UI element names
- ### headings only when there are 3+ distinct sections
- Do NOT write out navigation instructions like "click the pricing link" — the UI guidance buttons handle navigation
WRONG (never do this): To turn an article into a video, start by clicking **New** on your dashboard. Then, paste your article URL. Next, pick a template. Finally, click **Generate**.
RIGHT:
To turn an article into a video:
1. Click **New** on your dashboard.
2. Paste your article URL or upload a PDF.
3. Pick a template and a voice.
4. Click **Generate**, then review your scenes and export.

RELEVANT DOCUMENTS:
{docs}

{user_context}

PRIOR CONVERSATION SUMMARY:
{summary}

FINAL REMINDER: If your answer contains steps, format them as a numbered markdown list ("1.", "2.", "3." each on its own line) — never as one paragraph.
"""

METADATA_SYSTEM_PROMPT_TEMPLATE = """You are a metadata extractor. Output ONLY a JSON object — no prose, no fences.

Required shape (include ALL four fields):
{{"answer":"","citations":["doc-id",...],"ui_guidance":[{{"action_id":"..."}}],"escalate":false}}

RULES:
1. "answer" — always empty string "".
2. "citations" — list of document IDs from below that the answer actually used. Empty list if none.
3. "ui_guidance" — if the user asked HOW TO DO something, include the most relevant action_id from the UI ACTION CATALOG. Empty list if the question was not a how-to. NEVER invent action_ids.
4. "escalate" — MUST be true if ANY of these hold:
   - the user asks for a human / representative / agent / live support / customer support / support ticket
   - the user asks about a REFUND, chargeback, cancelling a charge, or a billing dispute
   - the user REQUESTS A FEATURE that does not exist, asks to add/build/support something, asks "will you add X", "is X on the roadmap", or wants an integration Blog2Video does not have
   - THE ASSISTANT ANSWER says Blog2Video does NOT support / cannot do / does not have the thing asked about
   - the user is frustrated or angry, or says the assistant cannot help
   - the answer says it lacks enough information
   Otherwise false. ALWAYS include "escalate".
   Do NOT escalate when the user simply asks how to use a feature that EXISTS.

EXAMPLE — user asks "how do I render my video?":
{{"answer":"","citations":["support:user-manual"],"ui_guidance":[{{"action_id":"project.render"}}],"escalate":false}}

EXAMPLE — user asks "why does rendering fail?":
{{"answer":"","citations":["support:error-reference"],"ui_guidance":[],"escalate":false}}

EXAMPLE — user asks "can you add TikTok export?":
{{"answer":"","citations":[],"ui_guidance":[],"escalate":true}}

AVAILABLE DOCUMENT IDs:
{doc_ids}

UI ACTION CATALOG (only these action_ids are valid):
{catalog}
"""


DOC_BUDGET_CHARS = 5000


def _excerpt_for_query(body: str, query: str, budget: int = DOC_BUDGET_CHARS) -> str:
    """Return up to `budget` chars of `body`, centred on the part matching `query`.

    A plain body[:budget] silently hides everything past the cutoff. The user manual
    is >22k chars, so its later sections (logging out, aspect ratio, export) were
    never reachable no matter how well they scored in retrieval.
    """
    if len(body) <= budget:
        return body

    from app.support.retriever import tokenize

    terms = {t for t in tokenize(query) if len(t) > 2}
    if not terms:
        return body[:budget]

    # Tokenize the body the same way the retriever does and keep each token's offset.
    # Comparing stemmed token to stemmed token is what makes this work: raw substring
    # matching fails because the tokenizer stems ("logo" vs "Logo", "reorder" vs
    # "Reordering"), so query terms often don't appear literally in the text.
    token_re = re.compile(r"[a-z0-9]+")
    from app.support.retriever import _strip_suffix

    positions: list[tuple[int, str]] = []
    for m in token_re.finditer(body.lower()):
        tok = m.group()
        if len(tok) >= 3:
            positions.append((m.start(), _strip_suffix(tok)))

    # Weight by rarity so ubiquitous words ("video", "scene") don't pick a window at
    # random. Use log-scaled IDF rather than 1/(1+count): the latter is so top-heavy
    # that ONE stray occurrence (weight .50) outranks a five-occurrence cluster
    # (weight .17). That is exactly how "I'm trying to log out" — which tokenizes to
    # just {try, log} — chased a single "try" at char 17.7k and excluded the logout
    # section at 22k entirely.
    counts: dict[str, int] = {}
    for _, tok in positions:
        if tok in terms:
            counts[tok] = counts.get(tok, 0) + 1
    if not counts:
        return body[:budget]
    total_tokens = max(len(positions), 1)
    weights = {t: math.log(1 + total_tokens / (1 + c)) for t, c in counts.items()}

    # Score by term DENSITY (counting distinct terms makes every window holding one of
    # each tie, and the earliest tie wins — how "upload a logo" landed on a passing
    # mention at char 4.3k instead of LOGO SETTINGS at 13.7k), then break ties toward
    # the window covering more DISTINCT query terms, so a cluster of one repeated word
    # can't beat a passage that actually matches the whole question.
    hits = [(pos, weights[tok], tok) for pos, tok in positions if tok in weights]
    window = budget
    step = max(window // 10, 200)
    best_start, best_score = 0, -1.0
    for start in range(0, max(len(body) - window, 0) + step, step):
        end = start + window
        inside = [(w, tok) for pos, w, tok in hits if start <= pos < end]
        if not inside:
            continue
        density = sum(w for w, _ in inside)
        coverage = len({tok for _, tok in inside}) / len(weights)
        score = density * (1.0 + coverage)
        if score > best_score:
            best_start, best_score = start, score

    # Re-anchor to the densest CLUSTER of matches, not the single highest-weight token.
    # Picking one token lets an isolated rare word hijack the anchor: for "I'm trying
    # to log out" the lone "try" at 17.7k outweighed four "log" hits at 21.9k, snapping
    # the excerpt back to "== DOWNLOAD FORMATS ==" and dropping the logout steps.
    # Score each match by the weight of everything within half a window of it.
    inside = [(pos, w) for pos, w, _tok in hits if best_start <= pos < best_start + window]
    peak_pos = best_start
    if inside:
        reach = window // 2
        peak_pos = max(
            inside,
            key=lambda pw: sum(w2 for p2, w2 in inside if abs(p2 - pw[0]) <= reach),
        )[0]

    header = body.rfind("\n== ", 0, peak_pos + 1)
    if header != -1 and peak_pos - header < window:
        best_start = header + 1
    elif best_start == 0:
        return body[:budget]

    # Slide back so the excerpt always runs to the end of the document when the match
    # is near the tail. Anchoring to a heading that sits within `budget` of the end
    # would otherwise emit the heading and clip its own steps — "I'm trying to log
    # out" got "== HOW TO LOGOUT ==" with the Sign out steps cut off, and the model
    # both refused AND hallucinated a "Logout" button that does not exist.
    if best_start + budget > len(body):
        best_start = max(0, len(body) - budget)

    excerpt = body[best_start : best_start + budget]
    return excerpt if best_start == 0 else f"[...]\n{excerpt}"


def _build_doc_section(scored_docs, query: str = "") -> str:
    parts = []
    for s in scored_docs:
        d = s.doc
        body = _excerpt_for_query(d.body, query) if query else d.body[:DOC_BUDGET_CHARS]
        parts.append(
            f"--- id: {d.id}\n"
            f"title: {d.title}\n"
            f"route: {d.route}\n"
            f"{body}"
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
    identity: SupportIdentity = Depends(get_authed_support_identity),
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
        # 0.5 matches eval_retrieval.py. At 1.0 marginally-relevant docs were dropped
        # and the model fell back to refusing instead of giving a partial answer.
        min_score=0.5,
    )

    logger.info("[CHAT] Step 3: Build prompt context")
    docs_section = _build_doc_section(scored, query=body.message)
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
    identity: SupportIdentity = Depends(get_authed_support_identity),
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
        # 0.5 matches eval_retrieval.py. At 1.0 marginally-relevant docs were dropped
        # and the model fell back to refusing instead of giving a partial answer.
        min_score=0.5,
    )

    docs_section = _build_doc_section(scored, query=body.message)
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

    # Refund / human requests skip the documentation answer entirely. Answering them
    # from docs is what produced the stalling "could you provide more details about
    # the project" replies that never routed anyone to a person.
    _question_reason = classify_question(body.message)
    _short_circuit = should_short_circuit(_question_reason)
    if _short_circuit:
        logger.info("[STREAM] Escalation short-circuit: reason=%s", _question_reason.value)

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
        if _short_circuit:
            # The user asked for a person, so we never answer from the docs. We still
            # let the LLM write the hand-off line — given only the user's message and
            # no documents — so it responds to what they actually said instead of
            # reciting a fixed sentence. Falls back to a canned line if that fails.
            handoff_messages = [
                {"role": "system", "content": handoff_prompt(_question_reason)},
                {"role": "user", "content": body.message},
            ]
            # Buffered, not streamed: the line has to be checked before the user sees
            # it. The model occasionally writes "I've got you connected to a live
            # agent" — a lie, since nothing happens until they submit the form — and
            # streamed tokens cannot be taken back. It's one short sentence, so the
            # buffering costs nothing perceptible.
            drafted = ""
            try:
                async for token in stream_answer(handoff_messages):
                    drafted += token
            except LLMError as exc:
                logger.warning("[STREAM] Handoff LLM failed, using canned line: %s", exc)
            drafted = drafted.strip()
            if not drafted or not handoff_line_is_safe(drafted):
                if drafted:
                    logger.warning("[STREAM] Handoff line claimed a false action: %r", drafted)
                drafted = short_circuit_reply(_question_reason, seed=_conv_id + len(recent))
            full_text = drafted
            yield _sse_token(drafted)
        else:
            try:
                async for token in stream_answer(messages):
                    full_text += token
                    yield _sse_token(token)
            except LLMError as exc:
                logger.error("[STREAM] LLM error: %s", exc)
                yield f"event: error\ndata: LLM unavailable\n\n"
                return

        answer = full_text.strip() or "Sorry — I couldn't form an answer."

        # Tell the client the visible answer is complete so it can re-enable input
        # immediately — metadata extraction, DB persist, and summarization below
        # can add seconds and shouldn't hold the UI hostage.
        yield f"event: answer_done\ndata: {json.dumps({'conversation_id': _conv_id})}\n\n"

        # --- Phase 2: fast structured call for citations + ui_guidance ---
        if _short_circuit:
            # Nothing to cite and no tour to offer — skip the call and its latency.
            raw_llm = SupportResponse(answer=answer, escalate=True)
        else:
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
                logger.info(
                    "[STREAM] Metadata: citations=%s, ui_guidance=%s, escalate=%s",
                    raw_llm.citations, raw_llm.ui_guidance, raw_llm.escalate,
                )
            except LLMError:
                logger.warning("[STREAM] Metadata call failed, using empty citations/ui_guidance")
                raw_llm = SupportResponse(answer=answer)

        # Resolve escalation from three independent signals. The metadata call can fail
        # (above) and silently drop the LLM's verdict, so the regex nets are what keep
        # escalation from being lost entirely.
        _answer_reason = classify_answer(answer)
        # A FEATURE guess from the question wording is dropped if the answer shows the
        # feature already exists ("will you ever add Hindi voices?" — Hindi already ships).
        escalate_reason = confirm_feature_request(_question_reason, answer) or _answer_reason
        # If the question looked like a feature request but the answer shows the feature
        # already exists, that's a definitive "no escalation" — don't let the LLM's flag
        # drag it back in, or "will you ever add Hindi voices?" offers a form for a
        # language that already ships.
        _feature_already_shipped = (
            _question_reason is EscalationReason.FEATURE
            and escalate_reason is None
            and _answer_reason is None
        )
        if raw_llm.escalate and escalate_reason is None and not _feature_already_shipped:
            # LLM says escalate but neither net matched — default to the human form.
            escalate_reason = EscalationReason.HUMAN
        escalate = bool(escalate_reason) or (raw_llm.escalate and not _feature_already_shipped)
        if escalate:
            logger.info(
                "[STREAM] Escalating: reason=%s (llm=%s, question=%s, answer=%s)",
                escalate_reason.value if escalate_reason else None,
                raw_llm.escalate,
                _question_reason.value if _question_reason else None,
                _answer_reason.value if _answer_reason else None,
            )

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

        done_payload = json.dumps({
            "conversation_id": _conv_id,
            "citations": citations,
            "ui_guidance": [g.model_dump() for g in ui_guidance],
            "navigation": navigation.model_dump() if navigation else None,
            "escalate": escalate,
            "escalate_reason": escalate_reason.value if escalate_reason else None,
        })
        yield f"event: done\ndata: {done_payload}\n\n"

        # Maybe roll summary — after `done` so the extra LLM call never delays the client
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


# Max escalations per conversation, so the form can't be used to flood the inbox.
MAX_ESCALATIONS_PER_CONVERSATION = 3

# Deliberately not pydantic.EmailStr: that requires the `email-validator` package,
# which is not installed, and importing it would break the whole router.
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@router.post("/escalate", status_code=status.HTTP_202_ACCEPTED)
def escalate_to_human(
    body: EscalateRequest,
    identity: SupportIdentity = Depends(get_authed_support_identity),
    db: Session = Depends(get_db),
) -> dict:
    """Forward a support-bot escalation to the internal team by email."""
    email = body.email.strip()
    if not _EMAIL_RE.match(email):
        raise HTTPException(status_code=422, detail="Please enter a valid email address.")

    concern = body.concern.strip()
    if not concern:
        raise HTTPException(status_code=422, detail="Please describe your concern.")

    user = db.query(User).filter(User.id == identity.user_id).first() if identity.user_id else None
    user_name = user.name if user and user.name else None
    raw_plan = getattr(user.plan, "value", str(user.plan)) if (user and user.plan) else None
    user_plan = raw_plan.capitalize() if raw_plan else None

    # Attach the recent conversation so the team has context without asking for it.
    transcript: list[tuple[str, str]] = []
    if body.conversation_id is not None:
        conv = (
            db.query(SupportConversation)
            .filter(SupportConversation.id == body.conversation_id)
            .first()
        )
        if conv is not None:
            owns = (
                conv.user_id == identity.user_id
                if conv.user_id is not None
                else conv.session_id == identity.session_id
            )
            if not owns:
                raise HTTPException(status_code=403, detail="Forbidden")
            if conv.escalation_count >= MAX_ESCALATIONS_PER_CONVERSATION:
                logger.warning("[ESCALATE] Rate limited: conv_id=%d", conv.id)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="You've already sent this a few times — we'll be in touch shortly.",
                )
            msgs = (
                db.query(SupportMessage)
                .filter(SupportMessage.conversation_id == conv.id)
                .order_by(SupportMessage.created_at.desc())
                .limit(6)
                .all()
            )
            transcript = [(m.role.value, m.content[:500]) for m in reversed(msgs)]
            conv.escalation_count = (conv.escalation_count or 0) + 1
            db.commit()

    try:
        email_service.send_support_escalation_email(
            user_email=email,
            concern=concern,
            reason=body.reason or "human",
            user_name=user_name,
            user_plan=user_plan,
            page_path=body.page_path,
            transcript=transcript or None,
        )
    except EmailServiceError as exc:
        logger.error("[ESCALATE] Email send failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

    logger.info("[ESCALATE] Sent: reason=%s, from=%s", body.reason, email)
    return {"ok": True}
