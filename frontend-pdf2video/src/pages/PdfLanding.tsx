import { useEffect, useMemo, useState, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { CredentialResponse } from "@react-oauth/google";
import { useScrollReveal } from "../hooks/useScrollReveal";
import { useErrorModal, getErrorMessage } from "../contexts/ErrorModalContext";
import { googleLogin } from "../api/client";
import Seo from "../components/seo/Seo";
import { homepageSchema } from "../seo/schema";
import GoogleAuthButton from "../components/public/GoogleAuthButton";
import PublicFooter from "../components/public/PublicFooter";
import AccountDeletedModal from "../components/AccountDeletedModal";
import ContactModal from "../components/ContactModal";
import UserReviewsSection from "../components/UserReviewsSection";
import PlatformShowcaseSection from "../components/PlatformShowcaseSection";
import VoiceShowcaseSection from "../components/VoiceShowcaseSection";
import CoverflowCarousel, {
  type CoverflowOrientation,
  type CoverflowTemplate,
} from "../components/CoverflowCarousel";
import OrientationToggle from "../components/OrientationToggle";
import {
  TEMPLATE_PREVIEWS,
  TEMPLATE_PREVIEWS_PORTRAIT,
  TEMPLATE_DESCRIPTIONS,
  SHOWCASE_TEMPLATE_IDS,
} from "../components/templatePreviewRegistry";
import YourOwnBrandPreview from "../components/templatePreviews/YourOwnBrandPreview";
import YourOwnBrandPreviewPortrait from "../components/templatePreviews/portrait/YourOwnBrandPreviewPortrait";
import { detectInAppBrowser, isMobileDevice } from "../lib/inAppBrowser";
import {
  LITE_MONTHLY_PRICE,
  STANDARD_MONTHLY_PRICE,
  PRO_MONTHLY_PRICE,
} from "../content/pricingContent";
import { buildBlog2VideoHandoffUrl } from "../config/urls";

// This deployment is pdf2video-only — no brand switching, so these are plain
// constants rather than reads from a brand resolver (see ../frontend for the
// shared-brand build that has one).
const PDF_LOGO_TEXT = "P2V";
const PDF_SITE_NAME = "PDF2Video";
const PDF_WORDMARK = "PDF2Video";

/** Centred on load, with the "Your Own Brand" CTA card inserted just after it. */
const CAROUSEL_ANCHOR_ID = "newspaper";

const CAROUSEL_TEMPLATES: CoverflowTemplate[] = SHOWCASE_TEMPLATE_IDS.map((id) => ({
  id,
  Preview: TEMPLATE_PREVIEWS[id],
  PreviewPortrait: TEMPLATE_PREVIEWS_PORTRAIT[id],
  name: TEMPLATE_DESCRIPTIONS[id]?.title ?? id,
  subtitle: TEMPLATE_DESCRIPTIONS[id]?.subtitle ?? "",
}));

/** Cycled in the hero CTA — document names, the pdf2video analogue of blog URLs. */
const HERO_PLACEHOLDERS = [
  "Drop your annual-report.pdf",
  "Drop your q4-market-note.pdf",
  "Drop your whitepaper.docx",
  "Drop your investor-deck.pptx",
];

/**
 * The landing page deliberately runs its OWN short nav instead of
 * PublicHeader — same split as ../frontend/src/pages/Landing.tsx, the only
 * page over there that doesn't use PublicHeader either.
 *
 * The landing nav is on-page anchors (plus Pricing/Blogs) so a first-time
 * visitor scrolls the pitch rather than being pushed into the marketing tree.
 * The full site nav — PDF to Video, Use Cases, Tools, Help, … from
 * `topNavLinks` — appears on every other page via PublicHeader. Don't merge
 * the two: the difference is intentional.
 */
const NAV_LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#templates", label: "Templates" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blogs", label: "Blogs" },
];

