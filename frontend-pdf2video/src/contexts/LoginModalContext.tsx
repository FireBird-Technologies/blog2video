import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import LoginModal, { type LoginModalCopy } from "../components/auth/LoginModal";
import type { UserInfo } from "../api/client";

/**
 * Lets any component start the sign-in flow with one call, so CTAs no longer
 * embed provider buttons or duplicate the credential → login → handoff dance.
 *
 * This deployment has no dashboard of its own, so `onSuccess` receives the raw
 * JWT to hand across to blog2video.app rather than navigating locally.
 */
export interface LoginModalOptions extends LoginModalCopy {
  onSuccess: (token: string, user: UserInfo) => void;
}

interface LoginModalContextType {
  openLogin: (options: LoginModalOptions) => void;
  closeLogin: () => void;
}

const LoginModalContext = createContext<LoginModalContextType | null>(null);

const NOOP = () => {};

export function LoginModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<LoginModalOptions | null>(null);

  const openLogin = useCallback((next: LoginModalOptions) => {
    setOptions(next);
    setOpen(true);
  }, []);

  const closeLogin = useCallback(() => setOpen(false), []);

  const handleSuccess = useCallback(
    (token: string, user: UserInfo) => {
      setOpen(false);
      options?.onSuccess(token, user);
    },
    [options]
  );

  return (
    <LoginModalContext.Provider value={{ openLogin, closeLogin }}>
      {children}
      <LoginModal
        open={open}
        onClose={closeLogin}
        onSuccess={options ? handleSuccess : NOOP}
        title={options?.title}
        subtitle={options?.subtitle}
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
