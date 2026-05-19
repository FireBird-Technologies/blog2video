from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

CORPUS_PATH = Path(__file__).parent / "seo_corpus.json"


@dataclass(frozen=True)
class CorpusDoc:
    id: str
    source: str
    slug: str
    title: str
    description: str
    primary_keyword: str
    keyword_variant: str
    related_paths: tuple[str, ...]
    route: str
    headings: tuple[str, ...]
    faq_questions: tuple[str, ...]
    body: str

    @property
    def high_signal_text(self) -> str:
        parts = [
            self.title,
            self.primary_keyword,
            self.keyword_variant,
            *self.headings,
            *self.faq_questions,
        ]
        return "\n".join(p for p in parts if p)


_corpus: list[CorpusDoc] | None = None


def load_corpus(path: Path = CORPUS_PATH) -> list[CorpusDoc]:
    global _corpus
    logger.info("[CORPUS] Loading corpus from %s", path)
    if not path.exists():
        logger.error("[CORPUS] Corpus file not found at %s — run `npm run build:seo-corpus`", path)
        raise FileNotFoundError(
            f"SEO corpus not found at {path}. "
            "Run `npm run build:seo-corpus` from the frontend directory."
        )
    with path.open("r", encoding="utf-8") as fh:
        raw = json.load(fh)
    docs = [
        CorpusDoc(
            id=item["id"],
            source=item["source"],
            slug=item["slug"],
            title=item["title"],
            description=item["description"],
            primary_keyword=item["primary_keyword"],
            keyword_variant=item["keyword_variant"],
            related_paths=tuple(item.get("related_paths") or ()),
            route=item["route"],
            headings=tuple(item.get("headings") or ()),
            faq_questions=tuple(item.get("faq_questions") or ()),
            body=item["body"],
        )
        for item in raw
    ]
    _corpus = docs
    by_source: dict[str, int] = {}
    for d in docs:
        by_source[d.source] = by_source.get(d.source, 0) + 1
    logger.info(
        "[CORPUS] Loaded %d entries from %s — breakdown: %s",
        len(docs),
        path,
        ", ".join(f"{src}:{count}" for src, count in sorted(by_source.items())),
    )
    return docs


def get_corpus() -> list[CorpusDoc]:
    if _corpus is None:
        logger.info("[CORPUS] Cold load — corpus singleton not yet initialised")
        return load_corpus()
    logger.debug("[CORPUS] Cache hit — returning %d pre-loaded entries", len(_corpus))
    return _corpus
