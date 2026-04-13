import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { BlackswanLayoutProps } from "../types";
import { NeonWater } from "./neonWater";
import { BlackswanArcBirdPass, neonTitleTubeStyle, StarField } from "./scenePrimitives";

const mono = "'Righteous', cursive";
const display = "'Righteous', cursive";

const ICONS = ["◈", "↯", "⬡", "⟁", "◇", "⟐"];

function deriveItems(narration: string): string[] {
  return narration.split(/[.;•\n]/).map((s) => s.trim()).filter(Boolean);
}

/** Bottom padding (% of frame height) so narration sits above neon water; grows with script length (capped). */
function narrationBottomReservePct(narrationText: string, portrait: boolean): number {
  const t = narrationText.trim();
  const len = t.length;
  const words = t ? t.split(/\s+/).length : 0;
  if (portrait) {
    const fromChars = Math.min(10, Math.floor(len / 45));
    const fromWords = Math.min(8, Math.floor(words / 18));
    return Math.min(36, 18 + fromChars + fromWords);
  }
  const fromChars = Math.min(6, Math.floor(len / 80));
  const fromWords = Math.min(5, Math.floor(words / 40));
  return Math.min(16, 7 + fromChars + fromWords);
}

/** Image panel with glowing accent corners — `cover` + clip so large assets never spill into text/water. */
const ImageWithCornerGlow: React.FC<{
  src: string;
  accentColor: string;
  borderGlow?: boolean;
}> = ({ src, accentColor, borderGlow = false }) => (
  <div
    style={{
      position: "relative",
      width: "100%",
      height: "100%",
      overflow: "hidden",
      minWidth: 0,
      minHeight: 0,
    }}
  >
    <img
      src={src}
      alt=""
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: "center center",
        display: "block",
      }}
    />
    {/* Subtle inner shadow border */}
    <div style={{
      position: "absolute",
      inset: 0,
      boxShadow: borderGlow
        ? `inset 0 0 0 2px ${accentColor}88, 0 0 24px ${accentColor}55, 0 0 48px ${accentColor}22`
        : `inset 0 0 0 2px ${accentColor}44`,
      pointerEvents: "none",
    }} />
    {/* SVG corner glows */}
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <defs>
        <filter id="arc-corner-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Top-left */}
      <path d="M0,18 L0,0 L18,0" fill="none" stroke={accentColor} strokeWidth="1.4" filter="url(#arc-corner-glow)" />
      {/* Top-right */}
      <path d="M82,0 L100,0 L100,18" fill="none" stroke={accentColor} strokeWidth="1.4" filter="url(#arc-corner-glow)" />
      {/* Bottom-right */}
      <path d="M100,82 L100,100 L82,100" fill="none" stroke={accentColor} strokeWidth="1.4" filter="url(#arc-corner-glow)" />
      {/* Bottom-left */}
      <path d="M18,100 L0,100 L0,82" fill="none" stroke={accentColor} strokeWidth="1.4" filter="url(#arc-corner-glow)" />
    </svg>
  </div>
);

