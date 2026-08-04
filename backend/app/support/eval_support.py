"""Regression eval for the support bot. Run this after ANY change to the prompts,
the retriever, or the escalation logic.

    cd backend && python3 -m app.support.eval_support           # fast, no LLM calls
    cd backend && python3 -m app.support.eval_support --full    # + live LLM suites

Three suites:

  1. ESCALATION  — should the turn offer the "talk to a human" form? (no LLM needed)
  2. NO_APOLOGY  — real questions that must get a real answer, not a canned refusal
  3. CONTENT     — answers that already work must keep working, plus the
                   feature-truth and never-promote-competitors guards

Almost every question below is a VERBATIM question from the support_messages table.
They are the actual failures users hit, not invented examples.

Over-escalation (offering the form on a normal question) is reported separately from
misses: it interrupts a perfectly good answer, so it is the more damaging failure.
"""

from __future__ import annotations

import asyncio
import logging
import re
import sys

from .escalation import (
    EscalationReason,
    classify_answer,
    classify_question,
    confirm_feature_request,
)

# --- Suite 1: escalation ------------------------------------------------------

R = EscalationReason

# (question, expected_reason_or_None)
ESCALATION_CASES: list[tuple[str, EscalationReason | None]] = [
    # -- asking for a person (all real; #48-#60 were six users in a row who never
    #    reached one and eventually gave up) --
    ("human speak", R.HUMAN),
    ("speak to human", R.HUMAN),
    ("live agent", R.HUMAN),
    ("live support", R.HUMAN),
    ("customer support", R.HUMAN),
    ("support", R.HUMAN),
    ("help", R.HUMAN),
    ("i need help", R.HUMAN),
    ("I need further assistance.", R.HUMAN),
    ("i need assistance", R.HUMAN),
    ("need more help", R.HUMAN),
    ("real person", R.HUMAN),
    ("open a support ticket", R.HUMAN),
    ("support ticket", R.HUMAN),
    # "connect me with suport team" fell through to a doc answer and the bot invented
    # a "Support link in the bottom-left corner of your dashboard" that does not exist.
    ("connect me with suport team", R.HUMAN),
    ("connect me with support team", R.HUMAN),
    ("contact support team", R.HUMAN),
    ("contact the support team", R.HUMAN),
    ("i want to contact support", R.HUMAN),
    ("connect me to your team", R.HUMAN),
    ("reach out to your team", R.HUMAN),
    ("reach support", R.HUMAN),
    ("get me support", R.HUMAN),
    ("email support", R.HUMAN),
    ("put me in touch with someone", R.HUMAN),
    ("support team", R.HUMAN),
    ("can I speak with your team", R.HUMAN),
    ("yGe me a representative", R.HUMAN),  # real, typo and all
    # -- frustration --
    ("u cannot help", R.HUMAN),
    ("you are useless", R.HUMAN),
    ("not helpful", R.HUMAN),
    ("I give up after hours of trying to get one video to work", R.HUMAN),
    (
        "i am not paying to be disappointed - if your AI cannot do one simple "
        "video then what is the point?",
        R.HUMAN,
    ),
    # -- refunds (three real users in a row, each stalled with "provide more details") --
    ("can i geta. refund i ahte my video", R.REFUND),
    ("I JUST WANT A REFUN", R.REFUND),
    ("I DC just give me a refund", R.REFUND),
    ("I want a refund", R.REFUND),
    # -- feature requests --
    ("can you add support for TikTok export?", R.FEATURE),
    # NOTE: do NOT add "will you ever add Hindi voices?" here. Hindi is one of the 39
    # supported languages, so that question must be ANSWERED, not escalated — the
    # question-side net matches the request phrasing and confirm_feature_request()
    # cancels it once the answer shows the feature already exists.
    ("is there a roadmap for an API?", R.FEATURE),
    ("please add dark mode", R.FEATURE),
    ("it would be great if you supported Figma import", R.FEATURE),
    ("any plans to integrate with Zapier?", R.FEATURE),
    ("can I request a feature?", R.FEATURE),
    ("do you plan to support 4K export?", R.FEATURE),
    # -- MUST NOT escalate: ordinary product questions. This half matters most --
    ("How do I turn an article into a video?", None),
    ("what is the pricing of subscriptions?", None),
    ("how to add avatars", None),
    ("can I change the language?", None),
    ("list all available templates", None),
    ("how to change font size in ne scene", None),
    ("hi", None),
    ("can i get referral bonus?", None),
    ("Does downloading a PDF count as a video?", None),
    ("How to log out on Android", None),
    ("how do I edit a scene", None),
    ("what templates are available?", None),
    ("How do I render and download my video?", None),
    ("can i add my avatar", None),
    ("how to make custom template", None),
    ("Where is Ai assited editing", None),
    ("what is the free video limit?", None),
    ("how can i send referral link?", None),
    ("Tell me how to make videos", None),
    ("i wnat to edit my bg color", None),
    ("What is included in the Pro plan", None),
    ("Why does my voice clone keep failing?", None),
    ("How do I remove the logo image from the video?", None),
    ("can I upload my own video script?", None),
    ("how to get a templat e made by designer", None),
    ("how to make ppt of my video", None),
    ("which template do you feel is the simplest to use", None),
    ("so the Standard plan I can make 30 videos a month with voice over", None),
    ("mmy render keeps fsiling what do i do", None),
    ("It is taking a long time to generate my custom template.", None),
    # -- controls: contain "support"/"help" but are capability questions, not
    #    requests for a person or a new feature. Regressions here are the danger. --
    ("does blog2video support spanish?", None),
    ("what formats do you support", None),
    ("which browsers are supported", None),
    ("help me choose a template", None),
    ("do you support 4K?", None),
    ("does it support mp4", None),
    ("support for mp4 files?", None),
    ("i need my money to go further", None),
    # "team" appears in real product questions too — the contact patterns above must
    # not swallow collaboration/billing questions.
    ("can my team collaborate on a project?", None),
    ("how do I invite my team members?", None),
    ("is there a team plan?", None),
    # -- misspellings. Users type these constantly (the DB already holds
    #    "yGe me a representative" and "I JUST WANT A REFUN"). The LLM handles typos
    #    better than any regex, but these must survive a failed metadata call. --
    ("humann speak", R.HUMAN),
    ("representitive", R.HUMAN),
    ("representive", R.HUMAN),
    ("live agnt", R.HUMAN),
    ("custmer support", R.HUMAN),
    ("suport", R.HUMAN),
    ("helpp", R.HUMAN),
    ("halp", R.HUMAN),
    ("talk to a huma", R.HUMAN),
    ("get me a rep", R.HUMAN),
    ("refnud", R.REFUND),
    ("refudn", R.REFUND),
    ("i want my mony back", R.REFUND),
]

