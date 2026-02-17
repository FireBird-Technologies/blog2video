import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import type { SpotlightLayoutProps } from "../types";

/**
 * SpotlightImage — Image revealed from darkness.
 *
 * Image starts invisible (pure black). A circular spotlight vignette expands
 * from center over 20 frames, revealing the image outward. A slow push-in
 * zoom (1.0→1.04) adds cinematic weight.
 *
 * Exception: has both blur (caption strip) AND no border-radius — per spec.
 */
export const SpotlightImage: React.FC<SpotlightLayoutProps> = ({
  title,
  narration,
  imageUrl,
  accentColor,
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  // Spotlight radius expands from 0% to 140% (beyond edges = fully revealed)
  const spotR = interpolate(frame, [0, 22], [0, 140], { extrapolateRight: "clamp" });
  const fadeEdge = 28; // transition softness

  // Slow cinematic zoom
  const zoom = interpolate(frame, [0, 150], [1.0, 1.04], { extrapolateRight: "clamp" });

  // Caption strip fades in after reveal
  const captionOp = interpolate(frame, [24, 40], [0, 1], { extrapolateRight: "clamp" });

  // Title text inside caption slides up
  const titleY = interpolate(frame, [24, 40], [12, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      {/* Image with slow zoom */}
      {imageUrl && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
          }}
        >
          <Img
            src={imageUrl}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              transform: `scale(${zoom})`,
            }}
          />
        </div>
      )}

      {/* Vignette overlay — dark edges, spotlight center expanding */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 50% 45%, transparent ${spotR}%, rgba(0,0,0,0.94) ${spotR + fadeEdge}%)`,
          pointerEvents: "none",
        }}
      />

      {/* Caption strip — full width frosted glass at bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          opacity: captionOp,
          backgroundColor: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          borderTop: `2px solid ${accentColor}`,
          padding: p ? "18px 40px" : "22px 64px",
        }}
      >
        <div
          style={{
            transform: `translateY(${titleY}px)`,
          }}
        >
          <div
            style={{
              fontSize: p ? 19 : 24,
              fontWeight: 700,
              fontFamily: "Inter, system-ui, sans-serif",
              color: "#FFFFFF",
              textTransform: "uppercase",
              letterSpacing: "0.02em",
            }}
          >
            {title}
          </div>
          {narration && (
            <div
              style={{
                fontSize: p ? 13 : 15,
                fontWeight: 400,
                fontFamily: "Inter, system-ui, sans-serif",
                color: "rgba(255,255,255,0.6)",
                marginTop: 5,
              }}
            >
              {narration}
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
