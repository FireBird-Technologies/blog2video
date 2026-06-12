import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { ChronicleLayoutProps } from "../types";
import {
  CHRONICLE_BODY_FONT,
  CHRONICLE_HEADING_FONT,
} from "../../../../fonts/chronicle-defaults";
import {
  OrnamentalBorder,
  OrnamentalCorner,
  InkDivider,
} from "../components/OrnamentalBorder";
import { WaxSeal } from "../components/WaxSeal";
import { EmberSparks } from "../components/ChronicleArtifacts";
import { QuillText } from "../components/QuillInk";
import { stripChapterPrefix } from "./ChapterPlate";

/**
 * BookOpen — scene 0 opener.
 *
 * Act 1 (0–20)    Closed leather tome sits center-frame, candlelit from the
 *                 upper-left. Gold-tooled frame, raised spine bands, brass
 *                 corner guards, and clasps hold it shut. A red wax seal
 *                 bears the monogram.
 * Act 2 (20–38)   The seal cracks, clasps snap open, a warm glow spills
 *                 from inside the book.
 * Act 3 (38–64)   The front cover swings open (3D rotateY around the spine),
 *                 several pages flutter through.
 * Act 4 (64+)     The camera pushes into the opened page and the frame
 *                 becomes the title page — ornamental border draws in,
 *                 title and subtitle fade in as whole blocks (diary ink),
 *                 LOTR-style burn glow on the title, wax seal settles below.
 */
