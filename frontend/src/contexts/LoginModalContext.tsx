import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import LoginModal, { type LoginModalCopy } from "../components/auth/LoginModal";

/**
 * Lets any component start the sign-in flow with one call, so CTAs no longer
 * embed provider buttons or duplicate the credential → login → redirect dance.
 *
 * Usage:  const { openLogin } = useLoginModal();
 *         <button onClick={() => openLogin({ title: "Sign in to use this tool" })}>
 */
export interface LoginModalOptions extends LoginModalCopy {
  /**
   * Runs after a successful sign-in. Use it for in-place gates (a tool, the
   * support widget) that should unlock where the user already is. Supplying it
   * also suppresses the default redirect to the dashboard.
   */
  onSuccess?: () => void;
}

interface LoginModalContextType {
  openLogin: (options?: LoginModalOptions) => void;
  closeLogin: () => void;
}

const LoginModalContext = createContext<LoginModalContextType | null>(null);

export function LoginModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<LoginModalOptions>({});

  const openLogin = useCallback((next?: LoginModalOptions) => {
    setOptions(next ?? {});
    setOpen(true);
  }, []);

  const closeLogin = useCallback(() => setOpen(false), []);

  // Always close on success — including when the caller gave no onSuccess and
  // the hook takes its default redirect. Passing `undefined` through in that
  // case left the modal mounted on "Signing you in…" forever, sitting over the
  // dashboard the redirect had already navigated to behind it.
  const handleSuccess = useCallback(() => {
    setOpen(false);
    options.onSuccess?.();
  }, [options]);

  const { onSuccess: _onSuccess, ...copy } = options;

  return (
    <LoginModalContext.Provider value={{ openLogin, closeLogin }}>
      {children}
      <LoginModal
        open={open}
        onClose={closeLogin}
        onSuccess={handleSuccess}
        skipRedirect={Boolean(options.onSuccess)}
        {...copy}
      />
    </LoginModalContext.Provider>
  );
}

export function useLoginModal(): LoginModalContextType {
  const ctx = useContext(LoginModalContext);
  if (!ctx) {
    throw new Error("useLoginModal must be used within LoginModalProvider");
  }
  return ctx;
}
