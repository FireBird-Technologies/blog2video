import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { ChronicleLayoutProps } from "../types";
import { useFitText } from "../components/useFitText";
import {
  CHRONICLE_BODY_FONT,
  CHRONICLE_HEADING_FONT,
} from "../../../fonts/chronicle-defaults";
import {
  OrnamentalBorder,
  OrnamentalCorner,
  InkDivider,
} from "../components/OrnamentalBorder";
import { WaxSeal } from "../components/WaxSeal";
import { EmberSparks } from "../components/ChronicleArtifacts";
import { QuillText } from "../components/QuillInk";
import { stripChapterPrefix } from "./ChapterPlate";
import { chronicleHeroHeadingGlow } from "../components/ChronicleHeading";

/**
 * book_open__v2 — "The Unrolling Scroll".
 *
 * Same role and props as BookOpen (scene 0 opener), a different object: a
 * ribbon-tied, wax-sealed scroll instead of a clasped leather tome.
 *
 * Act 1 (0–20)    A rolled parchment scroll (wooden dowel end-caps) sits
 *                 center-frame, candlelit, tied shut with a ribbon bearing a
 *                 wax seal at the knot.
 * Act 2 (32–60)   The seal cracks and the ribbon falls away.
 * Act 3 (60–104)  The scroll unrolls horizontally — the dowels pull apart
 *                 left/right as the parchment stretches open between them.
 * Act 4 (100+)    The now full-frame scroll becomes the illuminated title
 *                 surface: title, divider, narration and signature seal reveal
 *                 directly over the parchment instead of replacing it.
 */
