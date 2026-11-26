/**
 * letter_quote — one real quotation ("Letter to Santa").
 *
 * Right (top in portrait): a red envelope (classic 1.6 : 1, V-shaped front pocket)
 * pops in on the snow. Its flap swings open in 3D and ends pointing UP, showing its
 * striped lining (the gold seal rides on the outside of its tip). The letter — still
 * small — slides up out of the pocket while the envelope eases down, then grows and
 * comes forward to rest IN FRONT of the envelope, which stays open behind it: its
 * sides and bottom peek out, and the open flap's tip shows above the letter.
 * The quote is written on the letter, signed with the attribution; the Title is a
 * small heading (above the letter in portrait, above the snowman in landscape).
 * Left (bottom-left in portrait): a plain snowman — snowballs, face and a red
 * muffler and mittened stick arms (one raised in a wave), no hat — builds himself and blinks. In portrait a mirrored twin
 * with a green muffler stands bottom-right, so the two face each other.
 * Exit: the snow gust.
 *
 * Mirror byte-identical in all three trees.
 */
import React from "react";
import { AbsoluteFill, Easing, interpolate } from "remotion";
import type { SceneLayoutProps } from "../types";
import { clamp, FESTIVE, mix, withOpacity } from "../christmasStyle";
import { getChristmasTypography } from "../typography";
import { ease, pop, useChristmasScene } from "../components/sceneKit";
import { FitText } from "../components/FitText";
import { WinterBackdrop } from "../components/WinterBackdrop";
import { LayeredSnow } from "../components/Snowfall";
import { GoldStar } from "../components/Festive";
import { starPath } from "../components/ChristmasTree";
import { Snowman } from "../components/Snowman";
import { SnowClearIn, SnowGustExit } from "../components/SnowGustExit";

// Choreography (scene frames).
const ENV_IN = [2, 20] as const;
const FLAP_OPEN = [18, 38] as const;
const SLIDE_OUT = [34, 62] as const;
const COME_FORWARD = [62, 82] as const;

