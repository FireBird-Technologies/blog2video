import { useState } from "react";
import ReactDOM from "react-dom";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  warningMessage?: string;
  confirmLabel?: string;
  confirmLoadingLabel?: string;
  iconVariant?: "danger" | "warning";
  onConfirm: () => Promise<void>;
}

export default function ConfirmDeleteModal({
  open,
  onClose,
  title,
  subtitle,
  warningMessage = "This cannot be undone.",
  confirmLabel = "Delete",
  confirmLoadingLabel = "Deleting…",
  iconVariant = "danger",
  onConfirm,
}: Props) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      console.error("Confirm delete failed:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={loading ? undefined : onClose}
        aria-hidden
      />
      <div
        className="relative bg-white border border-gray-200 shadow-2xl rounded-xl max-w-md w-full mx-4 py-6 px-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
      >
        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
            iconVariant === "warning" ? "bg-amber-100" : "bg-red-100"
          }`}>
            <svg
              className={`w-5 h-5 ${iconVariant === "warning" ? "text-amber-600" : "text-red-600"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="confirm-delete-title" className="text-base font-semibold text-gray-900 mb-0.5">
              {title}
            </h3>
            {subtitle && (
              <p className="text-sm text-gray-600 truncate mb-1 max-w-full" title={subtitle}>
                {subtitle}
              </p>
            )}
            <p className="text-sm text-gray-500 mb-4">
              {warningMessage}
            </p>
            <div className="flex gap-3 justify-end">
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
                    {confirmLoadingLabel}
                  </>
                ) : (
                  confirmLabel
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
