import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { MatrixBackground } from "../MatrixBackground";
import {
  buildHudStatus,
  GlitchSlice,
  ScanlinesOverlay,
  SignalWaveform,
  TelemetryGauge,
  TerminalHUD,
} from "../components/MatrixArtifacts";
import { MATRIX_DEFAULT_FONT_FAMILY } from "../constants";
import type { MatrixLayoutProps } from "../types";
import { ZoomCropImg } from "../components/ZoomCropImg";
import { ZoomCropVideo } from "../components/ZoomCropVideo";

/**
 * TerminalTextV2 — "Split Feed"
 *
 * Variant of `terminal_text`. Same props, different composition.
 *
 * Base is a single typewriter column with an optional image beside it. This one
 * splits the frame into two stacked SIGNAL PANES separated by a hard divider:
 *
 *   • the upper pane types the narration, with the highlight word glowing (the
 *     base's contract — `highlightWord` must keep working);
 *   • the lower pane is a telemetry strip — a live SignalWaveform plus a gauge —
 *     that runs underneath the copy rather than beside it.
 *
 * When the scene carries media it takes the lower pane instead of the telemetry,
 * so the split reads the same either way.
 *
 * Seeds 64/65/66 are fresh (the template already uses 5/9/21/51/53 and V2's 61-63).
 */
