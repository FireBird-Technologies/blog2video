/**
 * Lightweight inline-code preview for the FJ Research crafted template.
 *
 * Editorial paper system — flat white canvas, ink-black IBM Plex Mono type,
 * graphite eyebrows/accents, silver hairlines, no shadows. Mirrors the live
 * template (see FJ_RESEARCH_LAYOUT_COLOR_DEFAULTS: every scene is paper/ink/
 * graphite). Cycles 4 representative scenes:
 *   1. Masthead        2. Thesis Statement
 *   3. Deep Dive       4. Ending Socials
 */
import { useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const INTERNAL_W = 480;
const INTERNAL_H = 270;

// Editorial token palette (matches FJ_RESEARCH_TOKENS)
const T = {
  paper: "#FFFFFF",
  ink: "#0A0A0A",
  graphite: "#6B6B6B",
  silver: "#B5B5B5",
  fog: "#F5F5F5",
  mist: "#ECECEC",
};

const FONT = "'IBM Plex Mono', 'IBMPlexMono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

// ── Scaled 16:9 stage ────────────────────────────────────────────────────────
function ScaledCanvas({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.getBoundingClientRect().width / INTERNAL_W);
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        width: "100%",
        aspectRatio: `${INTERNAL_W}/${INTERNAL_H}`,
        overflow: "hidden",
        position: "relative",
        background: T.paper,
      }}
    >
      <div
        style={{
          width: INTERNAL_W,
          height: INTERNAL_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          position: "absolute",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ── Shared paper canvas — pure flat white (FJResearchCustomBackground) ─────────
function PaperCanvas({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        background: T.paper,
        overflow: "hidden",
        fontFamily: FONT,
        color: T.ink,
      }}
    >
      {children}
    </div>
  );
}

