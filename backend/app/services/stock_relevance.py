"""Turn a scene into a stock-footage search query, and rank clips against it.

Both halves are deterministic, in-process and dependency-free (``rank_bm25`` is
already vendored for the support bot). Nothing here does I/O or calls a model,
so it adds no measurable time to video generation.

Why this exists: the pipeline used to search Pexels/Pixabay with the scene's raw
``title``. Titles are display headlines written for the screen — "Series B closes
at $40M" — and stock libraries index *visual content*, so such a query returns
essentially random footage. We instead score the scene's own vocabulary by which
field it came from and search with the terms that actually describe something
filmable.
"""

from __future__ import annotations

import logging
import re

from app.support.retriever import tokenize

logger = logging.getLogger(__name__)

_WORD_RE = re.compile(r"[a-z0-9]+")

# Field weights. A term's score is the sum of its weight for every occurrence.
#
# The title used to be worth 3x, which backfired: titles are written to be
# *rhetorical*, not descriptive. "The Rise of Remote Work" put `rise` — a word no
# camera can point at — three points ahead of `home`, `office` and `coffee` from
# the narration, which are exactly the shots the scene needs. `visual_description`
# now leads, since it is the only field written to describe a picture.
_FIELD_WEIGHTS: tuple[tuple[str, float], ...] = (
    ("visual_description", 3.0),
    ("title", 1.6),
    ("display_text", 1.4),
    ("narration_text", 1.0),
)

# Words that survive the generic stopword list but are useless as *visual* search
# terms — they describe the video artifact or the act of watching it, not
# anything a camera could point at.
#
# Written as plain words and normalised through ``tokenize`` below, because
# matching happens on stems: a literal "closes" entry would never fire, since the
# text it should block stems to "clos". Anything ``tokenize`` drops entirely
# (under 3 chars, or already a generic stopword) is filtered out here too.
_DOMAIN_STOPWORD_WORDS = (
    """
    video videos scene scenes intro outro viewer viewers watch watching
    today learn learning discover discovery introduction conclusion
    welcome subscribe blog article post chapter section clip footage
    explain explainer overview summary recap tutorial guide step steps
    thing things way ways new use using used need make made get got
    look looking see seen know known take taken come came go going
    close closes open opens start starts end ends begin begins
    series part number level stage phase point points
    never always often sometimes still already yet ever
    stay stays stayed keep keeps kept matter matters
    here there everywhere anywhere somewhere
    rise rises rising fall falls falling grow grows growth
    change changes changing shift shifts improve improves
    increase decrease reduce reduces impact affect affects
    why how what when where who which
    important essential critical key major minor
    future past present modern current recent
    company companies business industry market sector
    people person someone everyone anyone
    function functions role roles result results
    hour hours minute minutes second seconds day days week weeks
    month months year years time times percent
    """.split()
)

# Suffixes that mark a word as a concept rather than a thing. A stock library
# cannot photograph "sustainability" or "efficiency"; it can photograph a solar
# panel. Enumerating every abstract word is hopeless, but the morphology is a
# reliable tell — and cheap to check.
_ABSTRACT_SUFFIXES = (
    "tion", "sion", "ment", "ness", "ity", "ance", "ence",
    "ism", "ship", "hood", "cy", "ology", "ability",
)


def _is_abstract(stem: str, surface: str) -> bool:
    """True when a word names a concept rather than something filmable."""
    if len(surface) < 6:
        return False
    return surface.endswith(_ABSTRACT_SUFFIXES)

def _norm(word: str) -> str:
    """Stem a word the way scoring does, then undo doubled-consonant gerunds.

    ``tokenize`` strips "ing"/"ed" without un-doubling, so "getting" -> "gett"
    and "running" -> "runn" — stems no base form ever produces. That made such
    words unblockable: a "get" entry in the stopword list can never match "gett".
    Collapsing the trailing double consonant reunites the two.
    """
    stems = tokenize(word)
    if not stems:
        return ""
    stem = stems[0]
    # Only un-double when a suffix was actually stripped. "getting" -> "gett"
    # needs collapsing, but "jazz"/"glass"/"business" end in a real double and
    # come back from tokenize untouched — collapsing those produced "jaz", which
    # can never match the word "jazz" in a provider's tags.
    if (
        len(stem) > 3
        and stem != word
        and stem[-1] == stem[-2]
        and stem[-1] not in "aeiou"
    ):
        stem = stem[:-1]
    return stem


