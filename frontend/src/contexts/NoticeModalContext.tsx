import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import NoticeModal from "../components/NoticeModal";

interface NoticeOptions {
  title?: string;
  onClose?: () => void;
}

interface NoticeModalContextType {
  showNotice: (message: string, options?: NoticeOptions) => void;
}

const NoticeModalContext = createContext<NoticeModalContextType | null>(null);

export function NoticeModalProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [title, setTitle] = useState<string>("Message");
  const [onCloseAction, setOnCloseAction] = useState<(() => void) | null>(null);

  const showNotice = useCallback((msg: string, options?: NoticeOptions) => {
    setTitle((options?.title || "Message").trim() || "Message");
    setMessage((msg || "").trim() || "Done.");
    setOnCloseAction(() => options?.onClose ?? null);
  }, []);

  const close = useCallback(() => {
    setMessage(null);
    setTitle("Message");
    const fn = onCloseAction;
    setOnCloseAction(null);
    try {
      fn?.();
    } catch {
      // No-op: modal close should not crash UI.
    }
  }, [onCloseAction]);

  return (
    <NoticeModalContext.Provider value={{ showNotice }}>
      {children}
      <NoticeModal open={message != null} title={title} message={message ?? ""} onClose={close} />
    </NoticeModalContext.Provider>
  );
}

export function useNoticeModal(): NoticeModalContextType {
  const ctx = useContext(NoticeModalContext);
  if (!ctx) {
    throw new Error("useNoticeModal must be used within NoticeModalProvider");
  }
  return ctx;
}

