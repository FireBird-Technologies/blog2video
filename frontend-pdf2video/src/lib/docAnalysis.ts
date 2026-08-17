/**
 * Display arithmetic for the PDF tools.
 *
 * Everything genuinely hard — extraction, summarising, scripting, storyboarding,
 * narration — happens server-side against real models (see ../api/pdfTools.ts).
 * What is left here is the counting and formatting used to label the results,
 * which does not need a round trip.
 *
 * This file used to hold a client-side extractive summarizer and scene splitter
 * that stood in for the model. They were removed rather than kept as a
 * fallback: a heuristic that quietly produces something worse than what the
 * page promises is the failure the tools were rebuilt to eliminate.
 */

/** Narration pace used across the tools, in words per minute. */
export const NARRATION_WPM = 150;

/** Silent reading pace, for the "how long would this take to read" figure. */
export const READING_WPM = 238;

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
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

/** Rough page estimate from a word count, at ~500 words per page. */
export function estimatePages(words: number): number {
  return Math.max(1, Math.round(words / 500));
}
