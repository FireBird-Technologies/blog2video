import { useState } from "react";
import DocumentInput, { type DocumentPayload } from "./DocumentInput";
import { RequireLogin } from "./LoginGate";
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
  summarizeDocument,
  toolErrorMessage,
  type PdfSummary,
  type SummaryLength,
} from "../../api/pdfTools";

/**
 * PDF summarizer — abstractive, model-written, login-gated.
 *
 * The model is instructed to preserve hedging and copy figures exactly (see
 * backend app/dspy_modules/pdf_tool_gen.py), because the failure that matters
 * for a document summary is not a clumsy sentence, it is a confident one the
 * source never supported. The UI says the output should be checked rather than
 * implying it is authoritative.
 */

const LENGTHS: Array<{ id: SummaryLength; label: string }> = [
  { id: "brief", label: "Brief" },
  { id: "standard", label: "Standard" },
  { id: "detailed", label: "Detailed" },
];

function SummarizerWidget() {
  const [doc, setDoc] = useState<DocumentPayload | null>(null);
  const [length, setLength] = useState<SummaryLength>("standard");
  const [result, setResult] = useState<PdfSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const run = async () => {
    if (!doc) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await summarizeDocument(doc.text, length));
    } catch (err) {
      setError(await toolErrorMessage(err, "Summarising failed. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const asText = result
    ? [result.summary, "", ...result.key_points.map((p) => `• ${p}`)].join("\n")
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
            Summary depth
          </p>
          <div className="flex flex-wrap gap-2">
            {LENGTHS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setLength(option.id)}
                disabled={busy}
                className={`rounded-full border px-4 py-2 text-xs font-medium transition disabled:opacity-50 ${
                  length === option.id
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
            {busy ? "Summarising…" : "Summarise with AI"}
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
          <EmptyState>Reading the document and writing the summary…</EmptyState>
        ) : !result ? (
          <EmptyState>
            Upload a document and press Summarise. The model reads the whole thing and writes a
            plain-language summary, leading with the main finding.
          </EmptyState>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <StatTile label="Source" value={(doc?.words ?? 0).toLocaleString()} sub="words in" />
              <StatTile
                label="Summary"
                value={result.summary.split(/\s+/).filter(Boolean).length.toLocaleString()}
                sub="words out"
              />
              <StatTile label="Key points" value={String(result.key_points.length)} />
            </div>

            <TruncationNotice truncated={result.truncated} />

            <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-sm leading-relaxed text-gray-700">{result.summary}</p>
            </div>

            {result.key_points.length > 0 ? (
              <div className="mt-3 space-y-2">
                {result.key_points.map((point) => (
                  <div
                    key={point}
                    className="flex gap-3 rounded-xl border border-gray-200 bg-gray-50/70 p-3.5"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-purple-500" />
                    <p className="text-sm leading-relaxed text-gray-700">{point}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {result.key_terms.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {result.key_terms.map((term) => (
                  <span
                    key={term}
                    className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600"
                  >
                    {term}
                  </span>
                ))}
              </div>
            ) : null}

            <p className="mt-4 text-xs leading-relaxed text-gray-400">
              Written by a model from your document. It is instructed to keep every figure and
              qualifier exactly as written — check the numbers before you rely on them.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <SecondaryButton onClick={handleCopy}>
                {copied ? "Copied" : "Copy summary"}
              </SecondaryButton>
              <SecondaryButton
                onClick={() =>
                  downloadText(
                    `${(doc?.fileName ?? "document").replace(/\.[^.]+$/, "")}-summary.txt`,
                    asText
                  )
                }
              >
                Download .txt
              </SecondaryButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function PdfSummarizer() {
  return (
    <ToolShell>
      <RequireLogin
        copy={{
          headline: "Sign in to summarise your document",
          blurb:
            "The summary is written by a language model reading your actual document, which runs on our servers. A free account covers it.",
          bullets: [
            "Reads the full document, not the first page",
            "Plain-language summary plus discrete key points",
            "Free account, no card required",
          ],
        }}
      >
        <SummarizerWidget />
      </RequireLogin>
    </ToolShell>
  );
}
