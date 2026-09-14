import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { DarkBackground } from "../DarkBackground";
import { NightfallStarfield } from "../NightfallStarfield";
import { GlowSweep } from "../GlowSweep";
import { NightfallClip } from "../components/NightfallClip";
import { useFitText } from "../components/useFitText";
import type { NightfallLayoutProps } from "../types";

/**
 * CinematicTitleSignalLock ("Signal Lock") — a visual variant of
 * cinematic_title. Same props and prop meanings as CinematicTitle
 * (title/narration/imageUrl.../accentColor/bgColor/titleFontSize/
 * descriptionFontSize); this is a different composition, not different
 * content. Keeps the base's exact title-arrival spring/scale/glow
 * signature and dead-center placement untouched — what changes is the
 * atmosphere around it: a heavily escalated NightfallStarfield pass
 * (higher intensity + boost than any other scene in the template) turns
 * the sky itself into the "signal," with frequent shooting-star showers
 * reading as a live transmission, and — when no hero image is supplied —
 * a giant low-opacity gradient-clip glyph (the same rendering technique
 * ChapterBreak uses for its chapter-number watermark, applied to the
 * title's own first letter instead of a chapter number) sits behind the
 * title as a "signal" watermark. A GlowSweep pass adds one slow white-ish
 * glow traveling diagonally across the frame over the scene's duration,
 * layered with the escalated starfield. Built entirely from devices already
 * implemented in this template (NightfallStarfield's escalated pass,
 * ChapterBreak's ghost-numeral technique) — no new colors, fonts, or
 * primitives.
 */
