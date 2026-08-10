import { useMemo, useState } from "react";
import DocumentInput, { type DocumentPayload } from "./DocumentInput";
import { GateHint, useSignupGate } from "./SignupGate";
import {
  EmptyState,
  PrimaryButton,
  SecondaryButton,
  StatTile,
  ToolShell,
  downloadText,
} from "./shared";
import {
  buildScenes,
  countWords,
  formatDuration,
  keyTerms,
  secondsForWords,
  summarise,
  type Scene,
} from "../../lib/docAnalysis";

/**
 * PDF → slideshow storyboard.
 *
 * The free shell produces the artefact a person would otherwise build by hand in
 * a spreadsheet: a slide-by-slide plan with a headline, the bullets that belong
 * on screen, the narration underneath, and a duration. It renders as real
 * 16:9 / 9:16 frames so the pacing is visible rather than described.
 *
 * The account turns the storyboard into an actual rendered slideshow video —
 * typeset in a template, narrated, and exported as MP4.
 */

type Ratio = "16:9" | "9:16" | "1:1";

const RATIOS: Array<{ id: Ratio; label: string; aspect: string }> = [
  { id: "16:9", label: "Landscape", aspect: "56.25%" },
  { id: "9:16", label: "Vertical", aspect: "177.78%" },
  { id: "1:1", label: "Square", aspect: "100%" },
];

interface Slide extends Scene {
  headline: string;
  bullets: string[];
}

/** Turn a scene's narration into the two or three lines that belong on screen. */
function toSlide(scene: Scene): Slide {
  const bullets = summarise(scene.narration, 3)
    .map((entry) => entry.text.replace(/\s+/g, " ").trim())
    .map((line) => (line.length > 110 ? `${line.slice(0, 107).trimEnd()}…` : line));

  const fallback = scene.narration.length > 110
    ? `${scene.narration.slice(0, 107).trimEnd()}…`
    : scene.narration;

  return {
    ...scene,
    headline: scene.title,
    bullets: bullets.length ? bullets : [fallback],
  };
}

const FREE_SLIDE_LIMIT = 5;

export default function PdfToSlideshow() {
  const [doc, setDoc] = useState<DocumentPayload>({ text: "", fileName: null, pageCount: 0 });
  const [ratio, setRatio] = useState<Ratio>("16:9");
  const [secondsPerSlide, setSecondsPerSlide] = useState(0);

  const { requireAuth, gateModal } = useSignupGate({
    eyebrow: "Free PDF tool",
    headline: "Render this storyboard as a slideshow video",
    blurb:
      "Your slides, timings, and narration carry over. We typeset them in a template, add a voice, and export an MP4.",
    bullets: [
      "Every slide keeps your figures and wording",
      "Landscape, vertical, and square from one document",
      "Free account, no card required",
    ],
  });

  const slides = useMemo(
    () => (doc.text.trim() ? buildScenes(doc.text, 70).map(toSlide) : []),
    [doc.text]
  );
  const terms = useMemo(() => (doc.text.trim() ? keyTerms(doc.text, 6) : []), [doc.text]);

  const words = countWords(doc.text);
  // 0 means "pace each slide by its own narration"; anything else is a fixed hold.
  const totalSeconds = secondsPerSlide
    ? slides.length * secondsPerSlide
    : secondsForWords(words);

  const visible = slides.slice(0, FREE_SLIDE_LIMIT);
  const hidden = Math.max(0, slides.length - FREE_SLIDE_LIMIT);
  const aspect = RATIOS.find((entry) => entry.id === ratio)?.aspect ?? "56.25%";

  const storyboardCsv = useMemo(() => {
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const rows = slides.map((slide) =>
      [
        slide.index,
        escape(slide.headline),
        escape(slide.bullets.join(" | ")),
        escape(slide.narration),
        secondsPerSlide || slide.seconds,
      ].join(",")
    );
    return ["slide,headline,on_screen,narration,seconds", ...rows].join("\n");
  }, [slides, secondsPerSlide]);

  return (
    <ToolShell>
      <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <DocumentInput onDocument={setDoc} label="PDF or text" />

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
          </div>

          <div className="mt-5">
            <label
              htmlFor="pdf-slideshow-hold"
              className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-gray-400"
            >
              Slide timing
            </label>
            <select
              id="pdf-slideshow-hold"
              value={secondsPerSlide}
              onChange={(event) => setSecondsPerSlide(Number(event.target.value))}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500/40"
            >
              <option value={0}>Match the narration (recommended)</option>
              <option value={5}>Fixed — 5 seconds each</option>
              <option value={8}>Fixed — 8 seconds each</option>
              <option value={12}>Fixed — 12 seconds each</option>
            </select>
            <p className="mt-2 text-xs leading-relaxed text-gray-400">
              Fixed holds are what most slideshow makers give you, and they're why those videos feel
              wrong — a slide with one line and a slide with a paragraph don't deserve the same
              screen time.
            </p>
          </div>

          {terms.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {terms.map((entry) => (
                <span
                  key={entry.term}
                  className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600"
                >
                  {entry.term}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          {slides.length === 0 ? (
            <EmptyState>
              Drop a PDF to see it laid out as slides — headline, on-screen lines, narration, and a
              duration for each one.
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

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {visible.map((slide) => (
                  <figure key={slide.index} className="overflow-hidden rounded-2xl border border-gray-200">
                    <div className="relative w-full bg-gray-900" style={{ paddingBottom: aspect }}>
                      <div className="absolute inset-0 flex flex-col justify-between p-4">
                        <div>
                          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-purple-300">
                            {String(slide.index).padStart(2, "0")}
                          </p>
                          <p className="mt-1.5 text-sm font-semibold leading-snug text-white line-clamp-2">
                            {slide.headline}
                          </p>
                        </div>
                        <ul className="space-y-1">
                          {slide.bullets.slice(0, ratio === "9:16" ? 3 : 2).map((bullet) => (
                            <li
                              key={bullet}
                              className="flex gap-1.5 text-[10px] leading-snug text-gray-300"
                            >
                              <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-purple-400" />
                              <span className="line-clamp-2">{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <figcaption className="bg-white px-3 py-2">
                      <p className="text-[10px] tabular-nums text-gray-400">
                        {formatDuration(secondsPerSlide || slide.seconds)} · {slide.words} words of
                        narration
                      </p>
                    </figcaption>
                  </figure>
                ))}
              </div>

              {hidden > 0 ? (
                <button
                  type="button"
                  onClick={requireAuth}
                  className="mt-4 w-full rounded-2xl border border-dashed border-purple-200 bg-purple-50/50 p-4 text-left transition hover:bg-purple-50"
                >
                  <p className="text-sm font-semibold text-purple-700">
                    + {hidden} more {hidden === 1 ? "slide" : "slides"}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500">
                    The preview shows the first {FREE_SLIDE_LIMIT}. The CSV below has all{" "}
                    {slides.length} — sign in free to render them.
                  </p>
                </button>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-3">
                <PrimaryButton onClick={requireAuth}>Render the slideshow →</PrimaryButton>
                <SecondaryButton
                  onClick={() =>
                    downloadText(
                      `${(doc.fileName ?? "document").replace(/\.[^.]+$/, "")}-storyboard.csv`,
                      storyboardCsv,
                      "text/csv"
                    )
                  }
                >
                  Download storyboard .csv
                </SecondaryButton>
              </div>
              <GateHint>
                The storyboard CSV is the complete plan for every slide, free to take with you.
                Rendering it into a narrated MP4 is the part that needs an account.
              </GateHint>
            </>
          )}
        </div>
      </div>
      {gateModal}
    </ToolShell>
  );
}
