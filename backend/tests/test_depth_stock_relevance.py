"""
Depth tier — stock footage relevance (query extraction + clip ranking).

The failure mode this guards against is silent: a bad query still returns *a*
clip, so nothing raises and no assertion elsewhere fires — the video just ends up
with random footage. These lock in the two properties that matter:

  1. The query is made of real, searchable words. ``tokenize`` stems for BM25
     matching ("closes" -> "clos"), which is fine for scoring both sides but
     useless in an HTTP query, so extraction must emit surface forms.
  2. Ranking never does worse than the provider's own order.
"""
from types import SimpleNamespace

import pytest

from app.services import stock_footage
from app.services.stock_relevance import build_scene_query
from app.support.retriever import tokenize

pytestmark = pytest.mark.depth


def _scene(**kw) -> SimpleNamespace:
    return SimpleNamespace(
        title=kw.get("title", ""),
        display_text=kw.get("display_text", ""),
        visual_description=kw.get("visual_description", ""),
        narration_text=kw.get("narration_text", ""),
    )


# ─── Query extraction ───────────────────────────────────────────────────────


def test_build_scene_query__emits_searchable_words_not_stems():
    """Stems like "clos"/"ser" match nothing on Pexels — the query needs real words."""
    scene = _scene(
        title="Series B closes at $40M",
        narration_text=(
            "The funding round was led by investors who backed the startup. "
            "Investors see the round as a signal."
        ),
    )
    query, _ = build_scene_query(scene)

    for word in query.split():
        assert word.isalpha(), f"{word!r} is not a plain word"
        # A surface form survives tokenize unchanged only if it is already a stem;
        # what matters is that we never emit a truncated stem like "clos"/"ser".
        assert len(word) >= 3


def test_build_scene_query__drops_domain_stopwords_and_numerals():
    """"video"/"welcome"/"today" describe the artifact, not anything filmable."""
    scene = _scene(
        title="Welcome to this video",
        narration_text="Today we will learn about solar panels and renewable energy.",
    )
    query, tokens = build_scene_query(scene)

    lowered = query.lower().split()
    for banned in ("video", "welcome", "today", "learn"):
        assert banned not in lowered
    assert not any(ch.isdigit() for ch in query)
    # The actual subject survived.
    assert any(t in tokens for t in ("solar", "panel", "energy", "renewable"))


def test_build_scene_query__weights_title_above_narration():
    """A title term beats a narration term seen the same number of times."""
    scene = _scene(title="volcano", narration_text="A kitchen appeared.")
    query, _ = build_scene_query(scene)

    assert query.split()[0] == "volcano"


def test_build_scene_query__pools_morphological_variants():
    """"investor"/"investors" must score as one term, not two."""
    scene = _scene(
        title="Money",
        narration_text="Investors talk. An investor waits. More investors arrive.",
    )
    _, tokens = build_scene_query(scene)

    stems = [t for t in tokens if t.startswith("investor")]
    assert len(stems) == 1


def test_build_scene_query__falls_back_to_title_when_too_thin():
    """A one-word scene has no signal to extract — hand back today's behaviour."""
    scene = _scene(title="Intro")
    query, _ = build_scene_query(scene)

    assert query == "Intro"


def test_build_scene_query__empty_scene_returns_empty():
    query, tokens = build_scene_query(_scene())

    assert query == ""
    assert tokens == []


def test_build_scene_query__falls_back_to_visual_description():
    scene = _scene(title="", visual_description="A vault")
    query, _ = build_scene_query(scene)

    assert query == "A vault"


def test_build_scene_query__is_deterministic():
    """Equal scores must not reorder between runs (dict ordering is not a tiebreak)."""
    scene = _scene(title="alpha bravo charlie delta")

    assert build_scene_query(scene)[0] == build_scene_query(scene)[0]


def test_build_scene_query__respects_query_length_cap():
    scene = _scene(
        title="reforestation biodiversity conservation",
        narration_text="reforestation biodiversity conservation " * 5,
    )
    query, _ = build_scene_query(scene)

    assert len(query) <= 80


