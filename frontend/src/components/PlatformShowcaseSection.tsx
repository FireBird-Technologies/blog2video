import { useState, useEffect, useRef, type CSSProperties } from "react";
import { PUBLICATIONS, type Publication } from "./publicationData";

// ─── Platform data ────────────────────────────────────────────────────────────

interface Platform {
  id: string;
  name: string;
  logoSrc: string;
  logoAlt: string;
}

function publicAsset(path: string): string {
  const p = path.startsWith("/") ? path.slice(1) : path;
  return `/${encodeURI(p)}`;
}

const PLATFORMS: Platform[] = [
  { id: "medium",   name: "Medium",   logoSrc: publicAsset("medium logo.png"), logoAlt: "Medium"   },
  { id: "substack", name: "Substack", logoSrc: publicAsset("Substack.png"),    logoAlt: "Substack" },
  { id: "beehiiv",  name: "beehiiv",  logoSrc: publicAsset("beehiv.svg"),      logoAlt: "beehiiv"  },
  { id: "ghost",    name: "Ghost",    logoSrc: publicAsset("Ghost logo.webp"), logoAlt: "Ghost"     },
];

// ─── Publication logo with priority fallback chain ────────────────────────────
//
//   christianleadership : fetchUrl  →  logoSrc  →  initials
//   all others          : logoSrc   →  initials

type ImgStage = "fetch" | "file" | "initials";