# (question, answer, expected_final_reason) — request-shaped questions about features
# that ALREADY EXIST must be answered, not turned into a feature-request form.
# Hindi ships today (39 languages), so "will you ever add Hindi voices?" must not escalate.
ALREADY_SUPPORTED_CASES: list[tuple[str, str, EscalationReason | None]] = [
    (
        "will you ever add Hindi voices?",
        "Yes, Blog2Video supports Hindi voiceover. Select Hindi from the Language dropdown.",
        None,
    ),
    ("do you plan to support 4K export?", "Yes, Blog2Video supports 4K export.", None),
    (
        "any plans to integrate with Zapier?",
        "You can already connect via the MCP server and Zapier integration.",
        None,
    ),
    ("please add dark mode", "Blog2Video does not currently offer a dark mode.", R.FEATURE),
    (
        "can you add support for TikTok export?",
        "Blog2Video does not support TikTok export.",
        R.FEATURE,
    ),
    ("is there a roadmap for an API?", "Blog2Video does not have a public roadmap.", R.FEATURE),
    # Intent-based reasons are never cancelled by the answer text.
    ("I want a refund", "Yes, Blog2Video supports that.", R.REFUND),
    ("speak to human", "Yes, Blog2Video supports that.", R.HUMAN),
]

# (answer_text, expected_reason_or_None) — the answer-side net
ANSWER_CASES: list[tuple[str, EscalationReason | None]] = [
    ("No, Blog2Video does not support importing slides from Canva.", R.FEATURE),
    ("Blog2Video does not currently offer TikTok export.", R.FEATURE),
    ("I apologise, but I do not have enough information about this.", R.HUMAN),
    ("That isn't covered in my documentation.", R.HUMAN),
    ("Captions are automatic and run on every video by default.", None),
    ("Yes, Blog2Video supports Spanish via the Language dropdown.", None),
    ("1. Open the project. 2. Click Branding. 3. Pick a font.", None),
]