/** Feature card list (shared between layouts) */
const FeatureCards: React.FC<{
  items: string[];
  cols: number;
  portrait: boolean;
  accentColor: string;
  textColor: string;
  titleFontSize?: number;
  descriptionFontSize?: number;
  fontFamily?: string;
  frame: number;
}> = ({ items, cols, portrait, accentColor, textColor, titleFontSize, descriptionFontSize, fontFamily, frame }) => (
  <div
    style={{
      display: portrait ? "flex" : "grid",
      flexDirection: portrait ? "column" : undefined,
      alignItems: portrait ? "center" : undefined,
      gap: portrait ? 18 : undefined,
      gridTemplateColumns: portrait ? undefined : `repeat(${cols}, 1fr)`,
      width: "100%",
      alignSelf: "center",
      columnGap: portrait ? 0 : 28,
    }}
  >
    {items.map((item, i) => {
      const cardOp = interpolate(frame, [10 + i * 5, 28 + i * 5], [0, 1], { extrapolateRight: "clamp" });
      const cardY  = interpolate(frame, [10 + i * 5, 28 + i * 5], [16, 0], { extrapolateRight: "clamp" });

      const colonIdx = item.indexOf(":");
      const boxTitle = colonIdx > -1 ? item.slice(0, colonIdx).trim() : item;
      const boxDesc  = colonIdx > -1 ? item.slice(colonIdx + 1).trim() : "";

      const isRightCol = !portrait && cols === 2 && i % 2 === 1;
      const sideLine = `1px solid ${accentColor}55`;

      return (
        <div
          key={i}
          style={{
            boxSizing: "border-box",
            padding: portrait ? "16px 22px" : "24px 14px",
            borderTop: portrait ? "none" : `1px solid ${accentColor}22`,
            borderLeft: portrait ? sideLine : isRightCol ? `1px solid ${accentColor}22` : "none",
            borderRight: portrait ? sideLine : "none",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            alignItems: portrait ? "center" : undefined,
            width: portrait ? "min(92%, 560px)" : undefined,
            opacity: cardOp,
            transform: `translateY(${cardY}px)`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              justifyContent: portrait ? "center" : undefined,
              flexWrap: portrait ? "wrap" : undefined,
            }}
          >
            <span style={{ fontSize: portrait ? 16 : 18, color: accentColor, fontFamily: fontFamily ?? mono, lineHeight: 1, flexShrink: 0 }}>
              {ICONS[i % ICONS.length]}
            </span>
            <span style={{
              fontFamily: fontFamily ?? display,
              fontSize: titleFontSize ? titleFontSize * 0.42 : (portrait ? 26 : 24),
              fontWeight: 700,
              color: accentColor,
              letterSpacing: "1px",
              textTransform: "uppercase",
              lineHeight: 1.2,
              textAlign: portrait ? "center" : undefined,
            }}>
              {boxTitle}
            </span>
          </div>
          {boxDesc && (
            <div style={{
              fontFamily: fontFamily ?? mono,
              fontSize: descriptionFontSize ? descriptionFontSize * 0.7 : (portrait ? 19 : 17),
              color: textColor,
              lineHeight: 1.6,
              paddingLeft: portrait ? 0 : 28,
              textAlign: portrait ? "center" : undefined,
              opacity: 0.85,
            }}>
              {boxDesc}
            </div>
          )}
        </div>
      );
    })}
    {!portrait && (
      <div style={{ gridColumn: `1 / -1`, height: 1, background: `${accentColor}22` }} />
    )}
  </div>
);

