import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { NightfallClip } from "../components/NightfallClip";
import { NightfallStarfield } from "../NightfallStarfield";
import { useFitText } from "../components/useFitText";
import type { NightfallLayoutProps } from "../types";

/**
 * GlassNarrativeReadout ("Data Readout") — a visual variant of
 * glass_narrative. Same props and prop meanings as GlassNarrative
 * (title/narration/imageUrl.../accentColor/bgColor/textColor/aspectRatio/
 * titleFontSize/descriptionFontSize); this is a different composition, not
 * different content. Instead of the base's soft, centered, rounded glass
 * card over a starry gradient mesh, this borrows the actual "neon
 * instrument panel" register already built for NightfallDataChart
 * (nightfall_data_visualization) — a solid dark bay, diagonal cyan/purple
 * gradient wash, corner radial glows, animated seam-lines growing in from
 * both sides, and a flat-bordered panel with a glow shadow.
 * The title becomes a
 * centered micro-divider label (echoing NightfallDataChart's own title
 * treatment) instead of a floating eyebrow, and the narration reads as the
 * panel's readout text. A purple beam with a white-hot center travels along
 * the top edge of the panel.
 * Built entirely from devices already implemented in this template
 * (NightfallDataChart's panel recipe, glassCardStyle for the optional image
 * thumbnail's border) — no new colors, fonts, or primitives.
 */

/**
 * BorderSweep — a horizontal purple beam with a concentrated white core,
 * matching the supplied reference. It travels only along the panel's top
 * edge and never spills into a diagonal/frame-wide wash.
 */
