import React from "react";
import { useVideoConfig, interpolate, spring } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  SOCIAL_ICONS,
  resolveEnabledSocials,
  type SocialKey,
} from "../../SocialIcons";
// NOTE for the render tree: resolveCtas lives at ../../shared/resolveCtas there.
// This is the ONLY line that differs between the two copies of this file.
import { resolveCtas } from "../../shared/resolveCtas";
import {
  SAKURA,
  SAKURA_DISPLAY_FONT,
  SAKURA_BODY_FONT,
  SAKURA_DETAIL_FONT,
  SakuraScene,
  useSakuraFrame,
  PetalDivider,
  hexToRgba,
  readableTextColor,
  petalTint,
} from "../sakuraStyle";

/**
 * SakuraEndingSocialsV2 — "Hanko Seal"
 *
 * Variant of `ending_socials`. Same props, different composition.
 *
 * NOTE the id: sakura's registry maps BOTH `sakura_ending_socials` (legacy) and
 * `ending_socials` (what the backend actually emits) to the same component. This
 * variant hangs off `ending_socials__v2`.
 *
 * Base is a centred brand / CTA-box / website / socials stack over corner blossoms.
 * This one closes the video the way a Japanese artist closes a piece — by STAMPING
 * it: a large circular seal presses into the paper (scale overshoot + ink bleed)
 * with the brand set inside it, the CTA rides a washi plate below, and the socials
 * sit under a petal divider. Everything under the seal is positioned from the
 * seal's own extent, so the stack stays tight whatever the tagline length.
 *
 * The press is the whole motion idea, so it uses a spring with real overshoot
 * rather than the base's fade-and-rise — the two endings should not feel alike.
 *
 * The socials resolution (`brandName`/`websiteUrl`/`socialHandles` with their
 * fallbacks, and the `socials`-else-`socialHandles` branch) is reused unchanged
 * from the base — it is the one part with real behavioural surface.
 *
 * CTAs go through `resolveCtas`, so a `ctas` ARRAY renders up to three plates each
 * with its own link, falling back to the legacy single-CTA fields. The sakura base
 * reads only `ctaText`/`ctaButtonText` and so silently drops extra CTAs; that is a
 * pre-existing base limitation, not a contract this variant has to match.
 *
 * Seeds 37/43 are fresh.
 */
