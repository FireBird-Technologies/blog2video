"""Smoke eval for the keyword retriever.

Run: cd backend && python3 -m app.support.eval_retrieval

Each entry is (question, expected_doc_id_substring, optional_page_path). We assert
the expected doc is in the top 3. This is a sanity check, not a benchmark.
"""

from __future__ import annotations

from .retriever import get_retriever

CASES: list[tuple[str, str, str | None]] = [
    ("how do I turn an article into a video?", "article-to-video", "/"),
    ("convert my blog post to a youtube video", "blog-to-youtube", "/"),
    ("can I make a video from a PDF?", "pdf-to-video", "/"),
    ("how do I export to LinkedIn?", "linkedin", None),
    ("turn my substack newsletter into video", "substack", None),
    ("create a linkedin carousel from an article", "carousel", None),
    ("what templates are available?", "template", "/"),
    ("how do I make shorts from a blog post?", "shorts", None),
    ("turn a url into a video", "url-to-video", "/"),
    ("custom branded template builder", "custom", None),
]


def run() -> None:
    retriever = get_retriever()
    passed = 0
    for question, expected, page in CASES:
        results = retriever.retrieve(
            question,
            page_path=page,
            top_k=3,
            min_score=0.5,
        )
        ids = [r.doc.id for r in results]
        ok = any(expected.lower() in i.lower() for i in ids)
        passed += int(ok)
        marker = "PASS" if ok else "FAIL"
        print(f"[{marker}] {question!r}")
        print(f"        expected~{expected!r}")
        for r in results:
            print(f"        {r.score:.2f}  {r.doc.id}  {r.breakdown}")
        print()
    print(f"\n{passed}/{len(CASES)} passed (top-3 contains expected substring)")


if __name__ == "__main__":
    run()
