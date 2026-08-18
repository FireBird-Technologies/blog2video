import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import type { SocialKey, SocialsMap, SocialsRow } from "../../SocialIcons";

/**
 * EndingSocialsV2 — "Signpost"
 *
 * Variant of `ending_socials`. Same props, different composition.
 *
 * Base draws a large stroke-revealed crescent moon at top-centre with the title
 * beneath it and the handles/CTAs stacked down the middle, plus a waving figure at
 * frame-right. This one replaces the moon-and-stack with a hand-drawn wooden
 * SIGNPOST: a vertical chalk pillar at centre. The PRIMARY CTA is a board mounted
 * flat on the pillar's APEX — the scene's actual ask, so it takes the top spot and is
 * the only element in full-weight accent. Below it, direction arrows fan off the
 * pillar carrying the social handles (icon riding each arrow). Any ADDITIONAL CTAs
 * beyond the first are appended to those arrows, so a 2–3 CTA scene shows every one
 * without a second board competing with the first.
 *
 * The board drops onto the apex and settles; the arrows then swing in on a stagger
 * (rotating from an over-angled start into rest with a small overshoot) while each
 * outline strokes on — the template's dashoffset idiom applied per element.
 *
 * Arrow spacing is derived from the pillar span and the arrow count, because
 * landscape leaves only ~half the frame below the board and a fixed gap overflows the
 * ground line at six arrows.
 *
 * The socials/CTA resolution below (SOCIAL_ORDER, PLATFORM_LABELS, enabledSocials,
 * resolveCtas, SocialGlyph) is copied UNCHANGED from the base layout: it is the one
 * piece of this scene with real behavioural surface (editor payload shapes, the
 * "true"/"false" string booleans, the 1–3 CTA array), so it must not be re-derived.
 */

/** Stable display order — mirrors the editor's social platform keys. */
const SOCIAL_ORDER: SocialKey[] = [
  "instagram",
  "youtube",
  "medium",
  "substack",
  "facebook",
  "linkedin",
  "tiktok",
];

/** Fallback display label per platform when the editor leaves one blank. */
const PLATFORM_LABELS: Record<SocialKey, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  medium: "Medium",
  substack: "Substack",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
};

/**
 * Normalize the editor `socials` payload into the enabled platforms (with their
 * display labels), preserving SOCIAL_ORDER. An absent/empty payload yields none.
 */
const enabledSocials = (
  input?: SocialsMap | SocialsRow[]
): { key: SocialKey; label: string }[] => {
  if (!input) return [];
  const map: SocialsMap = {};
  if (Array.isArray(input)) {
    for (const row of input) {
      const key = String(row?.platform ?? "").trim().toLowerCase() as SocialKey;
      if (!key) continue;
      const raw = row?.enabled;
      const enabled =
        typeof raw === "string"
          ? raw.trim().toLowerCase() !== "false"
          : Boolean(raw ?? true);
      map[key] = { enabled, label: row?.label ?? row?.text ?? row?.url };
    }
  } else {
    Object.assign(map, input);
  }
  return SOCIAL_ORDER.filter((k) => {
    const it = map[k];
    return Boolean(it && (it.enabled ?? true));
  }).map((k) => {
    const it = map[k];
    const lbl = String(it?.label ?? it?.text ?? it?.url ?? "").trim();
    return { key: k, label: lbl || PLATFORM_LABELS[k] };
  });
};

type ResolvedCta = {
  ctaButtonText: string;
  websiteLink: string;
  showWebsiteButton: boolean;
};

/**
 * Resolve the CTA(s): prefer the multi-CTA `ctas` array (1–3 items) the editor
 * sends; otherwise fall back to the flat single-CTA fields. `showWebsiteButton`
 * may arrive as a boolean or the select string "true"/"false".
 */
const resolveCtas = (source: {
  ctas?: unknown;
  ctaButtonText?: unknown;
  websiteLink?: unknown;
  showWebsiteButton?: unknown;
}): ResolvedCta[] => {
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const show = (v: unknown): boolean => String(v) !== "false";
  if (Array.isArray(source.ctas) && source.ctas.length > 0) {
    const normalized = source.ctas
      .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
      .map((raw) => ({
        ctaButtonText: str(raw.ctaButtonText),
        websiteLink: str(raw.websiteLink).trim(),
        showWebsiteButton: show(raw.showWebsiteButton),
      }));
    if (normalized.length > 0) return normalized.slice(0, 3);
  }
  return [
    {
      ctaButtonText: str(source.ctaButtonText),
      websiteLink: str(source.websiteLink).trim(),
      showWebsiteButton: show(source.showWebsiteButton),
    },
  ];
};

