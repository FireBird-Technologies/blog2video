import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import PublicHeader from "../components/public/PublicHeader";
import Seo from "../components/seo/Seo";
import AuthFlow from "../components/auth/AuthFlow";
import { useAuth } from "../hooks/useAuth";
import { buildBlog2VideoHandoffUrl } from "../config/urls";

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
 * surfaces. Plain CTAs (PdfLanding, Pricing) route here; the in-place tool
 * gates (LoginGate, the support widget) still use the modal, because navigating
 * away would discard the half-filled form — or the already-dropped file — they
 * are gating.
 *
 * Unlike blog2video's copy, success does NOT navigate locally: this deployment
 * has no dashboard, so the fresh JWT is handed to blog2video.app as a one-time
 * URL param (see buildBlog2VideoHandoffUrl).
 */
export default function AuthPage(_props: AuthPageProps) {
  const { user, token, loading } = useAuth();
  const location = useLocation();

  /**
   * Hand the token across to the main app.
   *
   * A full page assignment rather than navigate(): the destination is a
   * different origin, so there is no client-side route to push.
   */
  const handoff = (freshToken: string) => {
    window.location.href = buildBlog2VideoHandoffUrl(freshToken);
  };

  // Someone already signed in has no business here — send them on rather than
  // showing a form that would immediately bounce them. The token is the whole
  // point of the handoff, so wait until useAuth has restored one.
  useEffect(() => {
    if (!loading && user && token) handoff(token);
  }, [user, token, loading]);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Auth screens are never a search result: they carry no content, and an
          indexed /signin competes with the landing page for the same intent. */}
      <Seo
        title="Sign in"
        description="Sign in to PDF2Video to turn documents into narrated videos."
        path="/signin"
        noindex
      />
      <PublicHeader />

      {/* Centred in the viewport minus the header, and borderless: on a full
          page the card outline reads as a modal that forgot to close. */}
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg rounded-2xl bg-white px-6 py-8 sm:px-10">
          {/* No `mode` or copy override: both routes fall through to AuthFlow's
              signup default and its mode-derived DEFAULT_COPY, so /signin opens
              on the sign-up form too. Returning users take the "Already have an
              account? Sign in" toggle inside the flow.

              Keyed on the path so switching between /signin and /signup
              remounts the flow rather than leaving it mid-stage. */}
          <AuthFlow key={location.pathname} variant="page" onSuccess={handoff} />
        </div>
      </main>
    </div>
  );
}
