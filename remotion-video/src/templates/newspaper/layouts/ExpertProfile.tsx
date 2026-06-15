import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, Img, spring, staticFile } from "remotion";
import { NewsBackground } from "../NewsBackground";
import type { BlogLayoutProps } from "../types";

const H_FONT = "'Source Serif 4', Georgia, 'Times New Roman', serif";
const B_FONT = "'Source Sans 3', 'Helvetica Neue', Helvetica, Arial, sans-serif";

export const ExpertProfile: React.FC<BlogLayoutProps> = ({
  title = "The Voice Behind the Story",
  narration = "A leading authority on economic policy with decades of experience advising governments and international institutions.",
  accentColor = "#FFE34D",
  bgColor = "#FAFAF8",
  textColor = "#111111",
  aspectRatio = "landscape",
  titleFontSize,
  descriptionFontSize,
  stats,
  imageUrl,
  imageObjectPosition,
  imageZoom,
  leftThought,
  rightThought,
  category,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, fps } = useVideoConfig();
  const p = aspectRatio === "portrait";

  const expertName = leftThought ?? "";
  const expertRole = rightThought ?? "";
  const statVal = stats?.[0]?.value ?? "";
  const statLabel = stats?.[0]?.label ?? "";
  const hasImage = Boolean(imageUrl);

  const titleSize = titleFontSize ?? (p ? 55 : 58);
  const descSize = descriptionFontSize ?? (p ? 32 : 26);

  // 3D camera entrance
  const cameraRotateX = interpolate(frame, [0, 30], [12, 0], { extrapolateRight: "clamp" });
  const cameraRotateY = interpolate(frame, [0, 30], [8, 0], { extrapolateRight: "clamp" });
  const cameraScale = interpolate(frame, [0, 30], [1.1, 1.0], { extrapolateRight: "clamp" });

  // Ken Burns on bg
  const bgZoom = interpolate(frame, [0, durationInFrames], [1, 1.08]);

  // Image spring entrance
  const imgSpring = spring({ frame: Math.max(0, frame - 5), fps, config: { stiffness: 80, damping: 14 } });
  const imgScale = interpolate(imgSpring, [0, 1], [0.85, 1]);
  const imgRotation = interpolate(imgSpring, [0, 1], [6, 2]);
  const imgOpacity = interpolate(frame, [5, 25], [0, 1], { extrapolateRight: "clamp" });

  // Category badge & rule
  const categoryOp = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const ruleW = interpolate(frame, [6, 24], [0, 100], { extrapolateRight: "clamp" });

  // Name / role staggered
  const nameOp = interpolate(frame, [10, 30], [0, 1], { extrapolateRight: "clamp" });
  const nameY = interpolate(frame, [10, 30], [12, 0], { extrapolateRight: "clamp" });
  const roleOp = interpolate(frame, [14, 32], [0, 1], { extrapolateRight: "clamp" });
  const roleY = interpolate(frame, [14, 32], [12, 0], { extrapolateRight: "clamp" });

  // Title word-reveal
  const words = title.split(" ");
  const wordProgress = interpolate(frame, [20, 75], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const visWords = Math.ceil(words.length * wordProgress);
  const showTitleCursor = visWords < words.length;

  // Narration char-reveal
  const bodyProgress = interpolate(frame, [35, 90], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const visChars = Math.floor((narration ?? "").length * bodyProgress);
  const visText = (narration ?? "").slice(0, visChars);
  const showBodyCursor = visChars < (narration ?? "").length;

  // Stat badge slide-in
  const statOp = interpolate(frame, [55, 72], [0, 1], { extrapolateRight: "clamp" });
  const statX = interpolate(frame, [55, 72], [60, 0], { extrapolateRight: "clamp" });

  // Exit: left slide (DataSnapshot pattern)
  const EXIT_START = durationInFrames - 25;
  const exitSpring = spring({ frame: Math.max(0, frame - EXIT_START), fps, config: { stiffness: 60, damping: 15 } });
  const exitTranslateX = interpolate(exitSpring, [0, 1], [0, -width]);
  const exitOpacity = interpolate(exitSpring, [0.4, 1], [1, 0]);

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: fontFamily ?? B_FONT, backgroundColor: "#000", perspective: "1500px" }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          opacity: exitOpacity,
          transform: `translateX(${exitTranslateX}px) scale(${cameraScale}) rotateX(${cameraRotateX}deg) rotateY(${cameraRotateY}deg)`,
        }}
      >
        {/* Background */}
        <div style={{ position: "absolute", inset: 0, transform: `scale(${bgZoom})`, transformOrigin: "center center" }}>
          <NewsBackground bgColor={bgColor} />
        </div>
        <div style={{ position: "absolute", inset: 0, backgroundColor: bgColor, opacity: 0.45, zIndex: 2, pointerEvents: "none" }} />
        <img
          src={staticFile("vintage-news.avif")}
          alt=""
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", opacity: 0.35, filter: "grayscale(75%) contrast(1.08)", zIndex: 1,
          }}
        />

        {p && !hasImage ? (
          /* ── PORTRAIT LAYOUT — NO IMAGE ───────────────────────────── */
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", zIndex: 5, transform: "translateZ(50px)", padding: "8% 8%", textAlign: "center" }}>
            {/* Expert name at top */}
            {(expertName || expertRole) && (
              <div style={{ flexShrink: 0 }}>
                {expertName && (
                  <div style={{ fontFamily: fontFamily ?? H_FONT, fontWeight: 800, fontSize: descSize + 6, color: textColor, opacity: nameOp, transform: `translateY(${nameY}px)` }}>
                    {expertName}
                  </div>
                )}
                {expertRole && (
                  <div style={{ fontFamily: fontFamily ?? B_FONT, fontWeight: 600, fontSize: descSize - 6, color: textColor, opacity: roleOp * 0.7, transform: `translateY(${roleY}px)`, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4 }}>
                    {expertRole}
                  </div>
                )}
              </div>
            )}

            {/* Title + narration centered */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 20 }}>
              {/* Category badge */}
              {category && (
                <div style={{ opacity: categoryOp, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div style={{ fontFamily: fontFamily ?? B_FONT, fontSize: 13, fontWeight: 800, letterSpacing: "0.12em", color: textColor, textTransform: "uppercase", opacity: 0.7 }}>
                    {category}
                  </div>
                  <div style={{ height: 2, background: accentColor, width: `${ruleW}%` }} />
                </div>
              )}

              {/* Title word-reveal */}
              <div style={{ fontFamily: fontFamily ?? H_FONT, fontWeight: 700, fontSize: titleSize, lineHeight: 1.1, color: textColor }}>
                {words.slice(0, visWords).join(" ")}
                {showTitleCursor && visWords > 0 && (
                  <span style={{ display: "inline-block", width: 3, height: "0.85em", background: textColor, opacity: 0.5, marginLeft: 4, verticalAlign: "middle" }} />
                )}
              </div>

              {/* Narration char-reveal */}
              <div style={{ fontFamily: fontFamily ?? B_FONT, fontSize: descSize, color: textColor, lineHeight: 1.5, opacity: 0.85 }}>
                {visText}
                {showBodyCursor && visChars > 0 && (
                  <span style={{ display: "inline-block", width: 3, height: "0.85em", background: textColor, opacity: 0.5, marginLeft: 2, verticalAlign: "middle" }} />
                )}
              </div>
            </div>

            {/* Key credential stat at bottom */}
            {statVal && (
              <div style={{ flexShrink: 0, opacity: statOp, transform: `translateX(${statX}px)`, alignSelf: "center", border: `2px solid ${accentColor}`, padding: "10px 20px", textAlign: "center" }}>
                <div style={{ fontFamily: fontFamily ?? H_FONT, fontWeight: 900, fontSize: descSize + 16, color: textColor, lineHeight: 1 }}>{statVal}</div>
                {statLabel && <div style={{ fontFamily: fontFamily ?? B_FONT, fontWeight: 600, fontSize: descSize - 8, color: textColor, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>{statLabel}</div>}
              </div>
            )}
          </div>
        ) : p ? (
          /* ── PORTRAIT LAYOUT — WITH IMAGE ─────────────────────────── */
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", zIndex: 5, transform: "translateZ(50px)" }}>
            {/* Image top 38% */}
            {imageUrl && (
              <div
                style={{
                  width: "100%",
                  height: "38%",
                  flexShrink: 0,
                  overflow: "hidden",
                  opacity: imgOpacity,
                  transform: `scale(${imgScale})`,
                }}
              >
                <div
                  style={{
                    margin: "0 6%",
                    height: "100%",
                    padding: "8px",
                    backgroundColor: "#fff",
                    boxShadow: "0 16px 40px rgba(0,0,0,0.22)",
                    clipPath: "polygon(0% 2%, 98% 0%, 100% 95%, 96% 100%, 50% 97%, 4% 100%, 0% 50%)",
                    transform: `rotate(${imgRotation}deg)`,
                    overflow: "hidden",
                  }}
                >
                  <Img
                    src={imageUrl}
                    style={{
                      width: "100%", height: "100%",
                      objectFit: (imageZoom ?? 1) < 1 ? "contain" : "cover",
                      objectPosition: imageObjectPosition ?? "50% 20%",
                      transform: `scale(${imageZoom ?? 1})`,
                      filter: "grayscale(0.5) contrast(1.1)",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Content below image */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "4% 8%", gap: 16 }}>
              {/* Credit block */}
              {(expertName || expertRole) && (
                <div style={{ textAlign: "center" }}>
                  {expertName && (
                    <div style={{ fontFamily: fontFamily ?? H_FONT, fontWeight: 800, fontSize: descSize + 4, color: textColor, opacity: nameOp, transform: `translateY(${nameY}px)` }}>
                      {expertName}
                    </div>
                  )}
                  {expertRole && (
                    <div style={{ fontFamily: fontFamily ?? B_FONT, fontWeight: 600, fontSize: descSize - 6, color: textColor, opacity: roleOp * 0.7, transform: `translateY(${roleY}px)`, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4 }}>
                      {expertRole}
                    </div>
                  )}
                </div>
              )}

              {/* Category badge */}
              {category && (
                <div style={{ opacity: categoryOp, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div style={{ fontFamily: fontFamily ?? B_FONT, fontSize: 13, fontWeight: 800, letterSpacing: "0.12em", color: textColor, textTransform: "uppercase", opacity: 0.7 }}>
                    {category}
                  </div>
                  <div style={{ height: 2, background: accentColor, width: `${ruleW}%` }} />
                </div>
              )}

              {/* Title word-reveal */}
              <div style={{ fontFamily: fontFamily ?? H_FONT, fontWeight: 700, fontSize: titleSize, lineHeight: 1.1, color: textColor, textAlign: "center" }}>
                {words.slice(0, visWords).join(" ")}
                {showTitleCursor && visWords > 0 && (
                  <span style={{ display: "inline-block", width: 3, height: "0.85em", background: textColor, opacity: 0.5, marginLeft: 4, verticalAlign: "middle" }} />
                )}
              </div>

              {/* Narration char-reveal */}
              <div style={{ fontFamily: fontFamily ?? B_FONT, fontSize: descSize, color: textColor, lineHeight: 1.5, opacity: 0.85, textAlign: "center" }}>
                {visText}
                {showBodyCursor && visChars > 0 && (
                  <span style={{ display: "inline-block", width: 3, height: "0.85em", background: textColor, opacity: 0.5, marginLeft: 2, verticalAlign: "middle" }} />
                )}
              </div>

              {/* Stat badge */}
              {statVal && (
                <div style={{ opacity: statOp, transform: `translateX(${statX}px)`, alignSelf: "center", border: `2px solid ${accentColor}`, padding: "10px 20px", textAlign: "center", marginTop: "auto" }}>
                  <div style={{ fontFamily: fontFamily ?? H_FONT, fontWeight: 900, fontSize: descSize + 16, color: textColor, lineHeight: 1 }}>{statVal}</div>
                  {statLabel && <div style={{ fontFamily: fontFamily ?? B_FONT, fontWeight: 600, fontSize: descSize - 8, color: textColor, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>{statLabel}</div>}
                </div>
              )}
            </div>
          </div>
        ) : !hasImage ? (
          /* ── LANDSCAPE LAYOUT — NO IMAGE ──────────────────────────── */
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "row", zIndex: 5, transform: "translateZ(50px)" }}>
            {/* Left column (narrow): expert name on top, key credentials below */}
            <div style={{ width: "32%", flexShrink: 0, display: "flex", flexDirection: "column", padding: "6% 4% 6% 6%", gap: 18 }}>
              {/* Expert name at top */}
              {(expertName || expertRole) && (
                <div style={{ flexShrink: 0 }}>
                  {expertName && (
                    <div style={{ fontFamily: fontFamily ?? H_FONT, fontWeight: 800, fontSize: descSize + 6, color: textColor, lineHeight: 1.1, opacity: nameOp, transform: `translateY(${nameY}px)` }}>
                      {expertName}
                    </div>
                  )}
                  {expertRole && (
                    <div style={{ fontFamily: fontFamily ?? B_FONT, fontWeight: 600, fontSize: descSize - 8, color: textColor, opacity: roleOp * 0.7, transform: `translateY(${roleY}px)`, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 6 }}>
                      {expertRole}
                    </div>
                  )}
                  <div style={{ height: 3, background: accentColor, width: `${ruleW}%`, marginTop: 12 }} />
                </div>
              )}

              {/* Key credentials (stat) below the name */}
              {statVal && (
                <div style={{ opacity: statOp, transform: `translateX(${statX}px)`, alignSelf: "flex-start", border: `2px solid ${accentColor}`, padding: "10px 18px" }}>
                  <div style={{ fontFamily: fontFamily ?? H_FONT, fontWeight: 900, fontSize: descSize + 18, color: textColor, lineHeight: 1 }}>{statVal}</div>
                  {statLabel && <div style={{ fontFamily: fontFamily ?? B_FONT, fontWeight: 600, fontSize: descSize - 8, color: textColor, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>{statLabel}</div>}
                </div>
              )}
            </div>

            {/* Thin column divider */}
            <div style={{ width: 1, background: textColor, opacity: 0.1, alignSelf: "stretch", margin: "6% 0" }} />

            {/* Right column (wide): category → title → narration */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "5% 6% 5% 5%", gap: 18, backgroundColor: "rgba(255,255,255,0.55)" }}>
              {/* Category badge + rule */}
              {category && (
                <div style={{ opacity: categoryOp }}>
                  <div style={{ fontFamily: fontFamily ?? B_FONT, fontSize: 12, fontWeight: 800, letterSpacing: "0.14em", color: textColor, textTransform: "uppercase", opacity: 0.65, marginBottom: 6 }}>
                    {category}
                  </div>
                  <div style={{ height: 3, background: accentColor, width: `${ruleW}%` }} />
                </div>
              )}

              {/* Title word-reveal */}
              <div style={{ fontFamily: fontFamily ?? H_FONT, fontWeight: 700, fontSize: titleSize, lineHeight: 1.1, color: textColor }}>
                {words.slice(0, visWords).join(" ")}
                {showTitleCursor && visWords > 0 && (
                  <span style={{ display: "inline-block", width: 3, height: "0.85em", background: textColor, opacity: 0.5, marginLeft: 4, verticalAlign: "middle" }} />
                )}
              </div>

              {/* Narration char-reveal */}
              <div style={{ fontFamily: fontFamily ?? B_FONT, fontSize: descSize, color: textColor, lineHeight: 1.55, opacity: 0.85 }}>
                {visText}
                {showBodyCursor && visChars > 0 && (
                  <span style={{ display: "inline-block", width: 3, height: "0.85em", background: textColor, opacity: 0.5, marginLeft: 2, verticalAlign: "middle" }} />
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ── LANDSCAPE LAYOUT — WITH IMAGE ────────────────────────── */
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "row", zIndex: 5, transform: "translateZ(50px)" }}>
            {/* Left column: image + credit */}
            <div style={{ width: "45%", flexShrink: 0, display: "flex", flexDirection: "column", padding: "5% 4% 5% 6%", gap: 16 }}>
              {imageUrl ? (
                <div
                  style={{
                    flex: 1,
                    opacity: imgOpacity,
                    padding: "8px",
                    backgroundColor: "#fff",
                    boxShadow: "10px 15px 40px rgba(0,0,0,0.2)",
                    clipPath: "polygon(0% 2%, 98% 0%, 100% 95%, 96% 100%, 50% 97%, 4% 100%, 0% 50%)",
                    transform: `scale(${imgScale}) rotate(${imgRotation}deg)`,
                    overflow: "hidden",
                  }}
                >
                  <Img
                    src={imageUrl}
                    style={{
                      width: "100%", height: "100%",
                      objectFit: (imageZoom ?? 1) < 1 ? "contain" : "cover",
                      objectPosition: imageObjectPosition ?? "50% 20%",
                      transform: `scale(${imageZoom ?? 1})`,
                      filter: "grayscale(0.5) contrast(1.1)",
                    }}
                  />
                </div>
              ) : (
                <div style={{ flex: 1 }} />
              )}

              {/* Credit block below image */}
              {(expertName || expertRole) && (
                <div style={{ paddingTop: 12, borderTop: `3px solid ${accentColor}` }}>
                  {expertName && (
                    <div style={{ fontFamily: fontFamily ?? H_FONT, fontWeight: 800, fontSize: descSize + 2, color: textColor, opacity: nameOp, transform: `translateY(${nameY}px)` }}>
                      {expertName}
                    </div>
                  )}
                  {expertRole && (
                    <div style={{ fontFamily: fontFamily ?? B_FONT, fontWeight: 600, fontSize: descSize - 8, color: textColor, opacity: roleOp * 0.7, transform: `translateY(${roleY}px)`, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 3 }}>
                      {expertRole}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Thin column divider */}
            <div style={{ width: 1, background: textColor, opacity: 0.1, alignSelf: "stretch", margin: "6% 0" }} />

            {/* Right column: category → title → narration → stat */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "5% 6% 5% 4%", gap: 18, backgroundColor: "rgba(255,255,255,0.55)" }}>
              {/* Category badge + rule */}
              {category && (
                <div style={{ opacity: categoryOp }}>
                  <div style={{ fontFamily: fontFamily ?? B_FONT, fontSize: 12, fontWeight: 800, letterSpacing: "0.14em", color: textColor, textTransform: "uppercase", opacity: 0.65, marginBottom: 6 }}>
                    {category}
                  </div>
                  <div style={{ height: 3, background: accentColor, width: `${ruleW}%` }} />
                </div>
              )}

              {/* Title word-reveal */}
              <div style={{ fontFamily: fontFamily ?? H_FONT, fontWeight: 700, fontSize: titleSize, lineHeight: 1.1, color: textColor }}>
                {words.slice(0, visWords).join(" ")}
                {showTitleCursor && visWords > 0 && (
                  <span style={{ display: "inline-block", width: 3, height: "0.85em", background: textColor, opacity: 0.5, marginLeft: 4, verticalAlign: "middle" }} />
                )}
              </div>

              {/* Narration char-reveal */}
              <div style={{ fontFamily: fontFamily ?? B_FONT, fontSize: descSize, color: textColor, lineHeight: 1.55, opacity: 0.85, flex: 1 }}>
                {visText}
                {showBodyCursor && visChars > 0 && (
                  <span style={{ display: "inline-block", width: 3, height: "0.85em", background: textColor, opacity: 0.5, marginLeft: 2, verticalAlign: "middle" }} />
                )}
              </div>

              {/* Stat badge pinned to bottom */}
              {statVal && (
                <div style={{ opacity: statOp, transform: `translateX(${statX}px)`, alignSelf: "flex-start", border: `2px solid ${accentColor}`, padding: "10px 18px" }}>
                  <div style={{ fontFamily: fontFamily ?? H_FONT, fontWeight: 900, fontSize: descSize + 18, color: textColor, lineHeight: 1 }}>{statVal}</div>
                  {statLabel && <div style={{ fontFamily: fontFamily ?? B_FONT, fontWeight: 600, fontSize: descSize - 8, color: textColor, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>{statLabel}</div>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
