import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";

interface Props {
  open: boolean;
  projectName?: string | null;
  onClose: () => void;
  onConfirm: (instruction: string) => Promise<void> | void;
  /** Pre-fill the textarea (e.g. when re-running a paused regeneration with the prior instruction). */
  initialInstruction?: string;
  /** Override the confirm button label (defaults to "Confirm"). */
  confirmLabel?: string;
}

const MAX_FILE_BYTES = 25 * 1024; // 25 KB
const MAX_INSTRUCTION_CHARS = 25_000;

// Two-step modal:
//  Step 1: capture textarea + optional .txt/.md upload (read client-side and
//          appended to the textarea so the user can edit before submit).
//  Step 2: warning + confirm. Confirm runs the regen API call; close on success.
//
// Layout: a single flex column capped at the *dynamic* viewport height (dvh, so
// the mobile address bar can't push the footer off-screen). Header and footer
// are fixed; only the middle body scrolls. Width fills small screens and steps
// up on larger ones.
export default function RegenerateScriptModal({
  open,
  projectName,
  onClose,
  onConfirm,
  initialInstruction = "",
  confirmLabel = "Confirm",
}: Props) {
  const [step, setStep] = useState<"input" | "warning">("input");
  const [instruction, setInstruction] = useState(initialInstruction);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Out-of-context rejections (HTTP 422) are shown as plain red text (no box); other errors keep the box.
  const [submitErrorIsRejection, setSubmitErrorIsRejection] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      // Seed the textarea with the prior instruction (if any) each time the modal opens.
      setInstruction(initialInstruction);
      setStep("input");
      setFileError(null);
      setSubmitError(null);
      setSubmitErrorIsRejection(false);
      setSubmitting(false);
    } else {
      const timer = window.setTimeout(() => {
        setStep("input");
        setInstruction(initialInstruction);
        setFileError(null);
        setSubmitError(null);
        setSubmitErrorIsRejection(false);
        setSubmitting(false);
      }, 200);
      return () => window.clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    handleFile(e.dataTransfer.files?.[0]);
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onConfirm(instruction.trim());
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string }; status?: number }; message?: string };
      setSubmitErrorIsRejection(e?.response?.status === 422);
      setSubmitError(
        e?.response?.data?.detail ||
          e?.message ||
          "Failed to start regeneration. Please try again.",
      );
      setSubmitting(false);
    }
  };

  const trimmed = instruction.trim();
  const canRegenerate = trimmed.length > 0 && !submitting;

  const closeButton = (
    <button
      type="button"
      onClick={submitting ? undefined : onClose}
      disabled={submitting}
      className="-mr-1 flex-shrink-0 text-gray-400 hover:text-gray-600 p-1 rounded-lg transition-colors disabled:opacity-50"
      aria-label="Close"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100] overflow-hidden flex items-center justify-center p-3 sm:p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={submitting ? undefined : onClose}
        aria-hidden
      />

      <div
        className="relative w-full min-w-0 max-w-md sm:max-w-lg md:max-w-xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh] flex flex-col overflow-hidden bg-white rounded-2xl shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        {step === "input" && (
          <>
            {/* Header */}
            <header className="flex items-start justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex-shrink-0">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-gray-900">Regenerate Script</h3>
                {projectName && (
                  <p className="text-xs text-gray-500 truncate mt-0.5">{projectName}</p>
                )}
              </div>
              {closeButton}
            </header>

            {/* Scrollable body */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 flex flex-col gap-4">
              <p className="text-sm text-gray-600">
                Tell us what to change. Be specific about tone, focus, sections to add or remove.
              </p>

              <div>
                <textarea
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value.slice(0, MAX_INSTRUCTION_CHARS))}
                  placeholder={`e.g. "Make the opening scene a stronger hook", "Build tension gradually and end with a clear call to action", "Make every scene flow into the next", "Rewrite the middle scenes -- they lose momentum", "Make each scene shorter and punchier", "Make the tone confident and direct throughout", "Remove all jargon and simplify the language", "Keep the first scene but rewrite the rest", "Make the ending scene land harder", "Make the whole script more conversational"`}
                  rows={12}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none min-h-[96px] sm:min-h-[160px]"
                />
                <div className="mt-1 text-[11px] text-gray-400 text-right">
                  {instruction.length.toLocaleString()} / {MAX_INSTRUCTION_CHARS.toLocaleString()} chars
                </div>
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
                className="border-2 border-dashed border-gray-200 rounded-lg p-3 text-center text-xs text-gray-500 cursor-pointer hover:border-purple-300 hover:bg-purple-50/40 transition-colors"
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
              {fileError && <p className="text-xs text-red-600 -mt-1">{fileError}</p>}
            </div>

            {/* Footer */}
            <footer className="flex justify-end gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 flex-shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => canRegenerate && setStep("warning")}
                disabled={!canRegenerate}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={trimmed.length === 0 ? "Add instructions before regenerating" : undefined}
              >
                Regenerate
              </button>
            </footer>
          </>
        )}

        {step === "warning" && (
          <>
            {/* Header */}
            <header className="flex items-start justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-gray-900">Regenerate Script?</h3>
                  {projectName && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">{projectName}</p>
                  )}
                </div>
              </div>
              {closeButton}
            </header>

            {/* Scrollable body */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 flex flex-col gap-3">
              <p className="text-sm text-gray-700">
                This will completely regenerate the script — your current version will be replaced.
              </p>
              <p className="text-sm text-amber-700 font-medium">This counts as one video credit.</p>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-32 overflow-y-auto">
                <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">
                  Your instructions
                </p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{trimmed}</p>
              </div>

              {submitError && (
                submitErrorIsRejection ? (
                  <p className="text-sm text-red-600 break-words">{submitError}</p>
                ) : (
                  <div className="p-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg break-words">
                    {submitError}
                  </div>
                )
              )}
            </div>

            {/* Footer */}
            <footer className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 flex-shrink-0">
              <button
                type="button"
                onClick={() => setStep("input")}
                disabled={submitting}
                className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-60"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={submitting}
                className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors disabled:opacity-60"
              >
                {submitting ? "Starting..." : confirmLabel}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
