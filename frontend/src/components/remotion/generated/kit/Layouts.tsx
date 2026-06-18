/**
 * Custom-template craft kit — LAYOUT SKELETONS.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The #1 reason AI-generated custom videos looked repetitive was that the five
 * "compositions" (centered / asymmetric / full-bleed / offset / side-rail) were
 * only *adjectives in the prompt* — there was no concrete component to fill, so
 * the model defaulted to a centered card every time. These are the REAL,
 * structure-only scaffolds those adjectives now map to. Each one fixes the
 * GEOMETRY (where the focal element sits, where the negative space is, which
 * edge the accent/eyebrow lives on) and nothing else.
 *
 * WHY THIS DOESN'T MAKE BRANDS LOOK ALIKE
 * ───────────────────────────────────────
 * Identity is carried ~80% by type + decor + surface + motion (the brand
 * SIGNATURE), ~20% by geometry. So a shared skeleton is safe: the same
 * `AsymmetricSplit` renders with each brand's own palette (via useKit), its own
 * signature `decor` backdrop (passed in), and brand-themed content in the slots.
 * Stripe's split and an editorial brand's split share geometry but read as two
 * different products — exactly how our built-ins reuse split/stack archetypes.
 *
 * HOW THE AI USES THEM
 * ────────────────────
 * Code generation assigns each content scene a composition and tells the model
 * to wrap its content in the matching skeleton, passing the brand's signature
 * decor system. The skeleton guarantees the scene-to-scene structural variety;
 * the model still authors the content + animation inside the slots.
 */

import React from "react";
import { useCurrentFrame } from "remotion";
import { useKit } from "./context";
import { withAlpha } from "./theme";
import { progressAt, easeOutQuint } from "./motion";
import { Decor, type DecorSystem } from "./Decor";

/** Frame-0 debug so a render/preview log proves which skeleton was used. */
function debugLayout(name: string, frame: number, extra = "") {
  if (frame === 0 && typeof console !== "undefined") {
    // eslint-disable-next-line no-console
    console.log(`[F7-DEBUG][V3][LAYOUT] ${name}${extra ? " " + extra : ""}`);
  }
}

export interface LayoutBaseProps {
  children?: React.ReactNode;
  /** Brand signature decor backdrop (pass the signature decorSystem). */
  decor?: DecorSystem;
  decorIntensity?: number;
  /** Small kicker/eyebrow label placed in the layout's accent slot. */
  eyebrow?: React.ReactNode;
  style?: React.CSSProperties;
}

const Shell: React.FC<{
  decor?: DecorSystem;
  decorIntensity?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ decor, decorIntensity = 0.45, style, children }) => (
  <div style={{ position: "absolute", inset: 0, overflow: "hidden", ...style }}>
    {decor && decor !== "none" && <Decor system={decor} intensity={decorIntensity} />}
    {children}
  </div>
);

/** Thin accent rule that draws in from one end — the shared "signature" accent. */
const AccentRule: React.FC<{ vertical?: boolean; start?: number; thickness?: number }> = ({
  vertical = false,
  start = 4,
  thickness = 3,
}) => {
  const frame = useCurrentFrame();
  const { palette } = useKit();
  const grow = easeOutQuint(progressAt(frame, start, 16));
  return (
    <div
      style={{
        background: palette.accent,
        borderRadius: thickness,
        ...(vertical
          ? { width: thickness, height: "100%", transform: `scaleY(${grow})`, transformOrigin: "top" }
          : { height: thickness, width: "100%", transform: `scaleX(${grow})`, transformOrigin: "left" }),
      }}
    />
  );
};

const Eyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { palette, fonts, type } = useKit();
  return (
    <div
      style={{
        fontFamily: fonts.body,
        fontSize: type.label,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: palette.accent,
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
};

/** (0) Centered focal — one big focal block dead-center, decor radiating around. */
export const CenteredFocal: React.FC<LayoutBaseProps> = ({
  children,
  decor,
  decorIntensity,
  eyebrow,
  style,
}) => {
  const frame = useCurrentFrame();
  const { isPortrait } = useKit();
  debugLayout("CenteredFocal", frame);
  return (
    <Shell decor={decor} decorIntensity={decorIntensity} style={style}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: 18,
          padding: isPortrait ? "8% 7%" : "9% 12%",
        }}
      >
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        {children}
      </div>
    </Shell>
  );
};

/** (1) Asymmetric split — `main` gets ~62%, `aside` ~38%; portrait stacks. */
export const AsymmetricSplit: React.FC<
  LayoutBaseProps & { main?: React.ReactNode; aside?: React.ReactNode; mainSide?: "left" | "right" }
