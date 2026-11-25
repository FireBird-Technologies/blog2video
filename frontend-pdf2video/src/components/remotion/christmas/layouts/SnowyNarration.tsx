/**
 * snowy_narration — "Snowman Story", the main explanation layout (fallback).
 *
 * The same bright snowy day as every scene. On the right a snowman builds himself
 * (snowballs stack, the top hat drops on, scarf, face and stick arms appear), then
 * waves, blinks and bobs. On the left a frosted glass panel with a snow cap holds
 * the Title, a candy-cane rule and the Display text (portrait: panel on top,
 * snowman lower right).
 * With a photo, the snowman holds it up in a wooden picture frame with both stick
 * arms instead of waving.
 * Exit: the snow gust.
 *
 * The photo box is PHOTO (inner size, px) — keep imageBoxConfig.ts ("christmas" /
 * snowy_narration) in sync.
 *
 * Mirror byte-identical in all three trees.
 */
import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import type { SceneLayoutProps } from "../types";
import { clamp, FESTIVE, mix, withOpacity } from "../christmasStyle";
import { getChristmasTypography } from "../typography";
import { ease, pop, useChristmasScene } from "../components/sceneKit";
import { FitText } from "../components/FitText";
import { WinterBackdrop } from "../components/WinterBackdrop";
import { LayeredSnow } from "../components/Snowfall";
import { FrostCard } from "../components/FrostCard";
import { ChristmasMedia, hasMedia as sceneHasMedia } from "../components/ChristmasMedia";
import { CandyCaneRule } from "../components/Festive";
import { Snowman, snowmanPoint } from "../components/Snowman";
import { SnowClearIn, SnowGustExit } from "../components/SnowGustExit";

/** Inner (image) size of the held picture frame, px — 4:3 in both orientations. */
const PHOTO = { landscape: { w: 420, h: 315 }, portrait: { w: 380, h: 285 } } as const;
const FRAME_BORDER = 22;
/** Local snowman height (units) at which the picture is held. */
const HOLD_Y = 270;

