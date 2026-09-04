import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  DOCREEL_DISPLAY_FONT,
  DOCREEL_MONO_FONT,
  DocReelScene,
  ArchiveImageBackdrop,
  FilmstripThreeCell,
  hexToRgba,
  useTypewriterReveal,
  DEFAULT_DOCREEL_ERA,
  useDocReelTheme,
} from "../docReelStyle";
import { useFitText } from "../components/useFitText";

/** Interview insert: a photo/clip with a lower-third quote card, like a documentary talking-head cutaway. */
export const DocreelInterview: React.FC<SceneLayoutProps> = (props) => {
  const theme = useDocReelTheme();
  const {
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
    bgColor,
    accentColor,
    aspectRatio,
    sceneDurationInFrames,
    titleFontSize,
    titleFontSizeIsUserSet,
    descriptionFontSize,
    descriptionFontSizeIsUserSet,
    era,
    interviewQuote,
    interviewSubject,
    interviewRole,
  } = props;

  const p = aspectRatio === "portrait";
  const frame = useCurrentFrame();
  const { width, height: frameHeight } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 130;
  const activeEra = era ?? DEFAULT_DOCREEL_ERA;

  // Fall back to the universal narration/title when the interview-specific
  // fields weren't populated, so the lower-third card never renders empty.
  const displayQuote = interviewQuote || narration || "";
  const displaySubject = interviewSubject || title || "";
  const { visibleText: visibleQuote, cursor: quoteCursor } = useTypewriterReveal(displayQuote, 34, dur);

  // Portrait stacks the filmstrip's 3 cells in a COLUMN (FilmstripThreeCell,
  // flexDirection:"column"), so the quote card actually lives inside a middle
  // cell far shorter than the full frame — not the full frameHeight the budgets
  // below used to assume. Landscape lays the cells in a ROW instead, so its
  // middle cell already spans ~the full frame height and needs no correction.
  // Replicated here (not imported) because FilmstripThreeCell computes it from
  // internal layout state it doesn't expose; the inset/portrait args passed to
  // it below (22, p) must stay in sync with this math.
  const filmstripInset = p ? 22 : 30;
  const filmstripOuterH = frameHeight - filmstripInset * 2;
  const filmstripOuterW = width - filmstripInset * 2;
  const filmstripRailW = Math.max(16, (p ? filmstripOuterW : filmstripOuterH) * 0.05);
  const filmstripDividerW = Math.max(24, (p ? filmstripOuterH : filmstripOuterW) * 0.05);
  const middleCellHeightPx = p
    ? (filmstripOuterH - filmstripRailW * 2 - filmstripDividerW * 2) * (3.2 / 5.2)
    : filmstripOuterH - filmstripRailW * 2;

  // The pull-quote types out, so a hidden full-text mirror carries the ref —
  // measuring the growing visible copy would resize it mid-scene. The lower
  // third is anchored to the bottom of the frame, so the quote is budgeted
  // against a share of the cell it actually renders in, not raw frame height.
  const quoteTargetPx = titleFontSize ?? (p ? 64 : 48);
  const attribTargetPx = descriptionFontSize ?? (p ? 32 : 25);
  // Frame-relative budget (newspaper pattern), not a font-size multiple.
  const quoteBudgetPx = Math.round(middleCellHeightPx * (p ? 0.26 : 0.22));
  const quoteMirrorRef = React.useRef<HTMLDivElement>(null);
  const { px: fittedQuotePx } = useFitText(
    quoteMirrorRef,
    quoteTargetPx,
    titleFontSizeIsUserSet ? quoteTargetPx : p ? 30 : 22,
    [displayQuote, quoteTargetPx, titleFontSizeIsUserSet, quoteBudgetPx, p, aspectRatio],
    quoteBudgetPx,
  );
  // Both orientations go through the fitter. Portrait used to bypass it
  // entirely (`p ? quoteTargetPx : fittedQuotePx`) as a point-fix for the
  // slider appearing inert — with a frame-relative budget that workaround is
  // unnecessary, and it had cost portrait its overflow protection.
  const quotePx = fittedQuotePx;

  // ── Scale the whole card down if it still doesn't fit ──────────────────────
  //
  // Same failure as DocreelSlate: useFitText guarantees the quote fits ITS OWN
  // budget, not that the whole card fits the frame. Once the quote bottoms out
  // at its floor it grows without limit, and because this card is anchored to
  // the BOTTOM (`bottom:16%` landscape) it grows UPWARD — so the excess runs
  // straight off the top of the frame, taking the opening quote mark with it
  // and cutting the first line mid-word.
  //
  // Fix it the way the slate does: measure what the card actually needs and
  // scale quote-mark + quote + attribution together, preserving proportions.
  // A `transform` is deliberate — composited, no re-layout, so it cannot feed
  // back into useFitText and start the multi-render convergence that Remotion's
  // per-frame capture settles inconsistently (see the give-back warning in
  // newspaper/layouts/NewsHeadline.tsx).
  //
  // Landscape anchors the card to the frame BOTTOM and grows upward, so its
  // budget is "space above the card before it reaches the top of the frame".
  // Portrait instead CENTERS the card inside the (much shorter) middle
  // filmstrip cell — it grows both up and down from that centre, clipped by
  // the cell's own overflow:hidden, not by the frame edge. Budgeting portrait
  // off frameHeight (as this used to) hugely overstated the room available —
  // the middle cell is only ~50% of the strip's inner height once the two
  // blank cells, both dividers, and the sprocket rails are accounted for —
  // so long quotes were scaled as if they had the whole screen and overflowed
  // the cell top and bottom, which is exactly what the screenshot showed.
  const cardTopLimitPx = frameHeight * 0.16;
  // Space the card may occupy before it would reach the top of the frame
  // (landscape) or before it would overflow its own filmstrip cell (portrait).
  const cellVerticalPadPx = 40; // matches the "40px 28px 0" card padding below
  const cardAvailPx = p
    ? middleCellHeightPx - cellVerticalPadPx * 2
    : frameHeight - cardTopLimitPx - frameHeight * 0.06;
  // Rendered heights estimated from the fitted sizes (mono ~0.6em advance).
  const quoteWrapPx = p ? width * 0.86 : 960;
  const quoteLines = displayQuote
    ? Math.max(
        1,
        Math.ceil(
          displayQuote.length /
            Math.max(1, Math.floor(quoteWrapPx / (quotePx * 0.6))),
        ),
      )
    : 0;
  const quoteBlockPx = quoteLines * quotePx * 1.45;
  const quoteMarkPx = Math.round(quotePx * (p ? 1.4 : 1.2)) * 0.6 + 4;
  const attribBlockPx = displaySubject || interviewRole ? attribTargetPx * 1.4 + 30 : 0;
  const cardContentPx = quoteMarkPx + quoteBlockPx + attribBlockPx;
  const cardScale = Math.max(
    0.5,
    Math.min(1, cardContentPx > 0 ? cardAvailPx / cardContentPx : 1),
  );

  const lowerThirdReveal = interpolate(frame, [16, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const quoteMarkReveal = interpolate(frame, [22, 32], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <DocReelScene bgColor={bgColor} dur={dur} era={activeEra} textures={["dust_scratches"]} vignette>
      {/* A classic 3-frame filmstrip: three blank cells in a strip, sprocket
          holes on each cell's top/bottom edge, plain dividers between cells.
          The interview photo/clip and quote card render only in the middle
          cell — the outer two stay empty, matching the reference icon.
          Landscape lays the cells in a row; portrait stacks them in a
          column so each cell stays wide enough to be usable. */}
      <FilmstripThreeCell inset={p ? 22 : 30} portrait={p}>
        {imageUrl || videoUrl ? (
          <ArchiveImageBackdrop
            imageUrl={imageUrl}
            videoUrl={videoUrl}
            // No local default: both composition roots always build
            // `${focusX}% ${focusY}%` (defaulting to 50/50), so a `??` fallback
            // here is unreachable and only implies a talking-head bias that
            // never actually applies.
            imageObjectPosition={imageObjectPosition}
            imageZoom={imageZoom}
            videoMuted={videoMuted}
            videoVolume={videoVolume}
            videoDurationInFrames={videoDurationInFrames}
            videoStartInFrames={videoStartInFrames}
            dur={dur}
            kenBurns={0.08}
          />
        ) : (
          <div style={{ position: "absolute", inset: 0, background: theme.bg }} />
        )}

        {/* Portrait centers the interview copy in the frame; landscape keeps
            the conventional lower-third placement. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: p ? "50%" : undefined,
            bottom: p ? undefined : "16%",
            padding: p ? "40px 28px 0" : "48px 90px 0",
            background: `linear-gradient(0deg, ${hexToRgba(theme.bg, 0.95)} 30%, transparent 100%)`,
            opacity: lowerThirdReveal,
            // `scale` is appended to the existing reveal translate rather than
            // replacing it. Origin is bottom-centre so the card shrinks toward
            // its anchored edge and the lower third stays put — scaling about
            // the centre would lift the attribution off its baseline.
            transform: p
              ? `translateY(calc(-50% + ${(1 - lowerThirdReveal) * 20}px)) scale(${cardScale})`
              : `translateY(${(1 - lowerThirdReveal) * 20}px) scale(${cardScale})`,
            transformOrigin: p ? "center center" : "center bottom",
            textAlign: p ? "center" : "left",
          }}
        >
          <div
            style={{
              fontFamily: DOCREEL_DISPLAY_FONT,
              fontWeight: 700,
              // Scales with the quote it opens, rather than staying fixed while
              // the quote under it grows.
              fontSize: Math.round(quotePx * (p ? 1.4 : 1.2)),
              color: theme.accent,
              opacity: quoteMarkReveal,
              lineHeight: 0.6,
              marginBottom: 4,
            }}
          >
            &ldquo;
          </div>
          {displayQuote ? (
            <div
              style={{
                position: "relative",
                // `width` is SET, not just capped. The measuring mirror below is
                // `width:100%` of this box, and the visible quote is a TYPEWRITER
                // reveal — so with only a maxWidth this box shrink-wraps to
                // however much text has typed out so far. The fitter then
                // measures the full quote wrapped into that momentary width,
                // which differs between the browser Player and the headless
                // renderer because they sample at different points in the
                // reveal. That is why the quote came out at different sizes in
                // the frontend preview and the MP4. Fixing the width makes the
                // measurement independent of reveal progress, so both agree.
                width: p ? "100%" : 960,
                maxWidth: "100%",
                margin: p ? "0 auto" : undefined,
              }}
            >
              <div
                ref={quoteMirrorRef}
                aria-hidden
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  visibility: "hidden",
                  pointerEvents: "none",
                  fontFamily: DOCREEL_MONO_FONT,
                  fontSize: quotePx,
                  lineHeight: 1.45,
                }}
              >
                {displayQuote}
              </div>
              <div
                style={{
                  fontFamily: DOCREEL_MONO_FONT,
                  fontSize: quotePx,
                  color: theme.accent,
                  lineHeight: 1.45,
                }}
              >
                {visibleQuote}
                {quoteCursor}
              </div>
            </div>
          ) : null}
          {(displaySubject || interviewRole) ? (
            <div
              style={{
                marginTop: 16,
                paddingTop: 14,
                borderTop: `1px solid ${theme.line}`,
                fontFamily: DOCREEL_MONO_FONT,
                fontSize: attribTargetPx,
                letterSpacing: "0.1em",
                color: hexToRgba(theme.text, 0.75),
              }}
            >
              {displaySubject ? <span style={{ color: theme.text }}>{displaySubject.toUpperCase()}</span> : null}
              {displaySubject && interviewRole ? "  —  " : ""}
              {interviewRole || ""}
            </div>
          ) : null}
        </div>
      </FilmstripThreeCell>
    </DocReelScene>
  );
};
