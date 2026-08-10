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
  buildScenes,
  countWords,
  formatDuration,
  NARRATION_WPM,
  secondsForWords,
} from "../../lib/docAnalysis";

/**
 * PDF → video script.
 *
 * The free shell does the structural half of the job: it finds the document's
 * headings, cuts the prose into scene-sized narration blocks, and times each
 * one at a real narration pace. That is genuinely the part people get wrong by
 * hand, and it is entirely deterministic, so it can run for a signed-out
 * visitor with no cost to us.
 *
 * What sits behind the account is the part that needs a model and a renderer:
 * rewriting each block as spoken narration rather than written prose, choosing
 * visuals per scene, and producing the MP4.
 */

const SCENE_LENGTHS = [
  { label: "Tight (60 words)", value: 60 },
  { label: "Standard (90 words)", value: 90 },
  { label: "Relaxed (130 words)", value: 130 },
];

const FREE_SCENE_LIMIT = 6;

export default function PdfToVideoScript() {
  const [doc, setDoc] = useState<DocumentPayload>({ text: "", fileName: null, pageCount: 0 });
  const [maxWords, setMaxWords] = useState(90);
  const [copied, setCopied] = useState(false);

  const { requireAuth, gateModal } = useSignupGate({
    eyebrow: "Free PDF tool",
    headline: "Render this script as a narrated video",
    blurb:
      "Your scene breakdown carries over. We rewrite each block as spoken narration, pick visuals, and render an MP4 you can post.",
    bullets: [
      "Free account, no card — first videos included",
      "40+ narrator voices and branded templates",
      "Edit any scene before you export",
    ],
  });

  const scenes = useMemo(
    () => (doc.text.trim() ? buildScenes(doc.text, maxWords) : []),
    [doc.text, maxWords]
  );

  const totalWords = countWords(doc.text);
  const totalSeconds = secondsForWords(totalWords);
  const visibleScenes = scenes.slice(0, FREE_SCENE_LIMIT);
  const hiddenCount = Math.max(0, scenes.length - FREE_SCENE_LIMIT);

  const scriptText = useMemo(
    () =>
      scenes
        .map(
          (scene) =>
            `SCENE ${scene.index} — ${scene.title}  [${formatDuration(scene.seconds)}]\n${scene.narration}`
        )
        .join("\n\n"),
    [scenes]
  );

  const handleCopy = () => {
    void copyToClipboard(scriptText).then(
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
              Scene length
            </label>
            <div className="flex flex-wrap gap-2">
              {SCENE_LENGTHS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMaxWords(option.value)}
                  className={`rounded-full border px-4 py-2 text-xs font-medium transition ${
                    maxWords === option.value
                      ? "border-purple-200 bg-purple-50 text-purple-700"
                      : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-gray-400">
              Shorter scenes cut more often, which suits social. Longer scenes suit an explainer
              someone watches at a desk.
            </p>
          </div>
        </div>

        <div>
          {scenes.length === 0 ? (
            <EmptyState>
              Drop a PDF or paste your text. We'll split it into timed scenes using its own
              headings — no account needed.
            </EmptyState>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <StatTile label="Scenes" value={String(scenes.length)} />
                <StatTile label="Narration" value={formatDuration(totalSeconds)} sub={`at ${NARRATION_WPM} wpm`} />
                <StatTile label="Words" value={totalWords.toLocaleString()} />
              </div>

              <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
                {visibleScenes.map((scene) => (
                  <div key={scene.index} className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-purple-600">
                        Scene {scene.index} · {scene.title}
                      </p>
                      <span className="flex-shrink-0 text-xs tabular-nums text-gray-400">
                        {formatDuration(scene.seconds)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-gray-700">{scene.narration}</p>
                  </div>
                ))}

                {hiddenCount > 0 ? (
                  <button
                    type="button"
                    onClick={requireAuth}
                    className="w-full rounded-2xl border border-dashed border-purple-200 bg-purple-50/50 p-4 text-left transition hover:bg-purple-50"
                  >
                    <p className="text-sm font-semibold text-purple-700">
                      + {hiddenCount} more {hiddenCount === 1 ? "scene" : "scenes"} in this document
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-gray-500">
                      The preview shows the first {FREE_SCENE_LIMIT}. Sign in free to open the full
                      script, edit it scene by scene, and render it.
                    </p>
                  </button>
                ) : null}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <PrimaryButton onClick={requireAuth}>Turn this into a video →</PrimaryButton>
                <SecondaryButton onClick={handleCopy}>
                  {copied ? "Copied" : "Copy script"}
                </SecondaryButton>
                <SecondaryButton
                  onClick={() =>
                    downloadText(
                      `${(doc.fileName ?? "script").replace(/\.[^.]+$/, "")}-video-script.txt`,
                      scriptText
                    )
                  }
                >
                  Download .txt
                </SecondaryButton>
              </div>
              <GateHint>
                Copy and download are free and unlimited. Rendering needs a free account, because
                that step runs on our machines rather than yours.
              </GateHint>
            </>
          )}
        </div>
      </div>
      {gateModal}
    </ToolShell>
  );
}
