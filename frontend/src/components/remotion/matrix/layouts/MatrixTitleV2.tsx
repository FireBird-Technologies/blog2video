import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { MatrixBackground } from "../MatrixBackground";
import {
  buildHudStatus,
  CipherRing,
  GlitchSlice,
  ScanlinesOverlay,
  TerminalHUD,
} from "../components/MatrixArtifacts";
import { MATRIX_DEFAULT_FONT_FAMILY } from "../constants";
import type { MatrixLayoutProps } from "../types";
import { ZoomCropImg } from "../components/ZoomCropImg";
import { ZoomCropVideo } from "../components/ZoomCropVideo";

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/**
 * MatrixTitleV2 — "Boot Sequence"
 *
 * Variant of `matrix_title`. Same props, different composition.
 *
 * Base decodes the title character-by-character, centred over the digital rain.
 * This one stages the same reveal as a SYSTEM BOOT: a terminal frame comes up
 * first, boot log lines print and scroll in sequence, and the title lands as the
 * final entry — locked in by a CipherRing sweep rather than per-char scramble.
 *
 * The log is left-aligned and monospaced so it reads as a real console; the title
 * then breaks that rhythm by being the one oversized line. Any image resolves in a
 * bordered terminal pane at the right rather than the base's centred slot.
 *
 * Seeds 61/62/63 are fresh — the other matrix layouts use 5/9/21/51/53, and reusing
 * one would make two scenes' decorations identical.
 */

/** Boot log lines. Static and hand-written so the console reads as deliberate
 *  machine output rather than lorem noise; the title is appended as the last line. */
const BOOT_LINES = [
  "> POWER ON SELF TEST ......... OK",
  "> MOUNTING /dev/construct ..... OK",
  "> DECRYPTING KEYRING ......... OK",
  "> UPLINK ESTABLISHED",
];

