/**
 * Lightweight inline-code preview for the FJ Research crafted template.
 *
 * Editorial paper system — flat white canvas, ink-black IBM Plex Mono type,
 * graphite eyebrows/accents, silver hairlines, no shadows. Mirrors the live
 * template with actual animation timings from the layouts. Cycles 4 scenes:
 *   1. Masthead        2. Thesis Statement
 *   3. Framework Flow  4. Deep Dive
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
const SERIF = "'Playfair Display', serif";
const FUNCION = "'IBM Plex Sans', sans-serif";

// ── Animation easing function copied from real template (themeUtils.ts) ──────
// r(frame_position, start, end) creates smooth easing from 0→1 over the interval
function r(pos: number, start: number, end: number): number {
  if (pos < start) return 0;
  if (pos > end) return 1;
  const t = (pos - start) / (end - start);
  return Math.sin((t - 0.5) * Math.PI) * 0.5 + 0.5;
}

// ── Scaled 16:9 stage ────────────────────────────────────────────────────────
function ScaledCanvas({ children }: { children: (framePos: number) => React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.getBoundingClientRect().width / INTERNAL_W);
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    // Animate the preview scene through one full cycle (~3.8 seconds at 30fps = ~114 frames)
    let animFrame: number;
    let frameNum = 0;
    const animate = () => {
      frameNum = (frameNum + 1) % 114;
      setFrame(frameNum / 90); // Normalize to 0-1.27 range for animation easing
      animFrame = requestAnimationFrame(animate);
    };
    animFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame);
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
        {children(frame)}
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
// Animations copied from FJResearchMasthead.tsx
function MastheadSlide({ framePos }: { framePos: number }) {
  const chart = [
    [10, 56], [48, 30], [78, 44], [110, 18], [150, 34], [190, 8],
    [230, 26], [270, 6], [310, 30], [350, 22], [392, 48], [432, 38], [470, 58],
  ];
  const path = `M ${chart.map((p) => p.join(",")).join(" L ")}`;
  const totalPathLength = chart.reduce((sum, pt, i, arr) => {
    if (i === 0) return 0;
    const prev = arr[i - 1];
    const dx = pt[0] - prev[0];
    const dy = pt[1] - prev[1];
    return sum + Math.sqrt(dx * dx + dy * dy);
  }, 0);

  // Animation timings from FJResearchMasthead
  const ra = r(framePos, 0, 0.20);      // Chrome / top rail
  const rb = r(framePos, 0.10, 0.35);   // Title entry
  const rc = r(framePos, 0.38, 0.72);   // Chart draw (CAMERA_END + 2 frames, then 60 frame window)
  const re = r(framePos, 0.62, 0.86);   // Subheading deck
  const rd = r(framePos, 0.72, 0.96);   // Byline footer

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
            opacity: ra,
            transition: "opacity 0.2s ease",
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
            opacity: rb,
            transform: `translateY(${(1 - rb) * 15}px)`,
            fontFamily: SERIF,
          }}
        >
          Get the trade before it happens.
        </div>

        {/* Sharp peaks line chart */}
        <div
          style={{
            width: "82%",
            marginTop: 14,
            opacity: Math.min(rc * 1.3, 1),
          }}
        >
          <svg viewBox="0 0 480 64" style={{ width: "100%", height: 56, overflow: "visible" }} preserveAspectRatio="none">
            <line x1="0" y1="60" x2="480" y2="60" stroke={T.silver} strokeWidth={1} />
            {/* Line draws itself left→right via dash-offset */}
            <path
              d={path}
              fill="none"
              stroke={T.ink}
              strokeWidth={2}
              strokeLinejoin="miter"
              strokeLinecap="square"
              strokeDasharray={totalPathLength}
              strokeDashoffset={totalPathLength * (1 - rc)}
              opacity={0.85}
            />
            {/* Peak nodes pop in after the line reaches them */}
            <circle cx={190} cy={8} r={rc > 0.6 ? 3.2 : 0} fill={T.graphite} />
            <circle cx={270} cy={6} r={rc > 0.7 ? 3.2 : 0} fill={T.graphite} />
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
              opacity: re * 0.9,
              transform: `translateY(${(1 - re) * 10}px)`,
            }}
          >
            Macro-to-Micro · April 2026 Positioning Digest
          </div>
          <div style={{ opacity: rd }}>
            <div style={{ width: "40%", margin: "0 auto 6px", height: 1, background: T.ink, opacity: 0.3, marginBottom: 6 }} />
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
// Animations copied from FJResearchThesisStatement.tsx
function ThesisSlide({ framePos }: { framePos: number }) {
  const bullets = [
    "A synthetic bull rally cannot afford to stall.",
    "When flows exhaust, the bid disappears.",
  ];

  // Animation timings from FJResearchThesisStatement
  const ra = r(framePos, 0, 0.20);
  const rb = r(framePos, 0.14, 0.40);   // subheading / left rule
  const rn = r(framePos, 0.5, 0.74);    // narration sub-text
  const rd = r(framePos, 0.68, 0.92);   // footer

  const ruleH = rb * (270 * 0.62);

  return (
    <PaperCanvas>
      {/* 2px graphite left rule */}
      <div
        style={{
          position: "absolute",
          left: "13%",
          top: "20%",
          width: 2,
          height: ruleH,
          background: T.graphite,
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
            opacity: ra,
            fontFamily: FUNCION,
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
            opacity: rb * 0.92,
            transform: `translateY(${(1 - rb) * 14}px)`,
            fontFamily: SERIF,
          }}
        >
          Flows are the tell.
        </div>

        {/* Bulleted argument */}
        {bullets.map((line, i) => {
          const stagger = 0.078;
          const start = 0.2 + i * stagger;
          const end = 0.3 + i * stagger;
          const rb_i = r(framePos, start, end);
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 9,
                marginBottom: 11,
                opacity: rb_i,
                transform: `translateY(${(1 - rb_i) * 14}px)`,
              }}
            >
              <div style={{ marginTop: 2 }}>
                <CheckCircle size={15} />
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.22, color: T.ink, letterSpacing: "-0.005em", fontFamily: SERIF }}>
                {line}
              </span>
            </div>
          );
        })}

        {/* Footer tag */}
        <div
          style={{
            marginTop: 6,
            alignSelf: "flex-start",
            position: "relative",
            paddingBottom: 5,
            opacity: rd,
          }}
        >
          <span style={{ fontSize: 8, fontWeight: 600, letterSpacing: "0.08em", color: T.graphite, fontFamily: FUNCION }}>
            MACRO-TO-MICRO · 2026
          </span>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: T.graphite }} />
        </div>
      </div>
    </PaperCanvas>
  );
}