# --- Suite 2: must not apologise ---------------------------------------------

# Real questions that used to return "I apologise, but I do not have enough
# information about this." Each must now produce a real answer.
NO_APOLOGY_CASES: list[tuple[str, str | None]] = [
    ("my render failed", "/projects/12"),
    ("how do I change my password?", None),
    ("who do I contact for support", None),
    ("What is the longest duration allowed for making a video?", "/mcp-connector"),
    ("how to convert my video to landscape", "/dashboard"),
    ("I need to download the horizontal format of my video", "/project/1737"),
    ("How to log out on Android", "/dashboard"),
    ("I'm trying to log out", "/dashboard"),
    ("There is no access to log out", "/dashboard"),
    (
        "On the main page, it appears to have a film or covering over the image",
        "/project/1955",
    ),
]

_APOLOGY_RE = re.compile(r"apolog|do not have enough|don't have enough", re.I)

# Questions with no corpus coverage at all — these exercise the UNKNOWN RULE.
# The reply must read like a person, never leak that a retrieval system exists.
NO_JARGON_CASES: list[tuple[str, str | None]] = [
    ("do you integrate with Notion?", None),
    ("can I schedule posts to instagram automatically?", None),
    ("is there an annual billing discount?", None),
    ("do you have a Shopify plugin?", None),
]

# "my documentation", "the documents", "the provided context", "my sources" — all
# internal plumbing. Users don't know a corpus exists; naming it is just the
# apology in a different outfit and leaves them at the same dead end.
# Only flag "docs"/"documents" when they refer to MY retrieval context. A bare \bdocs\b
# also matches legitimate product answers ("export to Google Docs", "your documents"),
# which made this guard fail ~2/6 runs on the Notion question for no real reason.
_JARGON_RE = re.compile(
    r"""(?ix)
      \b(?:my|the|available|provided|current|these|those|supplied)\s+
        (?:documents?|documentation|docs)\b
    | \bin\s+(?:my|the)\s+(?:documents?|documentation|docs)\b
    | \bdocumentation\b
    | \bcorpus\b
    | \b(?:context|sources)\s+(?:provided|given|supplied)\b
    | \bprovided\s+(?:context|sources)\b
    | \bmy\s+sources\b
    | \bknowledge\s+base\b
    | \bretriev\w+
    | \binformation\s+(?:i\s+was\s+)?(?:given|provided)\b
    """
)

# Nothing reaches the team unless the USER submits the form. A reply claiming the
# message is already sent is a lie that leaves people waiting for a reply that
# will never come — the bot really did this to a live user who asked it to
# "open a support ticket" (it invented a ticket and asked for a Project ID).
_FALSE_SEND_RE = re.compile(
    r"(?i)\b(?:i(?:'ve| have)?\s+(?:already\s+)?"
    r"(?:sent|forwarded|passed|escalated|submitted|raised|opened|created|notified|contacted|reached out)"
    r"|(?:has|have)\s+been\s+(?:sent|forwarded|passed|escalated|submitted|raised|opened|created|connected)"
    r"|your\s+(?:request|message|ticket|concern)\s+(?:has\s+been|was)\s+\w+"
    # "I've got you connected to a live agent" — the model wrote exactly this, and the
    # user is connected to nobody until they submit the form.
    r"|i(?:'ve| have)?\s+(?:got\s+you\s+|now\s+)?connected\s+you"
    r"|i(?:'ve| have)\s+connected\b"
    r"|you\s*(?:are|'re|’re)\s+now\s+connected"
    r"|got\s+you\s+connected)"
)

# --- Suite 1c: guard regexes must not misfire ---------------------------------

# The guards are themselves a source of false failures. Every string below caused a
# real wrong verdict during development, so they are pinned here.