// ── Check-in-circle bullet glyph (Thesis) ─────────────────────────────────────
function CheckCircle({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block", flex: "0 0 auto" }}>
      <circle cx="12" cy="12" r="10.5" fill="none" stroke={T.graphite} strokeWidth="1.6" />
      <path
        d="M 6.8 12.4 L 10.6 16.1 L 17.4 8.6"
        fill="none"
        stroke={T.ink}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Ink-stroke social glyphs (Ending Socials) ─────────────────────────────────
function SocialGlyph({ kind, size }: { kind: string; size: number }) {
  const c = {
    fill: "none",
    stroke: T.ink,
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {kind === "instagram" && (
        <>
          <rect x="3.5" y="3.5" width="17" height="17" rx="5" {...c} />
          <circle cx="12" cy="12" r="4.2" {...c} />
          <circle cx="17" cy="7" r="0.9" fill={T.ink} stroke="none" />
        </>
      )}
      {kind === "youtube" && (
        <>
          <rect x="2.5" y="5.5" width="19" height="13" rx="3.5" {...c} />
          <path d="M10.5 9.3 L15.6 12 L10.5 14.7 Z" {...c} />
        </>
      )}
      {kind === "linkedin" && (
        <>
          <rect x="3.5" y="3.5" width="17" height="17" rx="3" {...c} />
          <line x1="7" y1="10" x2="7" y2="16.5" {...c} />
          <circle cx="7" cy="7" r="0.7" fill={T.ink} stroke="none" />
          <path d="M11 16.5 V10.5 M11 12.6 C11.6 10.9 13.4 10.6 14.6 11.3 C15.7 12 15.6 13.4 15.6 14.4 V16.5" {...c} />
        </>
      )}
      {kind === "substack" && (
        <>
          <line x1="5" y1="5.5" x2="19" y2="5.5" {...c} />
          <line x1="5" y1="9.5" x2="19" y2="9.5" {...c} />
          <path d="M5 13.2 V19.5 L12 15.8 L19 19.5 V13.2 Z" {...c} />
        </>
      )}
    </svg>
  );
}

// ── Scene 1 · Masthead ───────────────────────────────────────────────────────
// Centered chrome rail · big ink headline · sharp ink line chart · deck · byline.
function MastheadSlide({ active }: { active: boolean }) {
  const chart = [
    [10, 56], [48, 30], [78, 44], [110, 18], [150, 34], [190, 8],
    [230, 26], [270, 6], [310, 30], [350, 22], [392, 48], [432, 38], [470, 58],
  ];
  const path = `M ${chart.map((p) => p.join(",")).join(" L ")}`;
  return (
    <PaperCanvas>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "20px 26px",
          boxSizing: "border-box",
          textAlign: "center",
        }}
      >
        {/* Top rail chrome */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 24,
            fontSize: 7.5,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: T.graphite,
            opacity: active ? 1 : 0,
            transition: "opacity 0.6s ease",
          }}
        >
          <span>Positioning Digest</span>
          <span>April 2026</span>
        </div>

        {/* Headline */}
        <div
          style={{
            marginTop: 22,
            fontSize: 27,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            lineHeight: 1.12,
            color: T.ink,
            maxWidth: "90%",
            opacity: active ? 1 : 0,
            transform: active ? "translateY(0)" : "translateY(10px)",
            transition: "opacity 0.6s ease 0.2s, transform 0.6s ease 0.2s",
          }}
        >
          Get the trade before it happens.
        </div>

        {/* Sharp peaks line chart */}
        <div
          style={{
            width: "82%",
            marginTop: 14,
            opacity: active ? 1 : 0,
            transition: "opacity 0.8s ease 0.5s",
          }}
        >
          <svg viewBox="0 0 480 64" style={{ width: "100%", height: 56, overflow: "visible" }} preserveAspectRatio="none">
            <line x1="0" y1="60" x2="480" y2="60" stroke={T.silver} strokeWidth={1} />
            {/* Line draws itself left→right via dash-offset when the slide activates */}
            <path
              d={path}
              fill="none"
              stroke={T.ink}
              strokeWidth={2}
              strokeLinejoin="miter"
              strokeLinecap="square"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={active ? 0 : 1}
              style={{ transition: "stroke-dashoffset 1.4s ease 0.5s" }}
            />
            {/* Peak nodes pop in after the line reaches them */}
            <circle cx={190} cy={8} r={active ? 3.2 : 0} fill={T.graphite} style={{ transition: "r 0.3s ease 1.3s" }} />
            <circle cx={270} cy={6} r={active ? 3.2 : 0} fill={T.graphite} style={{ transition: "r 0.3s ease 1.5s" }} />
          </svg>
        </div>

        {/* Deck + byline pinned to bottom */}
        <div style={{ width: "100%", marginTop: "auto" }}>
          <div
            style={{
              fontSize: 7.5,
              fontWeight: 600,
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              color: T.graphite,
              maxWidth: "80%",
              margin: "0 auto 9px",
              lineHeight: 1.4,
              opacity: active ? 1 : 0,
              transition: "opacity 0.6s ease 0.7s",
            }}
          >
            Macro-to-Micro · April 2026 Positioning Digest
          </div>
          <div style={{ opacity: active ? 1 : 0, transition: "opacity 0.6s ease 0.85s" }}>
            <div style={{ width: "40%", margin: "0 auto 6px", height: 1, background: T.ink, opacity: 0.45 }} />
            <span style={{ fontSize: 9.5, fontWeight: 500, color: T.ink, opacity: 0.85, letterSpacing: "0.02em" }}>
              FJ Research Desk · Issue 14
            </span>
          </div>
        </div>
      </div>
    </PaperCanvas>
  );
}

