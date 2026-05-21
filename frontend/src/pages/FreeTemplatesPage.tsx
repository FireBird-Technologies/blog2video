import { lazy, Suspense, useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { type CredentialResponse } from "@react-oauth/google";
import PublicHeader from "../components/public/PublicHeader";
import PublicFooter from "../components/public/PublicFooter";
import Seo from "../components/seo/Seo";
import GoogleAuthButton from "../components/public/GoogleAuthButton";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL, googleLogin } from "../api/client";
import { templateProfiles } from "../content/marketingBase";

const BlogDemoPlayer = lazy(() => import("../help/BlogDemoPlayer"));

const FREE_TEMPLATES = [
  { slug: "geometric-explainer", dir: "default" },
  { slug: "nightfall",           dir: "nightfall" },
  { slug: "spotlight",           dir: "spotlight" },
  { slug: "matrix",              dir: "matrix" },
  { slug: "gridcraft",           dir: "gridcraft" },
];

const PENDING_DOWNLOAD_KEY = "b2v_pending_template_download";

export async function triggerTemplateDownload(slug: string): Promise<boolean> {
  try {
    const token = localStorage.getItem("b2v_token");
    const url = slug === "all"
      ? `${BACKEND_URL}/api/templates/free-download-all`
      : `${BACKEND_URL}/api/templates/free-download/${slug}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return false;
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = slug === "all" ? "blog2video-free-templates.zip" : `blog2video-${slug}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
    return true;
  } catch {
    return false;
  }
}

type DownloadState = "idle" | "loading" | "done";

// ─── Download Modal ─────────────────────────────────────────────────────────

interface ModalProps {
  slug: string | null;
  onClose: () => void;
  onDownloadStarted: (slug: string) => void;
}

const TEMPLATE_DISPLAY: Record<string, string> = {
  "geometric-explainer": "Geometric Explainer",
  nightfall: "Nightfall",
  spotlight: "Spotlight",
  matrix: "Matrix",
  gridcraft: "Gridcraft",
  all: "All 5 Templates",
};

