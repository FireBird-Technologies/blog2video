import { AbsoluteFill, interpolate, useCurrentFrame, spring } from "remotion";
import { SpotlightBackground } from "../SpotlightBackground";
import {
  AccentBars,
  BigGlyphBackdrop,
  FilmGrain,
  HalftoneField,
  SpotlightBeam,
} from "../components/SpotlightArtifacts";
import {
  SPOTLIGHT_BODY_DEFAULT_FONT_FAMILY,
  SPOTLIGHT_DISPLAY_DEFAULT_FONT_FAMILY,
} from "../constants";
import type { SpotlightLayoutProps } from "../types";
import { ZoomCropImg } from "../components/ZoomCropImg";
import { ZoomCropVideo } from "../components/ZoomCropVideo";

function normalizeToken(word: string): string {
  return word.toLowerCase().replace(/[.,!?:;]/g, "");
}

/**
 * StatementV2 — "Pull Quote"
 *
 * Variant of `statement`. Same props, different composition.
 *
 * Base drops the narration line-by-line, centred, with one accent word. This one
 * sets the same copy as a magazine-style PULL QUOTE:
 *
 *   • an oversized ghost quote mark sits behind the text (BigGlyphBackdrop);
 *   • the copy is LEFT-aligned against a full-height accent rule, not centred;
 *   • lines are revealed by a horizontal MASK WIPE rather than a vertical drop —
 *     a different reveal grammar in the same visual language.
 *
 * The highlighted word still takes the accent, per the base's contract.
 *
 * Seeds 49/53 are fresh (the template already uses 3/11/19/23, plus V2's 41/43/47).
 */
