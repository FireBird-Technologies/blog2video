import { AbsoluteFill, interpolate, useCurrentFrame, spring } from "remotion";
import { SpotlightBackground } from "../SpotlightBackground";
import {
  AccentBars,
  CornerFrame,
  FilmGrain,
  FlashPop,
  LightDust,
  SpotlightBeam,
  StarburstBadge,
  TitleEcho,
} from "../components/SpotlightArtifacts";
import {
  SPOTLIGHT_BODY_DEFAULT_FONT_FAMILY,
  SPOTLIGHT_DISPLAY_DEFAULT_FONT_FAMILY,
} from "../constants";
import type { SpotlightLayoutProps } from "../types";
import { ZoomCropImg } from "../components/ZoomCropImg";
import { ZoomCropVideo } from "../components/ZoomCropVideo";

function normalizeTitleToken(word: string): string {
  return word.toLowerCase().replace(/[.,!?:;]/g, "");
}

/**
 * Which word gets the accent. Copied VERBATIM from the base layout — it is the
 * load-bearing bit of `impact_title`'s contract (explicit `highlightWord`, then a
 * fuzzy match, then the longest word), and re-deriving it would make the two
 * variants disagree about which word to emphasise for the same scene.
 */
function resolveImpactTitleHighlightIndex(
  words: string[],
  highlightWord: string | undefined
): number {
  if (words.length === 0) return 0;
  if (highlightWord?.trim()) {
    const hw = normalizeTitleToken(highlightWord.trim());
    const byExact = words.findIndex((w) => normalizeTitleToken(w) === hw);
    if (byExact >= 0) return byExact;
    const byIncludes = words.findIndex(
      (w) =>
        normalizeTitleToken(w).includes(hw) || hw.includes(normalizeTitleToken(w))
    );
    if (byIncludes >= 0) return byIncludes;
  }
  let best = 0;
  let bestLen = 0;
  words.forEach((w, i) => {
    const len = normalizeTitleToken(w).replace(/[^a-z0-9]/gi, "").length;
    if (len > bestLen && len >= 3) {
      bestLen = len;
      best = i;
    }
  });
  return best;
}

/**
 * ImpactTitleV2 — "Marquee"
 *
 * Variant of `impact_title`. Same props, different composition.
 *
 * Base slams the whole title in as one centred block with one accent word. This one
 * stages it as a THEATRE MARQUEE: the title sits inside a drawn CornerFrame with
 * starburst badges at the corners, the words rise line-by-line rather than arriving
 * together, and the SpotlightBeam sweeps across and lands on the highlight while a
 * TitleEcho chases it outward.
 *
 * The slam is kept — it is the template's signature motion — but it moves from the
 * whole block to the highlighted word alone, so the emphasis reads as a spotlight
 * hitting one name on a bill rather than the entire sign arriving at once.
 *
 * Seeds 41/43/47 are fresh (the template already uses 3/11/19/23).
 */
