import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { MatrixBackground } from "../MatrixBackground";
import {
  buildHudStatus,
  GridTunnel,
  ScanlinesOverlay,
  TerminalHUD,
} from "../components/MatrixArtifacts";
import { MATRIX_DEFAULT_FONT_FAMILY } from "../constants";
import type { MatrixLayoutProps } from "../types";
import { SocialIcons } from "../../SocialIcons";
import { resolveCtas } from "../../shared/resolveCtas";

const GLITCH_CHARS = "アイウエオカキクケコ0123456789!@#$%^&*<>{}[]";

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/**
 * Per-character decode reveal — copied from the base layout so both endings share
 * the template's signature text idiom exactly.
 */
const DecodeText: React.FC<{
  text: string;
  startFrame: number;
  decodeFramesPerChar: number;
  accent: string;
  fontFamily: string;
  style?: React.CSSProperties;
}> = ({ text, startFrame, decodeFramesPerChar, accent, fontFamily, style }) => {
  const frame = useCurrentFrame();
  const chars = text.split("");

  return (
    <div style={{ ...style, fontFamily }}>
      {chars.map((char, i) => {
        const charRevealFrame = startFrame + i * decodeFramesPerChar;
        const isRevealed = frame >= charRevealFrame;
        const isDecoding = frame >= charRevealFrame - 8 && !isRevealed;

        let displayChar = char;
        if (char === " ") {
          displayChar = " ";
        } else if (isDecoding) {
          const glitchIdx = Math.floor(
            seededRandom(i * 100 + frame * 7) * GLITCH_CHARS.length
          );
          displayChar = GLITCH_CHARS[glitchIdx];
        } else if (!isRevealed) {
          displayChar = " ";
        }

        return (
          <span
            key={i}
            style={{
              opacity: char === " " ? 1 : isRevealed || isDecoding ? 1 : 0,
              color: isDecoding ? `${accent}66` : "inherit",
            }}
          >
            {displayChar}
          </span>
        );
      })}
    </div>
  );
};

/**
 * EndingSocialsV2 — "Uplink"
 *
 * Variant of `ending_socials`. Same props, different composition.
 *
 * Base centres a decoded title with the socials row and CTA cards stacked beneath.
 * This one restages the sign-off as an UPLINK HANDSHAKE: the CTA sits in a boxed
 * GridTunnel panel at the top — the channel being opened — and the socials resolve
 * below as terminal connection rows, each `> CONNECT <name> ....... [OK]` printing
 * on a stagger with its status flipping from `··` to `OK`.
 *
 * The CTA/socials resolution (`resolveCtas`, the `showWebsiteButton` + link filter,
 * and `SocialIcons`) is reused UNCHANGED from the base — that is the one part of
 * this scene with real behavioural surface (editor payload shapes, the 1–3 CTA
 * array), so it must not be re-derived.
 *
 * Seeds 67/68 are fresh.
 */
