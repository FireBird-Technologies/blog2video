import { AbsoluteFill, interpolate, useCurrentFrame, spring, Img } from "remotion";
import { SceneLayoutProps } from "../types";

export const BulletList: React.FC<SceneLayoutProps & { imageUrl?: string }> = (props) => {
  const {
    title,
    accentColor,
    bgColor,
    textColor,
    aspectRatio,
    titleFontSize,
    descriptionFontSize,
    imageUrl, // New Prop
    fontFamily,
    ...extra
  } = props;

  const { points = [] } = extra as {
    points?: { key: string; value: string }[];
  };

  const frame = useCurrentFrame();
  const { fps } = { fps: 30 };
  const p = aspectRatio === "portrait";

  // Animation for the Image
  const imageSpring = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 100 },
  });
  
  const imageScale = interpolate(imageSpring, [0, 1], [1.1, 1]);
  const imageOpacity = interpolate(frame, [0, 15], [0, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, fontFamily: fontFamily ?? "'Roboto Slab', serif", overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          flexDirection: p ? "column" : "row",
          width: "100%",
          height: "100%",
        }}
      >
        {/* --- LEFT/TOP SIDE: IMAGE SECTION --- */}
        {imageUrl && (
          <div
            style={{
              flex: 1,
              position: "relative",
              overflow: "hidden",
              opacity: imageOpacity,
              transform: `scale(${imageScale})`,
              boxShadow: "0 0 50px rgba(0,0,0,0.2)",
              zIndex: 1,
            }}
          >
            <Img
              src={imageUrl}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
            {/* Subtle Gradient Overlay to blend with text side */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: p 
                ? `linear-gradient(to bottom, transparent 80%, ${bgColor} 100%)`
                : `linear-gradient(to right, transparent 80%, ${bgColor} 100%)`
            }} />
          </div>
        )}

        {/* --- RIGHT/BOTTOM SIDE: CONTENT SECTION --- */}
        <div
          style={{
            flex: 1.2,
            padding: p ? "40px 60px" : "80px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            zIndex: 2,
          }}
        >
          {title && (
            <h2
              style={{
                fontSize: titleFontSize ?? (p ? 60 : 52),
                fontWeight: 800,
                color: textColor,
                marginBottom: 40,
                textAlign: p ? "center" : "left",
                lineHeight: 1.1,
                letterSpacing: "-0.02em"
              }}
            >
              {title}
            </h2>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
            {points.map((point, i) => {
              const delay = 20 + i * 10;
              const itemSpring = spring({
                frame: frame - delay,
                fps,
                config: { damping: 15, stiffness: 100 },
              });

              const entranceX = interpolate(itemSpring, [0, 1], [40, 0]);
              const entranceOpacity = interpolate(itemSpring, [0, 1], [0, 1]);

              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 20,
                    opacity: entranceOpacity,
                    transform: `translateX(${entranceX}px)`,
                  }}
                >
                  {/* Bullet Number with Glow */}
                  <div
                    style={{
                      width: 45,
                      height: 45,
                      borderRadius: 12,
                      backgroundColor: accentColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      boxShadow: `0 10px 20px ${accentColor}44`,
                      color: "white",
                      fontWeight: 800,
                      fontSize: 22,
                    }}
                  >
                    {i + 1}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div
                      style={{
                        fontSize: descriptionFontSize ? descriptionFontSize * 1.1 : 32,
                        fontWeight: 700,
                        color: accentColor,
                        textTransform: "uppercase",
                        letterSpacing: "1px"
                      }}
                    >
                      {point.key}
                    </div>
                    {point.value && (
                      <div
                        style={{
                          fontSize: descriptionFontSize ?? (p ? 37 : 29),
                          color: textColor,
                          opacity: 0.9,
                          lineHeight: 1.4,
                          maxWidth: "90%"
                        }}
                      >
                        {point.value}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};