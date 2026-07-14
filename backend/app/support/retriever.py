from __future__ import annotations

import logging
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Iterable

from rank_bm25 import BM25Okapi

from .corpus_loader import CorpusDoc, get_corpus

logger = logging.getLogger(__name__)

# --- Tokenization -------------------------------------------------------------

_STOPWORDS = frozenset(
    """
    the a an and or but if then else of for to in on at by with from as is are was
    were be been being have has had do does did can could should would may might
    will shall must i you he she it we they them us our your their my me him her
    this that these those there here what which who whom whose how why when where
    not no yes so up down out about into over under again further once also just
    very more most some any all each few other own same than too own
    """.split()
)


def _strip_suffix(token: str) -> str:
    # Light suffix stripping. Not full Porter; covers the common morphology we care about.
    # render/rendering/renders -> render; export/exports/exporting/exported -> export.
    for suf in ("ingly", "edly", "ing", "ied", "ies", "ied", "ed", "es", "s", "ly"):
        if len(token) > len(suf) + 2 and token.endswith(suf):
            return token[: -len(suf)]
    return token


_TOKEN_RE = re.compile(r"[a-z0-9]+")


def tokenize(text: str) -> list[str]:
    if not text:
        return []
    lowered = text.lower()
    raw = _TOKEN_RE.findall(lowered)
    out: list[str] = []
    for tok in raw:
        if len(tok) < 3:
            continue
        if tok in _STOPWORDS:
            continue
        out.append(_strip_suffix(tok))
    return out


# --- Scored doc ---------------------------------------------------------------


@dataclass
class ScoredDoc:
    doc: CorpusDoc
    score: float
    breakdown: dict[str, float]


# --- Retriever interface ------------------------------------------------------


class Retriever(ABC):
    @abstractmethod
    def retrieve(
        self,
        query: str,
        *,
        history: Iterable[str] = (),
        page_path: str | None = None,
        last_cited_doc_ids: Iterable[str] = (),
        top_k: int = 3,
        min_score: float = 1.0,
    ) -> list[ScoredDoc]: ...


# --- BM25 implementation ------------------------------------------------------


