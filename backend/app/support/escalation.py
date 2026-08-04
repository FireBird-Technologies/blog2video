"""Escalation detection for the support bot.

Decides when a turn should offer the "talk to a human" / "request this feature" form
instead of (or alongside) a documentation answer.

The LLM metadata call is the primary decision-maker (see METADATA_SYSTEM_PROMPT_TEMPLATE
rule 4). These regex nets are deterministic backstops for two cases the LLM misses:

  * terse phrasings ("human speak", "i need help", "I need further assistance")
  * the metadata call failing entirely — it swallows LLMError and returns empty
    metadata, which would silently lose the escalation

Every pattern here was tuned against the real user questions in the support_messages
table. The must-NOT-fire half matters more than the must-fire half: over-escalating
interrupts a perfectly good answer, which is worse than missing one.
"""

from __future__ import annotations

import re
from enum import Enum


class EscalationReason(str, Enum):
    """Why we're offering the form. Drives the button label and the email subject."""

    HUMAN = "human"
    REFUND = "refund"
    FEATURE = "feature"


# --- Question-side patterns ---------------------------------------------------

# Asking to reach a person. "support"/"help" alone are handled by _BARE_ASK below —
# here they must appear in a compound phrase so "what formats do you support" is safe.
_HUMAN_RE = re.compile(
    r"""(?ix)
    \b(human|agent|representative|live\s+support|live\s+agent|customer\s+support)\b
    | \brep\b
    | \bsupport\s+(?:ticket|team|staff|agent|rep)\b
    | \breal\s+person\b
    | \btalk\s+to\s+(a|an|someone|somebody)\b
    | \bspeak\s+(to|with)\b
    | \bhuman\s+speak\b
    | \b(further|more)\s+assistance\b
    | \bneed\s+(further\s+|more\s+)?(help|assistance)\b
    # "connect me with support", "contact the support team", "reach out to your team"
    # — asking to be put in touch with people, not asking a product question.
    | \b(?:connect|put)\s+me\s+(?:with|to|in\s+touch)\b
    | \b(?:contact|reach|email|message)\s+(?:the\s+|your\s+|our\s+)?
        (?:support|team|sales|someone|somebody|a\s+person)\b
    | \breach\s+out\s+to\s+(?:the\s+|your\s+|our\s+)?(?:support|team|someone)\b
    | \bget\s+me\s+(?:support|help|someone|a\s+person)\b
    | \b(?:your|the)\s+(?:support\s+)?team\b
    """
)

# "refun" prefix deliberately catches the real typo "I JUST WANT A REFUN".
_REFUND_RE = re.compile(
    r"""(?ix)
    \brefun\w*\b
    | \bchargeback\b
    | \bmoney\s+back\b
    | \bbilling\s+dispute\b
    | \bcancel\s+(my\s+)?(charge|payment|subscription\s+and\s+refund)\b
    """
)

# Frustration / giving up. These users need a person, not another doc answer.
_FRUSTRATION_RE = re.compile(
    r"""(?ix)
    \bcannot\s+help\b
    | \bcan.?t\s+help\b
    | \buseless\b
    | \bgive\s+up\b
    | \bnot\s+helpful\b
    | \bwaste\s+of\s+(time|money)\b
    | \bfed\s+up\b
    | \bnot\s+paying\s+to\s+be\b
    | \bwhat.?s?\s+the\s+point\b
    | \bcannot\s+do\s+one\s+simple\b
    """
)

