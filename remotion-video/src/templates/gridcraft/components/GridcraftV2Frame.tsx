import React from "react";
import { AbsoluteFill } from "remotion";
import { COLORS } from "../utils/styles";

export const GridcraftV2Frame: React.FC<{
  bgColor?: string;
  children: React.ReactNode;
}> = ({ bgColor, children }) => (
  <AbsoluteFill style={{ backgroundColor: bgColor || COLORS.BG, overflow: "hidden" }}>
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: "5%",
        border: "1px solid rgba(107,114,128,0.12)",
        pointerEvents: "none",
      }}
    >
      {Array.from({ length: 11 }, (_, index) => (
        <span
          key={index}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${((index + 1) / 12) * 100}%`,
            width: 1,
            backgroundColor: "rgba(107,114,128,0.045)",
          }}
        />
      ))}
    </div>
    <div style={{ position: "relative", width: "100%", height: "100%", zIndex: 1 }}>{children}</div>
  </AbsoluteFill>
);
