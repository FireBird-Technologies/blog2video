import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CredentialResponse } from "@react-oauth/google";
import { googleLogin } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { useScrollReveal } from "../hooks/useScrollReveal";
import { useErrorModal, getErrorMessage } from "../contexts/ErrorModalContext";
import FullTemplateShowcase from "../components/FullTemplateShowcase";
import VoiceShowcaseSection from "../components/VoiceShowcaseSection";
import CustomTemplateShowcase from "../components/CustomTemplateShowcase";
// import FeaturedUserTemplates from "../components/FeaturedUserTemplates";
import GoogleAuthButton from "../components/public/GoogleAuthButton";
import AccountDeletedModal from "../components/AccountDeletedModal";
import LandingResourceSection from "../components/public/LandingResourceSection";
import PublicFooter from "../components/public/PublicFooter";
import DiscountBanner from "../components/DiscountBanner";
import Seo from "../components/seo/Seo";
import { homepageSchema } from "../seo/schema";

// ─── Demo videos ─────────────────────────────────────────
// Add more entries here to show them as tabs in "See it in action"
// blogImage is auto-fetched from the blog's OG tags if left undefined
interface DemoVideo {
  id: string;
  title: string;
  youtubeId: string;
  blogUrl?: string;
  blogTitle?: string;
  blogExcerpt?: string;
  blogImage?: string;
}

const INITIAL_DEMOS: DemoVideo[] = [
  {
    id: "demo-1",
    title: "Iran-US Cease Fire",
    youtubeId: "OX6qKxmkNJA",
    blogUrl: "https://www.bbc.com/news/live/c5yw4g3z7qgt",
    blogTitle: "Iran–US Ceasefire Deal Amid Escalating Israel-Lebanon Conflict",
    blogExcerpt: "Iran and the United States reach a temporary ceasefire agreement, while tensions rise as Israel launches fresh strikes in Lebanon, signaling a fragile and uncertain regional situation.",
  },
  {
    id: "demo-2",
    title: "US Democracy Test",
    youtubeId: "BxgEddDuU80",
    blogUrl: "https://www.newsweek.com/2026-midterms-a-critical-test-for-us-democracy-as-ranking-plummets-11696460",
    blogTitle: "2026 Midterms, a Critical Test for US Democracy as Ranking Plummets",
    blogExcerpt: "As the U.S. sees a significant decline in global democracy rankings, the 2026 midterms emerge as a defining moment that could determine the strength, credibility, and future of its democratic system.",
  },
  {
    id: "demo-3",
    title: "The Soccer Star",
    youtubeId: "oECzBB7kExo",
    blogUrl: "https://www.biography.com/athletes/cristiano-ronaldo",
    blogTitle: "Soccer Star Cristiano Ronaldo Confirmed He’ll Retire ‘Soon.’ Here's When That Might Be.",
    blogExcerpt: "Cristiano Ronaldo signals that retirement is on the horizon, sparking debate over when one of football’s greatest players will finally step away from the game.",
  }
  // Add more like:
  // { id: "demo-2", title: "...", youtubeId: "...", blogUrl: "...", blogTitle: "...", blogExcerpt: "..." },
];

/**
 * Fetch OG image, title, and description from a URL via jsonlink.io (free, no key needed).
 * Falls back gracefully if the service is unavailable.
 */
async function fetchOgData(url: string): Promise<{ image?: string; title?: string; description?: string }> {
  try {
    const res = await fetch(`https://jsonlink.io/api/extract?url=${encodeURIComponent(url)}`);
    if (!res.ok) return {};
    const data = await res.json();
    return {
      image: data.images?.[0] || undefined,
      title: data.title || undefined,
      description: data.description || undefined,
    };
  } catch {
    return {};
  }
}

const NAV_LINKS = [
  { href: "#demo", label: "Demo" },
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blogs", label: "Blogs" },
];

const LANDING_YT_HOST_ID = "landing-yt-demo-host";
/** One duration for fade-out and fade-in so blog, connector, video meta, and mask stay in sync (ms). */
const DEMO_CROSSFADE_MS = 480;
/** After destroy(), delay before re-creating the player so the host node is clean (ms). */
const YT_RECREATE_AFTER_DESTROY_MS = 64;
/** Shared easing — smooth start/end, identical on all demo layers */
const DEMO_CROSSFADE_EASE = "ease-[cubic-bezier(0.33,1,0.68,1)]";

