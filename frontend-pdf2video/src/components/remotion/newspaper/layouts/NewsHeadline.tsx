import React from "react";
import { NewspaperClip, NEWSPRINT_FILTER } from "../components/NewspaperClip";
import { useFitText } from "../components/useFitText";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Img,
  staticFile,
} from "remotion";
import type { BlogLayoutProps } from "../types";

const H_FONT = "'Source Serif 4', Georgia, 'Times New Roman', serif";
const B_FONT = "'Source Sans 3', 'Helvetica Neue', Helvetica, Arial, sans-serif";

/* ───────────────────────────────────────── */
/* SHARDS                                   */
/* ───────────────────────────────────────── */

/* Six shards: two columns × three rows. The seams are cut off-square so the
   pieces read as torn newsprint, and adjacent shards share their seam vertices
   so the reassembled frame has no gaps.

   `ox`/`oy` are entry offsets expressed as MULTIPLES OF THE FRAME SIZE, not
   pixels — they're scaled by the real width/height at render time so the
   motion is identical in landscape and portrait.

   Each piece glides in along ONE axis from the edge it belongs to — the top
   row straight down, the middle row straight in from the sides, the bottom
   row straight up. Single-axis travel plus a small rotation keeps the six
   pieces moving as one coherent group instead of scattering. */
const SHARDS = [
  // Top row — straight down from above.
  { clip: "polygon(0% 0%, 52% 0%, 48% 34%, 0% 30%)", ox: -0.06, oy: -0.42, rot: -5 },
  { clip: "polygon(52% 0%, 100% 0%, 100% 30%, 48% 34%)", ox: 0.06, oy: -0.45, rot: 4.5 },

  // Middle row — straight in from the sides.
  { clip: "polygon(0% 30%, 48% 34%, 52% 68%, 0% 64%)", ox: -0.4, oy: 0, rot: -4 },
  { clip: "polygon(48% 34%, 100% 30%, 100% 64%, 52% 68%)", ox: 0.4, oy: 0, rot: 4 },

  // Bottom row — straight up from below.
  { clip: "polygon(0% 64%, 52% 68%, 46% 100%, 0% 100%)", ox: -0.06, oy: 0.45, rot: 4.5 },
  { clip: "polygon(52% 68%, 100% 64%, 100% 100%, 46% 100%)", ox: 0.06, oy: 0.42, rot: -5 },
];

const ASSEMBLE_DURATION = 55;
const DISPERSE_DURATION = 45;

/* Peak opacity once assembled — the shards are a background texture, so they
   sit well under the headline. */
const SHARD_OPACITY = 0.22;

/* ───────────────────────────────────────── */
/* SHATTER BACKGROUND                       */
/* ───────────────────────────────────────── */