def test_domain_stopwords_are_stored_as_stems():
    """A literal "closes" entry would never fire — matching happens on stems."""
    from app.services.stock_relevance import _DOMAIN_STOPWORDS

    for word in ("video", "welcome", "watching", "series"):
        stem = tokenize(word)
        if stem:
            assert stem[0] in _DOMAIN_STOPWORDS, f"{word!r} does not block"


# ─── Clip ranking ───────────────────────────────────────────────────────────


def _clip(cid: str, tags: str = "", description: str = "", fps: float = 30.0):
    return stock_footage.StockClip(
        provider="pixabay", id=cid, preview_url="p", thumbnail_url="t",
        download_url="d", width=1280, height=720, duration=5.0, fps=fps,
        author="a", page_url="u", tags=tags, description=description,
    )


def test_rank__puts_tag_matching_clip_first():
    from app.services.stock_relevance import rank_clips_by_relevance

    clips = [
        _clip("irrelevant", tags="kitchen, cooking, food"),
        _clip("relevant", tags="solar, panel, energy"),
    ]
    ranked = rank_clips_by_relevance(clips, ["solar", "panel"])

    assert ranked[0][0].id == "relevant"


def test_rank__is_blind_to_which_field_the_text_arrived_in():
    """Identical text must score identically whether it came as tags or as a
    description. Field is a provider trait — Pixabay ships tags, Pexels ships a
    URL slug — so any field weighting silently picks a provider before the match
    is considered."""
    from app.services.stock_relevance import rank_clips_by_relevance

    as_tags = _clip("tags", tags="solar, panel, roof")
    as_desc = _clip("desc", description="solar panel roof")

    ranked = dict(
        (c.id, s) for c, s in rank_clips_by_relevance([as_tags, as_desc], ["solar", "panel"])
    )

    assert ranked["tags"] == pytest.approx(ranked["desc"])


def test_rank__preserves_input_order_when_nothing_matches():
    """Zero information must never reshuffle — that would be worse than fps order."""
    from app.services.stock_relevance import rank_clips_by_relevance

    clips = [_clip("first", tags="kitchen"), _clip("second", tags="garden")]
    ranked = rank_clips_by_relevance(clips, ["volcano", "lava"])

    assert [c.id for c, _ in ranked] == ["first", "second"]


def test_rank__survives_clips_with_no_text_at_all():
    """Pexels hits often have empty tags; BM25Okapi raises on a zero-token doc."""
    from app.services.stock_relevance import rank_clips_by_relevance

    clips = [_clip("bare"), _clip("tagged", tags="solar, panel")]
    ranked = rank_clips_by_relevance(clips, ["solar"])

    assert len(ranked) == 2
    assert ranked[0][0].id == "tagged"


def test_rank__fps_breaks_ties_but_does_not_override_relevance():
    from app.services.stock_relevance import rank_clips_by_relevance

    # Same tags, different fps -> the cleaner frame rate wins.
    tie = [_clip("slow", tags="solar, panel", fps=25.0),
           _clip("clean", tags="solar, panel", fps=30.0)]
    assert rank_clips_by_relevance(tie, ["solar", "panel"])[0][0].id == "clean"

    # A relevance win must survive a worse frame rate.
    beat = [_clip("wrong_clean", tags="kitchen, cooking", fps=30.0),
            _clip("right_slow", tags="solar, panel", fps=25.0)]
    assert rank_clips_by_relevance(beat, ["solar", "panel"])[0][0].id == "right_slow"


@pytest.mark.parametrize("query_len", [1, 3, 6, 9, 12])
@pytest.mark.parametrize("field", ["tags", "description"])
def test_rank__any_match_beats_a_non_match_at_every_query_length(query_len, field):
    """The fps tiebreak must never outweigh relevance, however weak the match.

    Regression: a fixed fps bonus worked for short queries but not long ones —
    the weakest possible win (last query term, description only) shrinks as the
    query grows, so a clip matching *nothing* could win on frame rate alone.
    Worst case is stacked here: the matcher has the worse fps and matches only
    the lowest-ranked term.
    """
    from app.services.stock_relevance import rank_clips_by_relevance

    query = [f"term{i}" for i in range(query_len)]
    kwargs = {field: query[-1]}
    clips = [
        _clip("nomatch", tags="unrelated", fps=30.0),   # best frame rate, no match
        _clip("match", fps=25.0, **kwargs),             # worst frame rate, matches
    ]

    assert rank_clips_by_relevance(clips, query)[0][0].id == "match"