export const BookOpenV2: React.FC<ChronicleLayoutProps> = ({
  title = "A Story Begins",
  narration,
  accentColor = "#B8860B",
  bgColor = "#F1E4C9",
  textColor = "#2A1810",
  aspectRatio = "landscape",
  titleFontSize,
  descriptionFontSize,
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps, width, height } = useVideoConfig();
  const p = aspectRatio === "portrait" || height > width;

  // ── Act timing (mirrors BookOpen's pacing) ──────────────────
  const SEAL_CRACK_START = 32;
  const SEAL_CRACK_END = 54;
  const UNROLL_START = 60;
  const TITLE_REVEAL_START = 100;
  const TITLE_PUSH_IN_END = 134;

  const scrollSettle = spring({
    frame: frame - 2,
    fps,
    config: { damping: 26, stiffness: 75, mass: 1.4 },
  });

  // Seal crack + ribbon release
  const sealCrack = interpolate(
    frame,
    [SEAL_CRACK_START, SEAL_CRACK_END],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const ribbonRelease = interpolate(
    frame,
    [SEAL_CRACK_START + 2, SEAL_CRACK_END + 6],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const innerGlow = interpolate(
    frame,
    [SEAL_CRACK_START + 6, UNROLL_START + 8],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Unroll — dowels pull apart, parchment stretches open between them
  const unrollSpring = spring({
    frame: frame - UNROLL_START,
    fps,
    config: { damping: 18, stiffness: 38, mass: 1.8 },
  });
  const unrollX = interpolate(unrollSpring, [0, 1], [0, 1]);

  const titlePageOp = interpolate(
    frame,
    [TITLE_REVEAL_START, TITLE_PUSH_IN_END],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const outroFade = interpolate(
    frame,
    [durationInFrames - 18, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Scroll geometry — rolled state is narrow and tall (a cylinder), unrolled
  // state is wide and shorter (an open page), the parchment stretching
  // between the two dowels as unrollX goes 0→1.
  const rolledW = p ? Math.min(width * 0.22, 220) : Math.min(width * 0.16, 220);
  const scrollH = height * (p ? 0.88 : 0.86);
  const unrolledW = width * (p ? 0.9 : 0.94);
  const scrollW = interpolate(unrollX, [0, 1], [rolledW, unrolledW]);

  const scrollY = interpolate(scrollSettle, [0, 1], [18, 0]);
  const scrollScale = interpolate(scrollSettle, [0, 1], [0.94, 1]);
  const hover = Math.sin((frame / 30) * Math.PI) * 2;

  const heading = fontFamily ?? CHRONICLE_HEADING_FONT;
  const body = fontFamily ?? CHRONICLE_BODY_FONT;

  const cleanTitle = stripChapterPrefix(title);

  const fitTitleRef = React.useRef<HTMLDivElement>(null);
  const fitNarrationRef = React.useRef<HTMLDivElement>(null);
  // Match BookOpen V1's hero-title scale as well as its typography treatment.
  const fitTitleTarget = titleFontSize ?? (p ? 88 : 104);
  const fitNarrationTarget = descriptionFontSize ?? (p ? 64 : 50);
  const { px: fitTitlePx } = useFitText(
    fitTitleRef,
    fitTitleTarget,
    titleFontSizeIsUserSet ? fitTitleTarget : Math.round(fitTitleTarget * 0.4),
    [cleanTitle, fitTitleTarget, titleFontSizeIsUserSet, p, height],
    Math.round(height * (p ? 0.22 : 0.26)),
  );
  const { px: fitNarrationPx } = useFitText(
    fitNarrationRef,
    fitNarrationTarget,
    descriptionFontSizeIsUserSet ? fitNarrationTarget : Math.round(fitNarrationTarget * 0.5),
    [narration, fitNarrationTarget, descriptionFontSizeIsUserSet, fitTitlePx, p, height],
    Math.round(height * (p ? 0.16 : 0.18)),
  );

  const monogram = (cleanTitle.match(/[A-Za-z]/)?.[0] ?? "A").toUpperCase();

  const PARCHMENT_LIGHT = "#F4E6C8";
  const PARCHMENT_MID = "#EAD8A8";
  const PARCHMENT_DARK = "#C9AE78";
  const WOOD_DARK = "#3A2410";
  const WOOD_MID = "#6B4420";
  const WOOD_HIGH = "#8A5C2E";
  const GOLD = accentColor;
  const WAX_RED = "#7A2418";

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        fontFamily: body,
        opacity: outroFade,
      }}
    >
      <EmberSparks count={18} seed={13} intensity={1} />

      {/* ───── The sealed scroll expands into the persistent title surface. ───── */}
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          perspective: "2800px",
        }}
      >
        {/* Ground shadow beneath the scroll */}
        <div
          style={{
            position: "absolute",
            width: scrollW * 1.05,
            height: scrollH * 0.06,
            bottom: `calc(50% - ${scrollH * 0.52}px)`,
            background:
              "radial-gradient(ellipse at center, rgba(20,10,4,0.5) 0%, rgba(20,10,4,0.18) 40%, transparent 75%)",
            filter: "blur(14px)",
            transform: `scale(${0.9 + 0.1 * scrollSettle})`,
          }}
        />

        <div
          style={{
            width: scrollW,
            height: scrollH,
            position: "relative",
            transformStyle: "preserve-3d",
            transform: `translateY(${scrollY + hover}px) scale(${scrollScale})`,
          }}
        >
          {/* Warm inner glow escaping as the seal cracks */}
          <div
            style={{
              position: "absolute",
              inset: "-12%",
              background: `radial-gradient(ellipse at center, rgba(255, 200, 110, ${0.5 * innerGlow}) 0%, rgba(255, 160, 60, ${0.22 * innerGlow}) 30%, transparent 65%)`,
              pointerEvents: "none",
              filter: "blur(30px)",
              zIndex: 0,
            }}
          />

          {/* Parchment body — stretches between the two dowels */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 6,
              background: `
                linear-gradient(90deg, ${PARCHMENT_DARK} 0%, ${PARCHMENT_LIGHT} 6%, ${PARCHMENT_MID} 50%, ${PARCHMENT_LIGHT} 94%, ${PARCHMENT_DARK} 100%)
              `,
              boxShadow:
                "0 30px 60px rgba(0,0,0,0.55), inset 0 0 0 2px rgba(120,90,40,0.35)",
            }}
          >
            {/* Parchment grain */}
            <svg
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                opacity: 0.25,
                mixBlendMode: "multiply",
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              <defs>
                <filter id="bov2-grain">
                  <feTurbulence
                    type="fractalNoise"
                    baseFrequency="0.9"
                    numOctaves="2"
                    stitchTiles="stitch"
                  />
                  <feColorMatrix
                    type="matrix"
                    values="0 0 0 0 0.35
                            0 0 0 0 0.26
                            0 0 0 0 0.12
                            0 0 0 0.5 0"
                  />
                </filter>
              </defs>
              <rect width="100%" height="100%" filter="url(#bov2-grain)" />
            </svg>

            {/* Curl shading at the rolled edges — fades out as unrollX grows */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 6,
                background: `linear-gradient(90deg, rgba(60,40,15,${0.5 * (1 - unrollX)}) 0%, transparent 12%, transparent 88%, rgba(60,40,15,${0.5 * (1 - unrollX)}) 100%)`,
                pointerEvents: "none",
              }}
            />

            {/* Content only becomes legible once mostly unrolled */}
            <div
              style={{
                position: "absolute",
                inset: "6%",
                opacity: interpolate(unrollX, [0.5, 1], [0, 0.5], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
                border: `1px solid ${GOLD}`,
                borderRadius: 2,
              }}
            />
          </div>

          {/* ── Wooden dowel end-caps — pinned to the scroll container's
              edges, which already travel outward as scrollW animates from
              rolledW to unrolledW. No extra translateX: adding one on top
              of the edge-pinning double-counts the width growth and pulls
              the dowels past the parchment's actual bounds. ── */}
          {[0, 1].map((side) => {
            return (
              <div
                key={`dowel-${side}`}
                style={{
                  position: "absolute",
                  top: "-4%",
                  bottom: "-4%",
                  [side === 0 ? "left" : "right"]: 0,
                  width: rolledW * 0.16,
                  zIndex: 3,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "40%",
                    background: `linear-gradient(90deg, ${WOOD_DARK} 0%, ${WOOD_HIGH} 30%, ${WOOD_MID} 55%, ${WOOD_DARK} 100%)`,
                    boxShadow: "0 10px 24px rgba(0,0,0,0.5), inset 0 0 0 2px rgba(20,10,4,0.4)",
                  }}
                />
                {/* Brass finial caps top + bottom */}
                {[0, 1].map((cap) => (
                  <div
                    key={cap}
                    style={{
                      position: "absolute",
                      [cap === 0 ? "top" : "bottom"]: "-4%",
                      left: "-25%",
                      right: "-25%",
                      height: "9%",
                      borderRadius: "50%",
                      background: `radial-gradient(ellipse at 35% 30%, #E8C578 0%, ${GOLD} 45%, #6B4E0A 100%)`,
                      boxShadow: "0 3px 6px rgba(0,0,0,0.5)",
                    }}
                  />
                ))}
              </div>
            );
          })}

          {/* ── Ribbon + wax seal at the knot (Act 1-2) ── */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate(-50%, -50%) scale(${1 - sealCrack * 0.12}) rotate(${sealCrack * 18}deg)`,
              opacity: 1 - ribbonRelease,
              zIndex: 4,
            }}
          >
            {/* Ribbon band wrapping the rolled scroll */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: scrollW * 1.08,
                height: rolledW * 0.3,
                transform: "translate(-50%, -50%)",
                background: `linear-gradient(180deg, ${WAX_RED} 0%, #5E1A10 100%)`,
                boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
              }}
            />
            <WaxSeal size={p ? 96 : 112} instant monogram={monogram} color={WAX_RED} />
          </div>
        </div>
      </AbsoluteFill>

      {/* ───── Act 4: illuminated text revealed directly over the scroll. ───── */}
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
        <div
          style={{
            position: "absolute",
            inset: p ? "8% 7%" : "9% 5%",
            border: `2px solid ${accentColor}`,
            boxShadow: `inset 0 0 0 6px transparent, inset 0 0 0 7px ${darkenHex(accentColor, 0.15)}`,
            opacity: titlePageOp,
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: p ? "9% 8%" : "10% 6%",
            pointerEvents: "none",
          }}
        >
          <OrnamentalCorner position="top-left" size={p ? 110 : 150} color={accentColor} variant="fleur" startFrame={TITLE_REVEAL_START + 2} />
          <OrnamentalCorner position="top-right" size={p ? 110 : 150} color={accentColor} variant="fleur" startFrame={TITLE_REVEAL_START + 4} />
          <OrnamentalCorner position="bottom-left" size={p ? 110 : 150} color={accentColor} variant="fleur" startFrame={TITLE_REVEAL_START + 6} />
          <OrnamentalCorner position="bottom-right" size={p ? 110 : 150} color={accentColor} variant="fleur" startFrame={TITLE_REVEAL_START + 8} />
        </div>

        <div style={{ marginBottom: p ? 22 : 30 }}>
          <OrnamentalBorder color={accentColor} size={p ? 120 : 160} startFrame={TITLE_REVEAL_START + 4} variant="fleur" />
        </div>

        {(() => {
          const TITLE_BURN_START = TITLE_REVEAL_START + 12;
          const burnIn = interpolate(frame, [TITLE_BURN_START, TITLE_BURN_START + 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const burnPeak = interpolate(frame, [TITLE_BURN_START + 30, TITLE_BURN_START + 60], [1, 0.55], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const burnLevel = burnIn * burnPeak;
          const heat = burnLevel;
          const titleColor = burnLevel > 0.38 ? accentColor : textColor;
          return (
            <div
              ref={fitTitleRef}
              style={{
                fontFamily: heading,
                fontWeight: 900,
                fontSize: fitTitlePx,
                color: titleColor,
                lineHeight: 1.08,
                letterSpacing: "0.02em",
                textAlign: "center",
                width: "100%",
                maxWidth: "90%",
                textShadow: chronicleHeroHeadingGlow(accentColor, heat),
              }}
            >
              <QuillText text={cleanTitle} startFrame={TITLE_BURN_START} durationFrames={100} mode="fade" showCursor={false} />
            </div>
          );
        })()}

        <div style={{ marginTop: p ? 26 : 34, marginBottom: p ? 26 : 34, width: p ? "72%" : "62%" }}>
          <InkDivider color={accentColor} startFrame={TITLE_REVEAL_START + 42} width="100%" />
        </div>

        {narration && (
          <div
            ref={fitNarrationRef}
            style={{
              fontFamily: body,
              fontStyle: "italic",
              fontSize: fitNarrationPx,
              color: textColor,
              opacity: 0.85,
              lineHeight: 1.55,
              textAlign: "center",
              width: "100%",
              maxWidth: "78%",
            }}
          >
            <QuillText text={narration} startFrame={TITLE_REVEAL_START + 55} durationFrames={115} mode="fade" showCursor={false} />
          </div>
        )}

        <div
          style={{
            position: "absolute",
            bottom: p ? "10%" : "9%",
            right: p ? "12%" : "14%",
            opacity: interpolate(frame, [TITLE_REVEAL_START + 60, TITLE_REVEAL_START + 80], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          <WaxSeal size={p ? 82 : 98} instant monogram={monogram} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

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
