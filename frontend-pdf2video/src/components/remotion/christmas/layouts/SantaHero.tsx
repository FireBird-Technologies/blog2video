/**
 * santa_hero — Opening.
 * Over snowy hills and a pine treeline, Santa's sleigh and reindeer gallop across
 * the sky (slowly) trailing gold sparkles and off the right edge, then come back in
 * from the right, small and high in the far sky, fading into the distance. A snow-capped wooden sign drops in on ropes with the Title;
 * the Display text is one line under it. Once the sleigh has gone, the sign is
 * hauled back up on its ropes, out of frame, before the snow gust ends the scene.
 *
 * Mirror byte-identical in all three trees.
 */
import React from "react";
import { AbsoluteFill, Easing, interpolate } from "remotion";
import type { SceneLayoutProps } from "../types";
import { clamp } from "../christmasStyle";
import { getChristmasTypography } from "../typography";
import { ease, pop, useChristmasScene } from "../components/sceneKit";
import { FitText } from "../components/FitText";
import { probeStyle, useNaturalHeight } from "../components/useNaturalHeight";
import { WinterBackdrop } from "../components/WinterBackdrop";
import { LayeredSnow } from "../components/Snowfall";
import { FrostCard } from "../components/FrostCard";
import { SleighTeam } from "../components/Sleigh";
import { CandyCaneRule, Sparkles } from "../components/Festive";
import { SnowGustExit } from "../components/SnowGustExit";

