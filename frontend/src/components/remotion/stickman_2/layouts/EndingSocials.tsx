import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
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
    imageUrl,
    imageObjectPosition,
    imageZoom,
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
  const { fps, width, height } = useVideoConfig();

  const dur = sceneDurationInFrames ?? 150;

  // Transitions
  const enter = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exit = interpolate(frame, [dur - 18, dur], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const masterOpacity = enter * exit;

  const titlePx = titleFontSize ?? (p ? 75 : 62);
  const descPx = descriptionFontSize ?? (p ? 41 : 28);

  const accent = accentColor ?? "#FFFFFF";
  const bg = bgColor ?? "#000000";
  const text = textColor ?? "#FFFFFF";

  // Starfield
  const starCount = 150;

  const starsData = React.useMemo(() => {
    const arr: { x: number; y: number; r: number; period: number; phase: number; baseOpacity: number }[] = [];
    for (let i = 0; i < starCount; i++) {
      const seed = i * 137.508;
      const x = (Math.sin(seed) * 0.5 + 0.5) * 100;
      const y = (Math.cos(seed * 1.3) * 0.5 + 0.5) * 100;
      const r = 1 + Math.abs(Math.sin(seed * 2.1));
      const period = 2 + Math.abs(Math.sin(seed * 3.7)) * 3;
      const phase = Math.abs(Math.sin(seed * 5.3)) * Math.PI * 2;
      const baseOpacity = 0.4 + Math.abs(Math.sin(seed * 7.1)) * 0.5;
      arr.push({ x, y, r, period, phase, baseOpacity });
    }
    return arr;
  }, []);

  const timeInSeconds = frame / fps;

  // Crescent moon draw-on: dashoffset animation over 0.8s starting at t=0
  const moonCircumference = 2 * Math.PI * 140;
  const moonProgress = interpolate(frame, [0, Math.round(0.8 * fps)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const moonDashOffset = moonCircumference * (1 - moonProgress);

  // Title draw-on: starts at t=0.6s, duration 0.7s
  const titleStartFrame = Math.round(0.6 * fps);
  const titleEndFrame = Math.round((0.6 + 0.7) * fps);
  const titleProgress = interpolate(frame, [titleStartFrame, titleEndFrame], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Narration appears shortly after the title finishes drawing
  const underlineEndFrame = Math.round((0.6 + 0.7 + 0.35) * fps);

  // Handles stagger: starting at t=1.4s, 0.15s apart
  const handlesStartFrame = Math.round(1.4 * fps);

  // Website CTA: fade-in at t=1.8s
  const websiteStartFrame = Math.round(1.8 * fps);
  const websiteOpacity = interpolate(frame, [websiteStartFrame, websiteStartFrame + Math.round(0.4 * fps)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Fireflies: 5 fireflies
  const fireflyCount = 5;
  const fireflies = React.useMemo(() => {
    return Array.from({ length: fireflyCount }, (_, i) => {
      const seed = i * 91.3 + 17;
      return {
        startX: 10 + (i / fireflyCount) * 80,
        startY: 65 + Math.sin(seed) * 20,
        r: 3 + Math.abs(Math.sin(seed * 2)) * 2,
        period: 8 + Math.abs(Math.sin(seed * 3)) * 6,
        phase: Math.abs(Math.sin(seed * 4)) * Math.PI * 2,
        driftX: 15 + Math.abs(Math.sin(seed * 5)) * 20,
        driftY: 8 + Math.abs(Math.sin(seed * 6)) * 10,
      };
    });
  }, []);

  const canvasW = width;
  const canvasH = height;

  // Handles list
  const handlesList: string[] = Array.isArray(socials)
    ? socials
    : Array.isArray((props as any).handles)
    ? (props as any).handles
    : [];

  // Resolve 1–3 CTAs (multi-CTA `ctas` array, else the flat single-CTA fields),
  // keeping only those that are enabled and have a link.
  const ctas = (props as any).ctas;
  const visibleCtas = resolveCtas({
    ctas,
    ctaButtonText,
    websiteLink,
    showWebsiteButton,
  }).filter(
    (c) => c.showWebsiteButton && (c.websiteLink !== "" || c.ctaButtonText.trim() !== ""),
  );

  // Enabled social platforms (inline stroke glyphs)
  const socialItems = enabledSocials(socials);
  const iconSize = p ? 52 : 46;

  const narrationOpacity = interpolate(
    frame,
    [underlineEndFrame, underlineEndFrame + Math.round(0.4 * fps)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Vertical stack in the band below the moon and above the stick figure.
  const contentTop = p ? 360 : 300;
  const contentPadX = p ? 48 : 160;
  const contentBottom = p ? 320 : 240;
  const sectionGap = p ? 36 : 28;

  return (
    <AbsoluteFill style={{ background: bg, fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif", overflow: "hidden" }}>
      {/* Starfield */}
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        viewBox={`0 0 ${canvasW} ${canvasH}`}
        preserveAspectRatio="none"
      >
        {starsData.map((star, i) => {
          const twinkle =
            star.baseOpacity +
            Math.sin(timeInSeconds * ((2 * Math.PI) / star.period) + star.phase) *
              0.25;
          const opacity = Math.max(0.1, Math.min(1, twinkle));
          return (
            <circle
              key={i}
              cx={(star.x / 100) * canvasW}
              cy={(star.y / 100) * canvasH}
              r={star.r}
              fill="white"
              opacity={opacity}
            />
          );
        })}
      </svg>

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.55) 100%)`,
          pointerEvents: "none",
        }}
      />

      {/* Fireflies */}
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        viewBox={`0 0 ${canvasW} ${canvasH}`}
        preserveAspectRatio="none"
      >
        <defs>
          <filter id="fireflyBlur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        {fireflies.map((ff, i) => {
          const t = timeInSeconds / ff.period + ff.phase;
          const cx =
            (ff.startX / 100) * canvasW +
            Math.sin(t * Math.PI * 2) * ff.driftX * (canvasW / 1920);
          const cy =
            (ff.startY / 100) * canvasH +
            Math.cos(t * Math.PI * 2 * 0.7) * ff.driftY * (canvasH / 1080);
          const glowOpacity =
            0.5 + Math.sin(timeInSeconds * 1.5 + ff.phase) * 0.2;
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={ff.r}
              fill={accent}
              opacity={glowOpacity}
              filter="url(#fireflyBlur)"
            />
          );
        })}
      </svg>

      {/* Main content */}
      <AbsoluteFill style={{ opacity: masterOpacity, pointerEvents: "none" }}>
        {/* SVG layer: crescent moon + right-side stick figure (decorative) */}
        <svg
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", zIndex: 1 }}
          viewBox={`0 0 ${canvasW} ${canvasH}`}
        >
          <defs>
            <filter id="chalkGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="10" floodColor={text} floodOpacity="0.5" />
            </filter>
            <filter id="chalkGlowAccent" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="10" floodColor={accent} floodOpacity="0.7" />
            </filter>
            <filter id="chalkDisplace" x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="2" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>

          {/* Crescent moon: large arc centered top-center */}
          <g filter="url(#chalkGlow)">
            <circle
              cx={canvasW / 2}
              cy={p ? 200 : 160}
              r={140}
              fill="none"
              stroke={text}
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={moonCircumference}
              strokeDashoffset={moonDashOffset}
              style={{ filter: "drop-shadow(0 0 20px rgba(255,255,255,0.5))" }}
            />
            {/* Inner circle to create crescent effect */}
            <circle
              cx={canvasW / 2 + 60}
              cy={p ? 180 : 140}
              r={115}
              fill={bg}
              stroke="none"
              opacity={moonProgress}
            />
          </g>

          {/* Right-side stick figure facing the camera, pointing left toward
              the text/socials. Drawn with a face (eyes + smile). */}
          {(() => {
            const figX = p ? canvasW - 210 : canvasW - 240;
            const figY = p ? canvasH - 90 : canvasH - 70;
            const figS = p ? 2.2 : 2.7;
            // Entrance + idle breathing + a small pointing-hand bob.
            const figOp = interpolate(
              frame,
              [Math.round(0.3 * fps), Math.round(0.7 * fps)],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
            const breathe = 1 + 0.02 * Math.sin(timeInSeconds * ((2 * Math.PI) / 3));
            // Waving forearm: rotates about the raised elbow toward the text.
            const waveAngle = Math.sin(timeInSeconds * 6) * 18;
            const sc = figS * breathe;
            return (
              <g
                transform={`translate(${figX}, ${figY})`}
                opacity={figOp}
                style={{ filter: "drop-shadow(0 0 12px rgba(255,255,255,0.45))" }}
              >
                <g
                  transform={`scale(${figS * breathe}) translate(-50, -114)`}
                  filter="url(#chalkDisplace)"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {/* Head + face */}
                  <circle cx="50" cy="22" r="14" stroke={text} strokeWidth="4.5" fill="none" />
                  <circle cx="45" cy="19" r="1.9" fill={text} stroke="none" />
                  <circle cx="55" cy="19" r="1.9" fill={text} stroke="none" />
                  <path d="M44 26 Q50 31 56 26" stroke={text} strokeWidth="2.6" fill="none" />
                  {/* Torso */}
                  <line x1="50" y1="38" x2="50" y2="74" stroke={text} strokeWidth="4.5" />
                  {/* Raised arm waving toward the text area (figure's right) */}
                  <line x1="50" y1="49" x2="34" y2="36" stroke={text} strokeWidth="4.5" />
                  <g transform={`rotate(${waveAngle}, 34, 36)`}>
                    <line x1="34" y1="36" x2="24" y2="24" stroke={text} strokeWidth="4.5" />
                    <circle cx="24" cy="24" r="2.6" fill={text} stroke="none" />
                  </g>
                  {/* Resting arm at the side */}
                  <line x1="50" y1="49" x2="66" y2="80" stroke={text} strokeWidth="4.5" />
                  {/* Legs */}
                  <line x1="50" y1="74" x2="36" y2="114" stroke={text} strokeWidth="4.5" />
                  <line x1="50" y1="74" x2="64" y2="114" stroke={text} strokeWidth="4.5" />
                </g>
                {/* Speech caption above the figure's head (keeps clear of center text stack) */}
                <text
                  x={0}
                  y={-sc * 130}
                  textAnchor="middle"
                  fill={accent}
                  fontSize={p ? 34 : 30}
                  fontWeight={700}
                  fontFamily={fontFamily ?? "'Patrick Hand', system-ui, sans-serif"}
                  style={{ filter: "drop-shadow(0 0 8px rgba(255,255,255,0.6))" }}
                >
                  Hey, look there!
                </text>
              </g>
            );
          })()}
        </svg>

        {/* Stacked text + socials + CTAs — flex column with explicit gaps */}
        <div
          style={{
            position: "absolute",
            top: contentTop,
            left: contentPadX,
            right: contentPadX,
            bottom: contentBottom,
            zIndex: 2,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: sectionGap,
            overflow: "hidden",
          }}
        >
          {/* Title */}
          <div
            style={{
              width: "100%",
              textAlign: "center",
              flexShrink: 0,
              opacity: titleProgress,
              transform: `translateY(${interpolate(titleProgress, [0, 1], [20, 0])}px)`,
            }}
          >
            <span
              style={{
                display: "block",
                fontSize: titlePx,
                fontWeight: 700,
                color: accent,
                fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
                letterSpacing: "0.02em",
                textShadow: `0 0 12px rgba(255,255,255,0.7), 0 0 24px rgba(255,255,255,0.3)`,
                lineHeight: 1.2,
                wordBreak: "break-word",
              }}
            >
              {title}
            </span>
          </div>

          {/* Narration / sign-off line */}
          {narration ? (
            <div
              style={{
                width: "100%",
                textAlign: "center",
                flexShrink: 0,
                opacity: narrationOpacity,
              }}
            >
              <span
                style={{
                  display: "block",
                  fontSize: descPx,
                  color: text,
                  fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
                  textShadow: `0 0 6px rgba(255,255,255,0.4)`,
                  lineHeight: 1.45,
                  wordBreak: "break-word",
                }}
              >
                {narration}
              </span>
            </div>
          ) : null}

          {/* Inline social icons */}
          {socialItems.length > 0 ? (
            <div
              style={{
                width: "100%",
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                alignItems: "flex-start",
                gap: p ? 36 : 44,
                flexShrink: 0,
              }}
            >
              {socialItems.map(({ key, label }, i) => {
                const iconOpacity = interpolate(
                  frame,
                  [
                    handlesStartFrame + Math.round(i * 0.12 * fps),
                    handlesStartFrame + Math.round(i * 0.12 * fps) + Math.round(0.3 * fps),
                  ],
                  [0, 1],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                );
                return (
                  <div
                    key={key}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: p ? 10 : 8,
                      opacity: iconOpacity,
                      transform: `translateY(${interpolate(iconOpacity, [0, 1], [8, 0])}px)`,
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: iconSize,
                        height: iconSize,
                        filter: "drop-shadow(0 0 8px rgba(255,255,255,0.45))",
                      }}
                    >
                      <SocialGlyph kind={key} size={iconSize} color={text} />
                    </div>
                    <span
                      style={{
                        fontSize: descPx,
                        color: text,
                        fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
                        textShadow: `0 0 6px rgba(255,255,255,0.4)`,
                        letterSpacing: "0.02em",
                        textAlign: "center",
                        maxWidth: p ? 140 : 120,
                        wordBreak: "break-word",
                      }}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* Handles list (fallback if socials not provided but handles are) */}
          {handlesList.length > 0 && !socials ? (
            <div
              style={{
                width: "100%",
                display: "flex",
                flexDirection: handlesList.length >= 5 ? "column" : "row",
                flexWrap: "wrap",
                justifyContent: "center",
                alignItems: "center",
                gap: p ? 18 : 22,
                flexShrink: 0,
              }}
            >
              {handlesList.map((handle, i) => {
                const handleOpacity = interpolate(
                  frame,
                  [
                    handlesStartFrame + Math.round(i * 0.15 * fps),
                    handlesStartFrame + Math.round(i * 0.15 * fps) + Math.round(0.3 * fps),
                  ],
                  [0, 1],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                );
                return (
                  <span
                    key={i}
                    style={{
                      fontSize: descPx,
                      color: text,
                      fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
                      opacity: handleOpacity,
                      textShadow: `0 0 8px rgba(255,255,255,0.5)`,
                      letterSpacing: "0.03em",
                      textAlign: "center",
                      wordBreak: "break-word",
                    }}
                  >
                    {handle}
                  </span>
                );
              })}
            </div>
          ) : null}

          {/* Website CTAs */}
          {visibleCtas.length > 0 ? (
            <div
              style={{
                width: "100%",
                display: "flex",
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "center",
                alignItems: "flex-start",
                gap: p ? 48 : 72,
                flexShrink: 0,
                opacity: websiteOpacity,
                transform: `translateY(${interpolate(websiteOpacity, [0, 1], [10, 0])}px)`,
              }}
            >
              {visibleCtas.map((cta, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: p ? 8 : 6,
                    flexShrink: 0,
                  }}
                >
                  {cta.ctaButtonText.trim() !== "" ? (
                    <span
                      style={{
                        fontSize: descPx,
                        color: accent,
                        fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
                        textShadow: `0 0 8px rgba(255,255,255,0.6)`,
                        letterSpacing: "0.04em",
                        fontWeight: 500,
                        textAlign: "center",
                        wordBreak: "break-word",
                        maxWidth: p ? 220 : 260,
                      }}
                    >
                      {cta.ctaButtonText.trim()}
                    </span>
                  ) : null}
                  {cta.websiteLink !== "" ? (
                    <span
                      style={{
                        fontSize: Math.round(descPx * 0.78),
                        color: text,
                        fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
                        textShadow: `0 0 6px rgba(255,255,255,0.45)`,
                        letterSpacing: "0.04em",
                        textAlign: "center",
                        wordBreak: "break-word",
                        maxWidth: p ? 220 : 260,
                      }}
                    >
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
