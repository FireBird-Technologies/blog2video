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
  copyToClipboard,
  downloadText,
} from "./shared";
import {
  scriptFromDocument,
  toolErrorMessage,
  type PdfScript,
  type ScriptLength,
} from "../../api/pdfTools";
import { countWords, formatDuration, NARRATION_WPM, secondsForWords } from "../../lib/docAnalysis";

/**
 * PDF → video script, written by a model.
 *
 * The model does the part that actually needs judgement: choosing what to leave
 * out. A document narrated end to end is unwatchable, so the prompt is explicit
 * that dropping methodology, related work, and appendices is correct, and that
 * the finding belongs in scene one even though the document builds to it.
 *
 * Runtimes are computed client-side from the returned narration, because that
 * is arithmetic and does not need a round trip.
 */

const LENGTHS: Array<{ id: ScriptLength; label: string; hint: string }> = [
  { id: "short", label: "Short", hint: "5–7 scenes" },
  { id: "standard", label: "Standard", hint: "8–12 scenes" },
  { id: "long", label: "Long", hint: "14–20 scenes" },
];

const SCENE_WORDS = [
  { label: "Tight · 60", value: 60 },
  { label: "Standard · 90", value: 90 },
  { label: "Relaxed · 130", value: 130 },
];

function ScriptWidget() {
  const [doc, setDoc] = useState<DocumentPayload | null>(null);
  const [length, setLength] = useState<ScriptLength>("standard");
  const [maxWords, setMaxWords] = useState(90);
  const [result, setResult] = useState<PdfScript | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const run = async () => {
    if (!doc) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await scriptFromDocument(doc.text, length, maxWords));
    } catch (err) {
      setError(await toolErrorMessage(err, "Script generation failed. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const scenes = result?.scenes ?? [];
  const totalWords = scenes.reduce((sum, scene) => sum + countWords(scene.narration), 0);
  const totalSeconds = secondsForWords(totalWords);

  const asText = result
    ? [
        result.video_title,
        "",
        ...scenes.map((scene, index) => {
          const seconds = secondsForWords(countWords(scene.narration));
          return `SCENE ${index + 1} — ${scene.title}  [${formatDuration(seconds)}]\n${scene.narration}`;
        }),
      ].join("\n\n")
    : "";

  const handleCopy = () => {
    void copyToClipboard(asText).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      },
      () => setCopied(false)
    );
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
      <div>
        <DocumentInput onDocument={setDoc} disabled={busy} />

        <div className="mt-5">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-400">
            Script length
          </p>
          <div className="flex flex-wrap gap-2">
            {LENGTHS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setLength(option.id)}
                disabled={busy}
                className={`rounded-xl border px-4 py-2.5 text-xs font-medium transition disabled:opacity-50 ${
                  length === option.id
                    ? "border-purple-200 bg-purple-50 text-purple-700"
                    : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                }`}
              >
                {option.label}
                <span className="mt-0.5 block text-[10px] font-normal text-gray-400">
                  {option.hint}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-400">
            Max words per scene
          </p>
          <div className="flex flex-wrap gap-2">
            {SCENE_WORDS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMaxWords(option.value)}
                disabled={busy}
                className={`rounded-full border px-3.5 py-2 text-xs font-medium transition disabled:opacity-50 ${
                  maxWords === option.value
                    ? "border-purple-200 bg-purple-50 text-purple-700"
                    : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <PrimaryButton onClick={run} disabled={!doc || busy}>
            {busy ? "Writing the script…" : "Write the script with AI"}
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
          <EmptyState>
            Reading the document, deciding what to cut, and rewriting it as spoken narration…
          </EmptyState>
        ) : !result ? (
          <EmptyState>
            Upload a document and press the button. The model selects what belongs in a video and
            rewrites it for the ear — this is not your prose read back to you.
          </EmptyState>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <StatTile label="Scenes" value={String(scenes.length)} />
              <StatTile
                label="Runtime"
                value={formatDuration(totalSeconds)}
                sub={`at ${NARRATION_WPM} wpm`}
              />
              <StatTile label="Narration" value={totalWords.toLocaleString()} sub="words" />
            </div>

            <TruncationNotice truncated={result.truncated} />

            {result.video_title ? (
              <div className="mt-4 rounded-2xl border border-purple-100 bg-purple-50/50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-purple-600">
                  Suggested title
                </p>
                <p className="mt-1 text-base font-semibold text-gray-900">{result.video_title}</p>
              </div>
            ) : null}

            <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {scenes.map((scene, index) => {
                const seconds = secondsForWords(countWords(scene.narration));
                return (
                  <div
                    key={`${index}-${scene.title}`}
                    className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-purple-600">
                        Scene {index + 1} · {scene.title}
                      </p>
                      <span className="flex-shrink-0 text-xs tabular-nums text-gray-400">
                        {formatDuration(seconds)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-gray-700">{scene.narration}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <SecondaryButton onClick={handleCopy}>
                {copied ? "Copied" : "Copy script"}
              </SecondaryButton>
              <SecondaryButton
                onClick={() =>
                  downloadText(
                    `${(doc?.fileName ?? "script").replace(/\.[^.]+$/, "")}-video-script.txt`,
                    asText
                  )
                }
              >
                Download .txt
              </SecondaryButton>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-gray-400">
              Read the narration against your document before recording. The model is instructed
              to keep figures and qualifiers exact, but a script is worth checking.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function PdfToVideoScript() {
  return (
    <ToolShell>
      <ToolAuthProvider
        copy={{
          headline: "Sign in to script your document",
          blurb:
            "A language model reads your document, decides what belongs in a video, and rewrites it as spoken narration. That runs on our servers, so it needs an account.",
          bullets: [
            "Selects the argument and drops the appendix",
            "Rewrites written prose into speakable narration",
            "Free account, no card required",
          ],
        }}
      >
        <ScriptWidget />
      </ToolAuthProvider>
    </ToolShell>
  );
}