// ── Scene 2 · Thesis Statement ────────────────────────────────────────────────
// 2px graphite left rule · eyebrow · subheading kicker · check-circle bullets.
function ThesisSlide({ active }: { active: boolean }) {
  const bullets = [
    "A synthetic bull rally cannot afford to stall.",
    "When flows exhaust, the bid disappears.",
  ];
  return (
    <PaperCanvas>
      {/* 2px graphite left rule */}
      <div
        style={{
          position: "absolute",
          left: "13%",
          top: "20%",
          width: 2,
          height: active ? "56%" : 0,
          background: T.graphite,
          transition: "height 0.8s ease 0.2s",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "calc(13% + 16px)",
          right: "10%",
          top: "20%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Eyebrow */}
        <div
          style={{
            fontSize: 7.5,
            fontWeight: 700,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: T.graphite,
            marginBottom: 8,
            opacity: active ? 1 : 0,
            transition: "opacity 0.6s ease 0.1s",
          }}
        >
          Thesis
        </div>

        {/* Subheading kicker */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.02em",
            color: T.graphite,
            marginBottom: 14,
            lineHeight: 1.25,
            opacity: active ? 0.95 : 0,
            transform: active ? "translateY(0)" : "translateY(8px)",
            transition: "opacity 0.6s ease 0.3s, transform 0.6s ease 0.3s",
          }}
        >
          Flows are the tell.
        </div>

        {/* Bulleted argument */}
        {bullets.map((line, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 9,
              marginBottom: 11,
              opacity: active ? 1 : 0,
              transform: active ? "translateY(0)" : "translateY(10px)",
              transition: `opacity 0.6s ease ${0.5 + i * 0.18}s, transform 0.6s ease ${0.5 + i * 0.18}s`,
            }}
          >
            <div style={{ marginTop: 2 }}>
              <CheckCircle size={15} />
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.22, color: T.ink, letterSpacing: "-0.005em" }}>
              {line}
            </span>
          </div>
        ))}

        {/* Footer tag with hand-drawn underline */}
        <div
          style={{
            marginTop: 6,
            alignSelf: "flex-start",
            position: "relative",
            paddingBottom: 5,
            opacity: active ? 1 : 0,
            transition: "opacity 0.6s ease 0.95s",
          }}
        >
          <span style={{ fontSize: 8, fontWeight: 600, letterSpacing: "0.08em", color: T.graphite }}>
            MACRO-TO-MICRO · 2026
          </span>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: T.graphite }} />
        </div>
      </div>
    </PaperCanvas>
  );
}

// ── Scene 2.5 · Market Annotation ─────────────────────────────────────────────
// Top chrome · chart label · animated line chart · axis labels · summary · footer.
function MarketAnnotationSlide({ active }: { active: boolean }) {
  const chartData = [
    [15, 60], [35, 48], [55, 72], [75, 42], [95, 68],
    [115, 38], [135, 58], [155, 32], [175, 64], [195, 45],
    [215, 74], [235, 52], [255, 80], [275, 48],
  ];
  const path = `M ${chartData.map((p) => p.join(",")).join(" L ")}`;
  return (
    <PaperCanvas>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          padding: "16px 20px",
          boxSizing: "border-box",
          textAlign: "center",
        }}
      >
        {/* Top chrome */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 18,
            fontSize: 6,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: T.graphite,
            marginBottom: 8,
            opacity: active ? 1 : 0,
            transition: "opacity 0.5s ease",
          }}
        >
          <span>Market Analysis</span>
          <span>May 2026</span>
        </div>

        {/* Chart label */}
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            color: T.ink,
            marginBottom: 8,
            opacity: active ? 1 : 0,
            transform: active ? "translateY(0)" : "translateY(6px)",
            transition: "opacity 0.5s ease 0.15s, transform 0.5s ease 0.15s",
          }}
        >
          S&P 500 · Daily Trend
        </div>

        {/* Chart area */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: active ? 1 : 0,
            transition: "opacity 0.6s ease 0.3s",
            marginBottom: 6,
          }}
        >
          <svg viewBox="0 0 280 80" style={{ width: "92%", height: "100%" }} preserveAspectRatio="xMidYMid meet">
            {/* Baseline */}
            <line x1="2" y1="76" x2="278" y2="76" stroke={T.silver} strokeWidth={0.8} />
            {/* Y axis ticks */}
            <line x1="0" y1="40" x2="280" y2="40" stroke={T.silver} strokeWidth={0.4} opacity={0.3} />
            {/* Chart line with animation */}
            <path
              d={path}
              fill="none"
              stroke={T.ink}
              strokeWidth={1.6}
              strokeLinejoin="miter"
              strokeLinecap="square"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={active ? 0 : 1}
              style={{ transition: "stroke-dashoffset 1.2s ease 0.4s" }}
            />
            {/* Peak indicator dot */}
            <circle cx={255} cy={40} r={active ? 2.2 : 0} fill={T.graphite} style={{ transition: "r 0.3s ease 1.5s" }} />
          </svg>
        </div>

        {/* Axis labels + summary */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
            fontSize: 7,
            fontWeight: 500,
            color: T.graphite,
            marginBottom: 6,
            opacity: active ? 1 : 0,
            transition: "opacity 0.5s ease 0.6s",
          }}
        >
          <span>Trading Date</span>
          <span>Price Index</span>
          <span>YTD · Daily</span>
        </div>

        {/* Footer summary */}
        <div
          style={{
            fontSize: 7,
            fontWeight: 400,
            lineHeight: 1.4,
            color: T.ink,
            maxWidth: "90%",
            margin: "0 auto",
            opacity: active ? 1 : 0,
            transition: "opacity 0.5s ease 0.75s",
          }}
        >
          Uptrend holds through May. Vol absorption supports continuation.
        </div>
      </div>
    </PaperCanvas>
  );
}