# Explicit feature requests.
_FEATURE_RE = re.compile(
    r"""(?ix)
    # "add support for X" / "add a feature" — a request verb, not a capability question.
    # Deliberately NOT a bare \bsupport\b, so "what formats do you support" stays quiet.
    \b(add|build|implement|introduce)\s+(a\s+|an\s+)?(feature|integration|support\s+for)\b
    | \b(add|build|implement)\s+support\s+for\b
    | \bfeature\s+request\b
    | \brequest\s+a\s+feature\b
    | \bon\s+the\s+roadmap\b
    | \bis\s+there\s+a\s+roadmap\b
    # "will you add/support X" is a request; "do you support X" is a capability
    # question about today and must NOT escalate ("what formats do you support").
    | \bwill\s+you\s+(ever\s+)?(add|support|offer|have)\b
    | \bdo\s+you\s+(ever\s+)?plan\b
    | \bany\s+plans?\s+to\b
    | \bplease\s+add\b
    | \bwould\s+be\s+great\s+if\s+you\s+(supported|added)\b
    | \bdo\s+you\s+plan\s+to\b
    """
)

# A message that is ONLY "support" / "help" (plus punctuation) is someone asking for
# a person. Anchored so it can never match inside a product question.
_BARE_ASK_RE = re.compile(r"^\s*(support|help)\s*[!.?]*\s*$", re.IGNORECASE)

# Common misspellings of the words above. Users type these constantly — the live DB
# already contains "yGe me a representative" and "I JUST WANT A REFUN". The LLM
# handles most typos better than any regex can, but this is the offline fallback
# that has to work when the metadata call fails, so the frequent ones are listed.
_TYPO_HUMAN_RE = re.compile(
    r"""(?ix)
    \b(?:humann+|huamn|humna)\b
    | \brepresent(?:i|a)tive\b | \brepresentive\b | \brepresentitve\b
    | \b(?:live|liv)\s+agnt\b | \bagetn\b
    | \bcust(?:m|o)er\s+(?:support|suport|servic\w*)\b
    | \bassistanc\b | \bassistence\b
    | \buseles\b | \bpointles\b
    # Bare misspelling of support/help — anchored to the WHOLE message, exactly like
    # _BARE_ASK_RE. Unanchored, "suport"/"help" patterns swallow ordinary capability
    # questions ("what formats do you support", "help me choose a template").
    | ^\s*(?:sup+ort|suppor|hel+p+|halp|hlep)\s*[!.?]*\s*$
    """
)

_TYPO_REFUND_RE = re.compile(
    r"(?ix) \brefnud\w*\b | \brefudn\w*\b | \brefud\b | \bmon(?:y|ey)\s+back\b"
)


# --- Answer-side pattern ------------------------------------------------------

# Real feature requests are often phrased as ordinary how-tos ("Can I upload custom
# theme slides from Canva?") and are indistinguishable from a normal question up
# front. Once the answer says the capability doesn't exist, that IS the signal.
_NOT_SUPPORTED_RE = re.compile(
    r"""(?ix)
    \bdoes\s+not\s+(currently\s+)?(support|offer|have|allow)\b
    | \bdoesn.?t\s+(currently\s+)?(support|offer|have|allow)\b
    | \bis\s+not\s+(currently\s+)?(supported|available|offered)\b
    | \bisn.?t\s+(currently\s+)?(supported|available|offered)\b
    | \bnot\s+currently\s+(supported|available|possible)\b
    | \bcannot\s+(be\s+)?(import|upload|use|do)\w*\b
    | \bthere\s+is\s+no\s+way\s+to\b
    """
)

# The bot admitting it lacks information — the user still needs an answer from a human.
_NO_INFO_RE = re.compile(
    r"(?i)\bapolog\w*\b|\bdo\s+not\s+have\s+enough\b|\bdon.?t\s+have\s+enough\b"
    r"|\bisn.?t\s+covered\s+in\s+my\s+documentation\b|\bnot\s+covered\s+in\s+my\s+documentation\b"
)


def classify_question(message: str) -> EscalationReason | None:
    """Escalation reason detectable from the user's message alone, else None.

    Order matters: refund and human requests short-circuit the doc answer entirely,
    so they are checked before the feature net.
    """
    if not message:
        return None
    if _REFUND_RE.search(message) or _TYPO_REFUND_RE.search(message):
        return EscalationReason.REFUND
    if (
        _HUMAN_RE.search(message)
        or _BARE_ASK_RE.match(message)
        or _FRUSTRATION_RE.search(message)
        or _TYPO_HUMAN_RE.search(message)
    ):
        return EscalationReason.HUMAN
    if _FEATURE_RE.search(message):
        return EscalationReason.FEATURE
    return None


