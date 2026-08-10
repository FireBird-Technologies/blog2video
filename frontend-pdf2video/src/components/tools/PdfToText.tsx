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
  countCharacters,
  countSentences,
  countWords,
  estimatePages,
  formatDuration,
  READING_WPM,
  secondsForWords,
  toParagraphs,
} from "../../lib/docAnalysis";

/**
 * PDF → text.
 *
 * This one is free end to end and stays that way. Extraction, cleanup, copy and
 * download all happen in the browser, and gating any of it would be both
 * pointless (dozens of sites do it) and dishonest (we aren't doing any work).
 *
 * Its job in the funnel is different: it is the widest-intent page we can
 * legitimately own, and the person extracting text from a report is one step
 * away from wanting that report as something watchable. So the upsell is a
 * suggestion sitting next to a finished result, not a wall in front of one.
 */

type Mode = "clean" | "raw" | "markdown";

const MODES: Array<{ id: Mode; label: string; hint: string }> = [
  { id: "clean", label: "Clean prose", hint: "Rejoined paragraphs, layout line-breaks removed." },
  { id: "raw", label: "As extracted", hint: "Exactly what came out of the file." },
  { id: "markdown", label: "Markdown", hint: "Detected headings promoted to ## headings." },
];

export default function PdfToText() {
  const [doc, setDoc] = useState<DocumentPayload>({ text: "", fileName: null, pageCount: 0 });
  const [mode, setMode] = useState<Mode>("clean");
  const [copied, setCopied] = useState(false);

  const { requireAuth, gateModal } = useSignupGate({
    eyebrow: "Free PDF tool",
    headline: "Turn this document into a narrated video",
    blurb:
      "You have the text. The next step is the one nobody wants to do by hand: scripting it, narrating it, and cutting it to visuals.",
    bullets: [
      "Scenes built from the document's own structure",
      "40+ narrator voices and branded templates",
      "Free account, no card required",
    ],
  });

  const output = useMemo(() => {
    if (!doc.text.trim()) return "";
    if (mode === "raw") return doc.text;
    const paragraphs = toParagraphs(doc.text);
    if (mode === "markdown") {
      return paragraphs
        .map((paragraph) => (paragraph.isHeading ? `## ${paragraph.text}` : paragraph.text))
        .join("\n\n");
    }
    return paragraphs
      .filter((paragraph) => !paragraph.isHeading || paragraph.words > 1)
      .map((paragraph) => paragraph.text)
      .join("\n\n");
  }, [doc.text, mode]);

  const words = countWords(doc.text);
  const pages = doc.pageCount || estimatePages(words);
  const baseName = (doc.fileName ?? "document").replace(/\.[^.]+$/, "");

  const handleCopy = () => {
    void copyToClipboard(output).then(
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
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-400">
              Output format
            </p>
            <div className="space-y-2">
              {MODES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setMode(option.id)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    mode === option.id
                      ? "border-purple-200 bg-purple-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <p
                    className={`text-sm font-medium ${
                      mode === option.id ? "text-purple-700" : "text-gray-700"
                    }`}
                  >
                    {option.label}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">{option.hint}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          {!output ? (
            <EmptyState>
              Drop a PDF to pull its text out here. Extraction runs in this tab, so the file never
              touches a server — and there's nothing to sign up for.
            </EmptyState>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2">
                <StatTile label="Words" value={words.toLocaleString()} />
                <StatTile label="Chars" value={countCharacters(doc.text).toLocaleString()} />
                <StatTile label="Pages" value={String(pages)} />
                <StatTile label="Read" value={formatDuration(secondsForWords(words, READING_WPM))} />
              </div>

              <textarea
                readOnly
                value={output}
                rows={14}
                className="mt-4 w-full resize-y rounded-2xl border border-gray-200 bg-gray-50/70 px-4 py-3 font-mono text-xs leading-relaxed text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
              />

              <p className="mt-2 text-xs text-gray-400">
                {countSentences(doc.text).toLocaleString()} sentences ·{" "}
                {toParagraphs(doc.text).length.toLocaleString()} blocks detected
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                <SecondaryButton onClick={handleCopy}>{copied ? "Copied" : "Copy text"}</SecondaryButton>
                <SecondaryButton
                  onClick={() => downloadText(`${baseName}.txt`, output)}
                >
                  Download .txt
                </SecondaryButton>
                <SecondaryButton
                  onClick={() => downloadText(`${baseName}.md`, output, "text/markdown")}
                >
                  Download .md
                </SecondaryButton>
              </div>

              <div className="mt-6 rounded-2xl border border-purple-100 bg-purple-50/60 p-5">
                <p className="text-sm font-semibold text-gray-900">
                  Extracting the text is step one of about six.
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
                  If the reason you pulled this text out is that nobody reads the PDF, the text file
                  won't fix that either. Same document, narrated over its own figures, gets watched.
                </p>
                <div className="mt-4">
                  <PrimaryButton onClick={requireAuth}>Make it a video instead →</PrimaryButton>
                </div>
              </div>
              <GateHint>
                Everything above is free and unlimited, signed in or not. Only rendering a video
                needs an account.
              </GateHint>
            </>
          )}
        </div>
      </div>
      {gateModal}
    </ToolShell>
  );
}
