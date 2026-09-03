import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { NewscastLayoutProps } from "./types";
import { ZoomCropImg } from "../components/ZoomCropImg";
import { ZoomCropVideo } from "../components/ZoomCropVideo";
import { useFitText } from "../components/useFitText";
import {
  DEFAULT_NEWSCAST_ACCENT,
  DEFAULT_NEWSCAST_TEXT,
  getNewscastPortraitTypeScale,
  newscastFont,
  scaleNewscastPx,
  toRgba,
} from "../themeUtils";
import { HEADLINE_WEIGHT, headlineTextShadowFor } from "../newscastLayoutMotion";

/**
 * GlassNarrativeV2 — "Studio Desk"
 *
 * Variant of `anchor_narrative`. Same props, different composition.
 *
 * Base puts a 62% glass panel next to a 28% bulletin rail, with the image inset
 * at 40% inside the panel. This one inverts that: the visual goes FULL-BLEED
 * behind everything and the copy drops into a wide lower-third band, which is
 * how an actual anchor read is framed.
 *
 * The bulletin rail is dropped. Its content is redistributed rather than lost —
 * `lowerThirdTag/Headline/Sub` become a compact on-air slate top-right, and
 * `tickerItems` become a static bulletin strip at the band's foot.
 *
 * Two constraints this layout must respect, both from the composition rather
 * than the design: it stays TRANSPARENT behind the plate so the shared pixel-map
 * background shows through, and it keeps clear of the bottom ~150px where
 * NewsCastChrome draws its own lower-third and ticker.
 */

const GOLD = "#D4AA50";