def test_rank__tight_description_beats_a_sprawling_tag_dump():
    """More metadata must not win on volume alone.

    Regression: recall-only scoring meant a clip with 27 tags had far more
    chances to contain a query term than one with a 5-word description, so
    Pixabay (7-27 tags/clip) buried Pexels (5-6 slug words, no tags) at
    positions 7-10 of every single pool regardless of actual relevance.
    """
    from app.services.stock_relevance import rank_clips_by_relevance

    query = ["solar", "panel", "rooftop"]
    clips = [
        # Mentions the subject in passing, amid 20 unrelated keywords.
        _clip(
            "sprawling",
            tags=(
                "solar, business, meeting, abstract, texture, background, motion, "
                "loop, corporate, blue, modern, design, technology, digital, light, "
                "pattern, animation, graphic, render, concept"
            ),
        ),
        # Entirely about the scene, but only five words to say it with.
        _clip("tight", description="solar panel on a rooftop"),
    ]

    assert rank_clips_by_relevance(clips, query)[0][0].id == "tight"


def test_rank__does_not_lock_onto_one_provider():
    """A Pexels clip (description only, no tags) must be able to win outright."""
    from app.services.stock_relevance import rank_clips_by_relevance

    query = ["solar", "panel", "rooftop"]
    pexels = stock_footage.StockClip(
        provider="pexels", id="px", preview_url="p", thumbnail_url="t",
        download_url="d", width=1280, height=720, duration=5.0, fps=30.0,
        author="a", page_url="u", tags="", description="solar panel on a rooftop",
    )
    pixabay = _clip("pb", tags="kitchen, cooking, food, chef, restaurant")

    assert rank_clips_by_relevance([pixabay, pexels], query)[0][0].provider == "pexels"


def test_rank__empty_inputs_do_not_raise():
    from app.services.stock_relevance import rank_clips_by_relevance

    assert rank_clips_by_relevance([], ["solar"]) == []
    clips = [_clip("a", tags="solar")]
    assert len(rank_clips_by_relevance(clips, [])) == 1


# ─── Concreteness: filmable words over rhetorical ones ──────────────────────


def test_query__drops_rhetorical_title_words_for_concrete_narration_nouns():
    """Regression: title x3 let framing words outrank the actual subject.

    "The Rise of Remote Work" produced 'work remote rise' — `rise` is not
    something a camera can point at, while the narration's `home`, `office` and
    `coffee` are exactly the shots the scene needs.
    """
    scene = _scene(
        title="The Rise of Remote Work",
        narration_text=(
            "Companies worldwide are shifting to distributed teams. Employees "
            "now work from home offices, coffee shops, and co-working spaces."
        ),
    )
    query, _ = build_scene_query(scene)

    assert "rise" not in query.lower().split()


def test_query__doubled_consonant_gerunds_are_blockable():
    """Regression: tokenize strips "ing" without un-doubling, so "getting" ->
    "gett" — a stem no base form produces, making the word permanently
    unblockable however many entries the stopword list gained."""
    from app.services.stock_relevance import _DOMAIN_STOPWORDS, _norm

    assert _norm("getting") == "get"
    assert _norm("getting") in _DOMAIN_STOPWORDS

    scene = _scene(
        title="Why Sleep Matters",
        narration_text=(
            "Getting seven to nine hours of sleep each night improves memory, "
            "mood, and immune function."
        ),
    )
    query, _ = build_scene_query(scene)
    lowered = query.lower().split()
    for filler in ("getting", "gett", "function", "hours"):
        assert filler not in lowered


def test_query__keeps_gerunds_that_are_real_subjects():
    """Un-doubling must not over-reach: "shopping"/"running" are filmable."""
    from app.services.stock_relevance import _DOMAIN_STOPWORDS, _norm

    for word in ("running", "shopping", "sitting"):
        assert _norm(word) not in _DOMAIN_STOPWORDS


