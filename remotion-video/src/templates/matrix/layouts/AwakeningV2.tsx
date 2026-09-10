import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { useFitText } from "../components/useFitText";
import { MatrixBackground } from "../MatrixBackground";
import { GlitchSlice, RainBurst, ScanlinesOverlay } from "../components/MatrixArtifacts";
import { MATRIX_DEFAULT_FONT_FAMILY } from "../constants";
import type { MatrixLayoutProps } from "../types";
import { ZoomCropImg } from "../components/ZoomCropImg";
import { ZoomCropVideo } from "../components/ZoomCropVideo";

const CIPHER_CHARS = "アイウエオカキクケコ0123456789!@#$%ΔΣΩλ<>{}[]";

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/**
 * AwakeningV2 — "System Exit" (variant of awakening)
 *
 * Same props as the base, deliberately different composition. The base settles
 * into calm — words sharpening out of blur over thinning rain. This one does the
 * opposite, closing on a system going loud:
 *
 *   * alignment — copy RIGHT-aligned against a left-edge rule that draws
 *     downward, instead of centred in the frame;
 *   * reveal — words resolve out of cipher glyphs RIGHT-to-LEFT (reversing the
 *     base's reading-order stagger), instead of per-word blur-to-sharp;
 *   * highlight — `highlightPhrase` gets a bar expanding from its centre behind
 *     the text, instead of an underline drawn beneath it;
 *   * CTA — types up from below with a blinking block cursor, instead of sliding
 *     in from the right;
 *   * background — rain INTENSIFIES across the scene (0.3 → 1.0) rather than
 *     sitting at a constant low level, and the GridTunnel floor is dropped so
 *     the frame flattens as it closes.
 */
