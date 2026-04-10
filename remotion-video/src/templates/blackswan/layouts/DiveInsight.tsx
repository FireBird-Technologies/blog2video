import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Swan } from "../components/Swan";
import type { BlackswanLayoutProps } from "../types";
import { BlackswanFlock } from "./birds";
import { NeonWater } from "./neonWater";

const mono = "'IBM Plex Mono', monospace";
const display = "'Syne', sans-serif";

export const DiveInsight: React.FC<BlackswanLayoutProps> = (props) => {
  const {
    title,
    narration,
    quote,
    highlightWord,
    accentColor = "#00E5FF",
    textColor = "#DFFFFF",
    titleFontSize,
    descriptionFontSize,
    fontFamily,
    aspectRatio = "landscape",
  } = props;

  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const p = aspectRatio === "portrait";

  // Quote fades up after swan
  const quoteOp = interpolate(frame, [28, 50], [0, 1], { extrapolateRight: "clamp" });
  const quoteY  = interpolate(frame, [28, 50], [14, 0], { extrapolateRight: "clamp" });
  const eyeOp   = interpolate(frame, [32, 52], [0, 1], { extrapolateRight: "clamp" });

  const insightText = quote || narration;
  let hl = false;

  const highlighted =
    highlightWord && insightText.includes(highlightWord)
      ? insightText.replace(highlightWord, `__S__${highlightWord}__E__`)
      : insightText;
  const pieces = highlighted.split(/(__S__|__E__)/);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      {/* Bottom-centre large water ring from swan dive impact — cx:500, y:57 (570px) */}
      <NeonWater
        uid="dv6"
        cx={500}
        yPct={p ? 60 : 57}
        rxBase={100}
        ryBase={22}
        maxRx={420}
        nRings={6}
        delay={0.05}
      />

      <BlackswanFlock uid="dv-flock" cx={500} cy={560} startDelaySec={0.92} />

      {/* Swan dive — frame-synced (former bsw-dive) */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          transform: `translate(-50%, -50%) scale(${interpolate(t, [0, 0.65 * 0.85, 0.85], [0.05, 2.2, 2.2], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 0, 0.07, 1),
          })})`,
          opacity: interpolate(t, [0, 0.65 * 0.85, 0.85], [1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <Swan
          size={p ? 240 : 380}
          water={false}
          reflection={false}
          uid={`dv-swan-${p ? "p" : "l"}`}
        />
      </div>

      {/* Bottom content — bottom:140px from HTML */}
      <div
        style={{
          position: "absolute",
          bottom: p ? 80 : 140,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: p ? 12 : 16,
          padding: p ? "0 40px" : "0 100px",
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
            opacity: eyeOp,
          }}
        >
          Insight
        </div>

        {/* Quote — large centred text matching HTML font-size:38px */}
        <div
          style={{
            fontFamily: fontFamily ?? display,
            fontSize: titleFontSize ?? (p ? 26 : 38),
            fontWeight: 800,
            color: accentColor,
            textAlign: "center",
            lineHeight: 1.15,
            opacity: quoteOp,
            transform: `translateY(${quoteY}px)`,
            textShadow: `0 0 2px ${accentColor}, 0 0 8px #00AAFF18`,
            maxWidth: p ? "100%" : "680px",
          }}
        >
          {pieces.map((piece, idx) => {
            if (piece === "__S__") { hl = true; return null; }
            if (piece === "__E__") { hl = false; return null; }
            return hl ? (
              <span key={idx} style={{ color: accentColor, textShadow: `0 0 10px #00AAFF66` }}>{piece}</span>
            ) : (
              <React.Fragment key={idx}>{piece}</React.Fragment>
            );
          })}
        </div>

        {/* Narration sub-line if different from quote */}
        {title && title !== insightText && (
          <p
            style={{
              margin: 0,
              fontFamily: fontFamily ?? mono,
              fontSize: descriptionFontSize ?? (p ? 11 : 13),
              color: "#00AAFF",
              opacity: quoteOp * 0.7,
              letterSpacing: 2,
              textAlign: "center",
            }}
          >
            {title}
          </p>
        )}
      </div>
    </AbsoluteFill>
  );
};