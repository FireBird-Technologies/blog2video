import { AbsoluteFill, interpolate, useCurrentFrame, spring } from "remotion";
import { SceneLayoutProps } from "../types";

export const BulletList: React.FC<SceneLayoutProps> = (props) => {
  const {
    title,
    narration,
    accentColor,
    bgColor,
    textColor,
    aspectRatio,
    titleFontSize,
    descriptionFontSize,
    ...extra
  } = props;

  const { points = [] } = extra as {
    points?: { key: string; value: string }[];
  };

  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";

  const titleStyles: React.CSSProperties = {
    fontSize: titleFontSize ?? (p ? 72 : 60),
    fontWeight: 700,
    color: textColor,
    textAlign: "center",
    lineHeight: 1.2,
  };

  const shadow = "0 5px 15px rgba(0,0,0,0.1)";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        padding: p ? "80px 40px" : "100px 120px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        overflow: "hidden",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: p ? 50 : 60,
        }}
      >
        {(title) && (
          <div
            style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
          >
            {title && <div style={titleStyles}>{title}</div>}
          </div>
        )}

        <div
          style={{ display: "flex", flexDirection: "column", gap: p ? 40 : 50 }}
        >
          {points.map((point, i) => {
            const delay = 15 + i * 8;
            const itemSpring = spring({
              frame: frame - delay,
              fps,
              config: { damping: 18, stiffness: 120, mass: 1 },
            });
            const op = interpolate(itemSpring, [0, 1], [0, 1], {
              extrapolateRight: "clamp",
            });
            const x = interpolate(itemSpring, [0, 1], [-30, 0], {
              extrapolateRight: "clamp",
            });

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: p ? 16 : 24,
                  opacity: op,
                  transform: `translateX(${x}px)`,
                }}
              >
                <div
                  style={{
                    width: p ? 48 : 56,
                    height: p ? 48 : 56,
                    borderRadius: "50%",
                    backgroundColor: accentColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    boxShadow: shadow,
                  }}
                >
                  <span
                    style={{
                      color: "white",
                      fontWeight: 700,
                      fontSize: p ? 22 : 26,
                    }}
                  >
                    {i + 1}
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: p ? 10 : 14,
                    paddingTop: p ? 4 : 6,
                  }}
                >
                  <div
                    style={{
                      padding: p ? "8px 24px" : "10px 30px",
                      borderRadius: 9999,
                      background: `linear-gradient(90deg, ${accentColor} 0%, color-mix(in srgb, ${accentColor}, black 20%) 100%)`,
                      boxShadow: shadow,
                      alignSelf: "flex-start",
                    }}
                  >
                    <span
                      style={{
                        color: "white",
                        fontSize: descriptionFontSize ?? (p ? 34 : 29),
                        fontWeight: 700,
                        lineHeight: 1.3,
                        textTransform: "uppercase",
                      }}
                    >
                      {point.key}
                    </span>
                  </div>

                  {point.value && (
                    <span
                      style={{
                        color: textColor,
                        fontSize: descriptionFontSize,
                        fontWeight: 400,
                        lineHeight: 1.5,
                        paddingLeft: "12px",
                      }}
                    >
                      {point.value}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