export const TerminalTextV2: React.FC<MatrixLayoutProps> = ({
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
  highlightWord,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";
  const accent = accentColor || "#00FF41";
  const text = textColor || "#FFFFFF";
  const resolvedFontFamily = fontFamily ?? MATRIX_DEFAULT_FONT_FAMILY;
  const hasMedia = Boolean(imageUrl || videoUrl);

  const body = (narration ?? "").trim();

  // ── Typewriter ─────────────────────────────────────────────────────────────
  // Character count is driven off the frame so the caret keeps pace with the text.
  const TYPE_START = 14;
  const CHARS_PER_FRAME = 1.6;
  const typed = Math.max(
    0,
    Math.min(body.length, Math.floor((frame - TYPE_START) * CHARS_PER_FRAME)),
  );
  const typingDone = typed >= body.length;
  // Caret blinks only once the line has finished typing.
  const caretOn = !typingDone || Math.floor(frame / 8) % 2 === 0;

  const titleOpacity = interpolate(frame, [4, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const paneOpacity = interpolate(frame, [8, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const lowerOpacity = interpolate(frame, [22, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titlePx = titleFontSize ?? (p ? 96 : 96);
  const bodyPx = descriptionFontSize ?? (p ? 46 : 36);

  /** Split the typed prefix so the highlight word can glow without breaking the
   *  character-accurate typewriter. Rendered as spans over the same substring. */
  const hw = (highlightWord ?? "").trim();
  const renderTyped = () => {
    const shown = body.slice(0, typed);
    if (!hw) return shown;
    const idx = shown.toLowerCase().indexOf(hw.toLowerCase());
    if (idx === -1) return shown;
    return (
      <>
        {shown.slice(0, idx)}
        <span
          style={{
            color: accent,
            textShadow: `0 0 16px ${accent}, 0 0 34px ${accent}66`,
          }}
        >
          {shown.slice(idx, idx + hw.length)}
        </span>
        {shown.slice(idx + hw.length)}
      </>
    );
  };

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#000000", overflow: "hidden" }}>
      {/* ── Background: an OSCILLOSCOPE, not the base's open rain field ──
             The base types over full-strength digital rain. Here the rain is almost
             gone (0.05) and the frame is banded with horizontal sweep lines that
             scroll upward, plus a soft centre glow behind the copy. It reads as a
             signal instrument rather than "the Matrix", which is the point: at a
             glance the two terminal scenes should not look like the same shot. */}
      <MatrixBackground bgColor={bgColor} opacity={0.05} fontFamily={resolvedFontFamily} />
      {/* MatrixBackground's `opacity` prop is dead code (destructured, never applied
          — the columns hardcode 0.5), so the rain must be knocked back with a scrim
          here instead. See the note in MatrixTitleV2. */}
      <AbsoluteFill style={{ background: bgColor || "#000000", opacity: 0.78 }} />
      <AbsoluteFill
        style={{
          backgroundImage: `repeating-linear-gradient(
            0deg,
            ${accent}22 0px,
            ${accent}22 1px,
            transparent 1px,
            transparent 9px
          )`,
          backgroundPosition: `0 ${(-frame * 0.6).toFixed(1)}px`,
          opacity: interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" }),
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 60% 45% at 50% 38%, ${accent}12 0%, transparent 70%)`,
        }}
      />

      <TerminalHUD
        accentColor={accent}
        statusText={buildHudStatus("STREAMING", title)}
        startFrame={0}
        seed={64}
      />

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          padding: p ? "13% 8%" : "11% 7%",
          zIndex: 3,
        }}
      >
        {/* ── Pane label + title ── */}
        <div style={{ opacity: titleOpacity, flexShrink: 0 }}>
          <div
            style={{
              fontFamily: resolvedFontFamily,
              fontSize: p ? 20 : 16,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: `${accent}88`,
              marginBottom: p ? 12 : 10,
            }}
          >
            PANE 01 // INPUT
          </div>
          <div
            style={{
              fontFamily: resolvedFontFamily,
              fontSize: titlePx,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
              color: accent,
              textShadow: `0 0 18px ${accent}88, 0 0 38px ${accent}44`,
              overflowWrap: "anywhere",
            }}
          >
            {title}
          </div>
        </div>

        {/* ── Upper pane: the typing body ──
               `flex: 0 0 auto` rather than `flex: 1`: letting it stretch left a large
               dead gap between the copy and the lower pane in portrait, where the
               frame is much taller than the text needs. The spacer below absorbs the
               slack instead, keeping both panes tight to their content. */}
        <div
          style={{
            flexShrink: 0,
            marginTop: p ? 24 : 20,
            paddingTop: p ? 20 : 16,
            borderTop: `1px solid ${accent}33`,
            opacity: paneOpacity,
          }}
        >
          <div
            style={{
              fontFamily: resolvedFontFamily,
              fontSize: bodyPx,
              lineHeight: 1.6,
              color: text,
              letterSpacing: "0.01em",
              overflowWrap: "anywhere",
            }}
          >
            {renderTyped()}
            <span
              style={{
                display: "inline-block",
                width: "0.55em",
                marginLeft: 2,
                color: accent,
                opacity: caretOn ? 1 : 0,
                textShadow: `0 0 12px ${accent}`,
              }}
            >
              █
            </span>
          </div>
        </div>

        {/* Slack absorber: pushes the telemetry pane to the frame's foot without
            stretching the copy block above it. */}
        <div style={{ flex: 1, minHeight: 0 }} />

        {/* ── Divider between the two panes ── */}
        <div
          style={{
            flexShrink: 0,
            height: 1,
            background: `${accent}44`,
            marginTop: p ? 18 : 14,
            opacity: lowerOpacity,
          }}
        />

        {/* ── Lower pane: media when the scene has it, telemetry otherwise ── */}
        <div
          style={{
            flexShrink: 0,
            height: p ? "26%" : "30%",
            marginTop: p ? 16 : 14,
            position: "relative",
            border: `1px solid ${accent}33`,
            borderRadius: 0,
            overflow: "hidden",
            opacity: lowerOpacity,
          }}
        >
          {hasMedia ? (
            videoUrl ? (
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
            )
          ) : (
            // No media: the pane becomes a live telemetry readout so the split
            // still reads as two working panes rather than one empty box.
            <>
              <SignalWaveform
                accentColor={accent}
                edge="bottom"
                bars={p ? 34 : 56}
                startFrame={24}
                seed={65}
              />
              <TelemetryGauge
                accentColor={accent}
                label="SYNC"
                corner="top-right"
                startFrame={26}
                seed={66}
              />
            </>
          )}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              padding: "5px 9px",
              fontFamily: resolvedFontFamily,
              fontSize: p ? 17 : 14,
              letterSpacing: "0.14em",
              color: accent,
              background: "rgba(0,0,0,0.65)",
              borderRight: `1px solid ${accent}33`,
              borderBottom: `1px solid ${accent}33`,
            }}
          >
            {hasMedia ? "PANE 02 // FEED" : "PANE 02 // TELEMETRY"}
          </div>
        </div>
      </AbsoluteFill>

      <GlitchSlice accentColor={accent} every={58} seed={66} />
      <ScanlinesOverlay accentColor={accent} intensity={0.85} />
    </AbsoluteFill>
  );
};
