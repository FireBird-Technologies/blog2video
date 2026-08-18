import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { GridcraftLayoutProps } from "../types";
import {
  GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY,
  GRIDCRAFT_DEFAULT_SERIF_FONT_FAMILY,
} from "../constants";
import { glass, COLORS } from "../utils/styles";
import { ZoomCropImg } from "../components/ZoomCropImg";

/**
 * BentoHeroV2 — "Sidebar Rail"
 *
 * Variant of `bento_hero`. Same props, different composition.
 *
 * Base is a 2×2 bento with a big orange title cell top-left and two glass cells
 * beside it. This one drops the grid entirely for an asymmetric editorial opener:
 *
 *   • a narrow full-height ACCENT RAIL down the left edge, carrying the category
 *     rotated vertically and an index rule — the only accent element, per the
 *     template's one-hot-colour rule;
 *   • the title set large against an open, un-carded right field (the base boxes
 *     everything; here the type breathes on the page ground);
 *   • the image as a single wide card anchored bottom-right, not a grid cell.
 *
 * Motion differs too: the base scales three cells in together; this one WIPES the
 * rail down first (scaleY from the top), then lets the title lines rise under it.
 *
 * `Blobs` is rendered once by the composition wrapper — do NOT re-render it here.
 */
export const BentoHeroV2: React.FC<GridcraftLayoutProps> = ({
  title,
  subtitle,
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
  textColor,
  category,
  titleFontSize,
  descriptionFontSize,
  categoryFontSize,
  aspectRatio,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = aspectRatio === "portrait";

  const accent = accentColor || COLORS.ACCENT;
  const ink = textColor || COLORS.DARK;

  const sansFontFamily = fontFamily ?? GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY;
  const serifFontFamily = fontFamily ?? GRIDCRAFT_DEFAULT_SERIF_FONT_FAMILY;
  // Template signature: serif in landscape, sans in portrait.
  const titleFontFamily = p ? sansFontFamily : serifFontFamily;

  // Same dynamic-content contract as the base.
  const categoryTag =
    (category ?? (title ? title.split(/\s+/)[0]?.slice(0, 14) : "Featured")) || "Featured";
  const tagline = subtitle || narration || "";
  const hasMedia = Boolean(imageUrl || videoUrl);

  const spr = (delay: number) =>
    spring({
      frame: Math.max(0, frame - delay),
      fps,
      config: { damping: 14, stiffness: 100 },
    });

  // The rail wipes down from the top — the opening gesture.
  const railWipe = spr(0);
  const titleP = spr(8);
  const taglineP = spr(14);
  const mediaP = spr(20);

  // With no image card anchored bottom-right, the right field is mostly empty, so
  // the rail carries more of the composition and widens to keep the frame balanced.
  const railW = hasMedia ? (p ? 78 : 104) : p ? 116 : 168;

  return (
    <div
      style={{
        position: "relative",
        width: "90%",
        height: "80%",
        margin: "auto",
        fontFamily: sansFontFamily,
      }}
    >
      {/* ── Accent rail ── */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: railW,
          height: "100%",
          backgroundColor: accent,
          borderRadius: 24,
          transform: `scaleY(${interpolate(railWipe, [0, 1], [0, 1])})`,
          transformOrigin: "top center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          padding: `${p ? 22 : 30}px 0`,
          boxShadow: "0 8px 32px rgba(249,115,22,0.28)",
        }}
      >
        {/* Index rule — a short white tick at the head of the rail. */}
        <div
          style={{
            width: 2,
            height: p ? 46 : 64,
            background: "rgba(255,255,255,0.85)",
            opacity: interpolate(railWipe, [0.5, 1], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        />
        {/* Category, running up the rail. */}
        <div
          style={{
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            fontSize: categoryFontSize ?? (hasMedia ? (p ? 14 : 18) : p ? 18 : 24),
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.28em",
            color: COLORS.WHITE,
            whiteSpace: "nowrap",
            opacity: interpolate(railWipe, [0.6, 1], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          {categoryTag}
        </div>
        <div
          style={{
            width: 2,
            height: p ? 46 : 64,
            background: "rgba(255,255,255,0.85)",
            opacity: interpolate(railWipe, [0.5, 1], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        />
      </div>

      {/* ── Open right field ──
          With media the copy is pinned to the TOP and the image occupies the
          bottom, so the two never share a band. With no media there is nothing to
          make room for, so the copy centres in the field instead. */}
      <div
        style={{
          position: "absolute",
          left: railW + (p ? 26 : 40),
          right: 0,
          top: 0,
          // Reserve the image's band so long copy cannot run underneath it.
          bottom: hasMedia ? (p ? "58%" : "66%") : 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: hasMedia ? "flex-start" : "center",
        }}
      >
        {/* Title — on the page ground, not in a card. */}
        <div
          style={{
            fontSize: titleFontSize ?? (p ? 88 : 85),
            fontWeight: 700,
            lineHeight: 1.06,
            fontFamily: titleFontFamily,
            color: ink,
            wordBreak: "break-word",
            minWidth: 0,
            opacity: interpolate(titleP, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(titleP, [0, 1], [26, 0])}px)`,
          }}
        >
          {title || "Gridcraft"}
        </div>

        {tagline ? (
          <div
            style={{
              marginTop: p ? 18 : 22,
              // The image now sits BELOW rather than beside the copy, so the
              // tagline no longer has to squeeze into the left half.
              maxWidth: p ? "94%" : "88%",
              fontSize: descriptionFontSize ?? (p ? 41 : 37),
              fontWeight: 500,
              lineHeight: 1.4,
              color: COLORS.MUTED,
              wordBreak: "break-word",
              opacity: interpolate(taglineP, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(taglineP, [0, 1], [18, 0])}px)`,
            }}
          >
            {tagline}
          </div>
        ) : null}
      </div>

      {/* ── Image card, along the bottom of the right field ──
          Spans the full field (not a 46% corner card) so it reads as the lower
          band of the composition, with the title sitting clear above it. */}
      {hasMedia ? (
        <div
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            left: railW + (p ? 26 : 40),
            height: p ? "56%" : "62%",
            ...glass(false),
            padding: 0,
            overflow: "hidden",
            opacity: interpolate(mediaP, [0, 1], [0, 1]),
            transform: `scale(${interpolate(mediaP, [0, 1], [0.92, 1])})`,
          }}
        >
          <ZoomCropImg
            src={imageUrl}
            videoUrl={videoUrl}
            videoMuted={videoMuted}
            videoVolume={videoVolume}
            videoDurationInFrames={videoDurationInFrames}
            videoStartInFrames={videoStartInFrames}
            imageObjectPosition={imageObjectPosition}
            imageZoom={imageZoom}
          />
        </div>
      ) : null}
    </div>
  );
};
