import { useMemo, useState } from "react";
import DocumentInput, { type DocumentPayload } from "./DocumentInput";
import { ToolAuthProvider } from "./LoginGate";
import {
  EmptyState,
  SecondaryButton,
  StatTile,
  ToolShell,
  copyToClipboard,
  downloadText,
} from "./shared";
import { countSentences, estimatePages, formatDuration, READING_WPM, secondsForWords } from "../../lib/docAnalysis";

/**
 * PDF → text, extracted server-side.
 *
 * This is the one tool here with no model in it, and that is correct — the work
 * is extraction, and the honest upgrade is that it now runs the same parser the
 * video pipeline uses (app/services/doc_extractor.py, pdfplumber plus real
 * table handling) rather than a browser reimplementation that could not read
 * DOCX or PPTX at all.
 *
 * It is still login-gated, because it hits the same authenticated endpoint as
 * everything else here.
 */

type Mode = "markdown" | "plain";

const MODES: Array<{ id: Mode; label: string; hint: string }> = [
  { id: "markdown", label: "Markdown", hint: "Headings and tables preserved, as extracted." },
  { id: "plain", label: "Plain text", hint: "Markdown syntax stripped out." },
];

/** The extractor emits markdown; this is the cheap inverse for plain output. */
function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\|.*\|\s*$/gm, (row) =>
      row.split("|").map((cell) => cell.trim()).filter(Boolean).join("  ")
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function TextWidget() {
  const [doc, setDoc] = useState<DocumentPayload | null>(null);
  const [mode, setMode] = useState<Mode>("markdown");
  const [copied, setCopied] = useState(false);

  const output = useMemo(() => {
    if (!doc) return "";
    return mode === "plain" ? stripMarkdown(doc.text) : doc.text;
  }, [doc, mode]);

  const baseName = (doc?.fileName ?? "document").replace(/\.[^.]+$/, "");

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
    <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
      <div>
        <DocumentInput onDocument={setDoc} />

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

        <p className="mt-5 text-xs leading-relaxed text-gray-400">
          Extraction runs the same parser our video pipeline uses, so tables come through as
          Markdown tables and Word and PowerPoint files work as well as PDFs.
        </p>
      </div>

      <div>
        {!output ? (
          <EmptyState>
            Upload a document to pull its text out — including tables, and including DOCX and
            PPTX, not just PDF.
          </EmptyState>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2">
              <StatTile label="Words" value={(doc?.words ?? 0).toLocaleString()} />
              <StatTile label="Chars" value={(doc?.characters ?? 0).toLocaleString()} />
              <StatTile label="Pages" value={String(estimatePages(doc?.words ?? 0))} sub="est." />
              <StatTile
                label="Read"
                value={formatDuration(secondsForWords(doc?.words ?? 0, READING_WPM))}
              />
            </div>

            <textarea
              readOnly
              value={output}
              rows={16}
              className="mt-4 w-full resize-y rounded-2xl border border-gray-200 bg-gray-50/70 px-4 py-3 font-mono text-xs leading-relaxed text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
            />

            <p className="mt-2 text-xs text-gray-400">
              {countSentences(output).toLocaleString()} sentences
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <SecondaryButton onClick={handleCopy}>
                {copied ? "Copied" : "Copy text"}
              </SecondaryButton>
              <SecondaryButton
                onClick={() =>
                  downloadText(
                    `${baseName}.${mode === "markdown" ? "md" : "txt"}`,
                    output,
                    mode === "markdown" ? "text/markdown" : "text/plain"
                  )
                }
              >
                Download .{mode === "markdown" ? "md" : "txt"}
              </SecondaryButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function PdfToText() {
  return (
    <ToolShell>
      <ToolAuthProvider
        copy={{
          headline: "Sign in to extract your document",
          blurb:
            "Extraction runs the same parser our video pipeline uses — real table handling, and DOCX and PPTX as well as PDF. It runs on our servers.",
          bullets: [
            "Tables come out as tables, not scrambled text",
            "PDF, Word, PowerPoint, Markdown, text, VTT",
            "Free account, no card required",
          ],
        }}
      >
        <TextWidget />
      </ToolAuthProvider>
    </ToolShell>
  );
}
