import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  DOCREEL_DISPLAY_FONT,
  DocReelScene,
  DEFAULT_DOCREEL_ERA,
  useDocReelTheme,
} from "../docReelStyle";

/**
 * Old-camera countdown leader (SMPTE-style academy leader): dense concentric
 * rings, a full crosshair through center, a sweeping clock tick, tick marks
 * around the rim, and Courier Prime lab labels — matching the reference
 * newsreel countdown card (heavy circles, bold centered number, worn film look).
 *
 * `sweepFrames` is how many frames one full rotation of the hand takes; the
 * scene passes its per-number tick length so the hand completes exactly one
 * sweep per number, the way a real leader's clock hand does.
 */
const CountdownLeader: React.FC<{ number: number; size: number; sweepFrames: number }> = ({
  number,
  size,
  sweepFrames,
}) => {
  const theme = useDocReelTheme();
  const frame = useCurrentFrame();
  const sweep = interpolate(frame % sweepFrames, [0, sweepFrames], [0, 360]);
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 6;
  const ringRadii = [rOuter, rOuter * 0.82, rOuter * 0.6];
  const tickEnd = {
    x: cx + rOuter * Math.cos(((sweep - 90) * Math.PI) / 180),
    y: cy + rOuter * Math.sin(((sweep - 90) * Math.PI) / 180),
  };
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Outer frame */}
      <rect x={2} y={2} width={size - 4} height={size - 4} fill="none" stroke={theme.text} strokeWidth={3} opacity={0.55} />
      {/* Concentric rings */}
      {ringRadii.map((r, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={theme.text} strokeWidth={i === 0 ? 4 : 2.5} opacity={0.75 - i * 0.1} />
      ))}
      {/* Full crosshair (both diagonals + vertical/horizontal), matching an academy leader */}
      <line x1={cx} y1={4} x2={cx} y2={size - 4} stroke={theme.text} strokeWidth={2.5} opacity={0.6} />
      <line x1={4} y1={cy} x2={size - 4} y2={cy} stroke={theme.text} strokeWidth={2.5} opacity={0.6} />
      <line x1={cx - rOuter * 0.7} y1={cy - rOuter * 0.7} x2={cx + rOuter * 0.7} y2={cy + rOuter * 0.7} stroke={theme.text} strokeWidth={1.8} opacity={0.4} />
      <line x1={cx + rOuter * 0.7} y1={cy - rOuter * 0.7} x2={cx - rOuter * 0.7} y2={cy + rOuter * 0.7} stroke={theme.text} strokeWidth={1.8} opacity={0.4} />
      {/* Sweeping clock tick */}
      <line x1={cx} y1={cy} x2={tickEnd.x} y2={tickEnd.y} stroke={theme.accent} strokeWidth={5} opacity={1} />
      <circle cx={cx} cy={cy} r={7} fill={theme.accent} />
      {/* Rim tick marks, every 30deg */}
      {Array.from({ length: 12 }, (_, i) => {
        const a = ((i * 30 - 90) * Math.PI) / 180;
        return (
          <line
            key={i}
            x1={cx + (rOuter - 14) * Math.cos(a)}
            y1={cy + (rOuter - 14) * Math.sin(a)}
            x2={cx + rOuter * Math.cos(a)}
            y2={cy + rOuter * Math.sin(a)}
            stroke={theme.text}
            strokeWidth={3.5}
            opacity={0.7}
          />
        );
      })}
      <text
        x={cx}
        y={cy + size * 0.16}
        textAnchor="middle"
        fontFamily={DOCREEL_DISPLAY_FONT}
        fontWeight={700}
        fontSize={size * 0.38}
        fill={theme.accent}
        stroke={theme.accent}
        strokeWidth={size * 0.008}
      >
        {number}
      </text>
    </svg>
  );
};

/** Frames each number holds for — one second per tick at 30fps, so the full
 *  3-2-1 leader runs ~3s. Also drives one full clock-hand sweep per number. */
const TICK_FRAMES = 30;
const COUNT_FROM = 3;

/**
 * Academy leader countdown — a standalone silent opening scene.
 *
 * This is a SYSTEM-OWNED scene: the pipeline force-injects it as scene 0 of
 * every documentary video and the LLM never writes it, so it carries no
 * narration and renders no title/body text. It used to be an 18-frame
 * flourish inside DocreelSlate; it was promoted to its own scene so the reel
 * gets a real 3-2-1 leader before the clapperboard slate.
 */
export const DocreelCountdown: React.FC<SceneLayoutProps> = (props) => {
  const theme = useDocReelTheme();
  const { bgColor, aspectRatio, sceneDurationInFrames, era, countdownFrom } = props;

  const p = aspectRatio === "portrait";
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  // Editable in the studio; clamped so a stray value can't produce a 0-length
  // or absurdly long leader.
  const countFrom = Math.max(1, Math.min(10, Math.round(Number(countdownFrom) || COUNT_FROM)));
  const dur = sceneDurationInFrames ?? TICK_FRAMES * countFrom;
  const activeEra = era ?? DEFAULT_DOCREEL_ERA;

  // 3 → 2 → 1, one number per TICK_FRAMES, clamped so the dial never shows 0
  // if the scene happens to run longer than the leader itself.
  const countdownNumber = Math.max(1, countFrom - Math.floor(frame / TICK_FRAMES));
  const size = p ? width * 0.5 : width * 0.22;

  return (
    <DocReelScene bgColor={bgColor} dur={dur} era={activeEra} textures={["dust_scratches"]} sprockets>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ position: "relative" }}>
          <CountdownLeader number={countdownNumber} size={size} sweepFrames={TICK_FRAMES} />
        </div>
      </div>
    </DocReelScene>
  );
};
