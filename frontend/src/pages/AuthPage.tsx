import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import PublicHeader from "../components/public/PublicHeader";
import AuthFlow from "../components/auth/AuthFlow";
import { useAuth } from "../hooks/useAuth";

interface AuthPageProps {
  /**
   * Which route rendered this page. Kept so the two paths stay distinguishable
   * (and linkable), but it no longer forces a form: both open on sign-up, and
   * the toggle inside the flow switches to sign-in.
   */
  mode?: "signin" | "signup";
}

/**
 * Full-page sign-in / sign-up, with the site header.
 *
 * Renders the same AuthFlow as the modal, so every stage — password, OTP,
 * forgot-password, the reactivation prompt — behaves identically on both
 * surfaces. Plain CTAs (Landing, Pricing, PdfLanding) route here; the in-place
 * tool gates still use the modal, because navigating away would discard the
 * half-filled form they are gating.
 */
export default function AuthPage(_props: AuthPageProps) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const requestedRedirect = new URLSearchParams(location.search).get("redirect");
  const safeRedirect =
    requestedRedirect?.startsWith("/") && !requestedRedirect.startsWith("//")
      ? requestedRedirect
      : null;

  // External entry points such as the WordPress plugin cannot write this
  // origin's sessionStorage. Accept a same-origin path in the query string,
  // persist it for every auth provider, and let usePostLoginRedirect consume it.
  useEffect(() => {
    if (safeRedirect) {
      sessionStorage.setItem("b2v_post_login_redirect", safeRedirect);
    }
  }, [safeRedirect]);

  // Someone already signed in has no business here — send them on rather than
  // showing a form that would immediately bounce them.
  useEffect(() => {
    if (!loading && user) {
      if (safeRedirect) sessionStorage.removeItem("b2v_post_login_redirect");
      navigate(safeRedirect || "/dashboard", { replace: true });
    }
  }, [user, loading, navigate, safeRedirect]);

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />

      {/* Centred in the viewport minus the header, and borderless: on a full
          page the card outline reads as a modal that forgot to close. */}
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg rounded-2xl bg-white px-6 py-8 sm:px-10">
          {/* No `mode` or copy override: both routes fall through to AuthFlow's
              signup default and its mode-derived DEFAULT_COPY, so /signin opens
              on the sign-up form too. Returning users take the "Already have an
              account? Sign in" toggle inside the flow. */}
          <AuthFlow key={location.pathname} variant="page" />
        </div>
      </main>
    </div>
  );
}