# (text, should_be_flagged) — leaking the retrieval plumbing to the user
JARGON_GUARD_CASES: list[tuple[str, bool]] = [
    ("I can't find that in the available documentation.", True),
    ("That is not in my documents.", True),
    ("I don't see it in the provided context.", True),
    ("Based on the documentation, no.", True),
    ("The provided documents do not mention it.", True),
    ("I have no information about that in my sources.", True),
    ("these documents do not cover it", True),
    # Legitimate product answers — a bare \bdocs\b/\bdocument\b flagged these and made
    # the Notion question fail ~2/6 runs for no reason.
    ("You can export to Google Docs and share from there.", False),
    ("Copy the iframe into your Notion page.", False),
    ("Blog2Video does not integrate with Notion directly.", False),
    ("You can share your documents as PDF exports.", False),
    ("Export your slides as a PowerPoint or PDF document.", False),
    ("Upload your document as a PDF.", False),
    ("I'm not sure about that. I can pass this to our team if you'd like.", False),
]

# (text, should_be_flagged) — claiming a message was already sent. Nothing reaches the
# team unless the USER submits the form, so past-tense claims are always false.
FALSE_SEND_GUARD_CASES: list[tuple[str, bool]] = [
    ("I've passed this on to our team.", True),
    ("I have forwarded your request to support.", True),
    ("I've opened a ticket for you.", True),
    ("Your request has been sent to our team.", True),
    ("I have escalated this issue.", True),
    ("Your ticket was created.", True),
    # The LLM actually wrote the first of these while drafting a hand-off line. The
    # user is connected to nobody until they submit the form.
    ("I've got you connected to a live agent via the contact form right below.", True),
    ("I've connected you with the team.", True),
    ("You are now connected to an agent.", True),
    ("You're now connected to support.", True),
    # ...but offering to connect them is exactly what the hand-off line should do.
    ("I can help you get connected with a team member right here in the form below.", False),
    ("You can connect with our team using the form below.", False),
    ("I'd be happy to connect you with a team member; please use the form below.", False),
    # Offers, not claims — these must stay allowed.
    ("I can pass this to our team if you'd like.", False),
    ("Our team can help you with this directly.", False),
    ("If you'd like, fill in the form below and we'll get back to you by email.", False),
    ("You can contact support directly if you need more help.", False),
]

# (text, should_be_flagged) — falsely claiming Blog2Video has AI avatars. 12+ real
# users asked about avatars; the correct answer is "no", so negations must not trip.
AVATAR_GUARD_CASES: list[tuple[str, bool]] = [
    ("Yes, Blog2Video supports avatars in the scene editor.", True),
    ("Blog2Video has avatar presenters you can add.", True),
    ("You can add an avatar to any scene.", True),
    ("We offer AI avatars on the Pro plan.", True),
    ("No, Blog2Video does not support AI avatars or talking-head presenters.", False),
    ("Blog2Video doesn't support avatars.", False),
    ("Blog2Video cannot add an avatar to your video.", False),
    ("We do not offer avatars.", False),
]

# (drafted_line, must_be_blocked) — the runtime gate on LLM-written hand-off lines.
# Every "must block" string below was actually produced by the model while drafting a
# hand-off, or is a near-miss of one. The line is buffered and checked before the user
# sees it, because a claim that they're already connected leaves them waiting for a
# reply that never comes.
HANDOFF_SAFETY_CASES: list[tuple[str, bool]] = [
    ("I've got you connected to a live agent via the contact form right below.", True),
    ("I've connected you with the team.", True),
    ("You are now connected to an agent.", True),
    ("You're now connected to support.", True),
    ("I've passed this on to our team.", True),
    ("I have forwarded your request to support.", True),
    ("I've opened a ticket for you.", True),
    ("Your request has been sent to our team.", True),
    # Real lines the model wrote that are correct — offering, not claiming. Blocking
    # these would throw away the natural wording and fall back to a canned sentence.
    ("I can connect you with a team member right away via the contact form below.", False),
    ("I can certainly connect you with a team member via the short contact form right below.", False),
    ("I've got you covered—just fill out the contact form right below to connect with a team member.", False),
    ("You can reach a live agent by filling out the contact form right below.", False),
    ("You can open a support ticket right here in the form below.", False),
    ("We'd love to help you out, so please fill out the contact form right below.", False),
    ("I'm sorry you're feeling stuck; you can reach a team member directly through the contact form right below.", False),
    ("I hear your frustration and want to help you get that refund sorted out.", False),
    ("I can help you get in touch with a person from the support team right below.", False),
]

# --- Suite 1d: long-document excerpting ---------------------------------------

