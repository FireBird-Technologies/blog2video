import { useState } from "react";
import ReactDOM from "react-dom";

interface Props {
  open: boolean;
  onClose: () => void;
  projectName?: string;
  onConfirm: () => Promise<void>;
}

export default function DeleteProjectModal({
  open,
  onClose,
  projectName,
  onConfirm,
}: Props) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      console.error("Failed to delete project:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={loading ? undefined : onClose}
        aria-hidden
      />
      <div
        className="relative bg-white border border-gray-200 shadow-2xl rounded-lg max-w-lg w-full mx-4 py-5 px-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-60"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="flex flex-col items-center text-center pr-8">
            <h3 id="delete-dialog-title" className="text-base font-semibold text-gray-900 mb-0.5">
              Delete this project?
            </h3>
            {projectName && (
              <p className="text-sm text-gray-600 truncate mb-1 max-w-full" title={projectName}>
                {projectName}
              </p>
            )}
            <p className="text-sm text-gray-500 mb-4">
              This cannot be undone.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 hover:border-gray-400 rounded-lg transition-colors disabled:opacity-60 disabled:pointer-events-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-[#e53935] hover:bg-[#c62828] rounded-lg transition-colors disabled:opacity-60 disabled:pointer-events-none flex items-center gap-2 min-w-[80px] justify-center shadow-sm"
                id="delete-confirm-btn"
              >
                {loading ? (
                  <>
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Deleting…
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
