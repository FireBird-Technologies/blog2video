import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate, Easing } from "remotion";
import { GridcraftLayoutProps } from "../types";
import { GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY } from "../constants";
import { glass, COLORS } from "../utils/styles";
import { ZoomCropImg } from "../components/ZoomCropImg";
import { useFitText } from "../components/useFitText";

// Default features if none provided
const DEFAULT_FEATURES = [
  { icon: "⚡", title: "Fast", description: "Renders in milliseconds" },
  { icon: "🔒", title: "Secure", description: "Transactions are encrypted" },
  { icon: "📈", title: "Scalable", description: "Auto-scales with demand" },
];

/**
 * One feature card. Each row of the bento grid is a fixed CSS-grid track (not
 * a shrinkable flex box), so the card's own clientHeight is just its content
 * height — measuring against itself can't detect overflow. Budget the label
 * and description from fixed fractions of the card's own height (measured via
 * a wrapping ref) instead; the label fits first, the description gets the
 * give-back if it still overflows at its floor.
 */
const FeatureCard: React.FC<{
  icon?: string;
  label: string;
  description?: string;
  isAccent: boolean;
  p: boolean;
  textColor?: string;
  titleFontSize?: number;
  descriptionFontSize?: number;
  titleFontSizeIsUserSet?: boolean;
  descriptionFontSizeIsUserSet?: boolean;
  cellHeightPx: number;
  style: React.CSSProperties;
}> = ({
  icon,
  label,
  description,
  isAccent,
  p,
  textColor,
  titleFontSize,
  descriptionFontSize,
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
  cellHeightPx,
  style,
}) => {
  const labelRef = React.useRef<HTMLDivElement>(null);
  const descRef = React.useRef<HTMLDivElement>(null);
  const actualTitleFontSize = titleFontSize ?? (p ? 34 : 40);
  const actualDescriptionFontSize = descriptionFontSize ?? (p ? 24 : 27);

  // Reserve room for the icon + padding; split the rest between label/desc.
  const usable = Math.max(1, cellHeightPx - (icon ? 60 : 0) - 48);
  const [labelGiveBackPx, setLabelGiveBackPx] = React.useState(0);
  React.useLayoutEffect(() => {
    setLabelGiveBackPx(0);
  }, [label, description, actualTitleFontSize, actualDescriptionFontSize, usable]);

  const labelBudgetPx = Math.max(1, usable * (description ? 0.45 : 1) - labelGiveBackPx);
  const { px: labelPx } = useFitText(
    labelRef,
    actualTitleFontSize,
    titleFontSizeIsUserSet ? actualTitleFontSize : p ? 18 : 20,
    [label, actualTitleFontSize, titleFontSizeIsUserSet, labelBudgetPx],
    labelBudgetPx,
  );

  const descBudgetPx = Math.max(1, usable - labelBudgetPx);
  const { px: descPx, overflowPx: descOverflowPx } = useFitText(
    descRef,
    actualDescriptionFontSize,
    descriptionFontSizeIsUserSet ? actualDescriptionFontSize : p ? 14 : 15,
    [description, actualDescriptionFontSize, descriptionFontSizeIsUserSet, descBudgetPx, labelPx],
    descBudgetPx,
  );

  React.useLayoutEffect(() => {
    if (titleFontSizeIsUserSet || descOverflowPx <= 0) return;
    setLabelGiveBackPx((prev) => Math.min(labelBudgetPx * 0.7, prev + descOverflowPx));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descOverflowPx, titleFontSizeIsUserSet]);

  return (
    <div style={style}>
      {icon && <div style={{ fontSize: 36, marginBottom: 16 }}>{icon}</div>}
      <div
        ref={labelRef}
        style={{
          fontSize: labelPx,
          fontWeight: 700,
          marginBottom: 8,
          color: isAccent ? COLORS.WHITE : (textColor || COLORS.DARK),
          wordBreak: "break-word",
        }}
      >
        {label}
      </div>
      {description && (
        <div
          ref={descRef}
          style={{
            fontSize: descPx,
            lineHeight: 1.4,
            opacity: isAccent ? 0.9 : 0.7,
            color: isAccent ? COLORS.WHITE : COLORS.MUTED,
            wordBreak: "break-word",
          }}
        >
          {description}
        </div>
      )}
    </div>
  );
};

