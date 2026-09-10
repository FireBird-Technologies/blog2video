import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { useFitText } from "../components/useFitText";
import { MatrixBackground } from "../MatrixBackground";
import {
  buildHudStatus,
  GridTunnel,
  ScanlinesOverlay,
  SignalPing,
  SignalWaveform,
  TerminalHUD,
} from "../components/MatrixArtifacts";
import { MATRIX_DEFAULT_FONT_FAMILY } from "../constants";
import type { MatrixLayoutProps } from "../types";
import { SocialIcons } from "../../SocialIcons";
import { resolveCtas } from "../../shared/resolveCtas";

/**
 * EndingSocialsV2 — "Sign-Off Terminal" (variant of ending_socials)
 *
 * Same props as the base, deliberately different composition. The base centres a
 * character-decode title over a rule with bordered CTA cards below; this reads
 * as the last few lines of a terminal session before logout:
 *
 *   * alignment — everything LEFT-aligned against a drawn rail, instead of a
 *     centred stack;
 *   * title — types in behind a `> ` prompt with a block cursor, instead of the
 *     base's per-character glyph decode;
 *   * CTAs — printed as prompt LINES (`$ open <link>`) that land one after
 *     another, instead of bordered cards laid out in columns;
 *   * socials — a single row on a rule at the foot of the session, rather than
 *     centred mid-frame;
 *
 * Vertical order, distributed across the frame rather than clustered mid-frame:
 *
 *   TITLE            upper third
 *   narration        close under the title
 *   $ cta lines      under the narration, stacked one per line
 *   socials          foot of the frame, under a rule
 *
 *   * background — rain pulled back behind a GridTunnel floor, so the outro
 *     settles rather than surging like the base's RainBurst + CipherRing.
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
  const { height } = useVideoConfig();
  const fps = 30;
  const p = aspectRatio === "portrait";
  const accent = accentColor || "#00FF41";
  const resolvedFontFamily = (fontFamily ?? "").trim() || MATRIX_DEFAULT_FONT_FAMILY;

  const subtext = (narration ?? "").trim();

  // Identical CTA derivation to the base, so no prop behaviour changes.
  const cards = resolveCtas({ ctas, ctaButtonText, websiteLink, showWebsiteButton }).filter(
    (c) => c.showWebsiteButton && c.websiteLink.length > 0,
  );
  const hasAnyCard = cards.length > 0;

  // ── Sizing ──
  // Unlike the base, CTAs are prose lines rather than display-type cards, so
  // they take their size from the narration scale instead of from the title.
  const titleTarget = titleFontSize ?? (p ? 87 : 70);
  const narrationTarget = descriptionFontSize ?? (p ? 42 : 37);
  const titleMirrorRef = React.useRef<HTMLDivElement>(null);
  const narrationRef = React.useRef<HTMLDivElement>(null);
  const ctaMirrorRef = React.useRef<HTMLDivElement>(null);
  // Longest label and longest link tracked separately — they are now two lines
  // at two different sizes, so measuring a joined string would misjudge both.
  const longestCtaLabel = cards.reduce(
    (longest, card) => (card.ctaButtonText.length > longest.length ? card.ctaButtonText : longest),
    "",
  );
  const longestCtaLink = cards.reduce(
    (longest, card) => (card.websiteLink.length > longest.length ? card.websiteLink : longest),
    "",
  );
  const longestCta = `${longestCtaLabel} ${longestCtaLink}`;
  const { px: resolvedTitleSize } = useFitText(
    titleMirrorRef,
    titleTarget,
    15,
    [title, titleTarget, p],
    height * 0.2,
  );
  const { px: resolvedNarrationSize } = useFitText(
    narrationRef,
    narrationTarget,
    12,
    [subtext, narrationTarget, p, hasAnyCard],
    height * 0.14,
  );
  // Each CTA occupies two lines — the LABEL over its LINK — and every card gets
  // an equal slice of one shared block, so 1, 2 or 3 cards keep the same
  // footprint. resolveCtas caps at 3, so `cardCount` is 1-3.
  const cardCount = Math.max(1, cards.length);
  // The two lines follow DIFFERENT sliders: the label is display copy and reads
  // off titleFontSize, the link is support copy and reads off
  // descriptionFontSize — matching how the title and narration above are wired.
  // Both scale down as cards are added so three CTAs still fit the block.
  const cardScale = cardCount >= 3 ? 0.62 : cardCount === 2 ? 0.8 : 1;
  // 0.75 of the title (was 0.62) — a heavier CTA that still reads as secondary
  // to the headline above it.
  const ctaLabelTarget = Math.round(titleTarget * 0.75 * cardScale);
  const ctaLinkTarget = Math.round(narrationTarget * 0.82 * cardScale);
  // Budget is PER CARD: the block as a whole, split between the cards, minus the
  // gaps between them. Without dividing, three long links would each be fitted
  // against the full block and the stack would overflow.
  const ctaGap = p ? 16 : 18;
  const ctaBlockBudget = height * 0.24;
  const ctaCardBudget = Math.max(
    height * 0.06,
    (ctaBlockBudget - (cardCount - 1) * ctaGap) / cardCount,
  );
  // Measured against the label+link pair, so the fit accounts for both lines.
  const { px: fittedCtaLabelSize } = useFitText(
    ctaMirrorRef,
    ctaLabelTarget,
    10,
    [longestCta, ctaLabelTarget, ctaLinkTarget, p, cardCount],
    ctaCardBudget,
  );
  // The link tracks whatever shrink the label needed, so the pair stays in
  // proportion when a long CTA forces the label down.
  const ctaLinkSize = Math.max(
    9,
    Math.round(ctaLinkTarget * (fittedCtaLabelSize / Math.max(1, ctaLabelTarget))),
  );

  // ── Timing: a session printing itself out, top to bottom ──
  const railStart = 2;
  const titleStart = 8;
  // Typed rather than decoded, so the title's duration follows its length.
  const typeSpeed = 1.6;
  const titleTypedChars = Math.max(0, Math.min(title.length, Math.floor((frame - titleStart) * typeSpeed)));
  const titleDone = titleStart + title.length / typeSpeed;
  const titleCursorOn = frame > titleStart && (titleTypedChars < title.length || frame % 30 < 15);

  const subtextStart = titleDone + 6;
  const ctaStart = subtextStart + 14;
  const ctaStride = 9;
  // Socials land after the LAST cta line has printed, so the sign-off order is
  // stable whether there are 1, 2 or 3 of them.
  const socialStart = ctaStart + cardCount * ctaStride + 6;

  const subtextOpacity = interpolate(frame, [subtextStart, subtextStart + 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subtextRise = spring({
    frame: frame - subtextStart,
    fps,
    config: { damping: 22, stiffness: 150 },
  });

  const socialOpacity = interpolate(frame, [socialStart, socialStart + 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Rail draws down the left edge across the whole print-out.
  const railDraw = interpolate(frame, [railStart, socialStart], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: bgColor }}>
      {/* MatrixBackground's `opacity` prop is inert (destructured, never
          applied), so per-scene rain strength rides this wrapper. Pulled well
          back — this outro settles rather than surging like the base. */}
      <AbsoluteFill style={{ opacity: 0.4 }}>
        <MatrixBackground bgColor={bgColor} fontFamily={resolvedFontFamily} />
      </AbsoluteFill>

      {/* Floor plane + session chrome. No RainBurst / CipherRing / CodeFragments
          — dropping the base's surge is what separates the two closers. */}
      {/* 0.95 (was 0.5, the lowest of any Matrix layout) so the floor grid reads
          as a deliberate construct rather than a faint smudge. Set through the
          `intensity` prop rather than by editing GridTunnel itself, which four
          layouts share. */}
      <GridTunnel accentColor={accent} intensity={0.95} />

      {/* Continuous background motion, answering the base's rotating CipherRing
          with the opposite geometry: rings travelling OUTWARD instead of
          spinning in place. The origin is pinned to the rail beside the copy, so
          the pings read as emanating from the terminal session itself and sweep
          across the frame rather than sitting in a disc behind the text. */}
      <SignalPing
        accentColor={accent}
        originX={p ? 11 : 9}
        originY={p ? 42 : 46}
        every={72}
        rings={3}
        startFrame={2}
      />
      <TerminalHUD
        accentColor={accent}
        statusText={buildHudStatus("SIGN-OFF", title)}
        startFrame={4}
        seed={91}
      />
      <SignalWaveform accentColor={accent} edge="bottom" seed={87} startFrame={socialStart - 8} />
      <ScanlinesOverlay accentColor={accent} intensity={0.75} />

      {/* Hidden mirrors: give useFitText the final copy to measure, rather than
          a mid-type fragment. */}
      <div
        ref={titleMirrorRef}
        style={{
          position: "absolute",
          visibility: "hidden",
          width: "82%",
          fontSize: titleTarget,
          fontWeight: 900,
          lineHeight: 1.08,
          textTransform: "uppercase",
          fontFamily: resolvedFontFamily,
          overflowWrap: "anywhere",
        }}
      >
        {title}
      </div>
      {/* Mirrors ONE card at its longest — label line over link line — so the
          fit is measured against the real two-line shape, not a single
          concatenated string. */}
      <div
        ref={ctaMirrorRef}
        style={{
          position: "absolute",
          visibility: "hidden",
          width: "82%",
          fontFamily: resolvedFontFamily,
          overflowWrap: "anywhere",
        }}
      >
        <div
          style={{
            fontSize: ctaLabelTarget,
            fontWeight: 700,
            lineHeight: 1.15,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {longestCtaLabel}
        </div>
        <div style={{ fontSize: ctaLinkTarget, fontWeight: 400, lineHeight: 1.3 }}>
          {longestCtaLink}
        </div>
      </div>

      {/* ── The session block ──
          Distributed top-to-bottom rather than clustered in the middle: the
          title sits at the TOP of the frame, the narration just below centre,
          the CTA lines under that, and the socials last at the foot. The
          spacers between the groups carry the distribution (rather than
          `space-between`, which would spread the CTA lines apart too). */}
      <div
        style={{
          position: "absolute",
          left: p ? "11%" : "9%",
          right: p ? "9%" : "8%",
          // Title starts lower than a flush-to-top placement — at 8% it read as
          // pinned to the frame edge with a dead gap beneath it.
          top: p ? "15%" : "14%",
          // The socials sit at this block's foot, so this inset is what lifts
          // them off the bottom of the frame. Raised from 8/9% — at that depth
          // the icon row read as stuck to the floor.
          bottom: p ? "16%" : "15%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "flex-start",
        }}
      >
        {/* Rail drawing down beside the whole print-out. */}
        <div
          style={{
            position: "absolute",
            left: p ? -22 : -26,
            top: "6%",
            width: 2,
            height: `${railDraw * 88}%`,
            backgroundColor: `${accent}55`,
            boxShadow: `0 0 10px ${accent}44`,
          }}
        />

        {/* Title, typed behind a prompt. */}
        <div
          style={{
            fontSize: resolvedTitleSize,
            fontWeight: 900,
            color: accent,
            textTransform: "uppercase",
            letterSpacing: "-0.02em",
            lineHeight: 1.08,
            textAlign: "left",
            overflowWrap: "anywhere",
            textShadow: `0 0 18px ${accent}66, 0 0 42px ${accent}22`,
            maxHeight: height * 0.2,
            overflow: "hidden",
          }}
        >
          <span style={{ color: `${accent}88` }}>{"> "}</span>
          {title.slice(0, titleTypedChars)}
          {/* Thin caret rather than the `█` full-block glyph, which rendered as
              a heavy filled rectangle nearly as wide as a letter. Drawn as an
              element so the width is controlled directly instead of being
              whatever the font's block character happens to be. */}
          {titleCursorOn && (
            <span
              style={{
                display: "inline-block",
                width: Math.max(2, resolvedTitleSize * 0.07),
                height: "0.82em",
                marginLeft: resolvedTitleSize * 0.1,
                verticalAlign: "baseline",
                transform: "translateY(0.06em)",
                backgroundColor: accent,
                boxShadow: `0 0 12px ${accent}`,
              }}
            />
          )}
        </div>

        {/* Gap between the title and the narration. Flexible so it absorbs the
            difference between a one-line and a wrapped title.

            Weighted LIGHTER than the spacer above the socials (0.5 : 1) so the
            narration sits close under the title as part of the same group, and
            the slack collects lower down instead. It was 1.6, which stranded
            the narration near mid-frame with a dead band under the title.

            `maxHeight` matters as much as the weight: in portrait the frame is
            tall enough that even a 0.5 share is a ~380px void, so the gap is
            capped outright and the remaining slack falls through to the spacer
            above the socials. */}
        <div
          style={{
            flex: "0.5 1 auto",
            minHeight: p ? 24 : 20,
            maxHeight: p ? 150 : 110,
          }}
        />

        {/* Narration — sits slightly below centre. */}
        {subtext && (
          <div
            ref={narrationRef}
            style={{
              marginTop: 0,
              fontSize: resolvedNarrationSize,
              fontWeight: 400,
              color: `${textColor || accent}CC`,
              fontFamily: resolvedFontFamily,
              lineHeight: 1.4,
              letterSpacing: "0.03em",
              textAlign: "left",
              maxWidth: "94%",
              overflowWrap: "anywhere",
              maxHeight: height * 0.14,
              overflow: "hidden",
              opacity: subtextOpacity,
              transform: `translateY(${(1 - subtextRise) * 10}px)`,
            }}
          >
            {subtext}
          </div>
        )}

        {/* CTAs as printed prompt blocks — the base uses bordered cards.
            Sits lower than the narration it follows: the gap is wider than the
            title→narration one, so the CTAs read as their own group rather than
            as a third line of the paragraph above. */}
        {hasAnyCard && (
          <div
            style={{
              // Wider gap when there is a single CTA, tightening as cards are
              // added: one card leaves plenty of room to breathe, whereas three
              // already occupy the block and need the space for themselves.
              marginTop: (p ? 82 : 74) - (cardCount - 1) * (p ? 14 : 12),
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: ctaGap,
              width: "100%",
            }}
          >
            {cards.map((card, i) => {
              const start = ctaStart + i * ctaStride;
              const local = frame - start;
              if (local < 0) return null;
              const lineOpacity = interpolate(local, [0, 8], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              // Each line wipes in left→right, like it is being printed.
              const wipe = interpolate(local, [0, 12], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const eased = 1 - Math.pow(1 - wipe, 3);

              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    opacity: lineOpacity,
                    fontFamily: resolvedFontFamily,
                    maxWidth: "100%",
                    // Hard-clamp each card to its share of the block so a very
                    // long link can never push the socials off the frame.
                    maxHeight: ctaCardBudget,
                    overflow: "hidden",
                    clipPath: `inset(0 ${(1 - eased) * 100}% 0 0)`,
                  }}
                >
                  {/* Label line — display copy, sized off titleFontSize. */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: p ? 8 : 10,
                      fontSize: fittedCtaLabelSize,
                      lineHeight: 1.15,
                    }}
                  >
                    <span style={{ flex: "0 0 auto", color: `${accent}66`, fontWeight: 400 }}>$</span>
                    <span
                      style={{
                        color: accent,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        overflowWrap: "anywhere",
                        textShadow: `0 0 12px ${accent}44`,
                      }}
                    >
                      {card.ctaButtonText.trim() || "Get started"}
                    </span>
                  </div>

                  {/* Link line — support copy, sized off descriptionFontSize.
                      Indented to clear the `$` so it aligns under the label. */}
                  <div
                    style={{
                      marginTop: p ? 4 : 5,
                      marginLeft: fittedCtaLabelSize * 0.62 + (p ? 8 : 10),
                      fontSize: ctaLinkSize,
                      lineHeight: 1.3,
                      color: `${accent}88`,
                      fontWeight: 400,
                      overflowWrap: "anywhere",
                      minWidth: 0,
                    }}
                  >
                    {card.websiteLink}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Absorbs the leftover slack, so the socials sit at the FOOT of the
            block and close the sign-off. How high that foot is comes from the
            block's own `bottom` inset above — raising that lifts the row, which
            is more stable than capping this spacer (a fixed cap can't hold a
            consistent height, because the slack it competes with swings with
            the CTA count and title wrap). */}
        <div style={{ flex: "1 1 auto", minHeight: p ? 20 : 16 }} />

        {/* Socials on a rule at the foot of the session. */}
        <div
          style={{
            marginTop: 0,
            width: "100%",
            opacity: socialOpacity,
          }}
        >
          <div
            style={{
              width: "100%",
              height: 1,
              backgroundColor: `${accent}33`,
              marginBottom: p ? 14 : 16,
            }}
          />
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <SocialIcons
              socials={socials}
              accentColor={accent}
              textColor={textColor || "#00FF41"}
              maxPerRow={p ? 4 : 10}
              fontFamily={resolvedFontFamily}
              aspectRatio={aspectRatio}
            />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
