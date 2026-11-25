/**
 * snow_compare — two sides of one comparison ("Snow Compare").
 *
 * On the snowy day, two columns face each other across a candy-cane divider with a
 * gold star. Each column is headed by its title on a snow-capped ribbon banner (red
 * on the left, green on the right), and lists 3–4 points underneath. Points are
 * paired row by row — the left point and the right point on the same row oppose each
 * other — each with a snowflake bullet and underlined by its own strip of snow, set
 * on a fluffy cushion of snow foam so the text never blends into the scenery.
 * The scene Title is the heading. Exit: the snow gust.
 *
 * Mirror byte-identical in all three trees.
 */
import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import type { SceneLayoutProps } from "../types";
import { christmasRand, clamp, FESTIVE, mix, withOpacity, type WinterPalette } from "../christmasStyle";
import { getChristmasTypography } from "../typography";
import { ease, pop, sentences, useChristmasScene } from "../components/sceneKit";
import { FitText } from "../components/FitText";
import { WinterBackdrop } from "../components/WinterBackdrop";
import { LayeredSnow } from "../components/Snowfall";
import { snowCapPath } from "../components/FrostCard";
import { GoldStar } from "../components/Festive";
import { SnowFoam, SnowUnderline, SnowflakeBullet } from "../components/SnowPoints";
import { SnowClearIn, SnowGustExit } from "../components/SnowGustExit";

