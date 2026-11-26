/**
 * snowball_steps — 2 or 3 ordered steps ("Snowball Steps"; at most 3 are drawn).
 *
 * Outdoors on the snowy day. A cozy snowman (green beanie, scarf and red mittens)
 * builds himself on the left and points with his stick arm at the steps — the arm
 * swings to aim at each ball as it arrives. Each step is a snowball of its own size
 * (largest nearest the snowman) that rolls in from the right along the ground,
 * spinning (no number on it yet), leaving a short groove in the snow, and stops in
 * its spot with a little squash — then its number pops on.
 *  - Landscape: the balls sit in a row on the ground; each step's label + text
 *    appear on a snow-foam cushion directly ABOVE its ball once it stops.
 *  - Portrait (too narrow for columns): the step texts stack above the ball row,
 *    each with a small numbered snowball badge matching its ball.
 * The Title is the heading. Exit: the snow gust.
 *
 * Mirror byte-identical in all three trees.
 */
import React from "react";
import { AbsoluteFill, Easing, interpolate } from "remotion";
import type { SceneLayoutProps } from "../types";
import { clamp, FESTIVE, mix, withOpacity, type WinterPalette } from "../christmasStyle";
import { getChristmasTypography } from "../typography";
import { ease, pop, useChristmasScene } from "../components/sceneKit";
import { FitText } from "../components/FitText";
import { probeStyle, useNaturalChildHeights } from "../components/useNaturalHeight";
import { WinterBackdrop } from "../components/WinterBackdrop";
import { LayeredSnow } from "../components/Snowfall";
import { Snowman, snowmanPoint } from "../components/Snowman";
import { SnowFoam } from "../components/SnowPoints";
import { SnowClearIn, SnowGustExit } from "../components/SnowGustExit";

/**
 * A rolling snowball. `rotation` in degrees; `squash` ≥ 0. The step number only
 * appears (pops on) once the ball has stopped — `numberIn` 0→1.
 */
const Snowball: React.FC<{
  size: number;
  rotation: number;
  squash: number;
  numberIn?: number;
  pal: WinterPalette;
  number: number;
  numberPx: number;
  font: string;
  weight: number;
}> = ({ size, rotation, squash, numberIn = 1, pal, number, numberPx, font, weight }) => {
  const id = React.useId().replace(/:/g, "");
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <div
        style={{
          position: "absolute",
          left: size * 0.08,
          right: size * 0.08,
          bottom: -size * 0.06,
          height: size * 0.16,
          borderRadius: "50%",
          background: withOpacity(pal.snowShade, 0.85),
        }}
      />
      {/* squash pivots on the ground contact point; the spin pivots on the centre */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${1 + squash}, ${1 - squash})`,
          transformOrigin: "50% 100%",
        }}
      >
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `rotate(${rotation.toFixed(2)}deg)`,
          transformOrigin: "50% 50%",
        }}
      >
        <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: "absolute", inset: 0 }}>
          <defs>
            <radialGradient id={`ball-${id}`} cx="0.36" cy="0.3" r="0.78">
              <stop offset="0" stopColor={FESTIVE.snow} />
              <stop offset="0.62" stopColor={mix(FESTIVE.snow, pal.snowShade, 0.28)} />
              <stop offset="1" stopColor={pal.snowShade} />
            </radialGradient>
          </defs>
          <circle cx={50} cy={50} r={47} fill={`url(#ball-${id})`} stroke={mix(pal.snowShade, "#5d7891", 0.25)} strokeWidth={2} />
          {/* a few packed-snow lumps so the roll reads */}
          <circle cx={30} cy={64} r={5} fill={withOpacity(pal.snowShade, 0.45)} />
          <circle cx={70} cy={30} r={4} fill={withOpacity(pal.snowShade, 0.4)} />
          <circle cx={66} cy={72} r={3} fill={withOpacity(pal.snowShade, 0.4)} />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: font,
            fontWeight: weight,
            fontSize: numberPx,
            lineHeight: 1,
            color: pal.accent,
            textShadow: `0 2px 0 ${FESTIVE.snow}`,
            opacity: Math.min(1, numberIn * 2),
            transform: `scale(${numberIn})`,
          }}
        >
          {numberIn > 0 ? number : null}
        </div>
      </div>
      </div>
    </div>
  );
};

