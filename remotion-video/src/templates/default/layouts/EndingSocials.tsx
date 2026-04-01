import React, { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
  useVideoConfig,
  random,
} from "remotion";
import type { SceneLayoutProps } from "../types";
import { SocialIcons } from "../../SocialIcons";

export const EndingSocials: React.FC<SceneLayoutProps> = ({
  title,
  narration,
  socials,
  websiteLink,
  showWebsiteButton,
  ctaButtonText,
  accentColor,
  textColor,
  bgColor,
  fontFamily,
  aspectRatio,
  descriptionFontSize,
  titleFontSize,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const p = aspectRatio === "portrait";

  // --- CONFIGURATION ---
  const vanishDurationFrames = 30;
  const vanishStartFrame = durationInFrames - vanishDurationFrames;
  const maxCharDelay = 15; // Max staggered delay for characters blowing away

  // --- ENTRANCE ANIMATIONS ---
  const titleEntranceOp = interpolate(frame, [0, 18], [0, 1], {
    extrapolateRight: "clamp",
  });
  const subEntranceOp = interpolate(frame, [10, 28], [0, 1], {
    extrapolateRight: "clamp",
  });

  // --- VANISH / EXIT SPRING ---
  const vanishSpring = spring({
    frame: frame - vanishStartFrame,
    fps,
    config: { damping: 40, stiffness: 80, mass: 1 },
  });

  // --- PLANE MOTION LOGIC ---
  const radiusX = p ? width * 0.4 : width * 0.35;
  const radiusY = p ? height * 0.3 : height * 0.25;
  const speed = frame * 0.05;
  const planeX = Math.cos(speed) * radiusX;
  const planeY = Math.sin(speed) * radiusY;
  const angle = (Math.atan2(Math.cos(speed), -Math.sin(speed)) * 180) / Math.PI;

  const planeExitScale = interpolate(vanishSpring, [0, 1], [1, 20], {
    extrapolateRight: "clamp",
  });
  const planeExitOpacity = interpolate(vanishSpring, [0.8, 1], [1, 0]);

  // --- CHARACTER BLOW AWAY LOGIC ---
  // Memoizing character data to keep random values consistent across frames
  const createAnimatedChars = (text: string, seedPrefix: string) => {
    return text.split("").map((char, i) => ({
      char,
      id: `${seedPrefix}-${i}`,
      offsetX: (random(`${seedPrefix}-x-${i}`) - 0.5) * 400,
      offsetY: (random(`${seedPrefix}-y-${i}`) - 0.5) * 400,
      rotate: (random(`${seedPrefix}-r-${i}`) - 0.5) * 720,
      delay: random(`${seedPrefix}-d-${i}`) * maxCharDelay,
    }));
  };

  const titleChars = useMemo(() => createAnimatedChars(title || "", "title"), [title]);
  const narrationChars = useMemo(() => createAnimatedChars(narration || "", "narr"), [narration]);

  const renderAnimatedText = (
    chars: ReturnType<typeof createAnimatedChars>,
    baseOpacity: number,
    fontSize: number,
    fontWeight: number | string,
    isTitle: boolean
  ) => {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center" }}>
        {chars.map((c) => {
          // Calculate when this specific character starts blowing away
          const charVanishProgress = interpolate(
            frame,
            [vanishStartFrame + c.delay, vanishStartFrame + c.delay + vanishDurationFrames],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );

          const springVal = spring({
            frame: frame - (vanishStartFrame + c.delay),
            fps,
            config: { damping: 25, stiffness: 120 },
          });

          const op = interpolate(springVal, [0, 1], [1, 0]);
          const tx = interpolate(springVal, [0, 1], [0, c.offsetX]);
          const ty = interpolate(springVal, [0, 1], [0, c.offsetY]);
          const rot = interpolate(springVal, [0, 1], [0, c.rotate]);

          return (
            <span
              key={c.id}
              style={{
                display: "inline-block",
                whiteSpace: "pre",
                fontSize,
                fontWeight,
                color: textColor || "#0A0A0A",
                fontFamily: bodyFont,
                opacity: baseOpacity * op,
                transform: `translate(${tx}px, ${ty}px) rotate(${rot}deg)`,
                lineHeight: isTitle ? 1.05 : 1.25,
              }}
            >
              {c.char}
            </span>
          );
        })}
      </div>
    );
  };

  // --- UI LOGIC ---
  const dividerOpacity = Math.min(1, (subEntranceOp ?? 0) * 1.2) * interpolate(vanishSpring, [0, 0.2], [1, 0]);
  const showWebsiteCta = (showWebsiteButton !== false) && (websiteLink ?? "").trim().length > 0;
  const bodyFont = fontFamily ?? "'Roboto Slab', serif";

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#F0F0F0", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 6, backgroundColor: accentColor }} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "6% 8%" : "7% 12%",
          textAlign: "center",
          gap: p ? 18 : 24,
        }}
      >
        {/* THE MOVING PLANE */}
        <div
          style={{
            position: "absolute",
            zIndex: 100,
            transform: `translate(${planeX}px, ${planeY}px) rotate(${angle}deg) scale(${planeExitScale})`,
            opacity: planeExitOpacity,
            filter: "drop-shadow(0 10px 10px rgba(0,0,0,0.2))",
          }}
        >
          <svg
            width={p ? "80" : "60"}
            height={p ? "80" : "60"}
            viewBox="0 0 24 24"
            fill={accentColor || "#7C3AED"}
            style={{ transform: "rotate(90deg)" }}
          >
            <path d="M21,16L21,14L13,9L13,3.5A1.5,1.5 0 0,0 11.5,2A1.5,1.5 0 0,0 10,3.5V9L2,14V16L10,13.5V19L8,20.5V22L11.5,21L15,22V20.5L13,19V13.5L21,16Z" />
          </svg>
        </div>

        {/* TITLE SECTION */}
        <div style={{ transform: `translateY(${(1 - titleEntranceOp) * 10}px)` }}>
          {renderAnimatedText(
            titleChars,
            titleEntranceOp,
            titleFontSize ?? (p ? 88 : 79),
            800,
            true
          )}
          <div
            style={{
              width: p ? 220 : 320,
              height: 6,
              borderRadius: 999,
              backgroundColor: `${accentColor}55`,
              margin: p ? "10px auto 0" : "12px auto 0",
              opacity: dividerOpacity,
            }}
          />
        </div>

        {/* CTA SECTION - Fades out standardly to avoid complexity with button shapes */}
        {showWebsiteCta && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: p ? 10 : 12,
              opacity: interpolate(vanishSpring, [0, 0.3], [1, 0]),
              transform: `scale(${interpolate(vanishSpring, [0, 0.3], [1, 0.8])})`,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                borderRadius: 999,
                padding: p ? "18px 36px" : "16px 32px",
                backgroundColor: accentColor || "#7C3AED",
                color: "#FFFFFF",
                fontSize: p ? 28 : 26,
                fontWeight: 700,
                fontFamily: bodyFont,
              }}
            >
              <span>{(ctaButtonText ?? "").trim() || "Get started"}</span>
              <span style={{ fontSize: p ? 30 : 28 }}>→</span>
            </div>
            <div
              style={{
                fontSize: p ? 26 : 24,
                fontWeight: 600,
                color: textColor || "#404040",
                fontFamily: bodyFont,
                maxWidth: p ? 560 : 760,
                wordBreak: "break-word",
              }}
            >
              {(websiteLink ?? "").trim()}
            </div>
          </div>
        )}

        {/* NARRATION / DESCRIPTION */}
        <div style={{ maxWidth: p ? 520 : 760, transform: `translateY(${(1 - subEntranceOp) * 6}px)` }}>
          {renderAnimatedText(
            narrationChars,
            subEntranceOp,
            descriptionFontSize ?? (p ? 44 : 36),
            500,
            false
          )}
        </div>

        {/* SOCIALS - Simple fade out */}
        <div 
          style={{ 
            marginTop: p ? 10 : 18, 
            width: "100%", 
            opacity: interpolate(vanishSpring, [0, 0.2], [1, 0]) 
          }}
        >
          <SocialIcons
            socials={socials}
            accentColor={accentColor}
            textColor={textColor || "#111"}
            maxPerRow={p ? 3 : 4}
            fontFamily={bodyFont}
            aspectRatio={aspectRatio}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};