// ── Scene 3 · Framework Flow ───────────────────────────────────────────────
// Numbered methodology with vertical flow animation. Steps appear with stagger.
// Animations copied from FJResearchFrameworkFlow.tsx
function FrameworkFlowSlide({ framePos }: { framePos: number }) {
  const steps = [
    { number: "01", label: "Macro", sub: "Worldview" },
    { number: "02", label: "Intermarket", sub: "Cross-asset" },
    { number: "03", label: "Pattern", sub: "Recognition" },
    { number: "04", label: "Technical", sub: "Levels" },
  ];

  // Animation timings from FJResearchFrameworkFlow
  const ra = r(framePos, 0, 0.17);     // header
  const rFooter = r(framePos, 0.66, 0.83); // footer
  const stagger = 0.078;
  const n = steps.length;

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
        }}
      >
        {/* Header */}
        <div style={{ opacity: ra, marginBottom: 12 }}>
          <div
            style={{
              fontFamily: FUNCION,
              fontWeight: 700,
              fontSize: 6,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: T.graphite,
              marginBottom: 4,
            }}
          >
            THE PROCESS · 4 STEPS
          </div>
          <div
            style={{
              fontFamily: SERIF,
              fontWeight: 700,
              fontSize: 18,
              letterSpacing: "-0.015em",
              lineHeight: 1.08,
              color: T.ink,
            }}
          >
            Macro down to micro.
          </div>
        </div>

        {/* Steps flow */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {steps.map((step, i) => {
            const start = 0.2 + i * stagger;
            const end = 0.3 + i * stagger;
            const numP = r(framePos, start, end);
            const labelP = r(framePos, start + 0.07, end + 0.07);
            const isLast = i === n - 1;

            return (
              <div key={i} style={{ display: "flex", position: "relative", marginBottom: 8 }}>
                {/* Number + connector */}
                <div style={{ flex: "0 0 auto", width: 48, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div
                    style={{
                      fontFamily: FUNCION,
                      fontWeight: 700,
                      fontSize: 18,
                      letterSpacing: "-0.04em",
                      lineHeight: 1,
                      color: T.ink,
                      opacity: numP,
                      transform: `translateY(${(1 - numP) * 16}px)`,
                    }}
                  >
                    {step.number}
                  </div>
                  {!isLast && (
                    <div style={{ flex: 1, minHeight: 16, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 4 }}>
                      <div
                        style={{
                          width: 1,
                          height: "100%",
                          background: T.silver,
                          transformOrigin: "top",
                          transform: `scaleY(${labelP})`,
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Label + sub */}
                <div style={{ flex: 1, paddingTop: 3, paddingBottom: 6, opacity: labelP, transform: `translateY(${(1 - labelP) * 10}px)` }}>
                  <div
                    style={{
                      fontFamily: FUNCION,
                      fontWeight: 700,
                      fontSize: 10,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: T.ink,
                    }}
                  >
                    {step.label}
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: 7, color: T.graphite, letterSpacing: "0.04em" }}>{step.sub}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ opacity: rFooter, fontSize: 7, color: T.graphite, fontFamily: FUNCION, textAlign: "center" }}>
          A funnel from worldview to trade.
        </div>
      </div>
    </PaperCanvas>
  );
}

// ── Scene 4 · Deep Dive ───────────────────────────────────────────────────────
// Eyebrow · title with underlined last word · narration · labeled stat cards.
// Animations copied from FJResearchDeepDive.tsx
function DeepDiveSlide({ framePos }: { framePos: number }) {
  const stats = [
    { label: "Flows", value: "401(k) inflows 12th strongest" },
    { label: "Positioning", value: "Vol-control near full re-allocation" },
  ];

  // Animation timings from FJResearchDeepDive
  const ra = r(framePos, 0, 0.20);
  const rb = r(framePos, 0.10, 0.38);   // title
  const rn = r(framePos, 0.28, 0.55);   // narration
  const rd = r(framePos, 0.45, 0.72);   // stat cards

  return (
    <PaperCanvas>
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: "16px 20px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Eyebrow */}
        <div
          style={{
            fontSize: 6,
            fontWeight: 700,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: T.graphite,
            marginBottom: 6,
            opacity: ra,
            fontFamily: FUNCION,
          }}
        >
          Mechanism · Why the Bid Holds
        </div>

        {/* Title with underlined last word */}
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            lineHeight: 1.12,
            color: T.ink,
            opacity: rb,
            transform: `translateY(${(1 - rb) * 12}px)`,
            marginBottom: 8,
            fontFamily: SERIF,
          }}
        >
          Why the bid hasn&rsquo;t{" "}
          <span style={{ position: "relative", display: "inline-block" }}>
            broken
            <div
              style={{
                position: "absolute",
                left: 0,
                bottom: -2,
                height: 1.5,
                width: `${rb * 100}%`,
                background: T.graphite,
              }}
            />
          </span>{" "}
          yet.
        </div>

        {/* Divider */}
        <div style={{ height: 0.5, background: T.silver, margin: "8px 0", opacity: rb * 0.5 }} />

        {/* Narration */}
        <div
          style={{
            fontSize: 7,
            fontWeight: 400,
            lineHeight: 1.4,
            color: T.ink,
            opacity: rn * 0.92,
            transform: `translateY(${(1 - rn) * 8}px)`,
            marginBottom: 10,
            fontFamily: FONT,
          }}
        >
          Mechanical flows form a persistent backstop. The path stays higher.
        </div>

        {/* Stat cards */}
        <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
          {stats.map((s, i) => {
            const cardDelay = 0.08 + i * 0.1;
            const cardOpacity = r(framePos, 0.45 + cardDelay, 0.6 + cardDelay);
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  border: `0.8px solid ${T.ink}`,
                  borderRadius: 2,
                  padding: "6px 7px",
                  opacity: cardOpacity,
                  transform: `translateY(${(1 - cardOpacity) * 10}px)`,
                }}
              >
                <div
                  style={{
                    fontSize: 6,
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: T.graphite,
                    marginBottom: 4,
                    fontFamily: FUNCION,
                  }}
                >
                  {s.label}
                </div>
                <div style={{ fontSize: 8, fontWeight: 500, lineHeight: 1.3, color: T.ink, fontFamily: FONT }}>{s.value}</div>
              </div>
            );
          })}
        </div>
      </div>
    </PaperCanvas>
  );
}