export const SnowballSteps: React.FC<SceneLayoutProps> = (props) => {
  const { frame, width, height, portrait, pal, fonts, pad, exit, seed, total } = useChristmasScene(props);
  const p = portrait;
  // Default sizes — must match backend/templates/christmas/meta.json; Template Studio rewrites these literals.
  const type = getChristmasTypography(props, (titleFontSize, descriptionFontSize) => ({
    title: titleFontSize ?? (p ? 92 : 80),
    body: descriptionFontSize ?? (p ? 36 : 32),
  }));
  const heading = (props.title || "").trim();
  const steps = (props.steps || [])
    .map((s) => ({ label: String(s?.label ?? "").trim(), text: String(s?.text ?? "").trim() }))
    .filter((s) => s.label || s.text)
    .slice(0, 3);
  const n = Math.max(1, steps.length);

  const contentW = width - pad.x * 2;
  const headH = portrait ? height * 0.1 : height * 0.13;
  const groundY = portrait ? height - pad.bottom + 30 : height - pad.bottom + 20; // balls rest here
  const labelPx = type.bodyRelative(portrait ? 32 : 30);

  // ── Snowman (left)
  const snowH = portrait ? height * 0.26 : height * 0.68;
  const snowLeft = pad.x - (portrait ? 40 : 50);
  const snowTop = groundY + snowH * 0.03 - snowH;
  const shoulder = snowmanPoint(snowH, 214, 196);
  const shoulderX = snowLeft + shoulder.x;
  const shoulderY = snowTop + shoulder.y;
  const snowW = (snowH * 300) / 460;

  // ── Ball row on the ground (right of the snowman)
  const rowX = portrait ? snowLeft + snowW + 10 : width * 0.3;
  const rowW = width - pad.x - rowX;
  const slotW = rowW / n;
  const SIZES = [1, 0.8, 0.64];
  const baseD = Math.min(slotW * (portrait ? 0.86 : 0.62), portrait ? 200 : 250);
  const balls = steps.map((_, j) => {
    const d = baseD * SIZES[j];
    const cx = rowX + slotW * (j + 0.5);
    return { d, cx, left: cx - d / 2, top: groundY - d };
  });

  // ── Timing: each ball rolls in after the previous one stops.
  const span = Math.max(22, Math.min(40, (total * 0.5) / n));
  const stepStart = (j: number) => 34 + j * span;
  const ROLL = 26;
  const build = interpolate(frame, [2, 40], [0, 1], clamp);
  const headIn = ease(frame, 2, 24);

  // The pointing arm aims at the ball that has most recently arrived.
  const aim = (j: number) => {
    const b = balls[j];
    return (Math.atan2(b.top + b.d * 0.4 - shoulderY, b.left - shoulderX) * 180) / Math.PI;
  };
  const aimFrames = steps.map((_, j) => stepStart(j) + ROLL * 0.7);
  const aimAngles = steps.map((_, j) => aim(j));
  const pointAngle =
    steps.length >= 2
      ? interpolate(frame, aimFrames, aimAngles, { ...clamp, easing: Easing.inOut(Easing.quad) })
      : aimAngles[0] ?? -10;

  // ── Text placement
  const textTop = pad.top + headH + (portrait ? 20 : 16);
  // Portrait: stacked blocks above the row — ending above the snowman's hat (his
  // top is the tallest thing on the ground), so no card ever sits behind him.
  const stackBottom = Math.min(groundY - baseD - 40, snowTop + snowmanPoint(snowH, 150, -30).y - 24);
  const stackSlot = (stackBottom - textTop) / n;
  const stackH = Math.min(stackSlot, 300);

  // ── Boxes grow to fit their step's text at the chosen sizes (never past their
  // limit: the title above / the ball below in landscape, their slot in portrait);
  // text only shrinks once a box can grow no further.
  const innerPadX = portrait ? 30 : 34;
  const badgeMax = 78;
  const probeW = portrait ? contentW - innerPadX * 2 - badgeMax - 18 : slotW * 0.96 - innerPadX * 2;
  const probeRef = React.useRef<HTMLDivElement>(null);
  const naturals = useNaturalChildHeights(probeRef, [
    steps.map((s) => `${s.label}\u0001${s.text}`).join("\u0002"),
    type.body,
    labelPx,
    probeW,
    fonts.body,
  ]);
  // Foam content area is ~90% of the box minus its bubbly edges.
  const boxFor = (j: number, designH: number, maxH: number) => {
    const needed = ((naturals[j] ?? 0) + 50) / 0.9;
    return Math.max(Math.min(designH, maxH), Math.min(maxH, needed));
  };

  return (
    <AbsoluteFill style={{ overflow: "hidden", color: pal.ink }}>
      <WinterBackdrop pal={pal} seed={seed + 10} horizon={portrait ? 0.78 : 0.74} />
      <LayeredSnow portrait={portrait} seed={seed} layer="back" density={0.7} />

      <div style={{ position: "absolute", left: pad.x, top: pad.top, width: contentW, height: headH, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", opacity: headIn }}>
        <FitText
          targetPx={type.title}
          minPx={portrait ? 42 : 36}
          maxHeightPx={headH}
          maxWidthPx={contentW}
          fitKey={`ss-head:${heading}:${portrait}`}
          exact={type.titleIsUserSet}
          style={{ fontFamily: fonts.title, fontWeight: fonts.titleWeight, lineHeight: 1.05, color: pal.accent, textShadow: `0 2px 0 ${FESTIVE.snow}` }}
        >
          {heading}
        </FitText>
      </div>

      {steps.map((s, j) => {
        const b = balls[j];
        const start = stepStart(j);
        const textIn = pop(frame, start + ROLL - 4, start + ROLL + 14);
        // Landscape: a column above the ball. Portrait: a stacked row above the ball row.
        const portraitH = portrait ? boxFor(j, stackH, stackSlot) : 0;
        const box = portrait
          ? { left: pad.x, top: textTop + stackSlot * j + (stackSlot - portraitH) / 2, width: contentW, height: portraitH }
          : (() => {
              // Sits just above its ball (capped height, so it hugs the ball).
              const h = boxFor(j, 320, b.top - 24 - textTop);
              return { left: b.cx - slotW * 0.48, top: b.top - 24 - h, width: slotW * 0.96, height: h };
            })();
        const badge = portrait ? Math.min(badgeMax, box.height * 0.5) : 0;
        return (
          <div
            key={`t${j}`}
            style={{
              position: "absolute",
              ...box,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: interpolate(textIn, [0, 0.3], [0, 1], clamp),
              transform: `translateY(${(1 - textIn) * 24}px)`,
            }}
          >
            <SnowFoam width={box.width} height={box.height * 0.9} top={box.height * 0.05} seed={seed + j * 13} pal={pal} frame={frame} puff={textIn} />
            <div
              style={{
                position: "relative",
                width: box.width - innerPadX * 2,
                display: "flex",
                alignItems: "center",
                gap: 18,
                justifyContent: portrait ? "flex-start" : "center",
              }}
            >
              {portrait ? (
                <Snowball size={badge} rotation={0} squash={0} pal={pal} number={j + 1} numberPx={badge * 0.52} font={fonts.title} weight={fonts.titleWeight} />
              ) : null}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, textAlign: portrait ? "left" : "center", alignItems: portrait ? "flex-start" : "center" }}>
                {s.label ? (
                  <FitText
                    targetPx={labelPx}
                    minPx={Math.min(labelPx, 16)}
                    maxHeightPx={labelPx * 2.4}
                    maxWidthPx={box.width - innerPadX * 2 - (portrait ? badge + 18 : 0)}
                    fitKey={`ss-label:${j}:${s.label}:${portrait}:${n}`}
                    style={{ fontFamily: fonts.body, fontWeight: 800, lineHeight: 1.1, color: pal.accent, width: "auto" }}
                  >
                    {s.label}
                  </FitText>
                ) : null}
                {s.text ? (
                  <FitText
                    targetPx={type.body}
                    minPx={portrait ? 20 : 18}
                    maxHeightPx={Math.max(30, box.height * 0.9 - 50 - (s.label ? labelPx * 1.2 : 0))}
                    maxWidthPx={box.width - innerPadX * 2 - (portrait ? badge + 18 : 0)}
                    fitKey={`ss-step:${j}:${s.label}:${s.text}:${portrait}:${n}`}
                    exact={type.bodyIsUserSet}
                    style={{ fontFamily: fonts.body, fontWeight: 600, lineHeight: 1.3, color: pal.ink }}
                  >
                    {s.text}
                  </FitText>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}

      {/* the snowman, pointing at the balls */}
      <Snowman
        frame={frame}
        accent={pal.accent}
        build={build}
        pose="point"
        pointAngle={pointAngle}
        outfit="cozy"
        shade={pal.snowShade}
        height={snowH}
        style={{ position: "absolute", left: snowLeft, top: snowTop }}
      />

      {/* snowballs rolling in along the ground from the right, then stopping */}
      {steps.map((_, j) => {
        const b = balls[j];
        const start = stepStart(j);
        const roll = ease(frame, start, start + ROLL, Easing.out(Easing.cubic));
        const x = interpolate(roll, [0, 1], [width + b.d * 0.2, b.left]);
        // Rolling without slipping while moving LEFT: it turns counter-clockwise by
        // distance / radius, ending upright when it stops.
        const rotation = (((x - b.left) / (b.d / 2)) * 180) / Math.PI;
        const landed = frame - (start + ROLL);
        const squash = landed > 0 ? 0.08 * Math.exp(-landed / 5) * Math.cos(landed / 1.6) : 0;
        // Number pops onto the ball only after it has stopped.
        const numberIn = pop(frame, start + ROLL + 2, start + ROLL + 14);
        // A short groove pressed into the snow behind the ball, fading after it stops.
        const trailLen = Math.min(width + b.d - x, b.d * 2.2) * (frame >= start ? 1 : 0);
        const trailFade = interpolate(landed, [0, 24], [1, 0], clamp);
        return (
          <React.Fragment key={`b${j}`}>
            {trailLen > 0 && trailFade > 0 ? (
              <div
                style={{
                  position: "absolute",
                  left: x + b.d * 0.5,
                  top: groundY - b.d * 0.06,
                  width: trailLen,
                  height: b.d * 0.1,
                  borderRadius: b.d * 0.05,
                  background: `linear-gradient(90deg, ${withOpacity(pal.snowShade, 0.75)}, ${withOpacity(pal.snowShade, 0)})`,
                  opacity: trailFade,
                }}
              />
            ) : null}
            <div style={{ position: "absolute", left: x, top: b.top }}>
              <Snowball
                size={b.d}
                rotation={rotation}
                squash={squash}
                numberIn={numberIn}
                pal={pal}
                number={j + 1}
                numberPx={b.d * 0.48}
                font={fonts.title}
                weight={fonts.titleWeight}
              />
            </div>
          </React.Fragment>
        );
      })}

      {/* off-screen probe: each step's label + text at their chosen sizes */}
      <div ref={probeRef} style={probeStyle(probeW)}>
        {steps.map((s, j) => (
          <div key={j} style={{ fontFamily: fonts.body, display: "flex", flexDirection: "column", gap: 6 }}>
            {s.label ? <div style={{ fontWeight: 800, fontSize: labelPx, lineHeight: 1.1 }}>{s.label}</div> : null}
            {s.text ? <div style={{ fontWeight: 600, fontSize: type.body, lineHeight: 1.3 }}>{s.text}</div> : null}
          </div>
        ))}
      </div>

      <LayeredSnow portrait={portrait} seed={seed} layer="front" density={0.4} />
      <SnowClearIn frame={frame} />
      <SnowGustExit exit={exit} portrait={portrait} seed={seed} />
    </AbsoluteFill>
  );
};