/** YouTube IFrame API player states (numeric). */
const YT_PLAYING = 1;

type LandingYtPlayer = {
  destroy: () => void;
};

function LandingDemoSection({ demos }: { demos: DemoVideo[] }) {
  const [activeVideoIdx, setActiveVideoIdx] = useState(0);
  /** Index shown in the blog + video cards (lags activeVideoIdx during cross-fade). */
  const [shownIdx, setShownIdx] = useState(0);
  const [contentPhase, setContentPhase] = useState<"in" | "out">("in");
  const [apiReady, setApiReady] = useState(() => {
    if (typeof window === "undefined") return false;
    return Boolean((window as unknown as { YT?: { Player?: unknown } }).YT?.Player);
  });

  const playerRef = useRef<LandingYtPlayer | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const stuckGuardRef = useRef<number | null>(null);
  const demosLenRef = useRef(demos.length);
  demosLenRef.current = demos.length;

  const clearIdleAdvanceRef = useRef(() => {});
  clearIdleAdvanceRef.current = () => {
    if (idleTimerRef.current != null) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  };

  const clearStuckGuardRef = useRef(() => {});
  clearStuckGuardRef.current = () => {
    if (stuckGuardRef.current != null) {
      window.clearTimeout(stuckGuardRef.current);
      stuckGuardRef.current = null;
    }
  };

  const scheduleIdleAdvanceRef = useRef(() => {});
  scheduleIdleAdvanceRef.current = () => {
    clearIdleAdvanceRef.current();
    const n = demosLenRef.current;
    if (n <= 1) return;
    idleTimerRef.current = window.setTimeout(() => {
      idleTimerRef.current = null;
      setActiveVideoIdx((i) => (i + 1) % n);
    }, 5000);
  };

  const onYtStateChangeRef = useRef((_state: number) => {});
  onYtStateChangeRef.current = (state: number) => {
    // Only pause carousel while the video is actually playing. Treating BUFFERING as
    // "playing" left the idle timer cleared forever when the embed stuck in buffering.
    if (state === YT_PLAYING) {
      clearIdleAdvanceRef.current();
      clearStuckGuardRef.current();
    } else {
      clearStuckGuardRef.current();
      scheduleIdleAdvanceRef.current();
    }
  };

  useEffect(() => {
    const w = window as unknown as {
      YT?: { Player: new (id: string, opts: Record<string, unknown>) => unknown };
      onYouTubeIframeAPIReady?: () => void;
    };
    if (w.YT?.Player) {
      setApiReady(true);
      return;
    }
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      prev?.();
      setApiReady(true);
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    }
  }, []);

  const visibleYoutubeId = demos[shownIdx]?.youtubeId;

  useEffect(() => {
    if (!apiReady || !visibleYoutubeId) return;

    const w = window as unknown as {
      YT: { Player: new (id: string, opts: Record<string, unknown>) => LandingYtPlayer };
    };

    const destroyPlayer = () => {
      const existing = playerRef.current;
      if (!existing) return;
      try {
        existing.destroy();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
    };

    destroyPlayer();
    clearIdleAdvanceRef.current();
    clearStuckGuardRef.current();

    let cancelled = false;
    const createT = window.setTimeout(() => {
      if (cancelled) return;
      if (!document.getElementById(LANDING_YT_HOST_ID)) return;
      try {
        const player = new w.YT.Player(LANDING_YT_HOST_ID, {
          videoId: visibleYoutubeId,
          width: "100%",
          height: "100%",
          playerVars: {
            enablejsapi: 1,
            modestbranding: 1,
            rel: 0,
            origin: typeof window !== "undefined" ? window.location.origin : undefined,
          },
          events: {
            onReady: (e: { target: { getPlayerState: () => number } }) => {
              onYtStateChangeRef.current(e.target.getPlayerState());
            },
            onStateChange: (e: { data: number }) => {
              onYtStateChangeRef.current(e.data);
            },
          },
        });
        playerRef.current = player;
        clearStuckGuardRef.current();
        stuckGuardRef.current = window.setTimeout(() => {
          stuckGuardRef.current = null;
          scheduleIdleAdvanceRef.current();
        }, 12000);
      } catch {
        /* ignore */
      }
    }, YT_RECREATE_AFTER_DESTROY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(createT);
      destroyPlayer();
      clearIdleAdvanceRef.current();
      clearStuckGuardRef.current();
    };
  }, [apiReady, shownIdx, visibleYoutubeId]);

  useEffect(() => {
    if (activeVideoIdx === shownIdx) {
      // If the user changes tabs (or Strict Mode re-runs) while fading, the timeout is
      // cleared but phase can stay "out" — resync so the section never stays invisible.
      setContentPhase("in");
      return;
    }
    setContentPhase("out");
    const t = window.setTimeout(() => {
      setShownIdx(activeVideoIdx);
      setContentPhase("in");
    }, DEMO_CROSSFADE_MS);
    return () => window.clearTimeout(t);
  }, [activeVideoIdx, shownIdx]);

  const v = demos[shownIdx];
  /* Keep in sync with DEMO_CROSSFADE_MS (Tailwind must see a static class name). */
  const crossfadeDurationClass = "duration-[480ms]";
  const demoCrossFadeLayer = `motion-reduce:transition-none transition-[opacity,transform] ${DEMO_CROSSFADE_EASE} ${crossfadeDurationClass} ${
    contentPhase === "out"
      ? "opacity-0 translate-y-2"
      : "opacity-100 translate-y-0"
  }`;
  /** Opacity-only mask over the iframe — keeps motion in sync with cards without transforming the embed */
  const demoVideoBlackout = `absolute inset-0 z-[1] bg-black pointer-events-none motion-reduce:transition-none transition-opacity ${DEMO_CROSSFADE_EASE} ${crossfadeDurationClass} ${
    contentPhase === "out" ? "opacity-100" : "opacity-0"
  }`;

  return (
    <section id="demo" className="py-20 border-t border-gray-100">
      <div className="max-w-6xl mx-auto px-6">
        <div className="reveal">
          <p className="text-xs font-medium text-purple-600 text-center mb-4 tracking-widest uppercase">
            See it in action
          </p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 text-center mb-4">
            From blog post to video — automatically
          </h2>
          <p className="text-sm text-gray-500 text-center mb-12 max-w-lg mx-auto leading-relaxed">
            Paste a URL and Blog2Video handles the rest. Here&apos;s a real example.
          </p>
        </div>

        {demos.length > 1 && (
          <div className="flex items-center justify-center gap-2 mb-8 reveal">
            {demos.map((video, idx) => (
              <button
                key={video.id}
                type="button"
                onClick={() => setActiveVideoIdx(idx)}
                className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
                  activeVideoIdx === idx
                    ? "bg-purple-600 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {video.title}
              </button>
            ))}
          </div>
        )}

        {demos.length > 0 && v && (
          <div className="reveal-scale">
            <div className="grid md:grid-cols-[1fr_auto_1fr] gap-0 items-stretch">
            <div className={demoCrossFadeLayer}>
            <a
              href={v.blogUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-card overflow-hidden group hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all flex flex-col"
            >
              <div className="aspect-[16/9] bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden flex-shrink-0">
                {v.blogImage ? (
                  <img
                    src={v.blogImage}
                    alt={v.blogTitle || "Blog"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300">
                    <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                      />
                    </svg>
                    <span className="text-xs">Blog post</span>
                  </div>
                )}
                <div className="absolute top-3 left-3">
                  <span className="px-2.5 py-1 bg-white/90 backdrop-blur-sm text-[10px] font-semibold text-gray-700 rounded-full shadow-sm">
                    Blog Post
                  </span>
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col">
                {v.blogUrl && (
                  <p className="text-[10px] text-gray-400 truncate mb-2">
                    {new URL(v.blogUrl).hostname}
                  </p>
                )}
                <h3 className="text-sm font-semibold text-gray-900 group-hover:text-purple-600 transition-colors mb-2 line-clamp-2 flex-1">
                  {v.blogTitle || "Original blog post"}
                </h3>
                {v.blogExcerpt && (
                  <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-3">
                    {v.blogExcerpt}
                  </p>
                )}
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-purple-600 group-hover:gap-2 transition-all mt-auto">
                  Read article
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </span>
              </div>
            </a>
            </div>

            <div className={`hidden md:flex flex-col items-center justify-center px-4 ${demoCrossFadeLayer}`}>
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-200">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
                <span className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider">
                  Blog2Video
                </span>
              </div>
            </div>
            <div className={`flex md:hidden items-center justify-center py-4 ${demoCrossFadeLayer}`}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-200">
                  <svg className="w-4 h-4 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
                <span className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider">
                  Blog2Video
                </span>
              </div>
            </div>

            <div className="glass-card overflow-hidden flex flex-col ring-2 ring-purple-100 hover:ring-purple-200 transition-all hover:shadow-[0_4px_20px_rgba(124,58,237,0.1)]">
              {/* YouTube host stays outside opacity/transform cross-fade — animating the grid broke iframe API in several browsers */}
              <div className="aspect-[16/9] relative flex-shrink-0 bg-black w-full overflow-hidden">
                <div id={LANDING_YT_HOST_ID} className="absolute inset-0 z-0 w-full h-full" />
                <div className={demoVideoBlackout} aria-hidden />
                <div className="absolute top-3 left-3 z-[2] pointer-events-none">
                  <span className="px-2.5 py-1 bg-purple-600 text-[10px] font-semibold text-white rounded-full shadow-sm">
                    Generated Video
                  </span>
                </div>
              </div>
              <div className={`p-5 flex-1 flex flex-col ${demoCrossFadeLayer}`}>
                <p className="text-[10px] text-gray-400 mb-2">youtube.com</p>
                <h3 className="text-sm font-semibold text-gray-900 mb-2 line-clamp-2 flex-1">
                  {v.blogTitle || v.title}
                </h3>
                <div className="flex items-center gap-3 mt-auto">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-purple-600">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Watch the video
                  </span>
                  <span className="text-[10px] text-gray-400">AI narration + visuals</span>
                </div>
              </div>
            </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default function Landing() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { showError } = useErrorModal();
  const [demos, setDemos] = useState<DemoVideo[]>(INITIAL_DEMOS);
  const [navOpen, setNavOpen] = useState(false);
  const [accountDeletedOpen, setAccountDeletedOpen] = useState(false);
  const [pendingCredential, setPendingCredential] = useState<string | null>(null);
  const [reactivating, setReactivating] = useState(false);
  const scrollRef = useScrollReveal();

  // Auto-fetch OG images for demos that don't have one; fall back to YouTube thumbnail
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const updated = await Promise.all(
        INITIAL_DEMOS.map(async (demo) => {
          // Use YouTube thumbnail as immediate fallback
          const ytThumb = `https://img.youtube.com/vi/${demo.youtubeId}/hqdefault.jpg`;

          if (demo.blogImage) return demo;
          if (!demo.blogUrl) return { ...demo, blogImage: demo.blogImage || ytThumb };

          const og = await fetchOgData(demo.blogUrl);
          return {
            ...demo,
            blogImage: og.image || ytThumb,
            blogTitle: demo.blogTitle || og.title,
            blogExcerpt: demo.blogExcerpt || og.description,
          };
        })
      );
      if (!cancelled) setDemos(updated);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleGoogleSuccess = async (response: CredentialResponse) => {
    if (!response.credential) return;
    try {
      const res = await googleLogin(response.credential);
      login(res.data.access_token, res.data.user);
      navigate("/dashboard");
    } catch (err: any) {
      if (err?.response?.status === 403 && err?.response?.data?.detail === "account_deleted") {
        setPendingCredential(response.credential);
        setAccountDeletedOpen(true);
      } else {
        showError(getErrorMessage(err, "Authentication failed. Please try again."));
      }
    }
  };

  const handleReactivate = async () => {
    if (!pendingCredential) return;
    setReactivating(true);
    try {
      const res = await googleLogin(pendingCredential, true);
      login(res.data.access_token, res.data.user);
      setAccountDeletedOpen(false);
      setPendingCredential(null);
      navigate("/dashboard");
    } catch (err: any) {
      showError(getErrorMessage(err, "Failed to reactivate account."));
    } finally {
      setReactivating(false);
    }
  };

  return (
    <div ref={scrollRef} className="min-h-screen bg-white">
      <Seo
        title="Blog to Video | Turn Posts Into Videos | Blog2Video"
        description="Turn blog posts into videos in minutes. Blog2Video converts articles to narrated videos with code, diagrams, and templates. No prompts needed. Free to start."
        path="/"
        schema={homepageSchema()}
      />
      {/* ─── Nav ─── */}
      <nav className="bg-white/60 backdrop-blur-xl sticky top-0 z-50 border-b border-gray-200/50">
        {/* Banner above navbar so it appears first on scroll */}
        <DiscountBanner containerClassName="max-w-6xl" />

        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              B2V
            </div>
            <span className="text-xl font-semibold text-gray-900">
              Blog2Video
            </span>
          </div>
          {/* Desktop: horizontal links */}
          <div className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map(({ href, label }) =>
              href.startsWith("#") ? (
                <a
                  key={href}
                  href={href}
                  className="text-sm text-gray-400 hover:text-gray-900 transition-colors"
                >
                  {label}
                </a>
              ) : (
                <Link
                  key={href}
                  to={href}
                  className="text-sm text-gray-400 hover:text-gray-900 transition-colors"
                >
                  {label}
                </Link>
              )
            )}
          </div>
          {/* Mobile: dropdown trigger */}
          <div className="relative md:hidden">
            <button
              type="button"
              onClick={() => setNavOpen((o) => !o)}
              className="flex items-center justify-center p-2 text-gray-600 hover:text-gray-900 rounded-lg transition-colors"
              aria-expanded={navOpen}
              aria-haspopup="true"
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {navOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  aria-hidden="true"
                  onClick={() => setNavOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 py-2 w-48 bg-white rounded-xl border border-gray-200/80 shadow-lg z-50">
                  {NAV_LINKS.map(({ href, label }) =>
                    href.startsWith("#") ? (
                      <a
                        key={href}
                        href={href}
                        onClick={() => setNavOpen(false)}
                        className="block px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                      >
                        {label}
                      </a>
                    ) : (
                      <Link
                        key={href}
                        to={href}
                        onClick={() => setNavOpen(false)}
                        className="block px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                      >
                        {label}
                      </Link>
                    )
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-purple-500/[0.03] rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-violet-500/[0.03] rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-6 pt-28 pb-20 text-center hero-animate">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-50 border border-purple-100 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            <span className="text-xs font-medium text-purple-700">For bloggers, technical writers &amp; educators</span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 leading-[1.1] tracking-tight mb-6">
            Your voice,
            <br />
            <span className="bg-gradient-to-r from-purple-600 to-violet-500 bg-clip-text text-transparent">
              now in video
            </span>
          </h1>

          <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-6 leading-relaxed">
            Turn any blog post or article into a narrated explainer video that
            preserves every detail, code snippet, and diagram. 
            Your readers become viewers — no video editing skills needed.
          </p>

          <p className="text-sm text-gray-400 mb-10 max-w-xl mx-auto">
            Perfect for technical writers who need their content to reach everywhere,
            researchers presenting findings, and teachers turning lessons into visual guides.
          </p>

          <div className="flex flex-col items-center gap-4">
            <GoogleAuthButton
              onSuccess={handleGoogleSuccess}
              onError={() => showError("Google sign-in failed")}
              text="continue_with"
              width="300"
            />
            <p className="text-xs text-gray-400">
              3 videos free — no credit card required
            </p>
            <Link
              to="/blog-to-video"
              className="text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
            >
              Learn more: Blog to video converter →
            </Link>
          </div>
        </div>
      </section>

      <LandingDemoSection demos={demos} />

      {/* ─── Multiple templates ─── */}
      <section className="py-20 border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-6">
          <FullTemplateShowcase />
        </div>
      </section>

      {/* ─── Custom template showcase ─── */}
      <section className="py-20 border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-6">
          <CustomTemplateShowcase />
        </div>
      </section>

      {/* ─── Featured User Templates showcase ─── */}
      {/* <section className="pb-20 border-t border-gray-100 pt-10">
        <div className="max-w-6xl mx-auto px-6">
          <FeaturedUserTemplates />
        </div>
      </section> */}

      {/* ─── Voice showcase ─── */}
      <section className="py-20 border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-6">
          <VoiceShowcaseSection />
        </div>
      </section>

      {/* ─── Pain points / value props ─── */}
      <section className="py-20 border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-6">
          <div className="reveal">
            <p className="text-xs font-medium text-purple-600 text-center mb-4 tracking-widest uppercase">
              The problem
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 text-center mb-4">
              Your writing is great. Video shouldn't be the bottleneck.
            </h2>
            <p className="text-sm text-gray-500 text-center max-w-2xl mx-auto mb-16 leading-relaxed">
              You've spent hours crafting the perfect article. But turning it into video
              means learning editing software, recording yourself, or hiring someone.
              What if your blog could become a video — automatically?
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 reveal-group">
            {[
              {
                icon: "🎙️",
                title: "Exact blog voice",
                desc: "AI reads your article and generates a script that mirrors your writing style — every nuance, every technical term, preserved.",
              },
              {
                icon: "📋",
                title: "Every detail included",
                desc: "Code snippets become animated code blocks. Key points become bullet reveals. Architectures become flow diagrams. Nothing is lost.",
              },
              {
                icon: "🎓",
                title: "Easy to follow",
                desc: "Scene-by-scene narration with professional voiceover makes complex topics as easy to follow as your original blog post.",
              },
            ].map((item) => (
              <div key={item.title} className="glass-card p-8 text-center hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all reveal">
                <div className="text-3xl mb-5">{item.icon}</div>
                <h3 className="text-base font-medium text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Origin story ─── */}
      <section className="py-20 border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-6">
          <div className="reveal">
            <p className="text-xs font-medium text-purple-600 text-center mb-4 tracking-widest uppercase">
              Why I built this
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 text-center mb-6">
              I had 50+ blog posts. Turning them into video almost cost me $30K.
            </h2>
            <p className="text-sm text-gray-500 text-center max-w-2xl mx-auto mb-14 leading-relaxed">
              I'm a blogger who gets clients from long-form content. It works — but blog traffic plateaued.
              Social algorithms favor video. So I tried making the switch.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 reveal-group">
            {/* Attempt 1 */}
            <div className="glass-card p-7 relative overflow-hidden reveal">
              <div className="absolute top-0 left-0 w-full h-1 bg-red-400" />
              <div className="flex items-center gap-2.5 mb-4">
                <span className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center text-sm font-bold">1</span>
                <h3 className="text-sm font-semibold text-gray-900">Hired video editors</h3>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed mb-4">
                Quality was good, but at <span className="font-semibold text-gray-700">$300–$1,000 per video</span>, converting
                50+ posts would have cost me over $30K. Not sustainable for a solo blogger.
              </p>
              <div className="flex items-center gap-2 text-xs text-red-500 font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                Too expensive at scale
              </div>
            </div>

            {/* Attempt 2 */}
            <div className="glass-card p-7 relative overflow-hidden reveal">
              <div className="absolute top-0 left-0 w-full h-1 bg-orange-400" />
              <div className="flex items-center gap-2.5 mb-4">
                <span className="w-8 h-8 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center text-sm font-bold">2</span>
                <h3 className="text-sm font-semibold text-gray-900">AI video generators</h3>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed mb-4">
                Generic stock footage over a robot voice. <span className="font-semibold text-gray-700">Didn't sound like me</span>, didn't
                use my actual content, and still cost $20–50 per video for long-form posts.
              </p>
              <div className="flex items-center gap-2 text-xs text-orange-500 font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                Looked like AI slop
              </div>
            </div>

            {/* Solution */}
            <div className="glass-card p-7 relative overflow-hidden ring-2 ring-purple-100 reveal">
              <div className="absolute top-0 left-0 w-full h-1 bg-purple-500" />
              <div className="flex items-center gap-2.5 mb-4">
                <span className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center text-sm font-bold">3</span>
                <h3 className="text-sm font-semibold text-gray-900">Built Blog2Video</h3>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed mb-4">
                Scrapes <span className="font-semibold text-gray-700">your actual blog</span>. AI <em>programs</em> the video using
                Remotion — no image/video models. Real voice, real content, real diagrams.
              </p>
              <div className="flex items-center gap-2 text-xs text-purple-600 font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Saved $30K+ on 50 posts
              </div>
            </div>
          </div>

          {/* Key differentiator callout */}
          <div className="mt-10 glass-card p-6 bg-purple-50/50 border border-purple-100 text-center reveal">
            <p className="text-sm text-gray-700 leading-relaxed max-w-2xl mx-auto">
              <span className="font-semibold">The key insight:</span> Instead of using expensive AI image
              and video models, Blog2Video uses AI to <span className="font-semibold text-purple-700">write code</span> that
              renders your video programmatically. Animated diagrams, code blocks, bullet reveals —
              all generated as React components, not AI pixels.
            </p>
          </div>
        </div>
      </section>

      {/* ─── 4-Step Process ─── */}
      <section id="how" className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="reveal">
            <p className="text-xs font-medium text-purple-600 text-center mb-4 tracking-widest uppercase">
              4 simple steps
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 text-center mb-16">
              From blog post to video in minutes
            </h2>
          </div>

          <div className="grid md:grid-cols-4 gap-5 reveal-group">
            {[
              {
                step: "1",
                title: "Paste URL",
                desc: "Drop any blog URL, public link, or PDF. You can also paste multiple links at once to spin up several videos in one go.",
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                ),
              },
              {
                step: "2",
                title: "Pick your voice",
                desc: "Choose male or female narrator, British or American accent. Documentary-quality AI voices.",
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                ),
              },
              {
                step: "3",
                title: "AI generates",
                desc: "Script, scenes, voiceover, and visuals — code blocks, diagrams, bullet animations — all auto-generated.",
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                ),
              },
              {
                step: "4",
                title: "Render & share",
                desc: "Preview instantly, render to MP4 and download or share.",
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                ),
              },
            ].map((item) => (
              <div key={item.step} className="glass-card p-6 text-center hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all relative reveal">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center">
                    {item.step}
                  </span>
                </div>
                <div className="w-10 h-10 mx-auto mt-4 mb-4 rounded-lg flex items-center justify-center text-purple-600 bg-purple-50">
                  {item.icon}
                </div>
                <h3 className="text-sm font-medium text-gray-900 mb-1.5">{item.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="py-20 border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-6">
          <div className="reveal">
            <p className="text-xs font-medium text-purple-600 text-center mb-4 tracking-widest uppercase">
              Features
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 text-center mb-16">
              Everything you need to go from text to video
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6 reveal-group">
            {[
              {
                title: "Rich visual scenes — not just text",
                desc: "Code blocks with syntax highlighting, animated bullet lists, flow diagrams, comparison layouts, big-number metrics. Every scene is tailored to its content.",
                tag: null,
              },
              {
                title: "Works with URLs, PDFs & bulk links",
                desc: "Start from blog posts, public links, or uploaded PDFs. Paste multiple URLs at once to batch-generate several videos in a single run.",
                tag: null,
              },
              {
                title: "Custom voice & voice cloning",
                desc: "Choose from 4 prebuilt documentary-quality voices, design a custom voice from a prompt, or clone your own by uploading a sample. Your content, your voice.",
                tag: "Pro",
              },
              {
                title: "Custom templates from any website",
                desc: "Paste a URL and we extract its brand — colors, fonts, and style — into a fully custom video template. Your brand identity, every frame.",
                tag: "Pro",
              },
              // {
              //   title: "Remotion Studio export",
              //   desc: "Every frame is a React component. Open the full Remotion Studio to customize animations, timing, colors, and code — total creative control.",
              //   tag: "Pro",
              // },
              {
                title: "AI chat editor",
                desc: "Tell the AI to rewrite a scene, change tone, add detail, or restructure. Your edits are applied instantly without re-generating the entire video.",
                tag: "Pro",
              },
              {
                title: "Hero image & blog assets",
                desc: "The blog's OG image becomes your intro scene. All extracted images are distributed across scenes for maximum visual impact.",
                tag: null,
              },
              {
                title: "Render progress & instant preview",
                desc: "Watch your video come to life with a live Remotion Player preview. Render to MP4 with real-time progress tracking — frame by frame.",
                tag: null,
              },
            ].map((f) => (
              <div key={f.title} className="glass-card p-8 hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all reveal">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <h3 className="text-base font-medium text-gray-900">{f.title}</h3>
                  {f.tag && (
                    <span className="flex-shrink-0 px-2 py-0.5 text-[10px] font-semibold bg-purple-100 text-purple-600 rounded-full">
                      {f.tag}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Who is it for ─── */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="reveal">
            <p className="text-xs font-medium text-purple-600 text-center mb-4 tracking-widest uppercase">
              Built for
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 text-center mb-16">
              Writers, researchers and educators who want to be seen
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 reveal-group">
            {[
              { icon: "✍️", title: "Technical bloggers", desc: "Turn dev.to and Medium posts into YouTube-ready explainers" },
              { icon: "🔬", title: "Researchers", desc: "Present papers and findings as accessible video summaries" },
              { icon: "👩‍🏫", title: "Teachers & educators", desc: "Convert lesson plans and course material into visual guides" },
              { icon: "📝", title: "Technical writers", desc: "Repurpose documentation and how-tos as video walkthroughs" },
            ].map((p) => (
              <div key={p.title} className="glass-card p-6 text-center hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all reveal">
                <div className="text-2xl mb-3">{p.icon}</div>
                <h3 className="text-sm font-medium text-gray-900 mb-1">{p.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing preview ─── */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6 text-center reveal">
          <p className="text-xs font-medium text-purple-600 mb-4 tracking-widest uppercase">Pricing</p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4">
            Start free. Pay per video. Standard or Pro.
          </h2>
          <p className="text-sm text-gray-500 mb-10 max-w-lg mx-auto leading-relaxed">
            Your first 3 videos are free. Then $3/video pay-as-you-go, $25/month
            (or $20/mo annual), $50/month with unlimited AI edit & image generation,
            or custom plans for enterprise teams.
          </p>

          <div className="flex flex-row items-center justify-center gap-3 overflow-x-auto pb-2">
            <div className="glass-card px-7 py-6 text-center w-[170px] flex-shrink-0">
              <p className="text-sm font-medium text-gray-900 mb-1">Free</p>
              <p className="text-3xl font-bold text-gray-900">$0</p>
              <p className="text-xs text-gray-400 mt-1">3 videos free</p>
            </div>
            <div className="glass-card px-7 py-6 text-center w-[170px] flex-shrink-0">
              <p className="text-sm font-medium text-gray-900 mb-1">Per Video</p>
              <p className="text-3xl font-bold text-gray-900">$3</p>
              <p className="text-xs text-gray-400 mt-1">pay as you go</p>
            </div>
            <div className="glass-card px-7 py-6 text-center w-[170px] flex-shrink-0">
              <p className="text-sm font-medium text-gray-900 mb-1">Standard</p>
              <p className="text-3xl font-bold text-gray-900">$25<span className="text-sm font-normal text-gray-400">/mo</span></p>
              <p className="text-xs text-gray-400 mt-1">or $20/mo annual</p>
            </div>
            <div className="glass-card px-7 py-6 text-center w-[170px] flex-shrink-0 ring-1 ring-purple-200 relative">
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                <span className="px-2.5 py-0.5 bg-purple-600 text-white text-[10px] font-medium rounded-full">Best value</span>
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">Pro</p>
              <p className="text-3xl font-bold text-gray-900">$50<span className="text-sm font-normal text-gray-400">/mo</span></p>
              <p className="text-xs text-gray-400 mt-1">or $40/mo annual</p>
            </div>
            <div className="glass-card px-7 py-6 text-center w-[170px] flex-shrink-0 border-2 border-purple-300">
              <p className="text-sm font-medium text-gray-900 mb-1">Customized</p>
              <p className="text-3xl font-bold text-gray-900">Custom</p>
              <p className="text-xs text-gray-400 mt-1">Enterprise & teams</p>
            </div>
          </div>

          <a
            href="/pricing"
            className="inline-flex items-center gap-2 mt-8 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            View full pricing
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </a>
        </div>
      </section>

      <LandingResourceSection />

      {/* ─── CTA ─── */}
      <section className="py-20 border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-6 text-center reveal">
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4">
            Your next blog post deserves a video
          </h2>
          <p className="text-sm text-gray-500 mb-8 max-w-lg mx-auto">
            Join bloggers, researchers, and educators who are turning their best
            writing into engaging video content — in minutes, not hours.
          </p>
          <div className="flex justify-center">
            <GoogleAuthButton
              onSuccess={handleGoogleSuccess}
              onError={() => showError("Google sign-in failed")}
              text="continue_with"
              width="300"
            />
          </div>
        </div>
      </section>

      <PublicFooter />

      <AccountDeletedModal
        open={accountDeletedOpen}
        onClose={() => { setAccountDeletedOpen(false); setPendingCredential(null); }}
        onReactivate={handleReactivate}
        reactivating={reactivating}
      />
    </div>
  );
}
