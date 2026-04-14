import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import ErrorModal, { type ErrorModalHeadingVariant } from "../components/ErrorModal";

export const DEFAULT_ERROR_MESSAGE =
  "We got an unexpected error, please try again or contact support.";

export type ErrorModalVariant = ErrorModalHeadingVariant;

interface ErrorOptions {
  showUpgrade?: boolean;
  /** Generation pipeline failures (scrape/script/scene) use a softer “Oops” heading. */
  variant?: ErrorModalHeadingVariant;
}

interface ErrorModalContextType {
  showError: (message: string, options?: ErrorOptions) => void;
}

const ErrorModalContext = createContext<ErrorModalContextType | null>(null);

export function ErrorModalProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [variant, setVariant] = useState<ErrorModalHeadingVariant>("default");

  const showError = useCallback((msg: string, options?: ErrorOptions) => {
    setMessage(msg && msg.trim() ? msg : DEFAULT_ERROR_MESSAGE);
    setShowUpgrade(Boolean(options?.showUpgrade));
    setVariant(options?.variant === "pipeline" ? "pipeline" : "default");
  }, []);

  const close = useCallback(() => {
    setMessage(null);
    setShowUpgrade(false);
    setVariant("default");
  }, []);

  return (
    <ErrorModalContext.Provider value={{ showError }}>
      {children}
      <ErrorModal
        open={message != null}
        message={message ?? ""}
        variant={variant}
        showUpgrade={showUpgrade}
        onClose={close}
      />
    </ErrorModalContext.Provider>
  );
}

export function useErrorModal(): ErrorModalContextType {
  const ctx = useContext(ErrorModalContext);
  if (!ctx) {
    throw new Error("useErrorModal must be used within ErrorModalProvider");
  }
  return ctx;
}

/** Extract a user-facing error message from an API/axios error. */
export function getErrorMessage(
  err: unknown,
  fallback = DEFAULT_ERROR_MESSAGE
): string {
  if (err && typeof err === "object" && "response" in err) {
    const res = (err as { response?: { data?: { detail?: string | { message?: string } } } }).response;
    const detail = res?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (
      detail &&
      typeof detail === "object" &&
      "message" in detail &&
      typeof detail.message === "string" &&
      detail.message.trim()
    ) {
      return detail.message;
    }
  }
  return fallback;
}
