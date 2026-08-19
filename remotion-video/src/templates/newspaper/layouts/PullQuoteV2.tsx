import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
} from "remotion";
import { NewsBackground, NewsPaperWash } from "../NewsBackground";
import type { BlogLayoutProps } from "../types";

const H_FONT = "'Source Serif 4', Georgia, 'Times New Roman', serif";
const B_FONT = "'Source Sans 3', 'Helvetica Neue', Helvetica, Arial, sans-serif";

/**
 * pull_quote__v2 — "Torn Page".
 *
 * Same props and prop meanings as PullQuote (title = the quote, narration =
 * attribution, stats[0].label = source). The quote sits on a torn scrap of
 * newsprint pinned at a slight angle over the page.
 *
 * pull_quote is in the template's `layouts_without_image` set, so — like the
 * base layout — this variant renders no image or clip.
 */
export const PullQuoteV2: React.FC<BlogLayoutProps> = ({
  title = "This is not a political game. Real people will feel real consequences starting tomorrow.",
  narration = "— Senate Majority Leader",
  accentColor = "#FFE34D",
  bgColor = "#FAFAF8",
  textColor = "#111111",
  aspectRatio = "landscape",
  titleFontSize,
  descriptionFontSize,
  stats,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = aspectRatio === "portrait";
  const source = stats?.[0]?.label ?? "";

  // The scrap drops in, settles, then lifts away — symmetric in/out.
  const dropIn = interpolate(frame, [0, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const easedIn = 1 - Math.pow(1 - dropIn, 3);
  const lift = interpolate(
    frame,
    [durationInFrames - 24, durationInFrames],
    [0, 1],
    { extrapolateLeft: "clamp" },
  );

  const scrapY = (1 - easedIn) * -60 + lift * 70;
  const scrapRot = -2.5 + (1 - easedIn) * -4 + lift * 3;
  const scrapScale = 0.94 + 0.06 * easedIn - lift * 0.05;
  const scrapOp = easedIn * (1 - lift);

  // Typed out character by character, like copy coming off a typewriter, with a
  // caret that blinks while typing and holds solid once the line is finished.
  // Fast: roughly 4 characters a frame, capped so a short quote still takes a
  // beat and a long one never outruns the scene.
  const typeFrames = Math.min(46, Math.max(14, Math.ceil(title.length / 4)));
  const typeProgress = interpolate(frame, [12, 12 + typeFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const visChars = Math.floor(title.length * typeProgress);
  const typedText = title.slice(0, visChars);
  const stillTyping = visChars < title.length;
  const caretOn = stillTyping ? Math.floor(frame / 6) % 2 === 0 : true;

  // The scrap is a FIXED size, so long quotes step the type down to stay inside
  // the torn edge rather than the sheet growing to fit them.
  const baseQuoteSize = titleFontSize ?? (p ? 79 : 71);
  const quoteLen = title.length;
  const lengthScale =
    quoteLen > 190 ? 0.42 : quoteLen > 140 ? 0.5 : quoteLen > 95 ? 0.6 : quoteLen > 60 ? 0.72 : 0.92;
  const quoteFontSize = Math.round(baseQuoteSize * lengthScale);

  const markOp = interpolate(frame, [10, 26], [0, 1], { extrapolateRight: "clamp" });
  // Follows the typing rather than sitting on a fixed frame, so a short quote
  // doesn't finish and then wait for its attribution.
  const attrStart = 12 + typeFrames + 4;
  const attrOp = interpolate(frame, [attrStart, attrStart + 14], [0, 1], {
    extrapolateRight: "clamp",
  });

  // A rough, fibrous rip rather than a cut edge.
  //
  // A polygon can only draw straight lines between its points, so a handful of
  // widely spaced points always reads as sharp teeth (pinking shears). The fix
  // is MANY closely spaced points with small, uneven jitter: each step is tiny,
  // so no single spike dominates and the eye reads a ragged fibrous edge. A
  // deterministic hash keeps the shape identical on every render.
  const TORN_CLIP = React.useMemo(() => {
    // Cheap deterministic pseudo-random in [0,1) — stable across renders.
    const rnd = (n: number) => {
      const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
      return x - Math.floor(x);
    };
    // Two octaves: a slow wander sets where the tear runs, a fast one roughens
    // it. Depth stays shallow (~1–3%) because roughness, not depth, reads as torn.
    const depth = (i: number, seed: number) =>
      0.9 + rnd(i * 0.7 + seed) * 1.5 + rnd(i * 3.3 + seed) * 1.1;

    const STEPS = 46; // dense enough that each segment is a short, soft step
    const pts: string[] = [];
    const push = (x: number, y: number) =>
      pts.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`);

    for (let i = 0; i <= STEPS; i++) {
      const t = (i / STEPS) * 100;
      push(t, depth(i, 11));            // top: left → right
    }
    for (let i = 0; i <= STEPS; i++) {
      const t = (i / STEPS) * 100;
      push(100 - depth(i, 29), t);      // right: top → bottom
    }
    for (let i = 0; i <= STEPS; i++) {
      const t = (i / STEPS) * 100;
      push(100 - t, 100 - depth(i, 53)); // bottom: right → left
    }
    for (let i = 0; i <= STEPS; i++) {
      const t = (i / STEPS) * 100;
      push(depth(i, 71), 100 - t);      // left: bottom → top
    }
    return `polygon(${pts.join(", ")})`;
  }, []);

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        fontFamily: fontFamily ?? B_FONT,
        backgroundColor: bgColor,
      }}
    >
      <NewsBackground bgColor={bgColor} />
      <img
        src={staticFile("vintage-news.avif")}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.22,
          filter: "grayscale(80%) contrast(1.1)",
          zIndex: 1,
        }}
      />
      <div
        style={{ position: "absolute", inset: 0, backgroundColor: bgColor, opacity: 0.35, zIndex: 2 }}
      />
      {/* Warm paper cast, above both the grayscale texture and the bgColor
          wash — without it this scene reads cold against the other layouts. */}
      <NewsPaperWash zIndex={3} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "8% 6%" : "6% 9%",
          zIndex: 5,
          // drop-shadow follows the torn clipPath; box-shadow would be clipped
          // away with it, leaving the sheet flat on the page.
          filter: "drop-shadow(0 24px 44px rgba(0,0,0,0.26))",
        }}
      >
        {/* THE SCRAP — fixed size: the sheet is the same torn piece of paper in
            every scene, and the type steps down to fit it (see lengthScale)
            rather than the sheet growing or shrinking around the quote. */}
        <div
          style={{
            position: "relative",
            width: p ? "100%" : "84%",
            height: p ? "72%" : "78%",
            flexShrink: 0,
            background: "#fdfcf7",
            padding: p ? "9% 8%" : "5.5% 6%",
            clipPath: TORN_CLIP,
            opacity: scrapOp,
            transform: `translateY(${scrapY}px) rotate(${scrapRot}deg) scale(${scrapScale})`,
            // clipPath cuts a box-shadow away, so the lift comes from a
            // drop-shadow filter on the wrapper instead.
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          {/* Newsprint texture on the scrap itself */}
          <img
            src={staticFile("vintage-news.avif")}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.14,
              filter: "grayscale(100%) contrast(1.1)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: "radial-gradient(#000 1px, transparent 0)",
              backgroundSize: "3px 3px",
              opacity: 0.035,
              pointerEvents: "none",
            }}
          />

          <div style={{ position: "relative", zIndex: 1 }}>
            {/* QUOTE MARK */}
            <div
              style={{
                fontFamily: fontFamily ?? H_FONT,
                fontSize: p ? 120 : 104,
                lineHeight: 0.45,
                color: accentColor,
                opacity: markOp,
                marginBottom: p ? 26 : 22,
              }}
            >
              &#8220;
            </div>

            {/* QUOTE */}
            <div
              style={{
                fontFamily: fontFamily ?? H_FONT,
                fontSize: quoteFontSize,
                fontWeight: 600,
                lineHeight: 1.24,
                color: textColor,
                letterSpacing: p ? "-0.02em" : "normal",
              }}
            >
              {typedText}
              {/* Caret: blinks while typing, solid once the quote is complete */}
              <span
                style={{
                  display: "inline-block",
                  width: p ? 5 : 4,
                  height: "0.78em",
                  background: textColor,
                  opacity: caretOn ? 0.75 : 0,
                  marginLeft: 5,
                  verticalAlign: "baseline",
                }}
              />
            </div>

            {/* ATTRIBUTION */}
            <div style={{ opacity: attrOp, marginTop: p ? 34 : 30 }}>
              <div
                style={{
                  width: p ? 100 : 120,
                  height: 4,
                  background: accentColor,
                  marginBottom: 16,
                }}
              />
              <div
                style={{
                  fontFamily: fontFamily ?? B_FONT,
                  fontSize: descriptionFontSize ?? (p ? 27 : 23),
                  fontWeight: 800,
                  color: textColor,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 6,
                }}
              >
                {narration}
              </div>
              {source && (
                <div
                  style={{
                    fontFamily: fontFamily ?? B_FONT,
                    fontSize: 18,
                    fontWeight: 600,
                    color: textColor,
                    opacity: 0.65,
                  }}
                >
                  {source}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
