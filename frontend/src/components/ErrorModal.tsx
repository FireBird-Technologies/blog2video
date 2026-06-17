import ReactDOM from "react-dom";

export type ErrorModalHeadingVariant = "default" | "pipeline" | "maintenance";

interface Props {
  open: boolean;
  message: string;
  variant?: ErrorModalHeadingVariant;
  showUpgrade?: boolean;
  onClose: () => void;
}

const PIPELINE_HEADING = "Oops 😢";
const MAINTENANCE_HEADING = "We're updating right now";

export default function ErrorModal({
  open,
  message,
  variant = "default",
  showUpgrade,
  onClose,
}: Props) {
  if (!open) return null;

  const isMaintenance = variant === "maintenance";
  const isSoft = variant === "pipeline" || showUpgrade;
  const iconBgClass = isMaintenance
    ? "bg-blue-100"
    : isSoft
      ? "bg-amber-100"
      : "bg-red-100";
  const iconColorClass = isMaintenance
    ? "text-blue-600"
    : isSoft
      ? "text-amber-700"
      : "text-red-600";
  const heading = isMaintenance
    ? MAINTENANCE_HEADING
    : isSoft
      ? PIPELINE_HEADING
      : "Error";

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative bg-white border border-gray-200 shadow-2xl rounded-xl max-w-md w-full mx-4 py-6 px-6"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="error-modal-title"
      >
        <div className="flex items-start gap-4">
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${iconBgClass}`}
          >
            <svg
              className={`w-5 h-5 ${iconColorClass}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              {isMaintenance ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              )}
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="error-modal-title" className="text-base font-semibold text-gray-900 mb-1">
              {heading}
            </h3>
            <p className="text-sm text-gray-600 whitespace-pre-wrap break-words">
              {message}
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          {showUpgrade && (
            <button
              type="button"
              onClick={() => {
                onClose();
                window.location.href = "/pricing";
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-700 hover:bg-purple-800 rounded-lg transition-colors"
            >
              Upgrade plan
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              showUpgrade
                ? "text-gray-700 bg-gray-100 hover:bg-gray-200"
                : "text-white bg-purple-700 hover:bg-purple-800"
            }`}
          >
            OK
          </button>
        </div>
        {showUpgrade && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex justify-center">
            <a
              href="/invite-others"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-200 text-xs font-medium text-purple-700 hover:bg-purple-100 hover:border-purple-400 transition-all relative"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" />
                <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
              </svg>
              Share B2V to get 5 videos free
            </a>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
