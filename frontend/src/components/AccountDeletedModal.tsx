import ReactDOM from "react-dom";

interface AccountDeletedModalProps {
  open: boolean;
  onClose: () => void;
  onReactivate: () => void;
  reactivating?: boolean;
}

export default function AccountDeletedModal({
  open,
  onClose,
  onReactivate,
  reactivating = false,
}: AccountDeletedModalProps) {
  if (!open) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={reactivating ? undefined : onClose}
        aria-hidden
      />
      <div
        className="relative bg-white border border-gray-200 shadow-2xl rounded-xl max-w-md w-full mx-4 py-6 px-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-deleted-title"
      >
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-amber-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="account-deleted-title" className="text-base font-semibold text-gray-900 mb-0.5">
              Account was previously deleted
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Your account was deleted previously. Logging in again would reactivate your account as a free user.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={reactivating}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 hover:border-gray-400 rounded-lg transition-colors disabled:opacity-60 disabled:pointer-events-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onReactivate}
                disabled={reactivating}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-60 disabled:pointer-events-none flex items-center gap-2 min-w-[100px] justify-center shadow-sm"
              >
                {reactivating ? (
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
                    Reactivating…
                  </>
                ) : (
                  "Reactivate account"
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
