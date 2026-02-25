import React from "react";

/**
 * Clean editorial paper background.
 */
export const NewsBackground: React.FC<{ bgColor?: string }> = ({
  bgColor = "#FAFAF8",
}) => (
  <div style={{ position: "absolute", inset: 0, background: bgColor }}>
    <svg
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      aria-hidden
    >
      <defs>
        <filter id="nbg_grain_nv" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="4" stitchTiles="stitch" result="noise" />
          <feColorMatrix type="saturate" values="0" in="noise" result="gray" />
          <feComponentTransfer in="gray" result="faded">
            <feFuncA type="linear" slope="0.022" />
          </feComponentTransfer>
          <feComposite in="faded" in2="SourceGraphic" operator="over" />
        </filter>
      </defs>
      <rect width="100%" height="100%" filter="url(#nbg_grain_nv)" fill="white" />
    </svg>
  </div>
);