export const LetterQuote: React.FC<SceneLayoutProps> = (props) => {
  const { frame, width, height, portrait, pal, fonts, pad, exit, seed } = useChristmasScene(props);
  const p = portrait;
  // Default sizes — must match backend/templates/christmas/meta.json; Template Studio rewrites these literals.
  const type = getChristmasTypography(props, (titleFontSize, descriptionFontSize) => ({
    title: titleFontSize ?? (p ? 84 : 72),
    body: descriptionFontSize ?? (p ? 60 : 52),
  }));
  const heading = (props.title || "").trim();
  const quote = (props.quote || props.displayText || "").trim();
  const attribution = (props.attribution || "").trim();

  // ── Regions: snowman on the left, envelope + letter on the right.
  const regionX = portrait ? pad.x : width * 0.36;
  const regionW = portrait ? width - pad.x * 2 : width - pad.x - regionX;
  // Heading: above the letter in portrait; in landscape it sits in the left column
  // above the snowman, so the open flap behind the letter never runs into it.
  const headH = heading ? (portrait ? height * 0.08 : height * 0.24) : 0;
  const headX = portrait ? pad.x : pad.x;
  const headW = portrait ? width - pad.x * 2 : regionX - pad.x - 40;
  const regionTop = portrait ? pad.top + headH + 10 : pad.top + 10;
  const regionBottom = portrait ? height * 0.7 : height - pad.bottom + 10;

  // ── Final letter (in front) + envelope (open, behind it)
  const envOverhang = portrait ? 44 : 48; // envelope visible below the letter
  const letterW = regionW * (portrait ? 0.82 : 0.84);
  const letterH = regionBottom - regionTop - envOverhang - 20;
  const letterFinalY = regionTop + 20;
  const envW = letterW * 1.08; // peeks out at both sides
  const envH = Math.min(envW / 1.6, letterH * 0.9); // classic envelope proportions
  const envX = regionX + (regionW - envW) / 2;
  const envFinalY = letterFinalY + letterH + envOverhang - envH;
  // Before the letter comes out the closed envelope sits centred in the region, then
  // eases down to its final place while the letter slides up.
  const envStartY = Math.min(envFinalY, regionTop + (regionBottom - regionTop - envH) / 2);
  const POCKET_SIDE = 0.42; // pocket's top edge at the sides (share of envH)
  const POCKET_V = 0.72; // depth of the pocket's V at the centre
  const FLAP_DEPTH = 0.45; // closed flap's tip

  // ── Timing
  const envIn = pop(frame, ENV_IN[0], ENV_IN[1]);
  const flap = ease(frame, FLAP_OPEN[0], FLAP_OPEN[1], Easing.inOut(Easing.cubic)); // 0 closed → 1 open
  const flapAngle = flap * 180;
  const slide = ease(frame, SLIDE_OUT[0], SLIDE_OUT[1], Easing.inOut(Easing.cubic));
  const forward = ease(frame, COME_FORWARD[0], COME_FORWARD[1], Easing.inOut(Easing.cubic));
  const inFront = frame >= COME_FORWARD[0];
  const envY = interpolate(slide, [0, 1], [envStartY, envFinalY]);
  // Letter: tucked in the pocket at a smaller size, slides up until its bottom clears
  // the pocket, then grows and comes forward/down to rest over the envelope.
  const tuckScale = Math.min(0.72, (envH * 0.86) / letterH, (envW * 0.86) / letterW);
  const tuckedH = letterH * tuckScale;
  const startY = envStartY + envH * 0.1;
  const outY = envFinalY + envH * POCKET_SIDE - tuckedH - 14;
  const letterScale = tuckScale + (1 - tuckScale) * forward;
  const curW = letterW * letterScale;
  const curH = letterH * letterScale;
  const curY = forward > 0 ? interpolate(forward, [0, 1], [outY, letterFinalY]) : interpolate(slide, [0, 1], [startY, outY]);
  const curX = regionX + (regionW - curW) / 2;
  const tilt = forward > 0 ? (1 - forward) * -2.5 : -2.5 * slide;
  const quoteIn = ease(frame, COME_FORWARD[1] - 4, COME_FORWARD[1] + 26);
  const attrIn = ease(frame, COME_FORWARD[1] + 18, COME_FORWARD[1] + 36);
  const headIn = ease(frame, 4, 24);

  const inner = portrait ? 52 : 60;
  const textW = letterW - inner * 2;
  const attrPx = type.bodyRelative(portrait ? 44 : 38);
  const quoteMaxH = letterH - inner * 2 - (attribution ? attrPx * 1.6 : 0) - 40;
  const paper = mix("#FFF8EC", pal.sky, 0.08);
  const rule = portrait ? 74 : 66;

  // ── Snowman (left / bottom-left)
  const snowH = portrait ? height * 0.24 : height * 0.66;
  const snowW = (snowH * 300) / 460;
  const snowLeft = portrait ? pad.x - 20 : (regionX - snowW) / 2 + 10;
  const snowTop = height * 0.95 - snowH;
  const snowBuild = interpolate(frame, [10, 56], [0, 1], clamp);

  const envColor = pal.accent;
  const envDark = mix(pal.accent, "#000000", 0.25);
  const lining = mix(FESTIVE.gold, "#ffffff", 0.35);

  // The flap: a triangle hinged on the envelope's top edge. Closed it points down
  // over the front; open it flips up behind the letter.
  const flapH = envH * FLAP_DEPTH;
  const flapEl = (
    <div
      style={{
        position: "absolute",
        left: envX,
        top: envY,
        width: envW,
        height: flapH,
        transformOrigin: "50% 0%",
        transform: `perspective(1800px) rotateX(${flapAngle.toFixed(2)}deg)`,
        transformStyle: "preserve-3d",
      }}
    >
      {/* outside of the flap */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          clipPath: "polygon(0 0, 100% 0, 50% 100%)",
          background: `linear-gradient(180deg, ${envDark}, ${envColor})`,
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
        }}
      />
      {/* inside of the flap (patterned lining), seen once it is open. This face is
          flipped twice (its own rotateX + the hinge), so its triangle is drawn
          tip-UP to end up pointing up above the envelope. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          clipPath: "polygon(0 100%, 100% 100%, 50% 0)",
          background: `repeating-linear-gradient(45deg, ${lining} 0 16px, ${mix(lining, envColor, 0.18)} 16px 32px)`,
          transform: "rotateX(180deg)",
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
        }}
      />
      {/* gold seal on the tip */}
      <svg
        width={86}
        height={86}
        viewBox="-43 -43 86 86"
        style={{ position: "absolute", left: envW / 2 - 43, top: flapH - 62, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
      >
        <circle r={36} fill={FESTIVE.gold} />
        <circle r={28} fill="none" stroke={mix(FESTIVE.gold, "#7a5a10", 0.45)} strokeWidth={3} />
        <path d={starPath(0, 0, 18)} fill={mix(FESTIVE.gold, "#7a5a10", 0.45)} />
      </svg>
    </div>
  );

  const letter = (
    <div
      style={{
        position: "absolute",
        left: curX,
        top: curY,
        width: curW,
        height: curH,
        transform: `rotate(${tilt.toFixed(2)}deg)`,
        // Hidden while the envelope is still sealed (its corners would peek past the flap).
        opacity: flap > 0.5 ? 1 : 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: letterW,
          height: letterH,
          transform: `scale(${letterScale})`,
          transformOrigin: "0 0",
          borderRadius: 6,
          boxShadow: `0 20px 40px ${pal.shadow}`,
          backgroundColor: paper,
          backgroundImage: `repeating-linear-gradient(180deg, transparent 0 ${rule}px, ${withOpacity(FESTIVE.snowShade, 0.35)} ${rule}px ${rule + 2}px)`,
        }}
      >
        {/* holly corner */}
        <svg width={140} height={100} viewBox="0 0 140 100" style={{ position: "absolute", right: 16, top: 14, opacity: quoteIn }}>
          <path d="M20 50 Q40 10 70 40 Q60 20 90 18 Q80 40 100 60 Q70 50 70 70 Q50 50 20 50 Z" fill={FESTIVE.pine} />
          <path d="M60 50 Q90 30 120 50 Q100 60 110 80 Q85 66 60 50 Z" fill={FESTIVE.pineDark} />
          <circle cx={66} cy={56} r={9} fill={pal.accent} />
          <circle cx={78} cy={64} r={9} fill={pal.accent} />
          <circle cx={56} cy={66} r={9} fill={pal.accent} />
        </svg>
        <div style={{ position: "absolute", inset: inner, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div
            style={{
              opacity: interpolate(quoteIn, [0, 0.2], [0, 1], clamp),
              WebkitMaskImage: quoteIn < 1 ? `linear-gradient(180deg, #000 ${quoteIn * 100}%, transparent ${quoteIn * 100 + 8}%)` : undefined,
              maskImage: quoteIn < 1 ? `linear-gradient(180deg, #000 ${quoteIn * 100}%, transparent ${quoteIn * 100 + 8}%)` : undefined,
            }}
          >
            <FitText
              targetPx={type.body}
              minPx={portrait ? 30 : 26}
              maxHeightPx={Math.max(120, quoteMaxH)}
              maxWidthPx={textW}
              fitKey={`lq-quote:${quote}:${portrait}:${Boolean(attribution)}`}
              exact={type.bodyIsUserSet}
              style={{ fontFamily: fonts.body, fontWeight: 600, fontStyle: "italic", lineHeight: 1.4, color: pal.ink }}
            >
              {`“${quote}”`}
            </FitText>
          </div>
          {attribution ? (
            <div style={{ marginTop: 26, alignSelf: "flex-end", opacity: attrIn, transform: `translateX(${(1 - attrIn) * 30}px)` }}>
              <FitText
                targetPx={attrPx}
                minPx={Math.min(attrPx, 20)}
                maxHeightPx={attrPx * 1.4}
                maxWidthPx={textW}
                fitKey={`lq-attr:${attribution}:${portrait}`}
                style={{ fontFamily: fonts.title, fontWeight: fonts.titleWeight, color: pal.accent, whiteSpace: "nowrap", lineHeight: 1.2, textAlign: "right", width: "auto" }}
              >
                {`— ${attribution}`}
              </FitText>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  // Front pocket: the two side flaps + bottom flap, meeting in a V.
  const pocket = (
    <svg
      width={envW}
      height={envH}
      viewBox={`0 0 ${envW} ${envH}`}
      style={{ position: "absolute", left: envX, top: envY, overflow: "visible" }}
    >
      {/* side flaps */}
      <path d={`M0 ${envH * POCKET_SIDE} L${envW * 0.5} ${envH * POCKET_V} L0 ${envH} Z`} fill={mix(envColor, "#000000", 0.06)} />
      <path d={`M${envW} ${envH * POCKET_SIDE} L${envW * 0.5} ${envH * POCKET_V} L${envW} ${envH} Z`} fill={mix(envColor, "#000000", 0.06)} />
      {/* bottom flap */}
      <path d={`M0 ${envH} L${envW * 0.5} ${envH * 0.56} L${envW} ${envH} Z`} fill={mix(envColor, "#ffffff", 0.06)} />
      <path d={`M0 ${envH} L${envW * 0.5} ${envH * 0.56} L${envW} ${envH}`} stroke={envDark} strokeWidth={2.5} fill="none" opacity={0.6} />
      <path d={`M0 ${envH * POCKET_SIDE} L${envW * 0.5} ${envH * POCKET_V} L${envW} ${envH * POCKET_SIDE}`} stroke={envDark} strokeWidth={3} fill="none" />
      <path
        d={`M-20 ${envH + 6} Q${envW * 0.3} ${envH - 14} ${envW / 2} ${envH} Q${envW * 0.7} ${envH - 18} ${envW + 20} ${envH + 6} Z`}
        fill={FESTIVE.snow}
      />
    </svg>
  );

  return (
    <AbsoluteFill style={{ overflow: "hidden", color: pal.ink }}>
      <WinterBackdrop pal={pal} seed={seed + 8} horizon={portrait ? 0.66 : 0.72} />
      <LayeredSnow portrait={portrait} seed={seed} layer="back" density={0.7} />

      {heading ? (
        <div
          style={{
            position: "absolute",
            left: headX,
            top: pad.top,
            width: headW,
            height: headH,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 18,
            opacity: headIn,
          }}
        >
          <GoldStar size={type.titleRelative(portrait ? 50 : 44)} glow={0.6} />
          <FitText
            targetPx={type.title}
            minPx={portrait ? 40 : 34}
            maxHeightPx={headH}
            maxWidthPx={headW - 140}
            fitKey={`lq-head:${heading}:${portrait}`}
            exact={type.titleIsUserSet}
            style={{ fontFamily: fonts.title, fontWeight: fonts.titleWeight, lineHeight: 1.05, color: pal.accent, textAlign: "center", width: "auto" }}
          >
            {heading}
          </FitText>
          <GoldStar size={type.titleRelative(portrait ? 50 : 44)} glow={0.6} />
        </div>
      ) : null}

      {/* envelope + letter (draw order does the tucking) */}
      <div style={{ position: "absolute", inset: 0, transform: `scale(${envIn})`, transformOrigin: `${envX + envW / 2}px ${envY + envH}px` }}>
        {/* back panel (inside of the envelope) */}
        <div style={{ position: "absolute", left: envX, top: envY, width: envW, height: envH, borderRadius: 8, background: envDark, boxShadow: `0 14px 26px ${pal.shadow}` }} />
        <div
          style={{
            position: "absolute",
            left: envX + 10,
            top: envY + 10,
            width: envW - 20,
            height: envH * POCKET_V,
            borderRadius: 6,
            background: `repeating-linear-gradient(45deg, ${lining} 0 16px, ${mix(lining, envColor, 0.18)} 16px 32px)`,
            opacity: flap,
          }}
        />
        {flapAngle > 90 ? flapEl : null}
        {!inFront ? letter : null}
        {pocket}
        {flapAngle <= 90 ? flapEl : null}
      </div>
      {inFront ? letter : null}

      {/* snowman: snowballs, face, a red muffler and waving, mittened stick arms */}
      <Snowman
        frame={frame}
        accent={pal.accent}
        build={snowBuild}
        hat={false}
        mittenColor={pal.accent}
        buttons={false}
        shade={pal.snowShade}
        height={snowH}
        style={{ position: "absolute", left: snowLeft, top: snowTop }}
      />
      {/* Portrait only: a second snowman, mirrored on the right so the two face each
          other, with a green muffler. He builds a beat later and blinks out of step. */}
      {portrait ? (
        <div style={{ position: "absolute", left: width - pad.x + 20 - snowW, top: snowTop, width: snowW, height: snowH, transform: "scaleX(-1)" }}>
          <Snowman
            frame={frame + 23}
            accent={pal.accent}
            build={interpolate(frame, [18, 64], [0, 1], clamp)}
            hat={false}
            buttons={false}
            scarfColor={FESTIVE.pine}
            mittenColor={FESTIVE.pine}
            shade={pal.snowShade}
            height={snowH}
          />
        </div>
      ) : null}

      <LayeredSnow portrait={portrait} seed={seed} layer="front" density={0.45} />
      <SnowClearIn frame={frame} />
      <SnowGustExit exit={exit} portrait={portrait} seed={seed} />
    </AbsoluteFill>
  );
};