// ── Scene 5 · Ending Socials ──────────────────────────────────────────────────
// Centered ink monogram · brand wordmark · sign-off · caption · social row · CTA.
// Animations copied from FJResearchEndingSocials.tsx
function EndingSocialsSlide({ framePos }: { framePos: number }) {
  const socials = ["instagram", "youtube", "linkedin", "substack"];

  // Animation timings from FJResearchEndingSocials
  const rm = r(framePos, 0, 0.12);      // monogram outline
  const rb = r(framePos, 0.08, 0.22);   // "FJ" text
  const rn = r(framePos, 0.12, 0.32);   // brand name
  const rt = r(framePos, 0.18, 0.42);   // title
  const rc = r(framePos, 0.28, 0.52);   // caption
  const rs = r(framePos, 0.38, 0.62);   // social icons (staggered)
  const rc_final = r(framePos, 0.48, 0.72); // CTA

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
          padding: "14px 20px",
          boxSizing: "border-box",
          gap: 7,
        }}
      >
        {/* Square ink monogram */}
        <div style={{ position: "relative", width: 32, height: 32 }}>
          <svg width={32} height={32} viewBox="0 0 34 34" style={{ display: "block", position: "absolute", inset: 0 }}>
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
              strokeDashoffset={1 - rm}
            />
          </svg>
          <span
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              color: T.ink,
              letterSpacing: "-0.02em",
              opacity: rb,
              fontFamily: FUNCION,
            }}
          >
            FJ
          </span>
        </div>

        {/* Brand wordmark */}
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: T.ink,
            opacity: rn,
            fontFamily: FUNCION,
          }}
        >
          FJ Research
        </div>

        {/* Sign-off title */}
        <div
          style={{
            fontSize: 19,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            color: T.ink,
            textAlign: "center",
            opacity: rt,
            transform: `translateY(${(1 - rt) * 8}px)`,
            fontFamily: SERIF,
          }}
        >
          Follow the desk.
        </div>

        {/* Caption */}
        <div
          style={{
            fontSize: 7,
            fontWeight: 500,
            letterSpacing: "0.06em",
            color: T.graphite,
            opacity: rc,
            fontFamily: FUNCION,
          }}
        >
          Newsletter · Podcast · Live
        </div>

        {/* Social row */}
        <div style={{ display: "flex", gap: 12, marginTop: 2 }}>
          {socials.map((kind, i) => {
            const socialDelay = i * 0.07;
            const socialOpacity = r(framePos, 0.38 + socialDelay, 0.54 + socialDelay);
            return (
              <div
                key={kind}
                style={{
                  opacity: socialOpacity,
                  transform: `translateY(${(1 - socialOpacity) * 6}px)`,
                }}
              >
                <SocialGlyph kind={kind} size={16} />
              </div>
            );
          })}
        </div>

        {/* CTA pill + ribbon */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 5,
            marginTop: 3,
            opacity: rc_final,
          }}
        >
          <div style={{ border: `1px solid ${T.ink}`, borderRadius: 2, padding: "4px 10px" }}>
            <span style={{ fontSize: 7, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: T.ink, fontFamily: FUNCION }}>
              Subscribe
            </span>
          </div>
          <span style={{ fontSize: 7, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.graphite, fontFamily: FUNCION }}>
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
  { Comp: FrameworkFlowSlide, layout: "framework_flow" },
  { Comp: DeepDiveSlide, layout: "deep_dive" },
  { Comp: EndingSocialsSlide, layout: "ending_socials" },
];

export default function FJResearchPreview({ thumbnailMode = false }: { thumbnailMode?: boolean } = {}) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (thumbnailMode) return;
    const id = setInterval(() => {
      setCurrent((c) => (c + 1) % SLIDES.length);
    }, 3800);
    return () => clearInterval(id);
  }, [thumbnailMode]);

  const { Comp } = SLIDES[current];

  return (
    <ScaledCanvas>
      {(framePos: number) => (
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
          <Comp framePos={framePos} />
        </div>
      )}
    </ScaledCanvas>
  );
}
