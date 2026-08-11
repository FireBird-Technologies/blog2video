import { useState } from "react";
import DocumentInput, { type DocumentPayload } from "./DocumentInput";
import { ToolAuthProvider } from "./LoginGate";
import {
  EmptyState,
  PrimaryButton,
  SecondaryButton,
  StatTile,
  ToolShell,
  TruncationNotice,
  downloadText,
} from "./shared";
import {
  storyboardFromDocument,
  toolErrorMessage,
  type PdfStoryboard,
} from "../../api/pdfTools";
import { countWords, formatDuration, secondsForWords } from "../../lib/docAnalysis";

/**
 * PDF → slideshow storyboard, written by a model.
 *
 * The model's hard instruction is that on-screen text and narration must be
 * different text (see DocumentToSlides in app/dspy_modules/pdf_tool_gen.py).
 * That is the rule automatic slideshow makers break, and it is why their output
 * feels dead: a viewer reads faster than a narrator speaks, so duplicating the
 * words leaves them idle on every slide.
 */

type Ratio = "16:9" | "9:16" | "1:1";

const RATIOS: Array<{ id: Ratio; label: string; aspect: string }> = [
  { id: "16:9", label: "Landscape", aspect: "56.25%" },
  { id: "9:16", label: "Vertical", aspect: "177.78%" },
  { id: "1:1", label: "Square", aspect: "100%" },
];

const SLIDE_COUNTS = [6, 10, 16, 24];

/** The API returns on-screen lines pipe-separated, so the frame can lay them out. */
function onScreenLines(raw: string): string[] {
  return raw
    .split("|")
    .map((line) => line.trim())
    .filter(Boolean);
}

function StoryboardWidget() {
  const [doc, setDoc] = useState<DocumentPayload | null>(null);
  const [slideCount, setSlideCount] = useState(10);
  const [ratio, setRatio] = useState<Ratio>("16:9");
  const [result, setResult] = useState<PdfStoryboard | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    if (!doc) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await storyboardFromDocument(doc.text, slideCount));
    } catch (err) {
      setError(await toolErrorMessage(err, "Storyboard generation failed. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const slides = result?.slides ?? [];
  const totalSeconds = slides.reduce(
    (sum, slide) => sum + secondsForWords(countWords(slide.narration)),
    0
  );
  const aspect = RATIOS.find((entry) => entry.id === ratio)?.aspect ?? "56.25%";

  const csv = (() => {
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const rows = slides.map((slide, index) =>
      [
        index + 1,
        escape(slide.headline),
        escape(slide.on_screen),
        escape(slide.narration),
        secondsForWords(countWords(slide.narration)),
      ].join(",")
    );
    return ["slide,headline,on_screen,narration,seconds", ...rows].join("\n");
  })();

  return (
    <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
      <div>
        <DocumentInput onDocument={setDoc} disabled={busy} />

        <div className="mt-5">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-400">
            Roughly how many slides
          </p>
          <div className="flex gap-2">
            {SLIDE_COUNTS.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setSlideCount(count)}
                disabled={busy}
                className={`flex-1 rounded-xl border px-3 py-2.5 text-xs font-medium transition disabled:opacity-50 ${
                  slideCount === count
                    ? "border-purple-200 bg-purple-50 text-purple-700"
                    : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                }`}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-400">
            Frame shape
          </p>
          <div className="flex gap-2">
            {RATIOS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setRatio(option.id)}
                className={`flex-1 rounded-xl border px-3 py-2.5 text-xs font-medium transition ${
                  ratio === option.id
                    ? "border-purple-200 bg-purple-50 text-purple-700"
                    : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                }`}
              >
                {option.label}
                <span className="mt-0.5 block text-[10px] font-normal text-gray-400">
                  {option.id}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-gray-400">
            Frame shape only changes the preview — the storyboard content is the same.
          </p>
        </div>

        <div className="mt-6">
          <PrimaryButton onClick={run} disabled={!doc || busy}>
            {busy ? "Building the storyboard…" : "Build the storyboard with AI"}
          </PrimaryButton>
        </div>

        {error ? (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-600">
            {error}
          </p>
        ) : null}
      </div>

      <div>
        {busy ? (
          <EmptyState>Splitting the document into slides and writing the narration…</EmptyState>
        ) : !result ? (
          <EmptyState>
            Upload a document and press the button. Each slide gets a headline, the lines that
            belong on screen, and separate narration underneath.
          </EmptyState>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <StatTile label="Slides" value={String(slides.length)} />
              <StatTile label="Runtime" value={formatDuration(totalSeconds)} />
              <StatTile
                label="Avg slide"
                value={formatDuration(totalSeconds / Math.max(1, slides.length))}
              />
            </div>

            <TruncationNotice truncated={result.truncated} />

            {result.deck_title ? (
              <p className="mt-4 text-base font-semibold text-gray-900">{result.deck_title}</p>
            ) : null}

            <div className="mt-3 grid max-h-[520px] gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
              {slides.map((slide, index) => {
                const lines = onScreenLines(slide.on_screen);
                return (
                  <figure
                    key={`${index}-${slide.headline}`}
                    className="overflow-hidden rounded-2xl border border-gray-200"
                  >
                    <div className="relative w-full bg-gray-900" style={{ paddingBottom: aspect }}>
                      <div className="absolute inset-0 flex flex-col justify-between p-4">
                        <div>
                          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-purple-300">
                            {String(index + 1).padStart(2, "0")}
                          </p>
                          <p className="mt-1.5 text-sm font-semibold leading-snug text-white">
                            {slide.headline}
                          </p>
                        </div>
                        <ul className="space-y-1">
                          {lines.slice(0, ratio === "9:16" ? 3 : 2).map((line) => (
                            <li
                              key={line}
                              className="flex gap-1.5 text-[10px] leading-snug text-gray-300"
                            >
                              <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-purple-400" />
                              <span>{line}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <figcaption className="bg-white px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                        Narration · {formatDuration(secondsForWords(countWords(slide.narration)))}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-gray-600">
                        {slide.narration}
                      </p>
                    </figcaption>
                  </figure>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <SecondaryButton
                onClick={() =>
                  downloadText(
                    `${(doc?.fileName ?? "document").replace(/\.[^.]+$/, "")}-storyboard.csv`,
                    csv,
                    "text/csv"
                  )
                }
              >
                Download storyboard .csv
              </SecondaryButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function PdfToSlideshow() {
  return (
    <ToolShell>
      <ToolAuthProvider
        copy={{
          headline: "Sign in to storyboard your document",
          blurb:
            "A language model splits your document into slides and writes separate on-screen text and narration for each one. That runs on our servers.",
          bullets: [
            "On-screen lines and narration are different text, deliberately",
            "Timings derived from the narration it writes",
            "Free account, no card required",
          ],
        }}
      >
        <StoryboardWidget />
      </ToolAuthProvider>
    </ToolShell>
  );
}