def classify_answer(answer: str) -> EscalationReason | None:
    """Escalation reason detectable only after seeing the answer, else None."""
    if not answer:
        return None
    if _NOT_SUPPORTED_RE.search(answer):
        return EscalationReason.FEATURE
    if _NO_INFO_RE.search(answer):
        return EscalationReason.HUMAN
    return None


# "Yes, Blog2Video supports Hindi", "you can select Hindi from the Language dropdown"
# — the feature already ships. Phrasing a question as a request ("will you ever add
# Hindi voices?") must not turn a working feature into a feature request.
_ALREADY_SUPPORTED_RE = re.compile(
    r"""(?ix)
    ^\W*yes\b
    | \b(?:blog2video|we|it)\s+(?:already\s+)?(?:supports?|offers?|has|have|includes?|provides?)\b
    | \byou\s+can\s+(?:already\s+)?\w+
    | \bis\s+(?:already\s+)?(?:supported|available|included)\b
    | \bthis\s+is\s+(?:already\s+)?(?:supported|available)\b
    | \balready\s+(?:supported|available|possible|connect|integrate)\w*\b
    """
)


def confirm_feature_request(reason: EscalationReason | None, answer: str) -> EscalationReason | None:
    """Drop a FEATURE guess when the answer shows the feature already exists.

    The question-side net matches request PHRASING ("will you ever add X"), which it
    cannot distinguish from a request for something already shipped. Hindi voices are
    one of 39 supported languages, yet "will you ever add Hindi voices?" matched the
    net and users were pushed to a feature-request form instead of being told it works.
    Refund and human requests are never second-guessed — those are about intent, not
    capability, and the answer text says nothing about whether they were warranted.
    """
    if reason is not EscalationReason.FEATURE:
        return reason
    if _NOT_SUPPORTED_RE.search(answer):
        return reason  # answer confirms it genuinely isn't supported
    if _ALREADY_SUPPORTED_RE.search(answer):
        return None
    return reason


def should_short_circuit(reason: EscalationReason | None) -> bool:
    """True when we skip the documentation answer and go straight to the form.

    Refund and human requests only: answering them from docs is what produced the
    stalling "could you provide more details about the project" replies. Feature
    requests still get a real answer, with the form offered underneath it.
    """
    return reason in (EscalationReason.REFUND, EscalationReason.HUMAN)


# The hand-off line is written by the LLM (see HANDOFF_PROMPT below) so it responds to
# what the user actually said instead of reciting a fixed sentence. These canned lines
# are only the fallback for when that call fails — the user still needs an answer.
_SHORT_CIRCUIT_REPLIES: dict[EscalationReason, tuple[str, ...]] = {
    EscalationReason.HUMAN: (
        "Sure — send our team a note below and they'll take it from here.",
        "Happy to hand you over. Add a note below and the team will pick it up.",
        "Our team can help with this directly — just send them a note below.",
        "I'll get you to a person. Leave a note below and they'll be in touch.",
    ),
    EscalationReason.REFUND: (
        "Billing is handled by our team — send them the details below.",
        "Our team handles refunds directly. Add the details below and they'll sort it out.",
        "I'll pass this to the team that handles billing — just add your details below.",
    ),
    EscalationReason.FEATURE: (
        "That's one for our product team — send them the details below.",
        "I'll get this in front of our product team. Add a note below.",
    ),
}

# Back-compat for anything importing the old constant.
SHORT_CIRCUIT_REPLY = _SHORT_CIRCUIT_REPLIES[EscalationReason.HUMAN][2]


