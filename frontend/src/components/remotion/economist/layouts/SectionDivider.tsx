import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { EconomistLayoutProps } from "../types";
import { useFitText } from "../components/useFitText";
import { EconomistClip } from "../components/EconomistClip";
import { ECONOMIST_COLORS, CHROME_INSET } from "../constants";
import { ECONOMIST_SERIF_FONT } from "../../../../fonts/economist-defaults";
import { EditorialDivider, EngravingTexture, ConcentricRings } from "../components/EconomistOrnaments";
import { clamp01, easeOutQuint, pressSlam } from "./motion";

/**
 * SectionDivider — a full-bleed chapter break. A small red diamond spins to
 * rest above double hairline rules, then a very large serif section name rises
 * from behind the lower rule and its letter-spacing compresses to rest (a
 * press slam), then an italic standfirst. The block is anchored in the upper
 * third (not floated dead centre) and boxed by two faint vertical rules so it
 * fills the spread. The running dateline is supplied by the shared chrome
 * footer strip.
 */
export const SectionDivider: React.FC<EconomistLayoutProps> = ({
  title,
  standfirst,
  narration,
  imageUrl,
  imageObjectPosition = "50% 50%",
  imageZoom = 1,
  videoUrl,
  videoMuted,
  videoVolume,
  videoDurationInFrames,
  videoStartInFrames,
  accentColor = ECONOMIST_COLORS.accent,
  textColor = ECONOMIST_COLORS.ink,
  titleFontSize,
  descriptionFontSize,
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
  fontFamily,
  aspectRatio = "landscape",
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const isPortrait = aspectRatio === "portrait";

  const squareScale = spring({ frame: frame - 4, fps, config: { damping: 13, mass: 0.5 } });
  // The diamond spins half a turn to rest as it scales in.
  const squareRot = 225 - 180 * easeOutQuint(clamp01((frame - 4) / 20));
  const ruleW = interpolate(frame, [8, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // The giant name rises from behind the lower divider rule (masked) while its
  // letter-spacing compresses to rest — type slammed by the press.
  const nameRise = easeOutQuint(clamp01((frame - 14) / 20));
  const slam = pressSlam(frame, 14, 20);
  const sfOp = interpolate(frame, [36, 52], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sideY = interpolate(frame, [12, 34], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const sub = standfirst || narration;
  const ruleWidth = isPortrait ? width * 0.72 : width * 0.58;
  const sidePad = isPortrait ? 70 : 120;

  // Clear the chrome strips; anchor the block in the upper third instead of
  // floating it dead-centre in a sea of paper.
  const topInset = (isPortrait ? CHROME_INSET.topPortrait : CHROME_INSET.top) + 24;
  const botInset = (isPortrait ? CHROME_INSET.bottomPortrait : CHROME_INSET.bottom) + 22;
  // Anchor the block high under the masthead strip rather than floating it low.
  const paddingTop = topInset + (isPortrait ? 40 : 28);

  /* ── Auto-fit ──────────────────────────────────────────────────────────────
     The section name is a very large fixed-size headline (up to 184px) with no
     existing heuristic; a long custom section name would blow past the frame.
     Its masking wrapper is a flex child of the outer AbsoluteFill, which uses
     alignItems:"center" (not "stretch") — so the mask/name would shrink-wrap
     around short names at measurement time without an explicit width, wrongly
     narrowing the measured column. Give the mask an explicit width so the
     fitter always measures against the true available column. The standfirst
     below cascades off the name's fitted size (they share the vertical band). */
  const nameFitRef = React.useRef<HTMLDivElement>(null);
  const nameFitTarget = (titleFontSize ?? (isPortrait ? 140 : 184)) as number;
  const { px: nameSize } = useFitText(
    nameFitRef,
    nameFitTarget,
    titleFontSizeIsUserSet ? nameFitTarget : Math.round(nameFitTarget * 0.4),
    [title, nameFitTarget, titleFontSizeIsUserSet, isPortrait, height],
    Math.round(height * (isPortrait ? 0.22 : 0.28)),
  );
  const nameSpacing = -nameSize * (0.015 + 0.03 * slam.spacingT);

  const subFitRef = React.useRef<HTMLDivElement>(null);
  const subFitTarget = (descriptionFontSize ?? (isPortrait ? 44 : 34)) as number;
  const { px: subFs } = useFitText(
    subFitRef,
    subFitTarget,
    descriptionFontSizeIsUserSet ? subFitTarget : Math.round(subFitTarget * 0.55),
    [sub, subFitTarget, descriptionFontSizeIsUserSet, nameSize, isPortrait, height],
    Math.round(height * (isPortrait ? 0.16 : 0.2)),
  );

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", padding: `${paddingTop}px ${sidePad}px ${botInset}px` }}>
      {/* Optional photo as a ghosted engraved plate: grayscale, slow drift, and
          a warm paper wash over it so the chapter type still reads as ink on
          paper rather than text on a photo. */}
      {(imageUrl || videoUrl) ? (
        <AbsoluteFill style={{ overflow: "hidden" }}>
          {(() => {
            const visualStyle: React.CSSProperties = {
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: imageObjectPosition,
              transform: `scale(${(interpolate(frame, [0, 280], [1.04, 1.12], { extrapolateRight: "clamp" }) * imageZoom).toFixed(4)})`,
              filter: "grayscale(1) contrast(0.92) brightness(1.05)",
              opacity: 0.26 * clamp01(frame / 18),
            };
            return videoUrl ? (
              <EconomistClip
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
          <AbsoluteFill
            style={{
              background:
                "linear-gradient(to bottom, rgba(246,244,238,0.86) 0%, rgba(246,244,238,0.72) 45%, rgba(246,244,238,0.9) 100%)",
            }}
          />
        </AbsoluteFill>
      ) : (
        /* Faint engraved hairline field + the signature concentric-ring motif
           fill the wide empty paper behind the name. */
        <>
          <EngravingTexture opacity={0.035} gap={10} />
          <ConcentricRings cx={18} cy={84} opacity={0.5} />
        </>
      )}

      {/* Two faint vertical rules box the chapter break like a real spread. */}
      {[sidePad, width - sidePad].map((x, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: topInset,
            bottom: botInset,
            left: x,
            width: 1,
            background: ECONOMIST_COLORS.rule,
            transform: `scaleY(${sideY})`,
            transformOrigin: "top center",
          }}
        />
      ))}

      <div style={{ width: 22, height: 22, background: accentColor, transform: `scale(${squareScale}) rotate(${squareRot.toFixed(2)}deg)`, marginBottom: isPortrait ? 36 : 44 }} />

      {/* Engraved centre-diamond divider (SVG) above the section name. */}
      <EditorialDivider width={ruleWidth} progress={ruleW} accentColor={accentColor} height={16} />

      {/* Mask: the name rises from behind the lower rule into view. Explicit
          width:"100%" here (see the fit-hook comment above) — the outer
          AbsoluteFill's alignItems:"center" would otherwise let this
          shrink-wrap around short names before the fitter measures it. */}
      <div style={{ overflow: "hidden", margin: `${isPortrait ? 30 : 36}px 0`, width: "100%" }}>
        <div
          ref={nameFitRef}
          style={{
            fontFamily: fontFamily ?? ECONOMIST_SERIF_FONT,
            fontWeight: 900,
            fontSize: nameSize,
            lineHeight: 1.0,
            letterSpacing: nameSpacing,
            color: textColor,
            textAlign: "center",
            opacity: slam.opacity,
            transform: `translateY(${((1 - nameRise) * 105).toFixed(2)}%)`,
            filter: slam.filter,
            width: "100%",
          }}
        >
          {title}
        </div>
      </div>

      {/* Engraved centre-diamond divider (SVG) below the section name. */}
      <EditorialDivider width={ruleWidth} progress={ruleW} accentColor={accentColor} height={16} />

      {sub && (
        <div
          ref={subFitRef}
          style={{
            fontFamily: fontFamily ?? ECONOMIST_SERIF_FONT,
            fontStyle: "italic",
            fontSize: subFs,
            lineHeight: 1.45,
            // Over the ghosted photo the muted grey loses contrast — use ink.
            color: (imageUrl || videoUrl) ? ECONOMIST_COLORS.ink : ECONOMIST_COLORS.muted,
            textAlign: "center",
            // width:"100%" alongside maxWidth — the parent AbsoluteFill uses
            // alignItems:"center", which would otherwise shrink-wrap this
            // around short standfirsts before the fitter measures it.
            width: "100%",
            maxWidth: isPortrait ? "100%" : "78%",
            marginTop: isPortrait ? height * 0.16 : 28,
            opacity: sfOp,
          }}
        >
          {sub}
        </div>
      )}
    </AbsoluteFill>
  );
};
