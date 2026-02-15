import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { SceneLayoutProps } from "./types";

export const BulletList: React.FC<SceneLayoutProps> = ({
  title,
  accentColor,
  bgColor,
  textColor,
  bullets = [],
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const titleOp = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  // ─── Dynamic sizing based on content amount ───────────────
  const count = bullets.length;
  const avgLen =
    count > 0
      ? bullets.reduce((s, b) => s + (b as string).length, 0) / count
      : 0;

  // Scale down when there are many bullets or long text
  const dense = count > 3 || avgLen > 80;
  const veryDense = count > 5 || avgLen > 120;

  const titleSize = p
    ? veryDense ? 26 : dense ? 30 : 36
    : veryDense ? 32 : dense ? 40 : 48;

  const bulletSize = p
    ? veryDense ? 16 : dense ? 18 : 22
    : veryDense ? 18 : dense ? 22 : 28;

  const gap = p
    ? veryDense ? 10 : dense ? 14 : 20
    : veryDense ? 12 : dense ? 16 : 24;

  const badgeSize = p
    ? veryDense ? 22 : dense ? 26 : 30
    : veryDense ? 26 : dense ? 30 : 36;

  const titleMb = p
    ? veryDense ? 16 : dense ? 24 : 36
    : veryDense ? 20 : dense ? 32 : 48;

  const maxLines = veryDense ? 2 : dense ? 3 : 4;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        padding: p ? "60px 50px" : "80px 120px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -60,
          right: -60,
          width: p ? 250 : 350,
          height: p ? 250 : 350,
          borderRadius: "50%",
          border: `2px solid ${accentColor}15`,
        }}
      />
      <h2
        style={{
          color: textColor,
          fontSize: titleSize,
          fontWeight: 700,
          fontFamily: "Inter, sans-serif",
          opacity: titleOp,
          marginBottom: titleMb,
          margin: 0,
          lineHeight: 1.2,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {title}
      </h2>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap,
          overflow: "hidden",
          flex: 1,
          minHeight: 0,
        }}
      >
        {bullets.map((b, i) => {
          const delay = 20 + i * 12;
          const op = interpolate(frame, [delay, delay + 15], [0, 1], {
            extrapolateRight: "clamp",
          });
          const x = interpolate(frame, [delay, delay + 15], [-40, 0], {
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: p ? 16 : 20,
                opacity: op,
                transform: `translateX(${x}px)`,
                flexShrink: 1,
                minHeight: 0,
              }}
            >
              <div
                style={{
                  width: badgeSize,
                  height: badgeSize,
                  borderRadius: 10,
                  backgroundColor: `${accentColor}15`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                <span
                  style={{
                    color: accentColor,
                    fontWeight: 700,
                    fontSize: Math.round(badgeSize * 0.5),
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  {i + 1}
                </span>
              </div>
              <span
                style={{
                  color: textColor,
                  fontSize: bulletSize,
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 500,
                  lineHeight: 1.35,
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: maxLines,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {b}
              </span>
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: 4,
          backgroundColor: accentColor,
        }}
      />
    </AbsoluteFill>
  );
};
