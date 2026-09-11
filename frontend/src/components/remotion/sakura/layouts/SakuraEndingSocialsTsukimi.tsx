import React from "react";
import { useVideoConfig, interpolate, spring } from "remotion";
import { SceneLayoutProps } from "../types";
import { SocialIcons } from "../../SocialIcons";
import { useFitText } from "../components/useFitText";
// NOTE for the render tree: resolveCtas lives at ../../shared/resolveCtas there.
// This is the ONLY line that differs between the two copies of this file.
import { resolveCtas } from "../../../../utils/resolveCtas";
import {
  SAKURA,
  SAKURA_DISPLAY_FONT,
  SAKURA_BODY_FONT,
  SAKURA_DETAIL_FONT,
  SakuraScene,
  useSakuraFrame,
  KamonWatermark,
  PaperLantern,
  PetalRain,
  SoftPetal,
  hexToRgba,
  readableTextColor,
} from "../sakuraStyle";

/**
 * "Tsukimi Farewell" — a visual variant of ending_socials. Same props and
 * prop meanings as SakuraEndingSocials (brandName/tagline/ctaText/
 * websiteUrl/socialHandles/socials/ctas); this is a different composition,
 * not different content. Instead of the base's busy petal-burst + counter-
 * rotating rings, a heavy, continuous storm of falling petals (PetalRain via
 * SakuraScene's own `petals`/`petalMode` props) fills the dark celebration
 * wash around the brand name, with drifting kasumi mist — a gentle,
 * unhurried close carried by the falling blossoms rather than a confetti
 * burst.
 */
