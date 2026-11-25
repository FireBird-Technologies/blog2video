/**
 * gift_stat — 2 to 4 numbers (at most 4 are drawn).
 * Wrapped gifts sit in the snow; one after another their lids pop off and land on
 * the ground beside them, and the number rises high out of the box with a burst of
 * gold sparkles. Landscape: one row. Portrait: a 2-column grid (2 → one row,
 * 3 → 2 + 1 centred, 4 → 2 × 2). The Title sits above, the Display text below.
 * Exit: the snow gust.
 *
 * Mirror byte-identical in all three trees.
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import type { SceneLayoutProps } from "../types";
import { FESTIVE } from "../christmasStyle";
import { getChristmasTypography } from "../typography";
import { ease, pop, useChristmasScene } from "../components/sceneKit";
import { FitText } from "../components/FitText";
import { WinterBackdrop } from "../components/WinterBackdrop";
import { LayeredSnow } from "../components/Snowfall";
import { GiftBox, Sparkles } from "../components/Festive";
import { SnowClearIn, SnowGustExit } from "../components/SnowGustExit";

export const GiftStat: React.FC<SceneLayoutProps> = (props) => {
  const { frame, width, height, portrait, pal, fonts, pad, exit, seed } = useChristmasScene(props);
  const p = portrait;
  // Default sizes — must match backend/templates/christmas/meta.json; Template Studio rewrites these literals.
  const type = getChristmasTypography(props, (titleFontSize, descriptionFontSize) => ({
    title: titleFontSize ?? (p ? 92 : 78),
    body: descriptionFontSize ?? (p ? 46 : 45),
  }));
  const heading = (props.title || "").trim();
  const body = (props.displayText || "").trim();
  const stats = (props.stats || [])
    .map((s) => ({ value: String(s?.value ?? "").trim(), label: String(s?.label ?? "").trim() }))
    .filter((s) => s.value)
    .slice(0, 4);
  const n = Math.max(1, stats.length);

  const contentW = width - pad.x * 2;
  const headH = portrait ? height * 0.16 : height * 0.17;
  const bodyH = portrait ? height * 0.14 : height * 0.13;
  const giftsTop = pad.top + headH + (portrait ? 60 : 30);
  const giftsBottom = height - pad.bottom - bodyH - (portrait ? 40 : 20);
  const giftsH = giftsBottom - giftsTop;

  // Landscape: one row of n. Portrait: 2 columns, rows centred.
  const cols = portrait ? Math.min(2, n) : n;
  const rows = Math.ceil(n / cols);
  const slotW = contentW / cols;
  const slotH = giftsH / rows;
  const boxW = Math.min(slotW * 0.5, slotH * 0.42, 300);
  const boxH = boxW * 0.78;
  // Smaller numbers as the count grows, so the raised numbers never collide.
  const numberPx = type.titleRelative(portrait ? (rows > 1 ? 96 : 120) : n >= 4 ? 96 : n === 3 ? 108 : 118);
  const colors = [pal.accent, FESTIVE.pine, FESTIVE.gold, "#2F6FB0"];
  const ribbons = [FESTIVE.gold, pal.accent, pal.accent, FESTIVE.gold];
  const stagger = n >= 4 ? 12 : 16;

  const headIn = ease(frame, 4, 26);
  const bodyIn = ease(frame, 30 + n * stagger, 60 + n * stagger);

  return (
    <AbsoluteFill style={{ overflow: "hidden", color: pal.ink }}>
      <WinterBackdrop pal={pal} seed={seed + 4} horizon={portrait ? 0.7 : 0.66} />
      <LayeredSnow portrait={portrait} seed={seed} layer="back" density={0.8} />

      <div style={{ position: "absolute", left: pad.x, top: pad.top, width: contentW, height: headH, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", opacity: headIn, transform: `translateY(${(1 - headIn) * -30}px)` }}>
        <FitText
          targetPx={type.title}
          minPx={portrait ? 44 : 38}
          maxHeightPx={headH}
          maxWidthPx={contentW}
          fitKey={`gs-head:${heading}:${portrait}`}
          exact={type.titleIsUserSet}
          style={{ fontFamily: fonts.title, fontWeight: fonts.titleWeight, lineHeight: 1.05, color: pal.accent, textShadow: `0 2px 0 ${FESTIVE.snow}` }}
        >
          {heading}
        </FitText>
      </div>

      {stats.map((s, i) => {
        const start = 18 + i * stagger;
        const arrive = pop(frame, start, start + 18);
        const open = ease(frame, start + 22, start + 56);
        const row = Math.floor(i / cols);
        const col = i - row * cols;
        const inRow = Math.min(cols, n - row * cols);
        const cx = pad.x + contentW / 2 + (col - (inRow - 1) / 2) * slotW;
        const bottom = giftsTop + slotH * (row + 1) - 10;
        // Lids land on the outer side of each gift (away from the middle of its row).
        const lidSide: -1 | 1 = col < (inRow - 1) / 2 || inRow === 1 ? -1 : 1;
        // Number + label shrink to fit the gift's slot when they are long.
        const textMaxW = slotW * 0.94;
        const labelPx = type.bodyRelative(portrait ? 34 : 30);
        const label = s.label ? (
          <FitText
            targetPx={labelPx}
            minPx={Math.min(labelPx, 16)}
            maxHeightPx={labelPx * 2.5}
            maxWidthPx={textMaxW}
            fitKey={`gs-label:${i}:${s.label}:${portrait}:${n}`}
            style={{ fontFamily: fonts.body, fontWeight: 800, color: pal.inkSoft, textAlign: "center", marginTop: 6, lineHeight: 1.15 }}
          >
            {s.label}
          </FitText>
        ) : null;
        return (
          <div key={i} style={{ position: "absolute", left: cx - boxW / 2, top: bottom - boxH * 1.24, transform: `translateY(${(1 - arrive) * 200}px) scale(${0.6 + arrive * 0.4})`, opacity: arrive > 0 ? 1 : 0, transformOrigin: "50% 100%" }}>
            <GiftBox width={boxW} height={boxH} color={colors[i % 4]} ribbon={ribbons[i % 4]} open={open} lidSide={lidSide} childrenHeight={numberPx * 1.6}>
              <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <FitText
                  targetPx={numberPx}
                  minPx={Math.min(numberPx, 36)}
                  maxHeightPx={numberPx * 1.15}
                  maxWidthPx={textMaxW}
                  fitKey={`gs-value:${i}:${s.value}:${portrait}:${n}`}
                  style={{
                    fontFamily: fonts.title,
                    fontWeight: fonts.titleWeight,
                    lineHeight: 1,
                    color: pal.ink,
                    whiteSpace: "nowrap",
                    textAlign: "center",
                    textShadow: `0 3px 0 ${FESTIVE.snow}, 0 0 18px ${FESTIVE.snow}`,
                  }}
                >
                  {s.value}
                </FitText>
                {label}
              </div>
            </GiftBox>
            <Sparkles frame={frame} width={boxW * 1.8} height={boxH * 1.6} count={8} seed={seed + i * 13} opacity={open} style={{ left: -boxW * 0.4, top: -boxH * 1.1 }} />
          </div>
        );
      })}

      {body ? (
        <div style={{ position: "absolute", left: pad.x, top: height - pad.bottom - bodyH, width: contentW, height: bodyH, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", opacity: bodyIn }}>
          <FitText
            targetPx={type.body}
            minPx={portrait ? 28 : 24}
            maxHeightPx={bodyH}
            maxWidthPx={contentW * (portrait ? 1 : 0.8)}
            fitKey={`gs-body:${body}:${portrait}`}
            exact={type.bodyIsUserSet}
            style={{ fontFamily: fonts.body, fontWeight: 700, lineHeight: 1.35, color: pal.ink }}
          >
            {body}
          </FitText>
        </div>
      ) : null}

      <LayeredSnow portrait={portrait} seed={seed} layer="front" density={0.5} />
      <SnowClearIn frame={frame} />
      <SnowGustExit exit={exit} portrait={portrait} seed={seed} />
    </AbsoluteFill>
  );
};
