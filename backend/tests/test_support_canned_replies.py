"""
Support bot fixed replies: discount/promo questions and "no audio" reports.

Both get a fixed reply chosen in code (not by the model): PROMO_REPLY for anything
touching discounts, NO_AUDIO_REPLY (browser checks first) for anything reporting missing
audio. A compound message gets the model's answer to the rest, then the fixed reply.

Endpoints are exercised through the TestClient on the disposable SQLite DB; the LLM is
stubbed, and the tests assert it is never called for fixed-reply-only messages.
"""
import asyncio
import re

import pytest

from app.routers import support as support_router
from app.routers.support import (
    NO_AUDIO_REPLY,
    PROMO_REPLY,
    is_no_audio_report,
    is_promotion_question,
    resolve_canned,
    split_canned,
)

PROMO_YES = [
    "any discounts?", "dicount code", "disscount", "promo code plz", "coupon",
    "40% off?", "50 percent off", "is it 40% off first month only",
    "does the discount renew", "limited time offer real?", "only 10 spots left?",
    "is there a black friday sale", "cyber monday deals", "can I get it cheaper",
    "how do I get it for less", "any offers", "early bird pricing", "student discount",
    "bulk discount", "volume pricing", "referral code", "how much do I save with annual",
    "is annual cheaper", "annual vs monthly", "how much is annual billing?",
    "hay descuento?", "gibt es einen rabatt", "y a-t-il une réduction", "price match?",
    "Hi, I noticed you're offering 40% off. Is that discount only for the first month, "
    "or does it continue for future monthly payments as well?",
]
PROMO_NO = [
    "how do I create a video", "contact sales", "can I save my project",
    "how much is the pro plan per month", "do you offer templates",
    "which offers more scenes, lite or pro", "annual plan price per year",
    "is there a free trial", "how do I export",
]
AUDIO_YES = [
    "no audio on the video", "no audio was generated", "audio was not generated",
    "the audio wasnt generated for my video", "my video has no sound", "video is muted",
    "There's no voiceover in my video", "voice not working", "I dont hear anything",
    "no narration", "the video is silent", "audio missing from my export",
    "exported mp4 has no audio", "preview plays but no sound", "voiceover isnt playing",
    "why is there no sound", "cant hear the voice", "narrator is missing",
    "the voiceover disappeared", "no audio wtf", "why does my video have no voiceover",
    "audio only works in some scenes", "no hay audio en el video", "the sound cuts out",
    "the voiceover didnt generate", "my video doesnt have audio", "I'm not hearing any audio",
    "why doesn't my video have sound", "scene 2 has no audio", "Hi, my video has no audio",
]
AUDIO_NO = [
    "how do I make a video without voiceover", "can I turn off the voiceover",
    "do you support a no voiceover option", "how do I add background music",
    "how do I change the voiceover", "which voices are available", "what is the audio tab",
    "how do I choose a voice", "how do I remove narration", "how do I skip voiceover",
    "does blog2video support audio in french", "doesn't the pro plan have voiceover?",
    "how do I mute a scene", "what is the difference between voiceover and no voiceover",
]


@pytest.mark.parametrize("msg", PROMO_YES)
def test_promo__discount_phrasings_are_caught(msg):
    assert is_promotion_question(msg)


@pytest.mark.parametrize("msg", PROMO_NO)
def test_promo__ordinary_questions_are_not_caught(msg):
    assert not is_promotion_question(msg)


@pytest.mark.parametrize("msg", AUDIO_YES)
def test_audio__no_audio_phrasings_are_caught(msg):
    assert is_no_audio_report(msg)
    assert split_canned(msg) == ("", NO_AUDIO_REPLY)


@pytest.mark.parametrize("msg", AUDIO_NO)
def test_audio__wanting_no_voiceover_or_feature_questions_are_not_caught(msg):
    assert not is_no_audio_report(msg)


def test_audio_reply__browser_check_is_first_and_promo_reply_is_bare():
    assert NO_AUDIO_REPLY.index("browser") < NO_AUDIO_REPLY.index("**Script**")
    assert "1. Check the browser tab isn't muted" in NO_AUDIO_REPLY
    assert "silently" not in NO_AUDIO_REPLY
    assert PROMO_REPLY == "I don't have information about discount campaigns or promotions."
    assert "team" not in PROMO_REPLY


@pytest.mark.parametrize(
    "msg,rest,canned",
    [
        ("Is there a 40% discount, and how do I create a video?", "how do I create a video?", PROMO_REPLY),
        ("no audio on my video. Also how do I export it?", "how do I export it?", NO_AUDIO_REPLY),
        ("how do I export and my video has no audio", "how do I export", NO_AUDIO_REPLY),
        ("is the discount first month only? and what formats can I export?", "what formats can I export?", PROMO_REPLY),
        ("no audio and is there a coupon code?", "", NO_AUDIO_REPLY + "\n\n" + PROMO_REPLY),
        ("any student discount and no sound on my video", "", NO_AUDIO_REPLY + "\n\n" + PROMO_REPLY),
        ("how do I add a logo", "how do I add a logo", ""),
    ],
)
def test_split_canned__compound_messages(msg, rest, canned):
    assert split_canned(msg) == (rest, canned)