_DOMAIN_STOPWORDS = frozenset(
    n for word in _DOMAIN_STOPWORD_WORDS if (n := _norm(word))
)

# Below this many usable terms the extraction has not found enough signal to beat
# the raw title, so we hand the title back rather than searching on one word.
_MIN_QUERY_TERMS = 2

# A term the scene returns to is far likelier to be its subject than one said
# once in passing.
_REPEATED_TERM_BOOST = 1.8
# Abstractions are demoted, not removed: a scene genuinely about "sustainability"
# must still have something to search with.
_ABSTRACT_TERM_PENALTY = 0.45

# Pexels/Pixabay match on a handful of words; more than this dilutes the query.
_QUERY_TERM_COUNT = 3
# The ranker gets a wider view than the query so it can score on context the
# 3-word query had to drop.
_RANK_TOKEN_COUNT = 12
# Matches the manual picker's input cap (StockFootageModal.tsx).
_MAX_QUERY_CHARS = 80


def _is_usable_term(token: str) -> bool:
    if token in _DOMAIN_STOPWORDS:
        return False
    # Numerals and alphanumerics ("40", "2026", "40m") are never useful visual
    # search terms — no stock library indexes footage by them.
    if any(ch.isdigit() for ch in token):
        return False
    return True


def _stems_with_surface(text: str) -> list[tuple[str, str]]:
    """Pair each of ``tokenize``'s stems with the word it came from.

    ``tokenize`` strips suffixes for BM25 matching, where both sides are stemmed
    identically so a lossy stem is harmless. A provider search is *not* symmetric
    — "clos" and "ser" match nothing on Pexels — so we score on the stem (to pool
    "investor"/"investors") but search with the real word.
    """
    words = _WORD_RE.findall((text or "").lower())
    out: list[tuple[str, str]] = []
    for word in words:
        stem = _norm(word)
        if stem:
            out.append((stem, word))
    return out


def build_scene_query(scene) -> tuple[str, list[str]]:
    """Build a stock search query from a scene's own text.

    Returns ``(query, scene_tokens)`` — a short query string for the provider
    search, and a longer token list for local relevance ranking.

    Falls back to the scene title (today's behaviour) when the scene carries too
    little text to extract from.
    """
    scores: dict[str, float] = {}
    # Shortest surface form seen for each stem — "investor" reads better in a
    # query than "investors", and it is what the provider is likelier to index.
    surface: dict[str, str] = {}
    occurrences: dict[str, int] = {}
    for field, weight in _FIELD_WEIGHTS:
        text = (getattr(scene, field, None) or "").strip()
        if not text:
            continue
        for stem, word in _stems_with_surface(text):
            if not _is_usable_term(stem):
                continue
            scores[stem] = scores.get(stem, 0.0) + weight
            occurrences[stem] = occurrences.get(stem, 0) + 1
            if stem not in surface or len(word) < len(surface[stem]):
                surface[stem] = word

    fallback_text = (
        getattr(scene, "title", None) or getattr(scene, "visual_description", None) or ""
    ).strip()

    if len(scores) < _MIN_QUERY_TERMS:
        return fallback_text, tokenize(fallback_text)

    for stem in list(scores):
        # A scene's actual subject gets said more than once; framing words
        # ("rise", "why") are mentioned and dropped. Repetition is the strongest
        # available signal of what the scene is really about.
        if occurrences.get(stem, 1) > 1:
            scores[stem] *= _REPEATED_TERM_BOOST
        # Concepts cannot be filmed. Demote rather than drop, so a scene that is
        # genuinely *about* an abstraction still has terms left to search with.
        if _is_abstract(stem, surface.get(stem, "")):
            scores[stem] *= _ABSTRACT_TERM_PENALTY

    # Sort by score, then alphabetically so equal scores are deterministic.
    ordered = sorted(scores.items(), key=lambda kv: (-kv[1], kv[0]))
    stems = [s for s, _ in ordered]

    query = " ".join(surface[s] for s in stems[:_QUERY_TERM_COUNT])[:_MAX_QUERY_CHARS].strip()
    if not query:
        return fallback_text, tokenize(fallback_text)

    # Ranking compares against clip text that goes through ``tokenize`` too, so
    # the ranker gets stems while the query above gets real words.
    return query, stems[:_RANK_TOKEN_COUNT]