export const EndingSocialsV2: React.FC<MatrixLayoutProps> = ({
  title,
  narration,
  socials,
  websiteLink,
  showWebsiteButton,
  ctaButtonText,
  ctas,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  fontFamily,
  titleFontSize,
  descriptionFontSize,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";
  const accent = accentColor || "#00FF41";
  const resolvedFontFamily = (fontFamily ?? "").trim() || MATRIX_DEFAULT_FONT_FAMILY;

  const subtext = (narration ?? "").trim();

  // Identical filter to the base: only cards with the toggle on AND a link.
  const cards = resolveCtas({ ctas, ctaButtonText, websiteLink, showWebsiteButton }).filter(
    (c) => c.showWebsiteButton && c.websiteLink.length > 0,
  );
  const hasAnyCard = cards.length > 0;

  // ── Timing ────────────────────────────────────────────────────────────────
  const titleStart = 8;
  const decodeSpeed = 2;
  const titleDone = titleStart + title.length * decodeSpeed;
  const subtextStart = titleDone + 4;
  const panelStart = subtextStart + 8;
  const rowsStart = panelStart + 14;

  const bgOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const subtextOpacity = interpolate(frame, [subtextStart, subtextStart + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const panelOpacity = interpolate(frame, [panelStart, panelStart + 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const socialsOpacity = interpolate(frame, [rowsStart + 10, rowsStart + 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titlePx = titleFontSize ?? (p ? 98 : 83);
  const subPx = descriptionFontSize ?? (p ? 48 : 42);
  const rowPx = p ? 26 : 21;

  /**
   * One connection row per CTA.
   *
   * NOTE the fallback: matrix's `ending_socials` schema declares only
   * `websiteLink` + `showWebsiteButton` — there is NO `ctaButtonText` field — so
   * for most scenes `resolveCtas` hands back an empty label. The base layout
   * falls back to "Get started", and this must match it, or the button appears
   * to have no label at all. (An earlier revision used "CHANNEL", which read as
   * a system word rather than a call to action.)
   */
  const rows = cards.map((c) => ({
    label: (c.ctaButtonText.trim() || "Get started").toUpperCase(),
    link: c.websiteLink,
  }));

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#000000", overflow: "hidden" }}>
      {/* ── Background: CONCENTRIC UPLINK RINGS, not the base's rain-and-moon ──
             The base closes on full-strength rain. This one pushes the rain right
             back and puts expanding radar rings at the centre — the signal going
             out — with the GridTunnel kept low behind them. Low tunnel intensity is
             deliberate: its perspective lines converge exactly where the socials
             sit, and at full strength they wash the handles out. */}
      <MatrixBackground bgColor={bgColor} opacity={0.10 * bgOpacity} fontFamily={resolvedFontFamily} />
      {/* MatrixBackground's `opacity` prop is dead code (destructured, never applied
          — the columns hardcode 0.5), so the rain is knocked back with a scrim here
          instead. See the note in MatrixTitleV2. */}
      <AbsoluteFill style={{ background: bgColor || "#000000", opacity: 0.8 * bgOpacity }} />
      <GridTunnel accentColor={accent} intensity={0.28} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
        {[0, 1, 2].map((i) => {
          // Three rings on a staggered 90-frame cycle, each expanding and fading —
          // a broadcast pulse rather than a static backdrop.
          const period = 90;
          const t = ((frame + i * (period / 3)) % period) / period;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                width: p ? 620 : 760,
                height: p ? 620 : 760,
                borderRadius: "50%",
                border: `1px solid ${accent}`,
                opacity: (1 - t) * 0.16 * bgOpacity,
                transform: `scale(${0.35 + t * 1.5})`,
              }}
            />
          );
        })}
      </AbsoluteFill>

      <TerminalHUD
        accentColor={accent}
        statusText={buildHudStatus("UPLINK", title)}
        startFrame={0}
        seed={67}
      />

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "14% 8%" : "10% 9%",
          zIndex: 3,
        }}
      >
        {/* Title — decoded, matching the base's signature reveal. */}
        <DecodeText
          text={title}
          startFrame={titleStart}
          decodeFramesPerChar={decodeSpeed}
          accent={accent}
          fontFamily={resolvedFontFamily}
          style={{
            fontSize: titlePx,
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            textAlign: "center",
            color: accent,
            textShadow: `0 0 20px ${accent}88, 0 0 44px ${accent}44`,
            overflowWrap: "anywhere",
          }}
        />

        {subtext ? (
          <div
            style={{
              marginTop: p ? 18 : 14,
              fontFamily: resolvedFontFamily,
              fontSize: subPx,
              lineHeight: 1.5,
              letterSpacing: "0.06em",
              color: `${accent}88`,
              textAlign: "center",
              opacity: subtextOpacity,
              maxWidth: "92%",
              overflowWrap: "anywhere",
            }}
          >
            {subtext}
          </div>
        ) : null}

        {/* ── The uplink panel: the CTA, boxed as the channel being opened ── */}
        {hasAnyCard ? (
          <div
            style={{
              marginTop: p ? 34 : 28,
              width: p ? "100%" : "78%",
              border: `1px solid ${accent}55`,
              // Hard edges — the template never rounds a corner.
              borderRadius: 0,
              background: "rgba(0,0,0,0.55)",
              boxShadow: `0 0 34px ${accent}22`,
              opacity: panelOpacity,
              padding: p ? "18px 20px" : "16px 22px",
            }}
          >
            <div
              style={{
                fontFamily: resolvedFontFamily,
                fontSize: p ? 18 : 15,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: `${accent}88`,
                marginBottom: p ? 14 : 12,
              }}
            >
              OPEN CHANNEL
            </div>

            {rows.map((r, i) => {
              const at = rowsStart + i * 8;
              const o = interpolate(frame, [at, at + 8], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              // Status flips to OK a beat after the row prints.
              const ok = frame >= at + 12;
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: p ? 10 : 12,
                    opacity: o,
                    marginTop: i === 0 ? 0 : p ? 12 : 10,
                    fontFamily: resolvedFontFamily,
                    fontSize: rowPx,
                    letterSpacing: "0.04em",
                  }}
                >
                  <span style={{ color: accent, flexShrink: 0 }}>&gt; CONNECT</span>
                  <span
                    style={{
                      color: accent,
                      fontWeight: 700,
                      flexShrink: 0,
                      textShadow: `0 0 12px ${accent}66`,
                    }}
                  >
                    {r.label}
                  </span>
                  {/* Dot leader fills the gap, as a real console log would. */}
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      color: `${accent}44`,
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {"·".repeat(60)}
                  </span>
                  <span
                    style={{
                      flexShrink: 0,
                      color: ok ? accent : `${accent}55`,
                      fontWeight: 700,
                      textShadow: ok ? `0 0 14px ${accent}` : "none",
                    }}
                  >
                    [{ok ? "OK" : "··"}]
                  </span>
                </div>
              );
            })}

            {/* The link itself, under the rows. */}
            <div
              style={{
                marginTop: p ? 16 : 13,
                paddingTop: p ? 12 : 10,
                borderTop: `1px solid ${accent}33`,
                fontFamily: resolvedFontFamily,
                fontSize: p ? 24 : 19,
                letterSpacing: "0.05em",
                color: textColor || "#00FF41",
                opacity: socialsOpacity,
                wordBreak: "break-word",
              }}
            >
              {rows[0]?.link}
            </div>
          </div>
        ) : null}

        {/* ── Socials, below the panel ──
               On a scrim: the GridTunnel's perspective lines run right through this
               band and left the handles hard to read against them. */}
        <div
          style={{
            marginTop: p ? 30 : 26,
            opacity: socialsOpacity,
            width: "100%",
            display: "flex",
            justifyContent: "center",
            padding: p ? "16px 12px" : "14px 18px",
            background: "rgba(0,0,0,0.62)",
            borderTop: `1px solid ${accent}33`,
            borderBottom: `1px solid ${accent}33`,
          }}
        >
          <SocialIcons
            socials={socials}
            accentColor={accent}
            textColor={textColor || "#00FF41"}
            maxPerRow={p ? 4 : 10}
            fontFamily={resolvedFontFamily}
            aspectRatio={aspectRatio}
          />
        </div>
      </AbsoluteFill>

      <ScanlinesOverlay accentColor={accent} intensity={0.9} />
    </AbsoluteFill>
  );
};
