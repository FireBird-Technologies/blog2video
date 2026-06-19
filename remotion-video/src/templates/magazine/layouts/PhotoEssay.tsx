import React from "react";
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  MAG_DISPLAY,
  MAG_SERIF,
  MAG_SANS,
  CropMarks,
  resolveMagColors,
  isPortrait,
  marginPct,
  hexToRgba,
  useReveal,
  useEditorialCamera,
} from "../magazineStyle";

/**
 * Photo essay — a full-bleed editorial photograph with reversed-out type laid
 * over a dark gradient scrim: a "PHOTO ESSAY" label, a big serif headline that
 * reveals word-by-word lower-left, a red rule, an italic caption and a photo
 * credit, framed by a thin keyline with corner crop ticks.
 *
 * With NO image it falls back to the original dramatic inverted typographic
 * page (ink background, centred reversed-out statement). The image is centred /
 * full-bleed, so there is no spine or gutter (a single photographic page).
 */
export const PhotoEssay: React.FC<SceneLayoutProps> = (props) => {
  const { title, narration, titleFontSize, descriptionFontSize, fontFamily, imageUrl, imageObjectPosition, imageZoom } = props;
  const caption = (props.caption as string) ?? narration;
  const p = isPortrait(props.aspectRatio);
  const { bg, text, accent } = resolveMagColors(props);
  const m = marginPct(props.aspectRatio);

  const hasImage = Boolean(imageUrl) && props.imagePlacement !== "none";

  // Gentler 3D camera than the spread pages, with a base scale that keeps the
  // full-bleed photo covering the frame even at the tilt.
  const camera = useEditorialCamera({
    enterRotateX: 14,
    restRotateX: 6,
    enterRotateY: -10,
    restRotateY: -4,
    enterScale: 1.14,
    restScale: 1.07,
    oscRotateX: 1.5,
    oscRotateY: 1.2,
    driftY: -14,
  });

  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const labelO = useReveal(2, 12);
  const words = (title ?? "").split(" ");
  const wStart = 8;
  const wStagger = Math.max(2, Math.round(fps * 0.09));
  const wDur = Math.round(fps * 0.34);
  const lastEnd = wStart + (words.length - 1) * wStagger + wDur;
  const ruleP = interpolate(frame, [lastEnd, lastEnd + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const capO = interpolate(frame, [lastEnd + 8, lastEnd + 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const kbScale = interpolate(frame, [0, fps * 6], [1.06, 1.16], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) * (imageZoom ?? 1);

  // White type reversed out over a photograph; ink/paper type otherwise.
  const onPhoto = "#FFFFFF";
  const surface = hasImage ? "#000000" : text;
  const typeCol = hasImage ? onPhoto : bg;

  const titlePx = titleFontSize ?? (p ? 78 : 96);
  const capPx = descriptionFontSize ?? (p ? 28 : 24);

  const titleWords = (
    <h1
      style={{
        fontFamily: MAG_DISPLAY,
        fontWeight: 800,
        fontSize: titlePx,
        lineHeight: 1.02,
        letterSpacing: "-0.02em",
        color: typeCol,
        margin: 0,
        textShadow: hasImage ? "0 2px 28px rgba(0,0,0,0.55)" : "none",
      }}
    >
      {words.map((w, i) => {
        const s = wStart + i * wStagger;
        const o = interpolate(frame, [s, s + wDur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const y = interpolate(frame, [s, s + wDur], [28, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <span key={i} style={{ display: "inline-block", opacity: o, transform: `translateY(${y}px)`, marginRight: titlePx * 0.22 }}>
            {w}
          </span>
        );
      })}
    </h1>
  );

  return (
    <AbsoluteFill style={{ background: surface, fontFamily: fontFamily ?? MAG_SERIF, overflow: "hidden", perspective: "1700px", perspectiveOrigin: "50% 32%" }}>
      <AbsoluteFill
        style={{
          transformStyle: "preserve-3d",
          transform: camera.transform,
          transformOrigin: camera.transformOrigin,
          background: surface,
        }}
      >
      {/* Full-bleed photograph + legibility scrim (oversized so the tilt never
          reveals the surface at the receding edges) */}
      {hasImage && (
        <>
          <Img
            src={imageUrl as string}
            style={{
              position: "absolute",
              top: "-8%",
              left: "-8%",
              width: "116%",
              height: "116%",
              objectFit: "cover",
              objectPosition: imageObjectPosition ?? "50% 50%",
              transform: `scale(${kbScale.toFixed(4)})`,
            }}
          />
          <AbsoluteFill style={{ background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.32) 42%, rgba(0,0,0,0.12) 70%, rgba(0,0,0,0.28) 100%)" }} />
        </>
      )}

      {/* Keyline frame + corner crop ticks */}
      <div
        style={{
          position: "absolute",
          top: m,
          left: m,
          right: m,
          bottom: m,
          border: `1px solid ${hasImage ? hexToRgba("#ffffff", 0.5) : bg}`,
          opacity: (hasImage ? 0.5 : 0.22) * labelO,
          pointerEvents: "none",
        }}
      />
      <CropMarks color={hasImage ? hexToRgba("#ffffff", 0.7) : bg} inset={p ? 38 : 54} length={20} opacity={0.55 * labelO} />

      {/* Top label */}
      <div
        style={{
          position: "absolute",
          top: `calc(${m} + 30px)`,
          left: `calc(${m} + 36px)`,
          right: `calc(${m} + 36px)`,
          display: "flex",
          justifyContent: "space-between",
          opacity: labelO,
          fontFamily: MAG_SANS,
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
        }}
      >
        <span style={{ color: accent }}>Photo Essay</span>
        <span style={{ color: typeCol, opacity: 0.7 }}>{props.issueLabel ?? "Portfolio"}</span>
      </div>

      {/* Statement — centred typographic fallback, lower-left over a photo */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: hasImage ? "flex-start" : "center",
          justifyContent: hasImage ? "flex-end" : "center",
          padding: hasImage ? `0 ${p ? "9%" : "8%"} ${p ? "16%" : "13%"}` : `0 ${p ? "10%" : "14%"}`,
          textAlign: hasImage ? "left" : "center",
        }}
      >
        {titleWords}

        <div
          style={{
            width: p ? 140 : 180,
            height: 3,
            background: accent,
            margin: `${p ? 28 : 32}px 0`,
            transformOrigin: hasImage ? "left center" : "center",
            transform: `scaleX(${ruleP})`,
          }}
        />

        {caption && (
          <p
            style={{
              fontFamily: MAG_SERIF,
              fontStyle: "italic",
              fontSize: capPx,
              lineHeight: 1.5,
              color: typeCol,
              opacity: capO * (hasImage ? 0.92 : 0.8),
              margin: 0,
              maxWidth: hasImage ? (p ? "92%" : "56%") : p ? "92%" : "62%",
              textShadow: hasImage ? "0 1px 16px rgba(0,0,0,0.55)" : "none",
            }}
          >
            {caption}
          </p>
        )}
      </div>

      {/* Foot folio + photo credit */}
      <div
        style={{
          position: "absolute",
          bottom: `calc(${m} + 26px)`,
          left: `calc(${m} + 36px)`,
          right: `calc(${m} + 36px)`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          opacity: capO,
        }}
      >
        <span style={{ fontFamily: MAG_SERIF, fontWeight: 700, fontSize: 16, color: typeCol }}>{props.pageNumber ?? "01"}</span>
        {hasImage ? (
          <span style={{ fontFamily: MAG_SANS, fontWeight: 600, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: typeCol, opacity: 0.7 }}>
            Photograph
          </span>
        ) : (
          <span style={{ width: 44, height: 2, background: accent }} />
        )}
      </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
