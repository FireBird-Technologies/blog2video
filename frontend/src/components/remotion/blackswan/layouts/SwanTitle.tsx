import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Swan } from "../components/Swan";
import type { BlackswanLayoutProps } from "../types";
import { BlackswanFlock } from "./birds";
import { NeonWater } from "./neonWater";
import { StarField } from "./scenePrimitives";

const mono = "'IBM Plex Mono', monospace";
const display = "'Syne', sans-serif";

export const SwanTitle: React.FC<BlackswanLayoutProps> = (props) => {
  const {
    title,
    narration,
    accentColor = "#00E5FF",
    textColor = "#DFFFFF",
    bgColor,
    titleFontSize,
    descriptionFontSize,
    fontFamily,
    aspectRatio = "landscape",
  } = props;

  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const fadeIn = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [20, 50], [20, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, overflow: "hidden" }}>
      <StarField />
      {/* Water centred under swan, cx=345 matches HTML reference */}
      <NeonWater
        uid="st"
        cx={345}
        yPct={p ? 89 : 86}
        rxBase={130}
        ryBase={28}
        maxRx={280}
        nRings={7}
        delay={0}
      />
      <BlackswanFlock uid="st-flock" cx={500} cy={402} startDelaySec={3.1} />

      {/* Swan — centred, pushed up like HTML: left:50%, top:50px */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: p ? "3%" : "5%",
          transform: "translateX(-50%)",
          opacity: fadeIn,
        }}
      >
        <Swan size={p ? 420 : 740} opacity={0.88} water={false} uid="st" />
      </div>

      {/* Bottom title block — same structure as HTML titleBlock() */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: p ? "0 28px 44px" : "0 76px 68px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: p ? 9 : 11,
          opacity: fadeIn,
          transform: `translateY(${titleY}px)`,
        }}
      >
        {/* Eyebrow */}
        <div
          style={{
            fontSize: p ? 8 : 9,
            letterSpacing: 6,
            color: "#00AAFF",
            textTransform: "uppercase",
            fontFamily: fontFamily ?? mono,
          }}
        >
          Swan Title
        </div>

        {/* Title */}
        <h1
          style={{
            margin: 0,
            fontFamily: fontFamily ?? display,
            fontSize: titleFontSize ?? (p ? 52 : 72),
            fontWeight: 800,
            color: accentColor,
            letterSpacing: 4,
            textShadow: `0 0 2px ${accentColor}, 0 0 9px #00AAFF22`,
            textTransform: "uppercase",
            lineHeight: 1.05,
            textAlign: "center",
          }}
        >
          {title}
        </h1>

        {/* Neon divider */}
        <div
          style={{
            height: 1,
            width: p ? 220 : 400,
            background: accentColor,
            boxShadow: `0 0 2px ${accentColor}, 0 0 5px #00AAFF`,
          }}
        />

        {/* Narration */}
        {narration && (
          <p
            style={{
              margin: 0,
              fontFamily: fontFamily ?? mono,
              fontSize: descriptionFontSize ?? (p ? 12 : 14),
              letterSpacing: 2,
              color: "#00AAFF",
              textAlign: "center",
              maxWidth: p ? "90%" : "60%",
              lineHeight: 1.6,
            }}
          >
            {narration}
          </p>
        )}
      </div>
    </AbsoluteFill>
  );
};