const BorderSweep: React.FC<{ opacity: number }> = ({ opacity }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // One full pass every 3s, with a short hold at the left before the next
  // pass — reads as a deliberate sweep, not a constant back-and-forth.
  const loopFrames = fps * 3;
  const holdFrames = fps * 0.6;
  const cycle = (frame % loopFrames) / loopFrames;
  const travel = interpolate(
    cycle,
    [0, holdFrames / loopFrames, 1],
    [0, 0, 1],
    { easing: (t) => t * t * (3 - 2 * t) },
  );

  const widthPct = 38;
  const leftPct = travel * (100 - widthPct);

  return (
    <div
      style={{
        position: "absolute",
        top: -2.5,
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        height: 5,
        opacity,
        pointerEvents: "none",
      }}
    >
      {/* Soft elliptical bloom, narrow at both ends like the reference. */}
      <div
        style={{
          position: "absolute",
          inset: "-5px 0",
          background: "radial-gradient(ellipse at center, rgba(129,140,248,0.72) 0%, rgba(129,140,248,0.34) 42%, transparent 74%)",
          filter: "blur(5px)",
        }}
      />
      {/* The beam itself is a lens, so its sides taper to true points. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          clipPath: "polygon(0% 50%, 18% 42%, 38% 30%, 50% 18%, 62% 30%, 82% 42%, 100% 50%, 82% 58%, 62% 70%, 50% 82%, 38% 70%, 18% 58%)",
          background: "linear-gradient(90deg, transparent 0%, #818CF8 16%, #818CF8 42%, #FFFFFF 50%, #818CF8 58%, #818CF8 84%, transparent 100%)",
          filter: "drop-shadow(0 0 2px rgba(255,255,255,0.9)) drop-shadow(0 0 5px rgba(129,140,248,0.95))",
        }}
      />
    </div>
  );
};

export const GlassNarrativeReadout: React.FC<NightfallLayoutProps> = ({
  title,
  narration,
  imageUrl,
  imageObjectPosition,
  imageZoom,
  videoUrl,
  videoMuted,
  videoVolume,
  videoDurationInFrames,
  videoStartInFrames,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const fps = 30;
  const p = aspectRatio === "portrait";
  const hasImage = !!(imageUrl || videoUrl);
  const accent = accentColor || "#00E5FF";

  const cardIn = spring({ frame: frame - 5, fps, config: { damping: 22, stiffness: 75, mass: 1 } });
  const cardOpacity = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" });

  // Seam-lines growing in from both sides of the title rule — the same
  // device NightfallDataChart uses before its chart panel appears.
  const seamGrow = interpolate(frame, [10, 40], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const titleOp = interpolate(frame, [4, 22], [0, 1], { extrapolateRight: "clamp" });

  const panelReveal = interpolate(frame, [20, 45], [0, 1], { extrapolateRight: "clamp" });
  const bodyOpacity = interpolate(frame, [30, 54], [0, 1], { extrapolateRight: "clamp" });
  const bodyY = interpolate(frame, [30, 54], [15, 0], { extrapolateRight: "clamp" });

  const imageOpacity = interpolate(frame, [26, 50], [0, 1], { extrapolateRight: "clamp" });
  const imageScale = spring({ frame: frame - 26, fps, config: { damping: 20, stiffness: 80 } });

  const bodyFont = fontFamily ?? "'Playfair Display', Georgia, serif";
  const ink = textColor || "#E8E8F0";
  const paragraphs = narration.split("\n").filter((s) => s.trim());
  const titleTarget = Math.max(28, Math.round((titleFontSize ?? (p ? 76 : 93)) * 0.72));
  const bodyTarget = descriptionFontSize ?? (p ? 40 : 45);

  const bg = bgColor || "#0A0A14";

  /* ── Auto-fit ──────────────────────────────────────────────
     Title and body both render in full from frame 0 (only opacity/transform
     animate, no progressive reveal), so direct refs on the visible elements
     are safe. Body's ref goes on the wrapping div that contains every
     rendered paragraph (or the raw string), matching the shared-collection
     pattern used elsewhere for multi-paragraph narration. */
  const titleRef = React.useRef<HTMLDivElement>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const { px: titleSize } = useFitText(
    titleRef,
    titleTarget,
    titleFontSizeIsUserSet ? titleTarget : Math.round(titleTarget * 0.4),
    [title, titleTarget, titleFontSizeIsUserSet, p, height],
    Math.round(height * (p ? 0.14 : 0.16)),
  );
  const { px: bodySize } = useFitText(
    bodyRef,
    bodyTarget,
    descriptionFontSizeIsUserSet ? bodyTarget : Math.round(bodyTarget * 0.4),
    [narration, bodyTarget, descriptionFontSizeIsUserSet, p, hasImage, height],
    Math.round(height * (p ? 0.34 : 0.4)),
  );

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: bg }}>
      {/* Dark glass gradient overlay — NightfallDataChart's exact wash */}
      <AbsoluteFill style={{ background: "linear-gradient(135deg, rgba(0,229,255,0.07) 0%, rgba(123,47,190,0.09) 100%)", pointerEvents: "none" }} />
      {/* Ambient corner glows — same recipe */}
      <div style={{ position: "absolute", top: "-8%", left: "-4%", width: "38%", height: "38%", borderRadius: "50%", background: `radial-gradient(circle, ${accent}10 0%, transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-8%", right: "-4%", width: "32%", height: "32%", borderRadius: "50%", background: "radial-gradient(circle, rgba(123,47,190,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Shooting-star showers — same hero-scene device, boosted for the
          instrument-bay backdrop */}
      <NightfallStarfield intensity={0.3} boost={0.6} seed={2} showShootingStars />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "8% 5%" : "6% 6%",
          opacity: cardOpacity,
        }}
      >
        {/* Title — centered micro-divider label, echoing
            NightfallDataChart's own title treatment instead of a floating
            eyebrow. */}
        <div style={{ opacity: titleOp, marginBottom: p ? 26 : 34, textAlign: "center" }}>
          <div
            ref={titleRef}
            style={{
              fontFamily: bodyFont,
              fontWeight: 700,
              fontSize: titleSize,
              lineHeight: 1.1,
              color: ink,
              letterSpacing: "0.02em",
            }}
          >
            {title}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, margin: "12px auto 0" }}>
            <div style={{ width: Math.round(60 * seamGrow), height: 2, background: accent, opacity: 0.9, borderRadius: 1, boxShadow: `0 0 8px ${accent}` }} />
            <div style={{ width: 6, height: 6, background: accent, opacity: 0.85, transform: "rotate(45deg)", boxShadow: `0 0 6px ${accent}` }} />
            <div style={{ width: Math.round(60 * seamGrow), height: 2, background: accent, opacity: 0.9, borderRadius: 1, boxShadow: `0 0 8px ${accent}` }} />
          </div>
        </div>

        {/* Instrument panel — flat-bordered readout, replacing the base's
            rounded glass card. */}
        <div
          style={{
            position: "relative",
            width: p ? "100%" : "88%",
            maxWidth: 1180,
            padding: p ? 40 : 60,
            borderRadius: 10,
            opacity: panelReveal,
            transform: `translateY(${(1 - cardIn) * 24}px)`,
            background: "rgba(0,229,255,0.04)",
            border: "1.5px solid rgba(0,229,255,0.25)",
            boxShadow: "0 0 40px rgba(0,229,255,0.14), 0 0 10px rgba(0,229,255,0.08), 0 4px 32px rgba(0,0,0,0.65)",
            backdropFilter: "blur(12px)",
            display: "flex",
            flexDirection: hasImage && !p ? "row" : "column",
            gap: hasImage && !p ? 32 : 0,
          }}
        >
          <BorderSweep opacity={panelReveal} />
          {/* Body copy — left-aligned readout text */}
          <div
            ref={bodyRef}
            style={{
              flex: 1,
              opacity: bodyOpacity,
              transform: `translateY(${bodyY}px)`,
              fontSize: bodySize,
              lineHeight: 1.7,
              color: "rgba(226,232,240,0.85)",
              fontFamily: bodyFont,
              textAlign: "left",
            }}
          >
            {paragraphs.length > 1
              ? paragraphs.map((para, i) => (
                  <p key={i} style={{ marginBottom: i < paragraphs.length - 1 ? 18 : 0 }}>
                    {para}
                  </p>
                ))
              : narration}
          </div>

          {/* Inset image thumbnail — square-cornered to match the panel's
              flatter geometry (not the base's rounded side-by-side split). */}
          {hasImage && (
            <div
              style={{
                flexShrink: 0,
                width: p ? "100%" : 220,
                height: p ? 200 : 220,
                borderRadius: 6,
                overflow: "hidden",
                position: "relative",
                opacity: imageOpacity,
                transform: `scale(${imageScale})`,
                border: `1px solid ${accent}30`,
                marginTop: p ? 24 : 0,
              }}
            >
              {(() => {
                const visualStyle: React.CSSProperties = {
                  width: "100%",
                  height: "100%",
                  objectFit: (imageZoom ?? 1) < 1 ? "contain" : "cover",
                  objectPosition: (imageZoom ?? 1) < 1 ? "center" : (imageObjectPosition ?? "50% 50%"),
                  transform: `scale(${imageZoom ?? 1})`,
                  transformOrigin: (imageZoom ?? 1) < 1 ? "center center" : (imageObjectPosition ?? "50% 50%"),
                };
                return videoUrl ? (
                  <NightfallClip
                    src={videoUrl}
                    imageObjectPosition={imageObjectPosition}
                    imageZoom={imageZoom}
                    muted={videoMuted ?? true}
                    volume={videoVolume ?? 0.35}
                    durationInFrames={videoDurationInFrames}
                    startInFrames={videoStartInFrames}
                    style={visualStyle}
                  />
                ) : (
                  <Img src={imageUrl!} style={visualStyle} />
                );
              })()}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: `linear-gradient(135deg, ${accent}10 0%, transparent 50%)`,
                  pointerEvents: "none",
                }}
              />
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