export const GlassNarrativeV2: React.FC<NewscastLayoutProps> = ({
  title,
  narration,
  category,
  imageUrl,
  imageObjectPosition,
  imageZoom,
  videoUrl,
  videoMuted,
  videoVolume,
  videoDurationInFrames,
  videoStartInFrames,
  tickerItems,
  lowerThirdTag,
  lowerThirdHeadline,
  lowerThirdSub,
  accentColor,
  textColor,
  titleFontSize,
  descriptionFontSize,
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const portraitScale = getNewscastPortraitTypeScale(width, height);
  const p = height > width;

  const RED = accentColor || DEFAULT_NEWSCAST_ACCENT;
  const STEEL = textColor || DEFAULT_NEWSCAST_TEXT;
  const shadows = headlineTextShadowFor(RED);

  const hasVisual = Boolean(imageUrl?.trim() || videoUrl?.trim());
  const cat = category ?? "WORLD AFFAIRS";
  const safeTicker = (tickerItems?.filter(Boolean) ?? []).slice(0, 6);

  const plateIn = interpolate(frame, [0, 24], [0, 1], { extrapolateRight: "clamp" });
  // Slow push on the plate so a still image still has life behind the band.
  const plateScale = interpolate(frame, [0, 200], [1.06, 1.0], { extrapolateRight: "clamp" });

  // Band slides up from the bottom edge — the lower-third gesture.
  const bandIn = interpolate(frame, [6, 28], [0, 1], { extrapolateRight: "clamp" });
  const flagIn = interpolate(frame, [14, 30], [0, 1], { extrapolateRight: "clamp" });
  const titleIn = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: "clamp" });
  const bodyIn = interpolate(frame, [30, 54], [0, 1], { extrapolateRight: "clamp" });
  const slateIn = interpolate(frame, [12, 32], [0, 1], { extrapolateRight: "clamp" });

  // The composition renders NewsCastChrome (lower-third + ticker) over every
  // non-hero layout, occupying roughly the bottom 150px. The band is lifted clear
  // of it so the narration is never covered — the same reserved zone the base
  // layouts respect via their percentage padding.
  const CHROME_RESERVE = p ? 168 : 150;
  const BAND_H_PCT = p ? 44 : 40;
  const BAND_H = `${BAND_H_PCT}%`;

  // The plate must occupy exactly the strip the viewer can SEE — from the top of
  // the frame down to the top of the copy band. It used to be `inset: 0`, i.e.
  // the whole canvas, so ZoomCropImg cropped the image to the canvas aspect while
  // the adjust modal previewed the (correct) visible-strip aspect. The two
  // disagreed, and framing chosen in the modal did not match the render. Keep
  // this in sync with LAYOUT_IMAGE_BOX_DIMS.anchor_narrative__v2.
  const PLATE_BOTTOM = `calc(${CHROME_RESERVE}px + ${BAND_H})`;

  // `tickerItems` render as a real flex sibling of the copy area (flexShrink:0)
  // inside the band, so when present it genuinely claims space the copy area
  // doesn't have. Its own layout is fixed regardless of content — one line at
  // fontSize 12 (~15px line height at the default ~1.2 line-height) plus its
  // own bottom padding (16/18px) — so its real height is a stable constant,
  // computed from those same values rather than an unconditional flat guess.
  const hasTicker = (tickerItems?.filter(Boolean) ?? []).length > 0;
  const tickerLineHeightPx = Math.ceil(scaleNewscastPx(12, portraitScale) * 1.2);
  const tickerBottomPadPx = p ? 16 : 18;
  const tickerStripPx = hasTicker ? tickerLineHeightPx + tickerBottomPadPx : 0;

  /* ── Auto-fit ──────────────────────────────────────────────
     Title and narration are unbounded user input inside the lower-third
     band's copy area (flex:1, minHeight:0) — a genuinely fixed-height
     container (the band is BAND_H_PCT of the frame); long copy would push
     past the band's bottom edge or the ticker strip below it. Reserve room
     for the category flag + rule (and the ticker strip, if one renders)
     before splitting the rest between title and narration.

     Title and narration each fit against their own fixed, independent
     budget. No give-back cross-talk: a useLayoutEffect+setState chain
     reacting to another useFitText's overflow output creates a multi-render
     convergence that Remotion's per-frame headless capture can settle at
     different points on different frames (confirmed via a real render —
     frame-to-frame scene-change score hit 1.0, i.e. maximum, twice in the
     first ten frames, in the equivalent newscast opening scene). */
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const narrationRef = React.useRef<HTMLDivElement>(null);
  const titleTargetPx = titleFontSize ?? (p ? 64 : 57);
  const narrationTargetPx = descriptionFontSize ?? (p ? 30 : 22);
  const bandBudgetPx = Math.round(height * (BAND_H_PCT / 100));
  const copyBudgetPx = Math.max(1, bandBudgetPx - (p ? 60 : 66) - tickerStripPx);
  const titleBudgetPx = Math.round(copyBudgetPx * (narration ? 0.55 : 1));

  const { px: titlePx } = useFitText(
    titleRef,
    titleTargetPx,
    titleFontSizeIsUserSet ? titleTargetPx : Math.round(titleTargetPx * 0.42),
    [title, titleTargetPx, titleFontSizeIsUserSet, titleBudgetPx],
    titleBudgetPx,
  );
  const narrationBudgetPx = Math.max(1, copyBudgetPx - titleBudgetPx);
  const { px: narrationPx } = useFitText(
    narrationRef,
    narrationTargetPx,
    descriptionFontSizeIsUserSet ? narrationTargetPx : Math.round(narrationTargetPx * 0.55),
    [narration, narrationTargetPx, descriptionFontSizeIsUserSet, narrationBudgetPx, titlePx],
    narrationBudgetPx,
  );

  return (
    <AbsoluteFill style={{ zIndex: 60, overflow: "hidden" }}>
      {/* ── Plate: the visible image strip above the copy band ── */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: PLATE_BOTTOM, overflow: "hidden", opacity: plateIn }}>
        {hasVisual ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: `scale(${plateScale})`,
              transformOrigin: "center center",
            }}
          >
            {videoUrl ? (
              <ZoomCropVideo
                src={videoUrl}
                imageObjectPosition={imageObjectPosition}
                imageZoom={imageZoom}
                muted={videoMuted ?? true}
                volume={videoVolume ?? 0.35}
                durationInFrames={videoDurationInFrames}
                startInFrames={videoStartInFrames}
              />
            ) : (
              <ZoomCropImg
                src={imageUrl!}
                imageObjectPosition={imageObjectPosition}
                imageZoom={imageZoom}
                alt=""
              />
            )}
          </div>
        ) : (
          // No image: stay TRANSPARENT so the composition's shared pixel-map/globe
          // background shows through, exactly as the base layout does. A solid
          // plate here would hide the map on every image-less scene.
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse at 30% 25%, rgba(30,95,212,0.18) 0%, transparent 60%)",
            }}
          />
        )}
        {/* Bottom-weighted navy grade so the band always has contrast under it.
            Kept lighter at the top so the map stays readable above the band. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: hasVisual
              ? "linear-gradient(180deg, rgba(4,8,22,0.55) 0%, rgba(4,8,22,0.15) 30%, rgba(6,14,38,0.82) 62%, rgba(4,8,22,0.96) 100%)"
              : "linear-gradient(180deg, rgba(4,8,22,0.25) 0%, rgba(4,8,22,0.08) 30%, rgba(6,14,38,0.65) 62%, rgba(4,8,22,0.88) 100%)",
          }}
        />
      </div>

      {/* ── On-air slate, top-right (absorbs the dropped bulletin rail) ── */}
      <div
        style={{
          position: "absolute",
          top: p ? 26 : 34,
          right: p ? 22 : 34,
          maxWidth: p ? "62%" : 340,
          background: "rgba(6,16,44,0.72)",
          border: "1px solid rgba(200,220,255,0.22)",
          backdropFilter: "blur(8px)",
          borderLeft: `3px solid ${RED}`,
          padding: p ? "10px 14px" : "12px 16px",
          opacity: slateIn,
          transform: `translateX(${(1 - slateIn) * 30}px)`,
          zIndex: 30,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: RED,
              boxShadow: `0 0 10px ${toRgba(RED, 0.8)}`,
              opacity: 0.35 + 0.65 * (0.5 + 0.5 * Math.sin((frame / 26) * Math.PI * 2)),
            }}
          />
          <div
            style={{
              fontFamily: newscastFont(fontFamily, "label"),
              fontSize: scaleNewscastPx(10, portraitScale),
              letterSpacing: 3.5,
              fontWeight: 700,
              color: GOLD,
              textTransform: "uppercase",
            }}
          >
            {lowerThirdTag ?? "LIVE COVERAGE"}
          </div>
        </div>
        <div
          style={{
            fontFamily: newscastFont(fontFamily, "title"),
            fontSize: scaleNewscastPx(17, portraitScale),
            fontWeight: 700,
            color: "white",
            textTransform: "uppercase",
            lineHeight: 1.1,
          }}
        >
          {lowerThirdHeadline ?? "Correspondent Report"}
        </div>
        <div
          style={{
            marginTop: 4,
            fontFamily: newscastFont(fontFamily, "body"),
            fontSize: scaleNewscastPx(12, portraitScale),
            color: STEEL,
            lineHeight: 1.4,
          }}
        >
          {lowerThirdSub ?? "Reporting live from the broadcast desk"}
        </div>
      </div>

      {/* ── Lower-third band ── */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: CHROME_RESERVE,
          height: BAND_H,
          background:
            "linear-gradient(180deg, rgba(8,20,54,0.86) 0%, rgba(6,14,38,0.95) 40%, rgba(4,8,22,0.98) 100%)",
          borderTop: `3px solid ${RED}`,
          backdropFilter: "blur(10px)",
          transform: `translateY(${(1 - bandIn) * 100}%)`,
          opacity: bandIn,
          display: "flex",
          flexDirection: "column",
          zIndex: 25,
        }}
      >
        {/* Gold hairline riding the band's top edge */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            background: `linear-gradient(90deg, ${RED}, ${GOLD} 40%, transparent 85%)`,
          }}
        />

        {/* Copy area */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            padding: p ? "22px 26px 12px" : "26px 54px 14px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Category flag — notched, on the band's leading edge */}
          <div
            style={{
              alignSelf: "flex-start",
              background: RED,
              color: "white",
              fontFamily: newscastFont(fontFamily, "title"),
              fontSize: scaleNewscastPx(12, portraitScale),
              fontWeight: 800,
              letterSpacing: 3,
              textTransform: "uppercase",
              padding: "5px 16px 5px 12px",
              clipPath: "polygon(0 0, 94% 0, 100% 50%, 94% 100%, 0 100%)",
              marginBottom: p ? 12 : 14,
              opacity: flagIn,
              transform: `translateX(${(1 - flagIn) * -28}px)`,
              boxShadow: `0 4px 22px ${toRgba(RED, 0.45)}`,
            }}
          >
            {cat}
          </div>

          <h2
            ref={titleRef}
            style={{
              margin: 0,
              fontFamily: newscastFont(fontFamily, "title"),
              fontSize: titlePx,
              fontWeight: HEADLINE_WEIGHT,
              color: "white",
              textTransform: "uppercase",
              lineHeight: 1.08,
              letterSpacing: 0.5,
              textShadow: shadows.strong,
              opacity: titleIn,
              transform: `translateY(${(1 - titleIn) * 16}px)`,
            }}
          >
            {title}
          </h2>

          {/* Single hairline under the headline */}
          <div
            style={{
              marginTop: p ? 12 : 14,
              marginBottom: p ? 12 : 14,
              height: 1,
              width: `${titleIn * 100}%`,
              maxWidth: p ? "100%" : 720,
              background: `linear-gradient(90deg, ${GOLD} 0%, rgba(200,220,255,0.2) 70%, transparent 100%)`,
            }}
          />

          {narration ? (
            <div
              ref={narrationRef}
              style={{
                fontFamily: newscastFont(fontFamily, "body"),
                fontSize: narrationPx,
                fontWeight: 400,
                color: "rgba(232,238,248,0.95)",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                maxWidth: p ? "100%" : "78%",
                opacity: bodyIn,
                transform: `translateY(${(1 - bodyIn) * 14}px)`,
              }}
            >
              {narration}
            </div>
          ) : null}
        </div>

        {/* `tickerItems` are shown as a STATIC bulletin strip, not a crawl: the
            composition's NewsCastChrome already runs a moving ticker along the
            frame foot, and a second scrolling line reads as a duplicate. */}
        {safeTicker.length > 0 && (
          <div
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: p ? 10 : 18,
              flexWrap: "nowrap",
              overflow: "hidden",
              padding: p ? "0 26px 16px" : "0 54px 18px",
              opacity: bodyIn,
            }}
          >
            {safeTicker.slice(0, p ? 2 : 3).map((txt, i) => (
              <div
                key={`${txt}-${i}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  whiteSpace: "nowrap",
                  minWidth: 0,
                  fontFamily: newscastFont(fontFamily, "body"),
                  fontSize: scaleNewscastPx(12, portraitScale),
                  fontWeight: 500,
                  letterSpacing: 1,
                  color: STEEL,
                  textTransform: "uppercase",
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 999,
                    background: i === 0 ? RED : GOLD,
                    flexShrink: 0,
                  }}
                />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{txt}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
