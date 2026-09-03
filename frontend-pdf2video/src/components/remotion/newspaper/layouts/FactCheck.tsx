import React from "react";
import { NewspaperClip } from "../components/NewspaperClip";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, Img, staticFile } from "remotion";
import { NewsBackground } from "../NewsBackground";
import { useFitText, useAvailableHeight } from "../components/useFitText";
import type { BlogLayoutProps } from "../types";

const H_FONT = "'Source Serif 4', Georgia, 'Times New Roman', serif";
const B_FONT = "'Source Sans 3', 'Helvetica Neue', Helvetica, Arial, sans-serif";

export const FactCheck: React.FC<BlogLayoutProps & { imageUrl?: string }> = ({
  title = "Fact Check",
  narration,
  leftThought = "The shutdown will only last a few hours.",
  rightThought = "Past shutdowns have averaged 16 days. Essential services may be suspended indefinitely.",
  accentColor = "#FFE34D",
  bgColor = "#FAFAF8",
  textColor = "#111111",
  aspectRatio = "landscape",
  titleFontSize,
  descriptionFontSize,
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
  stats,imageUrl,
  imageObjectPosition,
  imageZoom,
  videoUrl,
  videoMuted,
  videoVolume,
  videoDurationInFrames,
  videoStartInFrames,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const p = aspectRatio === "portrait";

  const leftLabel = stats?.[0]?.label ?? "CLAIMED";
  const rightLabel = stats?.[1]?.label ?? "THE FACTS";

  /* ── Auto-fit ──────────────────────────────────────────────
     Title, the two claim columns and the verdict are all unbounded user input;
     long copy overflows the card and clips. Fit the headline to its own share,
     the claims to the body row, and the verdict to what is left at the bottom.
     An explicitly chosen size is honored exactly (minPx === targetPx no-ops). */
  const contentRef = React.useRef<HTMLDivElement>(null);
  const titleRef = React.useRef<HTMLDivElement>(null);
  const claimRef = React.useRef<HTMLDivElement>(null);
  const verdictRef = React.useRef<HTMLDivElement>(null);

  const titleTarget = titleFontSize ?? (p ? 70 : 64);
  const claimTarget = descriptionFontSize ?? (p ? 30 : 25);

  const titleBudget = Math.round(height * (p ? 0.24 : 0.28));
  const { px: titlePx } = useFitText(
    titleRef,
    titleTarget,
    titleFontSizeIsUserSet ? titleTarget : p ? 30 : 26,
    [title, titleTarget, titleFontSizeIsUserSet, titleBudget, p],
    titleBudget,
  );

  // Both claim columns share one size so the two sides stay visually balanced;
  // measure the longer of the two.
  const claimAvail = useAvailableHeight(claimRef, contentRef, [title, titlePx, claimTarget, p]);
  const verdictReserve = Math.round(claimTarget * 1.4 + 40);
  const { px: claimPx } = useFitText(
    claimRef,
    claimTarget,
    descriptionFontSizeIsUserSet ? claimTarget : p ? 16 : 14,
    [leftThought, rightThought, claimTarget, descriptionFontSizeIsUserSet, titlePx, claimAvail, p],
    claimAvail ? Math.max(1, claimAvail - verdictReserve) : undefined,
  );

  const verdictAvail = useAvailableHeight(verdictRef, contentRef, [title, titlePx, claimPx, narration, p]);
  const { px: verdictPx } = useFitText(
    verdictRef,
    claimTarget,
    descriptionFontSizeIsUserSet ? claimTarget : p ? 16 : 14,
    [narration, claimTarget, descriptionFontSizeIsUserSet, claimPx, verdictAvail, p],
    verdictAvail || undefined,
  );

  // --- Animation Logic ---
  const headerOp = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const leftOp = interpolate(frame, [8, 28], [0, 1], { extrapolateRight: "clamp" });
  const rightOp = interpolate(frame, [14, 34], [0, 1], { extrapolateRight: "clamp" });
  const imageOpacity = interpolate(frame, [30, 50], [0, 1], { extrapolateRight: "clamp" });
  const verdictOp = interpolate(frame, [42, 56], [0, 1], { extrapolateRight: "clamp" });
  const hlSweep = interpolate(frame, [18, 40], [0, 1], { extrapolateRight: "clamp" });

  // Shard Entrance/Exit Animations
  const joinProgress = interpolate(frame, [0, 40], [0, 1], { extrapolateRight: "clamp" });
  const breakProgress = interpolate(frame, [durationInFrames - 30, durationInFrames], [0, 1], { extrapolateRight: "clamp" });

  const leftShardX = -width / 2 * (1 - joinProgress) - 40 * breakProgress;
  const leftShardY = -height / 5 * (1 - joinProgress) - 20 * breakProgress;
  const leftShardRot = -8 + 8 * joinProgress + 2 * breakProgress;
  
  const rightShardX = -40 * breakProgress;
  const rightShardY = height / 5 * (1 - joinProgress) + 20 * breakProgress;
  const rightShardRot = 8 - 8 * joinProgress - 2 * breakProgress;

  const badgeHL = (color: string) => ({
    backgroundImage: `linear-gradient(${color}, ${color})`,
    backgroundSize: `${hlSweep * 100}% 100%`,
    backgroundRepeat: "no-repeat" as const,
    backgroundPosition: "0 0",
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: fontFamily ?? B_FONT, backgroundColor: "#000" }}>
      <NewsBackground bgColor={bgColor} />

      {/* Background Tint */}
      <div style={{ position: "absolute", inset: 0, backgroundColor: bgColor, opacity: 0.45, zIndex: 2 }} />

      {/* Restored Shards */}
      <img
        src={staticFile("vintage-news.avif")}
        alt=""
        style={{
          position: "absolute",
          top: leftShardY,
          left: leftShardX,
          width: width / 2,
          height: height,
          objectFit: "cover",
          objectPosition: "50% 50%",
          opacity: 0.4,
          transform: `rotate(${leftShardRot}deg)`,
          transformOrigin: "center center",
          zIndex: 1,
        }}
      />
      <img
        src={staticFile("vintage-news.avif")}
        alt=""
        style={{
          position: "absolute",
          top: rightShardY,
          right: rightShardX,
          width: width / 2,
          height: height,
          objectFit: "cover",
          objectPosition: "50% 50%",
          opacity: 0.4,
          transform: `rotate(${rightShardRot}deg)`,
          transformOrigin: "center center",
          zIndex: 1,
        }}
      />

      {/* Main Content Container */}
      <div style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        padding: p ? "12% 8%" : "5% 8%",
        zIndex: 10,
      }} ref={contentRef}>
        
        {/* HEADER */}
        <div style={{ opacity: headerOp, marginBottom: p ? 30 : 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
             <svg width={30} height={30} viewBox="0 0 34 34" fill="none">
              <circle cx="14" cy="14" r="10" stroke={textColor} strokeWidth="3" />
              <line x1="22" y1="22" x2="31" y2="31" stroke={textColor} strokeWidth="3" strokeLinecap="round" />
            </svg>
            <div ref={titleRef} style={{ fontFamily: fontFamily ?? H_FONT, fontSize: titlePx, fontWeight: 900, color: textColor, textTransform: "uppercase" }}>
              {title}
            </div>
          </div>
          <div style={{ height: 3, background: textColor, width: "100%", opacity: 0.2 }} />
        </div>

        {/* MAIN BODY AREA */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: p ? "column" : "row",
          gap: p ? 25 : 40,
          alignItems: "stretch",
        }}>
          
          {/* LEFT SECTION (CLAIM) */}
          <div style={{ 
            flex: 1, 
            opacity: leftOp,
            display: "flex",
            flexDirection: "column"
          }}>
            <div style={{ display: "inline-block", alignSelf: "flex-start", fontFamily: fontFamily ?? B_FONT, fontSize: p ? 14 : 13, fontWeight: 800, letterSpacing: "0.1em", color: textColor, ...badgeHL(accentColor), padding: "4px 8px", marginBottom: 15 }}>
              {leftLabel}
            </div>
            <div ref={claimRef} style={{ fontFamily: fontFamily ?? H_FONT, fontSize: claimPx, fontWeight: 500, color: textColor, lineHeight: 1.3, fontStyle: "italic" }}>
              "{leftThought}"
            </div>
          </div>

          {/* MIDDLE IMAGE (PORTRAIT ONLY) */}
          {(imageUrl || videoUrl) && p && (
            <div style={{ opacity: imageOpacity, width: "100%", display: "flex", justifyContent: "center", margin: "10px 0" }}>
               <div style={{ 
                  width: "100%", 
                  padding: "8px", 
                  backgroundColor: "#fff", 
                  boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
                  transform: "rotate(-1deg)",
                  border: "1px solid #ddd"
                }}>
                  {/* Clip box: zoom scales inside fixed frame (scale on img alone grows layout in flex) */}
                  <div
                    style={{
                      width: "100%",
                      height: 300,
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    {videoUrl ? (
                      <NewspaperClip
                        src={videoUrl}
                        imageObjectPosition={imageObjectPosition}
                        imageZoom={imageZoom}
                        muted={videoMuted ?? true}
                        volume={videoVolume ?? 0.35}
                        durationInFrames={videoDurationInFrames}
                startInFrames={videoStartInFrames}
                        style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      filter: "sepia(0.2) grayscale(0.3)",
                        }}
                      />
                    ) : imageUrl ? (
                    <Img
                      src={imageUrl}
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: (imageZoom ?? 1) < 1 ? "contain" : "cover",
                        objectPosition: (imageZoom ?? 1) < 1 ? "center" : (imageObjectPosition ?? "50% 50%"),
                        transform: `scale(${imageZoom ?? 1})`,
                        transformOrigin: (imageZoom ?? 1) < 1 ? "center center" : (imageObjectPosition ?? "50% 50%"),
                        filter: "sepia(0.2) grayscale(0.3)",
                      }}
                    />
                    ) : null}
                  </div>
               </div>
            </div>
          )}

          {/* LANDSCAPE DIVIDER */}
          {!p && <div style={{ width: 1, background: textColor, opacity: 0.1 }} />}

          {/* RIGHT SECTION (FACTS) */}
          <div style={{ 
            flex: 1, 
            opacity: rightOp,
            display: "flex",
            flexDirection: "column"
          }}>
            <div style={{ display: "inline-block", alignSelf: "flex-start", fontFamily: fontFamily ?? B_FONT, fontSize: p ? 14 : 13, fontWeight: 800, letterSpacing: "0.1em", color: textColor, border: `1.5px solid ${textColor}`, padding: "4px 8px", marginBottom: 15 }}>
              {rightLabel}
            </div>
            <div style={{ fontFamily: fontFamily ?? B_FONT, fontSize: claimPx, fontWeight: 500, color: textColor, lineHeight: 1.4 }}>
              {rightThought}
            </div>
          </div>

          {/* LANDSCAPE IMAGE (THIRD COLUMN) */}
          {!p && (imageUrl || videoUrl) && (
            <>
              <div style={{ width: 1, background: textColor, opacity: 0.1 }} />
              <div style={{ flex: 0.8, minWidth: 0, opacity: imageOpacity }}>
                <div style={{ 
                  padding: "10px", 
                  backgroundColor: "#fff", 
                  boxShadow: "0 15px 35px rgba(0,0,0,0.15)",
                  transform: "rotate(2deg)",
                  border: "1px solid #ddd"
                }}>
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "3 / 4",
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    {videoUrl ? (
                      <NewspaperClip
                        src={videoUrl}
                        imageObjectPosition={imageObjectPosition}
                        imageZoom={imageZoom}
                        muted={videoMuted ?? true}
                        volume={videoVolume ?? 0.35}
                        durationInFrames={videoDurationInFrames}
                startInFrames={videoStartInFrames}
                        style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      display: "block",
                      filter: "sepia(0.2) contrast(1.1)",
                        }}
                      />
                    ) : imageUrl ? (
                    <Img
                      src={imageUrl}
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        width: "100%",
                        height: "100%",
                        display: "block",
                        objectFit: (imageZoom ?? 1) < 1 ? "contain" : "cover",
                        objectPosition: (imageZoom ?? 1) < 1 ? "center" : (imageObjectPosition ?? "50% 50%"),
                        transform: `scale(${imageZoom ?? 1})`,
                        transformOrigin: (imageZoom ?? 1) < 1 ? "center center" : (imageObjectPosition ?? "50% 50%"),
                        filter: "sepia(0.2) contrast(1.1)",
                      }}
                    />
                    ) : null}
                  </div>
                  <div style={{ marginTop: 8, fontFamily: fontFamily ?? H_FONT, fontSize: 11, color: "#666", fontStyle: "italic", borderTop: "1px solid #eee", paddingTop: 4 }}>
                    Newspaper Archive / Photo
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* VERDICT (NARRATION) */}
        {narration && (
          <div ref={verdictRef} style={{
            opacity: verdictOp,
            marginTop: p ? 20 : 40,
            paddingTop: 20,
            borderTop: `${3}px solid ${accentColor}`,
            fontFamily: fontFamily ?? B_FONT,
            fontSize: verdictPx,
            fontWeight: 700,
            color: textColor
          }}>
            {narration}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

