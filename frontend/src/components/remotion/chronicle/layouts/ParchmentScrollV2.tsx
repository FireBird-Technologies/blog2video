import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { ChronicleLayoutProps } from "../types";
import {
  CHRONICLE_BODY_FONT,
  CHRONICLE_HEADING_FONT,
  CHRONICLE_SMALLCAPS_FONT,
} from "../../../../fonts/chronicle-defaults";
import { IlluminatedDropCap } from "../components/IlluminatedDropCap";
import { OrnamentalCorner, OrnamentalBorder } from "../components/OrnamentalBorder";
import { EmbossedImage } from "../components/EmbossedImage";
import { QuillText } from "../components/QuillInk";
import { useFitText, useAvailableHeight } from "../components/useFitText";
import { chronicleHeroHeadingStyle, chronicleHeroHeadingTypography } from "../components/ChronicleHeading";

/**
 * parchment_scroll__v2 — "Facing Folio".
 *
 * Same props as ParchmentScroll. Reframes the body as an open double-page
 * spread in landscape: a left page carries the title/drop-cap/narration (flowed through a
 * real 2-column layout when there's no image, the way newspaper's
 * article_lead__v2 sets its body — including the same hidden single-column
 * measurement mirror so useFitText reads true content height through the
 * column clip). The right page carries a full-bleed EmbossedImage when
 * present, or a decorative ornamental panel when it isn't, so the spread
 * never looks unfinished. A reserved center gutter keeps both leaves clear of
 * the binding without drawing a second artificial spine over the page chrome.
 * Portrait becomes one clean leaf: full-width text above, compass/media below.
 */