/** Copy doc §3 */
const STEPS = [
  {
    n: "01",
    title: "Upload your document",
    body: "Drop in a PDF, Word doc, or slide deck. We pull out the structure, the headings, the key figures, and the argument.",
  },
  {
    n: "02",
    title: "Pick your look and voice",
    body: "Choose a template and a narrator. Add your logo and brand colours once and every future video inherits them.",
  },
  {
    n: "03",
    title: "Download and publish",
    body: "Get an MP4 ready for LinkedIn, YouTube, email, or your own site. Edit the script and re-render if you want a different cut.",
  },
];

/** Copy doc §4 */
const FEATURES = [
  {
    title: "Real text, not AI mush",
    body: "Your charts, numbers, and quotes appear as actual rendered text on screen. Legible. Correct. Not hallucinated into a blurry approximation of a graph.",
  },
  {
    title: "Studio voiceover",
    body: "Natural narration that reads your document out loud without sounding like a train station announcement. Multiple voices and accents.",
  },
  {
    title: "Your brand, every time",
    body: "Logo, colours, fonts, and an intro card. Set it once. Every video after that comes out on brand without you thinking about it.",
  },
  {
    title: "Script you control",
    body: "The generated script is fully editable. Cut a paragraph, sharpen a line, re-render. You are the editor, not the audience.",
  },
  {
    title: "Built for long documents",
    body: "A 60-page annual report and a 2-page memo need different treatment. Pick the length you want and we compress to fit.",
  },
  {
    title: "Formats that fit where you post",
    body: "Widescreen for YouTube and email, square and vertical for social. Same document, three cuts.",
  },
];

/** Copy doc §6 */
const USE_CASES = [
  {
    title: "Research and finance publishers",
    body: "Weekly notes, market commentary, and sector deep dives. Publish the video the same morning the note goes out and stop competing for reading time you were never going to win.",
  },
  {
    title: "Consultants and agencies",
    body: "Whitepapers and client reports become deliverables people actually consume. Attach the video to the PDF and watch which one gets forwarded.",
  },
  {
    title: "Marketing teams",
    body: "Ebooks, case studies, and gated content get a top of funnel version that works on LinkedIn without a production budget.",
  },
  {
    title: "Educators and course creators",
    body: "Lecture notes and reading packs become watchable modules. Update the doc, re-render the video.",
  },
  {
    title: "Internal comms and HR",
    body: "Policy updates, onboarding packs, and training material that people finish instead of skim.",
  },
  {
    title: "Nonprofits and public sector",
    body: "Annual reports and impact studies that reach past the twelve people who open the appendix.",
  },
];

/** Copy doc §10 */
const FAQS = [
  {
    q: "What file types can I upload?",
    a: "PDF, Word documents, and slide decks. If your document is a scan, we read the text off it first.",
  },
  {
    q: "How long does a video take?",
    a: "Most finish in under five minutes. Long documents take a little more.",
  },
  {
    q: "Can I change the script?",
    a: "Yes. The script is fully editable before you render, and you can re-render as many times as your plan allows.",
  },
  {
    q: "Will it get my numbers right?",
    a: "Figures and quotes are pulled from your document rather than generated, so they come through as written. You still review the script before rendering, which is where anything odd gets caught.",
  },
  {
    q: "Can I use my own brand?",
    a: "Yes. Logo, colours, fonts, and intro card. Set once, applied to everything after.",
  },
  {
    q: "Do I need to be on camera?",
    a: "No. There is no camera, no microphone, and no recording.",
  },
  {
    q: "Who owns the videos?",
    a: "You do. Use them commercially anywhere.",
  },
  {
    q: "Can I do this at volume?",
    a: "Yes. There is an API and an MCP server if you want to render documents from your own pipeline.",
  },
  {
    q: "How is this different from Blog2Video?",
    a: "Same engine, different input. Blog2Video takes a URL. PDF2Video takes a file. One account covers both.",
  },
];

// This deployment has no local dashboard — after sign-in the user is handed
// off to blog2video.app, which is where the actual app (and every other
// FRONTEND_URL-driven backend flow: Stripe checkout, invite emails, embed
// links) already lives. See ../frontend/src/App.tsx's AppRoutes for the
// receiving side of this handoff.

