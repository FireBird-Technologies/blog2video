/**
 * tree_list — 2 to 4 points (at most 4 tags are drawn), plus the scene's Display text.
 *
 * Left (bottom in portrait): a frosted card with the Title, a candy-cane rule and
 * the Display text.
 * Right (top in portrait): a Christmas tree grows tier by tier in the snow; as each
 * list item appears it hangs on a gift tag stuck right against the tree's LEFT side,
 * tied by a short gold string to an ornament there (the tag's point faces the tree).
 * The garland draws on, the lights switch on and the star lights up once every item
 * is out.
 * Exit: the lights twinkle off, then the snow gust.
 *
 * Mirror byte-identical in all three trees.
 */
import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import type { SceneLayoutProps } from "../types";
import { clamp, FESTIVE } from "../christmasStyle";
import { getChristmasTypography } from "../typography";
import { ease, pop, useChristmasScene } from "../components/sceneKit";
import { FitText } from "../components/FitText";
import { WinterBackdrop } from "../components/WinterBackdrop";
import { LayeredSnow } from "../components/Snowfall";
import { FrostCard } from "../components/FrostCard";
import { ChristmasTree } from "../components/ChristmasTree";
import { CandyCaneRule, GiftTag } from "../components/Festive";
import { SnowClearIn, SnowGustExit } from "../components/SnowGustExit";

