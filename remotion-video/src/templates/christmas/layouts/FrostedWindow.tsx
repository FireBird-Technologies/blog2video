/**
 * frosted_window — a scene built around one photo (or stock clip).
 * A cottage window: wooden frame with mullions, frost creeping in from the corners,
 * snow piled on the sill and a string of fairy lights across the top.
 *  - With a photo / clip, it is the view OUTSIDE: it fills the glass behind the
 *    frame and mullions. A glass layer sits over it — a faint cool tint, an inner
 *    edge shadow, two slow diagonal reflections, condensation droplets and a light
 *    mist (heavier at the edges) — while the view stays clearly readable.
 *  - Without one, the window is smaller and its glass is fogged up: the snowy view
 *    behind it (sky, pines, falling snow) is blurred under a milky haze with slow
 *    drifting fog wisps; the text card takes the freed space.
 * The Title + Display text sit on a frosted card beside it (below in portrait); the
 * optional caption hangs as a gift tag at the TOP of that card.
 * Exit: the glass fogs over, then the snow gust.
 *
 * Mirror byte-identical in all three trees.
 */
import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import type { SceneLayoutProps } from "../types";
import type { WinterPalette } from "../christmasStyle";
import { christmasRand, clamp, FESTIVE, mix, withOpacity } from "../christmasStyle";
import { getChristmasTypography } from "../typography";
import { ease, pop, useChristmasScene } from "../components/sceneKit";
import { FitText } from "../components/FitText";
import { WinterBackdrop, pinePath } from "../components/WinterBackdrop";
import { LayeredSnow, Snowfall } from "../components/Snowfall";
import { FrostCard, snowCapPath } from "../components/FrostCard";
import { ChristmasMedia, hasMedia as sceneHasMedia } from "../components/ChristmasMedia";
import { CandyCaneRule, FairyLights, GiftTag } from "../components/Festive";
import { SnowClearIn, SnowGustExit } from "../components/SnowGustExit";

/** The snowy view through the glass when no photo / clip is supplied. */
const WindowView: React.FC<{ pal: WinterPalette; width: number; height: number; seed: number; portrait: boolean }> = ({
  pal,
  width,
  height,
  seed,
  portrait,
}) => {
  const ground = height * 0.72;
  const pines = [0.12, 0.3, 0.74, 0.9].map((x, i) => ({ x: width * x, h: height * (0.34 + (i % 2) * 0.12) }));
  return (
    <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${pal.skyTop}, ${pal.sky} 60%, ${pal.skyLow})` }}>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <path d={`M0 ${ground} Q${width * 0.3} ${ground - height * 0.12} ${width * 0.6} ${ground - height * 0.04} T${width} ${ground - height * 0.08} L${width} ${height} L0 ${height} Z`} fill={pal.farHill} />
        {pines.map((p, i) => (
          <path key={i} d={pinePath(p.x, ground + height * 0.04, p.h)} fill={i % 2 ? pal.farPine : pal.nearPine} />
        ))}
        <path d={`M0 ${ground + height * 0.05} Q${width * 0.5} ${ground - height * 0.02} ${width} ${ground + height * 0.06} L${width} ${height} L0 ${height} Z`} fill={FESTIVE.snow} />
      </svg>
      <Snowfall count={portrait ? 16 : 20} seed={seed + 61} scale={0.9} />
    </div>
  );
};

/** Misted glass: a milky haze (heavier near the bottom) and slow drifting fog wisps. */
const FogLayer: React.FC<{ frame: number; amount: number; width: number; height: number }> = ({ frame, amount, width, height }) => {
  if (amount <= 0) return null;
  const wisps = [
    { y: 0.22, size: 0.9, speed: 0.35, phase: 0, o: 0.55 },
    { y: 0.52, size: 1.1, speed: -0.25, phase: 0.4, o: 0.6 },
    { y: 0.8, size: 1.0, speed: 0.3, phase: 0.75, o: 0.7 },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, opacity: amount, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, ${withOpacity(FESTIVE.snow, 0.5)} 0%, ${withOpacity(FESTIVE.snow, 0.6)} 55%, ${withOpacity(FESTIVE.snow, 0.78)} 100%)`,
        }}
      />
      {wisps.map((w, i) => {
        const span = width * 1.6;
        const x = ((((w.phase * span + frame * w.speed * 2) % span) + span) % span) - width * 0.55;
        const ww = width * w.size;
        const hh = height * 0.42 * w.size;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - ww / 2,
              top: height * w.y - hh / 2,
              width: ww,
              height: hh,
              borderRadius: "50%",
              background: `radial-gradient(ellipse at center, ${withOpacity(FESTIVE.snow, w.o)} 0%, ${withOpacity(FESTIVE.snow, w.o * 0.4)} 45%, ${withOpacity(FESTIVE.snow, 0)} 70%)`,
            }}
          />
        );
      })}
    </div>
  );
};