def test_query__demotes_abstract_nouns_but_does_not_erase_them():
    """A scene genuinely about an abstraction still needs something to search."""
    scene = _scene(
        title="The Future of Sustainability",
        narration_text=(
            "Corporate sustainability initiatives focus on reducing emissions "
            "from factories and transportation networks."
        ),
    )
    query, tokens = build_scene_query(scene)

    assert query, "an abstract scene must still produce a query"
    # The concrete nouns present must not be crowded out entirely.
    assert any(t in tokens for t in ("emission", "factory", "factori", "corporate"))


def test_query__repeated_terms_outrank_single_mentions():
    """Repetition is the strongest signal of what a scene is actually about."""
    scene = _scene(
        title="An Update",
        narration_text=(
            "The bakery opens early. Inside the bakery, bread cools on racks. "
            "A bakery is a warm place."
        ),
    )
    query, _ = build_scene_query(scene)

    assert "bakery" in query.lower()


def test_norm__does_not_break_words_ending_in_a_real_double():
    """Regression: un-doubling gerunds ("getting" -> "gett" -> "get") also hit
    words that legitimately end in a double. "jazz" became "jaz", which can
    never match the word "jazz" in a provider's tags — silently killing the most
    important term of a query like "jazz orchestra stage night"."""
    from app.services.stock_relevance import _norm

    assert _norm("jazz") == "jazz"
    # Still collapses genuine stripped-suffix doubles.
    assert _norm("getting") == "get"
    assert _norm("running") == "run"


def test_norm__query_and_tag_stems_agree():
    """Both sides of the comparison must stem identically or matches are lost."""
    from app.services.stock_relevance import _norm

    for word in ("jazz", "glass", "business", "grass", "stage", "night"):
        tag_stem = tokenize(word)
        assert tag_stem and _norm(word) == tag_stem[0], word


def test_rank__ambient_words_do_not_outrank_the_subject():
    """Regression: "jazz orchestra stage night" picked "mount fuji, snow,
    clouds, night" over "pop, music, concert, stage, band" — a match on `night`
    alone beat a match on the actual subject. Ambient words appear in a huge
    share of stock tags, so they are weak evidence."""
    from app.services.stock_relevance import rank_clips_by_relevance

    query = ["jazz", "orchestra", "stage", "night"]
    clips = [
        _clip("scenery", tags="mount fuji, snow, clouds, night"),
        _clip("subject", tags="pop, music, concert, stage, band"),
    ]

    assert rank_clips_by_relevance(clips, query)[0][0].id == "subject"


def test_merge_query_tokens__search_terms_lead():
    """The ranker must score against what was actually searched for, not only
    the keyword extractor's view of the scene."""
    from app.services.stock_relevance import _merge_query_tokens

    merged = _merge_query_tokens(["cotton", "club", "harlem"], "jazz orchestra stage")

    assert merged[:3] == ["jazz", "orchestra", "stage"]
    assert "cotton" in merged and "harlem" in merged


def test_merge_query_tokens__handles_missing_query():
    from app.services.stock_relevance import _merge_query_tokens

    assert _merge_query_tokens(["a", "b"], None) == ["a", "b"]
    assert _merge_query_tokens([], "jazz stage") == ["jazz", "stage"]


def test_rank__rare_subject_beats_common_setting_words():
    """Regression: "penguin swimming underwater" ranked jellyfish and manta rays
    above the one actual penguin clip, because six of eight candidates matched
    `underwater`+`swimming` while only one matched `penguin`. A term shared by
    most of the pool separates nothing; the rare one is the whole question."""
    from app.services.stock_relevance import rank_clips_by_relevance

    query = ["penguin", "swim", "underwater"]
    clips = [
        _clip("jelly1", tags="jellyfish, underwater, ocean, water, swimming"),
        _clip("jelly2", tags="sea, jellyfish, aquarium, underwater, swimming"),
        _clip("manta", tags="aquarium, manta, ray, underwater, swimming, fish"),
        _clip("fish", tags="fish, reef, underwater, sea, swimming, marine"),
        _clip("penguin", tags="penguin, beak, bird, antarctic, cold, swim"),
    ]

    assert rank_clips_by_relevance(clips, query)[0][0].id == "penguin"