# 51 of 224 corpus docs exceed the prompt budget. The old body[:5000] prefix hid
# everything past ~22% of the user manual, so retrieval could rank the right doc #1
# and the model would still never see the answer. Each case asserts the ANSWER TEXT
# (not just a heading) survives into the excerpt.
EXCERPT_CASES: list[tuple[str, str]] = [
    ("I'm trying to log out", 'Click "Sign out" directly'),
    ("How to log out on Android", 'Click "Sign out" directly'),
    ("There is no access to log out", 'Click "Sign out" directly'),
    ("how do I sign out", 'Click "Sign out" directly'),
    ("where is the logout button", 'Click "Sign out" directly'),
    ("i cant log out", 'Click "Sign out" directly'),
    ("how do I change my password?", "myaccount.google.com"),
    ("how do I change the font", "Font Family dropdown"),
    ("how do I convert to portrait aspect ratio", "ASPECT RATIO"),
    ("how do I render the video", "RENDER"),
    ("how do I reorder scenes", "REORDER"),
    ("how do I upload a logo", "LOGO SETTINGS"),
    ("how do I change the playback speed", "speed control"),
    ("how do I download my video", "DOWNLOAD FORMATS"),
    ("how do I edit a scene", "EDITING A SCENE"),
]

# --- Suite 3: answer content --------------------------------------------------

# (question, page_path, must_contain_any) — answers that already work must keep working
CONTENT_CASES: list[tuple[str, str | None, list[str]]] = [
    ("does blog2video support spanish?", None, ["spanish"]),
    ("how do I edit a scene", "/projects/5", ["scene"]),
    ("how much does it cost?", None, ["$", "plan", "free", "price", "pricing"]),
    ("how do I turn an article into a video?", "/", ["url", "template", "generate", "paste"]),
]

# Blog2Video has no avatar feature, but the corpus mentions competitors that do.
# 12+ real users asked about avatars, so this guard matters.
#
# Must not trip on the CORRECT answer ("Blog2Video does not support AI avatars"),
# so negations are excluded explicitly — a naive "supports ... avatar" pattern
# flags the very behaviour we want.
AVATAR_FALSE_CLAIM_RE = re.compile(
    r"(?i)\b(blog2video|we|you)\b\s+"
    r"(?!(?:do(?:es)?\s+not|don'?t|doesn'?t|cannot|can'?t|never)\b)"
    r"(?:can|does|supports?|offers?|has|have|provides?)\b[^.]{0,40}\bavatar",
)
COMPETITORS = ["heygen", "synthesia", "pictory", "lumen5", "veed"]


# --- Runners ------------------------------------------------------------------


def run_escalation() -> tuple[int, int, int]:
    """Returns (passed, total, over_escalations)."""
    print("=" * 78)
    print("SUITE 1: ESCALATION (no LLM calls)")
    print("=" * 78)
    passed = over = 0
    for question, expected in ESCALATION_CASES:
        got = classify_question(question)
        ok = got == expected
        passed += ok
        if not ok and expected is None:
            over += 1
        if not ok:
            kind = "OVER-ESCALATED" if expected is None else "MISSED"
            print(f"  FAIL [{kind:14}] got={got} want={expected}  {question[:52]!r}")
    print(f"  question-side: {passed}/{len(ESCALATION_CASES)}  over-escalations={over}")

    a_passed = 0
    for answer, expected in ANSWER_CASES:
        got = classify_answer(answer)
        ok = got == expected
        a_passed += ok
        if not ok:
            print(f"  FAIL [answer-side] got={got} want={expected}  {answer[:52]!r}")
    print(f"  answer-side:   {a_passed}/{len(ANSWER_CASES)}")

    s_passed = 0
    for question, answer, expected in ALREADY_SUPPORTED_CASES:
        got = confirm_feature_request(classify_question(question), answer)
        ok = got == expected
        s_passed += ok
        if not ok:
            kind = "STILL-ESCALATED" if expected is None else "WRONGLY-CANCELLED"
            print(f"  FAIL [{kind}] got={got} want={expected}  {question[:44]!r}")
    print(f"  already-ships: {s_passed}/{len(ALREADY_SUPPORTED_CASES)}")

    return (
        passed + a_passed + s_passed,
        len(ESCALATION_CASES) + len(ANSWER_CASES) + len(ALREADY_SUPPORTED_CASES),
        over,
    )


