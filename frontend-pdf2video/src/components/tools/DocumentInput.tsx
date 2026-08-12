import { useCallback, useEffect, useRef, useState } from "react";
import { extractDocument, toolErrorMessage, type ExtractedDocument } from "../../api/pdfTools";
import { useToolAuth } from "./LoginGate";

/**
 * The upload step every PDF tool shares.
 *
 * Extraction runs on the server (POST /api/free-tools/extract-document) using
 * the same parser the main video pipeline uses, so these tools see exactly what
 * a real project would — including tables, DOCX, and PPTX, none of which a
 * browser-side parser handles well.
 *
 * It is a separate request from the generation that follows. A scanned PDF or
 * an unsupported format fails here, in a second, with a message that says what
 * to do — instead of failing inside a longer AI call.
 *
 * This is also where sign-in is demanded, because it is the first thing that
 * touches the backend. A signed-out visitor sees the whole tool and drops their
 * file normally; the modal comes up, and on success the very same File is
 * extracted without asking for it again (see `resumeWithFile`). Only a *click*
 * to browse cannot be fully resumed — there is no file yet, and re-opening the
 * OS picker after an OAuth popup is not reliably allowed — so we unlock the
 * zone and say so instead of opening a picker that may never appear.
 */

const ACCEPT = ".pdf,.docx,.pptx,.txt,.md,.markdown,.vtt";
const MAX_BYTES = 25 * 1024 * 1024;

export interface DocumentPayload extends ExtractedDocument {
  fileName: string;
}

export default function DocumentInput({
  onDocument,
  disabled,
}: {
  onDocument: (payload: DocumentPayload | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState<DocumentPayload | null>(null);
  const [dragging, setDragging] = useState(false);
  const [justUnlocked, setJustUnlocked] = useState(false);
  const { signedIn, loading: authLoading, requireAuth } = useToolAuth();

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file || disabled) return;
      setError("");

      if (file.size > MAX_BYTES) {
        setError(`${file.name} is larger than 25 MB.`);
        return;
      }

      setBusy(true);
      setLoaded(null);
      onDocument(null);
      try {
        const extracted = await extractDocument(file);
        const payload = { ...extracted, fileName: file.name };
        setLoaded(payload);
        onDocument(payload);
      } catch (err) {
        setError(await toolErrorMessage(err, "We couldn't read that file. Try another."));
      } finally {
        setBusy(false);
      }
    },
    [disabled, onDocument]
  );

  /**
   * The sign-in modal resumes work through a callback captured at drop time.
   * Reading `handleFile` off a ref keeps that callback pointed at the current
   * one — a stale closure could carry `disabled: true` from the moment of the
   * drop and swallow the file silently.
   */
  const handleFileRef = useRef(handleFile);
  useEffect(() => {
    handleFileRef.current = handleFile;
  }, [handleFile]);

  const resumeWithFile = useCallback((file: File) => {
    void handleFileRef.current(file);
  }, []);

  /**
   * Click / Enter on the zone: sign in first, then let them pick a file.
   *
   * After sign-in we do try to re-open the picker, but a browser may refuse a
   * programmatic file dialog once the OAuth popup has eaten the user gesture —
   * hence `justUnlocked`, which leaves a visible "choose your file" state
   * rather than a dead zone if the dialog never appears.
   */
  const openPicker = useCallback(() => {
    if (disabled) return;
    const ran = requireAuth(() => {
      setJustUnlocked(true);
      inputRef.current?.click();
    });
    if (ran) inputRef.current?.click();
  }, [disabled, requireAuth]);

  const acceptDropped = useCallback(
    (file: File | undefined) => {
      if (!file || disabled) return;
      requireAuth(() => resumeWithFile(file), { pendingFile: true });
    },
    [disabled, requireAuth, resumeWithFile]
  );

  // Clear the "signed in, now pick a file" nudge once they act on it.
  useEffect(() => {
    if (busy || loaded) setJustUnlocked(false);
  }, [busy, loaded]);

  const clear = () => {
    setLoaded(null);
    setError("");
    onDocument(null);
  };

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
          Your document
        </label>
        <span className="text-[11px] text-gray-400">PDF, Word, PowerPoint, text · 25 MB</span>
      </div>

      {loaded ? (
        <div className="flex items-center gap-3 rounded-xl border border-purple-100 bg-purple-50/50 px-4 py-3">
          <svg className="h-6 w-6 flex-shrink-0 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
              clipRule="evenodd"
            />
          </svg>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">{loaded.fileName}</p>
            <p className="text-xs text-gray-500">
              {loaded.words.toLocaleString()} words extracted
            </p>
          </div>
          <button
            type="button"
            onClick={clear}
            disabled={disabled}
            className="flex-shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-gray-300 disabled:opacity-40"
          >
            Replace
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload a document"
          aria-disabled={disabled}
          className={`relative rounded-xl border-2 border-dashed p-7 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/40 ${
            disabled
              ? "cursor-not-allowed border-gray-200 opacity-50"
              : dragging
                ? "cursor-pointer border-purple-400 bg-purple-50/40"
                : justUnlocked
                  ? "cursor-pointer border-purple-300 bg-purple-50/30"
                  : "cursor-pointer border-gray-200 hover:border-purple-300"
          }`}
          onClick={openPicker}
          onKeyDown={(event) => {
            if (disabled) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openPicker();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            acceptDropped(event.dataTransfer.files?.[0]);
          }}
        >
          {busy ? (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-purple-500/30 border-t-purple-500" />
              Reading your document…
            </div>
          ) : (
            <>
              <svg
                className="mx-auto mb-2 h-8 w-8 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="text-sm text-gray-600">
                Drop a file here or <span className="font-medium text-purple-600">browse</span>
              </p>
              <p className="mt-1 text-[11px] text-gray-400">
                Text-based documents. A scanned PDF has no text layer and needs OCR first.
              </p>
              {justUnlocked ? (
                <p className="mt-1 text-[11px] font-medium text-purple-600">
                  You&apos;re signed in — choose your file to continue.
                </p>
              ) : !signedIn && !authLoading ? (
                // Held back until the stored session has resolved, so a
                // returning user never sees a sign-in prompt flash.
                <p className="mt-1 text-[11px] text-gray-400">
                  Free Google sign-in on the next step, then your file is processed right away.
                </p>
              ) : null}
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(event) => {
              void handleFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>
      )}

      {error ? (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