function DownloadModal({ slug, onClose, onDownloadStarted }: ModalProps) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = slug ? (TEMPLATE_DISPLAY[slug] ?? slug) : "";

  const handleGoogleSuccess = async (response: CredentialResponse) => {
    if (!response.credential || !slug) return;
    setSigningIn(true);
    setError(null);
    try {
      const res = await googleLogin(response.credential, false, localStorage.getItem("b2v_ref_code"));
      localStorage.removeItem("b2v_ref_code");
      login(res.data.access_token, res.data.user);

      onClose();
      onDownloadStarted(slug);

      const ok = await triggerTemplateDownload(slug);
      if (!ok) setError("Download failed. Please try again.");
      else if (slug !== "all") {
        navigate(`/tools/free-remotion-templates?downloaded=${encodeURIComponent(slug)}`);
      }
    } catch {
      setError("Sign-in failed. Please try again.");
      setSigningIn(false);
    }
  };

  if (!slug) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden border border-purple-100">
        {/* Top accent bar */}
        <div className="h-1 w-full bg-purple-600" />

        <div className="p-8">
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Icon + title */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-purple-600">
                Expert-Crafted Template
              </p>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">{displayName}</h2>
            </div>
          </div>

          <p className="text-sm text-gray-500 leading-relaxed mb-5">
            You're downloading a <span className="font-semibold text-gray-800">professionally designed Remotion template</span> — full TypeScript source, layouts, components, and a visual style guide included.
          </p>

          {/* Feature highlights */}
          <ul className="space-y-2 mb-6">
            {[
              "Full TypeScript + TSX source code",
              "Scene layouts ready for any content type",
              "Style guide with colors, fonts & motion specs",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-5 h-5 rounded bg-purple-50 border border-purple-100 flex items-center justify-center flex-shrink-0 text-purple-600 text-xs font-bold">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>

          <div className="mb-5 border-t border-gray-100" />

          {/* Google auth */}
          <div className="flex justify-center mb-3">
            {signingIn ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <svg className="w-4 h-4 animate-spin text-purple-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Starting download…
              </div>
            ) : (
              <GoogleAuthButton
                onSuccess={handleGoogleSuccess}
                onError={() => setError("Sign-in failed. Please try again.")}
                text="signup_with"
                width="320"
              />
            )}
          </div>

          {error && <p className="text-center text-xs text-red-500 mb-2">{error}</p>}

          <p className="text-center text-xs text-gray-400">
            Download starts immediately after signing in · No credit card required
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function FreeTemplatesPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [modalSlug, setModalSlug] = useState<string | null>(null);
  const [dlState, setDlState] = useState<Record<string, DownloadState>>(() => {
    const pending = searchParams.get("downloaded");
    return pending ? { [pending]: "done" } : {};
  });

  const profiles = FREE_TEMPLATES.map((t) =>
    templateProfiles.find((p) => p.slug === t.slug)!
  ).filter(Boolean);

  // After login redirect (legacy flow): fire the pending per-template download
  useEffect(() => {
    if (!user) return;
    const raw = localStorage.getItem(PENDING_DOWNLOAD_KEY);
    if (!raw) return;
    let slug: string;
    try { slug = JSON.parse(raw); } catch { return; }
    localStorage.removeItem(PENDING_DOWNLOAD_KEY);
    setDlState((s) => ({ ...s, [slug]: "loading" }));
    triggerTemplateDownload(slug).then((ok) => {
      setDlState((s) => ({ ...s, [slug]: ok ? "done" : "idle" }));
    });
  }, [user]);

  const handleDownloadClick = useCallback((slug: string) => {
    if (user) {
      // Already logged in — download directly
      setDlState((s) => ({ ...s, [slug]: "loading" }));
      triggerTemplateDownload(slug).then((ok) => {
        setDlState((s) => ({ ...s, [slug]: ok ? "done" : "idle" }));
      });
    } else {
      setModalSlug(slug);
    }
  }, [user]);

  const handleDownloadStarted = useCallback((slug: string) => {
    setDlState((s) => ({ ...s, [slug]: "loading" }));
    // The modal itself calls triggerTemplateDownload; we just track state
    setTimeout(() => {
      setDlState((s) => ({ ...s, [slug]: "done" }));
    }, 3000);
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Seo
        title="5 Free Designer-Made Remotion Templates — Blog2Video"
        description="Download 5 free expert-crafted Remotion video templates: Geometric Explainer, Nightfall, Spotlight, Matrix, and Gridcraft. Full TypeScript source — built by professional designers."
        path="/tools/free-remotion-templates"
      />
      <PublicHeader />

      {/* Hero */}
      <section className="border-b border-gray-100 bg-gradient-to-b from-purple-50/40 via-white to-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
            Free · Designer-Made · Open Source
          </p>
          <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            5 free expert-crafted Remotion templates.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-gray-500">
            Every template here was designed by our team — not generated, not procedural.
            Each one has a distinct visual identity, a documented style system, and
            production-ready TypeScript source. Drop any into your Remotion project and ship the same week.
          </p>

          <div className="mt-6 flex flex-wrap gap-2 mb-8">
            {["Expert-Designed", "5 Distinct Styles", "Full TypeScript Source", "Style Guide Included", "Remotion-Ready"].map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-purple-100 bg-white px-3 py-1 text-xs font-medium text-purple-700"
              >
                {badge}
              </span>
            ))}
          </div>

          {/* Download All CTA */}
          <button
            onClick={() => handleDownloadClick("all")}
            className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-200 transition hover:bg-purple-700 hover:shadow-purple-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {dlState["all"] === "loading" ? "Preparing ZIP…" : dlState["all"] === "done" ? "Downloaded — Download Again" : "Download All 5 Templates"}
          </button>
          <p className="mt-2 text-xs text-gray-400">One ZIP · All 5 templates · Free forever</p>
        </div>
      </section>

      {/* Templates */}
      <section className="mx-auto max-w-6xl px-6 py-16 space-y-24">
        {profiles.map((profile) => {
          const state = dlState[profile.slug] ?? "idle";
          return (
            <div key={profile.slug} className="grid gap-10 lg:grid-cols-2 items-start">
              {/* Info */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-8 h-8 rounded-lg flex-shrink-0"
                    style={{ background: getAccentColor(profile.slug) }}
                  />
                  <h2 className="text-2xl font-bold text-gray-900">{profile.name}</h2>
                </div>

                {/* Designed-by badge */}
                <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 border border-purple-100 px-3 py-1 mb-4">
                  <svg className="w-3 h-3 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-xs font-semibold text-purple-700">Designed by Blog2Video team</span>
                </div>

                <p className="text-gray-600 text-base leading-relaxed mb-5">{profile.longDescription}</p>
                {profile.idealFor && profile.idealFor.length > 0 && (
                  <div className="mb-6">
                    <p className="text-xs font-semibold uppercase tracking-widest text-purple-600 mb-3">
                      Ideal For
                    </p>
                    <ul className="space-y-2">
                      {profile.idealFor.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* What's in this ZIP */}
                <div className="mb-6 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-500 space-y-1">
                  <p className="font-semibold text-gray-700 mb-1">What's in the ZIP</p>
                  <p><span className="font-mono text-purple-600">{profile.name}/</span> — full Remotion source (layouts, components, types)</p>
                  <p><span className="font-mono text-purple-600">STYLE.md</span> — visual identity, colors, typography, and motion guide</p>
                  <p><span className="font-mono text-purple-600">BLOG2VIDEO.md</span> — about Blog2Video + FireBird Technologies</p>
                </div>

                <DownloadButton
                  state={state}
                  onDownload={() => handleDownloadClick(profile.slug)}
                  label={`Download ${profile.name}`}
                />
              </div>

              {/* Preview */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-600 text-center mb-3">
                  Live Preview
                </p>
                <Suspense fallback={<div className="aspect-video w-full rounded-2xl bg-gray-100 animate-pulse" />}>
                  <BlogDemoPlayer sceneKey={profile.previewSceneKey ?? "blog-workflow"} />
                </Suspense>
              </div>
            </div>
          );
        })}
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-gray-100 bg-gray-50/70">
        <div className="mx-auto max-w-6xl px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">Want a template built specifically for your brand?</h2>
          <p className="text-gray-500 text-sm mb-8 max-w-lg mx-auto">
            Our design team creates custom Remotion templates that match your brand's colors,
            fonts, motion style, and content structure — no code required on your end.
          </p>
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-purple-700"
          >
            See Blog2Video Pro
          </Link>
        </div>
      </section>

      <PublicFooter />

      {/* Download modal */}
      {modalSlug && (
        <DownloadModal
          slug={modalSlug}
          onClose={() => setModalSlug(null)}
          onDownloadStarted={handleDownloadStarted}
        />
      )}
    </div>
  );
}

function DownloadButton({
  state,
  onDownload,
  label,
}: {
  state: DownloadState;
  onDownload: () => void;
  label: string;
}) {
  const base = "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition";

  return (
    <button
      onClick={onDownload}
      disabled={state === "loading"}
      className={`${base} bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60`}
    >
      {state === "loading" ? (
        <>
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Preparing ZIP…
        </>
      ) : state === "done" ? (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Downloaded — Download Again
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}

function getAccentColor(slug: string): string {
  const colors: Record<string, string> = {
    "geometric-explainer": "#7c3aed",
    nightfall:  "#818CF8",
    spotlight:  "#EF4444",
    matrix:     "#00FF41",
    gridcraft:  "#F97316",
    all:        "#7c3aed",
  };
  return colors[slug] ?? "#7c3aed";
}
