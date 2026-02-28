import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import ErrorModal from "../components/ErrorModal";

export const DEFAULT_ERROR_MESSAGE =
  "We got an unexpected error, please try again or contact support.";

interface ErrorModalContextType {
  showError: (message: string) => void;
}

const ErrorModalContext = createContext<ErrorModalContextType | null>(null);

export function ErrorModalProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);

  const showError = useCallback((msg: string) => {
    setMessage(msg && msg.trim() ? msg : DEFAULT_ERROR_MESSAGE);
  }, []);

  const close = useCallback(() => setMessage(null), []);

  return (
    <ErrorModalContext.Provider value={{ showError }}>
      {children}
      <ErrorModal open={message != null} message={message ?? ""} onClose={close} />
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
    const res = (err as { response?: { data?: { detail?: string } } }).response;
    const detail = res?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  return fallback;
}
