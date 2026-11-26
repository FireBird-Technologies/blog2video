/**
 * ending_socials — the closing scene ("Santa's Farewell").
 * Santa stands in the snow beside a fully lit Christmas tree, waving. The Title is
 * the big closing line on a hanging sign and the Display text sits under it. The
 * call-to-action links are gift tags; the enabled socials hang below as glass
 * baubles with the platform icon and handle. In the last second the sleigh lifts
 * off across the sky. No exit gust — this is the end of the video.
 *
 * Mirror byte-identical in all three trees.
 */
import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { resolveEnabledSocials, SOCIAL_ICONS } from "../../SocialIcons";
import type { SceneLayoutProps } from "../types";
import { clamp, FESTIVE, mix, withOpacity } from "../christmasStyle";
import { getChristmasTypography } from "../typography";
import { ease, pop, useChristmasScene } from "../components/sceneKit";
import { FitText } from "../components/FitText";
import { probeStyle, useNaturalHeight } from "../components/useNaturalHeight";
import { WinterBackdrop } from "../components/WinterBackdrop";
import { LayeredSnow } from "../components/Snowfall";
import { FrostCard } from "../components/FrostCard";
import { Santa } from "../components/Santa";
import { ChristmasTree } from "../components/ChristmasTree";
import { SleighTeam } from "../components/Sleigh";
import { GiftTag, Sparkles } from "../components/Festive";
import { SnowClearIn } from "../components/SnowGustExit";

const readable = (value?: string) =>
  (value || "").trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
const isEnabled = (value: boolean | string | undefined) =>
  value === undefined || value === true || String(value).toLowerCase() === "true";

