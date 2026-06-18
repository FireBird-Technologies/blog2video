/**
 * Brand-aware transition registry for AI-generated videos.
 *
 * Scenes render sequentially (no overlap) in GeneratedVideo, so each transition
 * is a short branded *exit flourish* overlaid on the last ~15 frames of a scene.
 * A registry of styles replaces the old single fade; the style is chosen
 * deterministically per scene index (optionally constrained by the brand's
 * transitionFamily) so preview and headless render always match.
 *
 * Generalized from the transition registries in laduc / economist.
 */
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";

export type GeneratedTransitionStyle =
  | "fade"
  | "accent_wash"
  | "rule_sweep"
  | "ink_wash"
  | "whip_blur";

interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  bg2?: string;
}

interface GeneratedTransitionProps {
  brandColors: BrandColors;
  /** Scene index — drives deterministic style selection. */
  index?: number;
  /** Force a specific style; otherwise picked from the family by index. */
  style?: GeneratedTransitionStyle;
  /** Restrict the rotation to a subset (from the brand's motion personality). */
  family?: GeneratedTransitionStyle[];
}

const DEFAULT_FAMILY: GeneratedTransitionStyle[] = [
  "fade",
  "accent_wash",
  "rule_sweep",
  "ink_wash",
  "whip_blur",
];

function pickStyle(
  index: number,
  explicit?: GeneratedTransitionStyle,
  family?: GeneratedTransitionStyle[],
): GeneratedTransitionStyle {
  if (explicit) return explicit;
  const pool = family && family.length ? family : DEFAULT_FAMILY;
  return pool[Math.abs(index) % pool.length];
}

export const GeneratedTransition: React.FC<GeneratedTransitionProps> = ({
  brandColors,
  index = 0,
  style,
  family,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });
  const chosen = pickStyle(index, style, family);
  const bg = brandColors.background;
  const accent = brandColors.accent;

  if (chosen === "accent_wash") {
    // Accent color wipes across, then resolves to background underneath.
    return (
      <>
        <AbsoluteFill style={{ backgroundColor: bg, opacity: Math.max(0, p - 0.5) * 2 }} />
        <AbsoluteFill
          style={{
            backgroundColor: accent,
            transform: `translateX(${interpolate(p, [0, 1], [-100, 100])}%)`,
          }}
        />
      </>
    );
  }

  if (chosen === "rule_sweep") {
    // A thick accent rule sweeps across, leaving the background behind it.
    const x = interpolate(p, [0, 1], [-20, 120]);
    return (
      <>
        <AbsoluteFill
          style={{
            backgroundColor: bg,
            clipPath: `inset(0 ${Math.max(0, 100 - x)}% 0 0)`,
          }}
        />
        <AbsoluteFill
          style={{
            background: accent,
            width: "14%",
            left: `${x}%`,
            position: "absolute",
            transform: "skewX(-12deg)",
          }}
        />
      </>
    );
  }

  if (chosen === "ink_wash") {
    // Background blooms outward from the centre.
    const r = interpolate(p, [0, 1], [0, 150]);
    return (
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 50%, ${bg} 0%, ${bg} ${r}%, transparent ${r + 8}%)`,
        }}
      />
    );
  }

  if (chosen === "whip_blur") {
    // Quick blur + slide as the scene whips away.
    return (
      <AbsoluteFill
        style={{
          backgroundColor: bg,
          opacity: p,
          backdropFilter: `blur(${interpolate(p, [0, 1], [0, 14])}px)`,
          WebkitBackdropFilter: `blur(${interpolate(p, [0, 1], [0, 14])}px)`,
          transform: `translateX(${interpolate(p, [0, 1], [0, -6])}%)`,
        }}
      />
    );
  }

  // fade (default) — fade to background with a subtle scale for depth.
  return (
    <AbsoluteFill
      style={{
        backgroundColor: bg,
        opacity: p,
        transform: `scale(${interpolate(p, [0, 1], [1, 1.05])})`,
      }}
    />
  );
};