export default function PdfLanding() {
  const [searchParams] = useSearchParams();
  const { showError } = useErrorModal();

  const [navOpen, setNavOpen] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [accountDeletedOpen, setAccountDeletedOpen] = useState(false);
  const [pendingCredential, setPendingCredential] = useState<string | null>(null);
  const [reactivating, setReactivating] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [templatesOrientation, setTemplatesOrientation] =
    useState<CoverflowOrientation>("landscape");
  const [typedPlaceholder, setTypedPlaceholder] = useState("");
  const [inAppInstructionsVisible, setInAppInstructionsVisible] = useState(false);

  /**
   * The hero's off-screen GIS button, clicked programmatically by the CTAs.
   * Kept separate from {@link authButtonRef} (the visible button further down
   * the page): both used to share one ref, so React pointed it at whichever
   * mounted last and the CTA ended up clicking the wrong — unrendered — node.
   */
  const googleBtnRef = useRef<HTMLDivElement>(null);
  /** The visible "continue with Google" button rendered by `authButton()`. */
  const authButtonRef = useRef<HTMLDivElement>(null);
  const isInApp = detectInAppBrowser().isInApp;
  // Phone/tablet by user agent, not by window size — a narrowed desktop window
  // must not be told to switch to a computer.
  const isMobile = isMobileDevice();
  // Required, not decorative: shared sections (e.g. VoiceShowcaseSection) mark
  // content with `.reveal`, which is opacity:0 until this observer adds
  // `.visible`. Without the hook those sections render as blank space.
  const scrollRef = useScrollReveal();

  // Typewriter placeholder in the hero CTA, mirroring the blog2video hero's
  // cycling URL examples — document names here instead of blog links.
  useEffect(() => {
    let cancelled = false;
    let idx = 0;

    const run = async () => {
      while (!cancelled) {
        const word = HERO_PLACEHOLDERS[idx % HERO_PLACEHOLDERS.length];
        for (let i = 0; i <= word.length; i++) {
          if (cancelled) return;
          setTypedPlaceholder(word.slice(0, i));
          await new Promise((r) => setTimeout(r, 38));
        }
        await new Promise((r) => setTimeout(r, 1400));
        for (let i = word.length; i >= 0; i--) {
          if (cancelled) return;
          setTypedPlaceholder(word.slice(0, i));
          await new Promise((r) => setTimeout(r, 18));
        }
        await new Promise((r) => setTimeout(r, 300));
        idx++;
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist referral code from URL so it survives the Google OAuth redirect.
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) localStorage.setItem("b2v_ref_code", ref);
  }, [searchParams]);

  const carouselTemplates = useMemo<CoverflowTemplate[]>(() => {
    const list = [...CAROUSEL_TEMPLATES];
    const anchorIdx = list.findIndex((t) => t.id === CAROUSEL_ANCHOR_ID);
    const insertAt = anchorIdx >= 0 ? anchorIdx + 1 : 1;
    list.splice(insertAt, 0, {
      id: "your-own-brand",
      name: "Your Own Brand",
      subtitle: "Get a custom template tailored to your brand",
      Preview: YourOwnBrandPreview,
      PreviewPortrait: YourOwnBrandPreviewPortrait,
      onSelect: () => setContactOpen(true),
    });
    return list;
  }, []);

  // Centre a document-flavoured template rather than the whiteboard default.
  const carouselInitialIndex = Math.max(
    0,
    carouselTemplates.findIndex((t) => t.id === CAROUSEL_ANCHOR_ID)
  );

  const handleGenerateClick = () => {
    // Inside an in-app browser the hidden Google (GIS) button silently no-ops,
    // because Google blocks OAuth in embedded webviews. Reveal the sign-in block
    // so the GoogleAuthButton's escape/instructions UI is usable instead.
    if (isInApp) {
      googleBtnRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    // GIS renders a (0×0) div[role="button"] into the hidden wrapper; clicking
    // it programmatically opens the Google popup in place. Fall back to the
    // visible button further down only if the hero's hasn't mounted yet.
    //
    // Deliberately NO scrollIntoView fallback: if neither has rendered, doing
    // nothing matches ../frontend/src/pages/Landing.tsx. Scrolling instead sent
    // the user to the bottom of the page, which read as the CTA being broken.
    const findBtn = (root: HTMLDivElement | null) =>
      root?.querySelector("div[role='button']") as HTMLElement | null;
    const btn = findBtn(googleBtnRef.current) ?? findBtn(authButtonRef.current);
    btn?.click();
  };

  /** Hero CTA: there is no local session on this deployment, so it always starts sign-in. */
  const handleHeroStart = () => {
    handleGenerateClick();
  };

  /**
   * Cross-domain handoff: the JWT lives in localStorage, which is per-origin,
   * so a plain redirect would land the user on blog2video.app logged out. The
   * token travels as a one-time URL param instead; blog2video.app's AppRoutes
   * reads it, writes it into its own localStorage, and strips it from the URL
   * immediately (see ../frontend/src/App.tsx).
   *
   * pdf2vid.com never stores the token itself — there's nothing here for it
   * to authenticate.
   */
  const redirectToBlog2Video = (token: string) => {
    window.location.href = buildBlog2VideoHandoffUrl(token);
  };

  const handleGoogleSuccess = async (response: CredentialResponse) => {
    if (!response.credential) return;
    setSigningIn(true);
    const refCode = localStorage.getItem("b2v_ref_code");
    try {
      const res = await googleLogin(response.credential, false, refCode);
      localStorage.removeItem("b2v_ref_code");
      redirectToBlog2Video(res.data.access_token);
      // Intentionally no setSigningIn(false) on success — the page is
      // navigating away; leaving the spinner up avoids a flash of the idle
      // button during the redirect.
    } catch (err: any) {
      if (err?.response?.status === 403 && err?.response?.data?.detail === "account_deleted") {
        setPendingCredential(response.credential);
        setAccountDeletedOpen(true);
      } else {
        showError(getErrorMessage(err, "Authentication failed. Please try again."));
      }
      setSigningIn(false);
    }
  };

  const handleReactivate = async () => {
    if (!pendingCredential) return;
    setReactivating(true);
    try {
      const res = await googleLogin(pendingCredential, true);
      redirectToBlog2Video(res.data.access_token);
    } catch (err: any) {
      showError(getErrorMessage(err, "Failed to reactivate account."));
      setReactivating(false);
    }
  };

  const authButton = (width = "300") => (
    <div ref={authButtonRef} className="inline-flex flex-col items-center gap-2">
      {signingIn ? (
        <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-6 py-3 text-sm font-medium text-gray-500 shadow-sm">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-purple-500/30 border-t-purple-500" />
          Signing you in…
        </div>
      ) : (
        <GoogleAuthButton
          onSuccess={handleGoogleSuccess}
          onError={() => showError("Authentication failed. Please try again.")}
          text="continue_with"
          width={width}
        />
      )}
    </div>
  );

  return (
    <div ref={scrollRef} className="min-h-screen bg-white">
      <Seo
        title="PDF to Video: Turn Any Document Into a Narrated Video"
        description="Upload a PDF, report, or whitepaper. Get a branded, narrated video in minutes. No editors, no cameras, no generic AI slop. Free to try."
        path="/"
        schema={homepageSchema()}
      />

      {/* ─── Nav ─── */}
      <nav
        className="sticky top-0 z-50 border-b border-white/50 backdrop-blur-2xl"
        style={{
          background: "rgba(255,255,255,0.60)",
          boxShadow: "0 1px 0 rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.03)",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              {PDF_LOGO_TEXT}
            </div>
            <span className="text-xl font-semibold text-gray-900">{PDF_SITE_NAME}</span>
          </div>

          <div className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map(({ href, label }) =>
              href.startsWith("#") ? (
                <a
                  key={href}
                  href={href}
                  className="text-sm text-gray-600 hover:text-purple-600 transition-colors"
                >
                  {label}
                </a>
              ) : (
                <Link
                  key={href}
                  to={href}
                  className="text-sm text-gray-600 hover:text-purple-600 transition-colors"
                >
                  {label}
                </Link>
              )
            )}
            {/* No local session on this deployment — always sign in, which
                hands off to blog2video.app/dashboard. */}
            <button
              onClick={handleGenerateClick}
              className="rounded-full bg-purple-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-purple-700"
            >
              Sign in
            </button>
          </div>

          <button
            className="md:hidden p-2 text-gray-600"
            onClick={() => setNavOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={navOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
              />
            </svg>
          </button>
        </div>

        {navOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white/95 px-6 py-4 flex flex-col gap-3">
            {NAV_LINKS.map(({ href, label }) =>
              href.startsWith("#") ? (
                <a
                  key={href}
                  href={href}
                  onClick={() => setNavOpen(false)}
                  className="text-sm text-gray-600"
                >
                  {label}
                </a>
              ) : (
                <Link
                  key={href}
                  to={href}
                  onClick={() => setNavOpen(false)}
                  className="text-sm text-gray-600"
                >
                  {label}
                </Link>
              )
            )}
          </div>
        )}
      </nav>

      {/* ─── 1. Hero ─── */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, rgba(147,51,234,0.10) 0%, rgba(255,255,255,0) 70%)",
          }}
        />
        <div className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
          <div className="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-3 py-1 mb-6">
            <span className="text-xs font-medium text-purple-700">
              For analysts, researchers &amp; lean teams
            </span>
          </div>

          {/* leading, not padding: the gradient span is inline, so vertical
              padding on it does not open up the gaps between the three rows. */}
          <h1 className="text-5xl/[1.2] sm:text-6xl/[1.2] lg:text-6xl/[1.2] font-bold text-gray-900 tracking-tight mb-6">
            Nobody opens the PDF
            <br />
            <span className="bg-gradient-to-r from-purple-600 to-violet-500 bg-clip-text text-transparent">
              everybody watches the
              <br />
              video
            </span>
          </h1>

          <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Turn reports, whitepapers, and decks into narrated videos in minutes.
          </p>

          {/* Hidden Google button — triggered programmatically by the CTAs.
              In an in-app browser it's revealed so the escape/instructions UI shows.

              Must stay `hidden` (display:none), matching
              ../frontend/src/pages/Landing.tsx. GIS still renders a real (0×0)
              `div[role="button"]` into the host DOM here, and a programmatic
              .click() on it works. Under `sr-only` GIS instead renders the
              button *inside* its cross-origin iframe, leaving nothing in the
              host DOM to click — which is what broke the CTA in production. */}
          <div ref={googleBtnRef} className={isInApp ? "mt-4 flex justify-center" : "hidden"}>
            <GoogleAuthButton
              onSuccess={handleGoogleSuccess}
              onError={() => showError("Google sign-in failed")}
              text="continue_with"
              width="300"
              onInstructionsVisibleChange={setInAppInstructionsVisible}
            />
          </div>

          {/* Mirrors the blog2video hero's input + button, but this brand takes a
              file rather than a URL, so the field is a dropzone-styled affordance
              that opens the same sign-in flow. */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleHeroStart();
            }}
            className="w-full max-w-xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
          >
            <button
              type="button"
              onClick={handleHeroStart}
              className="flex-1 flex items-center gap-2 px-4 py-3 text-sm text-gray-400 rounded-xl border border-gray-200 bg-white hover:border-purple-400 transition-all text-left"
              style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
            >
              <svg
                className="h-4 w-4 flex-shrink-0 text-gray-400"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 16.5V4m0 0L7.5 8.5M12 4l4.5 4.5M4 17v1.5A2.5 2.5 0 006.5 21h11a2.5 2.5 0 002.5-2.5V17"
                />
              </svg>
              <span className="truncate">{typedPlaceholder}|</span>
            </button>
            <button
              type="submit"
              className="px-5 py-3 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap"
              style={{ boxShadow: "0 2px 8px rgba(124,58,237,0.25)" }}
            >
              Get Started →
            </button>
          </form>
          <p className="text-xs text-gray-400 mt-3">
            1 video free — no credit card required
          </p>

          {/* Editing/preview hold a Remotion runtime that exceeds most phone
              browsers' memory ceiling, so set expectations before sign-up. */}
          {isMobile && !inAppInstructionsVisible && (
            <div className="mx-auto mt-4 max-w-md rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-2 text-left text-xs text-amber-900">
              <svg
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m0 3.5h.007M10.34 3.94l-7.6 13.2A1.5 1.5 0 004.04 19.5h15.92a1.5 1.5 0 001.3-2.36l-7.6-13.2a1.5 1.5 0 00-2.6 0z"
                />
              </svg>
              <p>
                <span className="font-medium">Optimal experience on a computer.</span>{" "}
                <span className="text-amber-800">
                  Video rendering and previews are memory-heavy and may not play reliably
                  on a phone.
                </span>
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ─── 2. Problem ─── */}
      <section className="py-20 border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-8 text-center">
            The PDF graveyard
          </h2>
          <div className="space-y-5 text-[15px] leading-relaxed text-gray-600">
            <p>
              You spent three weeks on that report. It has original research in it. Real
              numbers. A conclusion that matters.
            </p>
            <p className="text-gray-900 font-medium">
              It got downloaded 400 times and read maybe 40.
            </p>
            <p>
              Documents are the worst performing format you own. They ask for a quiet room
              and twenty uninterrupted minutes, and nobody has either. Meanwhile the same
              argument, narrated over clean visuals, gets watched to the end on a phone in
              a lift.
            </p>
            <p>The problem was never the thinking. It was the container.</p>
          </div>
          <p className="mt-8 text-center text-sm font-medium text-purple-600">
            PDF2Video changes the container. The thinking stays yours.
          </p>
        </div>
      </section>

      {/* ─── 3. How it works ─── */}
      <section id="how" className="py-20 border-t border-gray-100" style={{ background: "rgba(246,247,249,0.70)" }}>
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 text-center mb-3">
            Three steps. Four minutes.
          </h2>
          <p className="text-sm text-gray-500 text-center max-w-lg mx-auto mb-12">
            You review the script before anything renders. Nothing gets published without
            you seeing it first.
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-gray-100 bg-white p-6">
                <span className="text-xs font-semibold tracking-widest text-purple-600">
                  {s.n}
                </span>
                <h3 className="mt-3 text-base font-semibold text-gray-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 4. Feature grid ─── */}
      <section id="features" className="py-20 border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 text-center mb-12">
            Everything the document already said, in a format people finish
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-gray-100 p-6 transition hover:border-purple-200"
              >
                <h3 className="text-base font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 5. Templates ─── */}
      <section id="templates" className="py-20 border-t border-gray-100 overflow-x-clip">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-xs font-medium text-purple-600 text-center mb-4 tracking-widest uppercase">
            Templates
          </p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 text-center mb-4">
            Pick one and forget about it
          </h2>
          <p className="text-sm text-gray-500 text-center max-w-lg mx-auto mb-12 leading-relaxed">
            From broadcast newscasts to restrained editorial layouts, every template comes
            fully animated with its own motion and colour theme.
          </p>
          <OrientationToggle
            orientation={templatesOrientation}
            onChange={setTemplatesOrientation}
            className="mb-8"
          />
          {/* key forces a clean remount on orientation change — resets every
              preview at once instead of swapping in place (which flickered). */}
          <CoverflowCarousel
            key={templatesOrientation}
            templates={carouselTemplates}
            initialIndex={carouselInitialIndex}
            orientation={templatesOrientation}
          />
        </div>
      </section>

      {/* ─── Voice showcase ─── */}
      <section className="py-20 border-t border-gray-100" style={{ background: "rgba(246,247,249,0.70)" }}>
        <div className="max-w-5xl mx-auto px-6">
          <VoiceShowcaseSection />
        </div>
      </section>

      {/* ─── 6. Use cases ─── */}
      <section className="py-20 border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 text-center mb-12">
            Who is turning documents into video
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {USE_CASES.map((u) => (
              <div key={u.title} className="rounded-2xl bg-gray-50/70 p-6">
                <h3 className="text-base font-semibold text-gray-900">{u.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{u.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 7. Differentiation ─── */}
      <section className="py-20 border-t border-gray-100" style={{ background: "rgba(246,247,249,0.70)" }}>
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-6">
            Why this is not another AI video generator
          </h2>
          <p className="text-[15px] leading-relaxed text-gray-600">
            Most AI video tools generate footage. Wobbly hands, invented text, a stock
            office that does not exist. Fine for a mood board. Useless for a document with
            numbers in it.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-gray-600">
            PDF2Video <span className="font-medium text-gray-900">renders</span>. Every
            frame is drawn from a real design system, which means your figures are your
            figures, your quotes are word for word, and your logo is the right shade of
            your logo. The video is a faithful rendering of your document, not a dream
            about it.
          </p>
          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {["Your charts stay accurate", "Your text stays legible", "Your brand stays yours"].map(
              (line) => (
                <div
                  key={line}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900"
                >
                  {line}
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* ─── 8. Social proof ───
          Same Platform + Reviews grey band as the blog2video landing, sharing
          one background so Reviews flows out of Platform. */}
      <div style={{ background: "rgba(246,247,249,0.70)" }}>
        <PlatformShowcaseSection wordmark={PDF_WORDMARK} />
        <UserReviewsSection />
      </div>

      {/* ─── 9. Pricing ─── */}
      <section className="py-20 border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 text-center mb-3">
            Start free. Upgrade when it is working.
          </h2>
          <p className="text-sm text-gray-500 text-center mb-12">
            Videos are counted per render, not per minute. A 90 second clip and a 12 minute
            explainer cost the same.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                name: "Free",
                price: "$0",
                body: "1 free video . No watermark. Every template. Enough to test whether your audience prefers watching to reading.",
              },
              {
                name: "Lite",
                price: `$${LITE_MONTHLY_PRICE}`,
                body: "For a solo publisher getting started with a regular video cadence.",
              },
              {
                name: "Standard",
                price: `$${STANDARD_MONTHLY_PRICE}`,
                body: "Any length. Full brand kit. For one publisher or one team shipping weekly.",
              },
              {
                name: "Pro",
                price: `$${PRO_MONTHLY_PRICE}`,
                body: "Any length. Priority rendering. For teams publishing daily or agencies running video for clients.",
              },
            ].map((tier) => (
              <div key={tier.name} className="rounded-2xl border border-gray-100 p-6">
                <h3 className="text-sm font-semibold text-gray-900">{tier.name}</h3>
                <p className="mt-2 text-2xl font-semibold text-gray-900">
                  {tier.price}
                  {tier.name !== "Free" && (
                    <span className="text-sm font-normal text-gray-400">/mo</span>
                  )}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-gray-500">{tier.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              to="/pricing"
              className="text-sm font-medium text-purple-600 hover:text-purple-700"
            >
              See full pricing →
            </Link>
          </div>
        </div>
      </section>

      {/* ─── 10. FAQ ─── */}
      <section className="py-20 border-t border-gray-100" style={{ background: "rgba(246,247,249,0.70)" }}>
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 text-center mb-12">
            Questions
          </h2>
          <div className="divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white">
            {FAQS.map((f, i) => (
              <div key={f.q}>
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left"
                  aria-expanded={openFaq === i}
                >
                  <span className="text-sm font-medium text-gray-900">{f.q}</span>
                  <span className="text-gray-400 shrink-0">{openFaq === i ? "−" : "+"}</span>
                </button>
                {openFaq === i && (
                  <p className="px-6 pb-5 -mt-1 text-sm leading-relaxed text-gray-500">{f.a}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 11. Final CTA ─── */}
      <section className="py-24 border-t border-gray-100">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900">
            Your next report deserves a bigger audience than your last one
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-gray-500">
            Upload a document and see what it looks like as a video. Takes about four
            minutes and costs nothing.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            {authButton()}
            <p className="text-xs text-gray-400">
              Free plan, no watermark, no card required.
            </p>
          </div>
        </div>
      </section>

      <PublicFooter />

      <AccountDeletedModal
        open={accountDeletedOpen}
        onClose={() => {
          setAccountDeletedOpen(false);
          setPendingCredential(null);
          setSigningIn(false);
        }}
        onReactivate={handleReactivate}
        reactivating={reactivating}
      />
      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />

      {signingIn && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="w-10 h-10 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin mb-4" />
          <p className="text-sm font-medium text-gray-700">Signing you in…</p>
        </div>
      )}
    </div>
  );
}
