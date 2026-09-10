import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { useFitText } from "../components/useFitText";
import { MatrixBackground } from "../MatrixBackground";
import { CipherRing, ScanlinesOverlay, SignalWaveform } from "../components/MatrixArtifacts";
import { MATRIX_DEFAULT_FONT_FAMILY } from "../constants";
import type { MatrixLayoutProps } from "../types";
import { ZoomCropImg } from "../components/ZoomCropImg";
import { ZoomCropVideo } from "../components/ZoomCropVideo";

/**
 * One odometer digit. Rolls up into place out of a clipped mask.
 *
 * Non-digit characters (".", ",", "%", letters in a non-numeric value) are
 * rendered static — rolling them looks like a glitch rather than a counter.
 *
 * Declared at module scope (not inside the layout) so its component identity is
 * stable across frames: a nested definition would remount every digit of every
 * row on each of the ~180 frames this scene renders.
 */
const Digit: React.FC<{
  char: string;
  delay: number;
  size: number;
  frame: number;
  fps: number;
}> = ({ char, delay, size, frame, fps }) => {
  const isDigit = char >= "0" && char <= "9";
  const local = frame - delay;

  if (!isDigit) {
    return (
      <span
        style={{
          opacity: interpolate(local, [0, 6], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        {char}
      </span>
    );
  }

  const settle = spring({ frame: local, fps, config: { damping: 26, stiffness: 190 } });

  return (
    <span
      style={{
        display: "inline-block",
        height: size * 1.06,
        overflow: "hidden",
        verticalAlign: "bottom",
      }}
    >
      <span
        style={{
          display: "block",
          transform: `translateY(${(1 - settle) * size * 1.06}px)`,
        }}
      >
        {char}
      </span>
    </span>
  );
};

/**
 * CipherMetricV2 — "Readout Grid" (variant of cipher_metric)
 *
 * Same props as the base, deliberately different composition. The base renders
 * only `metrics[0]` large and collapses the rest into one dim joined line; this
 * variant gives every metric its own row, so the same data reads as a ledger:
 *
 *   * alignment — a LEFT-aligned rule-separated grid (label left, value right)
 *     instead of one centred giant number over a card;
 *   * image — a wide band across the TOP (landscape) / above the ledger
 *     (portrait), instead of a square-ish panel beside the number;
 *   * numbers — an odometer roll, each row's digits sliding up out of a clipped
 *     mask, instead of cipher-noise-then-count-up;
 *   * background — rain pulled back, CipherRing pushed off-centre and kept even
 *     when an image is present (the base hides it then).
 */
export const CipherMetricV2: React.FC<MatrixLayoutProps> = ({
  title,
  narration,
  metrics,
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

  // Every metric becomes a row (schema caps at 5). Falling back to a single
  // synthesised row keeps the layout sane when `metrics` is absent, matching the
  // base's `primary?.value || title` behaviour.
  const rows =
    metrics && metrics.length > 0
      ? metrics.slice(0, 5)
      : [{ value: title, label: narration || "", suffix: undefined as string | undefined }];

  const rowCount = rows.length;

  // The value column carries the weight; sizes shrink as rows are added so a
  // 5-metric ledger still fits the same vertical budget.
  const valueTarget = titleFontSize ?? (p ? 182 : 117);
  const scaledValueTarget = Math.round(
    valueTarget * (rowCount >= 5 ? 0.34 : rowCount >= 4 ? 0.4 : rowCount >= 3 ? 0.5 : rowCount >= 2 ? 0.66 : 1),
  );
  const labelTarget = descriptionFontSize ?? (p ? 48 : 45);
  const scaledLabelTarget = Math.round(labelTarget * (rowCount >= 4 ? 0.72 : rowCount >= 3 ? 0.85 : 1));

  const longestValue = rows.reduce(
    (longest, r) => (`${r.value}${r.suffix || ""}`.length > longest.length ? `${r.value}${r.suffix || ""}` : longest),
    "",
  );
  const longestLabel = rows.reduce((longest, r) => ((r.label || "").length > longest.length ? r.label || "" : longest), "");

  const valueMirrorRef = React.useRef<HTMLDivElement>(null);
  const labelMirrorRef = React.useRef<HTMLDivElement>(null);
  const footRef = React.useRef<HTMLDivElement>(null);

  const ledgerBudget = height * (hasImage ? (p ? 0.4 : 0.5) : 0.62);
  const { px: fittedValueSize } = useFitText(
    valueMirrorRef,
    scaledValueTarget,
    18,
    [longestValue, scaledValueTarget, p, hasImage, rowCount],
    ledgerBudget / rowCount,
  );
  const { px: fittedLabelSize } = useFitText(
    labelMirrorRef,
    scaledLabelTarget,
    11,
    [longestLabel, scaledLabelTarget, p, hasImage, rowCount],
    (ledgerBudget / rowCount) * 0.5,
  );
  // The footer carries `narration` only when it is not already the sole row's label.
  const footText = metrics && metrics.length > 0 ? (narration || "").trim() : "";
  const { px: fittedFootSize } = useFitText(
    footRef,
    Math.round(scaledLabelTarget * 0.8),
    10,
    [footText, scaledLabelTarget, p, rowCount],
    height * 0.12,
  );

  const rowStride = 8;
  const rowStart = 10;

  const headerOpacity = interpolate(frame, [2, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const footStart = rowStart + rowCount * rowStride + 6;
  const footOpacity = interpolate(frame, [footStart, footStart + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Image band wipes in from the left.
  const bandWipe = interpolate(frame, [4, 30], [0, 1], {
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
      {/* `opacity` on MatrixBackground is inert — set rain strength on a wrapper. */}
      <AbsoluteFill style={{ opacity: 0.4 }}>
        <MatrixBackground bgColor={bgColor} fontFamily={resolvedFontFamily} />
      </AbsoluteFill>

      {/* Cipher dial pushed off-centre right, and kept even WITH an image (the
          base drops it in that case). No DecodeSweep / HUD / TelemetryGauge —
          the ledger supplies its own structure. */}
      <AbsoluteFill style={{ transform: `translateX(${p ? 18 : 26}%)`, opacity: 0.7 }}>
        <CipherRing accentColor={accent} scale={0.5} startFrame={6} seed={35} />
      </AbsoluteFill>
      <SignalWaveform accentColor={accent} edge="top" seed={41} startFrame={10} />
      <ScanlinesOverlay accentColor={accent} intensity={0.75} />

      {/* Hidden mirrors give useFitText the longest real strings to measure. */}
      <div
        ref={valueMirrorRef}
        style={{
          position: "absolute",
          visibility: "hidden",
          width: "44%",
          fontSize: scaledValueTarget,
          fontWeight: 700,
          lineHeight: 1,
          fontFamily: resolvedFontFamily,
          overflowWrap: "anywhere",
        }}
      >
        {longestValue}
      </div>
      <div
        ref={labelMirrorRef}
        style={{
          position: "absolute",
          visibility: "hidden",
          width: "44%",
          fontSize: scaledLabelTarget,
          fontWeight: 700,
          lineHeight: 1.2,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontFamily: resolvedFontFamily,
          overflowWrap: "anywhere",
        }}
      >
        {longestLabel}
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: p ? "6% 8%" : "5% 7%",
          gap: p ? 22 : 28,
        }}
      >
        {/* Wide image band across the top. */}
        {hasImage && (
          <div
            style={{
              width: "100%",
              height: p ? "20%" : "30%",
              flex: "0 0 auto",
              overflow: "hidden",
              border: `1px solid ${accent}33`,
              clipPath: `inset(0 ${(1 - bandEased) * 100}% 0 0)`,
            }}
          >
            {imageMedia}
          </div>
        )}

        {/* Ledger header — the scene title as a column caption. */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 16,
            opacity: headerOpacity,
            borderBottom: `1px solid ${accent}44`,
            paddingBottom: 6,
            flex: "0 0 auto",
          }}
        >
          <span
            style={{
              fontSize: Math.max(11, fittedLabelSize * 0.62),
              fontWeight: 400,
              color: `${accent}88`,
              fontFamily: resolvedFontFamily,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              overflowWrap: "anywhere",
            }}
          >
            {title}
          </span>
          <span
            style={{
              flex: "0 0 auto",
              fontSize: Math.max(10, fittedLabelSize * 0.55),
              fontWeight: 400,
              color: `${accent}55`,
              fontFamily: resolvedFontFamily,
              letterSpacing: "0.2em",
            }}
          >
            [{String(rowCount).padStart(2, "0")} RECORDS]
          </span>
        </div>

        {/* ── The ledger itself ── */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          {rows.map((m, i) => {
            const delay = rowStart + i * rowStride;
            const local = frame - delay;
            const rowOpacity = interpolate(local, [0, 8], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            // Each row's rule draws left→right as the row lands.
            const ruleDraw = interpolate(local, [2, 18], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const valueChars = `${m.value ?? ""}`.split("");

            return (
              <div key={i} style={{ position: "relative", paddingBottom: p ? 10 : 12, marginBottom: p ? 10 : 12 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: p ? 16 : 28,
                    opacity: rowOpacity,
                  }}
                >
                  <span
                    style={{
                      fontSize: fittedLabelSize,
                      fontWeight: 700,
                      color: `${accent}CC`,
                      fontFamily: resolvedFontFamily,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      lineHeight: 1.2,
                      overflowWrap: "anywhere",
                    }}
                  >
                    {m.label || title}
                  </span>

                  <span
                    style={{
                      flex: "0 0 auto",
                      fontSize: fittedValueSize,
                      fontWeight: 700,
                      color: accent,
                      fontFamily: resolvedFontFamily,
                      letterSpacing: "-0.02em",
                      lineHeight: 1.06,
                      whiteSpace: "nowrap",
                      textShadow: `0 0 16px ${accent}66`,
                    }}
                  >
                    {valueChars.map((c, ci) => (
                      <Digit
                        key={ci}
                        char={c}
                        delay={delay + ci * 2}
                        size={fittedValueSize}
                        frame={frame}
                        fps={fps}
                      />
                    ))}
                    {m.suffix && (
                      <span style={{ color: `${accent}88`, fontSize: "0.5em" }}>{m.suffix}</span>
                    )}
                  </span>
                </div>

                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    bottom: 0,
                    height: 1,
                    width: `${ruleDraw * 100}%`,
                    backgroundColor: `${accent}33`,
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Footer prose, when narration is not already carried by a row label. */}
        {footText && (
          <div
            ref={footRef}
            style={{
              fontSize: fittedFootSize,
              color: `${accent}66`,
              fontFamily: resolvedFontFamily,
              lineHeight: 1.4,
              letterSpacing: "0.04em",
              opacity: footOpacity,
              maxHeight: height * 0.12,
              overflow: "hidden",
              overflowWrap: "anywhere",
              flex: "0 0 auto",
            }}
          >
            {footText}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