export const ParchmentScrollV2: React.FC<ChronicleLayoutProps> = ({
  title = "The Story Unfolds",
  narration = "And so it was, that events took their course — shaped not by chance, but by choice.",
  accentColor = "#B8860B",
  textColor = "#2A1810",
  aspectRatio = "landscape",
  titleFontSize,
  descriptionFontSize,
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
  fontFamily,
  imageUrl,
  imageObjectPosition,
  imageZoom,
  videoUrl,
  videoMuted,
  videoVolume,
  videoDurationInFrames,
  videoStartInFrames,
  illuminatedLetter,
  category,
  stats,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, height, width } = useVideoConfig();
  const p = aspectRatio === "portrait" || height > width;

  const titleOp = interpolate(frame, [15, 35], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const bylineOp = interpolate(frame, [40, 55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const firstLetterIndex = narration.search(/[A-Za-z]/);
  const automaticDropCap = firstLetterIndex >= 0 ? narration[firstLetterIndex] : "A";
  // Schema defaults use an empty string for "auto". Treat it as absent and
  // only accept the first character of a custom override.
  const dropCapChar = (illuminatedLetter?.trim().charAt(0) || automaticDropCap).toUpperCase();
  const bodyRest = firstLetterIndex >= 0
    ? `${narration.slice(0, firstLetterIndex)}${narration.slice(firstLetterIndex + 1)}`.trimStart()
    : narration;
  const hasVisual = Boolean(imageUrl || videoUrl);
  // The spine is a structural no-content zone, not merely a painted shadow.
  // Each leaf also keeps an inner margin before the crease, like a bound book.
  const spineWidth = 64;
  const innerPageMargin = 40;

  // Only a wide landscape frame has room for real 2-column text flow (mirrors
  // article_lead__v2); portrait's narrower left page always stays single-column.
  // Portrait is a single-page vertical reading order: text, then visual.
  const columnCount = !p && !hasVisual ? 2 : 1;

  const fitTitleRef = React.useRef<HTMLDivElement>(null);
  const fitTitleTarget = titleFontSize ?? (p ? 81 : 80);
  const { px: fitTitlePx } = useFitText(
    fitTitleRef,
    fitTitleTarget,
    titleFontSizeIsUserSet ? fitTitleTarget : Math.round(fitTitleTarget * 0.45),
    [title, fitTitleTarget, titleFontSizeIsUserSet, p, height],
    Math.round(height * 0.1),
  );

  /* ── Auto-fit (body) ─────────────────────────────────────────
     Same measurement-mirror pattern as newspaper's ArticleLeadV2: the visible
     column box clips overflow into a phantom Nth column instead of growing, so
     its own scrollHeight can't report true overflow. A hidden SINGLE-COLUMN
     mirror of the full body — at the width one real column has — is measured
     instead, against a budget of columnCount * (page's real available height). */
  const pageBodyRef = React.useRef<HTMLDivElement>(null);
  const columnBoxRef = React.useRef<HTMLDivElement>(null);
  const mirrorRef = React.useRef<HTMLDivElement>(null);

  const perColumnBudgetPx = useAvailableHeight(columnBoxRef, pageBodyRef, [
    title, fitTitlePx, hasVisual, narration, descriptionFontSize, p,
  ]);
  const columnFitBudgetPx = Math.max(1, perColumnBudgetPx * columnCount);

  const [columnWidthPx, setColumnWidthPx] = React.useState(0);
  React.useLayoutEffect(() => {
    const box = columnBoxRef.current;
    if (!box) return;
    const boxWidth = box.clientWidth;
    const next = Math.max(1, Math.round((boxWidth - 36 * (columnCount - 1)) / columnCount));
    setColumnWidthPx((prev) => (Math.abs(prev - next) <= 1 ? prev : next));
  }, [columnCount, p, hasVisual, title, fitTitlePx]);

  const fitBodyTarget = descriptionFontSize ?? (p ? 62 : 51);
  const { px: fitBodyPx } = useFitText(
    mirrorRef,
    fitBodyTarget,
    descriptionFontSizeIsUserSet ? fitBodyTarget : Math.round(fitBodyTarget * 0.55),
    [bodyRest, fitBodyTarget, descriptionFontSizeIsUserSet, columnFitBudgetPx, columnWidthPx, columnCount, p],
    columnFitBudgetPx,
  );

  const fadeOut = interpolate(
    frame,
    [durationInFrames - 20, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" },
  );

  const bylineText = stats && stats.length > 0
    ? stats.map((s) => [s.value, s.label].filter(Boolean).join(" ")).join("  •  ")
    : null;

  return (
    <AbsoluteFill
      style={{
        opacity: fadeOut,
        fontFamily: fontFamily ?? CHRONICLE_BODY_FONT,
        padding: p ? "7% 7%" : "6% 6%",
        overflow: "hidden",
      }}
    >
      <OrnamentalCorner position="top-left" size={p ? 100 : 120} color={accentColor} startFrame={0} variant="vine" />
      <OrnamentalCorner position="bottom-right" size={p ? 100 : 120} color={accentColor} startFrame={15} variant="vine" />

      {/* Landscape is a facing folio. Portrait is one crease-free page with
          the text block above the compass/media. */}
      <div
        style={{
          display: "flex",
          flexDirection: p ? "column" : "row",
          gap: p ? 28 : 0,
          height: "100%",
          position: "relative",
          minWidth: 0,
        }}
      >
        {/* Left page */}
        <div
          ref={pageBodyRef}
          style={{
            flex: p ? "0 0 54%" : "1 1 0",
            height: p ? "54%" : "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            paddingRight: p ? 0 : innerPageMargin,
            paddingBottom: p ? 8 : 0,
            minHeight: 0,
            minWidth: 0,
            overflow: "hidden",
            boxSizing: "border-box",
          }}
        >
          {category && (
            <div
              style={{
                marginBottom: p ? 16 : 20,
                fontFamily: CHRONICLE_SMALLCAPS_FONT,
                fontSize: p ? 20 : 18,
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                color: accentColor,
                fontWeight: 700,
                opacity: titleOp,
                textAlign: "center",
                overflowWrap: "anywhere",
                flexShrink: 0,
              }}
            >
              {category}
            </div>
          )}

          {/* Title */}
          <div style={{ position: "relative", marginBottom: 24, flexShrink: 0 }}>
            <div
              ref={fitTitleRef}
              aria-hidden
              style={{
                visibility: "hidden",
                position: "absolute",
                inset: 0,
                ...chronicleHeroHeadingTypography(fontFamily),
                fontSize: fitTitlePx,
                overflowWrap: "anywhere",
                width: "100%",
              }}
            >
              {title}
            </div>
            <div
              style={{
                ...chronicleHeroHeadingStyle(accentColor, fontFamily),
                fontSize: fitTitlePx,
                overflowWrap: "anywhere",
                opacity: titleOp,
              }}
            >
              <QuillText text={title} startFrame={12} durationFrames={28} mode="char" showCursor={false} />
            </div>
          </div>

          {/* Divider */}
          <div
            style={{
              height: 1.5,
              background: textColor,
              width: `${interpolate(frame, [20, 38], [0, 55], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}%`,
              marginBottom: 26,
              opacity: 0.6,
              flexShrink: 0,
            }}
          />

          {/* Body with drop cap — 2 columns when eligible */}
          <div
            style={{
              display: "flex",
              alignItems: p ? "center" : "flex-start",
              gap: 20,
              flex: 1,
              minHeight: 0,
            }}
          >
            <div
              style={{
                flexShrink: 0,
                opacity: interpolate(frame, [30, 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              }}
            >
              <IlluminatedDropCap letter={dropCapChar} size={p ? 76 : 100} accentColor={accentColor} textColor={textColor} startFrame={30} />
            </div>
            <div style={{ flex: 1, minWidth: 0, minHeight: 0, height: "100%", position: "relative" }}>
              {/* Hidden single-column measurement mirror of the FULL body, at one
                  real column's width — see useFitText's own doc comment on why a
                  clipped multi-column box can't measure its own overflow. */}
              <div
                ref={mirrorRef}
                aria-hidden
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: columnWidthPx || "100%",
                  visibility: "hidden",
                  pointerEvents: "none",
                  fontFamily: fontFamily ?? CHRONICLE_BODY_FONT,
                  fontSize: fitBodyPx,
                  lineHeight: 1.55,
                }}
              >
                {bodyRest}
              </div>
              <div
                ref={columnBoxRef}
                style={{
                  width: "100%",
                  height: "100%",
                  minHeight: 0,
                  overflow: "hidden",
                  columnCount,
                  columnGap: 36,
                  columnFill: "auto",
                  columnRule: columnCount > 1 ? `1px solid ${accentColor}66` : undefined,
                  display: p ? "flex" : undefined,
                  flexDirection: p ? "column" : undefined,
                  justifyContent: p ? "center" : undefined,
                  fontFamily: fontFamily ?? CHRONICLE_BODY_FONT,
                  fontSize: fitBodyPx,
                  color: textColor,
                  lineHeight: 1.55,
                }}
              >
                <QuillText text={bodyRest} startFrame={50} durationFrames={Math.min(150, bodyRest.length * 1.1)} showCursor={true} />
              </div>
            </div>
          </div>

          {bylineText && (
            <div
              style={{
                marginTop: 20,
                fontFamily: CHRONICLE_SMALLCAPS_FONT,
                fontSize: p ? 20 : 18,
                color: textColor,
                opacity: bylineOp * 0.75,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                fontStyle: "italic",
                flexShrink: 0,
              }}
            >
              &mdash; {bylineText}
            </div>
          )}
        </div>

        {/* Landscape-only binding gutter. Portrait has no crease at all. */}
        {!p && <div
          style={{
            width: spineWidth,
            flexShrink: 0,
            pointerEvents: "none",
          }}
        />}

        {/* Right page */}
        <div
          style={{
            flex: "1 1 0",
            height: p ? "auto" : "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingLeft: p ? 0 : innerPageMargin,
            minWidth: 0,
            overflow: "hidden",
            boxSizing: "border-box",
          }}
        >
          {hasVisual ? (
            <EmbossedImage
              src={imageUrl}
              videoUrl={videoUrl}
              videoMuted={videoMuted}
              videoVolume={videoVolume}
              videoDurationInFrames={videoDurationInFrames}
              videoStartInFrames={videoStartInFrames}
              objectPosition={imageObjectPosition}
              zoom={imageZoom}
              rotate={0}
              revealStart={20}
              matSize={0}
              inkFrame={false}
              style={{
                width: "100%",
                height: "100%",
                boxShadow: "inset 0 0 0 1px rgba(40,25,12,0.2)",
              }}
            />
          ) : (
            <IlluminatedStoryCompass
              accentColor={accentColor}
              textColor={textColor}
              portrait={p}
            />
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/**
 * IlluminatedStoryCompass — a living marginalia plate for image-less scenes.
 * Quill-drawn astrolabe rings and slow gilded orbiters turn the facing page
 * into a story-navigation artifact rather than a generic placeholder. Exported
 * so other chronicle layouts (e.g. IlluminatedQuoteV2) can share the same
 * marginalia device instead of the plain CompassRose.
 */
export const IlluminatedStoryCompass: React.FC<{
  accentColor: string;
  textColor: string;
  portrait: boolean;
}> = ({ accentColor, textColor, portrait: p }) => {
  const frame = useCurrentFrame();

  const frameOp = interpolate(frame, [8, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const inkDraw = interpolate(frame, [16, 66], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ringSettle = interpolate(frame, [12, 78], [-16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Keep the engraved compass moving counterclockwise for the full scene;
  // frame-based motion remains deterministic in previews and final renders.
  const ringRotation = ringSettle - frame * 0.28;
  const orbitRotation = interpolate(frame, [0, 170], [0, 32], {
    extrapolateLeft: "extend",
    extrapolateRight: "extend",
  });
  const glow = 0.45 + Math.sin(frame / 17) * 0.18;

  const [containerWidth, setContainerWidth] = React.useState(p ? 330 : 520);
  const containerRef = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const next = Math.max(1, el.clientWidth);
    setContainerWidth((prev) => (Math.abs(prev - next) <= 1 ? prev : next));
  }, [p]);
  const size = Math.min(p ? 330 : 520, containerWidth * 0.78);
  const dashOffset = 1400 * (1 - inkDraw);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "88%",
        height: "88%",
        opacity: frameOp,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <OrnamentalBorder color={accentColor} size={p ? 76 : 112} startFrame={8} variant="celtic" />
      <div
        style={{
          position: "absolute",
          inset: p ? "12%" : "10%",
          border: `1px solid ${accentColor}55`,
          boxShadow: `inset 0 0 34px ${accentColor}12, 0 0 0 5px rgba(42,24,16,0.025)`,
        }}
      />

      <div
        style={{
          position: "relative",
          width: size,
          height: size,
          filter: `drop-shadow(0 2px 2px rgba(42,24,16,0.16)) drop-shadow(0 0 10px ${accentColor}22)`,
        }}
      >
        {/* The parchment underneath catches a faint circular gold bloom. */}
        <div
          style={{
            position: "absolute",
            inset: "8%",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${accentColor}18 0%, ${accentColor}08 38%, transparent 70%)`,
            opacity: glow,
          }}
        />

        <svg
          viewBox="0 0 400 400"
          width={size}
          height={size}
          style={{ position: "absolute", inset: 0, overflow: "visible" }}
        >
          <g
            fill="none"
            stroke={textColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="1400"
            strokeDashoffset={dashOffset}
            transform={`rotate(${ringRotation} 200 200)`}
          >
            <circle cx="200" cy="200" r="176" strokeWidth="1.2" opacity="0.42" />
            <circle cx="200" cy="200" r="160" stroke={accentColor} strokeWidth="2" opacity="0.82" />
            <circle cx="200" cy="200" r="128" strokeWidth="1" opacity="0.38" />
            <circle cx="200" cy="200" r="82" stroke={accentColor} strokeWidth="1.6" opacity="0.72" />
            <path d="M200 24 L207 181 L200 200 L193 181 Z" fill={accentColor} fillOpacity={inkDraw * 0.72} />
            <path d="M376 200 L219 207 L200 200 L219 193 Z" fill={textColor} fillOpacity={inkDraw * 0.34} />
            <path d="M200 376 L193 219 L200 200 L207 219 Z" fill={accentColor} fillOpacity={inkDraw * 0.48} />
            <path d="M24 200 L181 193 L200 200 L181 207 Z" fill={textColor} fillOpacity={inkDraw * 0.34} />
            <path d="M76 76 L184 184 M324 76 L216 184 M324 324 L216 216 M76 324 L184 216" strokeWidth="0.8" opacity="0.3" />
            <path d="M200 40 C218 60 218 78 200 92 C182 78 182 60 200 40 Z" stroke={accentColor} />
            <path d="M360 200 C340 218 322 218 308 200 C322 182 340 182 360 200 Z" stroke={accentColor} />
            <path d="M200 360 C182 340 182 322 200 308 C218 322 218 340 200 360 Z" stroke={accentColor} />
            <path d="M40 200 C60 182 78 182 92 200 C78 218 60 218 40 200 Z" stroke={accentColor} />
          </g>

          {/* Small engraved ticks make the plate read as an old instrument. */}
          <g stroke={textColor} strokeWidth="1" opacity={inkDraw * 0.36}>
            {Array.from({ length: 24 }, (_, i) => (
              <line key={i} x1="200" y1="25" x2="200" y2={i % 3 === 0 ? 37 : 32} transform={`rotate(${i * 15} 200 200)`} />
            ))}
          </g>
          <g fill={accentColor} opacity={inkDraw * 0.9} fontFamily={CHRONICLE_HEADING_FONT} fontSize="19" textAnchor="middle">
            <text x="200" y="18">✦</text>
            <text x="390" y="207">☾</text>
            <text x="200" y="397">❖</text>
            <text x="10" y="207">✶</text>
          </g>
        </svg>

        {/* Two gilded points continue tracing the chronicle after the ink settles. */}
        {[0, 180].map((offset) => (
          <div
            key={offset}
            style={{
              position: "absolute",
              inset: "7%",
              borderRadius: "50%",
              transform: `rotate(${orbitRotation + offset}deg)`,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: -3,
                width: 7,
                height: 7,
                marginLeft: -3.5,
                borderRadius: "50%",
                background: accentColor,
                boxShadow: `0 0 5px ${accentColor}, 0 0 14px ${accentColor}`,
                opacity: inkDraw,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
