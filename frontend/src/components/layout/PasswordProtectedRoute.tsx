import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  getTemplateStudioAuthStatus,
  verifyTemplateStudioPassword,
} from "../../api/client";

const SESSION_KEY = "template_studio_auth";

function errorMessageFromAxios(err: unknown): string {
  if (!axios.isAxiosError(err)) {
    return err instanceof Error ? err.message : "Something went wrong. Try again.";
  }
  const status = err.response?.status;
  const data = err.response?.data as { detail?: unknown } | undefined;
  const detail = data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0 && typeof detail[0] === "object") {
    const first = detail[0] as { msg?: string };
    if (first.msg) return first.msg;
  }
  if (status === 429) {
    const retry = err.response?.headers?.["retry-after"];
    return retry
      ? `Too many attempts. Retry in ${retry}s.`
      : "Too many attempts. Please wait before trying again.";
  }
  return err.message || "Incorrect password or server error.";
}

interface PasswordProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export default function PasswordProtectedRoute({
  children,
  redirectTo = "/",
}: PasswordProtectedRouteProps) {
  const navigate = useNavigate();

  const [authenticated, setAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem(SESSION_KEY) === "true";
  });

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [checkingGate, setCheckingGate] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authenticated) {
      setCheckingGate(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { gated } = await getTemplateStudioAuthStatus();
        if (cancelled) return;
        if (!gated) {
          sessionStorage.setItem(SESSION_KEY, "true");
          setAuthenticated(true);
        }
      } catch {
        // Network / server error — show password UI (may still be gated server-side).
      } finally {
        if (!cancelled) setCheckingGate(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated]);

  const handleSubmit = useCallback(async () => {
    const trimmed = password.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await verifyTemplateStudioPassword(trimmed);
      if (res.ok) {
        sessionStorage.setItem(SESSION_KEY, "true");
        setAuthenticated(true);
        setPassword("");
      } else {
        setError("Could not verify access.");
        setShake(true);
        setTimeout(() => setShake(false), 400);
      }
    } catch (err) {
      setError(errorMessageFromAxios(err));
      setShake(true);
      setTimeout(() => setShake(false), 400);
      setPassword("");
    } finally {
      setSubmitting(false);
    }
  }, [password, submitting]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") void handleSubmit();
  };

  if (authenticated) return <>{children}</>;

  if (checkingGate) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="flex flex-col items-center gap-3 text-gray-500 text-sm">
          <span className="w-8 h-8 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
          <span>Checking access…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-gray-50 to-gray-100">
      <div
        className={`w-full max-w-md p-10 rounded-2xl border border-white/40 
        backdrop-blur-xl bg-white/80 shadow-xl transition ${
          shake ? "animate-[shake_.4s]" : ""
        }`}
      >
        {/* Lock Icon */}
        <div className="w-11 h-11 mb-5 flex items-center justify-center rounded-xl bg-purple-100 text-purple-600 text-xl">
          🔒
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-gray-900">
          Template Studio
        </h2>

        <p className="text-sm text-gray-500 mt-1 mb-6">
          Enter the password to access the template studio.
        </p>

        {/* Label */}
        <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">
          Access Password
        </label>

        {/* Input */}
        <div className="relative">
          <input
            type="password"
            value={password}
            disabled={submitting}
            autoFocus
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            onKeyDown={handleKeyDown}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm
            focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400"
          />

        </div>

        {/* Error */}
        <div className="text-xs text-red-500 mt-2 min-h-[16px]">
          {error}
        </div>

        {/* Button */}
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!password.trim() || submitting}
          className="w-full mt-4 py-2 rounded-lg text-sm font-medium text-white
          bg-gradient-to-r from-purple-600 to-purple-700
          hover:shadow-lg hover:-translate-y-[1px] transition
          disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <span className="inline-flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Verifying…
            </span>
          ) : (
            "Unlock Access"
          )}
        </button>

        {/* Back */}
        <button
          type="button"
          onClick={() => navigate(redirectTo)}
          disabled={submitting}
          className="w-full mt-4 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
        >
          ← Return to homepage
        </button>
      </div>

      {/* Tailwind custom animation */}
      <style>
        {`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          25%{transform:translateX(-6px)}
          75%{transform:translateX(6px)}
        }
        `}
      </style>
    </div>
  );
}
