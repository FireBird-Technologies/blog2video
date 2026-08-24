import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { DiagonalShards, FilmGrain, HalftoneField, KineticTicker, StreakField } from "../components/SpotlightArtifacts";
import {
  SPOTLIGHT_BODY_DEFAULT_FONT_FAMILY,
  SPOTLIGHT_DISPLAY_DEFAULT_FONT_FAMILY,
} from "../constants";
import type { SpotlightLayoutProps } from "../types";
import { ZoomCropVideo } from "../components/ZoomCropVideo";
import { useFitText } from "../components/useFitText";

/**
 * One cascading row. A separate component (not inlined in the parent's .map)
 * so each item gets its own useFitText call with its own ref — Rules of Hooks
 * forbid calling a hook a variable number of times inside a loop.
 */
const CascadeItem: React.FC<{
  index: number;
  item: string;
  p: boolean;
  itemBudgetPx: number;
  numberFontSize: number;
  textTargetPx: number;
  accentColor?: string;
  textColor?: string;
  displayFontFamily: string;
  bodyFontFamily: string;
  style: React.CSSProperties;
}> = ({ index, item, p, itemBudgetPx, numberFontSize, textTargetPx, accentColor, textColor, displayFontFamily, bodyFontFamily, style }) => {
  const textRef = React.useRef<HTMLSpanElement>(null);
  const { px: textPx } = useFitText(
    textRef,
    textTargetPx,
    p ? 14 : 18,
    [item, textTargetPx, itemBudgetPx],
    itemBudgetPx,
  );

  return (
    <div style={style}>
      <span
        style={{
          fontSize: numberFontSize,
          fontWeight: 900,
          color: accentColor,
          minWidth: p ? 28 : 44,
          fontFamily: displayFontFamily,
        }}
      >
        {String(index + 1).padStart(2, "0")}
      </span>
      <span
        ref={textRef}
        style={{
          fontSize: textPx,
          fontWeight: 700,
          color: textColor || "#FFFFFF",
          fontFamily: bodyFontFamily,
          letterSpacing: "-0.01em",
          display: "block",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {item}
      </span>
    </div>
  );
};

/**
 * CascadeList — Stacking Items
 *
 * Items appear one at a time, stacking vertically over a background image.
 * Each item is a bold number in accent color + white text.
 * Previous items dim as new ones appear.
 */
export const CascadeList: React.FC<SpotlightLayoutProps> = ({
  title,
  items,imageUrl,
  imageObjectPosition,
  imageZoom,
  videoUrl,
  videoMuted,
  videoVolume,
  videoDurationInFrames,
  videoStartInFrames,
  accentColor,
  textColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const fps = 30;
  const p = aspectRatio === "portrait";
  const displayFontFamily =
    fontFamily ?? SPOTLIGHT_DISPLAY_DEFAULT_FONT_FAMILY;
  const bodyFontFamily = fontFamily ?? SPOTLIGHT_BODY_DEFAULT_FONT_FAMILY;

  const displayItems = items || [title];
  const framesPerItem = 18;
  const numberFontSize = titleFontSize ?? (p ? 22 : 34);
  const textTargetPx = descriptionFontSize ?? (p ? 24 : 36);
  /* ── Auto-fit ──────────────────────────────────────────────
     Each item shares an equal slice of the stack's ~78%-of-frame vertical
     budget; a long item would otherwise wrap onto extra lines and push later
     items (or itself) out of the visible stage. Fit per-item since lengths
     vary independently. */
  const stackBudgetPx = Math.round(height * 0.78);
  const itemBudgetPx = Math.max(1, Math.round(stackBudgetPx / displayItems.length) - (p ? 12 : 20));
  const currentIdx = Math.min(
    Math.floor(frame / framesPerItem),
    displayItems.length - 1
  );

  const bgOpacity = interpolate(frame, [0, 20], [0, 1]);
  const bgScale = spring({
    frame,
    fps,
    config: { damping: 200 },
    from: 1.1,
    to: 1,
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill>
        {videoUrl ? (
          <div style={{ position: "absolute", inset: 0, opacity: bgOpacity, transform: `scale(${bgScale})` }}>
            <ZoomCropVideo
              src={videoUrl}
              imageObjectPosition={imageObjectPosition}
              imageZoom={imageZoom}
              muted={videoMuted ?? true}
              volume={videoVolume ?? 0.35}
              durationInFrames={videoDurationInFrames}
              startInFrames={videoStartInFrames}
            />
          </div>
        ) : imageUrl ? (
          <Img
            src={imageUrl}
            style={{
              width: "100%",
              height: "100%",
              objectFit: (imageZoom ?? 1) < 1 ? "contain" : "cover",
              objectPosition: (imageZoom ?? 1) < 1 ? "center" : (imageObjectPosition ?? "50% 50%"),
              opacity: bgOpacity,
              transform: `scale(${(imageZoom ?? 1) * bgScale})`,
              transformOrigin: (imageZoom ?? 1) < 1 ? "center center" : (imageObjectPosition ?? "50% 50%"),
            }}
          />
        ) : (
          <AbsoluteFill style={{ backgroundColor: "#111111" }} />
        )}
        <AbsoluteFill style={{ backgroundColor: "rgba(0, 0, 0, 0.45)" }} />
      </AbsoluteFill>

      {/* Decorative artifacts — red shards, drifting streaks, marquee strip below the list. */}
      <DiagonalShards accentColor={accentColor} corner="top-right" startFrame={3} />
      {!imageUrl && !videoUrl && <StreakField accentColor={accentColor} count={10} seed={13} startFrame={4} />}
      {!imageUrl && !videoUrl && <HalftoneField accentColor={accentColor} corner="bottom-left" />}
      <FilmGrain />
      {/* Marquee echoes the scene's own headline. */}
      <KineticTicker
        accentColor={accentColor}
        edge="bottom"
        label={(title || "THE LIST").slice(0, 48)}
        speed={0.9}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "8%",
        }}
      >
        <div
          style={{
            width: "90%",
            maxWidth: 1000,
            display: "flex",
            flexDirection: "column",
            gap: p ? 12 : 20,
          }}
        >
          {displayItems.map((item, i) => {
            const itemSpring = spring({
              frame: frame - i * framesPerItem - 5,
              fps,
              config: { damping: 18, stiffness: 180, mass: 1 },
            });

            const shown = frame >= i * framesPerItem + 5;
            const dimmed = shown && i < currentIdx;

            return (
              <CascadeItem
                key={i}
                index={i}
                item={item}
                p={p}
                itemBudgetPx={itemBudgetPx}
                numberFontSize={numberFontSize}
                textTargetPx={textTargetPx}
                accentColor={accentColor}
                textColor={textColor}
                displayFontFamily={displayFontFamily}
                bodyFontFamily={bodyFontFamily}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: p ? 12 : 24,
                  transform: shown
                    ? `translateX(${(1 - itemSpring) * 80}px)`
                    : "translateX(80px)",
                  opacity: shown ? (dimmed ? 0.4 : itemSpring) : 0,
                }}
              />
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