async def _answer(question: str, page_path: str | None) -> str:
    """Run the real production prompt path for one question."""
    from app.routers.support import (
        STREAM_SYSTEM_PROMPT_TEMPLATE,
        _build_doc_section,
        _build_messages,
    )

    from .llm_client import stream_answer
    from .retriever import get_retriever

    scored = get_retriever().retrieve(question, page_path=page_path, top_k=3, min_score=0.5)
    system = STREAM_SYSTEM_PROMPT_TEMPLATE.format(
        # query= is required: without it _build_doc_section falls back to a plain
        # body[:5000] prefix and this eval silently tests a path production never uses.
        docs=_build_doc_section(scored, query=question),
        catalog="",
        summary="(none)",
        user_context="USER CONTEXT: (none)",
    )
    messages = _build_messages(system=system, recent=[], current=question, page_path=page_path)
    out = ""
    async for token in stream_answer(messages):
        out += token
    return out.strip()


def run_handoff_lines() -> tuple[int, int]:
    """The canned hand-off lines must vary, and must never claim anything was sent."""
    from .escalation import (
        _SHORT_CIRCUIT_REPLIES,
        handoff_line_is_safe,
        short_circuit_reply,
    )

    print()
    print("=" * 78)
    print("SUITE 1e: HAND-OFF LINES (no LLM calls)")
    print("=" * 78)
    passed = total = 0
    for reason, variants in _SHORT_CIRCUIT_REPLIES.items():
        # More than one wording, so escalating twice doesn't echo the same sentence.
        total += 1
        if len(variants) > 1:
            passed += 1
        else:
            print(f"  FAIL [{reason.value}] only {len(variants)} variant — will repeat verbatim")
        for text in variants:
            total += 1
            bad = (
                _FALSE_SEND_RE.search(text)
                or _JARGON_RE.search(text)
                or _APOLOGY_RE.search(text)
            )
            if bad:
                print(f"  FAIL [{reason.value}] {bad.group()!r} in {text[:56]!r}")
            else:
                passed += 1
        # Rotation must actually produce different text across seeds.
        total += 1
        if len({short_circuit_reply(reason, s) for s in range(len(variants))}) == len(variants):
            passed += 1
        else:
            print(f"  FAIL [{reason.value}] seed rotation does not cycle all variants")

    # The runtime safety net that gates every LLM-written hand-off line.
    for text, should_block in HANDOFF_SAFETY_CASES:
        total += 1
        blocked = not handoff_line_is_safe(text)
        if blocked == should_block:
            passed += 1
        else:
            kind = "LET A FALSE CLAIM THROUGH" if should_block else "BLOCKED A GOOD LINE"
            print(f"  FAIL [{kind}] {text[:62]!r}")

    print(f"  {passed}/{total} hand-off checks passed")
    return passed, total


def run_guards() -> tuple[int, int]:
    """The guard regexes themselves — no LLM calls. Returns (passed, total)."""
    print()
    print("=" * 78)
    print("SUITE 1c: GUARD REGEXES (no LLM calls)")
    print("=" * 78)
    passed = total = 0
    for label, cases, rx in (
        ("jargon    ", JARGON_GUARD_CASES, _JARGON_RE),
        ("false-send", FALSE_SEND_GUARD_CASES, _FALSE_SEND_RE),
        ("avatar    ", AVATAR_GUARD_CASES, AVATAR_FALSE_CLAIM_RE),
    ):
        sub = 0
        for text, should_flag in cases:
            ok = bool(rx.search(text)) == should_flag
            sub += ok
            if not ok:
                kind = "MISSED" if should_flag else "FALSE-POSITIVE"
                print(f"  FAIL [{label.strip()}/{kind}] {text[:60]!r}")
        passed += sub
        total += len(cases)
        print(f"  {label}: {sub}/{len(cases)}")
    return passed, total