# ─── real endpoint calls ────────────────────────────────────────────────────────
@pytest.fixture()
def llm_stub(monkeypatch):
    calls = {"stream": 0, "json": 0}

    async def fake_stream(messages):
        calls["stream"] += 1
        for tok in ("MODEL ", "ANSWER"):
            yield tok

    async def fake_json(*a, **k):
        calls["json"] += 1
        return support_router.SupportResponse(answer="MODEL ANSWER")

    monkeypatch.setattr(support_router, "stream_answer", fake_stream)
    monkeypatch.setattr(support_router, "complete_json", fake_json)
    return calls


def _stream_text(client, auth, user, message):
    r = client.post(
        "/api/support/chat/stream",
        json={"message": message, "page_path": "/"},
        headers={**auth(user), "X-Support-Session": "11111111-1111-4111-8111-111111111111"},
    )
    assert r.status_code == 200, r.text
    tokens, cur = [], None
    for line in r.text.split("\n"):
        if line.startswith("event: "):
            cur = line[7:]
        elif line.startswith("data: ") and cur == "token":
            tokens.append(line[6:])
    # _sse_token frames every "\n" as an empty data frame, so a blank line arrives as an
    # extra "\n"; markdown renders it identically, so collapse it for comparison.
    text = "".join(t if t else "\n" for t in tokens)
    return re.sub(r"\n{3,}", "\n\n", text)


@pytest.mark.parametrize(
    "msg,expected",
    [
        ("any coupon code?", PROMO_REPLY),
        ("no audio on the video", NO_AUDIO_REPLY),
        ("no audio and is there a coupon code?", NO_AUDIO_REPLY + "\n\n" + PROMO_REPLY),
    ],
)
def test_stream__fixed_reply_only_never_calls_the_model(client, auth, free_user, llm_stub, msg, expected):
    text = _stream_text(client, auth, free_user, msg)
    assert text.strip() == expected
    assert llm_stub == {"stream": 0, "json": 0}


def test_stream__compound_message_gets_model_answer_then_fixed_reply(client, auth, free_user, llm_stub):
    text = _stream_text(client, auth, free_user, "Is there a 40% discount, and how do I create a video?")
    assert text.startswith("MODEL ANSWER")
    assert text.strip().endswith(PROMO_REPLY)
    assert llm_stub["stream"] == 1


def test_chat__fixed_reply_and_compound(client, auth, free_user, llm_stub):
    hdr = {**auth(free_user), "X-Support-Session": "11111111-1111-4111-8111-111111111111"}
    r = client.post("/api/support/chat", json={"message": "no audio on the video", "page_path": "/"}, headers=hdr)
    assert r.status_code == 200, r.text
    assert r.json()["answer"] == NO_AUDIO_REPLY
    assert llm_stub == {"stream": 0, "json": 0}

    r = client.post(
        "/api/support/chat",
        json={"message": "any coupons? also how do I export it", "page_path": "/"},
        headers=hdr,
    )
    assert r.status_code == 200, r.text
    assert r.json()["answer"] == "MODEL ANSWER\n\n" + PROMO_REPLY


# ─── model-judged rewordings ────────────────────────────────────────────────────
@pytest.fixture()
def judge(monkeypatch):
    """Stub the no-audio judge; ``judge.verdict`` is what the model 'says'."""
    class J:
        verdict = "YES"
        calls: list = []
    J.calls = []

    async def fake_text(messages, **kw):
        J.calls.append(messages[-1]["content"])
        if isinstance(J.verdict, Exception):
            raise J.verdict
        return J.verdict

    monkeypatch.setattr(support_router, "complete_text", fake_text)
    return J


def test_judge__reworded_report_gets_fixed_reply_when_model_says_yes(judge):
    async def go():
        assert await resolve_canned("audio problem") == ("", NO_AUDIO_REPLY)
        assert judge.calls == ["audio problem"]

    asyncio.run(go())


def test_judge__model_says_no_falls_through_to_normal_answer(judge):
    async def go():
        judge.verdict = "NO"
        assert await resolve_canned("how do I change the voice for one scene") == (
            "how do I change the voice for one scene", "",
        )

    asyncio.run(go())


def test_judge__model_failure_falls_through_instead_of_erroring(judge):
    async def go():
        judge.verdict = support_router.LLMError("boom")
        assert await resolve_canned("audio problem") == ("audio problem", "")

    asyncio.run(go())


def test_judge__mixed_reworded_report_keeps_the_other_question(judge):
    async def go():
        rest, canned = await resolve_canned("sound issue, plus how do I change the template?")
        assert rest == "how do I change the template?"
        assert canned == NO_AUDIO_REPLY
        assert judge.calls == ["sound issue"]

    asyncio.run(go())


def test_judge__reworded_report_plus_promo(judge):
    async def go():
        rest, canned = await resolve_canned("audio problem. any coupon code?")
        assert (rest, canned) == ("", NO_AUDIO_REPLY + "\n\n" + PROMO_REPLY)

    asyncio.run(go())


def test_judge__not_called_when_patterns_already_match_or_nothing_audio_ish(judge):
    async def go():
        assert (await resolve_canned("no audio on the video"))[1] == NO_AUDIO_REPLY
        assert await resolve_canned("how do I create a video") == ("how do I create a video", "")
        assert judge.calls == []

    asyncio.run(go())


def test_stream__reworded_report_through_the_endpoint(client, auth, free_user, llm_stub, judge):
    text = _stream_text(client, auth, free_user, "audio problem")
    assert text.strip() == NO_AUDIO_REPLY
    assert llm_stub == {"stream": 0, "json": 0}
