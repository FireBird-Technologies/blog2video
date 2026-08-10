import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

export const Blobs: React.FC = () => {
  const frame = useCurrentFrame();

  // Slow ambient movement
  const move1 = interpolate(frame, [0, 300], [0, 60], { extrapolateRight: "extend" });
  const move2 = interpolate(frame, [0, 300], [0, -50], { extrapolateRight: "extend" });
  const move3 = interpolate(frame, [0, 300], [0, 40], { extrapolateRight: "extend" });

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#FAFAFA", zIndex: 0 }}>
       {/* Warm Blob */}
      <div
        style={{
          position: "absolute",
          top: "-10%",
          left: "-5%",
          width: "50%",
          height: "60%",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(249,115,22,0.18) 0%, transparent 70%)",
          filter: "blur(60px)",
          transform: `translate(${move1}px, ${move1 * 0.5}px)`,
        }}
      />
      {/* Cool/Yellow Blob */}
      <div
        style={{
          position: "absolute",
          bottom: "-10%",
          right: "-5%",
          width: "45%",
          height: "55%",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(251,191,36,0.15) 0%, transparent 70%)",
          filter: "blur(60px)",
          transform: `translate(${move2}px, ${move2}px)`,
        }}
      />
      {/* Center White Light */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: "30%",
          width: "40%",
          height: "40%",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 70%)",
          filter: "blur(40px)",
          transform: `translate(${move3 * -0.5}px, ${move3}px)`,
        }}
      />
    </AbsoluteFill>
  );
};
