import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { useFitText } from "../components/useFitText";
import { MatrixBackground } from "../MatrixBackground";
import { GridTunnel, ScanlinesOverlay, TelemetryGauge } from "../components/MatrixArtifacts";
import { MATRIX_DEFAULT_FONT_FAMILY } from "../constants";
import type { MatrixLayoutProps } from "../types";
import { ZoomCropImg } from "../components/ZoomCropImg";
import { ZoomCropVideo } from "../components/ZoomCropVideo";

const GLITCH_CHARS = "アイウエオカキクケコサシスセソ0123456789!@#$%^&*<>{}[]/\\|";

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/**
 * MatrixTitleV2 — "Boot Sequence" (variant of matrix_title)
 *
 * Same props as the base, deliberately different composition. Where the base
 * centres a per-character decode over heavy rain, this reads as a machine
 * bringing itself up:
 *
 *   * alignment — the copy is LEFT-aligned and BOTTOM-anchored inside a bracketed
 *     console block, instead of centred in the frame;
 *   * image — bled to a frame edge and dissolved into the console field with a
 *     gradient, rather than sitting in a card beside the title: a full-height
 *     column on the RIGHT in landscape, a band across the TOP in portrait;
 *   * text — the FULL title holds its final shape from frame 0 with every
 *     character shuffling through glyph noise, then resolves left-to-right under
 *     a held `[ OK ]`. The base instead reveals characters out of blank space,
 *     so its block grows as it types; here nothing reflows, only content settles;
 *   * background — rain pulled back behind a GridTunnel floor, so the frame reads
 *     deeper and darker than the base's rain-forward hero.
 */
