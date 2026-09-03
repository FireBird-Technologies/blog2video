import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { NewscastLayoutProps } from "./types";
import { ZoomCropImg } from "../components/ZoomCropImg";
import { ZoomCropVideo } from "../components/ZoomCropVideo";
import { useFitText } from "../components/useFitText";
import {
  DEFAULT_NEWSCAST_ACCENT,
  DEFAULT_NEWSCAST_TEXT,
  getNewscastPortraitTypeScale,
  newscastFont,
  scaleNewscastPx,
  toRgba,
} from "../themeUtils";
import { HEADLINE_WEIGHT, headlineTextShadowFor } from "../newscastLayoutMotion";

/**
 * CinematicTitleV2 — "Split Feed"
 *
 * Variant of `opening`. Same props, different composition.
 *
 * Base is a full-bleed plate with a left-ranged hero block floating on top.
 * This one splits the frame on a gold seam: the visual becomes a framed FEED
 * panel on one side, and the copy sits on a dark control-desk column on the
 * other. The headline wipes in line-by-line from a mask rather than using
 * `headlinePop`, which is what separates it from every other newscast opener.
 *
 * The top bar / channel bar chrome is deliberately kept so it still reads as the
 * same broadcast as the base opening.
 *
 * With NO image the feed panel shrinks to a slim on-air strip (right in
 * landscape, top in portrait) rather than holding half the frame for a
 * placeholder, and the copy column expands into the reclaimed space. See
 * `FEED_SIZE` / `DESK_SIZE` — the seam, counter and desk column all key off
 * them, so the three stay locked together in both states.
 */

const GOLD = "#D4AA50";