def short_circuit_reply(reason: EscalationReason | None, seed: int = 0) -> str:
    """Fallback hand-off line, used only when the LLM call fails.

    ``seed`` (the conversation id) rotates the wording so a user who asks twice in
    one session doesn't get the identical sentence back.
    """
    options = _SHORT_CIRCUIT_REPLIES.get(
        reason or EscalationReason.HUMAN, _SHORT_CIRCUIT_REPLIES[EscalationReason.HUMAN]
    )
    return options[seed % len(options)]


# A hand-off line claiming the user is already connected/sent is a lie that leaves them
# waiting for a reply that will never come. The prompt forbids it, but the model still
# writes it occasionally ("I've got you connected to a live agent"), so the router
# checks the finished line against this and falls back to a canned one when it trips.
_FALSE_CLAIM_RE = re.compile(
    r"""(?ix)
    \bi\s*(?:'ve|’ve|\s+have)?\s*(?:already\s+)?(?:got\s+you\s+|now\s+)?connected\s+you\b
    | \bi\s*(?:'ve|’ve|\s+have)\s+(?:already\s+)?
        (?:sent|forwarded|passed|escalated|submitted|raised|opened|created|notified)\b
    | \bgot\s+you\s+connected\b
    | \byou\s*(?:are|'re|’re)\s+now\s+connected\b
    | \b(?:has|have)\s+been\s+(?:sent|forwarded|escalated|connected|created|opened)\b
    """
)


def handoff_line_is_safe(text: str) -> bool:
    """False when the drafted hand-off claims something already happened."""
    return not _FALSE_CLAIM_RE.search(text or "")


_HANDOFF_CONTEXT = {
    EscalationReason.HUMAN: "They want to talk to a person from the team.",
    EscalationReason.REFUND: (
        "They're asking about a refund or billing. You have NO ability to issue, "
        "approve, process or promise a refund — only the team can decide that. Say "
        "plainly that this isn't something you can handle, then point them at the form "
        "so the team can look at it. Never agree to the refund, never imply it will be "
        "granted, and never say 'of course' or 'no problem'."
    ),
    EscalationReason.FEATURE: (
        "They're asking for something Blog2Video doesn't do. Our product team wants to hear it."
    ),
}


def handoff_prompt(reason: EscalationReason | None) -> str:
    """System prompt for the one-line hand-off the user sees above the contact form.

    Written by the LLM rather than picked from a list so it actually responds to what
    the user said — someone who is angry, confused, or just curious should not get the
    same sentence back.
    """
    situation = _HANDOFF_CONTEXT.get(reason or EscalationReason.HUMAN, "")
    return (
        "You are the Blog2Video support assistant. The user is being handed to a human.\n"
        f"{situation}\n\n"
        "Reply with ONE short, natural sentence (two at most) acknowledging what they "
        "asked and pointing them at the short contact form directly below your message.\n\n"
        "RULES:\n"
        "- Respond to what they actually said. If they're frustrated, acknowledge that "
        "briefly and warmly. Do not be stiff or formulaic.\n"
        "- Do NOT open with a stock phrase. Never begin with 'I understand', "
        "'I'm sorry to hear', 'I see that' or similar — vary how you start, and for a "
        "plain request just get straight to the point.\n"
        "- The form is right below your message. Refer to it naturally ('below', "
        "'here') — never describe its fields or say what happens after they submit.\n"
        "- You are only passing the message along. Never agree to, approve, promise or "
        "guarantee an outcome (a refund, a fix, a deadline, a feature) — that is the "
        "team's decision, not yours. Say what you can't do plainly, then point at the "
        "form. Never open with 'Of course', 'Sure thing', 'No problem' or 'Absolutely'.\n"
        "- Never claim anything has already happened. Nothing is sent, forwarded, "
        "escalated, connected, or ticketed until THEY fill in and submit the form. "
        "Write it as something they are about to do ('you can…', 'send…'), never as "
        "something you have done ('I've connected you…', \"I've passed this on\").\n"
        "- Do not try to answer their question, do not give steps, and do not mention "
        "documents, documentation, or what information you do or don't have.\n"
        "- No greeting, no sign-off, no bullet points, no markdown headings."
    )