export const AwakeningV2: React.FC<MatrixLayoutProps> = ({
  title,
  narration,
  highlightPhrase,
  cta,
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
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const fps = 30;
  const p = aspectRatio === "portrait";
  const accent = accentColor || "#00FF41";
  const resolvedFontFamily = fontFamily ?? MATRIX_DEFAULT_FONT_FAMILY;
  const hasImage = !!imageUrl || !!videoUrl;

  // Same fallbacks as the base.
  const displayText = narration || title;
  const displayCta = cta || "> Read the full article";

  const headlineRef = React.useRef<HTMLDivElement>(null);
  const ctaRef = React.useRef<HTMLDivElement>(null);
  const headlineTarget = titleFontSize ?? (p ? 67 : 59);
  const ctaTarget = descriptionFontSize ?? (p ? 37 : 38);
  const { px: fittedHeadlineSize } = useFitText(
    headlineRef,
    headlineTarget,
    15,
    [displayText, headlineTarget, p, hasImage],
    height * (hasImage && !p ? 0.34 : 0.46),
  );
  const { px: fittedCtaSize } = useFitText(ctaRef, ctaTarget, 12, [displayCta, ctaTarget, p], height * 0.13);

  // ── Split the headline into words, tagging which fall inside the highlight ──
  const words = displayText.split(/(\s+)/).filter((s) => s.length > 0);
  const hIdx = highlightPhrase ? displayText.toLowerCase().indexOf(highlightPhrase.toLowerCase()) : -1;
  const hStart = hIdx;
  const hEnd = hIdx === -1 ? -1 : hIdx + (highlightPhrase?.length ?? 0);

  // Character offset of each token, so highlight membership is a range test.
  let cursor = 0;
  const tokens = words.map((tok) => {
    const start = cursor;
    cursor += tok.length;
    const isSpace = tok.trim() === "";
    const inHighlight = hStart !== -1 && start >= hStart && start < hEnd;
    return { tok, isSpace, inHighlight };
  });

  const realWordCount = tokens.filter((t) => !t.isSpace).length;
  const wordStride = 4;
  const resolveStart = 6;
  // Right-to-left stagger: the LAST word resolves first.
  let wordSeq = 0;

  const headlineEnd = resolveStart + realWordCount * wordStride + 12;

  // Highlight bar expands from its centre once the phrase has resolved.
  const barSpring = spring({
    frame: frame - (resolveStart + realWordCount * wordStride * 0.5),
    fps,
    config: { damping: 20, stiffness: 150 },
  });

  // Left rule draws downward.
  const ruleDraw = interpolate(frame, [2, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // CTA rises from below, typing in, with a blinking block cursor.
  const ctaStart = headlineEnd;
  const ctaRise = spring({ frame: frame - ctaStart, fps, config: { damping: 20, stiffness: 130 } });
  const ctaOpacity = interpolate(frame, [ctaStart, ctaStart + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ctaTyped = Math.max(0, Math.min(displayCta.length, Math.floor((frame - ctaStart - 6) * 1.6)));
  const ctaVisible = displayCta.slice(0, ctaTyped);
  const ctaCursorOn = frame > ctaStart && (ctaTyped < displayCta.length || frame % 30 < 15);

  // Rain ramps UP across the scene — the inverse of the base's fade-to-calm.
  // MatrixBackground's own `opacity` prop is inert, so this rides a wrapper.
  const rainStrength = interpolate(frame, [0, 90], [0.3, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Image band wipes open from the centre.
  const bandWipe = interpolate(frame, [8, 36], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const bandEased = 1 - Math.pow(1 - bandWipe, 3);

  const imageMedia = videoUrl ? (
    <ZoomCropVideo
      src={videoUrl}
      imageObjectPosition={imageObjectPosition}
      imageZoom={imageZoom}
      muted={videoMuted ?? true}
      volume={videoVolume ?? 0.35}
      durationInFrames={videoDurationInFrames}
      startInFrames={videoStartInFrames}
    />
  ) : imageUrl ? (
    <ZoomCropImg src={imageUrl} imageObjectPosition={imageObjectPosition} imageZoom={imageZoom} />
  ) : null;

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: bgColor }}>
      <AbsoluteFill style={{ opacity: rainStrength }}>
        <MatrixBackground bgColor={bgColor} fontFamily={resolvedFontFamily} />
      </AbsoluteFill>

      {/* Portrait: image as a dim full-bleed backdrop behind the copy. */}
      {hasImage && p && (
        <AbsoluteFill style={{ opacity: 0.16 * bandEased }}>{imageMedia}</AbsoluteFill>
      )}

      {/* Rain surge arrives LATE (the base starts it at 18) so the close builds.
          GridTunnel and CodeFragments are dropped — the frame flattens out. */}
      <RainBurst accentColor={accent} centerX={50} widthPct={100} columns={16} startFrame={40} seed={53} />
      <GlitchSlice accentColor={accent} every={54} seed={67} />
      <ScanlinesOverlay accentColor={accent} intensity={0.8} />

      {/* Landscape: wide band across the bottom third, opening from the centre. */}
      {hasImage && !p && (
        <div
          style={{
            position: "absolute",
            left: "7%",
            right: "7%",
            bottom: "6%",
            height: "32%",
            overflow: "hidden",
            border: `1px solid ${accent}33`,
            clipPath: `inset(0 ${(1 - bandEased) * 50}% 0 ${(1 - bandEased) * 50}%)`,
          }}
        >
          {imageMedia}
        </div>
      )}

      {/* ── Copy block: right-aligned, against a left-edge rule ── */}
      <div
        style={{
          position: "absolute",
          left: p ? "9%" : "10%",
          right: p ? "9%" : "10%",
          // Sits above the image band in landscape; centred otherwise.
          top: hasImage && !p ? "8%" : 0,
          bottom: hasImage && !p ? "42%" : 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          justifyContent: "center",
        }}
      >
        {/* Vertical rule pinned to the left edge of the copy block. */}
        <div
          style={{
            position: "absolute",
            left: p ? -16 : -26,
            top: "12%",
            width: 2,
            height: `${ruleDraw * 76}%`,
            backgroundColor: `${accent}55`,
            boxShadow: `0 0 10px ${accent}44`,
          }}
        />

        <div
          ref={headlineRef}
          style={{
            fontSize: fittedHeadlineSize,
            fontWeight: 700,
            color: accent,
            letterSpacing: "-0.01em",
            lineHeight: 1.3,
            fontFamily: resolvedFontFamily,
            textAlign: "right",
            width: "100%",
            overflowWrap: "anywhere",
            position: "relative",
          }}
        >
          {tokens.map(({ tok, isSpace, inHighlight }, i) => {
            if (isSpace) return <span key={i}>{tok}</span>;

            // Right-to-left: index from the END of the word sequence.
            const myIdx = realWordCount - 1 - wordSeq;
            wordSeq++;
            const start = resolveStart + myIdx * wordStride;
            const local = frame - start;

            const resolveFrames = 10;
            const resolved = local >= resolveFrames;
            const scrambling = local >= 0 && !resolved;
            const opacity = interpolate(local, [0, 4], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            // While scrambling, each character shows a cipher glyph instead.
            const text = scrambling
              ? tok
                  .split("")
                  .map((_, ci) =>
                    CIPHER_CHARS[Math.floor(seededRandom(i * 131 + ci * 17 + frame * 7) * CIPHER_CHARS.length)],
                  )
                  .join("")
              : tok;

            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  position: "relative",
                  opacity,
                  color: inHighlight ? "#FFFFFF" : scrambling ? `${accent}77` : accent,
                  textShadow: resolved ? `0 0 12px ${accent}44` : "none",
                }}
              >
                {/* Highlight BAR expanding from centre, behind the word. */}
                {inHighlight && (
                  <span
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: "-0.06em",
                      height: "1.12em",
                      width: `${barSpring * 108}%`,
                      transform: "translateX(-50%)",
                      backgroundColor: `${accent}33`,
                      borderTop: `1px solid ${accent}66`,
                      borderBottom: `1px solid ${accent}66`,
                      zIndex: -1,
                    }}
                  />
                )}
                {text}
              </span>
            );
          })}
        </div>

        {/* CTA — rises from below and types in. */}
        <div
          ref={ctaRef}
          style={{
            marginTop: p ? 26 : 34,
            fontSize: fittedCtaSize,
            fontWeight: 400,
            color: `${accent}AA`,
            letterSpacing: "0.1em",
            fontFamily: resolvedFontFamily,
            textAlign: "right",
            opacity: ctaOpacity,
            transform: `translateY(${(1 - ctaRise) * 26}px)`,
            overflowWrap: "anywhere",
          }}
        >
          {ctaVisible}
          {ctaCursorOn && <span style={{ color: accent, textShadow: `0 0 10px ${accent}` }}>█</span>}
        </div>
      </div>
    </AbsoluteFill>
  );
};
