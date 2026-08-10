import { useCallback, useRef, useState } from "react";
import {
  DOC_ACCEPT,
  extractPdfText,
  isPdfFile,
  readTextFile,
} from "../../lib/pdfText";

/**
 * The one input every free tool shares: drop a PDF, or paste the text.
 *
 * Extraction happens in this component rather than in each tool so all five
 * behave identically on the awkward cases — a scanned PDF, a 40 MB file, a
 * paste with no document at all — and so the "your file never leaves the
 * browser" promise is made in exactly one place and is true.
 */

const MAX_BYTES = 20 * 1024 * 1024;

export interface DocumentPayload {
  text: string;
  fileName: string | null;
  /** From the PDF page tree; 0 when the source was pasted text. */
  pageCount: number;
}

export default function DocumentInput({
  onDocument,
  label = "Your document",
  hint = "PDF, plain text, or Markdown — or just paste below.",
}: {
  onDocument: (payload: DocumentPayload) => void;
  label?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setError("");

      if (file.size > MAX_BYTES) {
        setError(`${file.name} is larger than 20 MB. Try a smaller file, or paste the text.`);
        return;
      }

      setBusy(true);
      setFileName(file.name);
      try {
        if (isPdfFile(file.name)) {
          const result = await extractPdfText(file);
          if (!result.ok) {
            setError(result.reason ?? "We couldn't read that PDF. Paste the text instead.");
            setBusy(false);
            return;
          }
          setPasted(result.text);
          onDocument({ text: result.text, fileName: file.name, pageCount: result.pageCount });
        } else {
          const text = await readTextFile(file);
          if (!text.trim()) {
            setError("That file looks empty.");
            setBusy(false);
            return;
          }
          setPasted(text);
          onDocument({ text, fileName: file.name, pageCount: 0 });
        }
      } finally {
        setBusy(false);
      }
    },
    [onDocument]
  );

  const handlePaste = (value: string) => {
    setPasted(value);
    setError("");
    setFileName(null);
    onDocument({ text: value, fileName: null, pageCount: 0 });
  };

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
          {label}
        </label>
        <span className="text-[11px] text-gray-400">Runs in your browser — nothing is uploaded</span>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a document"
        className={`relative cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/40 ${
          dragging ? "border-purple-400 bg-purple-50/40" : "border-gray-200 hover:border-purple-300"
        }`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void handleFile(event.dataTransfer.files?.[0]);
        }}
      >
        {busy ? (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-purple-500/30 border-t-purple-500" />
            Reading {fileName}…
          </div>
        ) : (
          <>
            <svg className="mx-auto mb-2 h-8 w-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-sm text-gray-600">
              {fileName ? (
                <span className="font-medium text-purple-700">{fileName}</span>
              ) : (
                <>
                  Drop a file here or <span className="font-medium text-purple-600">browse</span>
                </>
              )}
            </p>
            <p className="mt-1 text-[11px] text-gray-400">{hint}</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={DOC_ACCEPT}
          className="hidden"
          onChange={(event) => {
            void handleFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>

      {error ? (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-600">
          {error}
        </p>
      ) : null}

      <textarea
        value={pasted}
        onChange={(event) => handlePaste(event.target.value)}
        rows={7}
        placeholder="…or paste your text here."
        className="mt-3 w-full resize-y rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm leading-relaxed text-gray-900 placeholder-gray-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500/40"
      />
    </div>
  );
}
