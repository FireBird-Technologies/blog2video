import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import { GrassGround, StickFace } from "../shared";
import type { SocialKey, SocialsMap, SocialsRow } from "../../SocialIcons";

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

export const EndingSocials: React.FC<SceneLayoutProps> = (props) => {
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
  const tSec = frame / fps;

  const dur = sceneDurationInFrames ?? 150;

  const enter = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exit = interpolate(frame, [dur - 18, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const masterOpacity = enter * exit;

  const titlePx = titleFontSize ?? (p ? 80 : 70);
  const descPx = descriptionFontSize ?? (p ? 40 : 30);

  const accent = accentColor ?? "#2E7D32";
  const bg = bgColor ?? "#FFFFFF";
  const text = textColor ?? "#111111";
  const ink = "#111111";
  const font = fontFamily ?? "'Patrick Hand', system-ui, sans-serif";

  const W = p ? 1080 : 1920;
  const H = p ? 1920 : 1080;

  const msToFrames = (ms: number) => (ms / 1000) * fps;
  const easeOut = (t: number) => 1 - Math.pow(1 - t, 2);

  // ── Timeline ──
  const titleProgress = interpolate(frame, [msToFrames(150), msToFrames(700)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeOut });
  const narrationOpacity = interpolate(frame, [msToFrames(550), msToFrames(950)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const handlesStartFrame = msToFrames(1200);
  const websiteStartFrame = msToFrames(1700);
  const websiteOpacity = interpolate(frame, [websiteStartFrame, websiteStartFrame + msToFrames(400)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const teamFade = interpolate(frame, [msToFrames(200), msToFrames(700)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // ── Celebrating team: 7 stickmen jumping on the grass, captain in the middle ──
  const groundY = H * (p ? 0.9 : 0.86);
  const FIG = p ? 1.25 : 1.15;
  const headR = 20 * FIG;
  const torsoLen = 50 * FIG;
  const thighLen = 28 * FIG;
  const shinLen = 28 * FIG;
  const sw = p ? 5 : 5.5;

  // 7 players clustered close together; the exact middle one (index 3) is the captain.
  const teamN = 7;
  const captainIdx = 3;
  const spreadL = W * (p ? 0.28 : 0.36);
  const spreadR = W * (p ? 0.72 : 0.64);
  const players = Array.from({ length: teamN }, (_, i) => {
    const x = interpolate(i, [0, teamN - 1], [spreadL, spreadR]);
    const phase = i * 1.1;
    const variant = i % 3;
    return { x, phase, variant, isCaptain: i === captainIdx };
  });

  const enabledList = enabledSocials(socials);
  const iconSize = p ? 52 : 44;
  const handlesList: string[] = Array.isArray((props as any).handles) ? (props as any).handles : [];

  const visibleCtas = resolveCtas({
    ctas: (props as any).ctas,
    ctaButtonText,
    websiteLink,
    showWebsiteButton,
  }).filter((c) => c.showWebsiteButton && (c.websiteLink !== "" || c.ctaButtonText.trim() !== ""));

  // ── One celebrating stickman: jumps (vertical bob), arms thrown up, legs tucked ──
  const TeamPlayer: React.FC<{ cx: number; phase: number; variant: number; captain: boolean }> = ({ cx, phase, variant, captain }) => {
    const jump = Math.max(0, Math.sin(tSec * 4.4 + phase));       // 0..1 hop
    const lift = jump * (p ? 46 : 40);
    const gy = groundY - lift;
    const hipY = gy - (thighLen + shinLen);
    const shoulderY = hipY - torsoLen;
    const headCY = shoulderY - headR - 10;
    const armUp = 0.7 + 0.3 * jump;                                // arms fly up at the top of the hop

    // Legs tuck up a little at the apex of the jump.
    const footSpread = headR * (0.7 + jump * 0.3);
    const kneeY = (hipY + gy) / 2 + jump * 6;

    return (
      <g opacity={teamFade} fill="none" strokeLinecap="round" strokeLinejoin="round" stroke={ink} strokeWidth={sw}>
        {/* legs */}
        <polyline points={`${cx},${hipY} ${cx - footSpread * 0.6},${kneeY} ${cx - footSpread},${gy}`} />
        <polyline points={`${cx},${hipY} ${cx + footSpread * 0.6},${kneeY} ${cx + footSpread},${gy}`} />
        {/* torso */}
        <line x1={cx} y1={hipY} x2={cx} y2={shoulderY} />
        {/* head */}
        <circle cx={cx} cy={headCY} r={headR} />
        <StickFace cx={cx} cy={headCY} headR={headR} stroke={ink} sw={sw} variant={variant} opacity={1} />

        {captain ? (() => {
          // ── Captain: bigger trophy held HIGH above the head, gripped from the base ──
          const cupW = headR * 2.6;
          const cupH = headR * 2.4;
          // Base of the trophy sits well above the head; both hands grip the base.
          const baseY = headCY - headR - cupH * 0.5 - headR * 0.9;
          const gripY = baseY;                       // hands hold the bottom of the trophy
          const gripDX = cupW * 0.12;                // hands close together under the base
          const gold = "#E3B23C";
          const goldDark = "#B8861F";
          // Elbows bow OUTWARD (wider than both the shoulder and the grip) so each arm
          // curves out and the forearm angles back in to the trophy base.
          const shAnchorY = shoulderY + headR * 0.3;
          const elbowOutDX = headR * 2.5;            // how far the elbow juts to the side (wide)
          const elbowY = shoulderY - headR * 0.5;
          return (
            <>
              {/* Both arms: shoulder → outward-bent elbow → hand on the base (curved) */}
              <path d={`M ${cx},${shAnchorY} Q ${cx - elbowOutDX},${elbowY} ${cx - gripDX},${gripY}`} />
              <path d={`M ${cx},${shAnchorY} Q ${cx + elbowOutDX},${elbowY} ${cx + gripDX},${gripY}`} />
              {/* Trophy (drawn from its base upward) */}
              <g stroke="none" transform={`translate(${cx} ${baseY})`}>
                {/* base + stem (the bottom the hands hold) */}
                <rect x={-cupW * 0.3} y={-cupH * 0.04} width={cupW * 0.6} height={cupH * 0.14} rx={4} fill={gold} stroke={goldDark} strokeWidth={2} />
                <rect x={-cupW * 0.09} y={-cupH * 0.32} width={cupW * 0.18} height={cupH * 0.3} fill={gold} stroke={goldDark} strokeWidth={2} />
                {/* bowl */}
                <path d={`M ${-cupW / 2} ${-cupH * 0.95} L ${cupW / 2} ${-cupH * 0.95} L ${cupW * 0.3} ${-cupH * 0.3} L ${-cupW * 0.3} ${-cupH * 0.3} Z`} fill={gold} stroke={goldDark} strokeWidth={2} />
                {/* handles */}
                <path d={`M ${-cupW / 2} ${-cupH * 0.82} q ${-cupW * 0.3} ${cupH * 0.12} 0 ${cupH * 0.42}`} fill="none" stroke={goldDark} strokeWidth={3.5} />
                <path d={`M ${cupW / 2} ${-cupH * 0.82} q ${cupW * 0.3} ${cupH * 0.12} 0 ${cupH * 0.42}`} fill="none" stroke={goldDark} strokeWidth={3.5} />
                {/* shine */}
                <line x1={-cupW * 0.2} y1={-cupH * 0.82} x2={-cupW * 0.05} y2={-cupH * 0.38} stroke="#FFF6D8" strokeWidth={3} opacity={0.85} />
              </g>
            </>
          );
        })() : (
          <>
            {/* arms thrown up in a V */}
            <polyline points={`${cx},${shoulderY + headR * 0.3} ${cx - headR * 1.1},${shoulderY - headR * 0.2 * armUp} ${cx - headR * 1.6},${shoulderY - headR * (1.2 * armUp)}`} />
            <polyline points={`${cx},${shoulderY + headR * 0.3} ${cx + headR * 1.1},${shoulderY - headR * 0.2 * armUp} ${cx + headR * 1.6},${shoulderY - headR * (1.2 * armUp)}`} />
          </>
        )}
      </g>
    );
  };

  // ── Confetti ──
  const confettiN = 40;
  const confetti = React.useMemo(() => Array.from({ length: confettiN }, (_, i) => {
    const seed = i * 53.13;
    return {
      x: (Math.sin(seed) * 0.5 + 0.5) * 100,
      delay: Math.abs(Math.sin(seed * 1.7)) * 1.2,
      speed: 0.5 + Math.abs(Math.sin(seed * 2.3)) * 0.6,
      drift: (Math.sin(seed * 3.1)) * 8,
      size: 8 + Math.abs(Math.sin(seed * 4.5)) * 8,
      hue: i % 3,
    };
  }), []);
  const confettiColors = [accent, "#E3B23C", "#E25563"];

  return (
    <AbsoluteFill style={{ background: bg, fontFamily: font, overflow: "hidden" }}>
      {/* Grass-green radial wash */}
      <AbsoluteFill style={{ pointerEvents: "none", background: `radial-gradient(ellipse 120% 60% at 50% 110%, rgba(46,125,50,0.10) 0%, transparent 70%)` }} />

      <AbsoluteFill style={{ opacity: masterOpacity, pointerEvents: "none" }}>
        {/* World SVG: grass + confetti + celebrating team */}
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
          <GrassGround W={W} H={H} groundY={groundY} accent={accent} />

          {/* confetti raining over the team */}
          {confetti.map((c, i) => {
            const t = ((tSec * c.speed - c.delay) % 2.2 + 2.2) % 2.2;
            const prog = t / 2.2;
            const cy = interpolate(prog, [0, 1], [-40, groundY]);
            const cx = (c.x / 100) * W + Math.sin(prog * Math.PI * 3) * c.drift;
            return (
              <rect key={i} x={cx} y={cy} width={c.size} height={c.size * 0.5} rx={2} fill={confettiColors[c.hue]} opacity={0.85} transform={`rotate(${prog * 360} ${cx + c.size / 2} ${cy + c.size / 4})`} />
            );
          })}

          {players.map((pl, i) => (
            <TeamPlayer key={i} cx={pl.x} phase={pl.phase} variant={pl.variant} captain={pl.isCaptain} />
          ))}
        </svg>

        {/* Stacked text + socials + CTAs — anchored near the vertical centre by its
            BOTTOM edge in both orientations, so the stack grows UPWARD as the content
            gets taller (and never overlaps the celebrating team in the lower band). */}
        <div
          style={{
            position: "absolute",
            bottom: p ? H * 0.46 : H * 0.48,
            left: p ? 48 : 140,
            right: p ? 48 : 140,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: p ? 28 : 22,
          }}
        >
          {/* Title */}
          <div style={{ width: "100%", textAlign: "center", opacity: titleProgress, transform: `translateY(${interpolate(titleProgress, [0, 1], [22, 0])}px)` }}>
            <div
              style={{
                fontSize: titlePx,
                fontWeight: 900,
                color: text,
                fontFamily: font,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
                lineHeight: 1.05,
                wordBreak: "break-word",
                overflowWrap: "break-word",
              }}
            >
              {title}
            </div>
            <div style={{ height: 5, width: p ? W * 0.4 : W * 0.24, margin: "12px auto 0", background: accent, borderRadius: 3, transformOrigin: "center", transform: `scaleX(${titleProgress})` }} />
          </div>

          {/* Narration / sign-off */}
          {narration ? (
            <div style={{ width: "100%", textAlign: "center", opacity: narrationOpacity }}>
              <div style={{ fontSize: descPx, color: text, fontFamily: font, lineHeight: 1.42, fontWeight: 500, maxWidth: p ? "94%" : "72%", margin: "0 auto", wordBreak: "break-word", overflowWrap: "break-word" }}>
                {narration}
              </div>
            </div>
          ) : null}

          {/* Inline social icons */}
          {enabledList.length > 0 ? (
            <div style={{ width: "100%", display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "flex-start", gap: p ? 34 : 44 }}>
              {enabledList.map(({ key, label }, i) => {
                const iconOpacity = interpolate(
                  frame,
                  [handlesStartFrame + msToFrames(i * 120), handlesStartFrame + msToFrames(i * 120) + msToFrames(300)],
                  [0, 1],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                );
                return (
                  <div key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: p ? 10 : 8, opacity: iconOpacity, transform: `translateY(${interpolate(iconOpacity, [0, 1], [8, 0])}px)` }}>
                    <div style={{ width: iconSize, height: iconSize }}>
                      <SocialGlyph kind={key} size={iconSize} color={text} />
                    </div>
                    <span style={{ fontSize: descPx * 0.8, color: text, fontFamily: font, letterSpacing: "0.02em", textAlign: "center", maxWidth: p ? 150 : 130, wordBreak: "break-word" }}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* Handles fallback (when no `socials` payload but handles exist) */}
          {handlesList.length > 0 && !socials ? (
            <div style={{ width: "100%", display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: p ? 18 : 24 }}>
              {handlesList.map((handle, i) => {
                const hOp = interpolate(
                  frame,
                  [handlesStartFrame + msToFrames(i * 150), handlesStartFrame + msToFrames(i * 150) + msToFrames(300)],
                  [0, 1],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                );
                return (
                  <span key={i} style={{ fontSize: descPx, color: text, fontFamily: font, opacity: hOp, letterSpacing: "0.03em", textAlign: "center", wordBreak: "break-word" }}>
                    {handle}
                  </span>
                );
              })}
            </div>
          ) : null}

          {/* Website CTAs */}
          {visibleCtas.length > 0 ? (
            <div style={{ width: "100%", display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "flex-start", gap: p ? 40 : 64, opacity: websiteOpacity, transform: `translateY(${interpolate(websiteOpacity, [0, 1], [10, 0])}px)` }}>
              {visibleCtas.map((cta, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: p ? 8 : 6 }}>
                  {cta.ctaButtonText.trim() !== "" ? (
                    <span style={{ fontSize: descPx, color: "#FFFFFF", background: accent, padding: p ? "12px 28px" : "10px 26px", borderRadius: 30, fontFamily: font, letterSpacing: "0.04em", fontWeight: 700, textAlign: "center", boxShadow: "0 4px 14px rgba(46,125,50,0.3)", wordBreak: "break-word", maxWidth: p ? 320 : 360 }}>
                      {cta.ctaButtonText.trim()}
                    </span>
                  ) : null}
                  {cta.websiteLink !== "" ? (
                    <span style={{ fontSize: Math.round(descPx * 0.78), color: text, fontFamily: font, letterSpacing: "0.04em", textAlign: "center", wordBreak: "break-word", maxWidth: p ? 320 : 360 }}>
                      {cta.websiteLink.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
