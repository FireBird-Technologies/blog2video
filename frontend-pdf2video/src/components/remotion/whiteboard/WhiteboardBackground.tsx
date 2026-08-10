import { AbsoluteFill } from "remotion";

export const WhiteboardBackground: React.FC<{ bgColor: string }> = ({ bgColor }) => (
  <AbsoluteFill style={{ backgroundColor: bgColor }}>
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage:
          "radial-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), radial-gradient(rgba(0,0,0,0.02) 1px, transparent 1px)",
        backgroundSize: "20px 20px, 12px 12px",
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
