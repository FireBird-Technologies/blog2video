const STRIP_SELECTORS = "script, style, iframe, noscript, nav, footer, header, form, aside, [aria-hidden='true']";

/** Best-effort article text extraction, mirroring class-b2v-post-extractor.php's approach. */
export function extractArticleText(doc: Document): string {
  const candidates = [
    doc.querySelector("article"),
    doc.querySelector("main"),
    doc.querySelector("[role='main']"),
    doc.body,
  ].filter((el): el is HTMLElement => el !== null);

  const source = candidates[0] ?? doc.body;
  const clone = source.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(STRIP_SELECTORS).forEach((el) => el.remove());

  const text = (clone.textContent || "")
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}
