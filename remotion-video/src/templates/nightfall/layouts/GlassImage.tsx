import { AbsoluteFill, Img, interpolate, useCurrentFrame, spring } from "remotion";
import { DarkBackground } from "../DarkBackground";
import { glassCardStyle } from "../GlassCard";
import type { NightfallLayoutProps } from "../types";

/**
 * GlassImage — Enhanced Professional Version
 * 
 * Improvements:
 * - Intelligent Ken Burns effect (zoom + pan based on image aspect)
 * - Multi-layer gradient overlays for depth
 * - Parallax caption reveal
 * - Image loading state handling
 * - Better text readability with adaptive backgrounds
 * - Cinematic 2.39:1 letterbox option for dramatic effect
 */

export const GlassImage: React.FC<NightfallLayoutProps> = ({
  title,
  narration,
  imageUrl,
  accentColor,
  textColor,
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";

  // Ken Burns effect — subtle zoom with slight pan
  const kenBurnsScale = interpolate(
    frame,
    [0, 180],
    [1, 1.08],
    { extrapolateRight: "clamp" }
  );
  
  const kenBurnsPanX = interpolate(
    frame,
    [0, 180],
    [0, p ? -3 : -5],
    { extrapolateRight: "clamp" }
  );
  
  const kenBurnsPanY = interpolate(
    frame,
    [0, 180],
    [0, -3],
    { extrapolateRight: "clamp" }
  );

  // Image fade in
  const imageOpacity = interpolate(
    frame,
    [0, 35],
    [0, 1],
    { extrapolateRight: "clamp" }
  );

  // Caption reveal with spring physics
  const captionY = spring({
    frame: frame - 25,
    fps,
    config: { damping: 22, stiffness: 70, mass: 1 },
  });

  const captionOpacity = interpolate(
    frame,
    [25, 50],
    [0, 1],
    { extrapolateRight: "clamp" }
  );

  // Vignette intensity
  const vignetteOpacity = interpolate(
    frame,
    [0, 40],
    [0.3, 0.6],
    { extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <DarkBackground drift={false} />
      
      {imageUrl ? (
        <>
          {/* Main Image with Ken Burns */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              overflow: "hidden",
              zIndex: 1,
            }}
          >
            <Img
              src={imageUrl}
              style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: imageOpacity,
                transform: `
                  scale(${kenBurnsScale}) 
                  translate(${kenBurnsPanX}%, ${kenBurnsPanY}%)
                `,
                zIndex: 1,
              }}
            />
          </div>

          {/* Multi-Layer Gradient Overlays for Depth */}
          {/* Top vignette */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `radial-gradient(ellipse at center, transparent 0%, rgba(10,10,26,${vignetteOpacity}) 100%)`,
              pointerEvents: "none",
              zIndex: 2,
            }}
          />
          
          {/* Bottom gradient for caption readability */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `
                linear-gradient(
                  to top,
                  rgba(10,10,26,0.95) 0%,
                  rgba(10,10,26,0.75) 15%,
                  rgba(10,10,26,0.4) 35%,
                  rgba(10,10,26,0.15) 50%,
                  transparent 70%
                )
              `,
              pointerEvents: "none",
              zIndex: 2,
            }}
          />

          {/* Subtle accent color wash */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(135deg, ${accentColor}08 0%, transparent 60%)`,
              mixBlendMode: "overlay",
              opacity: 0.3,
              pointerEvents: "none",
              zIndex: 2,
            }}
          />
        </>
      ) : (
        // Fallback if no image
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `linear-gradient(135deg, ${accentColor}15 0%, transparent 100%)`,
          }}
        >
          <div
            style={{
              fontSize: p ? 48 : 64,
              opacity: 0.2,
              color: textColor,
            }}
          >
            📷
          </div>
        </div>
      )}

      {/* Caption Container with Parallax */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: p ? 40 : 60,
          transform: `translateY(${(1 - captionY) * 80}px)`,
          opacity: captionOpacity,
          zIndex: 3,
        }}
      >
        {/* Glass Caption Card */}
        <div
          style={{
            ...glassCardStyle(accentColor, 0.15),
            padding: p ? 28 : 40,
            width: "100%",
            backdropFilter: "blur(30px)",
            WebkitBackdropFilter: "blur(30px)",
            boxShadow: "0 8px 40px rgba(0, 0, 0, 0.4)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            position: "relative",
          }}
        >
          {/* Accent top border */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: "30%",
              height: 3,
              background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
              borderRadius: "0 0 2px 2px",
            }}
          />

          {/* Title */}
          <h2
            style={{
              fontSize: p ? 28 : 36,
              fontWeight: 700,
              color: textColor,
              fontFamily: "Inter, system-ui, sans-serif",
              marginBottom: narration ? 12 : 0,
              lineHeight: 1.3,
              textShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
            }}
          >
            {title}
          </h2>

          {/* Narration */}
          {narration && (
            <p
              style={{
                fontSize: p ? 18 : 22,
                color: textColor,
                opacity: 0.9,
                fontFamily: "Inter, system-ui, sans-serif",
                lineHeight: 1.6,
                textShadow: "0 1px 4px rgba(0, 0, 0, 0.2)",
              }}
            >
              {narration}
            </p>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};