export const EndingSocials: React.FC<SceneLayoutProps> = (props) => {
  const { frame, width, height, portrait, pal, fonts, pad, seed, total } = useChristmasScene(props);
  const p = portrait;
  // Default sizes — must match backend/templates/christmas/meta.json; Template Studio rewrites these literals.
  const type = getChristmasTypography(props, (titleFontSize, descriptionFontSize) => ({
    title: titleFontSize ?? (p ? 120 : 81),
    body: descriptionFontSize ?? (p ? 50 : 42),
  }));
  const closingLine = (props.title || "").trim();
  const closing = (props.displayText || "").trim();

  const ctas = (props.ctas?.length
    ? props.ctas
    : [{ ctaButtonText: props.ctaButtonText, websiteLink: props.websiteLink, showWebsiteButton: props.showWebsiteButton }])
    .filter((c) => isEnabled(c.showWebsiteButton) && Boolean(c.websiteLink?.trim()))
    .slice(0, 3)
    .map((c) => ({ dest: readable(c.websiteLink), label: (c.ctaButtonText || "").trim() }));
  const socials = resolveEnabledSocials(props.socials).map(({ key, item }) => ({
    key: String(key),
    Icon: SOCIAL_ICONS[key],
    label: String(item.label || item.text || item.url || key).trim(),
  }));

  // ── geometry ──
  const sceneryH = portrait ? height * 0.3 : height * 0.62;
  const santaH = portrait ? sceneryH * 0.85 : sceneryH * 0.72;
  const treeH = portrait ? sceneryH * 1.05 : sceneryH;
  const groundY = portrait ? height - pad.bottom + 60 : height - 70;
  const colX = portrait ? pad.x : width * 0.42;
  const colW = portrait ? width - pad.x * 2 : width - colX - pad.x;
  const baseSignH = portrait ? height * 0.24 : height * 0.34;
  const signTop = pad.top + 30;
  const listGap = 100; // sign → CTA tags
  const listBottom = portrait ? groundY - sceneryH - 20 : height - pad.bottom;
  const tagPx = type.bodyRelative(portrait ? 34 : 30);
  // Room for one CTA line inside its gift tag (tag padding + point + edge strip).
  const ctaTextMaxW = Math.max(160, colW - 140);
  const socialPx = type.bodyRelative(portrait ? 28 : 24);
  const ball = portrait ? 96 : 84;

  // ── The sign grows (downward) to fit the closing text at its chosen sizes; the CTA
  // tags + socials move down with it. Its limit leaves room for that whole list above
  // the bottom edge (landscape) or above Santa and the tree (portrait).
  const signInner = portrait ? 36 : 40;
  const signTextW = colW - (portrait ? 100 : 110);
  const titleProbe = React.useRef<HTMLDivElement>(null);
  const closingProbe = React.useRef<HTMLDivElement>(null);
  const titleNatural = useNaturalHeight(titleProbe, [closingLine, type.title, signTextW, fonts.title]);
  const closingNatural = useNaturalHeight(closingProbe, [closing, type.body, signTextW, fonts.body]);
  const boardFrame = Math.max(14, Math.min(colW, baseSignH) * 0.035);
  const signChrome = signInner * 2 + boardFrame * 2 + 16;
  const ctaRowH = tagPx * 2.5 + 40;
  const perSocialRow = Math.max(1, Math.floor((colW + 30) / ((portrait ? 260 : 240) + 30)));
  const socialRowH = ball * 1.12 + 46 + socialPx * 1.3;
  const listNeed =
    ctas.length * ctaRowH +
    (ctas.length && socials.length ? 24 : 0) +
    Math.ceil(socials.length / perSocialRow) * socialRowH;
  const maxSignH = Math.max(baseSignH, listBottom - signTop - listGap - listNeed);
  const contentH = titleNatural + (closing ? 12 + closingNatural : 0);
  const signH = Math.max(baseSignH, Math.min(maxSignH, contentH + signChrome));
  const textRoom = signH - signChrome - (closing ? 12 : 0);
  const naturalSum = Math.max(1, titleNatural + (closing ? closingNatural : 0));
  const fitsNaturally = naturalSum <= textRoom;
  const titleMaxH = fitsNaturally ? titleNatural + 8 : (textRoom * titleNatural) / naturalSum;
  const closingMaxH = fitsNaturally ? closingNatural + 8 : (textRoom * closingNatural) / naturalSum;
  // CTA tags + socials start a little below the (possibly grown) sign.
  const listTop = signTop + signH + listGap;

  // ── timing ──
  const sceneryIn = ease(frame, 0, 30);
  const signDrop = pop(frame, 8, 34);
  const capIn = ease(frame, 28, 46);
  const titleIn = ease(frame, 26, 48);
  const closingIn = ease(frame, 40, 66);
  const liftStart = Math.max(90, total - 46);
  const lift = interpolate(frame, [liftStart, total], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ overflow: "hidden", color: pal.ink }}>
      <WinterBackdrop pal={pal} seed={seed + 14} horizon={portrait ? 0.84 : 0.78} trees={false} />
      <LayeredSnow portrait={portrait} seed={seed} layer="back" />

      {/* sleigh lifting off at the very end */}
      {lift > 0 ? (
        <SleighTeam
          frame={frame}
          width={portrait ? width * 0.7 : width * 0.32}
          accent={pal.accent}
          style={{
            position: "absolute",
            left: interpolate(lift, [0, 1], [-width * 0.3, width * 1.05]),
            top: interpolate(lift, [0, 1], [height * 0.35, height * 0.02]),
            transform: `rotate(${-12}deg)`,
          }}
        />
      ) : null}

      {/* tree + Santa */}
      <div style={{ position: "absolute", left: portrait ? width * 0.52 : pad.x * 0.6 + santaH * 0.55, top: groundY - treeH, opacity: sceneryIn }}>
        <ChristmasTree frame={frame} accent={pal.accent} grow={ease(frame, 0, 28)} garland={ease(frame, 20, 50)} lights={ease(frame, 30, 70)} star={ease(frame, 50, 70)} height={treeH} />
      </div>
      <div
        style={{
          position: "absolute",
          left: portrait ? width * 0.12 : pad.x * 0.6,
          top: groundY - santaH + interpolate(sceneryIn, [0, 1], [santaH * 0.4, 0]),
          opacity: sceneryIn * (1 - lift),
        }}
      >
        <Santa frame={frame} pose="wave" height={santaH} />
      </div>
      <Sparkles frame={frame} width={portrait ? width : width * 0.42} height={sceneryH} count={12} seed={seed + 3} opacity={ease(frame, 50, 80)} style={{ left: 0, top: groundY - sceneryH }} />

      {/* closing sign */}
      <div style={{ position: "absolute", left: colX, top: signTop + interpolate(signDrop, [0, 1], [-height * 0.7, 0]) }}>
        <FrostCard pal={pal} width={colW} height={signH} seed={seed + 23} snow={capIn} ropes={signTop + 40}>
          <div style={{ position: "absolute", inset: signInner, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 12 }}>
            <div style={{ opacity: titleIn, transform: `scale(${0.85 + 0.15 * titleIn})` }}>
              <FitText
                targetPx={type.title}
                minPx={portrait ? 50 : 44}
                maxHeightPx={Math.max(40, titleMaxH)}
                maxWidthPx={signTextW}
                fitKey={`es-title:${closingLine}:${portrait}:${Boolean(closing)}`}
                exact={type.titleIsUserSet}
                style={{ fontFamily: fonts.title, fontWeight: fonts.titleWeight, lineHeight: 1.02, color: pal.accent }}
              >
                {closingLine}
              </FitText>
            </div>
            {closing ? (
              <div style={{ opacity: closingIn }}>
                <FitText
                  targetPx={type.body}
                  minPx={portrait ? 26 : 22}
                  maxHeightPx={Math.max(28, closingMaxH)}
                  maxWidthPx={signTextW}
                  fitKey={`es-closing:${closing}:${portrait}`}
                  exact={type.bodyIsUserSet}
                  style={{ fontFamily: fonts.body, fontWeight: 700, lineHeight: 1.3, color: pal.inkSoft }}
                >
                  {closing}
                </FitText>
              </div>
            ) : null}
          </div>
        </FrostCard>
      </div>

      {/* off-screen probes: the closing texts at their chosen sizes, for sizing the sign */}
      <div ref={titleProbe} style={{ ...probeStyle(signTextW), fontFamily: fonts.title, fontWeight: fonts.titleWeight, fontSize: type.title, lineHeight: 1.02, textAlign: "center" }}>
        {closingLine}
      </div>
      <div ref={closingProbe} style={{ ...probeStyle(signTextW), fontFamily: fonts.body, fontWeight: 700, fontSize: type.body, lineHeight: 1.3, textAlign: "center" }}>
        {closing}
      </div>

      {/* CTAs (gift tags) + socials (baubles) */}
      <div
        style={{
          position: "absolute",
          left: colX,
          top: listTop,
          width: colW,
          height: Math.max(0, listBottom - listTop),
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: portrait ? 26 : 22,
        }}
      >
        {ctas.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 22 }}>
            {ctas.map((c, i) => {
              const inP = pop(frame, 52 + i * 8, 72 + i * 8);
              return (
                <div key={i} style={{ transform: `scale(${inP}) rotate(${Math.sin(frame / 16 + i) * 1.5}deg)` }}>
                  <GiftTag ink={pal.ink} accent={i % 2 ? FESTIVE.pine : pal.accent} padding={portrait ? 16 : 14}>
                    {/* button label and link on separate lines */}
                    {/* Each line shrinks to fit the column when it is long. */}
                    <div style={{ fontFamily: fonts.body, display: "flex", flexDirection: "column", gap: 2 }}>
                      {c.label ? (
                        <FitText
                          targetPx={tagPx}
                          minPx={Math.min(tagPx, 16)}
                          maxHeightPx={tagPx * 1.3}
                          maxWidthPx={ctaTextMaxW}
                          fitKey={`es-cta-label:${i}:${c.label}:${portrait}`}
                          style={{ fontWeight: 800, lineHeight: 1.2, whiteSpace: "nowrap", color: pal.accent, width: "auto" }}
                        >
                          {c.label}
                        </FitText>
                      ) : null}
                      <FitText
                        targetPx={c.label ? tagPx * 0.86 : tagPx}
                        minPx={Math.min(tagPx * 0.86, 14)}
                        maxHeightPx={tagPx * 1.3}
                        maxWidthPx={ctaTextMaxW}
                        fitKey={`es-cta-link:${i}:${c.dest}:${portrait}:${Boolean(c.label)}`}
                        style={{ fontWeight: 700, lineHeight: 1.2, whiteSpace: "nowrap", color: pal.ink, width: "auto" }}
                      >
                        {c.dest}
                      </FitText>
                    </div>
                  </GiftTag>
                </div>
              );
            })}
          </div>
        ) : null}

        {socials.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: portrait ? 26 : 30 }}>
            {socials.map((s, i) => {
              const inP = pop(frame, 66 + i * 6, 86 + i * 6);
              const swing = Math.sin(frame / 14 + i * 1.3) * 4;
              return (
                <div key={s.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", transform: `scale(${inP}) rotate(${swing}deg)`, transformOrigin: "50% 0%", maxWidth: portrait ? 260 : 240 }}>
                  <div style={{ width: 4, height: 26, background: FESTIVE.gold }} />
                  <div style={{ width: ball * 0.32, height: ball * 0.12, borderRadius: 4, background: FESTIVE.gold }} />
                  <div
                    style={{
                      width: ball,
                      height: ball,
                      borderRadius: "50%",
                      background: `radial-gradient(circle at 32% 28%, ${FESTIVE.snow}, ${mix(FESTIVE.snow, pal.sky, 0.4)} 60%, ${pal.snowShade})`,
                      border: `4px solid ${i % 2 ? FESTIVE.pine : pal.accent}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: `0 8px 14px ${pal.shadow}`,
                    }}
                  >
                    <s.Icon size={ball * 0.5} />
                  </div>
                  {/* handle shrinks to fit under its bauble when it is long */}
                  <div style={{ marginTop: 10, background: withOpacity(FESTIVE.snow, 0.8), borderRadius: 10, padding: "2px 10px" }}>
                    <FitText
                      targetPx={socialPx}
                      minPx={Math.min(socialPx, 13)}
                      maxHeightPx={socialPx * 1.3}
                      maxWidthPx={(portrait ? 260 : 240) - 20}
                      fitKey={`es-social:${s.key}:${s.label}:${portrait}`}
                      style={{ fontFamily: fonts.body, fontWeight: 800, color: pal.ink, textAlign: "center", whiteSpace: "nowrap", lineHeight: 1.2, width: "auto" }}
                    >
                      {s.label}
                    </FitText>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <LayeredSnow portrait={portrait} seed={seed} layer="front" density={0.6} />
      <SnowClearIn frame={frame} />
    </AbsoluteFill>
  );
};
