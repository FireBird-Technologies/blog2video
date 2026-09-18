import { useCallback, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useLoginModal } from "../contexts/LoginModalContext";

interface SupportAuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
  eyebrow?: string;
  title?: string;
  description?: string;
}

export default function SupportAuthModal({
  onClose,
  onSuccess,
  eyebrow = "Blog2Video Support",
  title = "Sign in to continue",
  description = "Sign in so we can help you and keep your conversation saved to your account — free, no credit card required.",
}: SupportAuthModalProps) {
  const { login } = useAuth();
  const { openLogin } = useLoginModal();

  // Stay in place: login() writes the token synchronously so the conversation
  // can resume right here.
  const handleOpenLogin = () =>
    openLogin({
      title,
      subtitle: description,
      onSuccess: (token, user) => {
        login(token, user);
        onSuccess();
      },
    });


  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center rounded-xl p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-purple-100 bg-white shadow-2xl">
        <div className="h-1 w-full bg-purple-600" />
        <div className="p-6">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 text-gray-400 transition hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-purple-600">{eyebrow}</p>
          <h2 className="mb-2 text-lg font-bold leading-tight text-gray-900">{title}</h2>
          <p className="mb-5 text-sm leading-relaxed text-gray-500">{description}</p>

          <div className="mb-3 flex justify-center">
            <button
              type="button"
              onClick={handleOpenLogin}
              className="inline-flex h-10 items-center justify-center rounded-full bg-purple-600 px-6 text-sm font-medium text-white transition hover:bg-purple-700"
            >
              Get started free
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