// ── Scene 3 · Deep Dive ───────────────────────────────────────────────────────
// Eyebrow · title with underlined last word · narration · labeled stat cards.
function DeepDiveSlide({ active }: { active: boolean }) {
  const stats = [
    { label: "Flows", value: "401(k) inflows 12th strongest on record" },
    { label: "Positioning", value: "Vol-control near full re-allocation" },
  ];
  return (
    <PaperCanvas>
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: "20px 26px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Eyebrow */}
        <div
          style={{
            fontSize: 7.5,
            fontWeight: 700,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: T.graphite,
            marginBottom: 6,
            opacity: active ? 1 : 0,
            transition: "opacity 0.6s ease",
          }}
        >
          Mechanism · Why the Bid Holds
        </div>

        {/* Title with underlined last word */}
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            lineHeight: 1.12,
            color: T.ink,
            opacity: active ? 1 : 0,
            transform: active ? "translateY(0)" : "translateY(8px)",
            transition: "opacity 0.6s ease 0.15s, transform 0.6s ease 0.15s",
          }}
        >
          Why the bid hasn&rsquo;t{" "}
          <span style={{ position: "relative", display: "inline-block" }}>
            broken
            <div
              style={{
                position: "absolute",
                left: 0,
                bottom: -3,
                height: 2.5,
                width: active ? "100%" : 0,
                background: T.graphite,
                transition: "width 0.6s ease 0.5s",
              }}
            />
          </span>{" "}
          yet.
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: T.silver, margin: "11px 0", opacity: active ? 1 : 0, transition: "opacity 0.6s ease 0.3s" }} />

        {/* Narration */}
        <div
          style={{
            fontSize: 9,
            fontWeight: 400,
            lineHeight: 1.5,
            color: T.ink,
            opacity: active ? 0.92 : 0,
            transform: active ? "translateY(0)" : "translateY(8px)",
            transition: "opacity 0.6s ease 0.4s, transform 0.6s ease 0.4s",
            marginBottom: 14,
          }}
        >
          Mechanical flows from allocators and trend-followers form a persistent
          backstop. Until that absorption fails, the path stays higher.
        </div>

        {/* Stat cards */}
        <div style={{ display: "flex", gap: 10, marginTop: "auto" }}>
          {stats.map((s, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                border: `1px solid ${T.ink}`,
                borderRadius: 3,
                padding: "8px 9px",
                opacity: active ? 1 : 0,
                transform: active ? "translateY(0)" : "translateY(10px)",
                transition: `opacity 0.6s ease ${0.55 + i * 0.15}s, transform 0.6s ease ${0.55 + i * 0.15}s`,
              }}
            >
              <div
                style={{
                  fontSize: 7,
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: T.graphite,
                  marginBottom: 5,
                }}
              >
                {s.label}
              </div>
              <div style={{ fontSize: 10, fontWeight: 500, lineHeight: 1.35, color: T.ink }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>
    </PaperCanvas>
  );
}