export const SnowyNarration: React.FC<SceneLayoutProps> = (props) => {
  const { frame, width, height, portrait, pal, fonts, pad, exit, seed } = useChristmasScene(props);
  const p = portrait;
  // Default sizes — must match backend/templates/christmas/meta.json; Template Studio rewrites these literals.
  const type = getChristmasTypography(props, (titleFontSize, descriptionFontSize) => ({
    title: titleFontSize ?? (p ? 88 : 80),
    body: descriptionFontSize ?? (p ? 44 : 38),
  }));
  const heading = (props.title || "").trim();
  const body = (props.displayText || "").trim();
  const media = sceneHasMedia(props);

  // ── Snowman placement
  const snowH = portrait ? height * 0.4 : height * 0.78;
  const snowBottom = portrait ? height * 0.93 : height * 0.95;
  const snowCX = portrait ? width * 0.62 : width * 0.79;
  const center = snowmanPoint(snowH, 150, 0);
  const snowLeft = snowCX - center.x;
  const snowTop = snowBottom - snowH;

  // ── Held picture (screen px)
  const photo = portrait ? PHOTO.portrait : PHOTO.landscape;
  const hold = snowmanPoint(snowH, 150, HOLD_Y);
  const frameW = photo.w + FRAME_BORDER * 2;
  const frameH = photo.h + FRAME_BORDER * 2;
  const frameCX = snowLeft + hold.x;
  const frameCY = snowTop + hold.y;
  const holdHalfW = frameW / 2 / hold.k;

  // ── Text panel
  const panelX = pad.x;
  const panelY = pad.top + 20;
  const panelW = portrait ? width - pad.x * 2 : snowLeft - pad.x - 40;
  const panelH = portrait ? height * 0.4 : height - panelY - pad.bottom - 20;
  const inner = portrait ? 50 : 56;
  const textW = panelW - inner * 2;
  const headMaxH = panelH * (portrait ? 0.32 : 0.34);
  const bodyMaxH = panelH - headMaxH - inner * 2 - 50;

  // ── Timing
  const build = interpolate(frame, [4, 56], [0, 1], clamp);
  const photoIn = pop(frame, 50, 68);
  const panelIn = ease(frame, 6, 28);
  const capIn = ease(frame, 22, 40);
  const headIn = ease(frame, 20, 42);
  const ruleIn = ease(frame, 32, 48);
  const bodyIn = ease(frame, 36, 64);
  const photoSway = Math.sin(frame / 22) * 1.5;

  return (
    <AbsoluteFill style={{ overflow: "hidden", color: pal.ink }}>
      <WinterBackdrop pal={pal} seed={seed + 3} horizon={portrait ? 0.62 : 0.7} />
      <LayeredSnow portrait={portrait} seed={seed} density={0.8} layer="back" />

      {/* text panel */}
      <div style={{ position: "absolute", left: panelX, top: panelY, opacity: panelIn, transform: `translateX(${(1 - panelIn) * -80}px)` }}>
        <FrostCard pal={pal} width={panelW} height={panelH} variant="frost" seed={seed + 21} snow={capIn}>
          <div style={{ position: "absolute", inset: inner, display: "flex", flexDirection: "column", justifyContent: "center", gap: portrait ? 24 : 22 }}>
            <div style={{ opacity: headIn, transform: `translateY(${(1 - headIn) * 18}px)` }}>
              <FitText
                targetPx={type.title}
                minPx={portrait ? 44 : 36}
                maxHeightPx={headMaxH}
                maxWidthPx={textW}
                fitKey={`sn-head:${heading}:${portrait}:${media}`}
                exact={type.titleIsUserSet}
                style={{ fontFamily: fonts.title, fontWeight: fonts.titleWeight, lineHeight: 1.05, color: pal.accent }}
              >
                {heading}
              </FitText>
            </div>
            <CandyCaneRule width={Math.min(textW * 0.45, 340) * ruleIn} accent={pal.accent} />
            <div style={{ opacity: bodyIn, transform: `translateY(${(1 - bodyIn) * 14}px)` }}>
              <FitText
                targetPx={type.body}
                minPx={portrait ? 26 : 22}
                maxHeightPx={Math.max(120, bodyMaxH)}
                maxWidthPx={textW}
                fitKey={`sn-body:${body}:${portrait}:${media}`}
                exact={type.bodyIsUserSet}
                style={{ fontFamily: fonts.body, fontWeight: 600, lineHeight: 1.42, color: pal.inkSoft }}
              >
                {body}
              </FitText>
            </div>
          </div>
        </FrostCard>
      </div>

      {/* snowman */}
      <Snowman
        frame={frame}
        accent={pal.accent}
        build={build}
        pose={media ? "hold" : "wave"}
        holdHalfW={holdHalfW}
        holdY={HOLD_Y}
        shade={pal.snowShade}
        height={snowH}
        style={{ position: "absolute", left: snowLeft, top: snowTop }}
      />

      {/* the picture he holds up */}
      {media ? (
        <div
          style={{
            position: "absolute",
            left: frameCX - frameW / 2,
            top: frameCY - frameH / 2,
            width: frameW,
            height: frameH,
            boxSizing: "border-box",
            padding: FRAME_BORDER,
            borderRadius: 8,
            background: `linear-gradient(135deg, ${mix(FESTIVE.wood, "#ffffff", 0.18)}, ${FESTIVE.wood} 50%, ${FESTIVE.woodDark})`,
            boxShadow: `0 16px 30px ${pal.shadow}`,
            transform: `scale(${photoIn}) rotate(${photoSway}deg)`,
            opacity: interpolate(photoIn, [0, 0.2], [0, 1], clamp),
          }}
        >
          <div style={{ position: "relative", width: photo.w, height: photo.h, overflow: "hidden", borderRadius: 3, background: pal.snowShade }}>
            <ChristmasMedia scene={props} />
            <div style={{ position: "absolute", inset: 0, boxShadow: `inset 0 0 0 3px ${withOpacity(FESTIVE.gold, 0.8)}` }} />
          </div>
        </div>
      ) : null}

      <LayeredSnow portrait={portrait} seed={seed} density={0.5} layer="front" />
      <SnowClearIn frame={frame} />
      <SnowGustExit exit={exit} portrait={portrait} seed={seed} />
    </AbsoluteFill>
  );
};