export const ImpactTitleV2: React.FC<SpotlightLayoutProps> = ({
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

  const words = title.trim().split(/\s+/).filter(Boolean);
  const hlIndex = resolveImpactTitleHighlightIndex(words, highlightWord);

  // ── Timing ────────────────────────────────────────────────────────────────
  const WORD_START = 8;
  const WORD_EVERY = 4;
  // The beam lands on the highlight just as that word arrives.
  const hlLand = WORD_START + hlIndex * WORD_EVERY;

  const frameOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const narrationOpacity = interpolate(
    frame,
    [WORD_START + words.length * WORD_EVERY + 6, WORD_START + words.length * WORD_EVERY + 24],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const mediaOpacity = interpolate(frame, [14, 38], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const mediaSpring = spring({ frame: frame - 14, fps, config: { damping: 20, stiffness: 80 } });

  const titlePx = titleFontSize ?? (p ? 97 : 100);
  const narrationPx = descriptionFontSize ?? (p ? 29 : 33);

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#000000", overflow: "hidden" }}>
      {/* ── Background: a MARQUEE BOARD, not the base's open stage ──
             The base plays on the plain drifting-glow backdrop. This one lays a
             theatre sign over it: a dense bulb grid whose lights chase in sequence,
             and a warm floor wash rising from the bottom edge, so the frame reads as
             a lit sign rather than an empty stage. */}
      <SpotlightBackground bgColor={bgColor} accentColor={accent} intensity={0.55} />
      <AbsoluteFill
        style={{
          // Brighter bulbs than a subtle texture would use: at low alpha the grid
          // vanished entirely behind the beam, which defeated the point of having a
          // marquee board at all.
          backgroundImage: `radial-gradient(circle, ${accent}66 2.1px, transparent 2.2px)`,
          backgroundSize: p ? "38px 38px" : "44px 44px",
          // The chase: the whole bulb field pulses on a slow cycle.
          opacity:
            interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" }) *
            (0.62 + Math.sin(frame * 0.09) * 0.2),
          // Fade at the very edges only, so the board fills the frame.
          maskImage: "radial-gradient(ellipse 96% 92% at 50% 45%, black 62%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 96% 92% at 50% 45%, black 62%, transparent 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          background: `linear-gradient(0deg, ${accent}1F 0%, transparent 34%)`,
          opacity: interpolate(frame, [6, 28], [0, 1], { extrapolateRight: "clamp" }),
        }}
      />

      {/* Beam sweeps across and LANDS on the highlighted word. */}
      <SpotlightBeam mode="land" targetX={p ? 50 : 42} startFrame={hlLand - 10} intensity={1.1} />
      <LightDust count={26} seed={41} tint="white" accentColor={accent} />

      {/* Marquee frame + corner badges — the theatre-bill chrome. */}
      <CornerFrame accentColor={accent} size={p ? 54 : 74} startFrame={2} />
      <StarburstBadge accentColor={accent} label="LIVE" corner="top-right" size={p ? 88 : 104} startFrame={16} />

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: p ? "column" : "row",
          alignItems: "center",
          justifyContent: "center",
          gap: p ? 34 : 56,
          padding: p ? "12% 9%" : "10% 8%",
          zIndex: 3,
        }}
      >
        {/* ── Title column ── */}
        <div
          style={{
            width: hasMedia && !p ? "56%" : "100%",
            minWidth: 0,
            opacity: frameOpacity,
          }}
        >
          {/* Kicker rule above the bill. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginBottom: p ? 20 : 18,
            }}
          >
            <div
              style={{
                height: 4,
                width: `${interpolate(frame, [4, 22], [0, p ? 90 : 110], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })}px`,
                background: accent,
              }}
            />
            <div
              style={{
                fontFamily: bodyFontFamily,
                fontWeight: 300,
                fontSize: p ? 20 : 17,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: text,
                opacity: interpolate(frame, [8, 22], [0, 0.75], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              Now Showing
            </div>
          </div>

          {/* The bill itself — words rise one at a time; the highlight slams. */}
          <div
            style={{
              fontFamily: displayFontFamily,
              fontWeight: 900,
              fontSize: titlePx,
              lineHeight: 1.02,
              letterSpacing: "-0.04em",
              textTransform: "uppercase",
              color: text,
              display: "flex",
              flexWrap: "wrap",
              gap: `0 ${p ? 18 : 22}px`,
            }}
          >
            {words.map((w, i) => {
              const at = WORD_START + i * WORD_EVERY;
              const isHl = i === hlIndex;
              const rise = spring({
                frame: frame - at,
                fps,
                // The highlight gets the harder slam; the rest rise softly.
                config: isHl
                  ? { damping: 15, stiffness: 215, mass: 1.15 }
                  : { damping: 22, stiffness: 130, mass: 1 },
              });
              const o = interpolate(frame, [at, at + 8], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              // Sine kicker is the template's overshoot signature.
              const s = isHl ? 0.86 + rise * 0.14 + Math.sin(rise * Math.PI) * 0.06 : 1;
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    opacity: o,
                    color: isHl ? accent : text,
                    transform: `translateY(${interpolate(rise, [0, 1], [26, 0])}px) scale(${s})`,
                    transformOrigin: "left bottom",
                    textShadow: isHl ? `0 0 44px ${accent}66` : "none",
                  }}
                >
                  {w}
                </span>
              );
            })}
          </div>

          {/* Echo of the highlighted word, chasing outward. */}
          {words[hlIndex] ? (
            <TitleEcho
              text={words[hlIndex]}
              accentColor={accent}
              startFrame={hlLand}
              fontSize={titlePx}
            />
          ) : null}

          {narration ? (
            <div
              style={{
                marginTop: p ? 24 : 22,
                fontFamily: bodyFontFamily,
                fontWeight: 300,
                fontSize: narrationPx,
                lineHeight: 1.5,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: text,
                opacity: narrationOpacity * 0.8,
                maxWidth: p ? "100%" : "92%",
                overflowWrap: "anywhere",
              }}
            >
              {narration}
            </div>
          ) : null}
        </div>

        {/* ── Media plate ── */}
        {hasMedia ? (
          <div
            style={{
              width: p ? "100%" : "40%",
              aspectRatio: p ? "16 / 9" : "3 / 4",
              position: "relative",
              overflow: "hidden",
              flexShrink: 0,
              opacity: mediaOpacity,
              transform: `scale(${interpolate(mediaSpring, [0, 1], [0.92, 1])})`,
              // A single accent edge rather than a full border — one red mark only.
              borderLeft: `6px solid ${accent}`,
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

      <AccentBars accentColor={accent} position="bottom-left" count={3} startFrame={20} />
      <FlashPop count={3} every={26} seed={43} startFrame={hlLand + 2} />
      <FilmGrain intensity={0.9} />
    </AbsoluteFill>
  );
};
