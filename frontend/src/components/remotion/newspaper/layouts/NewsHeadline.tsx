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
  const actualDescriptionFontSize = descriptionFontSize ?? (p ? 37 : 28);
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
  const categoryRef = React.useRef<HTMLDivElement>(null);

  const actualTitleFontSize = titleFontSize ?? (p ? 68 : 62);

  /* Stage 1 — the headline fits its own share of the column.
     The title is `flex-shrink:0`, so its clientHeight always equals its content
     height; measuring it against itself could never detect overflow. Give it an
     explicit budget instead: a capped fraction of the container, leaving room
     for the category block and the narration below it. A title that already
     fits inside its share is left completely alone. */
  const titleBudgetPx = React.useMemo(() => {
    // Container height minus its vertical padding (percentages of the frame).
    // Portrait-with-image: 12% top pad + the picture's MINIMUM 25.5% band, so
    // ~62.5% of the frame is available to copy. The original 0.15 overstated
    // the column by ~493px on a 1280-tall frame, which is what let the auto-fit
    // grow the headline straight down into the photo.
    const padFrac = portraitNoImage ? 0.12 + 0.1 : p ? 0.375 : 0.14;
    const inner = videoHeight * (1 - padFrac);
    // The headline may claim at most this much of the usable column; the rest
    // is reserved for the category chip, byline and narration.
    return Math.max(1, inner * (portraitNoImage ? 0.42 : p ? 0.5 : 0.55));
  }, [videoHeight, p, portraitNoImage]);

  const { px: titlePx } = useFitText(
    titleRef,
    actualTitleFontSize,
    titleFontSizeIsUserSet ? actualTitleFontSize : p ? 34 : 30,
    [title, actualTitleFontSize, titleFontSizeIsUserSet, titleBudgetPx, p],
    titleBudgetPx,
  );

  /* Stage 2 — the narration fits whatever the (now-sized) headline leaves.
     Keyed on titlePx so it re-measures after the headline settles. No
     give-back from narration back into the title budget: a
     useLayoutEffect+setState chain reacting to another useFitText's overflow
     output creates a multi-render convergence that Remotion's per-frame
     headless capture can settle at different points on different frames
     (confirmed via a real render — frame-to-frame scene-change score hit
     1.0, i.e. maximum, twice in the first ten frames, in this scene).

     The narration wrapper is `flex:"0 1 auto"` inside a `justifyContent`
     center/flex-end column, so its own clientHeight (and even
     useAvailableHeight's offsetTop-based measurement of the wrapper) is NOT
     the real leftover space: centering positions the whole stack (category +
     title + narration) using narration's OWN current height, so measuring
     "where narration starts" is circular — it reflects the stack's current
     (possibly still-overflowing) layout, not the space left if narration
     were sized correctly. Confirmed via a real render: with a long title +
     long narration, this measured budget came out at 75px on a 720px-tall
     frame, when the true leftover was ~200px+.

     Compute the budget arithmetically instead, the same way titleBudgetPx
     is: container inner height minus the category block's and title's own
     (trustworthy, because both are flexShrink:0) rendered heights. Neither
     of those is affected by centering. */
  const [categoryH, setCategoryH] = React.useState(0);
  const [titleH, setTitleH] = React.useState(0);
  /* The narration's REAL rendered height, not its budget. Needed because a
     user-set font size makes useFitText a no-op (minPx === targetPx), so the
     copy keeps its chosen size and simply occupies more room — the case where
     the picture has to give way instead of the text being clipped. */
  const [narrationH, setNarrationH] = React.useState(0);
  React.useLayoutEffect(() => {
    setCategoryH(categoryRef.current?.offsetHeight ?? 0);
    setTitleH(titleRef.current?.offsetHeight ?? 0);
    setNarrationH(narrationRef.current?.offsetHeight ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titlePx, cat, stats, title, narration, actualDescriptionFontSize, descriptionFontSizeIsUserSet, videoHeight]);

  const narrationBudgetPx = React.useMemo(() => {
    if (portraitNoImage) return undefined; // that variant's own clientHeight IS the true budget (single flex:1 child).
    // Mirrors titleBudgetPx: the picture's minimum band is not available to copy.
    const padFrac = p ? 0.375 : 0.14;
    const inner = videoHeight * (1 - padFrac);
    const categoryMargin = p ? 20 : 30;
    const titleMargin = p ? 40 : 36;
    const used = categoryH + categoryMargin + titleH + titleMargin;
    // Leave ~90% of the true remainder as breathing room rather than fitting
    // to the exact last pixel.
    return Math.max(1, (inner - used) * 0.92);
  }, [videoHeight, p, portraitNoImage, categoryH, titleH]);

  /* ── Portrait picture band ────────────────────────────────────────────────
     The card's height is derived, not fixed. The copy is laid out first and the
     picture takes whatever is left below it, so when the text grows — a long
     headline, a long narration, or a user-set font size that useFitText is not
     allowed to shrink — the IMAGE COMPRESSES instead of the copy being clipped
     or running underneath the card.

     Clamped at both ends: never taller than 42% (so the picture stays a
     picture and not the whole page), never shorter than 16% (so heavy copy
     leaves a photo that is still recognisable rather than a sliver). */
  const PORTRAIT_CARD_MAX_FRAC = 0.42;
  const PORTRAIT_CARD_MIN_FRAC = 0.16;
  const PORTRAIT_CARD_BOTTOM_FRAC = 0.06;
  const portraitCardHeightFrac = React.useMemo(() => {
    if (!p || !hasVisual) return PORTRAIT_CARD_MAX_FRAC;
    const topPad = 0.12 * videoHeight;
    const categoryMargin = 20;
    const titleMargin = 40;
    const gap = 0.035 * videoHeight;
    // Where the copy actually ends, measured rather than assumed.
    const textBottom =
      topPad + categoryH + categoryMargin + titleH + titleMargin + narrationH;
    const leftover =
      videoHeight - textBottom - gap - PORTRAIT_CARD_BOTTOM_FRAC * videoHeight;
    const frac = leftover / videoHeight;
    return Math.min(PORTRAIT_CARD_MAX_FRAC, Math.max(PORTRAIT_CARD_MIN_FRAC, frac));
  }, [p, hasVisual, videoHeight, categoryH, titleH, narrationH]);


  const { px: narrationPx } = useFitText(
    narrationRef,
    actualDescriptionFontSize,
    descriptionFontSizeIsUserSet ? actualDescriptionFontSize : p ? 18 : 14,
    [narration, actualDescriptionFontSize, descriptionFontSizeIsUserSet, titlePx, p, portraitNoImage, hasVisual, narrationBudgetPx],
    narrationBudgetPx,
  );

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
            // Portrait: pinned to the BOTTOM of the page, with the copy stacked
            // above it. It used to sit at top:15% height:35% while the content
            // container ran the full frame with justifyContent:"flex-end" — so
            // any stack taller than ~448px grew up through the card and the
            // headline painted straight over the photo (content is zIndex 10,
            // card is 5). Reserving the lower band for the picture and ending
            // the copy above it removes the collision by construction rather
            // than relying on the text happening to be short enough.
            // Landscape is unchanged: Right Side.
            top: p ? "auto" : "18%",
            bottom: p ? "6%" : "auto",
            right: p ? "auto" : "4%",
            left: p ? "50%" : "auto",
            width: p ? "80%" : "40%",
            height: p ? `${portraitCardHeightFrac * 100}%` : "50%",
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
          // Portrait-with-image anchors to the TOP: the copy starts below the
          // masthead area and grows downward into its reserved band, while the
          // picture owns the bottom. With "flex-end" the stack hugged its floor
          // instead, so any extra height pushed UP — and, once the floor was
          // raised, the last narration line still crossed the card's top edge.
          // No picture: the copy is the only content, so centre the whole stack
          // and let it grow symmetrically up and down from the middle.
          justifyContent: portraitNoImage ? "center" : p ? "flex-start" : "center",
          // Portrait-with-image: the copy's floor corresponds to the card at its
          // MINIMUM height (16% + 6% bottom + 3.5% gap = 25.5%), not its maximum.
          // The card compresses toward that floor as the copy grows, so
          // reserving the full 34% band here would clip text that the picture
          // was willing to make room for.
          padding: portraitNoImage
            ? "12% 10% 10% 10%"
            : p
              ? "12% 10% 25.5% 10%"
              : "7% 10%",
          zIndex: 10,
          opacity: contentOpacity,
          // Let the narration shrink into the leftover space instead of
          // pushing past the scene and being clipped.
          minHeight: 0,
        }}
      >
        {/* CATEGORY + AUTHOR (from stats) */}
        <div
          ref={categoryRef}
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
            marginBottom: portraitNoImage ? 28 : p ? 40 : 36,
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
                    // Content-sized, NOT flex:1 — stretching this to fill the
                    // column is what pinned the title to the top and left the
                    // body marooned near the bottom.
                    flex: "0 1 auto",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    minHeight: 0,
                    paddingTop: 24,
                    paddingBottom: 24,
                  }
                : // Fixed `height: narrationBudgetPx` (not `flex:"0 1 auto"` +
                  // clientHeight self-measurement): inside a `justifyContent:
                  // "center"` column, flex-shrink distributes space by each
                  // child's OWN flex-basis/content height, not by "what's left
                  // after fixed siblings" — so a flex-shrunk wrapper's real
                  // clientHeight routinely came out smaller than the budget
                  // useFitText was told to fit into (confirmed via a real
                  // render: budget=141 but the flex-computed box only got
                  // clientHeight=75, so text measured as "fits in 141" was
                  // still clipped by ~60px). An explicit height dictated by our
                  // own arithmetic (narrationBudgetPx, computed from the
                  // category/title's real measured heights) sidesteps flexbox's
                  // shrink algorithm entirely — the box IS the budget, no
                  // second system disagreeing about it.
                  {
                      flexShrink: 0,
                      // maxHeight, NOT height: a fixed height made this block
                      // occupy the whole budget even for one short line, so the
                      // text stack ended at ~71% of the frame in every case and
                      // the picture below it always clamped to its floor. The
                      // cap still preserves what the fixed height was for —
                      // the box can never exceed the budget useFitText fitted
                      // the copy into — but short copy now takes only the room
                      // it needs, and the picture gets the rest.
                      maxHeight: narrationBudgetPx,
                      overflow: "hidden",
                      display: "flex",
                    }
            }
          >
            <div
              ref={narrationRef}
              style={{
                fontSize: narrationPx,
                fontWeight: 600,
                color: textColor,
                lineHeight: 1.4,
                // Explicit `width` (not just maxWidth) pins this flex item to
                // the same column width on every measurement pass, matching
                // the wrapper's now-fixed `height` below.
                width: p ? "100%" : (imageUrl ? "50%" : "70%"),
                maxWidth: p ? "100%" : (imageUrl ? "50%" : "70%"),
                opacity: 0.9,
                // Left-aligned like the category and headline above it, so the
                // whole block reads as one column rather than a centred caption.
                textAlign: undefined,
                // Content-sized now that the wrapper is capped rather than
                // fixed; height:100% here would re-inflate it to the full budget
                // and reintroduce the always-at-the-floor picture.
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