export const SakuraEndingSocialsTsukimi: React.FC<SceneLayoutProps> = (props) => {
  const {
    title,
    narration,
    accentColor,
    bgColor,
    textColor,
    aspectRatio,
    sceneDurationInFrames,
    titleFontSize,
    descriptionFontSize,
    titleFontSizeIsUserSet,
    descriptionFontSizeIsUserSet,
    fontFamily,
    socials,
  } = props;

  const p = aspectRatio === "portrait";
  const frame = useSakuraFrame();
  const { fps, width, height } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 150;

  const crimson = accentColor || SAKURA.crimson;
  const ink = readableTextColor(textColor, "dark");
  const lanternLit = interpolate(frame, [4, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const brandName = (props as any).brandName ?? title ?? "";
  const tagline = (props as any).tagline ?? narration ?? "";
  const ctaText = (props as any).ctaText ?? (props as any).ctaButtonText ?? "";
  const websiteUrl = (props as any).websiteUrl ?? (props as any).websiteLink ?? "";
  const ctaCards = resolveCtas({
    ctas: (props as any).ctas,
    ctaButtonText: ctaText,
    websiteLink: websiteUrl,
    showWebsiteButton: (props as any).showWebsiteButton,
  }).filter((c, _i, arr) =>
    arr.length === 1
      ? c.ctaButtonText.trim().length > 0
      : c.showWebsiteButton && (c.ctaButtonText.trim().length > 0 || c.websiteLink.length > 0),
  );
  const socialHandles: string[] = (props as any).socialHandles ?? [];

  const titleTargetPx = titleFontSize ?? (p ? 108 : 96);
  const taglineTargetPx = descriptionFontSize ?? (p ? 41 : 43);
  const titleRef = React.useRef<HTMLDivElement>(null);
  const taglineRef = React.useRef<HTMLDivElement>(null);
  const { px: titlePx } = useFitText(
    titleRef,
    titleTargetPx,
    Math.max(28, Math.round(titleTargetPx * 0.55)),
    [brandName, titleTargetPx, titleFontSizeIsUserSet, p, height],
    Math.round(height * (p ? 0.22 : 0.26)),
  );
  const { px: taglinePx } = useFitText(
    taglineRef,
    taglineTargetPx,
    Math.max(18, Math.round(taglineTargetPx * 0.58)),
    [tagline, taglineTargetPx, descriptionFontSizeIsUserSet, titlePx, p, height],
    Math.round(height * (p ? 0.2 : 0.24)),
  );
  const ctaPx = Math.max(15, Math.round(taglinePx * 0.95));
  const websitePx = Math.max(13, Math.round(taglinePx * 0.88));
  const handlePx = Math.max(12, Math.round(taglinePx * 0.8));

  const cx = width / 2;
  const cy = height / 2;

  // Reveals — same beats as the base, but settling in rather than bursting.
  const brandScale = spring({ frame, fps, from: 0.9, to: 1, config: { damping: 20, stiffness: 50 } });
  const brandOpacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const taglineReveal = interpolate(frame, [16, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });
  const dividerReveal = interpolate(frame, [26, 38], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ctaReveal = spring({
    frame: Math.max(0, frame - 34),
    fps,
    from: 0,
    to: 1,
    config: { damping: 20, stiffness: 55 },
  });
  const websiteReveal = interpolate(frame, [50, 64], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const socialsReveal = interpolate(frame, [58, 72], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const cornerPetalScale = (idx: number) =>
    spring({
      frame: Math.max(0, frame - 38 - idx * 3),
      fps,
      from: 0,
      to: 1,
      config: { damping: 14, stiffness: 90 },
    });

  const hasSocials =
    socials &&
    (Array.isArray(socials) ? socials.length > 0 : Object.keys(socials).length > 0);

  const boxW = p ? 480 : 420;

  return (
    <SakuraScene
      backdrop="celebration"
      entranceLayout="ending_socials__v2"
      bgColor={bgColor}
      dur={dur}
      petals={p ? 34 : 46}
      petalIntensity={1.3}
      petalSeed={87}
      petalMode="storm"
      petalsBehind
      ambient="kasumi"
      chrome={
        <>
          <KamonWatermark cx={cx} cy={cy} r={p ? 420 : 300} color={SAKURA.gold} opacity={0.06} />
          <PaperLantern
            cx={p ? width * 0.2 : width * 0.13}
            cy={p ? height * 0.13 : height * 0.18}
            width={p ? 104 : 118}
            height={p ? 144 : 162}
            litProgress={lanternLit}
            glowColor="#FFD6E7"
            color="#F4AFC5"
            ribColor="#FFE5EE"
            cordColor={hexToRgba(ink, 0.75)}
            glowStrength={1.28}
            haloScale={2.35}
          />
        </>
      }
    >
      {/* Second, nearer petal layer (parallax scale, same documented
          two-layer pattern PetalRain's `scale` prop is built for) — sits
          between the backdrop and the text for extra depth/density beyond
          the scene's own back layer, without ever occluding the copy. */}
      <PetalRain count={p ? 16 : 22} intensity={1} seed={143} mode="drift" scale={1.35} />
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
          ref={titleRef}
          style={{
            fontFamily: fontFamily ?? SAKURA_DISPLAY_FONT,
            fontWeight: 700,
            fontSize: titlePx,
            color: ink,
            letterSpacing: "0.08em",
            lineHeight: 1.15,
            opacity: brandOpacity,
            transform: `scale(${brandScale})`,
            marginBottom: 14,
            textShadow: `0 0 40px ${hexToRgba(SAKURA.gold, 0.2)}`,
          }}
        >
          {brandName}
        </div>

        {/* Tagline */}
        {tagline ? (
          <div
            ref={taglineRef}
            style={{
              fontFamily: fontFamily ?? SAKURA_BODY_FONT,
              fontSize: taglinePx,
              color: hexToRgba(ink, 0.75),
              letterSpacing: "0.45em",
              textTransform: "uppercase",
              textIndent: "0.45em",
              maxWidth: p ? 820 : 980,
              overflowWrap: "anywhere",
              opacity: taglineReveal,
              transform: `translateY(${(1 - taglineReveal) * 12}px)`,
              marginBottom: 34,
            }}
          >
            {tagline}
          </div>
        ) : null}

        {/* Three-petal divider (quieter than the base's five-petal row) */}
        <svg
          width={140}
          height={30}
          viewBox="0 0 140 30"
          style={{ marginBottom: 34, opacity: dividerReveal, overflow: "visible" }}
        >
          {[-40, 0, 40].map((x, i) => (
            <SoftPetal
              key={i}
              cx={70 + x}
              cy={15}
              r={[10, 13, 10][i]}
              rotation={i * 40}
              color={SAKURA.gold}
              opacity={[0.4, 0.85, 0.4][i]}
            />
          ))}
        </svg>

        {/* CTA box with corner blossoms — same proven styling as the base */}
        {ctaCards.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "stretch",
              justifyContent: "center",
              gap: p ? 30 : 40,
              maxWidth: p ? "92%" : "94%",
              marginBottom: 34,
            }}
          >
            {ctaCards.map((card, ci) => (
              <div
                key={ci}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    position: "relative",
                    width: "auto",
                    height: "auto",
                    minWidth: ctaCards.length > 1 ? (p ? 180 : 200) : p ? 320 : 300,
                    maxWidth: p ? "82%" : boxW,
                    padding:
                      ctaCards.length > 1
                        ? p
                          ? "16px 26px"
                          : "14px 26px"
                        : p
                          ? "20px 34px"
                          : "16px 30px",
                    boxSizing: "border-box",
                    border: `1.8px solid ${crimson}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: ctaReveal,
                    transform: `scale(${0.9 + 0.1 * ctaReveal})`,
                  }}
                >
                  {[
                    { pos: { left: -12, top: -12 }, rot: 0 },
                    { pos: { right: -12, top: -12 }, rot: 90 },
                    { pos: { left: -12, bottom: -12 }, rot: -90 },
                    { pos: { right: -12, bottom: -12 }, rot: 180 },
                  ].map((c, i) => (
                    <svg
                      key={i}
                      width={22}
                      height={22}
                      viewBox="0 0 22 22"
                      style={{
                        position: "absolute",
                        ...c.pos,
                        overflow: "visible",
                        transform: `scale(${cornerPetalScale(i)})`,
                      }}
                    >
                      <SoftPetal cx={11} cy={11} r={9} rotation={c.rot} color={crimson} centerColor={SAKURA.gold} />
                    </svg>
                  ))}
                  <div
                    style={{
                      fontFamily: fontFamily ?? SAKURA_BODY_FONT,
                      fontSize: ctaCards.length > 1 ? ctaPx * 0.82 : ctaPx,
                      color: ink,
                      letterSpacing: ctaCards.length > 1 ? "0.3em" : "0.5em",
                      textTransform: "uppercase",
                      textIndent: ctaCards.length > 1 ? "0.3em" : "0.5em",
                      textAlign: "center",
                      lineHeight: 1.25,
                    }}
                  >
                    {card.ctaButtonText.trim() || "Get started"}
                  </div>
                </div>
                {ctaCards.length > 1 && card.websiteLink ? (
                  <div
                    style={{
                      fontFamily: fontFamily ?? SAKURA_DETAIL_FONT,
                      fontSize: websitePx * 0.92,
                      color: SAKURA.gold,
                      letterSpacing: "0.12em",
                      maxWidth: "100%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      opacity: ctaReveal,
                    }}
                  >
                    {card.websiteLink}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {/* Website */}
        {websiteUrl && ctaCards.length <= 1 ? (
          <div
            style={{
              fontFamily: fontFamily ?? SAKURA_DETAIL_FONT,
              fontSize: websitePx,
              color: SAKURA.gold,
              letterSpacing: "0.35em",
              maxWidth: p ? "88%" : "70%",
              textAlign: "center",
              overflowWrap: "anywhere",
              wordBreak: "break-word",
              opacity: websiteReveal,
              marginBottom: hasSocials || socialHandles.length ? 30 : 0,
            }}
          >
            {websiteUrl}
          </div>
        ) : null}

        {/* Socials */}
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
              accentColor={crimson}
              textColor={ink}
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
                  fontFamily: fontFamily ?? SAKURA_BODY_FONT,
                  fontSize: handlePx,
                  color: hexToRgba(ink, 0.5),
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
