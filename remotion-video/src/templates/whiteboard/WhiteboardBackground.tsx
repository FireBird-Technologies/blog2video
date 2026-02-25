import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

export const WhiteboardBackground: React.FC<{ bgColor: string }> = ({ bgColor }) => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame % 180, [0, 180], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const x = Math.sin(drift * Math.PI * 2) * 6;
  const y = Math.cos(drift * Math.PI * 2) * 4;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), radial-gradient(rgba(0,0,0,0.02) 1px, transparent 1px)",
          backgroundSize: "20px 20px, 12px 12px",
          backgroundPosition: `${x}px ${y}px, ${-x}px ${-y}px`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, rgba(0,0,0,0.03), rgba(0,0,0,0))",
        }}
      />
    </AbsoluteFill>
  );
};