function PublicationLogo({
  pub,
  size = 40,
}: {
  pub: Publication;
  size?: number;
}) {
  const startStage: ImgStage = pub.fetchUrl ? "fetch" : "file";
  const [stage, setStage] = useState<ImgStage>(startStage);

  const src =
    stage === "fetch" ? pub.fetchUrl! :
    stage === "file"  ? pub.logoSrc   :
    null;

  const advance = () => {
    if (stage === "fetch") setStage("file");
    else setStage("initials");
  };


  if (stage === "initials" || !src) {
    return (
      <div
        className={`rounded-full ${pub.avatarBg} flex items-center justify-center text-white font-bold select-none`}
        style={{ width: size, height: size, fontSize: size * 0.3 }}
      >
        {pub.initials}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={pub.name}
      width={size}
      height={size}
      className="rounded-lg object-contain select-none"
      style={{ width: size, height: size }}
      loading="lazy"
      draggable={false}
      onError={advance}
    />
  );
}

// ─── Real reviews ─────────────────────────────────────────────────────────────

// ─── Slide helpers ────────────────────────────────────────────────────────────

type SlidePos = "off-right" | "center" | "off-left";

function slideStyle(pos: SlidePos, opts?: { scaleWhenOff?: boolean }): CSSProperties {
  const scaleWhenOff = opts?.scaleWhenOff ?? true;
  const x = pos === "off-right" ? "1.75rem" : pos === "off-left" ? "-1.75rem" : "0";
  const opacity = pos === "center" ? 1 : 0;
  const scale = scaleWhenOff && pos !== "center" ? 0.96 : 1;
  return {
    opacity,
    transform: `translateX(${x}) scale(${scale})`,
    transition: "opacity 500ms cubic-bezier(0.22, 1, 0.36, 1), transform 500ms cubic-bezier(0.22, 1, 0.36, 1)",
    willChange: pos === "center" ? "auto" : "transform, opacity",
  };
}

// ─── Platform logo img ────────────────────────────────────────────────────────

function PlatformLogoImg({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      className="h-10 w-auto max-h-12 max-w-[min(100%,220px)] object-contain object-center select-none"
      draggable={false}
    />
  );
}

// ─── Publication logo ticker (right → left, 4 visible at a time) ─────────────

/** Fixed width per item so exactly 4 fill the viewport (4 × 140px = 560px). */
const PUB_ITEM_W = 140;
const PUB_VISIBLE = 4;
const PUB_TICKER_LOOP_SECONDS = 18;

function PublicationLogoTicker({ running }: { running: boolean }) {
  const track = [...PUBLICATIONS, ...PUBLICATIONS, ...PUBLICATIONS];
  return (
    <div
      className="relative mx-auto w-full overflow-hidden"
      style={{
        maxWidth: PUB_ITEM_W * PUB_VISIBLE,
        maskImage:
          "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
      }}
    >
      <div
        className="flex w-max"
        style={{
          animation: `ticker-scroll ${PUB_TICKER_LOOP_SECONDS}s linear infinite`,
          animationPlayState: running ? "running" : "paused",
        }}
      >
        {track.map((pub, i) => (
          <div
            key={`${pub.id}-${i}`}
            className="shrink-0 flex flex-col items-center gap-2"
            style={{ width: PUB_ITEM_W }}
          >
            <PublicationLogo pub={pub} size={52} />
            <span className="text-[10px] font-medium text-gray-500 text-center px-1 line-clamp-1">
              {pub.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Timing constants ─────────────────────────────────────────────────────────

const TRANSITION_MS    = 500;
const ENTER_DELAY_MS   = 60;
const PLATFORM_HOLD_MS = 3000;

// ─── useAutoSlide ─────────────────────────────────────────────────────────────

function useAutoSlide(count: number, holdMs: number, started: boolean) {
  const [index, setIndex]       = useState(0);
  const [slide, setSlide]       = useState<SlidePos>("off-right");
  const [dotPulse, setDotPulse] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const jumpTo = (i: number) => {
    clearTimers();
    setDotPulse((n) => n + 1);
    setIndex(i);
  };

  useEffect(() => {
    if (!started) return;
    clearTimers();
    const cancelled = { current: false };

    const push = (ms: number, fn: () => void) =>
      timers.current.push(setTimeout(() => { if (!cancelled.current) fn(); }, ms));

    setSlide("off-right");
    push(ENTER_DELAY_MS, () => setSlide("center"));

    const tExit = ENTER_DELAY_MS + holdMs;
    push(tExit, () => setSlide("off-left"));
    push(tExit + TRANSITION_MS, () => setIndex((i) => (i + 1) % count));

    return () => { cancelled.current = true; clearTimers(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, index, dotPulse, holdMs, count]);

  return { index, slide, jumpTo };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PlatformShowcaseSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [started, setStarted]           = useState(false);
  const [tickerRunning, setTickerRunning] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          setTickerRunning(true);
        }
      },
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const platform = useAutoSlide(PLATFORMS.length, PLATFORM_HOLD_MS, started);
  const currentPlatform = PLATFORMS[platform.index];

  return (
    <section ref={sectionRef} className="pt-16 pb-6 border-t border-gray-100 overflow-hidden">

      {/* ── Header ── */}
      <div className="max-w-5xl mx-auto px-6 mb-8 text-center">
        <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">
          Top writers already use blog2video
        </h2>
        <p className="text-sm text-gray-500 max-w-xl mx-auto">
          From Substack to Medium — writers across every major platform are turning their articles into videos automatically.
        </p>
      </div>

      {/* ── Platform logo carousel (independent, one at a time) ── */}
      <div className="max-w-5xl mx-auto px-6">
        <p className="text-xs font-medium text-purple-600 text-center tracking-widest uppercase mb-5">
          Trusted by writers on
        </p>

        <div className="flex justify-center items-center h-12 mb-4">
          <div style={slideStyle(platform.slide, { scaleWhenOff: true })}>
            <div key={currentPlatform.id} className="flex justify-center">
              <PlatformLogoImg src={currentPlatform.logoSrc} alt={currentPlatform.logoAlt} />
            </div>
          </div>
        </div>

        <div className="flex justify-center gap-2">
          {PLATFORMS.map((p, i) => (
            <button
              key={p.id}
              onClick={() => platform.jumpTo(i)}
              className="w-1.5 h-1.5 rounded-full transition-all duration-300"
              style={{
                background: i === platform.index ? "#9333ea" : "#d1d5db",
                transform: i === platform.index ? "scale(1.4)" : "scale(1)",
              }}
              aria-label={p.name}
            />
          ))}
        </div>
      </div>

      {/* ── Publication logo ticker (left → right, independent) ── */}
      <div className="mt-10 mb-12">
        <p className="text-xs font-medium text-gray-400 text-center tracking-widest uppercase mb-6">
          used by writers of
        </p>
        <PublicationLogoTicker running={tickerRunning} />
      </div>

    </section>
  );
}
