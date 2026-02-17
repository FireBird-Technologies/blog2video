import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import type { SpotlightLayoutProps } from "../types";

export const SpotlightImage: React.FC<SpotlightLayoutProps> = ({
  title,
  narration,
  imageUrl,
  accentColor,
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const spotR = interpolate(frame, [0, 22], [0, 140], { extrapolateRight: "clamp" });
  const fadeEdge = 28;

  const zoom = interpolate(frame, [0, 150], [1.0, 1.04], { extrapolateRight: "clamp" });

  const captionOp = interpolate(frame, [24, 40], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [24, 40], [12, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      {imageUrl && (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
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

      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 50% 45%, transparent ${spotR}%, rgba(0,0,0,0.94) ${spotR + fadeEdge}%)`,
          pointerEvents: "none",
        }}
      />

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
        <div style={{ transform: `translateY(${titleY}px)` }}>
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
