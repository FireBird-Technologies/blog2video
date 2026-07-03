import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { SceneLayoutProps } from "../types";
import { SocialIcons } from "../../SocialIcons";
import {
  SAKURA,
  SAKURA_DISPLAY_FONT,
  SAKURA_BODY_FONT,
  SAKURA_DETAIL_FONT,
  SakuraScene,
  KamonWatermark,
  CornerBlossoms,
  SoftPetal,
  hexToRgba,
} from "../sakuraStyle";

export const SakuraEndingSocials: React.FC<SceneLayoutProps> = (props) => {
  const {
    title,
    narration,
    accentColor,
    bgColor,
    aspectRatio,
    sceneDurationInFrames,
    titleFontSize,
    descriptionFontSize,
    fontFamily,
    socials,
  } = props;

  const p = aspectRatio === "portrait";
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 150;

  const brandName = (props as any).brandName ?? title ?? "";
  const tagline = (props as any).tagline ?? narration ?? "";
  const ctaText = (props as any).ctaText ?? "";
  const websiteUrl = (props as any).websiteUrl ?? "";
  const socialHandles: string[] = (props as any).socialHandles ?? [];

  const titlePx = titleFontSize ?? (p ? 80 : 64);
  const taglinePx = descriptionFontSize ?? (p ? 26 : 20);

  const cx = width / 2;
  const cy = height / 2;

  // ── Petal burst (Easing.back flavor, frames 0–24) ─────────────────────────
  const burst = interpolate(frame, [0, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2),
  });

  // ── Reveals ───────────────────────────────────────────────────────────────
  const brandScale = spring({ frame, fps, from: 0.9, to: 1, config: { damping: 18, stiffness: 60 } });
  const brandOpacity = interpolate(frame, [0, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const taglineReveal = interpolate(frame, [12, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });
  const dividerReveal = interpolate(frame, [20, 32], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ctaReveal = spring({
    frame: Math.max(0, frame - 26),
    fps,
    from: 0,
    to: 1,
    config: { damping: 20, stiffness: 55 },
  });
  const websiteReveal = interpolate(frame, [42, 56], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const socialsReveal = interpolate(frame, [50, 64], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const cornerPetalScale = (idx: number) =>
    spring({
      frame: Math.max(0, frame - 30 - idx * 3),
      fps,
      from: 0,
      to: 1,
      config: { damping: 14, stiffness: 90 },
    });

  // ── Concentric counter-rotating petal rings ───────────────────────────────
  const outerR = p ? 330 : 280;
  const innerR = p ? 180 : 150;
  const ringSpin = frame * 0.06;

  const hasSocials =
    socials &&
    (Array.isArray(socials) ? socials.length > 0 : Object.keys(socials).length > 0);

  const boxW = p ? 480 : 420;
  const boxH = p ? 96 : 84;

  return (
    <SakuraScene
      backdrop="celebration"
      entranceLayout="sakura_ending_socials"
      bgColor={bgColor}
      dur={dur}
      petals={p ? 24 : 35}
      petalIntensity={1.4}
      petalSeed={99}
      chrome={
        <>
          {/* Kamon watermark rings */}
          <KamonWatermark cx={cx} cy={cy} r={p ? 420 : 300} color={SAKURA.gold} opacity={0.06} />
          <KamonWatermark cx={cx} cy={cy} r={p ? 310 : 225} color={SAKURA.blush} opacity={0.04} spin={-0.02} />
          <CornerBlossoms scale={p ? 0.85 : 0.95} />
          {/* Petal burst + counter-rotating rings */}
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          >
            {/* Burst */}
            {Array.from({ length: 16 }, (_, i) => {
              const a = ((i * 22.5 - 90) * Math.PI) / 180;
              const dist = (outerR + 60) * burst;
              return (
                <SoftPetal
                  key={`b-${i}`}
                  cx={cx + Math.cos(a) * dist}
                  cy={cy + Math.sin(a) * dist}
                  r={[16, 12, 14][i % 3]}
                  rotation={i * 30}
                  color={i % 2 === 0 ? SAKURA.blush : SAKURA.mist}
                  opacity={interpolate(burst, [0.6, 1], [0.9, 0.25], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  })}
                />
              );
            })}
            {/* Outer ring — 18 petals, slow clockwise */}
            {Array.from({ length: 18 }, (_, i) => {
              const a = ((i * 20 - 90 + ringSpin) * Math.PI) / 180;
              return (
                <SoftPetal
                  key={`o-${i}`}
                  cx={cx + Math.cos(a) * outerR}
                  cy={cy + Math.sin(a) * outerR}
                  r={[16, 12, 14][i % 3]}
                  rotation={i * 30 + ringSpin}
                  color={i % 2 === 0 ? SAKURA.blush : SAKURA.mist}
                  opacity={0.32}
                />
              );
            })}
            {/* Inner ring — 12 petals, slow counter-clockwise */}
            {Array.from({ length: 12 }, (_, i) => {
              const a = ((i * 30 - 90 - ringSpin * 1.4) * Math.PI) / 180;
              return (
                <SoftPetal
                  key={`i-${i}`}
                  cx={cx + Math.cos(a) * innerR}
                  cy={cy + Math.sin(a) * innerR}
                  r={[10, 8][i % 2]}
                  rotation={i * 40 - ringSpin}
                  color={i % 2 === 0 ? SAKURA.deepBlush : SAKURA.blush}
                  opacity={0.25}
                />
              );
            })}
          </svg>
        </>
      }
    >
      {/* Content stack */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: p ? "140px 70px" : "60px 160px",
        }}
      >
        {/* Brand */}
        <div
          style={{
            fontFamily: fontFamily ?? SAKURA_DISPLAY_FONT,
            fontWeight: 700,
            fontSize: titlePx,
            color: SAKURA.washi,
            letterSpacing: "0.08em",
            lineHeight: 1.15,
            opacity: brandOpacity,
            transform: `scale(${brandScale})`,
            marginBottom: 14,
          }}
        >
          {brandName}
        </div>

        {/* Tagline */}
        {tagline ? (
          <div
            style={{
              fontFamily: SAKURA_BODY_FONT,
              fontSize: taglinePx,
              color: SAKURA.blush,
              letterSpacing: "0.45em",
              textTransform: "uppercase",
              textIndent: "0.45em",
              maxWidth: p ? 820 : 980,
              opacity: taglineReveal,
              transform: `translateY(${(1 - taglineReveal) * 12}px)`,
              marginBottom: 34,
            }}
          >
            {tagline}
          </div>
        ) : null}

        {/* Five-petal divider row (center largest) */}
        <svg
          width={220}
          height={34}
          viewBox="0 0 220 34"
          style={{ marginBottom: 34, opacity: dividerReveal, overflow: "visible" }}
        >
          {[-90, -54, -18, 18, 54].map((x, i) => (
            <SoftPetal
              key={i}
              cx={110 + x + 18}
              cy={17}
              r={[12, 10, 14, 10, 12][i]}
              rotation={i * 36}
              color={SAKURA.deepBlush}
              opacity={[0.45, 0.5, 1, 0.5, 0.45][i]}
            />
          ))}
        </svg>

        {/* CTA box with corner blossoms */}
        {ctaText ? (
          <div
            style={{
              position: "relative",
              width: boxW,
              height: boxH,
              border: `1.8px solid ${SAKURA.blush}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: ctaReveal,
              transform: `scale(${0.9 + 0.1 * ctaReveal})`,
              marginBottom: 34,
            }}
          >
            {[
              { left: -12, top: -12, rot: 0 },
              { left: boxW - 10, top: -12, rot: 90 },
              { left: -12, top: boxH - 10, rot: -90 },
              { left: boxW - 10, top: boxH - 10, rot: 180 },
            ].map((c, i) => (
              <svg
                key={i}
                width={22}
                height={22}
                viewBox="0 0 22 22"
                style={{
                  position: "absolute",
                  left: c.left,
                  top: c.top,
                  overflow: "visible",
                  transform: `scale(${cornerPetalScale(i)})`,
                }}
              >
                <SoftPetal cx={11} cy={11} r={9} rotation={c.rot} color={SAKURA.crimson} centerColor={SAKURA.gold} />
              </svg>
            ))}
            <div
              style={{
                fontFamily: SAKURA_BODY_FONT,
                fontSize: p ? 24 : 20,
                color: SAKURA.washi,
                letterSpacing: "0.5em",
                textTransform: "uppercase",
                textIndent: "0.5em",
              }}
            >
              {ctaText}
            </div>
          </div>
        ) : null}

        {/* Website */}
        {websiteUrl ? (
          <div
            style={{
              fontFamily: SAKURA_DETAIL_FONT,
              fontSize: p ? 22 : 18,
              color: SAKURA.gold,
              letterSpacing: "0.35em",
              opacity: websiteReveal,
              marginBottom: hasSocials || socialHandles.length ? 30 : 0,
            }}
          >
            {websiteUrl}
          </div>
        ) : null}

        {/* Shared social icons */}
        {hasSocials ? (
          <div
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "center",
              opacity: socialsReveal,
            }}
          >
            <SocialIcons
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              socials={socials as any}
              accentColor={accentColor || SAKURA.crimson}
              textColor={SAKURA.washi}
              maxPerRow={p ? 3 : 5}
              fontFamily={fontFamily ?? SAKURA_BODY_FONT}
              aspectRatio={aspectRatio}
            />
          </div>
        ) : socialHandles.length > 0 ? (
          <div
            style={{
              display: "flex",
              gap: 28,
              justifyContent: "center",
              flexWrap: "wrap",
              opacity: socialsReveal,
            }}
          >
            {socialHandles.map((handle, i) => (
              <span
                key={i}
                style={{
                  fontFamily: SAKURA_BODY_FONT,
                  fontSize: p ? 20 : 16,
                  color: hexToRgba(SAKURA.washi, 0.5),
                  letterSpacing: "0.2em",
                }}
              >
                {handle}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </SakuraScene>
  );
};