> = ({ main, aside, mainSide = "left", decor, decorIntensity, eyebrow, style }) => {
  const frame = useCurrentFrame();
  const { isPortrait } = useKit();
  debugLayout("AsymmetricSplit", frame, `mainSide=${mainSide}`);
  const mainPanel = (
    <div style={{ flex: "0 0 62%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 16, minWidth: 0 }}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      {main}
    </div>
  );
  const asidePanel = (
    <div style={{ flex: "0 0 38%", display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
      {aside}
    </div>
  );
  return (
    <Shell decor={decor} decorIntensity={decorIntensity} style={style}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: isPortrait ? "column" : "row",
          gap: isPortrait ? 28 : 56,
          alignItems: "stretch",
          padding: isPortrait ? "8% 7%" : "8% 9%",
        }}
      >
        {mainSide === "left" ? (
          <>
            {mainPanel}
            {asidePanel}
          </>
        ) : (
          <>
            {asidePanel}
            {mainPanel}
          </>
        )}
      </div>
    </Shell>
  );
};

/** (2) Full-bleed hero — `image` fills edge-to-edge, content overlaid with a scrim. */
export const FullBleedHero: React.FC<
  LayoutBaseProps & { image?: React.ReactNode; scrim?: "bottom" | "full" | "none" }
> = ({ image, children, scrim = "bottom", eyebrow, style }) => {
  const frame = useCurrentFrame();
  const { palette, isPortrait } = useKit();
  debugLayout("FullBleedHero", frame, `scrim=${scrim}`);
  const scrimBg =
    scrim === "none"
      ? "transparent"
      : scrim === "full"
        ? withAlpha(palette.bg, 0.55)
        : `linear-gradient(0deg, ${withAlpha(palette.bg, 0.86)} 0%, ${withAlpha(palette.bg, 0.2)} 45%, transparent 70%)`;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", ...style }}>
      <div style={{ position: "absolute", inset: 0 }}>{image}</div>
      <div style={{ position: "absolute", inset: 0, background: scrimBg }} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          gap: 14,
          padding: isPortrait ? "0 7% 12%" : "0 9% 9%",
        }}
      >
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        {children}
      </div>
    </div>
  );
};

/** (3) Offset card stack — rows stacked on one side, eyebrow + accent rule opposite. */
export const OffsetCardStack: React.FC<LayoutBaseProps & { side?: "left" | "right" }> = ({
  children,
  side = "right",
  decor,
  decorIntensity,
  eyebrow,
  style,
}) => {
  const frame = useCurrentFrame();
  const { isPortrait } = useKit();
  debugLayout("OffsetCardStack", frame, `side=${side}`);
  const railCol = (
    <div style={{ flex: "0 0 30%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 18 }}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <div style={{ height: 90 }}>
        <AccentRule vertical />
      </div>
    </div>
  );
  const stackCol = (
    <div style={{ flex: "0 0 62%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 16, minWidth: 0 }}>
      {children}
    </div>
  );
  return (
    <Shell decor={decor} decorIntensity={decorIntensity} style={style}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: isPortrait ? "column" : "row",
          gap: isPortrait ? 22 : 48,
          alignItems: "stretch",
          padding: isPortrait ? "8% 7%" : "8% 9%",
        }}
      >
        {side === "right" ? (
          <>
            {railCol}
            {stackCol}
          </>
        ) : (
          <>
            {stackCol}
            {railCol}
          </>
        )}
      </div>
    </Shell>
  );
};

/** (4) Side rail — a vertical accent rail + eyebrow on one edge, content beside it. */
export const SideRail: React.FC<LayoutBaseProps & { side?: "left" | "right" }> = ({
  children,
  side = "left",
  decor,
  decorIntensity,
  eyebrow,
  style,
}) => {
  const frame = useCurrentFrame();
  const { isPortrait, palette } = useKit();
  debugLayout("SideRail", frame, `side=${side}`);
  const rail = (
    <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, width: 46 }}>
      <div style={{ flex: 1, width: 3, background: withAlpha(palette.accent, 0.9) }} />
      {eyebrow && (
        <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
          <Eyebrow>{eyebrow}</Eyebrow>
        </div>
      )}
      <div style={{ flex: 1, width: 3, background: withAlpha(palette.accent, 0.25) }} />
    </div>
  );
  const content = (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 16, minWidth: 0 }}>
      {children}
    </div>
  );
  return (
    <Shell decor={decor} decorIntensity={decorIntensity} style={style}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "row",
          gap: isPortrait ? 28 : 48,
          alignItems: "stretch",
          padding: isPortrait ? "8% 7%" : "8% 9%",
        }}
      >
        {side === "left" ? (
          <>
            {rail}
            {content}
          </>
        ) : (
          <>
            {content}
            {rail}
          </>
        )}
      </div>
    </Shell>
  );
};