const ShatterBackground: React.FC<{ bgColor: string }> = ({ bgColor }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const disperseStart = durationInFrames - DISPERSE_DURATION;
  const vintageUrl = staticFile("vintage-news.avif");

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div style={{ position: "absolute", inset: 0, background: bgColor }} />

      {SHARDS.map((shard, i) => {
        // Gentle stagger only — a wide spread makes the six pieces read as
        // unrelated objects rather than one sheet coming together.
        const stagger = i * 1.2;

        // Offsets are frame-relative, so every shard starts fully off-screen
        // in both aspect ratios.
        const offX = shard.ox * width;
        const offY = shard.oy * height;

        const assemble = interpolate(
          frame,
          [stagger, ASSEMBLE_DURATION + stagger],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

        const fall = interpolate(
          frame,
          [disperseStart + stagger, durationInFrames],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

        let tx: number;
        let ty: number;
        let rotate: number;
        let scale: number;
        let opacity: number;

        if (frame < disperseStart) {
          /* ── PHASE 1 — GLIDE IN AND COMBINE ──
             easeInOutSine: no hard kick at the start and no abrupt braking at
             the end, so the pieces drift into place. A cubic ease-out covers
             most of its distance in the first few frames, which is what made
             the entry feel scattered. */
          const eased = 0.5 - Math.cos(assemble * Math.PI) / 2;

          tx = offX * (1 - eased);
          ty = offY * (1 - eased);
          rotate = shard.rot * (1 - eased);
          scale = 1 + 0.03 * (1 - eased);
          // Fade in gradually across the whole glide rather than snapping to
          // full opacity early.
          opacity = SHARD_OPACITY * eased;
        } else {
          /* ── PHASE 2 — SINK AWAY ──
             A softened gravity curve. True t² acceleration flings the pieces
             apart in the last few frames; easing the fall in keeps them
             together as they sink out of frame. */
          const sink = Math.pow(fall, 1.7);

          tx = offX * fall * 0.06;
          ty = sink * height * 0.55;
          rotate = shard.rot * fall * 0.5;
          scale = 1 - 0.03 * fall;
          // Fade steadily so the pieces are nearly gone by the time they'd
          // otherwise separate visibly.
          opacity = SHARD_OPACITY * (1 - fall);
        }

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              clipPath: shard.clip,
              backgroundImage: `url("${vintageUrl}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              transform: `translate(${tx}px, ${ty}px) rotate(${rotate}deg) scale(${scale})`,
              opacity,
              willChange: "transform, opacity",
            }}
          />
        );
      })}
    </div>
  );
};

/* ───────────────────────────────────────── */
/* MAIN COMPONENT                           */
/* ───────────────────────────────────────── */
export const NewsHeadline: React.FC<
  BlogLayoutProps & {
    imageUrl?: string;
    highlightWords?: string[];
    leftThought?: string;
  }
> = ({
  title = "Breaking News Headline Goes Here",
  highlightWords,
  narration,
  accentColor = "#FFE34D",
  bgColor = "#FAFAF8",
  textColor = "#111111",
  aspectRatio = "landscape",
  titleFontSize,
  descriptionFontSize,
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
  stats,
  category,
  imageUrl,
  imageObjectPosition,
  imageZoom,
  videoUrl,
  videoMuted,
  videoVolume,
  videoDurationInFrames,
  videoStartInFrames,
  leftThought,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width: videoWidth, height: videoHeight } = useVideoConfig();
  const p = aspectRatio === "portrait";

  /* 🎬 Unified Fade In / Fade Out */
  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  const fadeOut = interpolate(
    frame,
    [durationInFrames - 25, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" }
  );

  const contentOpacity = fadeIn * fadeOut;
  const cat = category ?? stats?.[0]?.label ?? "News";

  // Derive highlight words from explicit leftThought when provided.
  const leftThoughtFromProps = leftThought && leftThought.trim().length > 0 ? leftThought : undefined;

  const words = title.split(" ");
  const highlights =
    highlightWords && highlightWords.length
      ? highlightWords
      : leftThoughtFromProps
        ? leftThoughtFromProps.split(/[,\u2013\u2014\-]/).join(" ").split(/\s+/).filter(Boolean)
        : [words[0], words[Math.floor(words.length / 2)], words[words.length - 1]];

  // Calculate description font size for relative scaling
  const actualDescriptionFontSize = descriptionFontSize ?? (p ? 35 : 28);
  const categoryBaseFontSize = p ? 28 : 24; // Base for category without descriptionFontSize
  const authorBaseFontSize = p ? 20 : 16; // Base for author without descriptionFontSize
  // A clip fills the same visual slot as a still, so it must not
  // trigger the no-image layout.
  const hasVisual = Boolean(imageUrl || videoUrl);
  const portraitNoImage = p && !hasVisual;

  /* ── Auto-fit ──────────────────────────────────────────────
     Narration length is unbounded, so long copy would overflow the layout and
     get clipped by the AbsoluteFill's overflow:hidden. Measure the real
     leftover height and shrink to fit.

     A size the user explicitly picked on the slider is honored exactly (even
     if it overflows); only a size that came from meta.json defaults auto-fits.
     Passing minPx === targetPx makes the hook a no-op while still calling it
     unconditionally, as the Rules of Hooks require. */
  const narrationRef = React.useRef<HTMLDivElement>(null);
  const titleRef = React.useRef<HTMLDivElement>(null);

  const actualTitleFontSize = titleFontSize ?? (p ? 77 : 68);

  /* Stage 1 — the headline fits its own share of the column.
     The title is `flex-shrink:0`, so its clientHeight always equals its content
     height; measuring it against itself could never detect overflow. Give it an
     explicit budget instead: a capped fraction of the container, leaving room
     for the category block and the narration below it. A title that already
     fits inside its share is left completely alone. */
  const titleBudgetPx = React.useMemo(() => {
    // Container height minus its vertical padding (percentages of the frame).
    const padFrac = portraitNoImage ? 0.12 + 0.1 : p ? 0.15 : 0.14;
    const inner = videoHeight * (1 - padFrac);
    // The headline may claim at most this much of the usable column; the rest
    // is reserved for the category chip, byline and narration.
    return Math.max(1, inner * (portraitNoImage ? 0.42 : p ? 0.5 : 0.55));
  }, [videoHeight, p, portraitNoImage]);

  /* Stage 3 (fed back below) — when the narration bottoms out at its floor and
     STILL overflows, the headline has to give up more room than its own share.
     Tighten the title's budget by exactly the height the narration is short by. */
  const [titleGiveBackPx, setTitleGiveBackPx] = React.useState(0);

  // Drop any accumulated give-back when the copy or geometry changes, so a
  // previous scene's squeeze never carries over into a fresh measurement.
  React.useLayoutEffect(() => {
    setTitleGiveBackPx(0);
  }, [title, narration, actualTitleFontSize, actualDescriptionFontSize, titleBudgetPx, p, portraitNoImage, hasVisual]);

  const { px: titlePx } = useFitText(
    titleRef,
    actualTitleFontSize,
    titleFontSizeIsUserSet ? actualTitleFontSize : p ? 34 : 30,
    [title, actualTitleFontSize, titleFontSizeIsUserSet, titleBudgetPx, titleGiveBackPx, p],
    Math.max(1, titleBudgetPx - titleGiveBackPx),
  );

  /* Stage 2 — the narration fits whatever the (now-sized) headline leaves.
     Keyed on titlePx so it re-measures after the headline settles. */
  const { px: narrationPx, overflowPx: narrationOverflowPx } = useFitText(
    narrationRef,
    actualDescriptionFontSize,
    descriptionFontSizeIsUserSet ? actualDescriptionFontSize : p ? 18 : 14,
    [narration, actualDescriptionFontSize, descriptionFontSizeIsUserSet, titlePx, p, portraitNoImage, hasVisual],
  );

  /* Feed the narration's residual overflow back into the title budget, once.
     Guarded by `> 0` and by only ever increasing, so this settles instead of
     oscillating: each pass either frees enough room or stops at the title floor
     (at which point the narration simply clips, as designed). */
  React.useLayoutEffect(() => {
    if (titleFontSizeIsUserSet) return;
    if (narrationOverflowPx > 0) {
      setTitleGiveBackPx((prev) => prev + narrationOverflowPx);
    }
  }, [narrationOverflowPx, titleFontSizeIsUserSet]);

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: fontFamily ?? B_FONT }}>
      <ShatterBackground bgColor={bgColor} />
      
      {/* Background Overlays */}
      <img
        src={staticFile("vintage-news.avif")}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "50% 50%",
          opacity: 0.12,
          filter: "grayscale(75%) contrast(1.08)",
          zIndex: 1,
        }}
      />

      {/* Tilted Newspaper Cutout Image Card */}
      {hasVisual && (
        <div
          style={{
            position: "absolute",
            // Portrait: Center Top | Landscape: Right Side
            top: p ? "15%" : "18%",
            right: p ? "auto" : "4%",
            left: p ? "50%" : "auto",
            width: p ? "80%" : "40%",
            height: p ? "35%" : "50%",
            // ✅ physical styling: white paper background and padding
            background: "#fff",
            padding: "10px 10px 30px 10px", // extra bottom padding for 'pasted' look

            transform: p
              ? "translateX(-50%) rotate(-4deg)"
              : "rotate(-8deg)",
            opacity: contentOpacity,
            zIndex: 5,
            
            // ✅ Shadow: softer, more spread out, like paper lifted off the page
            boxShadow: "5px 10px 30px rgba(0,0,0,0.15)",

            // Straight vertical sides; slight top/bottom skew kept for a subtle pasted look
            clipPath: "polygon(0% 1%, 98% 0%, 100% 99%, 2% 100%)",
          }}
        >
          <div style={{ width: "100%", height: "100%", overflow: "hidden", border: "1px solid #ddd" }}>
            {/* Newsprint treatment is shared by the still and the clip so a
                video doesn't look pasted onto the vintage paper. */}
            {videoUrl ? (
              <NewspaperClip
                src={videoUrl}
                imageObjectPosition={imageObjectPosition}
                imageZoom={imageZoom}
                muted={videoMuted ?? true}
                volume={videoVolume ?? 0.35}
                durationInFrames={videoDurationInFrames}
                startInFrames={videoStartInFrames}
                style={{ filter: NEWSPRINT_FILTER(frame) }}
              />
            ) : imageUrl ? (
              <Img
                src={imageUrl}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: (imageZoom ?? 1) < 1 ? "contain" : "cover",
                  objectPosition: (imageZoom ?? 1) < 1 ? "center" : (imageObjectPosition ?? "50% 50%"),
                  transform: `scale(${imageZoom ?? 1})`,
                  transformOrigin: (imageZoom ?? 1) < 1 ? "center center" : (imageObjectPosition ?? "50% 50%"),
                  display: "block",
                  filter: NEWSPRINT_FILTER(frame),
                }}
              />
            ) : null}
          </div>
          {/* Subtle Halftone Overlay for maximum realism */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(#000 1px, transparent 0)',
            backgroundSize: '3px 3px',
            opacity: 0.03,
            pointerEvents: 'none'
          }} />
        </div>
      )}

      {/* CONTENT CONTAINER */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: portraitNoImage ? "flex-start" : p ? "flex-end" : "center",
          padding: portraitNoImage ? "12% 10% 10% 10%" : p ? "0 10% 15% 10%" : "7% 10%",
          zIndex: 10,
          opacity: contentOpacity,
          // Let the narration shrink into the leftover space instead of
          // pushing past the scene and being clipped.
          minHeight: 0,
        }}
      >
        {/* CATEGORY + AUTHOR (from stats) */}
        <div
          style={{
            marginBottom: portraitNoImage ? 24 : p ? 20 : 30,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "inline-block",
              fontSize: descriptionFontSize 
                ? actualDescriptionFontSize * (p ? (categoryBaseFontSize / 40) : (categoryBaseFontSize / 40))
                : categoryBaseFontSize,
              fontWeight: 800,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: textColor,
              borderBottom: `${4}px solid ${textColor}`,
              paddingBottom: 6,
              alignSelf: "flex-start",
            }}
          >
            {cat}
          </div>
          {Array.isArray(stats) && stats.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 12,
                fontFamily: fontFamily ?? B_FONT,
                fontSize: descriptionFontSize 
                  ? actualDescriptionFontSize * (p ? (authorBaseFontSize / 40) : (authorBaseFontSize / 38))
                  : authorBaseFontSize,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#555",
              }}
            >
              {stats.map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontWeight: 700 }}>{s.value}</span>
                  {s.label && <span style={{ opacity: 0.8 }}>{s.label}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* TITLE */}
        <div
          ref={titleRef}
          style={{
            fontFamily: fontFamily ?? H_FONT,
            // Drastically increased portrait size for mobile impact
            fontSize: titlePx,
            fontWeight: 800,
            lineHeight: 1.0,
            marginBottom: portraitNoImage ? 0 : p ? 40 : 36,
            maxWidth: p ? "100%" : (imageUrl ? "50%" : "60%"),
            flexShrink: 0,
          }}
        >
          {words.map((word, i) => {
            const cleanWord = word.replace(/[.,!?]/g, "");
            const isHighlight = highlights.some(
              (hl) => hl.toLowerCase() === cleanWord.toLowerCase()
            );

            return (
              <span key={i} style={{ position: "relative", display: "inline-block", marginRight: `${12}px` }}>
                {isHighlight && (
                  <span
                    style={{
                      position: "absolute",
                      left: "-2%",
                      right: "-2%",
                      bottom: "10%",
                      height: "60%",
                      backgroundColor: accentColor,
                      opacity: 0.4,
                      borderRadius: 2,
                      zIndex: -1,
                    }}
                  />
                )}
                <span style={{ position: "relative", zIndex: 1 }}>{word}</span>
              </span>
            );
          })}
        </div>

        {/* NARRATION */}
        {narration && (
          <div
            style={
              portraitNoImage
                ? {
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 0,
                    paddingTop: 24,
                    paddingBottom: 24,
                  }
                : // `flex-shrink:1` + `min-height:0` lets this shrink BELOW its
                  // content height once the column overflows, which is what
                  // gives the fitter a real band to measure. It never grows, so
                  // short narration stays exactly where it sits today and the
                  // parent's justifyContent semantics are untouched.
                  { flex: "0 1 auto", minHeight: 0, overflow: "hidden", display: "flex" }
            }
          >
            <div
              ref={narrationRef}
              style={{
                fontSize: narrationPx,
                fontWeight: 600,
                color: textColor,
                lineHeight: 1.4,
                maxWidth: p ? "100%" : (imageUrl ? "50%" : "70%"),
                opacity: 0.9,
                textAlign: portraitNoImage ? "center" : undefined,
                // Read the band, not the copy: without these the measured
                // clientHeight would just be the text's own height.
                height: "100%",
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              {narration}
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
