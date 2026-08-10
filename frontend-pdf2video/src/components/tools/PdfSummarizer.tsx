import { useMemo, useState } from "react";
import DocumentInput, { type DocumentPayload } from "./DocumentInput";
import { GateHint, useSignupGate } from "./SignupGate";
import {
  EmptyState,
  PrimaryButton,
  SecondaryButton,
  StatTile,
  ToolShell,
  copyToClipboard,
  downloadText,
} from "./shared";
import {
  countWords,
  estimatePages,
  formatDuration,
  keyTerms,
  READING_WPM,
  secondsForWords,
  summarise,
} from "../../lib/docAnalysis";

/**
 * PDF summarizer.
 *
 * The free shell runs extractive summarisation: it scores the document's own
 * sentences by how much of its vocabulary they carry and returns the strongest
 * ones in reading order. The copy is explicit that these are the document's
 * sentences, not new ones — that honesty is the difference between a tool people
 * trust and one they bounce off when the output reads like a bad paraphrase.
 *
 * The account unlocks the abstractive version (a model rewriting the argument in
 * plain language) and the thing this site actually sells: the same summary
 * narrated over visuals.
 */

const LENGTHS = [
  { label: "Brief · 3", value: 3 },
  { label: "Standard · 6", value: 6 },
  { label: "Detailed · 10", value: 10 },
];

export default function PdfSummarizer() {
  const [doc, setDoc] = useState<DocumentPayload>({ text: "", fileName: null, pageCount: 0 });
  const [count, setCount] = useState(6);
  const [copied, setCopied] = useState(false);

  const { requireAuth, gateModal } = useSignupGate({
    eyebrow: "Free PDF tool",
    headline: "Get the AI summary — and the video of it",
    blurb:
      "A free account swaps this extractive pass for a model that rewrites the argument in plain language, then narrates it over your figures.",
    bullets: [
      "Abstractive summaries written, not extracted",
      "Summary → narrated video in one step",
      "Free account, no card required",
    ],
  });

  const sentences = useMemo(
    () => (doc.text.trim() ? summarise(doc.text, count) : []),
    [doc.text, count]
  );
  const terms = useMemo(() => (doc.text.trim() ? keyTerms(doc.text, 8) : []), [doc.text]);

  const words = countWords(doc.text);
  const pages = doc.pageCount || estimatePages(words);
  const readSeconds = secondsForWords(words, READING_WPM);
  const summaryWords = countWords(sentences.map((entry) => entry.text).join(" "));
  const compression = words > 0 ? Math.round((1 - summaryWords / words) * 100) : 0;

  const summaryText = sentences.map((entry) => `• ${entry.text}`).join("\n");

  const handleCopy = () => {
    void copyToClipboard(summaryText).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      },
      () => setCopied(false)
    );
  };

  return (
    <ToolShell>
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <DocumentInput onDocument={setDoc} label="PDF or text" />

          <div className="mt-5">
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-gray-400">
              Summary length
            </label>
            <div className="flex flex-wrap gap-2">
              {LENGTHS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCount(option.value)}
                  className={`rounded-full border px-4 py-2 text-xs font-medium transition ${
                    count === option.value
                      ? "border-purple-200 bg-purple-50 text-purple-700"
                      : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {terms.length > 0 ? (
            <div className="mt-5">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-400">
                What this document is about
              </p>
              <div className="flex flex-wrap gap-1.5">
                {terms.map((entry) => (
                  <span
                    key={entry.term}
                    className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600"
                  >
                    {entry.term}
                    <span className="ml-1 tabular-nums text-gray-400">{entry.hits}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div>
          {sentences.length === 0 ? (
            <EmptyState>
              Drop a PDF or paste text to get a summary built from the document's own
              highest-signal sentences. No upload, no account.
            </EmptyState>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <StatTile label="Pages" value={String(pages)} sub={doc.pageCount ? "from the file" : "estimated"} />
                <StatTile label="Read time" value={formatDuration(readSeconds)} sub={`at ${READING_WPM} wpm`} />
                <StatTile label="Condensed" value={`${compression}%`} sub="shorter than the source" />
              </div>

              <div className="mt-4 space-y-3">
                {sentences.map((entry) => (
                  <div key={entry.order} className="flex gap-3 rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-purple-500" />
                    <p className="text-sm leading-relaxed text-gray-700">{entry.text}</p>
                  </div>
                ))}
              </div>

              <p className="mt-3 text-xs leading-relaxed text-gray-400">
                These are sentences lifted from your document, ranked by how much of its core
                vocabulary each one carries. Nothing has been rewritten, so nothing has been
                invented.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <PrimaryButton onClick={requireAuth}>Summarise with AI, then film it →</PrimaryButton>
                <SecondaryButton onClick={handleCopy}>{copied ? "Copied" : "Copy summary"}</SecondaryButton>
                <SecondaryButton
                  onClick={() =>
                    downloadText(
                      `${(doc.fileName ?? "document").replace(/\.[^.]+$/, "")}-summary.txt`,
                      summaryText
                    )
                  }
                >
                  Download .txt
                </SecondaryButton>
              </div>
              <GateHint>
                The extractive summary above is free forever. A free account adds the rewritten
                version and turns it into a narrated video.
              </GateHint>
            </>
          )}
        </div>
      </div>
      {gateModal}
    </ToolShell>
  );
}