export const SantaHero: React.FC<SceneLayoutProps> = (props) => {
  const { frame, width, height, portrait, pal, fonts, pad, exit, seed, total } = useChristmasScene(props);
  const p = portrait;
  // Default sizes — must match backend/templates/christmas/meta.json; Template Studio rewrites these literals.
  const type = getChristmasTypography(props, (titleFontSize, descriptionFontSize) => ({
    title: titleFontSize ?? (p ? 80 : 88),
    body: descriptionFontSize ?? (p ? 50 : 40),
  }));
  const title = (props.title || "").trim();
  const line = (props.displayText || "").trim();

  // Exit: no Santa — the sign is hauled up out of frame on its ropes; the snow gust
  // only whites out the very last frames.
  const liftStart = Math.max(150, total - 36);
  const lift = interpolate(frame, [liftStart, total - 6], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });

  // ── Sleigh flight (gone before the sign lifts), at a steady unhurried pace:
  //  1. near pass: the large team flies left → right and off the right edge;
  //  2. far return: it comes back in from the right, small and high in the far sky,
  //     and fades away into the distance (shrinking further) part-way across.
  // `sleighScale` (hidden, poster-only) shrinks the team so the whole sleigh + both
  // reindeer fit a portrait poster frame; videos never set it.
  const sleighScale = Math.max(0.3, Math.min(1.5, Number(props.sleighScale) || 1));
  const teamW = (portrait ? width * 1.5 : width * 0.58) * sleighScale;
  // The team's own animation (gallop, reins, sparkles) runs slower than real time.
  const teamFrame = frame * 0.68;
  const flightEnd = liftStart - 2;
  const passEnd = flightEnd * 0.53;
  const returnStart = flightEnd * 0.56;
  const nearY = portrait ? height * 0.2 : height * 0.25;
  const farY = portrait ? height * 0.09 : height * 0.12;
  // Portrait's far return stays bigger so the sleigh still reads on a narrow frame.
  const farScale = portrait ? 0.55 : 0.45;
  // Linear (constant speed) so the sleigh never rushes through the middle of the pass.
  const pass = interpolate(frame, [0, passEnd], [0, 1], clamp);
  const back = interpolate(frame, [returnStart, flightEnd], [0, 1], clamp);
  const flight =
    frame < passEnd
      ? {
          // Starts with even the lead reindeer's nose (≈ 0.38 teamW ahead of centre) past the left edge.
          x: interpolate(pass, [0, 1], [-teamW * 0.43, width + teamW * 0.55]),
          y: nearY - Math.sin(pass * Math.PI) * 50 + Math.sin(frame / 20) * 6,
          scale: 1,
          sx: 1,
          rot: -3 + pass * 6,
          opacity: 1,
        }
      : {
          x: interpolate(back, [0, 1], [width + teamW * farScale * 0.55, width * 0.3]),
          y: farY + Math.sin(frame / 22) * 8 - back * height * 0.02,
          scale: interpolate(back, [0, 1], [farScale, farScale * 0.55]),
          sx: -1,
          rot: 2,
          opacity: interpolate(back, [0.65, 1], [1, 0], clamp),
        };
  const flightW = teamW * flight.scale;
  const flightH = flightW * (320 / 820);
  const flying = frame < passEnd || (frame >= returnStart && frame < flightEnd);

  // ── Sign
  const signW = portrait ? width - pad.x * 2 : Math.min(width * 0.62, 1200);
  const baseSignH = portrait ? height * 0.36 : height * 0.44;
  const signTop = portrait ? height * 0.3 : height * 0.3;
  const drop = pop(frame, 40, 70);
  const swing = Math.sin(frame / 16) * 2.2 * (1 - ease(frame, 58, 140));
  const capIn = ease(frame, 64, 84);
  const titleIn = ease(frame, 62, 86);
  const lineIn = ease(frame, 78, 104);
  const inner = portrait ? 44 : 50;
  const textW = signW - inner * 2 - 30;

  // ── The sign grows (downward) to fit its text at the chosen sizes, but never past
  // the caption band: the text only shrinks once the sign can grow no further.
  const titleProbe = React.useRef<HTMLDivElement>(null);
  const lineProbe = React.useRef<HTMLDivElement>(null);
  const titleNatural = useNaturalHeight(titleProbe, [title, type.title, textW, fonts.title]);
  const lineNatural = useNaturalHeight(lineProbe, [line, type.body, textW, fonts.body]);
  const gap = portrait ? 24 : 18;
  const boardFrame = Math.max(14, Math.min(signW, baseSignH) * 0.035);
  const chrome = inner * 2 + boardFrame * 2 + 16;
  const contentH = titleNatural + (line ? gap * 2 + 10 + lineNatural : 0);
  const maxSignH = height - pad.bottom - 10 - signTop;
  const signH = Math.max(baseSignH, Math.min(maxSignH, contentH + chrome));
  // Text room inside the final sign, shared in proportion when it is still too tight.
  const textRoom = signH - chrome - (line ? gap * 2 + 10 : 0);
  const naturalSum = Math.max(1, titleNatural + (line ? lineNatural : 0));
  const fitsNaturally = naturalSum <= textRoom;
  const titleMaxH = fitsNaturally ? titleNatural + 8 : (textRoom * titleNatural) / naturalSum;
  const lineMaxH = fitsNaturally ? lineNatural + 8 : (textRoom * lineNatural) / naturalSum;

  return (
    <AbsoluteFill style={{ overflow: "hidden", color: pal.ink }}>
      <WinterBackdrop pal={pal} seed={seed + 1} horizon={portrait ? 0.78 : 0.74} />
      <LayeredSnow portrait={portrait} seed={seed} layer="back" />

      {flying ? (
        <SleighTeam
          frame={teamFrame}
          width={flightW}
          accent={pal.accent}
          trail={flight.scale < 0.6 ? 0.6 : 1}
          style={{
            position: "absolute",
            left: flight.x - flightW / 2,
            top: flight.y - flightH / 2,
            transform: `scaleX(${flight.sx.toFixed(3)}) rotate(${flight.rot.toFixed(2)}deg)`,
            opacity: flight.opacity,
          }}
        />
      ) : null}

      <Sparkles frame={frame} width={width} height={height * 0.4} count={portrait ? 10 : 16} seed={seed + 9} opacity={interpolate(frame, [40, 70], [0, 0.9], clamp)} style={{ left: 0, top: 0 }} />

      <div
        style={{
          position: "absolute",
          left: (width - signW) / 2,
          top: signTop + interpolate(drop, [0, 1], [-height, 0]) - lift * (signTop + signH + 120),
          transform: `rotate(${swing}deg)`,
          transformOrigin: "50% -200px",
        }}
      >
        <FrostCard pal={pal} width={signW} height={signH} seed={seed + 31} snow={capIn} ropes={signTop + 40}>
          <div
            style={{
              position: "absolute",
              inset: inner,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              gap: portrait ? 24 : 18,
            }}
          >
            <div style={{ opacity: titleIn, transform: `scale(${0.85 + titleIn * 0.15})` }}>
              <FitText
                targetPx={type.title}
                minPx={portrait ? 60 : 52}
                maxHeightPx={Math.max(40, titleMaxH)}
                maxWidthPx={textW}
                fitKey={`sh-title:${title}:${portrait}:${Boolean(line)}`}
                exact={type.titleIsUserSet}
                style={{ fontFamily: fonts.title, fontWeight: fonts.titleWeight, lineHeight: 1.02, color: pal.accent }}
              >
                {title}
              </FitText>
            </div>
            {line ? (
              <>
                <CandyCaneRule width={Math.min(textW * 0.42, 380) * lineIn} accent={pal.accent} />
                <div style={{ opacity: lineIn, transform: `translateY(${(1 - lineIn) * 14}px)` }}>
                  <FitText
                    targetPx={type.body}
                    minPx={portrait ? 30 : 26}
                    maxHeightPx={Math.max(30, lineMaxH)}
                    maxWidthPx={textW}
                    fitKey={`sh-line:${line}:${portrait}`}
                    exact={type.bodyIsUserSet}
                    style={{ fontFamily: fonts.body, fontWeight: 700, lineHeight: 1.25, color: pal.inkSoft }}
                  >
                    {line}
                  </FitText>
                </div>
              </>
            ) : null}
          </div>
        </FrostCard>
      </div>

      {/* off-screen probes: the texts at their chosen sizes, for sizing the sign */}
      <div ref={titleProbe} style={{ ...probeStyle(textW), fontFamily: fonts.title, fontWeight: fonts.titleWeight, fontSize: type.title, lineHeight: 1.02, textAlign: "center" }}>
        {title}
      </div>
      <div ref={lineProbe} style={{ ...probeStyle(textW), fontFamily: fonts.body, fontWeight: 700, fontSize: type.body, lineHeight: 1.25, textAlign: "center" }}>
        {line}
      </div>

      <LayeredSnow portrait={portrait} seed={seed} layer="front" density={0.8} />

      <SnowGustExit exit={interpolate(exit, [0.55, 1], [0, 1], clamp)} portrait={portrait} seed={seed} />
    </AbsoluteFill>
  );
};
