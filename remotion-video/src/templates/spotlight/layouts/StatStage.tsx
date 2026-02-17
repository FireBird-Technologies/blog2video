import { AbsoluteFill, interpolate, useCurrentFrame, spring } from "remotion";
import type { SpotlightLayoutProps } from "../types";

const SLAM = { stiffness: 200, damping: 12, mass: 1 } as const;

export const StatStage: React.FC<SpotlightLayoutProps> = ({
  metrics = [],
  narration,
  accentColor,
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";

  const primary = metrics[0];
  const numeric = primary
    ? parseFloat(primary.value.replace(/[^0-9.-]/g, "")) || 0
    : 0;

  const animatedNum = interpolate(frame, [0, 25], [0, numeric], {
    extrapolateRight: "clamp",
  });

  const numS = spring({ frame, fps, config: SLAM });
  const numScale = numS;

  const cardOp = interpolate(frame, [35, 50], [0, 1], { extrapolateRight: "clamp" });

  const sec = metrics[1];
  const secOp = interpolate(frame, [55, 68], [0, 1], { extrapolateRight: "clamp" });

  const fmt = (n: number) => Math.floor(n).toLocaleString();

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? 48 : 100,
        }}
      >
        {primary && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                transform: `scale(${numScale})`,
              }}
            >
              <span
                style={{
                  fontSize: p ? 120 : 180,
                  fontWeight: 900,
                  fontFamily: "Inter, system-ui, sans-serif",
                  color: "#FFFFFF",
                  lineHeight: 1,
                  letterSpacing: "-0.04em",
                }}
              >
                {fmt(animatedNum)}
              </span>
              {primary.suffix && (
                <span
                  style={{
                    fontSize: p ? 60 : 90,
                    fontWeight: 900,
                    fontFamily: "Inter, system-ui, sans-serif",
                    color: accentColor,
                    lineHeight: 1,
                    marginLeft: 10,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {primary.suffix}
                </span>
              )}
            </div>

            <div
              style={{
                marginTop: 44,
                opacity: cardOp,
                backgroundColor: "rgba(255,255,255,0.06)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                border: "1px solid rgba(255,255,255,0.10)",
                padding: p ? "18px 36px" : "22px 56px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: p ? 19 : 24,
                  fontWeight: 700,
                  fontFamily: "Inter, system-ui, sans-serif",
                  color: "#FFFFFF",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {primary.label}
              </div>
              {narration && (
                <div
                  style={{
                    fontSize: p ? 14 : 16,
                    fontWeight: 400,
                    fontFamily: "Inter, system-ui, sans-serif",
                    color: "rgba(255,255,255,0.55)",
                    marginTop: 6,
                  }}
                >
                  {narration}
                </div>
              )}
            </div>
          </>
        )}

        {sec && (
          <div
            style={{
              marginTop: 32,
              opacity: secOp,
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <span
              style={{
                fontSize: p ? 38 : 52,
                fontWeight: 700,
                color: "#FFFFFF",
                fontFamily: "Inter, system-ui, sans-serif",
                letterSpacing: "-0.02em",
              }}
            >
              {sec.value}{sec.suffix || ""}
            </span>
            <span
              style={{
                fontSize: p ? 16 : 20,
                fontWeight: 600,
                color: "#555555",
                fontFamily: "Inter, system-ui, sans-serif",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {sec.label}
            </span>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