/**
 * Glass over a photo / clip: cool tint, inner edge shadow, a light edge-heavy mist
 * with faint drifting wisps, two slow diagonal reflections and condensation droplets.
 */
const GlassLayer: React.FC<{ frame: number; width: number; height: number; seed: number; amount: number }> = ({
  frame,
  width,
  height,
  seed,
  amount,
}) => {
  const drift = Math.sin(frame / 90) * 4; // reflections shift very slowly (percent)
  const droplets = Array.from({ length: 16 }, (_, i) => ({
    x: christmasRand(seed + 31, i) * width,
    y: christmasRand(seed + 37, i) * height,
    r: 2 + christmasRand(seed + 41, i) * 4,
  }));
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {/* cool glass tint + edge-heavy mist */}
      <div style={{ position: "absolute", inset: 0, background: withOpacity("#E6F0F8", 0.12) }} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: amount,
          background: `radial-gradient(ellipse at 50% 45%, ${withOpacity(FESTIVE.snow, 0)} 45%, ${withOpacity(FESTIVE.snow, 0.32)} 85%, ${withOpacity(FESTIVE.snow, 0.5)} 100%),
            linear-gradient(180deg, ${withOpacity(FESTIVE.snow, 0)} 60%, ${withOpacity(FESTIVE.snow, 0.22)} 100%)`,
        }}
      />
      <FogLayer frame={frame} amount={amount * 0.32} width={width} height={height} />
      {/* two diagonal reflections */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(115deg,
            rgba(255,255,255,0) ${8 + drift}%, rgba(255,255,255,0.28) ${14 + drift}%, rgba(255,255,255,0.06) ${20 + drift}%, rgba(255,255,255,0) ${24 + drift}%,
            rgba(255,255,255,0) ${52 + drift}%, rgba(255,255,255,0.16) ${56 + drift}%, rgba(255,255,255,0) ${61 + drift}%)`,
        }}
      />
      {/* condensation droplets */}
      <svg width={width} height={height} style={{ position: "absolute", inset: 0, opacity: amount }}>
        {droplets.map((d, i) => (
          <g key={i}>
            <circle cx={d.x} cy={d.y} r={d.r} fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.55)" strokeWidth={1} />
            <circle cx={d.x - d.r * 0.35} cy={d.y - d.r * 0.35} r={d.r * 0.3} fill="rgba(255,255,255,0.85)" />
          </g>
        ))}
      </svg>
      {/* depth: inner shadow where the glass meets the frame */}
      <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 26px rgba(20,40,60,0.32), inset 0 0 3px rgba(255,255,255,0.6)" }} />
    </div>
  );
};

export const FrostedWindow: React.FC<SceneLayoutProps> = (props) => {
  const { frame, width, height, portrait, pal, fonts, pad, exit, seed } = useChristmasScene(props);
  const p = portrait;
  // Default sizes — must match backend/templates/christmas/meta.json; Template Studio rewrites these literals.
  const type = getChristmasTypography(props, (titleFontSize, descriptionFontSize) => ({
    title: titleFontSize ?? (p ? 96 : 84),
    body: descriptionFontSize ?? (p ? 46 : 40),
  }));
  const heading = (props.title || "").trim();
  const body = (props.displayText || "").trim();
  const caption = (props.imageCaption || "").trim();
  const media = sceneHasMedia(props);

  // Window geometry (outer frame). With media the inner glass must match the
  // "christmas" / frosted_window ratio in imageBoxConfig.ts (landscape 892/746,
  // portrait 860/746). Without media the window shrinks and the text card grows.
  const fullH = height - pad.top - pad.bottom - 40;
  const frameW = portrait ? (media ? width - pad.x * 2 : width * 0.62) : media ? width * 0.5 : width * 0.32;
  const frameH = portrait ? (media ? height * 0.42 : height * 0.27) : media ? fullH : fullH * 0.68;
  const frameX = portrait ? (media ? pad.x : (width - frameW) / 2) : pad.x;
  const frameY = portrait ? pad.top + 20 : media ? pad.top + 20 : pad.top + 20 + (fullH - frameH) / 2;
  const border = portrait ? 30 : 34;
  const glassW = frameW - border * 2;
  const glassH = frameH - border * 2;

  // Text card (room above it for the snow cap and the hanging caption tag).
  const tagRoom = caption ? (portrait ? 70 : 60) : 0;
  const panelX = portrait ? pad.x : frameX + frameW + 70;
  const panelY = (portrait ? frameY + frameH + 90 : pad.top + 50) + tagRoom;
  const panelW = portrait ? width - pad.x * 2 : width - panelX - pad.x;
  const panelH = portrait ? height - panelY - pad.bottom : height - pad.top - pad.bottom - 100 - tagRoom;
  const inner = portrait ? 40 : 44;
  const textW = panelW - inner * 2;

  const winIn = pop(frame, 2, 26);
  const frostIn = ease(frame, 10, 60);
  // Lighter frost over a real photo / clip so the view outside reads clearly.
  const frostK = media ? 0.55 : 1;
  // Fogged-up glass when there is no photo: builds as the scene opens.
  const mist = media ? 0 : ease(frame, 4, 44);
  const mistIn = ease(frame, 4, 44);
  const lightsOn = ease(frame, 24, 70);
  const panelIn = ease(frame, 18, 42);
  const headIn = ease(frame, 26, 46);
  const bodyIn = ease(frame, 38, 66);
  const tagIn = pop(frame, 44, 70);
  const fog = interpolate(exit, [0, 0.6], [0, 1], clamp);
  const wood = mix(FESTIVE.wood, "#ffffff", 0.08);

  return (
    <AbsoluteFill style={{ overflow: "hidden", color: pal.ink }}>
      <WinterBackdrop pal={pal} seed={seed + 2} horizon={portrait ? 0.84 : 0.8} trees={!portrait} />
      <LayeredSnow portrait={portrait} seed={seed} layer="back" density={0.8} />

      {/* window */}
      <div
        style={{
          position: "absolute",
          left: frameX,
          top: frameY,
          width: frameW,
          height: frameH,
          transform: `scale(${0.85 + winIn * 0.15})`,
          opacity: interpolate(winIn, [0, 0.3], [0, 1], clamp),
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 14,
            background: `linear-gradient(180deg, ${wood}, ${FESTIVE.wood} 60%, ${FESTIVE.woodDark})`,
            boxShadow: `0 ${frameH * 0.04}px ${frameH * 0.08}px ${pal.shadow}`,
          }}
        />
        <div style={{ position: "absolute", left: border, top: border, width: glassW, height: glassH, overflow: "hidden", borderRadius: 6, background: pal.snowShade }}>
          {media ? (
            <>
              <ChristmasMedia scene={props} />
              <GlassLayer frame={frame} width={glassW} height={glassH} seed={seed} amount={mistIn} />
            </>
          ) : (
            <>
              <div style={{ position: "absolute", inset: -12, filter: `blur(${(2 + mist * 5).toFixed(2)}px)` }}>
                <div style={{ position: "absolute", inset: 12 }}>
                  <WindowView pal={pal} width={glassW} height={glassH} seed={seed} portrait={portrait} />
                </div>
              </div>
              <FogLayer frame={frame} amount={mist} width={glassW} height={glassH} />
            </>
          )}
          {/* frost creeping from the corners */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `radial-gradient(ellipse at 0% 0%, ${withOpacity(FESTIVE.snow, 0.85 * frostK)} 0%, transparent ${(18 + frostIn * 14) * frostK}%),
                radial-gradient(ellipse at 100% 0%, ${withOpacity(FESTIVE.snow, 0.8 * frostK)} 0%, transparent ${(14 + frostIn * 12) * frostK}%),
                radial-gradient(ellipse at 0% 100%, ${withOpacity(FESTIVE.snow, 0.85 * frostK)} 0%, transparent ${(16 + frostIn * 16) * frostK}%),
                radial-gradient(ellipse at 100% 100%, ${withOpacity(FESTIVE.snow, 0.9 * frostK)} 0%, transparent ${(20 + frostIn * 16) * frostK}%)`,
            }}
          />
          <div style={{ position: "absolute", inset: 0, background: withOpacity(FESTIVE.snow, 0.92 * fog) }} />
          {/* glass sheen */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(120deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 35%)" }} />
        </div>
        {/* mullions */}
        <div style={{ position: "absolute", left: frameW / 2 - border * 0.3, top: border, width: border * 0.6, height: glassH, background: FESTIVE.wood, boxShadow: `0 0 6px ${pal.shadow}` }} />
        <div style={{ position: "absolute", top: frameH / 2 - border * 0.3, left: border, height: border * 0.6, width: glassW, background: FESTIVE.wood, boxShadow: `0 0 6px ${pal.shadow}` }} />
        {/* snow on the sill */}
        <svg width={frameW + 60} height={70} viewBox={`-30 0 ${frameW + 60} 70`} style={{ position: "absolute", left: -30, top: frameH - 34, overflow: "visible" }}>
          <path d={snowCapPath(frameW, 36, seed + 5)} fill={FESTIVE.snow} stroke={withOpacity(pal.snowShade, 0.8)} strokeWidth={1.5} opacity={interpolate(frostIn, [0, 0.4], [0, 1], clamp)} />
        </svg>
        {/* fairy lights across the top */}
        <FairyLights frame={frame} width={frameW + 40} sag={34} count={portrait ? 11 : 13} on={lightsOn} colors={[pal.accent, FESTIVE.gold, FESTIVE.pine, "#3FA7E0"]} style={{ position: "absolute", left: -20, top: -10 }} />
      </div>

      {/* text panel */}
      <div style={{ position: "absolute", left: panelX, top: panelY, opacity: panelIn, transform: `translateY(${(1 - panelIn) * 40}px)` }}>
        <FrostCard pal={pal} width={panelW} height={panelH} variant="frost" seed={seed + 17}>
          <div style={{ position: "absolute", inset: inner, display: "flex", flexDirection: "column", justifyContent: "center", gap: portrait ? 22 : 20 }}>
            <div style={{ opacity: headIn }}>
              <FitText
                targetPx={type.title}
                minPx={portrait ? 46 : 40}
                maxHeightPx={panelH * 0.4}
                maxWidthPx={textW}
                fitKey={`fw-head:${heading}:${portrait}`}
                exact={type.titleIsUserSet}
                style={{ fontFamily: fonts.title, fontWeight: fonts.titleWeight, lineHeight: 1.05, color: pal.accent }}
              >
                {heading}
              </FitText>
            </div>
            <CandyCaneRule width={Math.min(textW * 0.5, 320) * headIn} accent={pal.accent} />
            <div style={{ opacity: bodyIn, transform: `translateY(${(1 - bodyIn) * 14}px)` }}>
              <FitText
                targetPx={type.body}
                minPx={portrait ? 28 : 24}
                maxHeightPx={Math.max(100, panelH * 0.5 - inner)}
                maxWidthPx={textW}
                fitKey={`fw-body:${body}:${portrait}`}
                exact={type.bodyIsUserSet}
                style={{ fontFamily: fonts.body, fontWeight: 600, lineHeight: 1.4, color: pal.inkSoft }}
              >
                {body}
              </FitText>
            </div>
          </div>
        </FrostCard>
      </div>

      {/* caption: a gift tag tied on at the top of the text card */}
      {caption ? (
        <div
          style={{
            position: "absolute",
            left: panelX + (portrait ? 36 : 40),
            top: panelY - tagRoom - 16,
            maxWidth: panelW * 0.8,
            transform: `rotate(${-3 + Math.sin(frame / 18) * 1.5}deg) scale(${tagIn})`,
            transformOrigin: "0% 50%",
            opacity: panelIn,
          }}
        >
          <GiftTag ink={pal.ink} accent={pal.accent} padding={portrait ? 15 : 13}>
            <FitText
              targetPx={type.bodyRelative(portrait ? 32 : 28)}
              minPx={Math.min(type.bodyRelative(portrait ? 32 : 28), 16)}
              maxHeightPx={type.bodyRelative(portrait ? 32 : 28) * 2.5}
              maxWidthPx={Math.max(140, panelW * 0.8 - 90)}
              fitKey={`fw-caption:${caption}:${portrait}`}
              style={{ fontFamily: fonts.body, fontWeight: 700, lineHeight: 1.2, width: "auto" }}
            >
              {caption}
            </FitText>
          </GiftTag>
        </div>
      ) : null}

      <LayeredSnow portrait={portrait} seed={seed} layer="front" density={0.5} />
      <SnowClearIn frame={frame} />
      <SnowGustExit exit={exit} portrait={portrait} seed={seed} />
    </AbsoluteFill>
  );
};