export const TreeList: React.FC<SceneLayoutProps> = (props) => {
  const { frame, width, height, portrait, pal, fonts, pad, exit, seed, total } = useChristmasScene(props);
  const p = portrait;
  // Default sizes — must match backend/templates/christmas/meta.json; Template Studio rewrites these literals.
  const type = getChristmasTypography(props, (titleFontSize, descriptionFontSize) => ({
    title: titleFontSize ?? (p ? 84 : 76),
    body: descriptionFontSize ?? (p ? 40 : 36),
  }));
  const heading = (props.title || "").trim();
  const body = (props.displayText || "").trim();
  const items = (props.items || [])
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .slice(0, 4);
  const n = Math.max(1, items.length);

  // ── Text card (left / bottom)
  const panelW = portrait ? width - pad.x * 2 : width * 0.36;
  const panelH = portrait ? height * 0.3 : height - pad.top - pad.bottom - 40;
  const panelX = pad.x;
  const panelY = portrait ? height - pad.bottom - panelH : pad.top + 30;
  const inner = portrait ? 44 : 46;
  const textW = panelW - inner * 2;
  const headMaxH = panelH * (portrait ? 0.32 : 0.3);
  const bodyMaxH = panelH - headMaxH - inner * 2 - 50;

  // ── Tree + tags (right / top)
  const areaX = portrait ? pad.x : panelX + panelW + 50;
  const areaRight = width - pad.x;
  const areaW = areaRight - areaX;
  const areaTop = pad.top + (portrait ? 0 : 10);
  const areaBottom = portrait ? panelY - 40 : height - pad.bottom + 40;
  const areaH = areaBottom - areaTop;
  const treeH = Math.min(areaH, areaW * 0.95);
  const treeW = (treeH * 400) / 580;
  const treeX = areaRight - treeW * 0.88;
  const treeY = areaBottom - treeH;
  const k = treeH / 580;

  // Item timing spread over the first ~55% of the scene.
  const itemStart = (i: number) => 34 + i * Math.max(16, Math.min(34, (total * 0.5) / n));
  const lastItem = itemStart(n - 1) + 20;
  const grow = ease(frame, 4, 40);
  const garland = ease(frame, 30, lastItem);
  const lightsOff = interpolate(exit, [0, 0.5], [1, 0], clamp);
  const lights = ease(frame, 40, lastItem + 10) * lightsOff;
  const star = ease(frame, lastItem, lastItem + 24) * lightsOff;
  const panelIn = ease(frame, 6, 28);
  const headIn = ease(frame, 14, 36);
  const ruleIn = ease(frame, 26, 42);
  const bodyIn = ease(frame, 30, 60);

  // Hanging points on the tree's LEFT side, top to bottom (local tree units).
  const anchors = Array.from({ length: n }, (_, i) => {
    const t = n <= 1 ? 0.5 : i / (n - 1);
    const y = 175 + t * 340;
    const half = 80 + ((y - 190) / 320) * 115; // tree half-width at that height
    return { x: 200 - half * 0.8, y };
  });
  const spacing = n <= 1 ? areaH : (340 * k) / (n - 1);
  const tagMaxH = Math.min((areaH / n) * 0.82, spacing * 0.94);

  return (
    <AbsoluteFill style={{ overflow: "hidden", color: pal.ink }}>
      <WinterBackdrop pal={pal} seed={seed + 6} horizon={portrait ? 0.52 : 0.84} trees={false} />
      <LayeredSnow portrait={portrait} seed={seed} layer="back" density={0.8} />

      <ChristmasTree
        frame={frame}
        accent={pal.accent}
        grow={grow}
        garland={garland}
        lights={lights}
        star={star}
        height={treeH}
        style={{ position: "absolute", left: treeX, top: treeY }}
      />

      {items.map((text, i) => {
        const a = anchors[i];
        const ax = treeX + a.x * k;
        const ay = treeY + a.y * k;
        const inP = pop(frame, itemStart(i), itemStart(i) + 18);
        const sway = Math.sin(frame / 15 + i) * 1.5;
        // The tag's pointed tip sits just left of its ornament: stuck to the tree.
        const tipX = ax - 16;
        const tagRoomW = Math.max(200, tipX - areaX);
        return (
          <React.Fragment key={i}>
            <svg width={width} height={height} style={{ position: "absolute", inset: 0, overflow: "visible", opacity: inP }}>
              <path d={`M${ax} ${ay} Q${ax - 8} ${ay + 10} ${tipX + 4} ${ay}`} stroke={FESTIVE.gold} strokeWidth={3} fill="none" />
              <circle cx={ax} cy={ay} r={12} fill={i % 2 ? FESTIVE.gold : pal.accent} stroke={FESTIVE.snow} strokeWidth={2} />
            </svg>
            <div
              style={{
                position: "absolute",
                top: ay - tagMaxH / 2,
                left: tipX - tagRoomW,
                width: tagRoomW,
                height: tagMaxH,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                transform: `scale(${inP}) rotate(${sway}deg)`,
                transformOrigin: "100% 50%",
              }}
            >
              {/* Pointed end (hole + string) faces the tree. */}
              <GiftTag ink={pal.ink} accent={i % 2 ? FESTIVE.pine : pal.accent} padding={portrait ? 15 : 14} point="right">
                <FitText
                  targetPx={type.bodyRelative(portrait ? 38 : 34)}
                  minPx={portrait ? 22 : 20}
                  maxHeightPx={Math.max(40, tagMaxH - 30)}
                  maxWidthPx={Math.max(140, tagRoomW - 100)}
                  fitKey={`tl-item:${i}:${text}:${portrait}:${n}`}
                  style={{ fontFamily: fonts.body, fontWeight: 700, lineHeight: 1.25 }}
                >
                  {text}
                </FitText>
              </GiftTag>
            </div>
          </React.Fragment>
        );
      })}

      {/* Title + Display text card */}
      <div style={{ position: "absolute", left: panelX, top: panelY, opacity: panelIn, transform: `translateX(${(1 - panelIn) * (portrait ? 0 : -60)}px) translateY(${(1 - panelIn) * (portrait ? 40 : 0)}px)` }}>
        <FrostCard pal={pal} width={panelW} height={panelH} variant="frost" seed={seed + 19} snow={panelIn}>
          <div style={{ position: "absolute", inset: inner, display: "flex", flexDirection: "column", justifyContent: "center", gap: portrait ? 20 : 22 }}>
            <div style={{ opacity: headIn, transform: `translateY(${(1 - headIn) * 16}px)` }}>
              <FitText
                targetPx={type.title}
                minPx={portrait ? 42 : 36}
                maxHeightPx={headMaxH}
                maxWidthPx={textW}
                fitKey={`tl-head:${heading}:${portrait}`}
                exact={type.titleIsUserSet}
                style={{ fontFamily: fonts.title, fontWeight: fonts.titleWeight, lineHeight: 1.05, color: pal.accent }}
              >
                {heading}
              </FitText>
            </div>
            <CandyCaneRule width={Math.min(textW * 0.5, 300) * ruleIn} accent={pal.accent} />
            {body ? (
              <div style={{ opacity: bodyIn, transform: `translateY(${(1 - bodyIn) * 14}px)` }}>
                <FitText
                  targetPx={type.body}
                  minPx={portrait ? 24 : 22}
                  maxHeightPx={Math.max(100, bodyMaxH)}
                  maxWidthPx={textW}
                  fitKey={`tl-body:${body}:${portrait}`}
                  exact={type.bodyIsUserSet}
                  style={{ fontFamily: fonts.body, fontWeight: 600, lineHeight: 1.42, color: pal.inkSoft }}
                >
                  {body}
                </FitText>
              </div>
            ) : null}
          </div>
        </FrostCard>
      </div>

      <LayeredSnow portrait={portrait} seed={seed} layer="front" density={0.45} />
      <SnowClearIn frame={frame} />
      <SnowGustExit exit={interpolate(exit, [0.35, 1], [0, 1], clamp)} portrait={portrait} seed={seed} />
    </AbsoluteFill>
  );
};