export const StatementV2: React.FC<SpotlightLayoutProps> = ({
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
  textColor,
  bgColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";
  const accent = accentColor || "#EF4444";
  const text = textColor || "#FFFFFF";
  const displayFontFamily = fontFamily ?? SPOTLIGHT_DISPLAY_DEFAULT_FONT_FAMILY;
  const bodyFontFamily = fontFamily ?? SPOTLIGHT_BODY_DEFAULT_FONT_FAMILY;

  const hasMedia = Boolean(imageUrl || videoUrl);
  const quote = (narration ?? "").trim() || title;

  // ── Break the quote into 2–4 balanced lines ────────────────────────────────
  // Word-count split rather than character-count: it keeps the ragged right edge
  // even, which is what makes a pull quote read as typeset rather than wrapped.
  const words = quote.split(/\s+/).filter(Boolean);
  const lineCount = words.length <= 6 ? 2 : words.length <= 14 ? 3 : 4;
  const perLine = Math.ceil(words.length / lineCount);
  const lines: string[][] = [];
  for (let i = 0; i < words.length; i += perLine) {
    lines.push(words.slice(i, i + perLine));
  }

  const hw = (highlightWord ?? "").trim();
  const hwNorm = normalizeToken(hw);

  // ── Timing ────────────────────────────────────────────────────────────────
  const LINE_START = 8;
  const LINE_EVERY = 7;
  const linesDone = LINE_START + lines.length * LINE_EVERY;

  const ruleGrow = spring({
    frame: frame - 4,
    fps,
    config: { damping: 20, stiffness: 90 },
  });
  const attributionOpacity = interpolate(frame, [linesDone + 4, linesDone + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const mediaOpacity = interpolate(frame, [12, 36], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const quotePx = titleFontSize ?? (p ? 66 : 72);
  const attrPx = descriptionFontSize ?? (p ? 24 : 20);

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#000000", overflow: "hidden" }}>
      {/* ── Background: an EDITORIAL PAGE, not the base's stage glow ──
             The base uses the drifting-glow backdrop directly. This one dims that
             right down and lays a printed-page treatment over it: a wide accent
             column block behind the quote (the "printed panel"), and a single hairline
             rule crossing the frame. It reads as a spread rather than a stage, which
             is what makes it a genuinely different scene and not a re-arrangement. */}
      <SpotlightBackground bgColor={bgColor} accentColor={accent} intensity={0.4} />
      <AbsoluteFill
        style={{
          background: `linear-gradient(90deg, ${accent}0F 0%, ${accent}0A ${
            p ? 100 : 62
          }%, transparent ${p ? 100 : 66}%)`,
          opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" }),
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: p ? "22%" : "26%",
          height: 1,
          background: `${accent}30`,
          transformOrigin: "left center",
          transform: `scaleX(${interpolate(frame, [4, 30], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })})`,
        }}
      />

      {/* The ghost quote mark — suppressed when media shares the frame, so the two
          never fight for the same space (the base does the same with its glyph). */}
      {!hasMedia ? (
        <BigGlyphBackdrop
          glyph="&rdquo;"
          accentColor={accent}
          tint="accent"
          startFrame={2}
          align={p ? "center" : "left"}
        />
      ) : null}

      <SpotlightBeam mode="drift" startFrame={0} intensity={0.75} />
      <HalftoneField accentColor={accent} corner="bottom-right" pitch={p ? 20 : 24} tint="white" intensity={0.5} />

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: p ? "column" : "row",
          alignItems: "center",
          justifyContent: "center",
          gap: p ? 30 : 52,
          padding: p ? "13% 8%" : "11% 8%",
          zIndex: 3,
        }}
      >
        {/* ── Quote column ── */}
        <div
          style={{
            width: hasMedia && !p ? "60%" : "100%",
            minWidth: 0,
            display: "flex",
            gap: p ? 20 : 26,
          }}
        >
          {/* Full-height accent rule the copy hangs off. */}
          <div
            style={{
              flexShrink: 0,
              width: 6,
              alignSelf: "stretch",
              background: accent,
              transformOrigin: "top center",
              transform: `scaleY(${ruleGrow})`,
            }}
          />

          <div style={{ minWidth: 0, flex: 1 }}>
            {lines.map((lineWords, li) => {
              const at = LINE_START + li * LINE_EVERY;
              // Horizontal mask wipe — the variant's reveal grammar.
              const wipe = interpolate(frame, [at, at + 14], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                <div
                  key={li}
                  style={{
                    fontFamily: displayFontFamily,
                    fontWeight: 900,
                    fontSize: quotePx,
                    lineHeight: 1.08,
                    letterSpacing: "-0.035em",
                    textTransform: "uppercase",
                    color: text,
                    clipPath: `inset(0 ${((1 - wipe) * 100).toFixed(2)}% 0 0)`,
                    overflowWrap: "anywhere",
                  }}
                >
                  {lineWords.map((w, wi) => {
                    const isHl = hwNorm !== "" && normalizeToken(w) === hwNorm;
                    return (
                      <span
                        key={wi}
                        style={{
                          color: isHl ? accent : text,
                          textShadow: isHl ? `0 0 40px ${accent}55` : "none",
                        }}
                      >
                        {w}
                        {wi < lineWords.length - 1 ? " " : ""}
                      </span>
                    );
                  })}
                </div>
              );
            })}

            {/* Attribution rule + the scene title as the source line. */}
            <div
              style={{
                marginTop: p ? 26 : 24,
                display: "flex",
                alignItems: "center",
                gap: 14,
                opacity: attributionOpacity,
              }}
            >
              <div style={{ height: 2, width: p ? 40 : 54, background: accent, flexShrink: 0 }} />
              <div
                style={{
                  fontFamily: bodyFontFamily,
                  fontWeight: 300,
                  fontSize: attrPx,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: text,
                  opacity: 0.75,
                  minWidth: 0,
                  overflowWrap: "anywhere",
                }}
              >
                {title}
              </div>
            </div>
          </div>
        </div>

        {/* ── Media plate: tall, on the facing side ── */}
        {hasMedia ? (
          <div
            style={{
              width: p ? "100%" : "36%",
              aspectRatio: p ? "16 / 9" : "3 / 4",
              position: "relative",
              overflow: "hidden",
              flexShrink: 0,
              opacity: mediaOpacity,
              borderRight: `6px solid ${accent}`,
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
          </div>
        ) : null}
      </AbsoluteFill>

      <AccentBars accentColor={accent} position="bottom-left" count={2} startFrame={18} />
      <FilmGrain intensity={0.85} />
    </AbsoluteFill>
  );
};
