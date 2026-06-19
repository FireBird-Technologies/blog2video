import React from "react";

interface MagazinePageDepthProps {
  /** "single" = spine shadow on the left; "spread" = spine in the center. */
  variant?: "single" | "spread";
}

/**
 * Adds physical depth to an otherwise flat white page: a stack of page edges
 * down the right and bottom (the thickness of the magazine block), a gentle
 * full-page bow shadow so the sheet looks curved rather than dead flat, and a
 * soft spine shadow. Purely decorative, sits behind chrome but above the bg.
 */
export const MagazinePageDepth: React.FC<MagazinePageDepthProps> = ({
  variant = "single",
}) => {
  // Right-edge page stack — progressively lighter, offset outward.
  const rightStack = [
    { off: 0, w: 3, c: "rgba(0,0,0,0.10)" },
    { off: 3, w: 2.5, c: "rgba(0,0,0,0.07)" },
    { off: 5.5, w: 2, c: "rgba(0,0,0,0.05)" },
    { off: 7.5, w: 1.5, c: "rgba(0,0,0,0.035)" },
  ];
  const bottomStack = [
    { off: 0, h: 3, c: "rgba(0,0,0,0.09)" },
    { off: 3, h: 2.5, c: "rgba(0,0,0,0.06)" },
    { off: 5.5, h: 2, c: "rgba(0,0,0,0.04)" },
  ];

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }}>
      {/* Gentle page-bow shadow: darker toward edges/binding, lifted in the body */}
      <div style={{
        position: "absolute",
        inset: 0,
        background:
          variant === "spread"
            ? "radial-gradient(ellipse 120% 90% at 50% 50%, transparent 55%, rgba(0,0,0,0.035) 100%), linear-gradient(to right, transparent 47%, rgba(0,0,0,0.05) 50%, transparent 53%)"
            : "radial-gradient(ellipse 115% 95% at 62% 45%, transparent 60%, rgba(0,0,0,0.04) 100%)",
      }} />

      {/* Spine shadow */}
      {variant === "single" ? (
        <div style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: "6%",
          background: "linear-gradient(to right, rgba(0,0,0,0.06) 0%, transparent 100%)",
        }} />
      ) : (
        <div style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: "50%",
          width: 28,
          transform: "translateX(-50%)",
          background: "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.07) 50%, transparent 100%)",
        }} />
      )}

      {/* Right-edge page stack */}
      {rightStack.map((s, i) => (
        <div key={`r-${i}`} style={{
          position: "absolute",
          top: `${1 + i * 0.4}%`,
          right: -s.off,
          width: s.w,
          height: `${100 - i * 0.8}%`,
          background: s.c,
          borderRadius: 1,
        }} />
      ))}

      {/* Bottom-edge page stack */}
      {bottomStack.map((s, i) => (
        <div key={`b-${i}`} style={{
          position: "absolute",
          left: `${1 + i * 0.4}%`,
          bottom: -s.off,
          height: s.h,
          width: `${100 - i * 0.8}%`,
          background: s.c,
          borderRadius: 1,
        }} />
      ))}
    </div>
  );
};