/** Chalk-style stroke-only social glyph (monochrome, inline). */
const SocialGlyph: React.FC<{ kind: SocialKey; size: number; color: string }> = ({
  kind,
  size,
  color,
}) => {
  const common = {
    fill: "none",
    stroke: color,
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    vectorEffect: "non-scaling-stroke" as const,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {kind === "instagram" && (
        <>
          <rect x="3.5" y="3.5" width="17" height="17" rx="5" {...common} />
          <circle cx="12" cy="12" r="4.2" {...common} />
          <circle cx="17" cy="7" r="0.9" fill={color} stroke="none" />
        </>
      )}
      {kind === "youtube" && (
        <>
          <rect x="2.5" y="5.5" width="19" height="13" rx="3.5" {...common} />
          <path d="M10.5 9.3 L15.6 12 L10.5 14.7 Z" {...common} />
        </>
      )}
      {kind === "medium" && (
        <>
          <circle cx="7.5" cy="12" r="4.6" {...common} />
          <ellipse cx="15.5" cy="12" rx="2" ry="4.6" {...common} />
          <line x1="20.5" y1="7.6" x2="20.5" y2="16.4" {...common} />
        </>
      )}
      {kind === "facebook" && (
        <path
          d="M14.6 20 V8.1 C14.6 6.3 15.5 5.4 17.1 5.4 H17.9 M11.4 11 H17.6"
          {...common}
        />
      )}
      {kind === "linkedin" && (
        <>
          <rect x="3.5" y="3.5" width="17" height="17" rx="3" {...common} />
          <line x1="7" y1="10" x2="7" y2="16.5" {...common} />
          <circle cx="7" cy="7" r="0.7" fill={color} stroke="none" />
          <path d="M11 16.5 V10.5 M11 12.6 C11.6 10.9 13.4 10.6 14.6 11.3 C15.7 12 15.6 13.4 15.6 14.4 V16.5" {...common} />
        </>
      )}
      {kind === "tiktok" && (
        <path
          d="M14.2 4 C14.2 7 16.2 9 19.2 9 V11.8 C17.2 11.8 15.7 11.1 14.5 10.1 V14.8 C14.5 17.6 12.2 19.8 9.5 19.8 C6.7 19.8 4.5 17.6 4.5 14.8 C4.5 12.1 6.7 9.9 9.5 9.9 V12.7 C8.2 12.7 7.3 13.6 7.3 14.8 C7.3 15.9 8.2 16.9 9.5 16.9 C10.6 16.9 11.7 16 11.7 14.8 V4 Z"
          {...common}
        />
      )}
      {kind === "substack" && (
        <>
          <line x1="5" y1="5.5" x2="19" y2="5.5" {...common} />
          <line x1="5" y1="9.5" x2="19" y2="9.5" {...common} />
          <path d="M5 13.2 V19.5 L12 15.8 L19 19.5 V13.2 Z" {...common} />
        </>
      )}
    </svg>
  );
};