function splitTitleForAccent(title: string) {
  const words = (title || "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return { white: words[0] ?? "", red: "" };
  return { white: words.slice(0, -1).join(" "), red: words[words.length - 1] };
}

export const CinematicTitleV2: React.FC<NewscastLayoutProps> = ({
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
  tickerItems,
  lowerThirdTag,
  lowerThirdHeadline,
  lowerThirdSub,
  accentColor,
  textColor,
  titleFontSize,
  descriptionFontSize,
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const portraitScale = getNewscastPortraitTypeScale(width, height);
  const p = height > width;

  const RED = accentColor || DEFAULT_NEWSCAST_ACCENT;
  const STEEL = textColor || DEFAULT_NEWSCAST_TEXT;
  const shadows = headlineTextShadowFor(RED);

  const { white, red } = splitTitleForAccent(title);
  const safeTicker = useMemo(() => (tickerItems?.filter(Boolean) ?? []).slice(0, 8), [tickerItems]);
  const hasVisual = Boolean(imageUrl?.trim() || videoUrl?.trim());

  const fadeIn = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });

  // Feed panel drives in from its own edge.
  const feedIn = interpolate(frame, [4, 26], [0, 1], { extrapolateRight: "clamp" });
  const feedOffset = (1 - feedIn) * (p ? -140 : 200);

  // Seam draws along its length before anything lands on it.
  const seamGrow = interpolate(frame, [0, 22], [0, 1], { extrapolateRight: "clamp" });

  // Headline wipes in as two masked lines — the signature of this variant.
  const line1Wipe = interpolate(frame, [14, 34], [0, 1], { extrapolateRight: "clamp" });
  const line2Wipe = interpolate(frame, [26, 48], [0, 1], { extrapolateRight: "clamp" });

  const kickerIn = interpolate(frame, [6, 20], [0, 1], { extrapolateRight: "clamp" });
  const deckIn = interpolate(frame, [42, 62], [0, 1], { extrapolateRight: "clamp" });
  const slateIn = interpolate(frame, [30, 50], [0, 1], { extrapolateRight: "clamp" });

  /* ── Auto-fit ──────────────────────────────────────────────
     Title and narration are unbounded user input in a flex-centred desk
     column pinned between the feed panel and the ticker (bottom: 40); long
     copy would overflow that band. Headline wipes in as opacity/translateY
     only — full text is in the DOM from frame 0 — so refs are safe. Title
     gets most of the column's share, narration the rest — each against its
     own fixed, independent budget. No give-back cross-talk between the two:
     a useLayoutEffect+setState chain reacting to another useFitText's
     overflow output creates a multi-render convergence that Remotion's
     per-frame headless capture can settle at different points on different
     frames (confirmed via a real render — frame-to-frame scene-change score
     hit 1.0, i.e. maximum, twice in the first ten frames). */
  const titleRef = React.useRef<HTMLDivElement>(null);
  const narrationRef = React.useRef<HTMLDivElement>(null);
  const titleTargetPx = titleFontSize ?? (p ? 78 : 66);
  const narrationTargetPx = descriptionFontSize ?? (p ? 30 : 19);
  const stackBudgetPx = Math.round(height * (p ? 0.4 : 0.52));
  const titleBudgetPx = Math.round(stackBudgetPx * (narration ? 0.6 : 1));

  const { px: titlePx } = useFitText(
    titleRef,
    titleTargetPx,
    titleFontSizeIsUserSet ? titleTargetPx : Math.round(titleTargetPx * 0.42),
    [title, titleTargetPx, titleFontSizeIsUserSet, titleBudgetPx],
    titleBudgetPx,
  );
  const narrationBudgetPx = Math.max(1, stackBudgetPx - titleBudgetPx);
  const { px: narrationPx } = useFitText(
    narrationRef,
    narrationTargetPx,
    descriptionFontSizeIsUserSet ? narrationTargetPx : Math.round(narrationTargetPx * 0.55),
    [narration, narrationTargetPx, descriptionFontSizeIsUserSet, narrationBudgetPx, titlePx],
    narrationBudgetPx,
  );

  const visual = hasVisual ? (
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
        alt=""
      />
    )
  ) : null;

  // Frame counter on the seam — a static-looking broadcast readout that moves.
  const feedCounter = String(1000 + (frame % 9000)).padStart(5, "0");

  // Feed panel size. With a real image the panel carries the scene, so it takes
  // nearly half the frame. With no image there is nothing to show, so it shrinks
  // to a slim on-air strip (right in landscape, top in portrait) and the copy
  // column takes the reclaimed space. Every other element that meets the seam
  // — the seam itself, the counter, the desk column — is positioned off these
  // two values so the three stay locked together.
  const FEED_SIZE = hasVisual ? (p ? "34%" : "46%") : p ? "13%" : "18%";
  const DESK_SIZE = hasVisual ? (p ? "34%" : "54%") : p ? "13%" : "82%";

  return (
    <AbsoluteFill style={{ backgroundColor: "transparent", overflow: "hidden" }}>
      {/* Desk-column scrim, NOT an opaque ground. The composition renders the
          shared pixel-map/globe background beneath every newscast layout, so this
          is kept light — enough of a navy lift to hold the headline, while the
          map stays clearly readable through it, as it does on the base `opening`. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(140deg, rgba(14,26,58,0.42) 0%, rgba(18,34,72,0.30) 45%, rgba(10,18,42,0.46) 100%)",
        }}
      />

      {/* ── Feed panel ── */}
      <div
        style={{
          position: "absolute",
          ...(p
            ? { top: 44, left: 0, right: 0, height: FEED_SIZE }
            : { top: 0, bottom: 0, right: 0, width: FEED_SIZE }),
          overflow: "hidden",
          opacity: feedIn,
          transform: p ? `translateY(${feedOffset}px)` : `translateX(${feedOffset}px)`,
          zIndex: 5,
        }}
      >
        {visual ?? (
          // No image: a translucent tinted strip, not an opaque plate — the
          // shared pixel-map background still reads through it.
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                "repeating-linear-gradient(135deg, rgba(30,95,212,0.12) 0px, rgba(30,95,212,0.12) 2px, transparent 2px, transparent 12px), linear-gradient(160deg, rgba(8,18,44,0.45) 0%, rgba(5,10,26,0.55) 100%)",
            }}
          />
        )}

        {/* Scanline mask over the feed */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 1px, transparent 1px, transparent 4px)",
            pointerEvents: "none",
          }}
        />
        {/* Grade the feed into the desk column at the seam */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            // The heavy seam-side falloff only makes sense on the large panel; on
            // the slim no-image strip it would swallow the strip entirely.
            background: hasVisual
              ? p
                ? "linear-gradient(180deg, rgba(4,6,15,0.5) 0%, transparent 30%, rgba(4,6,15,0.85) 100%)"
                : "linear-gradient(90deg, rgba(4,6,15,0.92) 0%, rgba(4,6,15,0.25) 35%, transparent 100%)"
              : p
                ? "linear-gradient(180deg, transparent 0%, rgba(4,6,15,0.35) 100%)"
                : "linear-gradient(90deg, rgba(4,6,15,0.42) 0%, transparent 60%)",
            pointerEvents: "none",
          }}
        />

        {/* SOURCE slate — only on the full panel; it does not fit the slim strip. */}
        {hasVisual && (
        <div
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(4,8,20,0.78)",
            border: "1px solid rgba(200,220,255,0.22)",
            padding: "5px 10px",
            opacity: slateIn,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: RED,
              boxShadow: `0 0 10px ${toRgba(RED, 0.8)}`,
              opacity: 0.35 + 0.65 * (0.5 + 0.5 * Math.sin((frame / 24) * Math.PI * 2)),
            }}
          />
          <div
            style={{
              fontFamily: newscastFont(fontFamily, "label"),
              fontSize: scaleNewscastPx(10, portraitScale),
              letterSpacing: 3,
              fontWeight: 700,
              color: STEEL,
              textTransform: "uppercase",
            }}
          >
            Source · Feed 01
          </div>
        </div>
        )}
      </div>

      {/* ── Gold seam ── */}
      <div
        style={{
          position: "absolute",
          ...(p
            ? {
                left: 0,
                right: 0,
                top: `calc(44px + ${FEED_SIZE})`,
                height: 3,
                width: `${seamGrow * 100}%`,
              }
            : {
                top: 0,
                bottom: 0,
                right: FEED_SIZE,
                width: 3,
                height: `${seamGrow * 100}%`,
              }),
          background: p
            ? `linear-gradient(90deg, ${RED}, ${GOLD} 55%, ${toRgba(RED, 0.4)})`
            : `linear-gradient(180deg, ${RED}, ${GOLD} 55%, ${toRgba(RED, 0.4)})`,
          boxShadow: `0 0 16px ${toRgba(GOLD, 0.5)}`,
          zIndex: 12,
        }}
      />

      {/* Running counter riding the seam */}
      <div
        style={{
          position: "absolute",
          ...(p
            ? { top: `calc(44px + ${FEED_SIZE} + 10px)`, right: 18 }
            : { right: `calc(${FEED_SIZE} + 14px)`, bottom: 96 }),
          fontFamily: newscastFont(fontFamily, "mono"),
          fontSize: scaleNewscastPx(11, portraitScale),
          letterSpacing: 2,
          color: GOLD,
          opacity: slateIn * 0.85,
          zIndex: 13,
        }}
      >
        TC {feedCounter}
      </div>

      {/* ── Desk column: kicker → masked headline → deck ── */}
      <div
        style={{
          position: "absolute",
          ...(p
            ? { left: 0, right: 0, top: `calc(44px + ${FEED_SIZE})`, bottom: 40 }
            : { left: 0, top: 44, bottom: 40, width: DESK_SIZE }),
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: p ? "34px 34px 0" : "0 46px 0 52px",
          opacity: fadeIn,
          zIndex: 20,
        }}
      >
        {/* Kicker */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            marginBottom: p ? 16 : 22,
            opacity: kickerIn,
            transform: `translateX(${(1 - kickerIn) * -24}px)`,
          }}
        >
          <div
            style={{
              background: RED,
              color: "#fff",
              fontFamily: newscastFont(fontFamily, "title"),
              fontSize: scaleNewscastPx(13, portraitScale),
              fontWeight: 900,
              letterSpacing: 3,
              textTransform: "uppercase",
              padding: "6px 12px",
              clipPath: "polygon(0 0, 93% 0, 100% 50%, 93% 100%, 0 100%)",
            }}
          >
            Breaking
          </div>
          <div
            style={{
              fontFamily: newscastFont(fontFamily, "label"),
              fontSize: scaleNewscastPx(11, portraitScale),
              letterSpacing: 3,
              color: "#7A9AB8",
              textTransform: "uppercase",
            }}
          >
            {lowerThirdTag ?? "LIVE COVERAGE"}
          </div>
        </div>

        {/* Masked headline — line 1 (lede words), line 2 (accent word) */}
        <div ref={titleRef}>
          <div style={{ overflow: "hidden" }}>
            <h1
              style={{
                margin: 0,
                fontFamily: newscastFont(fontFamily, "title"),
                fontSize: titlePx,
                fontWeight: HEADLINE_WEIGHT,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                lineHeight: 1.02,
                color: "white",
                textShadow: shadows.strong,
                opacity: line1Wipe,
                transform: `translateY(${(1 - line1Wipe) * 100}%)`,
              }}
            >
              {white}
            </h1>
          </div>
          {red ? (
            <div style={{ overflow: "hidden", marginTop: 2 }}>
              <div
                style={{
                  fontFamily: newscastFont(fontFamily, "title"),
                  fontSize: titlePx,
                  fontWeight: HEADLINE_WEIGHT,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  lineHeight: 1.02,
                  color: RED,
                  textShadow: shadows.strong,
                  opacity: line2Wipe,
                  transform: `translateY(${(1 - line2Wipe) * 100}%)`,
                }}
              >
                {red}
              </div>
            </div>
          ) : null}
        </div>

        {/* Rule under the headline */}
        <div
          style={{
            marginTop: p ? 18 : 24,
            marginBottom: p ? 16 : 20,
            height: 1,
            width: `${deckIn * 100}%`,
            maxWidth: 560,
            background: `linear-gradient(90deg, ${RED} 0%, ${GOLD} 45%, rgba(200,220,255,0.18) 100%)`,
          }}
        />

        {narration ? (
          <div
            ref={narrationRef}
            style={{
              fontFamily: newscastFont(fontFamily, "body"),
              fontSize: narrationPx,
              fontWeight: 400,
              lineHeight: 1.62,
              color: STEEL,
              maxWidth: p ? "100%" : 560,
              opacity: deckIn,
              transform: `translateY(${(1 - deckIn) * 14}px)`,
            }}
          >
            {narration}
          </div>
        ) : null}

        {/* Byline rail */}
        <div
          style={{
            marginTop: p ? 20 : 28,
            display: "flex",
            alignItems: "center",
            gap: 12,
            opacity: slateIn,
          }}
        >
          <div style={{ width: 3, height: 34, background: RED }} />
          <div>
            <div
              style={{
                fontFamily: newscastFont(fontFamily, "title"),
                fontSize: scaleNewscastPx(16, portraitScale),
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                color: "white",
                lineHeight: 1.15,
              }}
            >
              {lowerThirdHeadline ?? "Correspondent Report"}
            </div>
            <div
              style={{
                fontFamily: newscastFont(fontFamily, "body"),
                fontSize: scaleNewscastPx(12, portraitScale),
                color: "#7A9AB8",
                lineHeight: 1.4,
              }}
            >
              {lowerThirdSub ?? "Reporting live from the broadcast desk"}
            </div>
          </div>
        </div>
      </div>

      {/* ── Top bar (kept from the base opening) ── */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 44,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          background: "rgba(3,3,15,0.82)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid rgba(200,220,255,0.12)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
          <div
            style={{
              width: 22,
              height: 22,
              border: `1.5px solid ${toRgba(GOLD, 0.6)}`,
              background: "linear-gradient(155deg, rgba(10,28,58,0.95), rgba(4,10,22,0.98))",
            }}
          />
          <div
            style={{
              fontFamily: newscastFont(fontFamily, "title"),
              fontSize: scaleNewscastPx(15, portraitScale),
              fontWeight: 700,
              letterSpacing: 4,
              color: "white",
            }}
          >
            WORLD NEWS
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: RED,
            padding: "3px 10px",
            boxShadow: `0 0 12px ${toRgba(RED, 0.4)}`,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "white",
              opacity: 0.2 + 0.8 * (0.5 + 0.5 * Math.sin((frame / 30) * Math.PI * 2)),
            }}
          />
          <div
            style={{
              fontFamily: newscastFont(fontFamily, "title"),
              fontSize: scaleNewscastPx(11, portraitScale),
              fontWeight: 700,
              letterSpacing: 3,
              color: "white",
            }}
          >
            LIVE
          </div>
        </div>
      </div>

      {/* ── Ticker (kept from the base opening) ── */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 40,
          zIndex: 50,
          display: "flex",
        }}
      >
        <div
          style={{
            flexShrink: 0,
            height: "100%",
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            background: RED,
            fontFamily: newscastFont(fontFamily, "title"),
            fontSize: scaleNewscastPx(13, portraitScale),
            fontWeight: 700,
            letterSpacing: 2.5,
            color: "white",
            borderRight: `2px solid ${GOLD}`,
          }}
        >
          BREAKING
        </div>
        <div
          style={{
            flex: 1,
            background: "rgba(6,6,20,0.94)",
            borderTop: "1px solid rgba(200,220,255,0.2)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              display: "flex",
              alignItems: "center",
              height: "100%",
              left: 0,
              top: "50%",
              // The list below is doubled, so one full cycle is -50%, not -100%.
              // (The base `opening` layout uses -100% here and visibly jumps.)
              transform: `translateY(-50%) translateX(${-((frame % 600) / 600) * 50}%)`,
              whiteSpace: "nowrap",
              fontFamily: newscastFont(fontFamily, "body"),
              fontSize: scaleNewscastPx(14, portraitScale),
              fontWeight: 500,
              color: STEEL,
              willChange: "transform",
            }}
          >
            {(() => {
              const items = safeTicker.length
                ? safeTicker
                : ["JUST IN", "LATEST UPDATES", "OFFICIAL CONFIRMATIONS"];
              return [...items, ...items].map((txt, idx, arr) => (
                <React.Fragment key={`${txt}-${idx}`}>
                  <span style={{ padding: "0 20px" }}>{txt}</span>
                  {idx !== arr.length - 1 ? (
                    <span style={{ color: RED, fontWeight: 700, padding: "0 4px" }}>◆</span>
                  ) : null}
                </React.Fragment>
              ));
            })()}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
