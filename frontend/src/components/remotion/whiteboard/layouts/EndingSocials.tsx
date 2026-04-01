import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from "remotion";
import { WhiteboardBackground } from "../WhiteboardBackground";
import type { WhiteboardLayoutProps } from "../types";
import { SocialIcons } from "../../SocialIcons";

export const EndingSocials: React.FC<WhiteboardLayoutProps> = ({
  title,
  narration,
  socials,
  websiteLink,
  showWebsiteButton,
  ctaButtonText,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  fontFamily,
  titleFontSize,
  descriptionFontSize
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = aspectRatio === "portrait";

  // --- Animation Timings ---
  const fade = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const entrance = interpolate(frame, [10, 40], [0, 1], { extrapolateRight: "clamp" });
  const stickmanPop = spring({ frame: frame - 15, fps, config: { damping: 12 } });

// --- Physics & Motion Logic ---
// 1. Slow down the entrance of the motion (changed 50 to 90)
const presentProgress = interpolate(frame, [20, 90], [0, 1], { 
  extrapolateRight: "clamp" 
});

// 2. Slow down the frequency (changed 0.15 to 0.07)
// This makes the bobbing and swaying happen at half the original speed
const motionSpeed = 0.07; 

// Vertical Bobbing
const heavyBobRaw = Math.sin(frame * motionSpeed) * 7;
const heavyBob = heavyBobRaw * presentProgress;

// Horizontal Shifting
const legSway = Math.cos(frame * motionSpeed) * 4 * presentProgress;

// Rotation of the board
const swayRotation = interpolate(heavyBob, [-7, 7], [-4, 4]);

  const subtext = (narration ?? "").trim();
  const resolvedWebsiteLink = (websiteLink ?? "").trim();
  const showWebsiteCta = showWebsiteButton !== false && resolvedWebsiteLink.length > 0;
  const resolvedCta = (ctaButtonText ?? "").trim() || "Get started";
  const markerFont = (fontFamily ?? "").trim() || "'Patrick Hand', system-ui, sans-serif";

  // --- Stickman Bone Map ---
  const hipX = 50 + legSway;
  const hipY = 90 + heavyBob;
  const shoulderX = hipX + (legSway * 0.5);
  const shoulderY = 60 + (heavyBob * 0.4);
  const headX = shoulderX + (legSway * 0.2);
  const headY = 30 + (heavyBob * 0.2);

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: bgColor }}>
      <WhiteboardBackground bgColor={bgColor} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "12% 8%" : "8% 10%",
          textAlign: "center",
          opacity: fade,
        }}
      >
        {/* Title Section */}
        <div style={{
            fontSize: titleFontSize ?? (p ? 80 : 64),
            fontWeight: 700,
            color: textColor || "#111111",
            fontFamily: markerFont,
            opacity: entrance,
            transform: `translateY(${interpolate(entrance, [0, 1], [20, 0])}px)`,
            lineHeight: 1.1,
          }}>
          {title}
        </div>

        {/* Separator Line */}
        <div style={{
            height: 6,
            width: p ? 200 : 280,
            borderRadius: 999,
            backgroundColor: `${accentColor}55`,
            marginTop: 15,
            opacity: entrance,
          }}
        />

        {/* CARRYING SECTION */}
        {showWebsiteCta ? (
          <div style={{
              marginTop: 40,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              transform: `scale(${stickmanPop})`,
              opacity: stickmanPop,
            }}>
            
            {/* Website URL (Static) */}
            <div style={{
              fontSize: p ? 20 : 22,
              fontWeight: 600,
              color: textColor || "#111111",
              fontFamily: markerFont,
              marginBottom: 20,
            }}>
              {resolvedWebsiteLink}
            </div>

            <div style={{ 
              display: "flex", 
              alignItems: "flex-end",
              position: "relative",
              height: 160
            }}>
              
              {/* STICKMAN (Behind) */}
              <svg
                width={120}
                height={160}
                viewBox="0 0 100 150"
                style={{ 
                  position: "absolute",
                  left: -60,
                  zIndex: 1,
                  overflow: "visible"
                }}
              >
                <g fill="none" stroke={textColor || "#111"} strokeWidth="4" strokeLinecap="round">
                  {/* Feet stay on ground, legs stretch to moving hips */}
                  <line x1={hipX} y1={hipY} x2="35" y2="145" />
                  <line x1={hipX} y1={hipY} x2="65" y2="145" />
                  
                  {/* Spine */}
                  <line x1={hipX} y1={hipY} x2={shoulderX} y2={shoulderY} />
                  
                  {/* Head */}
                  <circle cx={headX} cy={headY} r="15" />

                  {/* Carrying Arm (Reaching into the board) */}
                  <line 
                    x1={shoulderX} 
                    y1={shoulderY} 
                    x2={shoulderX + 50 + legSway} 
                    y2={shoulderY + 10} 
                  />
                  
                  {/* Back Arm */}
                  <line x1={shoulderX} y1={shoulderY} x2={shoulderX - 20} y2={shoulderY + 30} />
                </g>
              </svg>

              {/* CARDBOARD (Front) */}
              <div style={{ 
                zIndex: 2,
                transform: `translate(${legSway * 1.2}px, ${heavyBob * 0.8}px) rotate(${swayRotation}deg)`,
                marginLeft: 20,
                marginBottom: 40
              }}>
                 <div style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: p ? "12px 20px" : "15px 30px",
                    border: `4px solid ${textColor || "#111"}`,
                    borderRadius: 12,
                    backgroundColor: "#FFFFFF",
                    color: textColor || "#111",
                    fontSize: p ? 24 : 28,
                    fontWeight: 800,
                    fontFamily: markerFont,
                    boxShadow: `6px 6px 0px ${accentColor}44`,
                  }}>
                    <span>{resolvedCta}</span>
                  </div>
              </div>
            </div>

            {/* Ground Line */}
            <div style={{
                width: p ? 280 : 360,
                height: 4,
                backgroundColor: `${textColor || "#111"}33`,
                borderRadius: 2,
                marginTop: -8,
              }}
            />
          </div>
        ) : null}

        {/* Subtext Section */}
        {subtext ? (
          <div style={{
              marginTop: 30,
              fontSize: descriptionFontSize ?? (p ? 36 : 28),
              color: `${textColor || "#111111"}CC`,
              fontFamily: markerFont,
              opacity: entrance,
              maxWidth: 700,
            }}>
            {subtext}
          </div>
        ) : null}

        {/* Social Icons */}
        <div style={{ marginTop: 30, width: "100%", opacity: entrance }}>
          <SocialIcons 
            socials={socials} 
            accentColor={accentColor} 
            textColor={textColor || "#111"} 
            maxPerRow={p ? 3 : 4} 
            fontFamily={markerFont} 
            aspectRatio={aspectRatio} 
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};