export const CinematicTitleSignalLock: React.FC<NightfallLayoutProps> = ({
  title,
  narration,
  textColor,
  accentColor,
  bgColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
  imageUrl,
  imageObjectPosition,
  imageZoom,
  videoUrl,
  videoMuted,
  videoVolume,
  videoDurationInFrames,
  videoStartInFrames,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const fps = 30;
  const p = aspectRatio === "portrait";
  const hasImage = !!(imageUrl || videoUrl);
  const accent = accentColor || "#818CF8";

  /* ── Auto-fit ──────────────────────────────────────────────
     Title and narration render in full from frame 0 (only opacity/transform
     animate, no progressive character reveal), so a direct ref on the
     visible element is safe — no measurement mirror needed. */
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const narrationRef = React.useRef<HTMLParagraphElement>(null);
  const titleTarget = titleFontSize ?? (p ? 113 : 140);
  const narrationTarget = descriptionFontSize ?? (p ? 43 : 36);
  const { px: fittedTitlePx } = useFitText(
    titleRef,
    titleTarget,
    titleFontSizeIsUserSet ? titleTarget : Math.round(titleTarget * 0.4),
    [title, titleTarget, titleFontSizeIsUserSet, p, height],
    Math.round(height * (p ? 0.3 : 0.32)),
  );
  const { px: fittedNarrationPx } = useFitText(
    narrationRef,
    narrationTarget,
    descriptionFontSizeIsUserSet ? narrationTarget : Math.round(narrationTarget * 0.4),
    [narration, narrationTarget, descriptionFontSizeIsUserSet, p, height],
    Math.round(height * (p ? 0.2 : 0.18)),
  );

  const imageOpacity = interpolate(frame, [70, 110], [0, 1], { extrapolateRight: "clamp" });
  const imageScale = interpolate(frame, [70, 150], [1.05, 1], { extrapolateRight: "clamp" });

  const titleY = spring({ frame: frame - 5, fps, config: { damping: 25, stiffness: 60, mass: 1.5 } });
  const titleOpacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });
  const titleScale = spring({ frame: frame - 5, fps, config: { damping: 15, stiffness: 80, mass: 1.2 } });

  const stripWidth = interpolate(frame, [20, 50], [0, 100], { extrapolateRight: "clamp" });
  const stripOpacity = interpolate(frame, [20, 45], [0, 1], { extrapolateRight: "clamp" });

  const subY = spring({ frame: frame - 35, fps, config: { damping: 20, stiffness: 70 } });
  const subOpacity = interpolate(frame, [35, 60], [0, 1], { extrapolateRight: "clamp" });

  // Ghost "signal" glyph — the title's own first letter, rendered with the
  // exact technique ChapterBreak uses for its huge low-opacity chapter
  // number (gradient-clip overlay + glow shadow), only when there's no
  // hero image to fill that background role.
  const glyphOpacity = interpolate(frame, [10, 50], [0, 0.16], { extrapolateRight: "clamp" });
  const glyphScale = spring({ frame: frame - 5, fps, config: { damping: 25, stiffness: 50, mass: 2 } });
  const ghostGlyph = title?.trim()?.[0]?.toUpperCase() ?? "";

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <DarkBackground bgColor={bgColor} />

      {/* Escalated starfield pass — the sky itself is the "signal," using
          the same primitive every scene gets ambiently, just pushed much
          brighter with frequent shooting-star showers. */}
      <NightfallStarfield intensity={0.85} boost={1} seed={11} showShootingStars />

      {/* One slow white-ish glow traveling across the frame over the
          scene's duration — the "signal" sweeping through. */}
      <GlowSweep seedOffset={0} />

      {!hasImage && ghostGlyph && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              fontSize: p ? 620 : 760,
              fontWeight: 200,
              color: "rgba(226,232,240,0.9)",
              opacity: glyphOpacity,
              fontFamily: fontFamily ?? "'Playfair Display', Georgia, serif",
              lineHeight: 0.9,
              transform: `scale(${glyphScale})`,
              position: "relative",
              letterSpacing: "-0.05em",
              textShadow: `0 0 60px ${accent}30`,
            }}
          >
            {ghostGlyph}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(180deg, transparent 0%, ${accent}40 100%)`,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
              }}
            />
          </div>
        </div>
      )}

      {hasImage && (
        <>
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: imageOpacity,
              transform: `scale(${imageScale})`,
              transformOrigin: "center center",
            }}
          >
            {videoUrl ? (
              <NightfallClip
                src={videoUrl}
                imageObjectPosition={imageObjectPosition}
                imageZoom={imageZoom}
                muted={videoMuted ?? true}
                volume={videoVolume ?? 0.35}
                durationInFrames={videoDurationInFrames}
                startInFrames={videoStartInFrames}
                style={{ display: "block" }}
              />
            ) : (
              <img
                src={imageUrl}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: (imageZoom ?? 1) < 1 ? "contain" : "cover",
                  objectPosition: (imageZoom ?? 1) < 1 ? "center" : (imageObjectPosition ?? "50% 50%"),
                  transform: `scale(${imageZoom ?? 1})`,
                  transformOrigin: (imageZoom ?? 1) < 1 ? "center center" : (imageObjectPosition ?? "50% 50%"),
                  display: "block",
                }}
              />
            )}
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "radial-gradient(ellipse at center, rgba(10,10,26,0.25) 0%, rgba(10,10,26,0.55) 100%)",
              opacity: imageOpacity,
              pointerEvents: "none",
            }}
          />
        </>
      )}

      {/* Title block — dead-center, unchanged from the base's own
          composition; the escalated starfield + ghost glyph are what
          create the genre shift, not moving the text around. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? 60 : 120,
          zIndex: 2,
        }}
      >
        <h1
          ref={titleRef}
          style={{
            fontSize: fittedTitlePx,
            fontWeight: 800,
            color: "#FFFFFF",
            fontFamily: fontFamily ?? "'Playfair Display', Georgia, serif",
            textAlign: "center",
            lineHeight: 1.1,
            transform: `translateY(${(1 - titleY) * 40}px) scale(${titleScale})`,
            opacity: titleOpacity,
            letterSpacing: "-0.01em",
            maxWidth: "90%",
            textShadow: `0 0 60px ${accent}35`,
          }}
        >
          {title}
        </h1>

        <div
          style={{
            width: `${stripWidth}%`,
            maxWidth: p ? 280 : 600,
            height: 3,
            marginTop: p ? 32 : 48,
            background: `linear-gradient(90deg, transparent 0%, ${accent} 50%, transparent 100%)`,
            borderRadius: 2,
            opacity: stripOpacity,
            boxShadow: `0 0 20px ${accent}50`,
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: accent,
              boxShadow: `0 0 30px ${accent}`,
            }}
          />
        </div>

        {narration && (
          <p
            ref={narrationRef}
            style={{
              fontSize: fittedNarrationPx,
              fontWeight: 400,
              color: "rgba(226,232,240,0.45)",
              fontFamily: fontFamily ?? "'Playfair Display', Georgia, serif",
              textAlign: "center",
              marginTop: p ? 28 : 36,
              maxWidth: p ? "85%" : 950,
              opacity: subOpacity * 0.95,
              transform: `translateY(${(1 - subY) * 30}px)`,
              lineHeight: 1.5,
              letterSpacing: "0.01em",
            }}
          >
            {narration}
          </p>
        )}
      </div>
    </AbsoluteFill>
  );
};