class BM25Retriever(Retriever):
    """Two-index BM25 (high-signal fields ×1.0, body ×0.4) plus contextual boosts."""

    HIGH_SIGNAL_WEIGHT = 1.0
    BODY_WEIGHT = 0.4
    HISTORY_WEIGHT = 0.5
    ROUTE_BOOST = 3.0
    CONTINUITY_BOOST = 2.0
    # help/support docs are authoritative, UI-grounded instructions; blog posts are
    # SEO/marketing prose that often shares titles/keywords with the real how-to doc
    # and would otherwise outrank it on pure BM25 score. Prefer the authoritative doc.
    SOURCE_BOOST = {"help": 1.6, "support": 1.6}

    def __init__(self, docs: list[CorpusDoc]):
        self.docs = docs
        self._high_tokens = [tokenize(d.high_signal_text) for d in docs]
        self._body_tokens = [tokenize(d.body) for d in docs]
        # rank-bm25 fails on a doc with zero tokens; pad with the slug as a fallback.
        for i, toks in enumerate(self._high_tokens):
            if not toks:
                self._high_tokens[i] = tokenize(docs[i].slug) or [docs[i].id]
        for i, toks in enumerate(self._body_tokens):
            if not toks:
                self._body_tokens[i] = self._high_tokens[i]
        self._high_bm25 = BM25Okapi(self._high_tokens)
        self._body_bm25 = BM25Okapi(self._body_tokens)
        self._id_to_index = {d.id: i for i, d in enumerate(docs)}

    def _expand_query(self, query: str, history: Iterable[str]) -> list[tuple[str, float]]:
        current_tokens = tokenize(query)
        toks = [(t, 1.0) for t in current_tokens]
        history_list = list(history)[-2:]
        for prior in history_list:
            for t in tokenize(prior):
                toks.append((t, self.HISTORY_WEIGHT))
        logger.info(
            "[RETRIEVAL] Query expansion: current_query=%r yields %d tokens, "
            "history expansion from %d prior messages adds %d tokens (weight=%.1f)",
            query[:100],
            len(current_tokens),
            len(history_list),
            sum(1 for t, w in toks if w == self.HISTORY_WEIGHT),
            self.HISTORY_WEIGHT,
        )
        return toks

    def _weighted_bm25(
        self, bm25: BM25Okapi, weighted_query: list[tuple[str, float]]
    ) -> list[float]:
        # rank-bm25 doesn't support per-token weights, so we run it once per unique
        # weight bucket and combine. Simpler: bucket tokens by weight, score each
        # bucket, multiply by weight, sum. Two buckets in practice (1.0 and 0.5).
        if not weighted_query:
            return [0.0] * len(self.docs)
        buckets: dict[float, list[str]] = {}
        for t, w in weighted_query:
            buckets.setdefault(w, []).append(t)
        total = [0.0] * len(self.docs)
        for w, toks in buckets.items():
            scores = bm25.get_scores(toks)
            for i, s in enumerate(scores):
                total[i] += w * float(s)
        return total

    def retrieve(
        self,
        query: str,
        *,
        history: Iterable[str] = (),
        page_path: str | None = None,
        last_cited_doc_ids: Iterable[str] = (),
        top_k: int = 3,
        min_score: float = 1.0,
    ) -> list[ScoredDoc]:
        logger.info("[RETRIEVAL] ===== Starting BM25 retrieval =====")
        logger.info("[RETRIEVAL] User query: %r (length=%d)", query[:100], len(query))
        logger.info("[RETRIEVAL] Page context: %s", page_path or "(none)")
        logger.info("[RETRIEVAL] Last cited docs for continuity boost: %s", list(last_cited_doc_ids) or "(none)")

        weighted_query = self._expand_query(query, history)
        if not weighted_query:
            logger.warning("[RETRIEVAL] Query produced no tokens after tokenization — returning empty results")
            return []
        query_token_summary = ", ".join(f"{t}(×{w:.1f})" for t, w in weighted_query[:20])
        logger.info("[RETRIEVAL] Effective query tokens (%d total): %s%s", len(weighted_query), query_token_summary, " ..." if len(weighted_query) > 20 else "")

        high_scores = self._weighted_bm25(self._high_bm25, weighted_query)
        body_scores = self._weighted_bm25(self._body_bm25, weighted_query)
        logger.debug("[RETRIEVAL] BM25 scoring complete: high_signal index + body index computed")

        cited_set = set(last_cited_doc_ids)
        scored: list[ScoredDoc] = []
        for i, doc in enumerate(self.docs):
            high = self.HIGH_SIGNAL_WEIGHT * high_scores[i]
            body = self.BODY_WEIGHT * body_scores[i]
            route = self.ROUTE_BOOST if (page_path and self._page_matches(page_path, doc)) else 0.0
            cont = self.CONTINUITY_BOOST if doc.id in cited_set else 0.0
            source = self.SOURCE_BOOST.get(doc.source, 0.0) if (high + body) > 0 else 0.0
            total = high + body + route + cont + source
            scored.append(
                ScoredDoc(
                    doc=doc,
                    score=total,
                    breakdown={
                        "high_signal": round(high, 3),
                        "body": round(body, 3),
                        "route": route,
                        "continuity": cont,
                        "source": source,
                        "total": round(total, 3),
                    },
                )
            )

        scored.sort(key=lambda s: s.score, reverse=True)
        top_candidates = scored[:top_k]
        result = [s for s in top_candidates if s.score >= min_score]

        logger.info(
            "[RETRIEVAL] Top %d candidates before min_score filter (threshold=%.1f):",
            top_k,
            min_score,
        )
        for idx, s in enumerate(top_candidates, 1):
            passed = s.score >= min_score
            logger.info(
                "[RETRIEVAL]   #%d [%s]: id=%s  title=%r  score=%.3f  "
                "high_signal=%.3f  body=%.3f  route=%.1f  continuity=%.1f  source=%.1f",
                idx,
                "PASS" if passed else "FAIL",
                s.doc.id,
                s.doc.title[:50],
                s.score,
                s.breakdown["high_signal"],
                s.breakdown["body"],
                s.breakdown["route"],
                s.breakdown["continuity"],
                s.breakdown["source"],
            )
        if not result:
            logger.warning(
                "[RETRIEVAL] No documents passed min_score=%.1f — "
                "best candidate was id=%s score=%.3f",
                min_score,
                top_candidates[0].doc.id if top_candidates else "(none)",
                top_candidates[0].score if top_candidates else 0.0,
            )
        else:
            logger.info(
                "[RETRIEVAL] Returning %d/%d docs — selected: %s",
                len(result),
                top_k,
                [s.doc.id for s in result],
            )

        return result

    @staticmethod
    def _page_matches(page_path: str, doc: CorpusDoc) -> bool:
        if not page_path:
            return False
        if page_path == doc.route:
            return True
        return page_path in doc.related_paths


# --- Module-level singleton ---------------------------------------------------

_default: BM25Retriever | None = None


def get_retriever() -> BM25Retriever:
    global _default
    if _default is None:
        _default = BM25Retriever(get_corpus())
    return _default