def run_excerpt() -> tuple[int, int]:
    """Long-doc excerpting must surface the ANSWER, not just the heading."""
    print()
    print("=" * 78)
    print("SUITE 1d: LONG-DOC EXCERPTING (no LLM calls)")
    print("=" * 78)
    from app.routers.support import _excerpt_for_query

    from .corpus_loader import get_corpus

    manual = next((d for d in get_corpus() if d.id == "support:user-manual"), None)
    if manual is None:
        print("  SKIP — support:user-manual not in corpus")
        return 0, 0
    passed = 0
    for question, needle in EXCERPT_CASES:
        ok = needle in _excerpt_for_query(manual.body, question)
        passed += ok
        if not ok:
            print(f"  FAIL {question[:46]!r} — excerpt missing {needle!r}")
    print(f"  {passed}/{len(EXCERPT_CASES)} answers survived the {len(manual.body)}-char doc")
    return passed, len(EXCERPT_CASES)


async def run_no_apology() -> tuple[int, int]:
    print()
    print("=" * 78)
    print("SUITE 2: NO CANNED APOLOGY (live LLM)")
    print("=" * 78)
    answers = await asyncio.gather(*[_answer(q, p) for q, p in NO_APOLOGY_CASES])
    passed = 0
    for (question, _), answer in zip(NO_APOLOGY_CASES, answers):
        # "I can't find that in the documentation" is a refusal wearing a different
        # hat: no apology token, but the user is left at the same dead end. Checking
        # only for "apologise" hid exactly this for the log-out questions.
        apology = _APOLOGY_RE.search(answer)
        leak = _JARGON_RE.search(answer)
        false_send = _FALSE_SEND_RE.search(answer)
        ok = not apology and not leak and not false_send
        passed += ok
        marker = "ok     " if ok else "REFUSED"
        print(f"  [{marker}] {question[:56]!r}")
        if not ok:
            why = "apologised" if apology else (
                f"leaked {leak.group()!r}" if leak else f"faked send {false_send.group()!r}"
            )
            print(f"            {why} -> {answer[:100]}")
    print(f"  {passed}/{len(NO_APOLOGY_CASES)} answered without a canned apology")
    return passed, len(NO_APOLOGY_CASES)


async def run_no_jargon() -> tuple[int, int]:
    print()
    print("=" * 78)
    print("SUITE 2b: NO INTERNAL JARGON WHEN UNSURE (live LLM)")
    print("=" * 78)
    # "open a support ticket" is the real question that made the bot invent a ticket.
    probes = NO_JARGON_CASES + [("open a support ticket", None), ("I need further assistance.", None)]
    answers = await asyncio.gather(*[_answer(q, p) for q, p in probes])
    passed = 0
    for (question, _), answer in zip(probes, answers):
        leak = _JARGON_RE.search(answer)
        apology = _APOLOGY_RE.search(answer)
        false_send = _FALSE_SEND_RE.search(answer)
        ok = not leak and not apology and not false_send
        passed += ok
        print(f"  [{'ok    ' if ok else 'FAIL  '}] {question[:52]!r}")
        if not ok:
            if leak:
                why = f"leaked {leak.group()!r}"
            elif false_send:
                why = f"claimed already sent: {false_send.group()!r}"
            else:
                why = "apologised"
            print(f"            {why} -> {answer[:110]}")
    print(f"  {passed}/{len(probes)} replied without leaking internals or faking a send")
    return passed, len(probes)


async def run_live_handoff() -> tuple[int, int]:
    """Generate real hand-off lines and check what the user would actually see.

    The offline suite only tests fixed strings. This exercises the live model, which
    is where "I've got you connected to a live agent" came from in the first place.
    """
    from .escalation import classify_question, handoff_line_is_safe, handoff_prompt
    from .llm_client import stream_answer

    print()
    print("=" * 78)
    print("SUITE 2c: LIVE HAND-OFF LINES (live LLM)")
    print("=" * 78)

    async def draft(question: str) -> str:
        reason = classify_question(question)
        out = ""
        async for token in stream_answer(
            [
                {"role": "system", "content": handoff_prompt(reason)},
                {"role": "user", "content": question},
            ]
        ):
            out += token
        return out.strip()

    questions = [
        "talk to a human",
        "live agent",
        "connect me with suport team",
        "I JUST WANT A REFUN",
        "open a support ticket",
        "u cannot help",
    ]
    lines = await asyncio.gather(*[draft(q) for q in questions])
    passed = 0
    for question, line in zip(questions, lines):
        unsafe = not handoff_line_is_safe(line)
        jargon = _JARGON_RE.search(line)
        # A stock opener on every escalation is what made this feel robotic.
        stock = re.match(r"(?i)\s*(i understand\b|i'm sorry to hear\b)", line)
        ok = not unsafe and not jargon and not stock
        passed += ok
        if ok:
            print(f"  [ok    ] {line[:88]}")
        else:
            why = "false claim" if unsafe else ("jargon" if jargon else "stock opener")
            print(f"  [{why:11}] {question!r} -> {line[:76]}")
    print(f"  {passed}/{len(questions)} live hand-off lines clean")
    return passed, len(questions)


