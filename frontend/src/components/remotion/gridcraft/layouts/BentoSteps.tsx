import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { GridcraftLayoutProps } from "../types";
import { GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY } from "../constants";
import { glass, COLORS } from "../utils/styles";
import { ZoomCropImg } from "../components/ZoomCropImg";
import { useFitText } from "../components/useFitText";

/**
 * One step tile. Each tile is a `1fr` grid cell (or `auto` in portrait), not a
 * shrinkable measurable box, so the label fits a fixed budget first and the
 * description fits the remainder, with give-back cascading like NewsHeadline.
 */
const StepTile: React.FC<{
  label: string;
  description?: string;
  isLast: boolean;
  p: boolean;
  titleFontSize?: number;
  descriptionFontSize?: number;
  titleFontSizeIsUserSet?: boolean;
  descriptionFontSizeIsUserSet?: boolean;
  index: number;
  budgetPx: number;
  style: React.CSSProperties;
}> = ({
  label,
  description,
  isLast,
  p,
  titleFontSize,
  descriptionFontSize,
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
  index,
  budgetPx,
  style,
}) => {
  const labelRef = React.useRef<HTMLDivElement>(null);
  const descRef = React.useRef<HTMLDivElement>(null);
  const actualTitleFontSize = titleFontSize ?? (p ? 36 : 42);
  const actualDescriptionFontSize = descriptionFontSize ?? (p ? 22 : 22);

  const labelBudgetPx = Math.max(1, budgetPx * (description ? 0.45 : 1));
  const { px: labelPx } = useFitText(
    labelRef,
    actualTitleFontSize,
    titleFontSizeIsUserSet ? actualTitleFontSize : p ? 18 : 20,
    [label, actualTitleFontSize, titleFontSizeIsUserSet, labelBudgetPx],
    labelBudgetPx,
  );
  const descBudgetPx = Math.max(1, budgetPx - labelBudgetPx);
  const { px: descPx } = useFitText(
    descRef,
    actualDescriptionFontSize,
    descriptionFontSizeIsUserSet ? actualDescriptionFontSize : p ? 13 : 14,
    [description, actualDescriptionFontSize, descriptionFontSizeIsUserSet, descBudgetPx, labelPx],
    descBudgetPx,
  );

  return (
    <div style={style}>
      <div style={{ fontSize: p ? 32 : 42, fontWeight: 700, color: isLast ? "rgba(255,255,255,0.4)" : COLORS.ACCENT, opacity: 0.5, marginBottom: 8, lineHeight: 1 }}>
        {String(index + 1).padStart(2, "0")}
      </div>
      <div ref={labelRef} style={{ fontSize: labelPx, fontWeight: 700, marginBottom: 4, color: isLast ? COLORS.WHITE : COLORS.DARK, wordBreak: "break-word" }}>
        {label}
      </div>
      <div ref={descRef} style={{ fontSize: descPx, lineHeight: 1.4, color: isLast ? "rgba(255,255,255,0.8)" : COLORS.MUTED, wordBreak: "break-word" }}>
        {description}
      </div>
    </div>
  );
};

export const BentoSteps: React.FC<GridcraftLayoutProps> = ({
  steps,
  dataPoints,imageUrl,
  imageObjectPosition,
  imageZoom,
  videoUrl,
  videoMuted,
  videoVolume,
  videoDurationInFrames,
  videoStartInFrames,
  accentColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps, height: videoHeight } = useVideoConfig();

  const items = steps || dataPoints || [
      { label: "Step 1", description: "Initialize" },
      { label: "Step 2", description: "Execute" },
      { label: "Step 3", description: "Verify" },
      { label: "Step 4", description: "Deploy" }
  ];

  const hasImage = !!(imageUrl || videoUrl);
  const p = aspectRatio === "portrait";
  const resolvedFontFamily = fontFamily ?? GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY;

  const imageOpacity = interpolate(frame, [5, 25], [0, 1], { extrapolateRight: "clamp" });
  const imageScale = spring({ frame: Math.max(0, frame - 5), fps, config: { damping: 14 } });

  // Grid rows are `1fr`/`auto` tracks, not a measurable fixed pixel height, so
  // approximate each tile's budget from the containing box (80% of frame
  // height) split across the row count.
  const rowCount = p ? items.length : 2;
  const tileBudgetPx = Math.max(1, (videoHeight * 0.8) / rowCount - 48);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: hasImage && !p ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        width: "90%",
        height: "80%",
        margin: "auto",
        gap: hasImage ? (p ? 24 : 32) : 0,
        fontFamily: resolvedFontFamily,
      }}
    >
      {hasImage && (
        <div
          style={{
            flex: p ? "none" : "0 0 38%",
            width: p ? "80%" : "auto",
            height: p ? 220 : 320,
            borderRadius: 12,
            overflow: "hidden",
            opacity: imageOpacity,
            transform: `scale(${imageScale})`,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
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
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: p ? "1fr" : "1fr 1fr 1fr 1fr",
          gridTemplateRows: p ? `repeat(${items.length}, auto)` : "1fr 1fr",
          gap: 16,
          flex: hasImage && !p ? 1 : "none",
          width: hasImage && !p ? "auto" : "100%",
          minWidth: 0,
        }}
      >
      {items.map((item, i) => {
          const delay = i * 5;
          const s = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 14 } });
          
          const scale = interpolate(s, [0, 1], [0.8, 1]);
          const opacity = interpolate(s, [0, 1], [0, 1]);
          
          // Zig-zag layout (landscape); single column (portrait)
          const positions = [
             { gridColumn: "1", gridRow: "1" },
             { gridColumn: "2", gridRow: "2" },
             { gridColumn: "3", gridRow: "1" },
             { gridColumn: "4", gridRow: "2" },
          ];

          const isLast = i === items.length - 1;

          return (
              <StepTile
                key={i}
                label={item.label}
                description={item.description}
                isLast={isLast}
                p={p}
                titleFontSize={titleFontSize}
                descriptionFontSize={descriptionFontSize}
                titleFontSizeIsUserSet={titleFontSizeIsUserSet}
                descriptionFontSizeIsUserSet={descriptionFontSizeIsUserSet}
                index={i}
                budgetPx={tileBudgetPx}
                style={{
                  ...(p
                    ? { gridColumn: "1", gridRow: i + 1 }
                    : positions[i % 4]),
                  ...glass(isLast),
                  backgroundColor: isLast ? (accentColor || COLORS.ACCENT) : undefined,
                  padding: p ? 20 : 24,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  minWidth: 0,
                  overflow: "hidden",
                  transform: `scale(${scale})`,
                  opacity,
                }}
              />
          )
      })}
      </div>
    </div>
  );
};