def test_discrimination__scales_with_pool_frequency():
    from app.services.stock_relevance import _discrimination, _MIN_DISCRIMINATION

    pool = [{"underwater", "fish"}, {"underwater", "jelly"},
            {"underwater", "manta"}, {"penguin", "bird"}]

    rare = _discrimination(pool, "penguin")     # 1 of 4
    common = _discrimination(pool, "underwater")  # 3 of 4

    assert rare > common
    assert common >= _MIN_DISCRIMINATION        # floored, never zero
    assert _discrimination(pool, "absent") == 1.0
    assert _discrimination([], "x") == 1.0


def test_rank__short_description_naming_the_subject_beats_a_dense_off_topic_tag_list():
    """Regression: "penguins swimming in aquarium" (4 words, all relevant) ranked
    below a jellyfish clip whose dense tag list matched only `underwater` and
    `swimming`. Precision punishes short provider text, so naming the subject has
    to count for something on its own."""
    from app.services.stock_relevance import rank_clips_by_relevance

    query = ["penguin", "swim", "underwater"]
    clips = [
        _clip("dense_offtopic",
              tags="jellyfish, underwater, ocean, water, nature, aquarium, marine, life, swim"),
        _clip("short_onsubject", description="penguins swimming in aquarium"),
    ]

    assert rank_clips_by_relevance(clips, query)[0][0].id == "short_onsubject"


def test_rank__action_words_are_not_treated_as_the_subject():
    """A verb says what something is doing, not what it is. `swim` qualifying as
    a subject term handed the subject bonus to every jellyfish tagged `swim`."""
    from app.services.stock_relevance import (
        _ACTION_WORDS,
        _norm,
        rank_clips_by_relevance,
    )

    for verb in ("swimming", "diving", "walking", "running"):
        assert _norm(verb) in _ACTION_WORDS

    query = ["penguin", "swim"]
    clips = [
        _clip("wrong_animal", tags="jellyfish, swim, underwater, ocean, marine"),
        _clip("right_animal", tags="penguin, bird, antarctic"),
    ]

    assert rank_clips_by_relevance(clips, query)[0][0].id == "right_animal"


def test_rank__does_not_reward_a_provider_for_writing_more():
    """Recall alone is length-biased, and length is a provider trait: Pixabay
    writes 13-23 tokens per clip against Pexels' 5-7, so a Pixabay clip covers
    more query terms simply by having more words in play. A short clip that is
    entirely on-subject must beat a long one that mentions it in passing."""
    from app.services.stock_relevance import rank_clips_by_relevance

    query = ["solar", "panel", "roof"]
    clips = [
        _clip("verbose", tags=(
            "solar, energy, abstract, motion, background, loop, corporate, blue, "
            "modern, design, technology, digital, light, pattern, animation, "
            "graphic, render, concept, business, marketing"
        )),
        _clip("terse", description="solar panel roof"),
    ]

    assert rank_clips_by_relevance(clips, query)[0][0].id == "terse"


def test_rank__winner_is_decided_by_match_not_by_provider():
    """Same text, different providers -> the tie must not break on provider."""
    from app.services.stock_relevance import rank_clips_by_relevance

    pexels = stock_footage.StockClip(
        provider="pexels", id="px", preview_url="p", thumbnail_url="t",
        download_url="d", width=1280, height=720, duration=5.0, fps=30.0,
        author="a", page_url="u", tags="", description="penguin swimming antarctic",
    )
    pixabay = stock_footage.StockClip(
        provider="pixabay", id="pb", preview_url="p", thumbnail_url="t",
        download_url="d", width=1280, height=720, duration=5.0, fps=30.0,
        author="a", page_url="u", tags="jellyfish, ocean, water", description="",
    )

    ranked = rank_clips_by_relevance([pixabay, pexels], ["penguin", "antarctic"])

    assert ranked[0][0].provider == "pexels"