async def run_content() -> tuple[int, int]:
    print()
    print("=" * 78)
    print("SUITE 3: ANSWER CONTENT + GUARDS (live LLM)")
    print("=" * 78)
    answers = await asyncio.gather(*[_answer(q, p) for q, p, _ in CONTENT_CASES])
    passed = 0
    for (question, _, needles), answer in zip(CONTENT_CASES, answers):
        low = answer.lower()
        ok = any(n.lower() in low for n in needles)
        passed += ok
        print(f"  [{'ok  ' if ok else 'FAIL'}] {question[:50]!r} expects one of {needles}")
        if not ok:
            print(f"          -> {answer[:100]}")

    # Guards run over every answer produced in this run.
    total = len(CONTENT_CASES)
    avatar_answer = await _answer("can i add my avatar", None)
    all_answers = list(answers) + [avatar_answer]

    total += 1
    if AVATAR_FALSE_CLAIM_RE.search(avatar_answer):
        print(f"  [FAIL] feature-truth: claimed Blog2Video has avatars -> {avatar_answer[:110]}")
    else:
        passed += 1
        print("  [ok  ] feature-truth: did not claim Blog2Video has avatars")

    total += 1
    named = {c for a in all_answers for c in COMPETITORS if c in a.lower()}
    if named:
        print(f"  [FAIL] competitor guard: named {sorted(named)}")
    else:
        passed += 1
        print("  [ok  ] competitor guard: no competitors named")

    print(f"  {passed}/{total} content checks passed")
    return passed, total


def run(full: bool = False) -> int:
    logging.disable(logging.CRITICAL)  # retriever logs one block per query; too noisy here

    esc_pass, esc_total, over = run_escalation()
    grd_pass, grd_total = run_guards()
    exc_pass, exc_total = run_excerpt()
    hnd_pass, hnd_total = run_handoff_lines()
    failures = (
        (esc_total - esc_pass)
        + (grd_total - grd_pass)
        + (exc_total - exc_pass)
        + (hnd_total - hnd_pass)
    )

    if full:
        no_ap_pass, no_ap_total = asyncio.run(run_no_apology())
        jarg_pass, jarg_total = asyncio.run(run_no_jargon())
        lhnd_pass, lhnd_total = asyncio.run(run_live_handoff())
        cont_pass, cont_total = asyncio.run(run_content())
        failures += (
            (no_ap_total - no_ap_pass)
            + (jarg_total - jarg_pass)
            + (lhnd_total - lhnd_pass)
            + (cont_total - cont_pass)
        )
    else:
        no_ap_pass = no_ap_total = jarg_pass = jarg_total = cont_pass = cont_total = 0
        lhnd_pass = lhnd_total = 0

    print()
    print("=" * 78)
    print("SUMMARY")
    print("=" * 78)
    print(f"  escalation      {esc_pass}/{esc_total}   over-escalations={over}")
    print(f"  guard regexes   {grd_pass}/{grd_total}")
    print(f"  excerpting      {exc_pass}/{exc_total}")
    print(f"  hand-off lines  {hnd_pass}/{hnd_total}")
    if full:
        print(f"  no-apology      {no_ap_pass}/{no_ap_total}")
        print(f"  no-jargon       {jarg_pass}/{jarg_total}")
        print(f"  live hand-off   {lhnd_pass}/{lhnd_total}")
        print(f"  answer content  {cont_pass}/{cont_total}")
    else:
        print("  (run with --full for the live-LLM suites)")

    # Over-escalation is called out separately: it breaks working answers.
    if over:
        print(f"\n  !! {over} OVER-ESCALATION(S) — the form is interrupting normal questions")
    print("\n  RESULT:", "PASS" if failures == 0 else f"FAIL ({failures} check(s))")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(run(full="--full" in sys.argv))
