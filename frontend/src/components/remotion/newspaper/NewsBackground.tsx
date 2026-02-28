import React from "react";

// Served from public/ so it loads reliably in Remotion Player and preview
const VINTAGE_NEWS_BG = "/vintage-news.avif";

/**
 * Editorial paper background for all newspaper components.
 * - Warm white base
 * - Vintage newspaper image (low opacity) + stronger overlay for subdued look
 * - Paper grain on top
 */
export const NewsBackground: React.FC<{ bgColor?: string }> = ({
  bgColor = "#FAFAF8",
}) => (
  <div style={{ position: "absolute", inset: 0, background: bgColor }}>
    {/* Layer 1 — Vintage newspaper texture, low opacity */}
    <img
      src={VINTAGE_NEWS_BG}
      alt=""
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: "center",
        opacity: 0.38,
        filter: "grayscale(75%) contrast(1.08)",
        pointerEvents: "none",
      }}
    />

    {/* Layer 2 — Stronger overlay so image stays subtle */}
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        background:
          "linear-gradient(135deg, rgba(235, 225, 210, 0.42) 0%, rgba(245, 238, 225, 0.38) 50%, rgba(225, 215, 195, 0.42) 100%)",
        pointerEvents: "none",
      }}
    />

    {/* Layer 3 — Paper grain */}
    <svg
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      aria-hidden
    >
      <defs>
        <filter id="nbg_grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="4" stitchTiles="stitch" result="noise" />
          <feColorMatrix type="saturate" values="0" in="noise" result="gray" />
          <feComponentTransfer in="gray" result="faded">
            <feFuncA type="linear" slope="0.022" />
          </feComponentTransfer>
          <feComposite in="faded" in2="SourceGraphic" operator="over" />
        </filter>
      </defs>
      <rect width="100%" height="100%" filter="url(#nbg_grain)" fill="white" />
    </svg>
  </div>
);
