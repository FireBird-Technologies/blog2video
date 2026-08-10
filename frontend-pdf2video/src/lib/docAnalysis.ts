/**
 * Shared text analysis for the free tools.
 *
 * Everything here runs on the client against text the visitor already has, so
 * a signed-out user gets a real, complete answer from the shell. The paid step
 * these tools lead to is the one that needs our models and our renderer —
 * rewriting the narration in a chosen voice, and producing the MP4.
 *
 * The numbers are deliberately explainable rather than clever: a reader can
 * check the arithmetic, which matters on pages whose job is to be trusted by
 * someone who has never heard of us.
 */

/** Narration pace used across the tools, in words per minute. */
export const NARRATION_WPM = 150;

/** Silent reading pace for the "reading vs watching" comparison. */
export const READING_WPM = 238;

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function countCharacters(text: string): number {
  return text.length;
}

export function countSentences(text: string): number {
  const matches = text.match(/[^.!?]+[.!?]+(\s|$)/g);
  return matches ? matches.length : text.trim() ? 1 : 0;
}

/** Rounded to whole seconds — a runtime estimate implying tenths would be a lie. */
export function secondsForWords(words: number, wpm = NARRATION_WPM): number {
  return Math.round((words / wpm) * 60);
}

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export interface Paragraph {
  text: string;
  words: number;
  /** True when the line reads like a heading rather than prose. */
  isHeading: boolean;
}

/**
 * A heading is short, has no terminal punctuation, and isn't a fragment of a
 * wrapped sentence. Numbered section labels ("3.2 Methodology") count too.
 */
function looksLikeHeading(line: string): boolean {
  const words = countWords(line);
  if (words === 0 || words > 12) return false;
  if (/[.!?,;]$/.test(line.trim())) return false;
  if (/^(\d+([.)]\d+)*[.)]?)\s+\S/.test(line)) return true;
  if (line === line.toUpperCase() && /[A-Z]/.test(line) && words <= 10) return true;
  // Title Case with most words capitalised.
  const capitalised = line
    .split(/\s+/)
    .filter((word) => /^[A-Z]/.test(word)).length;
  return words <= 8 && capitalised >= Math.ceil(words * 0.6);
}

export function toParagraphs(text: string): Paragraph[] {
  return text
    .split(/\n{2,}/)
    .map((block) => block.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((block) => ({
      text: block,
      words: countWords(block),
      isHeading: looksLikeHeading(block),
    }));
}

export interface Scene {
  index: number;
  /** Heading the scene sits under, or a generated label. */
  title: string;
  /** Narration text for this scene. */
  narration: string;
  words: number;
  seconds: number;
}

/**
 * Split a document into scenes the way the renderer does: a new scene starts at
 * a heading, and any run of prose longer than `maxWords` is broken at a
 * sentence boundary so no single scene outruns its visuals.
 */
export function buildScenes(text: string, maxWords = 90): Scene[] {
  const paragraphs = toParagraphs(text);
  const scenes: Scene[] = [];

  let currentTitle = "Introduction";
  let buffer: string[] = [];

  const flush = () => {
    const narration = buffer.join(" ").trim();
    buffer = [];
    if (!narration) return;

    for (const chunk of splitToWordLimit(narration, maxWords)) {
      const words = countWords(chunk);
      scenes.push({
        index: scenes.length + 1,
        title: currentTitle,
        narration: chunk,
        words,
        seconds: secondsForWords(words),
      });
    }
  };

  for (const paragraph of paragraphs) {
    if (paragraph.isHeading) {
      flush();
      currentTitle = paragraph.text;
      continue;
    }
    buffer.push(paragraph.text);
    if (countWords(buffer.join(" ")) >= maxWords) flush();
  }
  flush();

  return scenes;
}

/** Break prose into chunks of at most `maxWords`, never mid-sentence. */
export function splitToWordLimit(text: string, maxWords: number): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [text];
  const chunks: string[] = [];
  let current: string[] = [];
  let currentWords = 0;

  for (const rawSentence of sentences) {
    const sentence = rawSentence.trim();
    if (!sentence) continue;
    const words = countWords(sentence);

    if (currentWords > 0 && currentWords + words > maxWords) {
      chunks.push(current.join(" "));
      current = [];
      currentWords = 0;
    }
    current.push(sentence);
    currentWords += words;
  }
  if (current.length) chunks.push(current.join(" "));
  return chunks;
}

// ─── Extractive summary ──────────────────────────────────────────────────────
// Frequency-scored sentence extraction (the classic Luhn approach). It is not a
// language model and the tool copy says so: it selects the document's own
// load-bearing sentences rather than writing new ones. That is the honest
// boundary between the free shell and the account-gated rewrite.

const STOP_WORDS = new Set(
  ("a about above after again against all am an and any are as at be because been before being below between both but by " +
    "can did do does doing down during each few for from further had has have having he her here hers herself him himself " +
    "his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours " +
    "ourselves out over own same she should so some such than that the their theirs them themselves then there these they " +
    "this those through to too under until up very was we were what when where which while who whom why will with you your " +
    "yours yourself yourselves").split(" ")
);

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

export interface SummarySentence {
  text: string;
  /** Position in the original document, so output keeps the source order. */
  order: number;
}

/**
 * Pick the `count` most representative sentences, returned in document order.
 *
 * Sentences are scored by the average frequency of their content words, with a
 * mild penalty for very short ones (a five-word sentence full of the document's
 * top term is usually a heading, not a finding).
 */
export function summarise(text: string, count = 5): SummarySentence[] {
  const sentences = (text.match(/[^.!?\n]+[.!?]+/g) ?? [])
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter((sentence) => countWords(sentence) >= 6);

  if (!sentences.length) return [];

  const frequency = new Map<string, number>();
  for (const sentence of sentences) {
    for (const token of tokenise(sentence)) {
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }
  }

  const scored = sentences.map((sentence, order) => {
    const tokens = tokenise(sentence);
    if (!tokens.length) return { text: sentence, order, score: 0 };
    const total = tokens.reduce((sum, token) => sum + (frequency.get(token) ?? 0), 0);
    const lengthPenalty = tokens.length < 8 ? 0.7 : 1;
    return { text: sentence, order, score: (total / tokens.length) * lengthPenalty };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .sort((a, b) => a.order - b.order)
    .map(({ text: sentenceText, order }) => ({ text: sentenceText, order }));
}

/** The document's most distinctive terms — used as on-screen keyword chips. */
export function keyTerms(text: string, count = 8): Array<{ term: string; hits: number }> {
  const frequency = new Map<string, number>();
  for (const token of tokenise(text)) {
    frequency.set(token, (frequency.get(token) ?? 0) + 1);
  }
  return [...frequency.entries()]
    .filter(([, hits]) => hits > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([term, hits]) => ({ term, hits }));
}

/** Rough page estimate for pasted text, when there's no PDF to count. */
export function estimatePages(words: number): number {
  return Math.max(1, Math.round(words / 500));
}