export const SakuraEndingSocialsV2: React.FC<SceneLayoutProps> = (props) => {
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
    fontFamily,
    socials,
  } = props;

  const p = aspectRatio === "portrait";
  const frame = useSakuraFrame();
  const { fps, width, height } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 150;

  const crimson = accentColor || SAKURA.crimson;
  // `spotlight` is a DARK backdrop (see isDarkBackdrop), so text must derive for
  // "dark" — deriving for "light" returned near-black ink that was invisible on
  // the plum ground.
  const ink = readableTextColor(textColor, "dark");
  const petal = petalTint(accentColor);
  // The seal sits ON the dark ground, so its ring/brand cannot be the raw accent
  // (crimson on plum has almost no contrast). Use the petal tint — the accent's
  // own hue at petal lightness — so it stays colour-driven but reads.
  const sealColor = petal;

  const displayFont = fontFamily ?? SAKURA_DISPLAY_FONT;
  const bodyFont = fontFamily ?? SAKURA_BODY_FONT;
  const detailFont = fontFamily ?? SAKURA_DETAIL_FONT;

  // Identical prop resolution to the base — do not re-derive.
  const brandName = (props as any).brandName ?? title ?? "";
  const tagline = (props as any).tagline ?? narration ?? "";
  const ctaText = (props as any).ctaText ?? (props as any).ctaButtonText ?? "";
  /**
   * Up to three CTAs. `resolveCtas` reads the `ctas` array when present and
   * otherwise falls back to the legacy single-CTA fields, so this covers both
   * shapes. Only cards that are toggled on AND have a link are rendered — except
   * that a lone legacy `ctaText` with no link is still honoured, since that is
   * what the sakura pipeline has always emitted for this scene.
   */
  const ctaCards = resolveCtas({
    ctas: (props as any).ctas,
    ctaButtonText: ctaText,
    websiteLink: (props as any).websiteUrl ?? (props as any).websiteLink,
    showWebsiteButton: (props as any).showWebsiteButton,
  }).filter((c, _i, arr) =>
    arr.length === 1
      ? c.ctaButtonText.trim().length > 0
      : c.showWebsiteButton && (c.ctaButtonText.trim().length > 0 || c.websiteLink.length > 0),
  );
  const websiteUrl = (props as any).websiteUrl ?? (props as any).websiteLink ?? "";
  const socialHandles: string[] = (props as any).socialHandles ?? [];
  const hasSocials = Boolean(socials && Object.keys(socials as object).length > 0);

  // ── The press ──────────────────────────────────────────────────────────────
  // Overshoot then settle: the seal lands hard and rocks back, the way a stamp
  // actually meets paper.
  const press = spring({
    frame: frame - 8,
    fps,
    config: { damping: 11, stiffness: 130, mass: 0.9 },
  });
  const sealScale = interpolate(press, [0, 1], [1.5, 1]);
  const sealOpacity = interpolate(frame, [8, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Ink bleeds outward just after contact.
  const bleed = interpolate(frame, [16, 44], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const taglineOpacity = interpolate(frame, [34, 52], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ctaProgress = interpolate(frame, [48, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const socialsOpacity = interpolate(frame, [66, 86], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const sealR = p ? Math.min(width * 0.34, 250) : Math.min(height * 0.3, 240);
  const brandPx = titleFontSize ?? (p ? 63 : 66);
  const taglinePx = descriptionFontSize ?? (p ? 42 : 38);

  // Seal centre, then everything below it is derived from the seal's own extent —
  // the CTA used to be pinned at a fixed 63/66% of the frame regardless of where
  // the seal and tagline actually ended, which left a large dead gap between them.
  // Push the seal down far enough that IT and its icon ring both clear the top of
  // the frame — at 0.29/0.33 with a large seal the stamp was cropped by the edge.
  const cy = Math.max(p ? height * 0.29 : height * 0.33, sealR + (p ? 96 : 82));
  // Clear the icon ring, which hangs on the seal's LOWER arc — the tagline used to
  // start right at the seal's edge, which is exactly where the icons now sit.
  const ringIcon = p ? 62 : 54;
  /** Icons ride just OUTSIDE the seal's edge. */
  const ringR = sealR + (p ? 52 : 46);
  /** Lowest point the ring reaches — icon centre at 90° plus its box and label. */
  const ringBottom = cy + ringR + ringIcon / 2 + (p ? 46 : 40);
  const taglineTop = Math.max(cy + sealR + (p ? 26 : 24), ringBottom);
  /** Rough wrapped-tagline height, so the CTA sits just under it. */
  const taglineH = tagline
    ? Math.ceil(tagline.length / (p ? 30 : 52)) * taglinePx * 1.6
    : 0;
  const ctaTop = taglineTop + taglineH + (p ? 34 : 30);
  /** CTA plate height (plus its per-card link line when several are shown), so the
   *  website line at the foot can clear the row. */
  const ctaPlateH =
    ctaCards.length === 0 ? 0 : ctaCards.length > 1 ? (p ? 104 : 92) : p ? 78 : 68;
  const urlTop = ctaTop + ctaPlateH + (p ? 34 : 30);

  // ── Social ring ────────────────────────────────────────────────────────────
  // Rich socials when present, else the raw handles rendered as label-only pips —
  // the same either/or branch the base uses, just laid out on an arc.
  const resolvedSocials = resolveEnabledSocials(socials);
  const ringSocials: Array<{ key: SocialKey | null; item: { text?: string; label?: string; url?: string } }> =
    resolvedSocials.length > 0
      ? resolvedSocials
      : socialHandles.map((h) => ({ key: null, item: { text: h } }));

  return (
    <SakuraScene
      backdrop="spotlight"
      entranceLayout="ending_socials__v2"
      bgColor={bgColor}
      accentColor={crimson}
      dur={dur}
      petals={p ? 14 : 20}
      petalIntensity={0.7}
      petalSeed={37}
      petalMode="drift"
      ambient="mist_gold"
      // Petals behind the content: drifting in front of the seal put a blossom
      // across the brand name.
      petalsBehind
    >
      {/* ── The seal ── */}
      <div
        style={{
          position: "absolute",
          left: width / 2 - sealR,
          top: cy - sealR,
          width: sealR * 2,
          height: sealR * 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${sealScale}) rotate(-4deg)`,
          opacity: sealOpacity,
        }}
      >
        {/* Ink bleed ring — spreads outward once the seal has landed. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${hexToRgba(sealColor, 0.22)} 0%, transparent 68%)`,
            transform: `scale(${1 + bleed * 0.28})`,
            opacity: 1 - bleed * 0.45,
          }}
        />
        {/* The stamp itself. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: `${p ? 10 : 9}px solid ${sealColor}`,
            background: hexToRgba(sealColor, 0.1),
            boxShadow: `0 10px 34px ${hexToRgba(SAKURA.ink, 0.45)}, inset 0 0 40px ${hexToRgba(
              sealColor,
              0.16,
            )}`,
          }}
        />
        {/* Brand, set inside the seal. */}
        <div
          style={{
            position: "relative",
            padding: `0 ${p ? 34 : 30}px`,
            fontFamily: displayFont,
            fontWeight: 700,
            fontSize: brandPx,
            lineHeight: 1.15,
            color: sealColor,
            textAlign: "center",
            overflowWrap: "anywhere",
          }}
        >
          {brandName}
        </div>
      </div>

      {/* ── Tagline under the seal ── */}
      {tagline ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: taglineTop,
            padding: p ? "0 10%" : "0 20%",
            textAlign: "center",
            fontFamily: bodyFont,
            fontSize: taglinePx,
            lineHeight: 1.6,
            color: hexToRgba(ink, 0.88),
            opacity: taglineOpacity,
            overflowWrap: "anywhere",
          }}
        >
          {tagline}
        </div>
      ) : null}

      {/* ── CTA on a washi plate ──
          NOT TanzakuPanel: that component fills at hexToRgba(color, 0.06) — it
          re-applies its own alpha on top of whatever colour it is given, because it
          is designed as FAINT CHROME BEHIND a quote. Passing it a solid washi made
          a ~6%-opaque wireframe rather than a card. A real plate is drawn here.
          Positioned in flow under the tagline (see the stack below) so the large
          dead gap between tagline and CTA cannot come back. */}
      {ctaCards.length > 0 ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: ctaTop,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "flex-start",
            gap: p ? 14 : 18,
            padding: p ? "0 6%" : "0 12%",
            opacity: ctaProgress,
            transform: `translateY(${interpolate(ctaProgress, [0, 1], [16, 0])}px)`,
          }}
        >
          {ctaCards.map((card, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                minWidth: 0,
                maxWidth: ctaCards.length > 1 ? (p ? "46%" : "30%") : p ? "84%" : "56%",
              }}
            >
              <div
                style={{
                  // Multiple plates share the row, so they tighten up and drop a
                  // size — three full-width plates would not fit the measure.
                  padding: ctaCards.length > 1 ? (p ? "15px 22px" : "14px 26px") : p ? "20px 46px" : "17px 42px",
                  background: hexToRgba(SAKURA.washi, 0.96),
                  border: `1px solid ${hexToRgba(SAKURA.gold, 0.8)}`,
                  boxShadow: `0 10px 30px ${hexToRgba(SAKURA.ink, 0.42)}`,
                  fontFamily: displayFont,
                  fontWeight: 700,
                  fontSize: ctaCards.length > 1 ? (p ? 26 : 23) : p ? 34 : 29,
                  letterSpacing: "0.06em",
                  color: crimson,
                  whiteSpace: "nowrap",
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {card.ctaButtonText.trim() || "Get started"}
              </div>
              {/* Each CTA carries its OWN link, so with several of them the single
                  website line at the foot cannot say where any one of them goes. */}
              {ctaCards.length > 1 && card.websiteLink ? (
                <div
                  style={{
                    fontFamily: detailFont,
                    fontSize: p ? 17 : 15,
                    letterSpacing: "0.04em",
                    color: hexToRgba(ink, 0.85),
                    maxWidth: "100%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {card.websiteLink}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {/* ── Socials, ORBITING THE SEAL ──
          They used to sit in a bottom-anchored stack while the CTA was positioned
          downward from the seal, so a long tagline pushed the CTA plate straight
          into the icons. Hung on the seal's own circle they cannot collide with it
          — and the ring echoes the stamp, which the flat row did not. */}
      {ringSocials.length > 0 ? (
        <div style={{ opacity: socialsOpacity }}>
          {ringSocials.map(({ key, item }, i) => {
            // `key` is null for the raw-handle fallback — those render as a
            // label-only pip, so there is no icon component to look up.
            const Icon = key ? SOCIAL_ICONS[key] : null;
            // Spread across the LOWER arc, centred on straight-down (90°), so the
            // icons never ride over the brand set inside the seal. Capped at 130°:
            // at 200° the end icons climbed to the seal's equator and read as
            // sitting beside the stamp rather than hanging beneath it.
            const spread = Math.min(130, 38 * Math.max(1, ringSocials.length - 1));
            const a =
              ringSocials.length === 1
                ? 90
                : 90 - spread / 2 + (spread / (ringSocials.length - 1)) * i;
            const rad = (a * Math.PI) / 180;
            const cxIcon = width / 2 + Math.cos(rad) * ringR;
            const cyIcon = cy + Math.sin(rad) * ringR;
            const label = String(item?.label ?? item?.text ?? item?.url ?? "").trim();
            return (
              <div
                key={key}
                style={{
                  position: "absolute",
                  left: cxIcon - ringIcon / 2,
                  top: cyIcon - ringIcon / 2,
                  width: ringIcon,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    width: ringIcon,
                    height: ringIcon,
                    borderRadius: "50%",
                    background: hexToRgba(SAKURA.washi, 0.94),
                    border: `1px solid ${hexToRgba(sealColor, 0.55)}`,
                    boxShadow: `0 4px 14px ${hexToRgba(SAKURA.ink, 0.4)}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  {Icon ? <Icon size={Math.round(ringIcon * 0.62)} /> : null}
                </div>
                {label ? (
                  <div
                    style={{
                      fontFamily: detailFont,
                      fontSize: p ? 17 : 15,
                      color: hexToRgba(ink, 0.9),
                      whiteSpace: "nowrap",
                    }}
                  >
                    {label}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* ── Website, under the CTA ──
          Positioned DOWNWARD from the CTA rather than anchored to the bottom of
          the frame: the CTA's own top is derived from the tagline, so a bottom
          anchor let the two meet in the middle and the URL rendered behind the
          plate. `top` keeps the whole stack in one direction. */}
      {websiteUrl && ctaCards.length <= 1 ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: Math.min(urlTop, height - (p ? 150 : 120)),
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: p ? 14 : 12,
            opacity: socialsOpacity,
          }}
        >
          <PetalDivider
            width={p ? 280 : 340}
            lineColor={hexToRgba(SAKURA.gold, 0.7)}
            flowerColor={petal}
            startFrame={66}
          />
          <div
            style={{
              fontFamily: detailFont,
              fontSize: p ? 24 : 20,
              letterSpacing: "0.08em",
              color: hexToRgba(ink, 0.92),
              wordBreak: "break-word",
              padding: "0 8%",
              textAlign: "center",
            }}
          >
            {websiteUrl}
          </div>
        </div>
      ) : null}
    </SakuraScene>
  );
};