/** Column title on a ribbon banner with a lumpy snow cap. */
const SnowBanner: React.FC<{
  width: number;
  height: number;
  color: string;
  seed: number;
  snow: number;
  pal: WinterPalette;
  children?: React.ReactNode;
}> = ({ width, height, color, seed, snow, pal, children }) => {
  const capH = Math.max(18, Math.min(34, width * 0.05));
  return (
    <div style={{ position: "relative", width, height }}>
      {/* ribbon tails */}
      {[-1, 1].map((side) => (
        <div
          key={side}
          style={{
            position: "absolute",
            top: height * 0.28,
            [side < 0 ? "left" : "right"]: -height * 0.42,
            width: height * 0.7,
            height: height * 0.72,
            background: mix(color, "#000000", 0.22),
            clipPath: side < 0 ? "polygon(0 0, 100% 0, 100% 100%, 0 100%, 30% 50%)" : "polygon(0 0, 100% 0, 70% 50%, 100% 100%, 0 100%)",
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 10,
          background: `linear-gradient(180deg, ${mix(color, "#ffffff", 0.12)}, ${color} 55%, ${mix(color, "#000000", 0.12)})`,
          boxShadow: `0 10px 20px ${pal.shadow}, inset 0 0 0 3px ${withOpacity(FESTIVE.gold, 0.8)}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 24px",
          boxSizing: "border-box",
        }}
      >
        {children}
      </div>
      {snow > 0 ? (
        <svg
          width={width + capH}
          height={capH * 2}
          viewBox={`${-capH * 0.5} 0 ${width + capH} ${capH * 2}`}
          style={{ position: "absolute", left: -capH * 0.5, top: -capH * 0.6, overflow: "visible", opacity: snow }}
        >
          <path d={snowCapPath(width, capH, seed)} fill={FESTIVE.snow} stroke={withOpacity(pal.snowShade, 0.7)} strokeWidth={1.5} />
        </svg>
      ) : null}
    </div>
  );
};

export const SnowCompare: React.FC<SceneLayoutProps> = (props) => {
  const { frame, width, height, portrait, pal, fonts, pad, exit, seed } = useChristmasScene(props);
  const p = portrait;
  // Default sizes — must match backend/templates/christmas/meta.json; Template Studio rewrites these literals.
  const type = getChristmasTypography(props, (titleFontSize, descriptionFontSize) => ({
    title: titleFontSize ?? (p ? 92 : 91),
    body: descriptionFontSize ?? (p ? 51 : 42),
  }));
  const heading = (props.title || "").trim();
  // 3–4 points per side, paired row by row; legacy leftText / rightText are split
  // into sentences when no points are given.
  const pointsOf = (list: string[] | undefined, legacy: string | undefined) => {
    const clean = (list || []).map((x) => String(x || "").trim()).filter(Boolean);
    return (clean.length ? clean : sentences(legacy || "", 4)).slice(0, 4);
  };
  const sides = [
    { label: (props.leftLabel || "").trim(), points: pointsOf(props.leftPoints, props.leftText), color: pal.accent },
    { label: (props.rightLabel || "").trim(), points: pointsOf(props.rightPoints, props.rightText), color: FESTIVE.pine },
  ];
  const rows = Math.max(1, sides[0].points.length, sides[1].points.length);

  const contentW = width - pad.x * 2;
  const headH = portrait ? height * 0.1 : height * 0.13;
  const gap = portrait ? 50 : 110;
  const colW = (contentW - gap) / 2;
  const bannerH = portrait ? 96 : 84;
  const bannerW = colW * (portrait ? 0.86 : 0.7);
  const bannerTop = pad.top + headH + (portrait ? 46 : 36);
  const listTop = bannerTop + bannerH + (portrait ? 40 : 30);
  const listBottom = height - pad.bottom;
  const rowH = (listBottom - listTop) / rows;
  const pointW = colW - (portrait ? 10 : 30);
  const bulletPx = type.bodyRelative(portrait ? 30 : 28);

  const headIn = ease(frame, 2, 24);
  const dividerIn = ease(frame, 14, 38);

  return (
    <AbsoluteFill style={{ overflow: "hidden", color: pal.ink }}>
      <WinterBackdrop pal={pal} seed={seed + 14} horizon={portrait ? 0.78 : 0.74} trees={!portrait} />
      <LayeredSnow portrait={portrait} seed={seed} layer="back" density={0.7} />

      <div
        style={{
          position: "absolute",
          left: pad.x,
          top: pad.top,
          width: contentW,
          height: headH,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          opacity: headIn,
        }}
      >
        <FitText
          targetPx={type.title}
          minPx={portrait ? 42 : 36}
          maxHeightPx={headH}
          maxWidthPx={contentW}
          fitKey={`sc-head:${heading}:${portrait}`}
          exact={type.titleIsUserSet}
          style={{ fontFamily: fonts.title, fontWeight: fonts.titleWeight, lineHeight: 1.05, color: pal.accent, textShadow: `0 2px 0 ${FESTIVE.snow}` }}
        >
          {heading}
        </FitText>
      </div>

      {/* candy-cane divider with a gold star at the banners */}
      <div
        style={{
          position: "absolute",
          left: width / 2 - 5,
          top: bannerTop,
          width: 10,
          height: (listBottom - bannerTop) * dividerIn,
          borderRadius: 5,
          background: `repeating-linear-gradient(45deg, ${pal.accent} 0 14px, ${FESTIVE.snow} 14px 28px)`,
          boxShadow: `0 1px 3px ${pal.shadow}`,
        }}
      />
      <GoldStar
        size={portrait ? 62 : 66}
        glow={dividerIn}
        style={{
          position: "absolute",
          left: width / 2 - (portrait ? 31 : 33),
          top: bannerTop + bannerH / 2 - (portrait ? 31 : 33),
          transform: `scale(${dividerIn}) rotate(${(1 - dividerIn) * -90}deg)`,
        }}
      />

      {sides.map((s, i) => {
        const colX = pad.x + i * (colW + gap);
        const bannerIn = pop(frame, 8 + i * 8, 28 + i * 8);
        return (
          <React.Fragment key={i}>
            {s.label ? (
              <div
                style={{
                  position: "absolute",
                  left: colX + (colW - bannerW) / 2,
                  top: bannerTop,
                  transform: `scale(${bannerIn})`,
                  opacity: interpolate(bannerIn, [0, 0.2], [0, 1], clamp),
                }}
              >
                <SnowBanner width={bannerW} height={bannerH} color={s.color} seed={seed + i * 11} snow={ease(frame, 24 + i * 8, 40 + i * 8)} pal={pal}>
                  <FitText
                    targetPx={type.titleRelative(portrait ? 60 : 54)}
                    minPx={26}
                    maxHeightPx={bannerH - 12}
                    maxWidthPx={bannerW - 48}
                    fitKey={`sc-label:${i}:${s.label}:${portrait}`}
                    style={{ fontFamily: fonts.title, fontWeight: fonts.titleWeight, lineHeight: 1, color: FESTIVE.snow, textAlign: "center", textShadow: `0 2px 0 ${withOpacity("#000000", 0.2)}` }}
                  >
                    {s.label}
                  </FitText>
                </SnowBanner>
              </div>
            ) : null}

            {s.points.map((pt, j) => {
              // Rows reveal pair by pair (left then right), so opposites appear together.
              const start = 34 + j * 18 + i * 6;
              const inP = pop(frame, start, start + 16);
              const snowIn = ease(frame, start + 4, start + 22);
              return (
                <div
                  key={j}
                  style={{
                    position: "absolute",
                    left: colX + (colW - pointW) / 2,
                    top: listTop + rowH * j,
                    width: pointW,
                    height: rowH,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: interpolate(inP, [0, 0.3], [0, 1], clamp),
                    transform: `translateY(${(1 - inP) * 20}px)`,
                  }}
                >
                  {/* foam a little wider than the point, spilling out on both sides */}
                  <SnowFoam
                    width={pointW * 1.08}
                    left={-pointW * 0.04}
                    height={rowH * 0.84}
                    top={rowH * 0.08}
                    seed={seed + i * 23 + j * 7}
                    pal={pal}
                    frame={frame}
                    puff={inP}
                  />
                  <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14, width: pointW - 20 }}>
                    <SnowflakeBullet size={bulletPx} outline={mix(pal.snowShade, "#4f6a84", 0.45)} />
                    <FitText
                      targetPx={type.body}
                      minPx={portrait ? 20 : 18}
                      maxHeightPx={rowH - 44}
                      maxWidthPx={pointW - 20 - bulletPx - 14}
                      fitKey={`sc-pt:${i}:${j}:${pt}:${portrait}:${rows}`}
                      exact={type.bodyIsUserSet}
                      style={{ fontFamily: fonts.body, fontWeight: 700, lineHeight: 1.28, color: pal.ink }}
                    >
                      {pt}
                    </FitText>
                  </div>
                  <div style={{ position: "relative" }}>
                    <SnowUnderline width={pointW - 20} progress={snowIn} pal={pal} seed={seed + i * 17 + j * 5} frame={frame} />
                  </div>
                </div>
              );
            })}
          </React.Fragment>
        );
      })}

      <LayeredSnow portrait={portrait} seed={seed} layer="front" density={0.35} />
      <SnowClearIn frame={frame} />
      <SnowGustExit exit={exit} portrait={portrait} seed={seed} />
    </AbsoluteFill>
  );
};