export const BookOpen: React.FC<ChronicleLayoutProps> = ({
  title = "A Story Begins",
  narration,
  accentColor = "#B8860B",
  bgColor = "#F1E4C9",
  textColor = "#2A1810",
  aspectRatio = "landscape",
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps, width, height } = useVideoConfig();
  const p = aspectRatio === "portrait" || height > width;

  // ── Act timing ──────────────────────────────────────────
  // Slowed ~1.55× from the original (20/34/38/64/86) so the opening
  // breathes — the closed book sits longer before the seal cracks, the
  // cover opens with weight, and the title page settles in slowly.
  const SEAL_CRACK_START = 32;
  const SEAL_CRACK_END = 54;
  const COVER_OPEN_START = 60;
  const TITLE_REVEAL_START = 100;
  const TITLE_PUSH_IN_END = 134;

  // Act 1: settle in (slowed — softer, weightier landing)
  const bookSettle = spring({
    frame: frame - 2,
    fps,
    config: { damping: 26, stiffness: 75, mass: 1.4 },
  });

  // Act 2: seal crack + clasp release
  const sealCrack = interpolate(
    frame,
    [SEAL_CRACK_START, SEAL_CRACK_END],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const claspRelease = interpolate(
    frame,
    [SEAL_CRACK_START + 2, SEAL_CRACK_END + 6],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  // Inner glow leaking through the cracking seal
  const innerGlow = interpolate(
    frame,
    [SEAL_CRACK_START + 6, COVER_OPEN_START + 8],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Act 3: cover opens — slower swing, heavier mass, softer stiffness so
  // the cover unhinges with weight, like a real heavy tome.
  const coverSpring = spring({
    frame: frame - COVER_OPEN_START,
    fps,
    config: { damping: 18, stiffness: 38, mass: 1.8 },
  });
  const coverRotate = interpolate(coverSpring, [0, 1], [0, -168]);

  // Act 4: camera pushes into open page, title page takes over
  const titlePageOp = interpolate(
    frame,
    [TITLE_REVEAL_START, TITLE_PUSH_IN_END],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Scene outro
  const outroFade = interpolate(
    frame,
    [durationInFrames - 18, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Book geometry
  const bookW = p ? Math.min(width * 0.72, 760) : Math.min(width * 0.5, 980);
  const bookH = bookW * 1.42;

  // Subtle levitation + scale-in for the book on enter
  const bookY = interpolate(bookSettle, [0, 1], [18, 0]);
  const bookScale = interpolate(bookSettle, [0, 1], [0.92, 1]);
  // Tiny continuous hover once settled
  const hover = Math.sin((frame / 30) * Math.PI) * 2;

  const heading = fontFamily ?? CHRONICLE_HEADING_FONT;
  const body = fontFamily ?? CHRONICLE_BODY_FONT;

  // Strip any "Chapter N:" prefix that an older LLM run baked into the title.
  const cleanTitle = stripChapterPrefix(title);

  // Derive the seal monogram from the actual title so no theme text is hardcoded.
  const monogram = (cleanTitle.match(/[A-Za-z]/)?.[0] ?? "A").toUpperCase();

  // Cover leather palette — rich oxblood-brown with gold tooling
  const LEATHER_DARK = "#2E1508";
  const LEATHER_MID = "#5A2E15";
  const LEATHER_HIGH = "#7A4320";
  const GOLD = accentColor;
  const GOLD_DIM = "#8C6518";
  const WAX_RED = "#7A2418";

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        fontFamily: body,
        opacity: outroFade,
      }}
    >
      {/* Embers rise through the grand opening for candlelit drama. */}
      <EmberSparks count={18} seed={13} intensity={1} />

      {/* ───── Act 1-3: the closed/opening book ───── */}
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          opacity: 1 - titlePageOp,
          perspective: "2800px",
        }}
      >
        {/* Ground shadow beneath the book */}
        <div
          style={{
            position: "absolute",
            width: bookW * 1.05,
            height: bookH * 0.08,
            bottom: `calc(50% - ${bookH * 0.55}px)`,
            background:
              "radial-gradient(ellipse at center, rgba(20,10,4,0.55) 0%, rgba(20,10,4,0.2) 40%, transparent 75%)",
            filter: "blur(14px)",
            transform: `scale(${0.9 + 0.1 * bookSettle})`,
          }}
        />

        <div
          style={{
            width: bookW,
            height: bookH,
            position: "relative",
            transformStyle: "preserve-3d",
            transform: `translateY(${bookY + hover}px) scale(${bookScale})`,
          }}
        >
          {/* Warm inner glow escaping the book as it cracks open */}
          <div
            style={{
              position: "absolute",
              inset: "-12%",
              background: `radial-gradient(ellipse at center, rgba(255, 200, 110, ${0.55 * innerGlow}) 0%, rgba(255, 160, 60, ${0.25 * innerGlow}) 30%, transparent 65%)`,
              pointerEvents: "none",
              filter: "blur(30px)",
              zIndex: 0,
            }}
          />

          {/* ── Back cover + page block (stays put) ── */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `
                linear-gradient(135deg, ${LEATHER_DARK} 0%, ${LEATHER_MID} 48%, ${LEATHER_DARK} 100%)
              `,
              borderRadius: "4px 10px 10px 4px",
              boxShadow:
                "0 42px 70px rgba(0,0,0,0.7), 0 12px 20px rgba(0,0,0,0.35), inset 0 0 0 3px #1A0B04",
            }}
          />

          {/* Page-stack edges on all sides (gilded, stitched) */}
          <div
            style={{
              position: "absolute",
              top: "3%",
              bottom: "3%",
              left: "3%",
              right: "3%",
              background: `
                repeating-linear-gradient(to bottom, #E8D8B0 0, #E8D8B0 2px, #C5AE7E 2px, #C5AE7E 3px)
              `,
              borderRadius: 2,
              boxShadow: "inset 0 0 0 1px rgba(100,70,30,0.35)",
              opacity: 0.95,
            }}
          />
          {/* Extra page stack peeking on right (fore-edge) */}
          <div
            style={{
              position: "absolute",
              top: "3.5%",
              bottom: "3.5%",
              right: "-1.5%",
              width: "3%",
              background:
                "repeating-linear-gradient(to bottom, #F0DFB4 0, #F0DFB4 1px, #BFA36F 1px, #BFA36F 2px)",
              borderRadius: "0 3px 3px 0",
              boxShadow: "2px 0 4px rgba(0,0,0,0.35)",
              zIndex: 1,
            }}
          />

          {/* Inner pages flutter during cover open (several) */}
          {[0, 1, 2, 3, 4].map((i) => {
            const start = COVER_OPEN_START + 4 + i * 4;
            const op = interpolate(
              frame,
              [start, start + 3, start + 12],
              [0, 0.9, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );
            const rot = interpolate(frame, [start, start + 14], [0, -172], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <div
                key={`page-${i}`}
                style={{
                  position: "absolute",
                  inset: "4%",
                  background:
                    "linear-gradient(90deg, #F4E6C8 0%, #EDD9A8 50%, #F4E6C8 100%)",
                  borderRadius: 2,
                  opacity: op,
                  transformOrigin: "left center",
                  transform: `rotateY(${rot}deg) translateZ(${1 + i}px)`,
                  boxShadow:
                    "0 0 16px rgba(40,25,12,0.45), inset 0 0 0 1px rgba(150,110,60,0.3)",
                  zIndex: 2,
                }}
              />
            );
          })}

          {/* ── Front cover (rotates open around left spine) ── */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `
                radial-gradient(ellipse at 32% 25%, ${LEATHER_HIGH} 0%, ${LEATHER_MID} 35%, ${LEATHER_DARK} 90%),
                ${LEATHER_MID}
              `,
              borderRadius: "4px 10px 10px 4px",
              border: `3px solid ${LEATHER_DARK}`,
              boxShadow: `
                0 24px 56px rgba(0,0,0,0.6),
                inset 0 0 120px rgba(20,8,2,0.55),
                inset 0 2px 0 rgba(255,200,150,0.12)
              `,
              transformOrigin: "left center",
              transform: `rotateY(${coverRotate}deg)`,
              transformStyle: "preserve-3d",
              backfaceVisibility: "hidden",
              zIndex: 3,
            }}
          >
            {/* Leather grain (SVG turbulence) */}
            <svg
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                opacity: 0.35,
                mixBlendMode: "multiply",
                borderRadius: "4px 10px 10px 4px",
                overflow: "hidden",
              }}
            >
              <defs>
                <filter id="bo-leather">
                  <feTurbulence
                    type="fractalNoise"
                    baseFrequency="0.8"
                    numOctaves="2"
                    stitchTiles="stitch"
                  />
                  <feColorMatrix
                    type="matrix"
                    values="0 0 0 0 0.13
                            0 0 0 0 0.06
                            0 0 0 0 0.03
                            0 0 0 0.55 0"
                  />
                </filter>
              </defs>
              <rect width="100%" height="100%" filter="url(#bo-leather)" />
            </svg>

            {/* Gold tooled outer frame */}
            <div
              style={{
                position: "absolute",
                inset: "5%",
                border: `1.5px solid ${GOLD}`,
                boxShadow: `inset 0 0 0 3px transparent, inset 0 0 0 4px ${GOLD}`,
                borderRadius: 2,
                opacity: 0.9,
              }}
            />
            {/* Inner gold hairline */}
            <div
              style={{
                position: "absolute",
                inset: "9%",
                border: `1px solid ${GOLD_DIM}`,
                borderRadius: 2,
                opacity: 0.7,
              }}
            />

            {/* Gold corner flourishes on cover */}
            <div style={{ position: "absolute", inset: "5%" }}>
              <OrnamentalCorner
                position="top-left"
                size={bookW * 0.18}
                color={GOLD}
                variant="fleur"
                startFrame={0}
              />
              <OrnamentalCorner
                position="top-right"
                size={bookW * 0.18}
                color={GOLD}
                variant="fleur"
                startFrame={0}
              />
              <OrnamentalCorner
                position="bottom-left"
                size={bookW * 0.18}
                color={GOLD}
                variant="fleur"
                startFrame={0}
              />
              <OrnamentalCorner
                position="bottom-right"
                size={bookW * 0.18}
                color={GOLD}
                variant="fleur"
                startFrame={0}
              />
            </div>

            {/* Raised spine bands (horizontal ridges on the left edge) */}
            {[0.18, 0.38, 0.58, 0.78].map((t, i) => (
              <div
                key={`band-${i}`}
                style={{
                  position: "absolute",
                  left: 0,
                  top: `${t * 100}%`,
                  width: "8%",
                  height: "2.6%",
                  background:
                    "linear-gradient(to bottom, #1A0A04 0%, #4A2612 50%, #1A0A04 100%)",
                  boxShadow: "inset 0 1px 0 rgba(255,200,150,0.15)",
                }}
              />
            ))}

            {/* Cover title — the actual scene title, gold-foil embossed.
                Scales down automatically so 1-6 word titles fit. */}
            <div
              style={{
                position: "absolute",
                top: "16%",
                left: "12%",
                right: "12%",
                height: "22%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                fontFamily: heading,
                fontWeight: 700,
                fontSize: coverTitleSize(cleanTitle, bookW),
                color: GOLD,
                letterSpacing: "0.18em",
                lineHeight: 1.05,
                textShadow:
                  "0 1px 0 #2A1810, 0 0 8px rgba(255,200,120,0.35), 0 2px 4px rgba(0,0,0,0.6)",
                textTransform: "uppercase",
                wordBreak: "break-word",
              }}
            >
              {cleanTitle}
            </div>

            {/* Central medallion ring */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "54%",
                transform: "translate(-50%, -50%)",
                width: bookW * 0.44,
                height: bookW * 0.44,
                borderRadius: "50%",
                border: `2px solid ${GOLD}`,
                boxShadow: `inset 0 0 0 4px rgba(0,0,0,0.4), inset 0 0 0 6px ${GOLD_DIM}, 0 0 26px rgba(255,200,120,${0.2 + 0.3 * innerGlow})`,
                background:
                  "radial-gradient(circle, rgba(255,200,120,0.06) 0%, rgba(0,0,0,0) 70%)",
              }}
            />

            {/* Wax seal centered */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "54%",
                transform: `translate(-50%, -50%) scale(${1 - sealCrack * 0.12}) rotate(${sealCrack * 18}deg)`,
                opacity: 1 - sealCrack * 0.35,
                filter:
                  sealCrack > 0.25
                    ? `drop-shadow(${sealCrack * 5}px 0 0 rgba(0,0,0,0.35))`
                    : "none",
              }}
            >
              <WaxSeal
                size={bookW * 0.34}
                instant
                monogram={monogram}
                color={WAX_RED}
              />
            </div>

            {/* Seal crack lines that appear as it breaks */}
            {sealCrack > 0.15 && (
              <svg
                viewBox="0 0 100 100"
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "54%",
                  width: bookW * 0.34,
                  height: bookW * 0.34,
                  transform: "translate(-50%, -50%)",
                  opacity: sealCrack,
                  pointerEvents: "none",
                }}
              >
                <path
                  d="M50,22 L47,38 L53,44 L46,55 L52,68 L48,82"
                  stroke="#1A0604"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                />
                <path
                  d="M50,40 L58,46 L62,58"
                  stroke="#1A0604"
                  strokeWidth="1.2"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            )}

            {/* Wax shards flying outward as seal cracks */}
            {sealCrack > 0.3 &&
              [0, 60, 120, 180, 240, 300].map((angle, i) => {
                const dist = 40 + sealCrack * 80;
                const tx = Math.cos((angle * Math.PI) / 180) * dist;
                const ty = Math.sin((angle * Math.PI) / 180) * dist;
                return (
                  <div
                    key={`shard-${i}`}
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: "54%",
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: WAX_RED,
                      transform: `translate(${tx}px, ${ty}px) rotate(${angle}deg)`,
                      opacity: interpolate(
                        sealCrack,
                        [0.3, 0.5, 1],
                        [0, 1, 0.4],
                      ),
                      boxShadow: "0 1px 2px rgba(0,0,0,0.5)",
                    }}
                  />
                );
              })}
          </div>

          {/* ── Brass corner guards (decorative metalwork at each cover corner) ── */}
          {[
            { top: "-2%", left: "-1.5%", rotate: 0 },
            { top: "-2%", right: "-1.5%", rotate: 90 },
            { bottom: "-2%", right: "-1.5%", rotate: 180 },
            { bottom: "-2%", left: "-1.5%", rotate: 270 },
          ].map((pos, i) => (
            <svg
              key={`corner-${i}`}
              viewBox="0 0 60 60"
              style={{
                position: "absolute",
                width: bookW * 0.09,
                height: bookW * 0.09,
                transform: `rotate(${pos.rotate}deg)`,
                zIndex: 4,
                filter: "drop-shadow(1px 1px 2px rgba(0,0,0,0.5))",
                ...(pos.top !== undefined && { top: pos.top }),
                ...(pos.bottom !== undefined && { bottom: pos.bottom }),
                ...(pos.left !== undefined && { left: pos.left }),
                ...(pos.right !== undefined && { right: pos.right }),
              }}
            >
              <defs>
                <linearGradient id={`brass-${i}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#E8C578" />
                  <stop offset="40%" stopColor="#B8860B" />
                  <stop offset="100%" stopColor="#6B4E0A" />
                </linearGradient>
              </defs>
              <path
                d="M0 0 L35 0 Q38 0 38 3 L38 12 L12 12 L12 38 Q12 38 3 38 L0 38 Z"
                fill={`url(#brass-${i})`}
                stroke="#3A2A08"
                strokeWidth="1"
              />
              <circle cx="8" cy="8" r="2.5" fill="#3A2A08" />
            </svg>
          ))}

          {/* ── Brass clasps (top + bottom, with articulation) ── */}
          {[0.18, 0.82].map((top, i) => {
            const claspRot = claspRelease * -48;
            return (
              <div
                key={`clasp-${i}`}
                style={{
                  position: "absolute",
                  top: `${top * 100}%`,
                  left: "-6%",
                  width: "20%",
                  height: "7%",
                  zIndex: 5,
                  transform: `translateY(-50%) rotate(${claspRot}deg)`,
                  transformOrigin: "right center",
                  filter: "drop-shadow(1px 2px 3px rgba(0,0,0,0.55))",
                }}
              >
                <svg viewBox="0 0 100 30" style={{ width: "100%", height: "100%" }}>
                  <defs>
                    <linearGradient id={`clasp-${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F2D686" />
                      <stop offset="35%" stopColor="#B8860B" />
                      <stop offset="70%" stopColor="#6B4E0A" />
                      <stop offset="100%" stopColor="#A3770A" />
                    </linearGradient>
                  </defs>
                  {/* Strap */}
                  <rect
                    x="0"
                    y="8"
                    width="70"
                    height="14"
                    rx="3"
                    fill={`url(#clasp-${i})`}
                    stroke="#3A2A08"
                    strokeWidth="1"
                  />
                  {/* Clasp hook */}
                  <path
                    d="M70 5 L95 5 Q100 5 100 10 L100 20 Q100 25 95 25 L70 25 Z"
                    fill={`url(#clasp-${i})`}
                    stroke="#3A2A08"
                    strokeWidth="1.2"
                  />
                  {/* Rivet */}
                  <circle cx="18" cy="15" r="3" fill="#3A2A08" />
                  <circle cx="18" cy="15" r="1.4" fill="#D4A94F" />
                </svg>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>

      {/* ───── Act 4: Illuminated title page ───── */}
      <AbsoluteFill
        style={{
          opacity: titlePageOp,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          padding: p ? "10% 9%" : "8% 12%",
        }}
      >
        {/* Double gold frame around the whole page */}
        <div
          style={{
            position: "absolute",
            inset: p ? "6%" : "5%",
            border: `2px solid ${accentColor}`,
            boxShadow: `inset 0 0 0 6px transparent, inset 0 0 0 7px ${darkenHex(accentColor, 0.15)}`,
            opacity: titlePageOp,
            pointerEvents: "none",
          }}
        />

        {/* Fleur ornaments at all four corners of the title page */}
        <div
          style={{
            position: "absolute",
            inset: p ? "8%" : "7%",
            pointerEvents: "none",
          }}
        >
          <OrnamentalCorner
            position="top-left"
            size={p ? 110 : 150}
            color={accentColor}
            variant="fleur"
            startFrame={TITLE_REVEAL_START + 2}
          />
          <OrnamentalCorner
            position="top-right"
            size={p ? 110 : 150}
            color={accentColor}
            variant="fleur"
            startFrame={TITLE_REVEAL_START + 4}
          />
          <OrnamentalCorner
            position="bottom-left"
            size={p ? 110 : 150}
            color={accentColor}
            variant="fleur"
            startFrame={TITLE_REVEAL_START + 6}
          />
          <OrnamentalCorner
            position="bottom-right"
            size={p ? 110 : 150}
            color={accentColor}
            variant="fleur"
            startFrame={TITLE_REVEAL_START + 8}
          />
        </div>

        {/* Top center fleur cartouche */}
        <div style={{ marginBottom: p ? 22 : 30 }}>
          <OrnamentalBorder
            color={accentColor}
            size={p ? 120 : 160}
            startFrame={TITLE_REVEAL_START + 4}
            variant="fleur"
          />
        </div>

        {/* Title — golden bloom (map-scene accent family); fades in slowly;
            glow eases down — no flicker. */}
        {(() => {
          const TITLE_BURN_START = TITLE_REVEAL_START + 12;
          const burnIn = interpolate(
            frame,
            [TITLE_BURN_START, TITLE_BURN_START + 30],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          const burnPeak = interpolate(
            frame,
            [TITLE_BURN_START + 30, TITLE_BURN_START + 60],
            [1, 0.55],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          const burnLevel = burnIn * burnPeak;
          const heat = burnLevel;
          const A = hexToRgb(accentColor);
          const innerGlow = `rgba(${Math.min(255, A.r + 95)}, ${Math.min(255, A.g + 75)}, ${Math.min(255, A.b + 55)}, ${0.88 * heat})`;
          const midGold = `rgba(${Math.min(255, A.r + 48)}, ${Math.min(255, A.g + 38)}, ${Math.min(255, A.b + 22)}, ${0.72 * heat})`;
          const outerGold = `rgba(${A.r}, ${A.g}, ${A.b}, ${0.58 * heat})`;
          const distantGold = `rgba(${Math.round(A.r * 0.42)}, ${Math.round(A.g * 0.38)}, ${Math.round(A.b * 0.28)}, ${0.32 * heat})`;
          const edgeGold = `rgba(${A.r}, ${A.g}, ${A.b}, 0.28)`;
          const titleColor = burnLevel > 0.38 ? accentColor : textColor;
          return (
            <div
              style={{
                fontFamily: heading,
                fontWeight: 900,
                fontSize: titleFontSize ?? (p ? 88 : 104),
                color: titleColor,
                lineHeight: 1.08,
                letterSpacing: "0.02em",
                textAlign: "center",
                maxWidth: "90%",
                textShadow: `
                  0 0 6px ${innerGlow},
                  0 0 14px ${midGold},
                  0 0 28px ${outerGold},
                  0 0 52px ${distantGold},
                  1px 1px 0 ${edgeGold}
                `,
              }}
            >
              <QuillText
                text={cleanTitle}
                startFrame={TITLE_BURN_START}
                durationFrames={100}
                mode="fade"
                showCursor={false}
              />
            </div>
          );
        })()}

        {/* Ink divider */}
        <div
          style={{
            marginTop: p ? 26 : 34,
            marginBottom: p ? 26 : 34,
            width: p ? "72%" : "62%",
          }}
        >
          <InkDivider
            color={accentColor}
            startFrame={TITLE_REVEAL_START + 42}
            width="100%"
          />
        </div>

        {/* Subtitle / narration */}
        {narration && (
          <div
            style={{
              fontFamily: body,
              fontStyle: "italic",
              fontSize: descriptionFontSize ?? (p ? 32 : 30),
              color: textColor,
              opacity: 0.85,
              lineHeight: 1.55,
              textAlign: "center",
              maxWidth: "78%",
            }}
          >
            <QuillText
              text={narration}
              startFrame={TITLE_REVEAL_START + 55}
              durationFrames={115}
              mode="fade"
              showCursor={false}
            />
          </div>
        )}

        {/* Small wax seal at the bottom as signature */}
        <div
          style={{
            position: "absolute",
            bottom: p ? "10%" : "9%",
            right: p ? "12%" : "14%",
            opacity: interpolate(
              frame,
              [TITLE_REVEAL_START + 60, TITLE_REVEAL_START + 80],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            ),
          }}
        >
          <WaxSeal size={p ? 82 : 98} instant monogram={monogram} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * Scale the cover title so short and long titles both fit the engraved plate.
 * The cover plate is bookW × 0.76 wide × bookW × 0.22 tall.
 */
function coverTitleSize(title: string, bookW: number): number {
  const len = title.trim().length;
  if (len <= 10) return bookW * 0.085;
  if (len <= 18) return bookW * 0.068;
  if (len <= 28) return bookW * 0.055;
  if (len <= 42) return bookW * 0.045;
  return bookW * 0.038;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return { r: 184, g: 134, b: 11 };
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function darkenHex(hex: string, amt: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const num = parseInt(full, 16);
  let r = (num >> 16) - Math.round(255 * amt);
  let g = ((num >> 8) & 0xff) - Math.round(255 * amt);
  let b = (num & 0xff) - Math.round(255 * amt);
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
