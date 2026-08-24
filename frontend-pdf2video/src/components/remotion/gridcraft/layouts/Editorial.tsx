import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { GridcraftLayoutProps } from "../types";
import {
  GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY,
  GRIDCRAFT_DEFAULT_SERIF_FONT_FAMILY,
} from "../constants";
import { glass, COLORS } from "../utils/styles";
import { ZoomCropImg } from "../components/ZoomCropImg";
import { useFitText } from "../components/useFitText";

export const Editorial: React.FC<GridcraftLayoutProps> = ({
  title,
  narration,imageUrl,
  imageObjectPosition,
  imageZoom,
  videoUrl,
  videoMuted,
  videoVolume,
  videoDurationInFrames,
  videoStartInFrames,
  accentColor,
  titleFontSize,
  descriptionFontSize,
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
  aspectRatio,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps, height: videoHeight } = useVideoConfig();
  const p = aspectRatio === "portrait";
  const sansFontFamily = fontFamily ?? GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY;
  const serifFontFamily = fontFamily ?? GRIDCRAFT_DEFAULT_SERIF_FONT_FAMILY;
  const titleFontFamily = p ? sansFontFamily : serifFontFamily;

  const spr = spring({ frame, fps, config: { damping: 14 } });

  const scale = interpolate(spr, [0, 1], [0.95, 1]);
  const opacity = interpolate(spr, [0, 1], [0, 1]);
  const slideUp = interpolate(spr, [0, 1], [30, 0]);

  // Dynamic Layout: If image exists, split 50/50. Else center text.
  const hasImage = !!(imageUrl || videoUrl);

  /* ── Auto-fit ──────────────────────────────────────────────
     The text half is `justifyContent:"center"` in a box with no explicit
     height budget on the children, so the title fits a fixed fraction of the
     frame height first; the narration fits the remainder, and its residual
     overflow-at-floor feeds back to shrink the title's budget further. */
  const titleRef = React.useRef<HTMLDivElement>(null);
  const narrationRef = React.useRef<HTMLDivElement>(null);
  const actualTitleFontSize = titleFontSize ?? (p ? 65 : 64);
  const actualNarrationFontSize = descriptionFontSize ?? (p ? 37 : 38);
  const titleBudgetPx = Math.max(1, videoHeight * (p ? 0.26 : 0.3));
  const narrationBudgetPx = Math.max(1, videoHeight * (p ? 0.24 : 0.28));

  const [titleGiveBackPx, setTitleGiveBackPx] = React.useState(0);
  React.useLayoutEffect(() => {
    setTitleGiveBackPx(0);
  }, [title, narration, actualTitleFontSize, actualNarrationFontSize, titleBudgetPx, hasImage, p]);

  const { px: titlePx } = useFitText(
    titleRef,
    actualTitleFontSize,
    titleFontSizeIsUserSet ? actualTitleFontSize : p ? 30 : 28,
    [title, actualTitleFontSize, titleFontSizeIsUserSet, titleBudgetPx, titleGiveBackPx, hasImage, p],
    Math.max(1, titleBudgetPx - titleGiveBackPx),
  );
  const { px: narrationPx, overflowPx: narrationOverflowPx } = useFitText(
    narrationRef,
    actualNarrationFontSize,
    descriptionFontSizeIsUserSet ? actualNarrationFontSize : p ? 16 : 15,
    [narration, actualNarrationFontSize, descriptionFontSizeIsUserSet, narrationBudgetPx, titlePx, hasImage, p],
    narrationBudgetPx,
  );
  React.useLayoutEffect(() => {
    if (titleFontSizeIsUserSet || narrationOverflowPx <= 0) return;
    setTitleGiveBackPx((prev) => Math.min(titleBudgetPx * 0.6, prev + narrationOverflowPx));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrationOverflowPx, titleFontSizeIsUserSet]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "90%",
        height: "80%",
        margin: "auto",
        fontFamily: sansFontFamily,
      }}
    >
      <div
        style={{
           ...glass(false),
           display: "flex",
           flexDirection: hasImage && !p ? "row" : "column",
           width: "100%",
           height: "100%",
           padding: hasImage ? 0 : 60,
           overflow: "hidden",
           transform: `scale(${scale}) translateY(${slideUp}px)`,
           opacity,
        }}
      >
        {/* Image Half */}
        {hasImage && (
            <div style={{ flex: 1, position: "relative", overflow: "hidden", minHeight: 0 }}>
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
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.4) 100%)", mixBlendMode: "overlay" }} />
            </div>
        )}

        {/* Text Half */}
        <div style={{ 
            flex: 1, 
            display: "flex", 
            flexDirection: "column", 
            justifyContent: "center", 
            padding: hasImage ? (p ? 32 : 48) : 0,
            textAlign: hasImage && !p ? "left" : "center",
            maxWidth: hasImage ? "none" : "800px",
            margin: hasImage ? 0 : "auto",
            minWidth: 0,
        }}>
           <div ref={titleRef} style={{
               fontSize: titlePx,
               fontWeight: 700,
               lineHeight: 1.2,
               color: COLORS.DARK,
               marginBottom: 24,
               fontFamily: titleFontFamily,
               wordBreak: "break-word",
            }}>
               {title}
           </div>

           <div style={{ width: hasImage ? "40%" : "20%", height: 3, backgroundColor: accentColor || COLORS.ACCENT, marginBottom: 24, alignSelf: hasImage && !p ? "flex-start" : "center" }} />

           <div ref={narrationRef} style={{
               fontSize: narrationPx,
               lineHeight: 1.6,
               color: COLORS.DARK,
               opacity: 0.85,
               wordBreak: "break-word",
            }}>
               {narration}
           </div>
        </div>
      </div>
    </div>
  );
};