# ─── Clip ranking ───────────────────────────────────────────────────────────

# Ranking is deliberately provider-blind: a clip is scored on how well its text
# matches the scene, never on *which* field that text arrived in or who supplied
# it. The two providers describe clips completely differently — Pixabay ships
# ~15 curated tags, Pexels ships a handful of words derived from its URL slug and
# no tags at all — so any term that correlates with a field also correlates with
# a provider, and rewarding it silently picks a winner before the match is even
# considered. A tag bonus used to live here; it was a flat Pixabay bonus wearing
# a different name.
#
# All text is therefore pooled into one document per clip and compared purely on
# overlap with the scene.

# Weight of precision relative to recall. Equal weighting, because recall alone
# is length-biased and length is a provider trait: Pixabay writes 13-23 tokens
# per clip against Pexels' 5-7, so a Pixabay clip covers more query terms simply
# by writing more words. Precision ("what share of this clip is on-topic")
# cancels that. Measured over 12 queries, raising this from 0.6 to 1.0 moved the
# winner split from 33/67 to 42/58 against a 48/52 pool — i.e. onto the pool's
# own composition. Past 1.0 the split stops moving, so the small remainder is
# match quality rather than a systematic lean.
_PRECISION_WEIGHT = 1.0
# Precision is measured against this many tokens at most. Without the cap the
# metric turns into a length penalty — and length is a provider trait, not a
# relevance signal, so an uncapped version quietly demotes whichever provider
# writes more.
_PRECISION_SATURATION = 12
# Frame rate is a real quality signal but a weak one next to subject match, so it
# may only ever separate candidates of *equal* relevance.
#
# It cannot be a fixed constant: the weakest possible relevance win — matching the
# single lowest-ranked term of the query, in the description — shrinks as the
# query grows (~0.12 at 3 tokens, ~0.02 at 12), so any constant large enough to
# matter for short queries lets a clip that matched nothing outrank one that did.
# The bonus is therefore computed as a fraction of that floor, per call.
_FPS_BONUS_FRACTION = 0.9


def _fps_bonus(fps: float | None, ceiling: float) -> float:
    """Frame-rate tiebreak, scaled to stay strictly under ``ceiling``."""
    from app.services.stock_footage import fps_rank

    return ceiling / (1.0 + fps_rank(fps))


def _weakest_relevance_win(query: list[str]) -> float:
    """Smallest non-zero score any clip could earn: the lowest-ranked query term
    matching in the description only (so no tag bonus). The fps bonus must stay
    below this, or a clip matching nothing could outrank one that matched."""
    if not query:
        return 0.0
    return _field_overlap([query[-1]], query)


def _doc_precision(doc_tokens: list[str], query: list[str]) -> float:
    """Share of the clip's own vocabulary that is on-topic.

    The counterweight to recall. ``_field_overlap`` asks "how much of the scene
    does this clip cover", which a clip with 27 tags can win simply by having
    more words in play. This asks the opposite — "how much of this clip is about
    the scene" — so a five-word description that is entirely on-topic competes
    with a sprawling tag list that mentions the subject in passing.

    Saturates at ``_PRECISION_SATURATION`` tokens: past that, length stops
    carrying information either way.
    """
    if not doc_tokens or not query:
        return 0.0
    unique = set(doc_tokens)
    hits = sum(1 for t in unique if t in set(query))
    if not hits:
        return 0.0
    return hits / min(len(unique), _PRECISION_SATURATION)


