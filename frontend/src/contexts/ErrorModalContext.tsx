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

/**
 * Shown when the backend is briefly unreachable — most commonly while a new
 * version is being deployed (old container is torn down before the new one is
 * ready) or behind a gateway returning 502/503/504. Friendlier than the raw
 * axios "Network Error" string.
 */
export const MAINTENANCE_MESSAGE =
  "Our system is being updated at the moment. Please try again in a few minutes. We apologise for the inconvenience.";

/**
 * True when the error means "we couldn't reach the server" rather than "the
 * server rejected the request". Covers network errors (no response at all) and
 * gateway statuses that occur during a deploy/rollout.
 */
export function isMaintenanceError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as {
    code?: string;
    message?: string;
    response?: { status?: number };
  };
  const status = e.response?.status;
  if (status === 502 || status === 503 || status === 504) return true;
  // No response means the request never reached a server (connection refused /
  // DNS / container being swapped). Axios reports this as ERR_NETWORK.
  if (!e.response) {
    if (e.code === "ERR_NETWORK") return true;
    if (typeof e.message === "string" && /network error/i.test(e.message)) {
      return true;
    }
  }
  return false;
}

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
    const finalMsg = msg && msg.trim() ? msg : DEFAULT_ERROR_MESSAGE;
    setMessage(finalMsg);
    setShowUpgrade(Boolean(options?.showUpgrade));
    let nextVariant: ErrorModalHeadingVariant =
      options?.variant === "pipeline" || options?.variant === "warning"
        ? options.variant
        : "default";
    if (options?.variant === "maintenance" || finalMsg === MAINTENANCE_MESSAGE) {
      nextVariant = "maintenance";
    }
    setVariant(nextVariant);
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

/** Extract a user-facing error message from an API/axios error or a thrown Error. */
export function getErrorMessage(
  err: unknown,
  fallback = DEFAULT_ERROR_MESSAGE
): string {
  // Server unreachable (e.g. mid-deploy container swap) → friendly notice
  // instead of the raw "Network Error" string.
  if (isMaintenanceError(err)) return MAINTENANCE_MESSAGE;
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
  if (err instanceof Error && err.message.trim()) {
    return err.message;
  }
  return fallback;
}