export const ArcFeatures: React.FC<BlackswanLayoutProps> = (props) => {
  const {
    title,
    narration = "",
    accentColor = "#00E5FF",
    bgColor = "#000000",
    textColor = "#DFFFFF",
    items,
    titleFontSize,
    descriptionFontSize,
    fontFamily,
    aspectRatio = "landscape",
    imageUrl,
  } = props;

  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const featureItems = (items && items.length > 0 ? items : deriveItems(narration)).slice(0, 6);
  const cols = p ? 1 : featureItems.length <= 3 ? featureItems.length : 2;

  const narrTrim = narration.trim();
  const narrLen = narrTrim.length;
  const narrWordCount = narrTrim ? narrTrim.split(/\s+/).length : 0;
  const bottomReservePct = narrationBottomReservePct(narration, p);
  const narrationFontSize =
    descriptionFontSize ??
    (p ? (narrLen > 220 ? 36 : narrLen > 130 ? 40 : 44) : 32);

  const titleOp = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const titleY  = interpolate(frame, [0, 20], [12, 0], { extrapolateRight: "clamp" });
  const narOp   = interpolate(frame, [30 + featureItems.length * 6, 50 + featureItems.length * 6], [0, 1], { extrapolateRight: "clamp" });
  const narY    = interpolate(frame, [30 + featureItems.length * 6, 50 + featureItems.length * 6], [10, 0], { extrapolateRight: "clamp" });
  const imgOp   = interpolate(frame, [5, 25], [0, 1], { extrapolateRight: "clamp" });

  const hasImage = !!imageUrl;

  // ── Landscape + image: two-column layout ────────────────────
  if (!p && hasImage) {
    return (
      <AbsoluteFill style={{ backgroundColor: bgColor, overflow: "hidden" }}>
        <StarField accentColor={accentColor} />

        {/* NeonWater — bottom */}
        <div style={{ position: "absolute", inset: 0 }}>
          {/* Adjusted yPct to bring water slightly lower */}
          <NeonWater uid="a3" cx={500} yPct={95} scale={1.4} rxBase={200} ryBase={22} maxRx={420} nRings={6} delay={0} hideBg fadeEdges accentColor={accentColor} />
        </div>

        <BlackswanArcBirdPass uid="arc-land-img" accentColor={accentColor} portrait={false} />

        {/* Two-column layout: features left, image right */}
        <div
          style={{
            position: "absolute",
            // Modified: Moved the top of the content up to bring features above their current position.
            top: "8%",
            left: "4%",
            right: "4%",
            // Modified: Adjusted bottom to ensure narration is below both columns with a small gap, as narration moved up.
            bottom: `${bottomReservePct + 12 + 2}%`,
            display: "flex",
            gap: "3%",
            alignItems: "stretch",
            minHeight: 0,
            zIndex: 3,
          }}
        >
          {/* Left: title + feature cards */}
          <div
            style={{
              flex: "0 0 50%",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              paddingRight: "2%",
            }}
          >
            <h1
              style={{
                margin: 0,
                fontFamily: fontFamily ?? display,
                fontSize: titleFontSize ?? 60,
                fontWeight: 800,
                ...neonTitleTubeStyle(accentColor, { bgColor }),
                lineHeight: 1.1,
                letterSpacing: "0.12em",
                opacity: titleOp,
                transform: `translateY(calc(${titleY}px + 60px))`, // MODIFIED: Added 30px to existing 30px for titleY
              }}
            >
              {title}
            </h1>
            <div style={{
              height: 1,
              width: "45%",
              background: accentColor,
              boxShadow: `0 0 6px ${accentColor}`,
              opacity: titleOp,
              flexShrink: 0,
              transform: `translateY(60px)`, // ADDED: Translate line down
            }} />
            <div style={{ flex: 1, display: "flex", alignItems: "flex-start" }}>
              <FeatureCards
                items={featureItems}
                cols={featureItems.length <= 3 ? featureItems.length : 2}
                portrait={false}
                accentColor={accentColor}
                textColor={textColor}
                titleFontSize={titleFontSize}
                descriptionFontSize={descriptionFontSize}
                fontFamily={fontFamily}
                frame={frame}
              />
            </div>
          </div>

          {/* Right: image — rectangular (wide, not tall), aligned to top */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "stretch",
              minWidth: 0,
              minHeight: 0,
              overflow: "hidden",
              gap: 0,
            }}
          >
            {/* Image at its current place relative to its column container */}
            <div
              style={{
                width: "100%",
                aspectRatio: "16 / 9",
                flexShrink: 0,
                opacity: imgOp,
                marginTop: "12%",
                overflow: "hidden",
                minHeight: 0,
              }}
            >
              <ImageWithCornerGlow src={imageUrl!} accentColor={accentColor} />
            </div>
          </div>
        </div>

        {/* Narration — below both columns, more above neon water */}
        {narration && (
          <div
            style={{
              position: "absolute",
              left: "4%",
              right: "4%",
              // Modified: Moved narration higher, further above neon water.
              bottom: "12%",
              height: `${bottomReservePct}%`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 3,
            }}
          >
            <p
              style={{
                margin: 0,
                fontFamily: fontFamily ?? mono,
                fontSize: narrationFontSize,
                color: textColor,
                lineHeight: 1.7,
                textAlign: "center",
                opacity: narOp,
                transform: `translateY(${narY}px)`,
                maxWidth: "90%",
              }}
            >
              {narration}
            </p>
          </div>
        )}
      </AbsoluteFill>
    );
  }

  // ── Portrait + image: image above feature cards ──────────────
  if (p && hasImage) {
    return (
      <AbsoluteFill style={{ backgroundColor: bgColor, overflow: "hidden" }}>
        <StarField accentColor={accentColor} />

        {/* NeonWater — bottom */}
        <div style={{ position: "absolute", inset: 0 }}>
          {/* Adjusted yPct to bring water slightly higher (from 97 to 95) */}
          <NeonWater uid="a3" cx={500} yPct={95} scale={1.1} rxBase={200} ryBase={22} maxRx={420} nRings={6} delay={0} hideBg fadeEdges accentColor={accentColor} />
        </div>

        <BlackswanArcBirdPass uid="arc-port-img" accentColor={accentColor} portrait />

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            // Changed paddingTop from "12%" to "14%" to move content (title, image, features) downwards
            paddingTop: "14%",
            paddingLeft: "6%",
            paddingRight: "6%",
            // Adjusted paddingBottom to move narration up, towards center
            paddingBottom: `${Math.max(0, bottomReservePct - 2)}%`, // Changed from `${bottomReservePct}%` to subtract 2%
            // Changed gap from 16 to 12 to reduce margin between title, image, and features
            gap: 12, // Changed from 16 to 12
            minHeight: 0,
            overflow: "hidden",
            zIndex: 3,
          }}
        >
          {/* Title — top */}
          <h1
            style={{
              margin: 0,
              fontFamily: fontFamily ?? display,
              fontSize: titleFontSize ?? 72,
              fontWeight: 800,
              ...neonTitleTubeStyle(accentColor, { bgColor }),
              lineHeight: 1.1,
              letterSpacing: "2px",
              textAlign: "center",
              opacity: titleOp,
              transform: `translateY(calc(${titleY}px + 60px))`, // MODIFIED: Added 30px to existing 30px for titleY
            }}
          >
            {title}
          </h1>

          {/* Image — below title, same height as before, with glowing border */}
          {/* Adjusted marginTop to bring the image down a little further */}
          <div
            style={{
              width: "88%",
              height: "36%",
              maxHeight: "36%",
              flexShrink: 0,
              opacity: imgOp,
              marginTop: "12%", // Changed from 10% to 12%
              overflow: "hidden",
              minHeight: 0,
            }}
          >
            <ImageWithCornerGlow src={imageUrl!} accentColor={accentColor} borderGlow />
          </div>

          {/* Feature cards */}
          <FeatureCards
            items={featureItems}
            cols={1}
            portrait
            accentColor={accentColor}
            textColor={textColor}
            titleFontSize={titleFontSize}
            descriptionFontSize={descriptionFontSize}
            fontFamily={fontFamily}
            frame={frame}
          />

          {/* Narration */}
          {narration && (
            <p
              style={{
                margin: 0,
                fontFamily: fontFamily ?? mono,
                fontSize: narrationFontSize,
                color: textColor,
                lineHeight: 1.7,
                textAlign: "center",
                opacity: narOp,
                transform: `translateY(${narY}px)`,
                maxWidth: "90%",
              }}
            >
              {narration}
            </p>
          )}
        </div>
      </AbsoluteFill>
    );
  }

  // ── No image: original layout ────────────────────────────────
  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, overflow: "hidden" }}>
      <StarField accentColor={accentColor} />

      <div style={{ position: "absolute", inset: 0 }}>
        {/* Adjusted yPct to bring water slightly higher (from 93 to 91 for portrait, 90 to 88 for landscape) */}
        <NeonWater
          uid="a3"
          cx={500}
          yPct={p ? 91 : 88}
          scale={p ? 1.1 : 1.4}
          rxBase={200}
          ryBase={22}
          maxRx={420}
          nRings={6}
          delay={0}
          hideBg
          fadeEdges
          accentColor={accentColor}
        />
      </div>

      <BlackswanArcBirdPass uid="arc-plain" accentColor={accentColor} portrait={p} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start", // Keep this to fix title at top
          // Adjusted paddingTop to move title further upwards
          paddingTop: p ? "16%" : "8%", // Changed from 18% / 10%
          paddingLeft: "6%",
          paddingRight: "6%",
          // paddingBottom moved to the inner flex-grow container
          gap: p ? 36 : 24, // Keep gap between line and the new flex-grow container
          zIndex: 3,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily: fontFamily ?? display,
            fontSize: titleFontSize ?? (p ? 90 : 74),
            fontWeight: 800,
            ...neonTitleTubeStyle(accentColor, { bgColor }),
            lineHeight: 1.1,
            letterSpacing: "2px",
            textAlign: "center",
            opacity: titleOp,
            transform: `translateY(calc(${titleY}px + 60px))`,
          }}
        >
          {title}
        </h1>

        <div
          style={{
            height: 1,
            width: p ? "60%" : "40%",
            background: accentColor,
            boxShadow: `0 0 6px ${accentColor}, 0 0 12px ${accentColor}88`,
            opacity: titleOp,
            flexShrink: 0,
            transform: `translateY(60px)`,
          }}
        />

        {/* New flex container to hold and center FeatureCards and Narration */}
        <div
          style={{
            flexGrow: 1, // This div takes up all remaining vertical space
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center", // Vertically centers its children
            width: "100%", // Ensures it spans full width for alignment
            // Adjusted paddingBottom to account for water level and overall content balance
            paddingBottom: `${Math.max(0, bottomReservePct - 8)}%`, // Moved from main content container
            gap: p ? 300 : 200, // Gap between FeatureCards and Narration
          }}
        >
          <FeatureCards
            items={featureItems}
            cols={cols}
            portrait={p}
            accentColor={accentColor}
            textColor={textColor}
            titleFontSize={titleFontSize}
            descriptionFontSize={descriptionFontSize}
            fontFamily={fontFamily}
            frame={frame}
          />

        {narration && (
          <p
            style={{
              margin: 0,
                // Removed marginTop as gap property on parent handles spacing
              fontFamily: fontFamily ?? mono,
                fontSize: narrationFontSize,
              color: textColor,
                lineHeight: p ? (narrWordCount > 45 ? 1.65 : 1.8) : 1.8,
              textAlign: "center",
              opacity: narOp,
              transform: `translateY(${narY}px)`,
              maxWidth: p ? "90%" : "68%",
                flexShrink: 0,
            }}
          >
            {narration}
          </p>
        )}
        </div>
      </div>
    </AbsoluteFill>
  );
}