export const BentoFeatures: React.FC<GridcraftLayoutProps> = ({
  features,
  dataPoints,
  highlightIndex = 0,imageUrl,
  imageObjectPosition,
  imageZoom,
  videoUrl,
  videoMuted,
  videoVolume,
  videoDurationInFrames,
  videoStartInFrames,
  textColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps, height: videoHeight } = useVideoConfig();

  // Normalize items from either features or dataPoints
  const items = (features || dataPoints || DEFAULT_FEATURES).map(f => {
      // Need to handle both Feature interface and DataPoint interface
      // Feature: { icon, label, description }
      // DataPoint: { label, value, trend, icon, title, description }
      const anyF = f as any;
      return {
          icon: anyF.icon || anyF.trend, // fallback
          label: anyF.label || anyF.title,
          description: anyF.description
      };
  });

  const p = aspectRatio === "portrait";

  // Adjust grid layout based on portrait mode
  // In portrait, cards should be stacked vertically (single column)
  const gridColumns = p ? "1fr" : (items.length === 4 ? "1fr 1fr" : "1fr 1fr 1fr");
  // In portrait, each item gets its own row with auto height
  const gridRows = p ? `repeat(${items.length}, auto)` : (items.length === 4 ? "1fr 1fr" : "1fr 1fr");

  const hasImage = !!(imageUrl || videoUrl);
  const resolvedFontFamily = fontFamily ?? GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY;

  const imageOpacity = interpolate(frame, [5, 25], [0, 1], { extrapolateRight: "clamp" });
  const imageScale = spring({ frame: Math.max(0, frame - 5), fps, config: { damping: 14 } });

  // Grid rows are `1fr`/`auto` tracks, not a measurable fixed pixel height, so
  // approximate each card's height budget from the containing box (80% of
  // frame height) split across the row count.
  const rowCount = p ? items.length : items.length === 4 ? 2 : 2;
  const availableGridHeight = videoHeight * 0.8;
  const estCellHeightPx = Math.max(1, availableGridHeight / rowCount - 20);

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
        gap: hasImage ? (p ? 24 : 32) : 0, // Gap between image and grid, or 0 if no image
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
          gridTemplateColumns: gridColumns,
          gridTemplateRows: gridRows,
          gap: 20, // Gap between feature cards
          flex: hasImage && !p ? 1 : "none",
          width: hasImage && !p ? "auto" : "100%",
          minWidth: 0,
        }}
      >
      {items.slice(0, 6).map((item, i) => {
        const delay = i * 4; // Stagger for each card
        const animationProgress = spring({
            frame: Math.max(0, frame - delay),
            fps,
            config: { damping: 15, stiffness: 120 },
        });

        let cardScale = 1;
        let cardOpacity = 1;
        let cardTranslateY = 0;

        if (p) { // Portrait mode animation: slide up from slightly below + fade in
            cardOpacity = interpolate(animationProgress, [0, 1], [0, 1]);
            cardTranslateY = interpolate(animationProgress, [0, 1], [40, 0], { // Slide up 40px
                extrapolateLeft: "clamp",
                easing: Easing.out(Easing.ease), // Ease-out motion
            });
        } else { // Landscape mode animation: fade in and scale up from 90%
            cardScale = interpolate(animationProgress, [0, 1], [0.9, 1]); // Scale from 90% to 100%
            cardOpacity = interpolate(animationProgress, [0, 1], [0, 1]); // Fade in
        }

        // Highlight the item based on index
        const isAccent = i === highlightIndex;

        return (
          <FeatureCard
            key={i}
            icon={item.icon}
            label={item.label}
            description={item.description}
            isAccent={isAccent}
            p={p}
            textColor={textColor}
            titleFontSize={titleFontSize}
            descriptionFontSize={descriptionFontSize}
            titleFontSizeIsUserSet={titleFontSizeIsUserSet}
            descriptionFontSizeIsUserSet={descriptionFontSizeIsUserSet}
            cellHeightPx={estCellHeightPx}
            style={{
              ...glass(isAccent),
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: 24,
              // Apply combined transforms and opacity based on mode
              transform: `scale(${cardScale}) translateY(${cardTranslateY}px)`,
              opacity: cardOpacity,
              minWidth: 0,
              overflow: "hidden",
            }}
          />
        );
      })}
      </div>
    </div>
  );
};

