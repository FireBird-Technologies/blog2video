import React from "react";
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  MAG_DISPLAY,
  MAG_SERIF,
  MAG_SANS,
  Barcode,
  resolveMagColors,
  isPortrait,
  useReveal,
} from "../magazineStyle";

/**
 * Hero cover — a TIME-style front page: a thick red border framing a centred
 * full-bleed cover image, a masthead wordmark across the top, the date in the
 * top margin, and the cover line / byline stacked bottom-left. NO spine and NO
 * centre gutter — a cover is a single page, not an open spread. Falls back to a
 * clean typographic cover when there is no image.
 */
export const MagazineCover: React.FC<SceneLayoutProps> = (props) => {
  const { title, narration, imageUrl, imageObjectPosition, imageZoom, titleFontSize, descriptionFontSize, fontFamily } = props;
  const subtitle = props.subtitle;
  const brand = (props.brandName ?? "").trim();
  const issueLabel = props.issueLabel ?? "";
  const plus = narration?.trim();

  const p = isPortrait(props.aspectRatio);
  const { bg, text, accent } = resolveMagColors(props);
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const hasImage = !!imageUrl;
  const onImg = "#FFFFFF";

  // Geometry
  const outer = Math.round(width * (p ? 0.03 : 0.028)); // white margin
  const border = Math.round(width * (p ? 0.02 : 0.016)); // red frame thickness

  // Reveals
  const frameP = useReveal(0, 12);
  const imgScale = interpolate(frame, [0, fps * 5], [1.06, 1.0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const wordmarkO = useReveal(6, 14);
  const dateO = useReveal(2, 10);

  const words = (title ?? "").split(" ");
  const wStart = 16;
  const wStagger = Math.max(2, Math.round(fps * 0.08));
  const wDur = Math.round(fps * 0.3);
  const lastEnd = wStart + (words.length - 1) * wStagger + wDur;
  const ruleP = interpolate(frame, [lastEnd, lastEnd + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bylineO = interpolate(frame, [lastEnd + 6, lastEnd + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const plusO = interpolate(frame, [lastEnd + 14, lastEnd + 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const wordmarkPx = p ? width * 0.26 : height * 0.2;
  const coverLinePx = titleFontSize ?? (p ? width * 0.085 : height * 0.11);
  const bylinePx = descriptionFontSize ?? (p ? width * 0.04 : height * 0.05);

  const textCol = hasImage ? onImg : text;

  return (
    <AbsoluteFill style={{ background: bg, fontFamily: fontFamily ?? MAG_SERIF, overflow: "hidden" }}>
      {/* Date — top margin, left */}
      {issueLabel ? (
        <div
          style={{
            position: "absolute",
            top: Math.round(outer * 0.5),
            left: outer,
            opacity: dateO,
            fontFamily: MAG_SANS,
            fontWeight: 700,
            fontSize: p ? 16 : 15,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: text,
          }}
        >
          {issueLabel}
        </div>
      ) : null}

      {/* time.com-style footer — bottom margin, right */}
      {brand ? (
        <div
          style={{
            position: "absolute",
            bottom: Math.round(outer * 0.42),
            right: outer,
            opacity: bylineO,
            fontFamily: MAG_SANS,
            fontWeight: 700,
            fontSize: p ? 14 : 13,
            letterSpacing: "0.08em",
            color: text,
          }}
        >
          {brand.toLowerCase().replace(/\s+/g, "")}.com
        </div>
      ) : null}

      {/* Red frame */}
      <div
        style={{
          position: "absolute",
          inset: outer,
          border: `${border}px solid ${accent}`,
          overflow: "hidden",
          background: bg,
        }}
      >
        {/* Cover image */}
        {hasImage && (
          <Img
            src={imageUrl as string}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: imageObjectPosition ?? "50% 50%",
              transform: `scale(${(imageZoom ?? 1) * imgScale})`,
            }}
          />
        )}

        {/* Legibility gradients */}
        {hasImage && (
          <>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "30%", background: "linear-gradient(to bottom, rgba(0,0,0,0.28), transparent)" }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "55%", background: "linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0.15) 55%, transparent)" }} />
          </>
        )}

        {/* Masthead wordmark */}
        {brand ? (
          <div
            style={{
              position: "absolute",
              top: p ? "2.5%" : "3%",
              left: 0,
              right: 0,
              textAlign: "center",
              opacity: wordmarkO,
              fontFamily: MAG_DISPLAY,
              fontWeight: 900,
              fontSize: wordmarkPx,
              lineHeight: 0.9,
              letterSpacing: "-0.01em",
              color: hasImage ? onImg : text,
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            {brand}
          </div>
        ) : null}

        {/* Cover line block — bottom-left */}
        <div style={{ position: "absolute", left: p ? "6%" : "5%", right: p ? "6%" : "40%", bottom: p ? "7%" : "8%" }}>
          <h1
            style={{
              fontFamily: MAG_DISPLAY,
              fontWeight: 800,
              fontSize: coverLinePx,
              lineHeight: 0.98,
              letterSpacing: "-0.01em",
              textTransform: "uppercase",
              color: textCol,
              margin: 0,
            }}
          >
            {words.map((w, i) => {
              const s = wStart + i * wStagger;
              const o = interpolate(frame, [s, s + wDur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              const y = interpolate(frame, [s, s + wDur], [26, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return (
                <span key={i} style={{ display: "inline-block", opacity: o, transform: `translateY(${y}px)`, marginRight: coverLinePx * 0.22 }}>
                  {w}
                </span>
              );
            })}
          </h1>

          <div style={{ width: p ? 120 : 90, height: 4, background: accent, margin: `${p ? 22 : 18}px 0`, transformOrigin: "left center", transform: `scaleX(${ruleP})` }} />

          {subtitle ? (
            <div
              style={{
                fontFamily: MAG_SERIF,
                fontStyle: "italic",
                fontWeight: 600,
                fontSize: bylinePx,
                letterSpacing: "0.02em",
                color: textCol,
                opacity: bylineO,
              }}
            >
              {subtitle}
            </div>
          ) : null}

          {plus ? (
            <div style={{ marginTop: p ? 16 : 14, opacity: plusO, fontFamily: MAG_SANS, fontWeight: 700, fontSize: p ? 16 : 15, letterSpacing: "0.06em", textTransform: "uppercase", lineHeight: 1.4, color: textCol, maxWidth: "90%" }}>
              <span style={{ color: accent, marginRight: 8 }}>Plus</span>
              {plus}
            </div>
          ) : null}
        </div>

        {/* Newsstand barcode — bottom-right corner of the cover (landscape) */}
        {!p ? (
          <div
            style={{
              position: "absolute",
              right: "5%",
              bottom: "8%",
              background: "#FFFFFF",
              padding: "8px 10px 5px",
              opacity: bylineO,
              boxShadow: hasImage ? "0 4px 14px rgba(0,0,0,0.22)" : "none",
            }}
          >
            <Barcode color="#111111" width={104} height={32} label="0 74820 09221" />
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
