import ReactDOM from "react-dom";

interface Props {
  open: boolean;
  title?: string;
  message: string;
  variant?: "info" | "success";
  onClose: () => void;
}

export default function NoticeModal({ open, title = "Message", message, variant = "info", onClose }: Props) {
  if (!open) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative bg-white border border-gray-200 shadow-2xl rounded-xl max-w-md w-full mx-4 py-6 px-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notice-modal-title"
      >
        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
            variant === "success" ? "bg-green-100" : "bg-purple-100"
          }`}>
            <svg
              className={`w-5 h-5 ${variant === "success" ? "text-green-700" : "text-purple-700"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              {variant === "success" ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
                />
              )}
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="notice-modal-title" className="text-base font-semibold text-gray-900 mb-1">
              {title}
            </h3>
            <p className="text-sm text-gray-600 whitespace-pre-wrap break-words">
              {message}
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors text-white bg-purple-700 hover:bg-purple-800"
          >
            OK
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