export const EndingSocialsV2: React.FC<SceneLayoutProps> = (props) => {
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
  } = props;

  const p = aspectRatio === "portrait";

  const socials = (props as any).socials;
  const websiteLink = (props as any).websiteLink;
  const showWebsiteButton = (props as any).showWebsiteButton;
  const ctaButtonText = (props as any).ctaButtonText;

  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 150;

  const enter = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exit = interpolate(frame, [dur - 18, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const masterOpacity = enter * exit;

  const accent = accentColor ?? "#FFFFFF";
  const bg = bgColor ?? "#000000";
  const text = textColor ?? "#FFFFFF";
  const ff = fontFamily ?? "'Patrick Hand', system-ui, sans-serif";

  const titlePx = titleFontSize ?? (p ? 75 : 62);
  const descPx = descriptionFontSize ?? (p ? 41 : 28);

  const t = frame / fps;

  // ── Starfield ──────────────────────────────────────────────────────────────
  const stars = React.useMemo(() => {
    const arr: { x: number; y: number; r: number; phase: number; period: number; opacity: number }[] = [];
    const rng = (seed: number) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; };
    const rand = rng(613);
    for (let i = 0; i < 180; i++) {
      arr.push({ x: rand() * 1920, y: rand() * 1080, r: 1 + rand() * 1.1, phase: rand() * Math.PI * 2, period: 2 + rand() * 3, opacity: 0.4 + rand() * 0.5 });
    }
    return arr;
  }, []);

  // ── Content resolution (identical contract to the base) ────────────────────
  const socialItems = enabledSocials(socials);

  const handlesList: string[] = Array.isArray(socials)
    ? socials
    : Array.isArray((props as any).handles)
    ? (props as any).handles
    : [];

  const ctas = (props as any).ctas;
  const visibleCtas = resolveCtas({
    ctas,
    ctaButtonText,
    websiteLink,
    showWebsiteButton,
  }).filter(
    (c) => c.showWebsiteButton && (c.websiteLink !== "" || c.ctaButtonText.trim() !== ""),
  );

  // ── Signpost content model ─────────────────────────────────────────────────
  // TWO separate signposts, one standing beside each stick figure:
  //
  //   • the CTA pillar carries the calls to action. Its FIRST CTA is a billboard —
  //     a large mounted card-board on the apex, since that is the scene's ask —
  //     and any further CTAs hang below it as direction arrows.
  //   • the SOCIAL pillar carries the handles, all as arrows.
  //
  // Splitting them keeps one pillar from becoming an unreadable stack of eight
  // planks, and gives each figure something to be pointing at.
  const strip = (u: string) => u.replace(/^https?:\/\//, "").replace(/\/$/, "");

  const billboard = React.useMemo(() => {
    const c = visibleCtas[0];
    if (!c) return null;
    const label = c.ctaButtonText.trim();
    const link = strip(c.websiteLink);
    return {
      label: label || link,
      sub: label && link ? link : undefined,
    };
  }, [visibleCtas]);

  type Arrow = {
    kind: "social" | "cta";
    label: string;
    sub?: string;
    social?: SocialKey;
    side: 1 | -1;
    rest: number;
  };

  /** Lay a raw list out as an alternating fan of arrows. */
  const asArrows = React.useCallback(
    (items: Omit<Arrow, "side" | "rest">[], max: number): Arrow[] =>
      items.slice(0, max).map((it, i) => {
        const side: 1 | -1 = i % 2 === 0 ? -1 : 1;
        return {
          ...it,
          side,
          // Slight alternating tilt so the fan looks hand-nailed, not mechanical.
          rest: side === -1 ? -4 + (i % 3) * 1.5 : 4 - (i % 3) * 1.5,
        };
      }),
    [],
  );

  /** CTA pillar: the 2nd and 3rd CTAs (the 1st is the billboard on the apex). */
  const ctaArrows: Arrow[] = React.useMemo(
    () =>
      asArrows(
        visibleCtas.slice(1).map((c) => {
          const label = c.ctaButtonText.trim();
          const link = strip(c.websiteLink);
          return { kind: "cta" as const, label: label || link, sub: label && link ? link : undefined };
        }),
        3,
      ),
    [visibleCtas, asArrows],
  );

  /** Social pillar: every enabled platform, or the raw handles list as a fallback. */
  const socialArrows: Arrow[] = React.useMemo(
    () =>
      asArrows(
        socialItems.length > 0
          ? socialItems.map((s) => ({ kind: "social" as const, label: s.label, social: s.key }))
          : handlesList.map((h) => ({ kind: "social" as const, label: h })),
        6,
      ),
    [socialItems, handlesList, asArrows],
  );

  // ── Layout metrics (canvas-space CSS, so no viewBox slicing to reason about) ─
  // PORTRAIT stacks the two pillars vertically (CTA above, socials below) rather than
  // side-by-side: a 1080px-wide frame cannot hold two fans abreast without squeezing
  // arrows so narrow that every label wraps mid-word ("Instag/ram"). Landscape has the
  // width to stand them side by side.
  const stacked = p;
  // Landscape: both pillars share one vertical band, side by side.
  // Portrait (stacked): each pillar gets its OWN band, so the CTA post sits above the
  // social post and neither has to be squeezed narrow.
  // Stacked starts lower than it might seem necessary: the billboard is mounted ABOVE
  // the post's top (marginTop: -boardH), so a small postTopPct puts the board over the
  // title block.
  const postTopPct = stacked ? 34 : 42;
  const postBottomPct = stacked ? 88 : 86;
  // The ARROWS must stop well above the post's base: a figure stands at each foot, and
  // the lowest arrow was landing across its head. The post itself still runs to the
  // ground — only the fan is limited.
  const fanBottomPct = stacked ? 84 : 77;
  const arrowStartOffset = p ? 34 : 26;
  const arrowBaseH = p ? 78 : 70;
  const arrowW = p ? 430 : 330;
  // The billboard mounted on the CTA pillar's apex. Portrait keeps it inside the half
  // of the canvas its pillar occupies.
  const boardW = p ? 420 : 470;
  const boardH = p ? 156 : 132;

  // ── Per-arrow height ───────────────────────────────────────────────────────
  // A CTA's label and URL can both be long. Rather than clipping them (the URL used
  // to run off the bottom edge), each arrow grows to fit its own wrapped text, and
  // the fan's vertical budget is computed from the REAL total height below.
  //
  // Text is capped at MAX_LINES; beyond that it ellipsizes, so no single CTA can
  // grow without bound and push the fan past the pillar base.
  const MAX_LINES = 2;
  /** Wrapped-line count. 0.50em/char matches this chalk font's measured advance
   *  (verified against a render: ~22 chars per 332px at 30px). */
  const linesFor = (s: string, fontPx: number, boxW: number) => {
    if (!s) return 0;
    const perLine = Math.max(1, Math.floor(boxW / (fontPx * 0.5)));
    return Math.min(MAX_LINES, Math.max(1, Math.ceil(s.length / perLine)));
  };

  /** The arrow OUTLINE spans only y 0.10h–0.90h of its box (the rest is the chevron
   *  taper), so the text has just 80% of the height to live in. Sizing the box to the
   *  content alone let two-line CTAs spill past the drawn edge. */
  const OUTLINE_FRAC = 0.8;

  /**
   * Measure one pillar's fan: each arrow's height (grown to fit its own wrapped
   * text), the stacked vertical offsets, and the gap — tightened as needed so the
   * whole fan still fits between the apex and the ground.
   *
   * `topOffset` is where the fan starts below the pillar top; the CTA pillar passes a
   * larger value because its billboard occupies the apex.
   */
  const measureFan = (list: Arrow[], topOffset: number, spanPx: number) => {
    const metrics = list.map((ar) => {
      const isCta = ar.kind === "cta";
      // Usable text width: total minus the chevron and padding, minus the glyph.
      const textW = arrowW - (p ? 72 : 68) - (ar.social ? (p ? 54 : 46) : 0);
      const labelPx = isCta ? Math.round(descPx * 1.06) : descPx;
      const subPx = Math.round(descPx * 0.72);
      const labelLines = linesFor(ar.label, labelPx, textW);
      // Cap the PAIR at MAX_LINES total. A two-line label plus a two-line URL is four
      // rows in one arrow — too tall and too busy — so the URL gives up its second
      // line when the label has already taken two.
      const subBudget = Math.max(1, MAX_LINES - (labelLines - 1));
      const subLines = ar.sub ? Math.min(subBudget, linesFor(ar.sub, subPx, textW)) : 0;
      const contentH = labelLines * labelPx * 1.15 + subLines * subPx * 1.2;
      // Grow the box so the CONTENT fits the outline's 80% band, plus breathing room.
      const h = Math.max(arrowBaseH, Math.round(contentH / OUTLINE_FRAC + (p ? 22 : 18)));
      return { h, labelLines, subLines };
    });

    const idealGapExtra = p ? 26 : 22;
    const sumH = metrics.reduce((n, m) => n + m.h, 0);
    const gapsAvailable = spanPx - topOffset - sumH - (p ? 10 : 8);
    const gapExtra =
      metrics.length > 1
        ? Math.max(0, Math.min(idealGapExtra, gapsAvailable / (metrics.length - 1)))
        : idealGapExtra;

    const tops = metrics.reduce<number[]>((acc, _m, i) => {
      acc.push(i === 0 ? topOffset : acc[i - 1] + metrics[i - 1].h + gapExtra);
      return acc;
    }, []);

    // Where the fan actually ends, so a short pillar (e.g. one CTA arrow) can stop its
    // post just below its content instead of running a long empty line to the ground.
    const endsAt =
      metrics.length > 0 ? tops[tops.length - 1] + metrics[metrics.length - 1].h : topOffset;

    return { metrics, tops, endsAt };
  };

  // ── Where each pillar stands ───────────────────────────────────────────────
  // One pillar per stick figure. These percentages must track FIGURE_X below (which
  // is design-space 0–1920 / 0–1080): each figure stands at the foot of its own post.
  // Landscape sets them wide so the two fans never collide; portrait pulls them in,
  // since its viewBox slice reveals only design-space x 656–1264.
  // Landscape separation is bounded by the two fans meeting in the middle: each arrow
  // reaches `arrowW` to one side of its post, and the CTA post also carries the
  // billboard (±boardW/2). 590/1330 leaves ~70px between the two fans' inner edges —
  // about as close as the pair can stand without their arrows touching.
  const FIGURE_X = {
    left: p ? 800 : 590,
    right: p ? 1130 : 1330,
  };
  /**
   * Design-space X -> canvas percentage.
   *
   * The figures live in an SVG with `viewBox="0 0 1920 1080"` and
   * `preserveAspectRatio="xMidYMid slice"`, so in PORTRAIT the canvas shows only the
   * middle band of design space (x ≈ 656–1264), not 0–1920. Dividing by the canvas
   * width there put the right-hand pillar at 104% — off-canvas entirely.
   */
  const designXToPct = (x: number) => {
    if (!p) return (x / 1920) * 100;
    const visibleW = 1080 / (1920 / 1080); // design-space width the portrait slice reveals
    const minX = (1920 - visibleW) / 2;
    return ((x - minX) / visibleW) * 100;
  };

  // The POSTS keep the close positions above; it is the FIGURES that step aside (see
  // FIGURE_OFFSET at the figure block). Offsetting the posts instead would either widen
  // the pair back out or, moving them inward, collide the two fans.
  const pillarLeftPct = designXToPct(FIGURE_X.left);
  const pillarRightPct = designXToPct(FIGURE_X.right);

  // The CTA pillar takes the left post, the socials the right — but ONLY when both
  // exist. A single pillar stands dead centre instead of sitting off to one side with
  // an empty half-frame beside it (see `soloPct` below).
  const hasCtaPillar = Boolean(billboard) || ctaArrows.length > 0;
  const bothPillars = hasCtaPillar && socialArrows.length > 0;
  /** Where a lone pillar stands: centred, since it has the whole frame to itself. */
  const soloPct = 50;

  // Stacked (portrait) splits the vertical band in two; side-by-side shares it.
  // The two stacked bands sit close together — a wide gap between them reads as two
  // unrelated signs rather than one signpost cluster.
  const ctaBand = stacked && bothPillars
    ? { top: postTopPct, bottom: 52, fanBottom: 50 }
    : { top: postTopPct, bottom: postBottomPct, fanBottom: fanBottomPct };
  const socialBand = stacked && bothPillars
    ? { top: 52, bottom: postBottomPct, fanBottom: fanBottomPct }
    : { top: postTopPct, bottom: postBottomPct, fanBottom: fanBottomPct };

  /** Vertical room a band gives its fan, in px. */
  const bandSpan = (b: { top: number; fanBottom: number }) =>
    ((b.fanBottom - b.top) / 100) * (p ? 1920 : 1080);

  // The CTA fan starts below the billboard; the social fan starts at the apex.
  const ctaFan = measureFan(ctaArrows, arrowStartOffset, bandSpan(ctaBand));
  const socialFan = measureFan(socialArrows, arrowStartOffset, bandSpan(socialBand));

  const PILLARS = [
    ...(hasCtaPillar
      ? [
          {
            key: "cta",
            // Centred when it is the only pillar, or when portrait stacks the two;
            // otherwise it takes the left post.
            leftPct: !bothPillars || stacked ? soloPct : pillarLeftPct,
            band: ctaBand,
            board: billboard,
            arrows: ctaArrows,
            fan: ctaFan,
            delay: 0,
          },
        ]
      : []),
    ...(socialArrows.length > 0
      ? [
          {
            key: "social",
            leftPct: !bothPillars || stacked ? soloPct : pillarRightPct,
            band: socialBand,
            board: null as typeof billboard,
            arrows: socialArrows,
            fan: socialFan,
            // Staggered so the two posts don't animate in perfect lockstep.
            delay: hasCtaPillar ? 8 : 0,
          },
        ]
      : []),
  ];

  const titleProgress = interpolate(frame, [6, 6 + Math.round(0.7 * fps)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const narrationOpacity = interpolate(
    frame,
    [6 + Math.round(0.6 * fps), 6 + Math.round(1.0 * fps)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  // The pillar draws itself in before anything mounts on it.
  const postProgress = interpolate(frame, [Math.round(0.3 * fps), Math.round(1.0 * fps)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // The CTA board drops onto the apex once the pillar is up, then the arrows fan out.
  const boardStart = Math.round(0.95 * fps);
  const boardDrop = interpolate(frame, [boardStart, boardStart + Math.round(0.5 * fps)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const boardStroke = interpolate(frame, [boardStart + 3, boardStart + Math.round(0.6 * fps)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const arrowBaseFrame = Math.round(1.45 * fps);

  const filterId = "chalk-displace-es2";

  return (
    <AbsoluteFill style={{ background: bg, fontFamily: ff, overflow: "hidden" }}>
      {/* ── Starfield + vignette (design-space SVG, sliced like the other scenes) ── */}
      <svg
        width={p ? 1080 : 1920}
        height={p ? 1920 : 1080}
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", top: 0, left: 0, zIndex: 0 }}
      >
        <defs>
          <filter id={filterId} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" seed="2" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <radialGradient id="vignetteEs2" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
          </radialGradient>
        </defs>
        {stars.map((s, i) => {
          const twinkle = 0.4 + 0.5 * (0.5 + 0.5 * Math.sin((t / s.period) * Math.PI * 2 + s.phase));
          return (
            <circle
              key={i}
              cx={s.x}
              cy={s.y}
              r={s.r}
              fill={i % 5 === 0 ? "#B0E8FF" : "white"}
              opacity={twinkle * s.opacity}
            />
          );
        })}
        <rect x={0} y={0} width={1920} height={1080} fill="url(#vignetteEs2)" />
        {/* Crescent moon, small and pushed into the corner — the signpost is the
            subject here, so the moon is only atmosphere. */}
        <g
          transform={`translate(${p ? 1180 : 1700}, ${p ? 92 : 112}) scale(1.05) translate(-30, 0)`}
          filter={`url(#${filterId})`}
          opacity={0.9}
        >
          <path
            d="M 30 -28 A 34 34 0 1 0 30 28 A 29 29 0 1 1 30 -28 Z"
            fill={text}
            stroke={text}
            strokeWidth={1.2}
            strokeLinejoin="round"
            style={{ filter: "drop-shadow(0 0 14px rgba(255,255,255,0.65))" }}
          />
        </g>
      </svg>

      <AbsoluteFill style={{ opacity: masterOpacity }}>
        {/* ── Title above the post ── */}
        <div
          style={{
            position: "absolute",
            // Sits above the CTA board, which the shorter pillar brings down to ~42%
            // of the frame — so the copy no longer needs pinning to the very top edge.
            top: p ? "15%" : "9%",
            left: "50%",
            transform: `translate(-50%, 0) translateY(${interpolate(titleProgress, [0, 1], [20, 0])}px)`,
            width: p ? "88%" : "74%",
            textAlign: "center",
            opacity: titleProgress,
            zIndex: 3,
          }}
        >
          <div
            style={{
              fontFamily: ff,
              fontSize: titlePx,
              fontWeight: 700,
              color: accent,
              lineHeight: 1.2,
              letterSpacing: "0.02em",
              textShadow: "0 0 12px rgba(255,255,255,0.7), 0 0 24px rgba(255,255,255,0.3)",
              wordBreak: "break-word",
            }}
          >
            {title}
          </div>
          {narration ? (
            <div
              style={{
                marginTop: p ? 14 : 10,
                fontFamily: ff,
                fontSize: descPx,
                color: text,
                lineHeight: 1.45,
                opacity: narrationOpacity,
                textShadow: "0 0 6px rgba(255,255,255,0.4)",
                wordBreak: "break-word",
              }}
            >
              {narration}
            </div>
          ) : null}
        </div>

        {/* ── The two signposts, one standing beside each figure ── */}
        {PILLARS.map((pillar) => (
          <div
            key={pillar.key}
            style={{
              position: "absolute",
              top: `${pillar.band.top}%`,
              bottom: `${100 - pillar.band.bottom}%`,
              left: `${pillar.leftPct}%`,
              width: 0,
              zIndex: 2,
            }}
          >
            {/* Post itself — a chalk line that draws downward */}
            <svg
              width={40}
              height="100%"
              viewBox="0 0 40 100"
              preserveAspectRatio="none"
              style={{ position: "absolute", left: -20, top: 0, overflow: "visible" }}
            >
              <line
                x1={20} y1={0} x2={20} y2={100}
                stroke={text}
                strokeWidth={p ? 1.6 : 1.1}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                strokeDasharray={100}
                strokeDashoffset={100 * (1 - postProgress)}
                style={{ filter: "drop-shadow(0 0 8px rgba(255,255,255,0.5))" }}
              />
            </svg>

            {/* ── The billboard: the primary CTA as a mounted card-board on the apex.
                   Only the CTA pillar carries one. ── */}
            {pillar.board ? (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: boardW,
                  height: boardH,
                  marginLeft: -boardW / 2,
                  marginTop: -boardH + 6,
                  transform: `translateY(${interpolate(boardDrop, [0, 1], [-56, 0])}px) rotate(${interpolate(boardDrop, [0, 1], [-6, -1.2])}deg)`,
                  transformOrigin: "50% 100%",
                  opacity: boardDrop,
                }}
              >
                <svg
                  width="100%"
                  height="100%"
                  viewBox={`0 0 ${boardW} ${boardH}`}
                  style={{ position: "absolute", inset: 0, overflow: "visible" }}
                >
                  {/* Card-board panel: a hand-drawn rectangle with a slight wobble, on
                      a lightly filled ground so it reads as a solid mounted sign. */}
                  <polyline
                    points={`6,10 ${boardW - 8},4 ${boardW - 4},${boardH - 8} 8,${boardH - 4} 6,10`}
                    fill="rgba(255,255,255,0.06)"
                    stroke={accent}
                    strokeWidth={3.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={(boardW + boardH) * 2.2}
                    strokeDashoffset={(boardW + boardH) * 2.2 * (1 - boardStroke)}
                    style={{ filter: `drop-shadow(0 0 12px ${accent}AA)` }}
                  />
                  {/* Two posts fixing the board down onto the pillar. */}
                  <line
                    x1={boardW / 2 - 26} y1={boardH - 10} x2={boardW / 2 - 26} y2={boardH + 16}
                    stroke={accent} strokeWidth={3} strokeLinecap="round" opacity={boardStroke}
                  />
                  <line
                    x1={boardW / 2 + 26} y1={boardH - 10} x2={boardW / 2 + 26} y2={boardH + 16}
                    stroke={accent} strokeWidth={3} strokeLinecap="round" opacity={boardStroke}
                  />
                </svg>

                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: `0 ${p ? 26 : 24}px`,
                    opacity: boardStroke,
                  }}
                >
                  <div
                    style={{
                      fontFamily: ff,
                      fontSize: Math.round(descPx * 1.24),
                      fontWeight: 700,
                      color: accent,
                      letterSpacing: "0.04em",
                      lineHeight: 1.15,
                      textAlign: "center",
                      textShadow: `0 0 12px ${accent}AA`,
                      maxWidth: "100%",
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {pillar.board.label}
                  </div>
                  {pillar.board.sub ? (
                    <div
                      style={{
                        fontFamily: ff,
                        fontSize: Math.round(descPx * 0.8),
                        color: text,
                        letterSpacing: "0.03em",
                        lineHeight: 1.2,
                        opacity: 0.9,
                        textAlign: "center",
                        maxWidth: "100%",
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {pillar.board.sub}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* ── This pillar's direction arrows ── */}
            {pillar.arrows.map((ar, i) => {
              const startAt = arrowBaseFrame + pillar.delay + i * 4;
              const swing = interpolate(frame, [startAt, startAt + Math.round(0.42 * fps)], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              // Overshoot: eases past the rest angle then settles back.
              const overshoot = Math.sin(swing * Math.PI) * 3.4 * ar.side;
              const angle = interpolate(swing, [0, 1], [ar.side * 14, ar.rest]) + overshoot * (1 - swing);
              const strokeOn = interpolate(frame, [startAt + 2, startAt + Math.round(0.5 * fps)], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });

              const armW = arrowW;
              const armH = pillar.fan.metrics[i].h;
              const isCta = ar.kind === "cta";
              const col = isCta ? accent : text;
              // Arrows alternate sides of the post, pinned at the post edge and
              // rotating about that pin. The far end is a chevron point.
              const originX = ar.side === 1 ? 0 : -armW;

              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    top: pillar.fan.tops[i],
                    left: 0,
                    width: armW,
                    height: armH,
                    marginLeft: originX,
                    transform: `rotate(${angle}deg)`,
                    transformOrigin: ar.side === 1 ? "0% 50%" : "100% 50%",
                    opacity: swing,
                  }}
                >
                  <svg
                    width="100%"
                    height="100%"
                    viewBox={`0 0 ${armW} ${armH}`}
                    style={{ position: "absolute", inset: 0, overflow: "visible" }}
                  >
                    <polyline
                      points={
                        ar.side === 1
                          ? `2,${armH * 0.16} ${armW - 34},${armH * 0.1} ${armW - 4},${armH * 0.5} ${armW - 34},${armH * 0.9} 2,${armH * 0.84} 2,${armH * 0.16}`
                          : `${armW - 2},${armH * 0.16} 34,${armH * 0.1} 4,${armH * 0.5} 34,${armH * 0.9} ${armW - 2},${armH * 0.84} ${armW - 2},${armH * 0.16}`
                      }
                      fill="none"
                      stroke={col}
                      strokeWidth={2.4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={armW * 2.4}
                      strokeDashoffset={armW * 2.4 * (1 - strokeOn)}
                      style={{ filter: `drop-shadow(0 0 8px ${col}99)` }}
                    />
                  </svg>

                  {/* Arrow contents — the social icon rides the arrow. */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: ar.side === 1 ? "flex-start" : "flex-end",
                      gap: p ? 14 : 12,
                      padding: ar.side === 1 ? `0 42px 0 ${p ? 30 : 26}px` : `0 ${p ? 30 : 26}px 0 42px`,
                      opacity: strokeOn,
                    }}
                  >
                    {ar.social ? (
                      <div style={{ flexShrink: 0, filter: "drop-shadow(0 0 8px rgba(255,255,255,0.45))" }}>
                        <SocialGlyph kind={ar.social} size={p ? 40 : 34} color={col} />
                      </div>
                    ) : null}
                    <div style={{ minWidth: 0, textAlign: ar.side === 1 ? "left" : "right" }}>
                      <div
                        style={{
                          fontFamily: ff,
                          fontSize: isCta ? Math.round(descPx * 1.06) : descPx,
                          fontWeight: isCta ? 500 : 400,
                          color: col,
                          letterSpacing: "0.03em",
                          lineHeight: 1.15,
                          textShadow: `0 0 8px ${col}80`,
                          // Wraps to a second line (the arrow grew to fit it), then
                          // truncates — so a long label can never overflow.
                          display: "-webkit-box",
                          WebkitLineClamp: pillar.fan.metrics[i].labelLines,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {ar.label}
                      </div>
                      {ar.sub ? (
                        <div
                          style={{
                            fontFamily: ff,
                            fontSize: Math.round(descPx * 0.72),
                            color: text,
                            letterSpacing: "0.03em",
                            lineHeight: 1.2,
                            opacity: 0.85,
                            // Long URLs wrap then truncate, matching the line budget
                            // the height was computed from.
                            display: "-webkit-box",
                            WebkitLineClamp: pillar.fan.metrics[i].subLines || 1,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {ar.sub}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}


        {/* ── Two figures at the foot of the post, one pointing up ── */}
        <svg
          width={p ? 1080 : 1920}
          height={p ? 1920 : 1080}
          viewBox="0 0 1920 1080"
          preserveAspectRatio="xMidYMid slice"
          style={{ position: "absolute", top: 0, left: 0, zIndex: 1 }}
        >
          {/* Ground line under the post */}
          <line
            x1={0} y1={1010} x2={1920} y2={1010}
            stroke={text} strokeWidth={p ? 5 : 3} strokeLinecap="round"
            filter={`url(#${filterId})`}
            opacity={0.9}
          />
          {(() => {
            const S = p ? 1.55 : 1.4;
            const groundY = 1010;
            // Both figures sit inside the portrait slice (x 656–1264).
            // Landscape has the full 1920 design width to play with, so the pair sits
            // wide of the pillar (x=960) and of the arrow fan that swings out from it.
            // Portrait keeps its tighter pair — its viewBox slice only reveals x
            // 656–1264, so spreading them there would push both out of frame.
            // Each figure stands at the foot of its own pillar — these ARE the values
            // the pillar percentages are derived from, so the pairing cannot drift.
            // When the pillars are STACKED (portrait) both posts share the frame's
            // centre line, so the figures flank the lower one instead.
            // Each figure stands OUTBOARD of its post rather than directly beneath it —
            // sharing the post's X ran the chalk line down through the body and put the
            // figure under its own arrows. Offsetting the FIGURES (not the posts) keeps
            // the two pillars as close as they are without colliding their fans.
            const FIGURE_OFFSET = p ? 100 : 150;
            // Two pillars side by side: a figure steps aside from each. Otherwise
            // (portrait stacking, or a single centred pillar) both flank the centre post.
            const flankCentre = stacked || !bothPillars;
            const leftX = flankCentre ? 800 : FIGURE_X.left - FIGURE_OFFSET;
            const rightX = flankCentre ? 1120 : FIGURE_X.right + FIGURE_OFFSET;
            const appear = interpolate(frame, [Math.round(0.5 * fps), Math.round(0.9 * fps)], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const bob = Math.sin(t * 1.1) * 1.3;
            const pointBob = Math.sin(t * 1.8) * 4;

            return (
              <g opacity={appear} filter={`url(#${filterId})`}>
                {/* Left figure — pointing up at the board on the apex */}
                <g transform={`translate(${leftX}, ${groundY}) translate(0, ${bob}) scale(${S}) translate(-50, -114)`} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="50" cy="22" r="14" stroke={text} strokeWidth="4.5" fill="none" />
                  <circle cx="45" cy="20" r="1.8" fill={text} stroke="none" />
                  <circle cx="55" cy="20" r="1.8" fill={text} stroke="none" />
                  <line x1="50" y1="38" x2="50" y2="72" stroke={text} strokeWidth="4.5" />
                  {/* Raised pointing arm */}
                  <g transform={`rotate(${pointBob} 50 48)`}>
                    <line x1="50" y1="48" x2="64" y2="26" stroke={text} strokeWidth="4.5" />
                    <line x1="64" y1="26" x2="72" y2="10" stroke={text} strokeWidth="4.5" />
                    <circle cx="72" cy="10" r="2.6" fill={text} stroke="none" />
                  </g>
                  {/* Other arm at rest */}
                  <line x1="50" y1="48" x2="34" y2="80" stroke={text} strokeWidth="4.5" />
                  <line x1="50" y1="72" x2="36" y2="114" stroke={text} strokeWidth="4.5" />
                  <line x1="50" y1="72" x2="64" y2="114" stroke={text} strokeWidth="4.5" />
                </g>
                {/* Right figure — standing, looking up */}
                <g transform={`translate(${rightX}, ${groundY}) translate(0, ${-bob}) scale(${S}) translate(-50, -114)`} strokeLinecap="round" strokeLinejoin="round">
                  <g transform="rotate(-10 50 22)">
                    <circle cx="50" cy="22" r="14" stroke={text} strokeWidth="4.5" fill="none" />
                    <circle cx="45" cy="20" r="1.8" fill={text} stroke="none" />
                    <circle cx="55" cy="20" r="1.8" fill={text} stroke="none" />
                  </g>
                  <line x1="50" y1="38" x2="50" y2="72" stroke={text} strokeWidth="4.5" />
                  <line x1="50" y1="48" x2="32" y2="82" stroke={text} strokeWidth="4.5" />
                  <line x1="50" y1="48" x2="68" y2="82" stroke={text} strokeWidth="4.5" />
                  <line x1="50" y1="72" x2="36" y2="114" stroke={text} strokeWidth="4.5" />
                  <line x1="50" y1="72" x2="64" y2="114" stroke={text} strokeWidth="4.5" />
                </g>
              </g>
            );
          })()}
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