def _field_overlap(
    doc_tokens: list[str],
    query: list[str],
    term_weights: dict[str, float] | None = None,
) -> float:
    """Fraction of the query's terms present in a field, position-weighted.

    Deliberately *not* BM25. BM25's idf is built for large corpora and degenerates
    on a ten-clip pool: a term appearing in one of two documents scores exactly
    zero (log(1)), so the discriminating signal vanishes precisely when the pool
    is small. It also rewards rarity, but for stock footage a tag shared by many
    candidates is evidence the search was on-topic, not a reason to discount it.

    Earlier query terms carry more weight because ``build_scene_query`` returns
    them in descending field-weighted score order.
    """
    if not doc_tokens or not query:
        return 0.0
    present = set(doc_tokens)
    total = 0.0
    weight_sum = 0.0
    for i, term in enumerate(query):
        w = 1.0 / (1.0 + i * 0.15)
        if term in _AMBIENT_WORDS:
            w *= _AMBIENT_DISCOUNT
        # Terms shared by most of the pool separate nothing — see _discrimination.
        if term_weights:
            w *= term_weights.get(term, 1.0)
        weight_sum += w
        if term in present:
            total += w
    return total / weight_sum if weight_sum else 0.0


# Words that describe lighting, time of day or mood rather than a subject. They appear
# in a huge share of stock tags, so a match on one is weak evidence: "jazz
# orchestra stage night" matched "mount fuji, snow, clouds, night" on `night`
# alone and ranked it above "pop, music, concert, stage, band". Scored, but at a
# discount, so they can refine a subject match without ever standing in for one.
_AMBIENT_WORDS = frozenset(
    _norm(w)
    for w in """
    night day morning evening afternoon dawn dusk sunset sunrise
    light lights lighting dark darkness bright warm cool
    background backdrop atmosphere mood ambient view scene
    beautiful nature outdoor indoor abstract closeup
    """.split()
)
# How much an ambient-only match is worth relative to a subject match.
_AMBIENT_DISCOUNT = 0.3

# Floor for the discriminative weight below, so a term common to the whole pool
# still counts for something rather than vanishing.
_MIN_DISCRIMINATION = 0.25

# Only the leading query terms can be the subject — search terms lead the merged
# vocabulary, so the scene's own keywords behind them are supporting context.
# Kept narrow: the LLM is told to lead with the subject.
_SUBJECT_TERM_LOOKAHEAD = 2

# Action words are never the subject. "penguin swimming underwater" made `swim`
# qualify — rare enough in the pool to look discriminating — so a jellyfish clip
# tagged `swim` collected the same bonus as an actual penguin. What a thing is
# doing does not identify what it is.
_ACTION_WORDS = frozenset(
    _norm(w)
    for w in """
    swim swimming swims dive diving dives fly flying flies run running runs
    walk walking walks jump jumping sit sitting stand standing move moving
    work working play playing eat eating drink drinking sleep sleeping
    talk talking dance dancing sing singing drive driving ride riding
    """.split()
)
# A subject term must actually be rare in the pool; if most clips carry it, it is
# a setting word for this search and naming it proves nothing.
_SUBJECT_MIN_DISCRIMINATION = 0.5
# Flat credit for naming the subject at all. Sized above the spread that
# precision can open up between a dense tag list and a short description.
_SUBJECT_MATCH_BONUS = 0.35


def _discrimination(clip_docs: list[list[str]], term: str) -> float:
    """How much a term tells us apart *within this pool*.

    A hand-written ambient list cannot anticipate every generic word. But the
    pool itself says which terms discriminate: searching "penguin swimming
    underwater" returns eight clips where six mention `underwater` and one
    mentions `penguin` — so `underwater` separates nothing while `penguin` is
    the entire question. Without this, jellyfish and manta rays outrank the one
    actual penguin clip by matching two generic terms each.

    This is idf's intuition, but computed over the candidate pool and floored,
    rather than BM25's full idf which collapses to zero on a pool this small.
    """
    if not clip_docs:
        return 1.0
    present = sum(1 for doc in clip_docs if term in doc)
    if present == 0:
        return 1.0
    share = present / len(clip_docs)
    return max(_MIN_DISCRIMINATION, 1.0 - share)


