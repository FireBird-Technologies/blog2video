import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";

interface Props {
  open: boolean;
  projectName?: string | null;
  onClose: () => void;
  onConfirm: (instruction: string) => Promise<void> | void;
}

const MAX_FILE_BYTES = 25 * 1024; // 25 KB
const MAX_INSTRUCTION_CHARS = 25_000;

// Two-step modal:
//  Step 1: capture textarea + optional .txt/.md upload (read client-side and
//          appended to the textarea so the user can edit before submit).
//  Step 2: warning + confirm. Confirm runs the regen API call; close on success.
export default function RegenerateScriptModal({
  open,
  projectName,
  onClose,
  onConfirm,
}: Props) {
  const [step, setStep] = useState<"input" | "warning">("input");
  const [instruction, setInstruction] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      // reset state after the modal closes so a re-open starts fresh
      const timer = window.setTimeout(() => {
        setStep("input");
        setInstruction("");
        setFileError(null);
        setSubmitError(null);
        setSubmitting(false);
      }, 200);
      return () => window.clearTimeout(timer);
    }
  }, [open]);

  if (!open) return null;

  const handleFile = (file: File | null | undefined) => {
    setFileError(null);
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith(".txt") && !name.endsWith(".md") && !name.endsWith(".markdown")) {
      setFileError("Only .txt or .md files are supported.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileError("File is too large (25 KB max).");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string) || "";
      if (!text.trim()) {
        setFileError("File is empty.");
        return;
      }
      setInstruction((prev) => {
        const header = `\n\n--- From ${file.name} ---\n`;
        const combined = (prev || "").trimEnd() + (prev ? header : header.trimStart()) + text.trim() + "\n";
        return combined.slice(0, MAX_INSTRUCTION_CHARS);
      });
    };
    reader.onerror = () => setFileError("Could not read the file. Please try again.");
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dropZoneRef.current?.classList.remove("border-purple-400");
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onConfirm(instruction.trim());
      onClose();
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { detail?: string } };
        message?: string;
      };
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Failed to start regeneration. Please try again.";
      setSubmitError(detail);
      setSubmitting(false);
    }
  };

  const trimmed = instruction.trim();
  const canRegenerate = trimmed.length > 0 && !submitting;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={submitting ? undefined : onClose}
        aria-hidden
      />
      <div
        className="relative bg-white border border-gray-200 shadow-2xl rounded-xl max-w-xl w-full mx-4 p-6"
        role="dialog"
        aria-modal="true"
      >
        <button
          onClick={submitting ? undefined : onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {step === "input" && (
          <>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              Regenerate Script
            </h3>
            {projectName && (
              <p className="text-sm text-gray-500 mb-4">{projectName}</p>
            )}
            <p className="text-sm text-gray-600 mb-4">
              Tell us what to change. Be specific about tone, focus, sections to add or remove.
              You can also upload a .txt or .md file — its contents will be appended below.
            </p>

            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value.slice(0, MAX_INSTRUCTION_CHARS))}
              placeholder="e.g. Make the tone more conversational. Add a section about pricing. Avoid mentioning specific competitors."
              rows={7}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y"
            />
            <div className="mt-1 text-[11px] text-gray-400 text-right">
              {instruction.length.toLocaleString()} / {MAX_INSTRUCTION_CHARS.toLocaleString()} chars
            </div>

            <div
              ref={dropZoneRef}
              onDragOver={(e) => {
                e.preventDefault();
                dropZoneRef.current?.classList.add("border-purple-400");
              }}
              onDragLeave={() => dropZoneRef.current?.classList.remove("border-purple-400")}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 border-2 border-dashed border-gray-200 rounded-lg p-4 text-center text-xs text-gray-500 cursor-pointer hover:border-purple-300 hover:bg-purple-50/40 transition-colors"
            >
              <svg className="w-5 h-5 mx-auto mb-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.9 5 5 0 119.66-2.1A4 4 0 0117 16h-1m-4-4v8m0 0l-3-3m3 3l3-3" />
              </svg>
              Drop a <span className="font-medium">.txt</span> or{" "}
              <span className="font-medium">.md</span> file here, or click to browse
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.markdown,text/plain,text/markdown"
                className="hidden"
                onChange={(e) => {
                  handleFile(e.target.files?.[0]);
                  if (e.target) e.target.value = "";
                }}
              />
            </div>
            {fileError && (
              <p className="mt-2 text-xs text-red-600">{fileError}</p>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => canRegenerate && setStep("warning")}
                disabled={!canRegenerate}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  trimmed.length === 0
                    ? "Add instructions before regenerating"
                    : undefined
                }
              >
                Regenerate
              </button>
            </div>
          </>
        )}

        {step === "warning" && (
          <>
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Regenerate Script?</h3>
                {projectName && (
                  <p className="text-sm text-gray-500">{projectName}</p>
                )}
              </div>
            </div>

            <p className="text-sm text-gray-700 mb-3">
              This will completely regenerate the script — Your current version will be replaced.
            </p>
            <p className="text-sm text-amber-700 mb-4 font-medium">
              This counts as one video credit.
            </p>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 max-h-32 overflow-y-auto">
              <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">
                Your instructions
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{trimmed}</p>
            </div>

            {submitError && (
              <div className="mb-4 p-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg">
                {submitError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setStep("input")}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-60"
              >
                Back
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-60"
              >
                {submitting ? "Starting..." : "Confirm"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