export const MatrixTitleV2: React.FC<MatrixLayoutProps> = ({
  title,
  narration,
  imageUrl,
  imageObjectPosition,
  imageZoom,
  videoUrl,
  videoMuted,
  videoVolume,
  videoDurationInFrames,
  videoStartInFrames,
  accentColor,
  bgColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";
  const accent = accentColor || "#00FF41";
  const resolvedFontFamily = fontFamily ?? MATRIX_DEFAULT_FONT_FAMILY;
  const hasMedia = Boolean(imageUrl || videoUrl);

  // ── Boot log timing ────────────────────────────────────────────────────────
  // Each line prints on a stagger; the whole log is done before the title lands so
  // the title reads as the RESULT of the boot, not part of it.
  const LINE_EVERY = 9;
  const LOG_START = 6;
  const logDone = LOG_START + BOOT_LINES.length * LINE_EVERY;

  const titleStart = logDone + 4;
  const titleOpacity = interpolate(frame, [titleStart, titleStart + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Sustained neon breath after the title settles — the template's signature.
  const glowPulse =
    frame > titleStart + 12 ? 0.7 + Math.sin((frame - titleStart) * 0.15) * 0.3 : 0.7;

  const narrationOpacity = interpolate(
    frame,
    [titleStart + 14, titleStart + 30],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const mediaOpacity = interpolate(frame, [LOG_START + 6, LOG_START + 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titlePx = titleFontSize ?? (p ? 128 : 87);
  const logPx = p ? 26 : 22;
  const narrationPx = descriptionFontSize ?? (p ? 52 : 45);

  // Portrait stacks the console over the media pane; landscape sets them side by
  // side with the console taking the wider share.
  const consoleW = hasMedia && !p ? "58%" : "100%";

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#000000", overflow: "hidden" }}>
      {/* ── Background, deliberately NOT the base's look ──
             The base runs the digital rain at full strength as the whole backdrop.
             This one pushes the rain far back (0.07) and lays a CRT SCHEMATIC over
             it: a fine engineering grid with a brighter major grid, plus a vignette
             that pulls the corners down. The scene reads as a console screen rather
             than "falling code", which is what separates it from the base at a
             glance — before a single word has resolved. */}
      <MatrixBackground bgColor={bgColor} opacity={0.07} fontFamily={resolvedFontFamily} />
      {/* NOTE: MatrixBackground's `opacity` prop is dead code — it is destructured
          but never applied (the columns use a hardcoded 0.5), so the rain always
          renders at full strength. Knocking it back therefore has to be done here,
          with a scrim, rather than by passing a smaller number. Not fixing the
          shared component on purpose: it would change all twelve existing layouts. */}
      <AbsoluteFill style={{ background: bgColor || "#000000", opacity: 0.72 }} />
      <AbsoluteFill
        style={{
          backgroundImage: `
            linear-gradient(${accent}1F 1px, transparent 1px),
            linear-gradient(90deg, ${accent}1F 1px, transparent 1px),
            linear-gradient(${accent}3A 1px, transparent 1px),
            linear-gradient(90deg, ${accent}3A 1px, transparent 1px)
          `,
          backgroundSize: "28px 28px, 28px 28px, 140px 140px, 140px 140px",
          // Slow parallax drift so the grid feels like a live readout, not wallpaper.
          backgroundPosition: `0 ${(frame * 0.22).toFixed(1)}px, ${(frame * 0.1).toFixed(1)}px 0, 0 ${(
            frame * 0.11
          ).toFixed(1)}px, ${(frame * 0.05).toFixed(1)}px 0`,
          opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" }),
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 60% at 50% 45%, transparent 40%, ${
            bgColor || "#000000"
          } 100%)`,
        }}
      />

      {/* Terminal chrome comes up before anything prints. */}
      <TerminalHUD
        accentColor={accent}
        statusText={buildHudStatus("BOOTING", title)}
        startFrame={0}
        seed={61}
      />

      {/* The lock-in sweep fires as the title lands. */}
      <CipherRing accentColor={accent} scale={p ? 0.9 : 0.72} startFrame={titleStart - 6} seed={62} />

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: p ? "column" : "row",
          alignItems: "center",
          justifyContent: "center",
          gap: p ? 34 : 48,
          padding: p ? "8% 7%" : "7% 6%",
          zIndex: 3,
        }}
      >
        {/* ── Console column ── */}
        <div style={{ width: consoleW, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* Boot log */}
          <div style={{ marginBottom: p ? 26 : 30 }}>
            {BOOT_LINES.map((line, i) => {
              const at = LOG_START + i * LINE_EVERY;
              const o = interpolate(frame, [at, at + 6], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              // Older lines dim, so the newest always reads as the live one.
              const age = Math.max(0, (frame - at) / LINE_EVERY);
              const dim = Math.max(0.35, 1 - age * 0.18);
              return (
                <div
                  key={i}
                  style={{
                    fontFamily: resolvedFontFamily,
                    fontSize: logPx,
                    lineHeight: 1.7,
                    color: accent,
                    opacity: o * dim,
                    letterSpacing: "0.04em",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {line}
                </div>
              );
            })}
          </div>

          {/* The title — the final log entry, breaking the console's rhythm.
              Motion is deliberately NOT the base's per-character decode: the words
              PRINT one at a time, each snapping in from a slight negative tracking
              (letters compressed, then released) as though the console is typing
              them whole. That gives the two openings different reveal grammars even
              though both end on the same neon title. */}
          <div
            style={{
              fontFamily: resolvedFontFamily,
              fontSize: titlePx,
              fontWeight: 700,
              lineHeight: 1.04,
              textTransform: "uppercase",
              color: accent,
              display: "flex",
              flexWrap: "wrap",
              gap: `0 ${p ? 16 : 20}px`,
              textShadow: `0 0 ${18 + glowPulse * 26}px ${accent}88, 0 0 ${
                40 + glowPulse * 40
              }px ${accent}44`,
              overflowWrap: "anywhere",
            }}
          >
            {title.split(/\s+/).filter(Boolean).map((w, i) => {
              const at = titleStart + i * 5;
              const o = interpolate(frame, [at, at + 7], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const settle = interpolate(frame, [at, at + 12], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    opacity: o,
                    // Tracking springs open from compressed — a console "printing"
                    // rather than characters scrambling into place.
                    letterSpacing: `${interpolate(settle, [0, 1], [-0.34, -0.03])}em`,
                    transform: `translateX(${interpolate(settle, [0, 1], [-14, 0])}px)`,
                  }}
                >
                  {w}
                </span>
              );
            })}
          </div>

          {/* Accent rule under the title, wiping out from the left. */}
          <div
            style={{
              height: 2,
              width: `${interpolate(frame, [titleStart + 6, titleStart + 24], [0, 100], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}%`,
              background: accent,
              boxShadow: `0 0 12px ${accent}`,
              marginTop: p ? 18 : 16,
            }}
          />

          {narration ? (
            <div
              style={{
                marginTop: p ? 20 : 18,
                fontFamily: resolvedFontFamily,
                fontSize: narrationPx,
                lineHeight: 1.5,
                letterSpacing: "0.06em",
                color: `${accent}88`,
                opacity: narrationOpacity,
                overflowWrap: "anywhere",
              }}
            >
              {narration}
            </div>
          ) : null}
        </div>

        {/* ── Media pane: a bordered terminal window, not a bare image ── */}
        {hasMedia ? (
          <div
            style={{
              width: p ? "100%" : "42%",
              aspectRatio: p ? "16 / 9" : "4 / 3",
              position: "relative",
              border: `1px solid ${accent}33`,
              // Hard edges only — this template never rounds a corner.
              borderRadius: 0,
              overflow: "hidden",
              opacity: mediaOpacity,
              boxShadow: `0 0 30px ${accent}22`,
              flexShrink: 0,
            }}
          >
            {videoUrl ? (
              <ZoomCropVideo
                src={videoUrl}
                imageObjectPosition={imageObjectPosition}
                imageZoom={imageZoom}
                muted={videoMuted ?? true}
                volume={videoVolume ?? 0.35}
                durationInFrames={videoDurationInFrames}
                startInFrames={videoStartInFrames}
              />
            ) : (
              <ZoomCropImg
                src={imageUrl!}
                imageObjectPosition={imageObjectPosition}
                imageZoom={imageZoom}
              />
            )}
            {/* Pane label, so the frame reads as a feed window. */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                padding: "6px 10px",
                fontFamily: resolvedFontFamily,
                fontSize: p ? 18 : 15,
                letterSpacing: "0.14em",
                color: accent,
                background: "rgba(0,0,0,0.65)",
                borderRight: `1px solid ${accent}33`,
                borderBottom: `1px solid ${accent}33`,
              }}
            >
              FEED 01
            </div>
            {/* Scan sweep across the pane while it resolves. */}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                height: 2,
                top: `${(seededRandom(63) * 20 + (frame * 1.6) % 100).toFixed(2)}%`,
                background: `${accent}66`,
                boxShadow: `0 0 14px ${accent}`,
                pointerEvents: "none",
              }}
            />
          </div>
        ) : null}
      </AbsoluteFill>

      <GlitchSlice accentColor={accent} every={70} seed={63} />
      <ScanlinesOverlay accentColor={accent} intensity={0.9} />
    </AbsoluteFill>
  );
};