// ── Scene 4 · Ending Socials ──────────────────────────────────────────────────
// Centered ink monogram · brand wordmark · sign-off · caption · social row · CTA.
function EndingSocialsSlide({ active }: { active: boolean }) {
  const socials = ["instagram", "youtube", "linkedin", "substack"];
  return (
    <PaperCanvas>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "18px 26px",
          boxSizing: "border-box",
          gap: 9,
        }}
      >
        {/* Square ink monogram — outline draws on entry, then "FJ" fades in */}
        <div style={{ position: "relative", width: 34, height: 34 }}>
          <svg width={34} height={34} viewBox="0 0 34 34" style={{ display: "block", position: "absolute", inset: 0 }}>
            <rect
              x="1.5"
              y="1.5"
              width="31"
              height="31"
              fill="none"
              stroke={T.ink}
              strokeWidth="1.5"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={active ? 0 : 1}
              style={{ transition: "stroke-dashoffset 0.7s ease" }}
            />
          </svg>
          <span
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 700,
              color: T.ink,
              letterSpacing: "-0.02em",
              opacity: active ? 1 : 0,
              transition: "opacity 0.5s ease 0.5s",
            }}
          >
            FJ
          </span>
        </div>

        {/* Brand wordmark */}
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: T.ink,
            opacity: active ? 1 : 0,
            transition: "opacity 0.6s ease 0.2s",
          }}
        >
          FJ Research
        </div>

        {/* Sign-off title */}
        <div
          style={{
            fontSize: 23,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            color: T.ink,
            textAlign: "center",
            opacity: active ? 1 : 0,
            transform: active ? "translateY(0)" : "translateY(8px)",
            transition: "opacity 0.6s ease 0.3s, transform 0.6s ease 0.3s",
          }}
        >
          Follow the desk.
        </div>

        {/* Caption */}
        <div
          style={{
            fontSize: 8.5,
            fontWeight: 500,
            letterSpacing: "0.06em",
            color: T.graphite,
            opacity: active ? 1 : 0,
            transition: "opacity 0.6s ease 0.4s",
          }}
        >
          Newsletter · Podcast · Live sessions
        </div>

        {/* Social row */}
        <div style={{ display: "flex", gap: 16, marginTop: 2 }}>
          {socials.map((kind, i) => (
            <div
              key={kind}
              style={{
                opacity: active ? 1 : 0,
                transform: active ? "translateY(0)" : "translateY(6px)",
                transition: `opacity 0.5s ease ${0.5 + i * 0.07}s, transform 0.5s ease ${0.5 + i * 0.07}s`,
              }}
            >
              <SocialGlyph kind={kind} size={18} />
            </div>
          ))}
        </div>

        {/* CTA pill + ribbon */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 7,
            marginTop: 4,
            opacity: active ? 1 : 0,
            transition: "opacity 0.6s ease 0.75s",
          }}
        >
          <div style={{ border: `1.5px solid ${T.ink}`, borderRadius: 3, padding: "5px 12px" }}>
            <span style={{ fontSize: 8, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: T.ink }}>
              Subscribe
            </span>
          </div>
          <span style={{ fontSize: 8, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: T.graphite }}>
            fjresearch.com
          </span>
        </div>
      </div>
    </PaperCanvas>
  );
}

// ── Marquee driver ───────────────────────────────────────────────────────────
const SLIDES = [
  { Comp: MastheadSlide, layout: "masthead" },
  { Comp: ThesisSlide, layout: "thesis_statement" },
  { Comp: MarketAnnotationSlide, layout: "market_annotation" },
  { Comp: DeepDiveSlide, layout: "deep_dive" },
  { Comp: EndingSocialsSlide, layout: "ending_socials" },
];

export default function FJResearchPreview({ thumbnailMode = false }: { thumbnailMode?: boolean } = {}) {
  const [current, setCurrent] = useState(0);
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(true);
    if (thumbnailMode) return;
    const id = setInterval(() => {
      setActive(false);
      setTimeout(() => {
        setCurrent((c) => (c + 1) % SLIDES.length);
        setActive(true);
      }, 150);
    }, 3800);
    return () => clearInterval(id);
  }, [thumbnailMode]);

  const { Comp } = SLIDES[current];

  return (
    <ScaledCanvas>
      <div style={{ width: "100%", height: "100%", position: "relative" }}>
        <Comp active={active} />
      </div>
    </ScaledCanvas>
  );
}