def _merge_query_tokens(
    scene_tokens: list[str], search_query: str | None
) -> list[str]:
    """Put the terms actually searched for at the front of the ranking query.

    The LLM decides *what to search for*; the keyword extractor decides *which
    result wins*. When those disagree the pick is chosen by the weaker signal —
    a query of "jazz orchestra stage" scored against keyword tokens like
    `cotton`/`club`/`harlem` ranks on words the provider never matched on.

    Search terms lead (``_field_overlap`` weights by position), with the scene's
    remaining vocabulary kept behind them as supporting context.
    """
    lead: list[str] = []
    for word in (search_query or "").lower().split():
        stem = _norm(word)
        if stem and stem not in lead:
            lead.append(stem)
    for stem in scene_tokens or []:
        if stem and stem not in lead:
            lead.append(stem)
    return lead


def rank_clips_by_relevance(clips: list, scene_tokens: list[str]) -> list[tuple]:
    """Order a candidate pool by how well each clip matches the scene.

    Returns ``[(clip, score), ...]``, best first.

    Scores provider tags and description separately (tags are curated keywords;
    the description is incidental prose, so it counts at a discount) and adds a
    small frame-rate bonus as a tiebreak. When nothing matches — common, since
    Pexels videos ship no tags at all — the pool is returned **in its original
    order**, which is ``search``'s fps ranking. A zero-information reshuffle
    would be strictly worse than leaving the providers' own ordering alone.
    """
    if not clips:
        return []

    query = [t for t in (scene_tokens or []) if t]
    # With no query every clip scores 0, so fps is the only signal and is free to
    # use its full range.
    ceiling = (
        _FPS_BONUS_FRACTION * _weakest_relevance_win(query) if query else _FPS_BONUS_FRACTION
    )
    fps_bonuses = [_fps_bonus(getattr(c, "fps", None), ceiling) for c in clips]

    if not query:
        return list(zip(clips, fps_bonuses))

    # Tokenise once: the discriminative weighting below needs the whole pool.
    docs = [
        (
            tokenize(getattr(c, "tags", "") or ""),
            tokenize(getattr(c, "description", "") or ""),
        )
        for c in clips
    ]
    pool_docs = [set(t + d) for t, d in docs]
    term_weights = {t: _discrimination(pool_docs, t) for t in query}

    # The scene's *subject*: the query terms that separate this pool best, taken
    # from the front of the query (search terms lead) and excluding ambient
    # words. Naming one of these is qualitatively different from matching a
    # setting word, and short provider descriptions cannot show it any other way.
    _subject_terms = {
        t for t in query[:_SUBJECT_TERM_LOOKAHEAD]
        if t not in _AMBIENT_WORDS
        and t not in _ACTION_WORDS
        and term_weights.get(t, 1.0) >= _SUBJECT_MIN_DISCRIMINATION
    }

    scored: list[tuple] = []
    relevance_total = 0.0
    for i, clip in enumerate(clips):
        tags, desc = docs[i]
        # One document per clip: tags and description are pooled, never weighted
        # against each other. Which field a word arrives in is a fact about the
        # provider, not about how well the clip fits the scene.
        doc = tags + desc
        # Recall: how much of the scene the clip covers.
        recall = _field_overlap(doc, query, term_weights)
        # Precision: what share of the clip's own text is on-topic.
        precision = _doc_precision(doc, query)
        relevance = recall + _PRECISION_WEIGHT * precision
        # Naming the subject is qualitatively different from matching a setting
        # word, and a short description has no other way to show it: "penguins
        # swimming in aquarium" is four words, all of them relevant.
        if _subject_terms and any(t in set(doc) for t in _subject_terms):
            relevance += _SUBJECT_MATCH_BONUS
        relevance_total += relevance
        scored.append((clip, relevance + fps_bonuses[i]))

    if relevance_total <= 0:
        # Nothing matched anywhere — preserve the providers' ordering.
        return list(zip(clips, fps_bonuses))

    # Stable sort, so equal scores keep search order as the final tiebreak.
    ranked = sorted(scored, key=lambda cs: cs[1], reverse=True)

    logger.debug(
        "[STOCK_RANK] query=%s top=%s",
        query[:8],
        [(c.provider, c.id, round(s, 3), (c.tags or "")[:40]) for c, s in ranked[:3]],
    )
    return ranked
