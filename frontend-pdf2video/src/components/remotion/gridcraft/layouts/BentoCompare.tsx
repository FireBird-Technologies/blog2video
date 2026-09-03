import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { GridcraftLayoutProps } from "../types";
import { GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY } from "../constants";
import { glass, COLORS } from "../utils/styles";
import { ZoomCropImg } from "../components/ZoomCropImg";
import { useFitText } from "../components/useFitText";

/**
 * One compare column (left/right). The column is a `1fr` grid cell (or `auto`
 * in portrait), not a shrinkable measurable box, so the title fits a fixed
 * budget first and the description fits the remainder, cascading give-back
 * exactly like NewsHeadline.
 */
const CompareColumn: React.FC<{
  label?: string;
  itemTitle?: string;
  description?: string;
  titleFontSize?: number;
  descriptionFontSize?: number;
  titleFontSizeIsUserSet?: boolean;
  descriptionFontSizeIsUserSet?: boolean;
  p: boolean;
  budgetPx: number;
  style: React.CSSProperties;
}> = ({
  label,
  itemTitle,
  description,
  titleFontSize,
  descriptionFontSize,
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
  p,
  budgetPx,
  style,
}) => {
  const titleRef = React.useRef<HTMLDivElement>(null);
  const descRef = React.useRef<HTMLDivElement>(null);
  const actualTitleFontSize = titleFontSize ?? (p ? 44 : 49);
  const actualDescriptionFontSize = descriptionFontSize ?? (p ? 26 : 35);

  const [titleGiveBackPx, setTitleGiveBackPx] = React.useState(0);
  React.useLayoutEffect(() => {
    setTitleGiveBackPx(0);
  }, [itemTitle, description, actualTitleFontSize, actualDescriptionFontSize, budgetPx]);

  const titleBudgetPx = Math.max(1, budgetPx * 0.4 - titleGiveBackPx);
  const { px: titlePx } = useFitText(
    titleRef,
    actualTitleFontSize,
    titleFontSizeIsUserSet ? actualTitleFontSize : p ? 20 : 22,
    [itemTitle, actualTitleFontSize, titleFontSizeIsUserSet, titleBudgetPx],
    titleBudgetPx,
  );
  const descBudgetPx = Math.max(1, budgetPx * 0.6);
  const { px: descPx, overflowPx: descOverflowPx } = useFitText(
    descRef,
    actualDescriptionFontSize,
    descriptionFontSizeIsUserSet ? actualDescriptionFontSize : p ? 14 : 15,
    [description, actualDescriptionFontSize, descriptionFontSizeIsUserSet, descBudgetPx, titlePx],
    descBudgetPx,
  );
  React.useLayoutEffect(() => {
    if (titleFontSizeIsUserSet || descOverflowPx <= 0) return;
    setTitleGiveBackPx((prev) => Math.min(titleBudgetPx * 0.6, prev + descOverflowPx));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descOverflowPx, titleFontSizeIsUserSet]);

  return (
    <div style={style}>
      <div style={{ fontSize: 12, color: COLORS.MUTED, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
        {label}
      </div>
      <div ref={titleRef} style={{ fontSize: titlePx, fontWeight: 700, marginBottom: 12, color: COLORS.DARK, wordBreak: "break-word" }}>
        {itemTitle}
      </div>
      <div ref={descRef} style={{ fontSize: descPx, lineHeight: 1.5, color: COLORS.MUTED, wordBreak: "break-word" }}>
        {description}
      </div>
    </div>
  );
};

/** The verdict bar has no dedicated font-size prop (always 18px); still fit
 * it since `verdict`/`title` text length is unbounded. */
const VerdictBar: React.FC<{ text: string; p: boolean; budgetPx: number; style: React.CSSProperties }> = ({
  text,
  p,
  budgetPx,
  style,
}) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const { px } = useFitText(ref, 18, p ? 12 : 13, [text, budgetPx], budgetPx);
  return (
    <div style={style}>
      <div ref={ref} style={{ fontSize: px, fontWeight: 600, wordBreak: "break-word" }}>{text}</div>
    </div>
  );
};

export const BentoCompare: React.FC<GridcraftLayoutProps> = ({
  dataPoints,
  leftLabel,
  rightLabel,
  leftDescription,
  rightDescription,
  verdict,
  title,imageUrl,
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

  const spr = (d: number) => spring({ frame: Math.max(0, frame - d), fps, config: { damping: 16 } });

  // Construct points from specific props or fallback to dataPoints
  const points = (leftLabel && rightLabel) ? [
      { label: leftLabel, title: leftLabel, description: leftDescription },
      { label: rightLabel, title: rightLabel, description: rightDescription }
  ] : (dataPoints || [
      { label: "Old Way", title: "Slow & Static", description: "Hard coded pages." },
      { label: "New Way", title: "Dynamic & Fast", description: "Generated on the fly." }
  ]);

  const finalVerdict = verdict || title;
  const hasImage = !!(imageUrl || videoUrl);
  const p = aspectRatio === "portrait";
  const resolvedFontFamily = fontFamily ?? GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY;

  const imageOpacity = interpolate(frame, [5, 25], [0, 1], { extrapolateRight: "clamp" });
  const imageScale = spring({ frame: Math.max(0, frame - 5), fps, config: { damping: 14 } });

  // Column budget: the `1fr` row (or `auto` in portrait) is not a shrinkable
  // measurable box, so budget the title+description split from a fraction of
  // frame height.
  const columnBudgetPx = Math.max(1, videoHeight * (p ? 0.24 : 0.42));

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
          gridTemplateColumns: p ? "1fr" : "1fr 1fr",
          gridTemplateRows: p ? "auto auto auto" : "1fr auto",
          gap: 20,
          flex: hasImage && !p ? 1 : "none",
          width: hasImage && !p ? "auto" : "100%",
          minWidth: 0,
        }}
      >
      {/* Left Item */}
      <CompareColumn
        label={points[0]?.label || "Before"}
        itemTitle={points[0]?.title}
        description={points[0]?.description}
        titleFontSize={titleFontSize}
        descriptionFontSize={descriptionFontSize}
        titleFontSizeIsUserSet={titleFontSizeIsUserSet}
        descriptionFontSizeIsUserSet={descriptionFontSizeIsUserSet}
        p={p}
        budgetPx={columnBudgetPx}
        style={{
          ...glass(false),
          padding: p ? 24 : 32,
          display: "flex", flexDirection: "column", justifyContent: "center",
          minWidth: 0,
          overflow: "hidden",
          transform: p
            ? `translateY(${interpolate(spr(0), [0, 1], [24, 0])}px)`
            : `translateX(${interpolate(spr(0), [0, 1], [-50, 0])}px)`,
          opacity: interpolate(spr(0), [0, 1], [0, 1]),
        }}
      />

       {/* Right Item */}
      <CompareColumn
        label={points[1]?.label || "After"}
        itemTitle={points[1]?.title}
        description={points[1]?.description}
        titleFontSize={titleFontSize}
        descriptionFontSize={descriptionFontSize}
        titleFontSizeIsUserSet={titleFontSizeIsUserSet}
        descriptionFontSizeIsUserSet={descriptionFontSizeIsUserSet}
        p={p}
        budgetPx={columnBudgetPx}
        style={{
          ...glass(false),
          padding: p ? 24 : 32,
          display: "flex", flexDirection: "column", justifyContent: "center",
          minWidth: 0,
          overflow: "hidden",
          transform: p
            ? `translateY(${interpolate(spr(5), [0, 1], [24, 0])}px)`
            : `translateX(${interpolate(spr(5), [0, 1], [50, 0])}px)`,
          opacity: interpolate(spr(5), [0, 1], [0, 1]),
        }}
      />

      {/* Verdict / Bottom Bar */}
      {finalVerdict && (
          <VerdictBar
            text={finalVerdict}
            p={p}
            budgetPx={Math.max(1, videoHeight * 0.08)}
            style={{
              gridColumn: p ? "1" : "1 / 3",
              ...glass(true),
              backgroundColor: accentColor || COLORS.ACCENT,
              padding: "20px",
              textAlign: "center",
              display: "flex", alignItems: "center", justifyContent: "center",
              minWidth: 0,
              transform: `translateY(${interpolate(spr(15), [0, 1], [20, 0])}px)`,
              opacity: interpolate(spr(15), [0, 1], [0, 1]),
            }}
          />
      )}
      </div>
    </div>
  );
};

