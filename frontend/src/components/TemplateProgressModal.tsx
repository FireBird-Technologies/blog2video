/**
 * Re-openable progress view for a template that is generating in the background.
 *
 * Reached by clicking a generating card, after the creator modal was closed. It
 * is deliberately NOT the creator remounted: that component owns the whole
 * wizard (extraction results, scraped logos/OG image, the step it was on), all
 * of which is gone once it unmounts — reopening it would show an empty form
 * offering to create a second template.
 *
 * Everything here is derived from `templateId` alone, so it can be opened,
 * closed and reopened any number of times with no state to carry.
 */
import ReactDOM from "react-dom";
import { useEffect } from "react";
import TemplateGenerationProgress, { useGenerationStatus } from "./TemplateGenerationProgress";

interface Props {
  templateId: number;
  name: string;
  onClose: () => void;
  /** Fired once the run reaches a terminal state, so the parent can refresh the
   *  list — the card behind this modal must not keep showing the step rail. */
  onFinished?: () => void;
}

export default function TemplateProgressModal({ templateId, name, onClose, onFinished }: Props) {
  const status = useGenerationStatus(templateId, true);

  // Close on completion rather than leaving a finished rail on screen. "unknown"
  // is NOT terminal: the backend reports it for a template whose run row has
  // aged out, and treating it as done would shut the modal on a live run.
  const finished = status?.status === "complete" || status?.status === "error";
  useEffect(() => {
    if (!finished) return;
    onFinished?.();
    onClose();
    // onClose/onFinished are parent callbacks and not stable across renders;
    // including them would re-run this on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 truncate pr-4">{name}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-4 sm:px-6 pt-6 pb-5 flex flex-col items-center gap-3">
          <TemplateGenerationProgress status={status} variant="modal" />
          <p className="text-[11px] sm:text-xs text-center" style={{ color: "#9CA3AF" }}>
            You can close this — the template will keep generating in the background.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
