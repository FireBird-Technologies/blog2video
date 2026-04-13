import React, { useId } from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { SWAN_PM, SWAN_PW1, SWAN_PW2 } from "../swanPaths";

const PL = 18000;

/** 11s neon flicker cycle (matches former `bsw-flicker` keyframes). */
function flickerMul(t: number, flickerDelay: number, animate: boolean): number {
  if (!animate || t < flickerDelay) return 1;
  const u = (((t - flickerDelay) % 11) + 11) % 11;
  const frac = u / 11;
  if (frac < 0.88) return 1;
  if (frac < 0.89) return interpolate(frac, [0.88, 0.89], [1, 0.18]);
  if (frac < 0.905) return interpolate(frac, [0.89, 0.905], [0.18, 1]);
  if (frac < 0.92) return interpolate(frac, [0.905, 0.92], [1, 0.48]);
  if (frac < 0.93) return interpolate(frac, [0.92, 0.93], [0.48, 1]);
  return 1;
}

export type SwanProps = {
  /** Pixel width; height follows 700×480 viewBox aspect. */
  size?: number;
  /** Overall group opacity (HTML often passes op). */
  opacity?: number;
  /** Draw-on + flicker (frame-synced). */
  animate?: boolean;
  /** HTML: water reflections + horizon lines */
  water?: boolean;
  /** HTML: vertical flip reflection under swan */
  reflection?: boolean;
  /** Stable id prefix for filters when multiple swans mount */
  uid?: string;
};

/**
 * Swan — traced PM path, two neon layers + optional PW reflections.
 * Matches reference `swan(w, { refl, water, op, uid })`.
 */
export const Swan: React.FC<SwanProps> = ({
  size = 220,
  opacity = 1,
  animate = true,
  water = true,
  reflection = true,
  uid: uidProp,
}) => {
  const reactId = useId().replace(/:/g, "");
  const uid = uidProp ?? reactId;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const w = size;
  const h = Math.round((w * 480) / 700);

  const drawDur = 2.9;
  const flickerDelay = 3.2;
  const drawProgress = animate
    ? interpolate(t, [0, drawDur], [0, 1], {
        easing: Easing.bezier(0.26, 0, 0.04, 1),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;
  const bodyDashOff = PL * (1 - drawProgress);
  const flick = flickerMul(t, flickerDelay, animate);

  const waterDashOff = bodyDashOff;

  const lineDraw = (base: number, len: number) =>
    animate
      ? len *
        (1 -
          interpolate(t, [base, base + 1.4], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.quad),
          }))
      : 0;

  const reflCycle = Math.max(0, t - 3);
  const reflGroupOp =
    0.08 + 0.08 * (0.5 - 0.5 * Math.cos((2 * Math.PI * reflCycle) / 5));

  return (
    <svg width={w} height={h} viewBox="0 0 700 480" fill="none" style={{ opacity, overflow: "visible", display: "block" }}>
      <defs>
        <filter id={`bswan-fg-${uid}`} x="-55%" y="-55%" width="210%" height="210%">
          <feGaussianBlur stdDeviation="6.5" result="b" />
          <feColorMatrix
            in="b"
            type="matrix"
            values="0 0 0 0 0  0 0.25 0.78 0 0  0 0.54 0.94 0 0  0 0 0 0.46 0"
            result="c"
          />
          <feMerge>
            <feMergeNode in="c" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`bswan-fc-${uid}`} x="-4%" y="-4%" width="108%" height="108%">
          <feGaussianBlur stdDeviation="0.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`bswan-fr-${uid}`} x="-18%" y="-18%" width="136%" height="136%">
          <feGaussianBlur stdDeviation="3.2" />
        </filter>
        <filter id={`bswan-fwl-${uid}`} x="-5%" y="-900%" width="110%" height="1900%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feColorMatrix
            in="b"
            type="matrix"
            values="0 0 0 0 0  0 0.18 0.7 0 0  0 0.5 0.92 0 0  0 0 0 0.46 0"
          />
        </filter>
        <filter id={`bswan-fcore-${uid}`} x="-4%" y="-400%" width="108%" height="900%">
          <feGaussianBlur stdDeviation="0.8" />
        </filter>
        <clipPath id={`bswan-cp-${uid}`}>
          <rect width="700" height="480" />
        </clipPath>
      </defs>

      <g clipPath={`url(#bswan-cp-${uid})`}>
        <g transform="translate(12,10) scale(0.614)">
          <path
            d={SWAN_PM}
            transform="translate(588,218)"
            stroke="#00AAFF"
            strokeWidth={4.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            filter={`url(#bswan-fg-${uid})`}
            strokeDasharray={PL}
            strokeDashoffset={bodyDashOff}
            opacity={0.54 * flick}
          />
          <path
            d={SWAN_PM}
            transform="translate(588,218)"
            stroke="#C8F6FF"
            strokeWidth={0.7}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            filter={`url(#bswan-fc-${uid})`}
            strokeDasharray={PL}
            strokeDashoffset={bodyDashOff}
            opacity={0.66 * flick}
          />

          {water ? (
            <>
              <path
                d={SWAN_PW1}
                transform="translate(428,444)"
                stroke="#00AAFF"
                strokeWidth={2.8}
                strokeLinecap="round"
                fill="none"
                filter={`url(#bswan-fg-${uid})`}
                strokeDasharray={PL}
                strokeDashoffset={waterDashOff}
              />
              <path
                d={SWAN_PW1}
                transform="translate(428,444)"
                stroke="#90EEFF"
                strokeWidth={0.55}
                strokeLinecap="round"
                fill="none"
                filter={`url(#bswan-fc-${uid})`}
                strokeDasharray={PL}
                strokeDashoffset={waterDashOff}
              />
              <path
                d={SWAN_PW2}
                transform="translate(678,490)"
                stroke="#00AAFF"
                strokeWidth={2}
                strokeLinecap="round"
                fill="none"
                filter={`url(#bswan-fg-${uid})`}
                strokeDasharray={PL}
                strokeDashoffset={waterDashOff}
              />
            </>
          ) : null}
        </g>

        {water ? (
          <>
            <line
              x1={10}
              y1={357}
              x2={690}
              y2={357}
              stroke="#00AAFF"
              strokeWidth={5.5}
              filter={`url(#bswan-fwl-${uid})`}
              opacity={0.32}
              strokeDasharray="1200 1200"
              strokeDashoffset={lineDraw(0.1, 1200)}
            />
            <line
              x1={10}
              y1={357}
              x2={690}
              y2={357}
              stroke="#88EAFF"
              strokeWidth={0.52}
              strokeDasharray="1200 1200"
              strokeDashoffset={lineDraw(0.15, 1200)}
            />
            <line
              x1={44}
              y1={367}
              x2={656}
              y2={367}
              stroke="#004488"
              strokeWidth={3}
              filter={`url(#bswan-fwl-${uid})`}
              opacity={0.14}
              strokeDasharray="1060 1060"
              strokeDashoffset={lineDraw(0.22, 1060)}
            />
          </>
        ) : null}

        {reflection ? (
          <g transform="translate(0,714) scale(1,-1)" opacity={reflGroupOp}>
            <g transform="translate(12,10) scale(0.614)">
              <path
                d={SWAN_PM}
                transform="translate(588,218)"
                stroke="#005566"
                strokeWidth={0.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                filter={`url(#bswan-fr-${uid})`}
                opacity={0.1}
              />
            </g>
          </g>
        ) : null}
      </g>
    </svg>
  );
};