export const MatrixTitleV2: React.FC<MatrixLayoutProps> = ({
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
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const fps = 30;
  const p = aspectRatio === "portrait";
  const accent = accentColor || "#00FF41";
  const resolvedFontFamily = fontFamily ?? MATRIX_DEFAULT_FONT_FAMILY;
  const hasImage = !!imageUrl || !!videoUrl;

  // Only the landscape image is a side-by-side column, so it alone narrows the
  // copy. In portrait the band sits ABOVE the copy, which keeps the full width.
  const copyIsFullWidth = p || !hasImage;

  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const narrationRef = React.useRef<HTMLParagraphElement>(null);
  const titleTarget = titleFontSize ?? (p ? 128 : 90);
  const narrationTarget = descriptionFontSize ?? (p ? 52 : 44);
  // Portrait now spends its top 44% on the image band, so the copy has to fit in
  // what's left — the old full-bleed backdrop left the whole frame available.
  const { px: fittedTitleSize } = useFitText(
    titleRef,
    titleTarget,
    18,
    [title, titleTarget, p, hasImage],
    height * (p ? (hasImage ? 0.2 : 0.34) : 0.36),
  );
  const narrationBudget = Math.round(height * (p ? (hasImage ? 0.14 : 0.24) : 0.22));
  const { px: fittedNarrationSize } = useFitText(
    narrationRef,
    narrationTarget,
    p ? 12 : 11,
    [narration, narrationTarget, p, hasImage, width, height],
    narrationBudget,
  );

  // ── Boot decode: the FULL title occupies its final shape from frame 0, every
  // character shuffling through glyph noise, then resolving left-to-right. ──
  //
  // This is the key difference from the base, which reveals characters one at a
  // time out of blank space (so the block grows as it types). Here the whole
  // headline is present immediately and only its CONTENT settles, so the layout
  // never reflows and the scene reads as a machine locking onto a signal.
  const titleChars = title.split("");
  const realCharCount = titleChars.filter((c) => c.trim() !== "").length;

  // Resolve the whole title inside a fixed window regardless of length, so a
  // long headline doesn't run past the scene. Every character shuffles until its
  // own resolve frame arrives.
  const bootStart = 6;
  const decodeWindow = p ? 46 : 42;
  const charStride = realCharCount > 0 ? decodeWindow / realCharCount : 0;
  const bootEnd = bootStart + decodeWindow + 6;

  const railDraw = interpolate(frame, [4, bootEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // `[ OK ]` holds while the title is still decoding, then fades once it locks.
  const okOpacity = interpolate(
    frame,
    [bootStart, bootStart + 4, bootEnd - 4, bootEnd + 6],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  // The whole block fades up as one, rather than line by line.
  const titleOpacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleRise = spring({
    frame: frame - 2,
    fps,
    config: { damping: 24, stiffness: 190 },
  });

  const narrationOpacity = interpolate(frame, [bootEnd, bootEnd + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const narrationRise = spring({
    frame: frame - bootEnd,
    fps,
    config: { damping: 22, stiffness: 140 },
  });

  // Image: a hard-edged plate that wipes DOWN into place from the top edge in
  // both orientations (the base scales + rotates its card instead).
  const imageWipe = interpolate(frame, [6, 32], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const imageEased = 1 - Math.pow(1 - imageWipe, 3);

  const gaugeStart = Math.max(0, bootStart - 4);

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
    <ZoomCropImg
      src={imageUrl}
      imageObjectPosition={imageObjectPosition}
      imageZoom={imageZoom}
    />
  ) : null;

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: bgColor }}>
      {/* MatrixBackground's `opacity` prop is inert (it is destructured but never
          applied), so per-scene rain strength has to be set by this wrapper. */}
      <AbsoluteFill style={{ opacity: 0.45 }}>
        <MatrixBackground bgColor={bgColor} fontFamily={resolvedFontFamily} />
      </AbsoluteFill>

      {/* Floor plane + a single corner readout. No RainBurst/HUD/GlitchSlice —
          dropping the base's chrome is part of what separates the two looks. */}
      <GridTunnel accentColor={accent} intensity={0.55} />
      <TelemetryGauge accentColor={accent} label="BOOT" corner="bottom-left" startFrame={gaugeStart} seed={17} />
      <ScanlinesOverlay accentColor={accent} intensity={0.7} />

      {/* Portrait: a band across the UPPER section, bled to the top edge. Same
          treatment as the landscape column — a hard edge into the console field
          plus a gradient that dissolves the inner edge — only rotated, so the
          image fades DOWNWARD into the copy instead of sideways. */}
      {hasImage && p && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "44%",
            overflow: "hidden",
            borderBottom: `1px solid ${accent}33`,
            clipPath: `inset(0 0 ${(1 - imageEased) * 100}% 0)`,
          }}
        >
          {imageMedia}
          <AbsoluteFill
            style={{
              background: `linear-gradient(to top, ${bgColor || "#000000"} 0%, transparent 22%)`,
              pointerEvents: "none",
            }}
          />
        </div>
      )}

      {/* Landscape: full-height column bled to the right edge, wiping down. */}
      {hasImage && !p && (
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            width: "34%",
            overflow: "hidden",
            borderLeft: `1px solid ${accent}33`,
            clipPath: `inset(${(1 - imageEased) * 100}% 0 0 0)`,
          }}
        >
          {imageMedia}
          {/* Ties the column into the black field so it reads as part of the
              console rather than a pasted-on card. */}
          <AbsoluteFill
            style={{
              background: `linear-gradient(to right, ${bgColor || "#000000"} 0%, transparent 22%)`,
              pointerEvents: "none",
            }}
          />
        </div>
      )}

      {/* ── Console block: left-aligned, bottom-anchored ── */}
      <div
        style={{
          position: "absolute",
          left: p ? "8%" : "7%",
          right: copyIsFullWidth ? (p ? "8%" : "7%") : "40%",
          // Portrait with a band: bound the top so the copy can never ride up
          // into the image, and justify to the END so it still hangs off the
          // bottom of the frame the way the unbanded layout does.
          top: hasImage && p ? "48%" : undefined,
          bottom: p ? "14%" : "12%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: hasImage && p ? "flex-end" : undefined,
        }}
      >
        {/* Vertical rail drawing downward beside the log. */}
        <div
          style={{
            position: "absolute",
            left: -22,
            top: 0,
            width: 2,
            height: `${railDraw * 100}%`,
            backgroundColor: `${accent}55`,
            boxShadow: `0 0 10px ${accent}44`,
          }}
        />

        {/* Hidden full-text mirror: carries the real heading semantics and gives
            useFitText the FINAL copy to measure, rather than a partially-printed
            log. Same reasoning as the base layout's mirror. */}
        <h1
          ref={titleRef}
          style={{
            position: "absolute",
            visibility: "hidden",
            pointerEvents: "none",
            fontSize: fittedTitleSize,
            fontWeight: 700,
            fontFamily: resolvedFontFamily,
            textAlign: "left",
            lineHeight: 1.14,
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            margin: 0,
            width: "100%",
            overflowWrap: "anywhere",
          }}
        >
          {title}
        </h1>

        <div
          aria-hidden
          style={{
            width: "100%",
            opacity: titleOpacity,
            transform: `translateY(${(1 - titleRise) * 10}px)`,
          }}
        >
          {/* `[ OK ]` sits on its own line above the headline. It has to be a
              BLOCK rather than an inline sibling: inline, it would join the
              title's text flow and shift every character sideways when it
              faded, which is exactly the reflow this variant avoids. */}
          <div
            style={{
              fontSize: Math.max(11, fittedTitleSize * 0.2),
              fontWeight: 400,
              color: `${accent}88`,
              fontFamily: resolvedFontFamily,
              letterSpacing: "0.12em",
              opacity: okOpacity,
              marginBottom: p ? 6 : 8,
              height: Math.max(11, fittedTitleSize * 0.2) * 1.3,
            }}
          >
            [ OK ]
          </div>

          <div
            style={{
              fontSize: fittedTitleSize,
              fontWeight: 700,
              color: accent,
              fontFamily: resolvedFontFamily,
              lineHeight: 1.14,
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
              overflowWrap: "anywhere",
              textShadow: `0 0 18px ${accent}66, 0 0 38px ${accent}33`,
            }}
          >
            {(() => {
              // `realIdx` counts only non-space characters, so runs of spaces
              // don't buy the following word extra delay.
              let realIdx = 0;
              return titleChars.map((char, i) => {
                const isSpace = char.trim() === "";
                // A space never scrambles — swapping it for a glyph would change
                // where the line wraps mid-animation.
                if (isSpace) {
                  return <span key={i}>{char}</span>;
                }

                const resolveAt = bootStart + realIdx * charStride;
                realIdx++;
                const isResolved = frame >= resolveAt;

                // Every unresolved character shuffles from frame 0 — the whole
                // title is legible-as-noise immediately, then locks in place.
                const displayChar = isResolved
                  ? char
                  : GLITCH_CHARS[
                      Math.floor(
                        seededRandom(i * 100 + Math.floor(frame / 2) * 7) * GLITCH_CHARS.length,
                      )
                    ];

                return (
                  <span
                    key={i}
                    style={{
                      color: isResolved ? accent : `${accent}77`,
                      // Unresolved glyphs sit slightly dimmer and unglowed, so
                      // the resolved text reads as the "locked" layer.
                      textShadow: isResolved ? undefined : "none",
                      // Because this variant scrambles the WHOLE title at once
                      // (rather than one character at a time like the base), a
                      // full-width katakana standing in for a narrow Latin
                      // letter would visibly re-wrap the block every few frames.
                      // Pinning each cell to one monospace advance keeps the
                      // headline's shape identical from frame 0 to lock.
                      ...(isResolved
                        ? null
                        : {
                            display: "inline-block",
                            width: "1ch",
                            textAlign: "center" as const,
                            overflow: "hidden",
                          }),
                    }}
                  >
                    {displayChar}
                  </span>
                );
              });
            })()}
          </div>
        </div>

        {narration && (
          <>
            {/* Rule drawn between the log and the narration. */}
            <div
              style={{
                marginTop: p ? 18 : 24,
                width: `${narrationOpacity * 100}%`,
                maxWidth: 520,
                height: 1,
                backgroundColor: `${accent}44`,
              }}
            />
            <p
              ref={narrationRef}
              style={{
                fontSize: fittedNarrationSize,
                fontWeight: 400,
                color: `${accent}88`,
                fontFamily: resolvedFontFamily,
                textAlign: "left",
                margin: `${p ? 14 : 18}px 0 0`,
                letterSpacing: "0.08em",
                lineHeight: 1.4,
                opacity: narrationOpacity,
                transform: `translateY(${(1 - narrationRise) * 10}px)`,
                width: "100%",
                maxWidth: copyIsFullWidth ? Math.min(1320, width * 0.8) : "100%",
                maxHeight: narrationBudget,
                flexShrink: 0,
                overflow: "hidden",
                overflowWrap: "anywhere",
              }}
            >
              {narration}
            </p>
          </>
        )}
      </div>
    </AbsoluteFill>
  );
};
