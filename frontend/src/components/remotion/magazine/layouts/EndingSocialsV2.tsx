import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { SceneLayoutProps } from "../types";
import { SocialIcons } from "../../SocialIcons";
import { resolveCtas } from "../../../../utils/resolveCtas";
import {
  DeskBackdrop,
  Barcode,
  Halftone,
  PageThickness,
  MAG_DISPLAY,
  MAG_SERIF,
  MAG_SANS,
  MAG_BACKDROP,
  resolveMagColors,
  isPortrait,
  hexToRgba,
  useMagDims,
  useFitText,
} from "../magazineStyle";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const EASE_OUT = Easing.out(Easing.cubic);

/** Tracked uppercase column heading, e.g. "Follow", "Online". */
const ColHead: React.FC<{ color: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ color, children, style }) => (
  <div
    style={{
      fontFamily: MAG_SANS,
      fontWeight: 700,
      fontSize: 13,
      letterSpacing: "0.32em",
      textTransform: "uppercase",
      color,
      ...style,
    }}
  >
    {children}
  </div>
);

/**
 * EndingSocialsV2 — "Newsstand Close"
 *
 * Variant of `ending_socials`, and the deliberate BOOKEND to MagazineCoverV2
 * ("Newsstand"). It reuses that scene's whole vocabulary so opening and closing read
 * as the same shoot:
 *
 *   - the identical 3:4 booklet geometry (same cardH / maxCardW clamp);
 *   - the same red SPINE BAR down the left edge, with the issue label running up it;
 *   - the same two dimmed, frame-clipped sibling covers flanking the hero;
 *   - the same inverted palette (dark cover, light type) and blurred desk backdrop.
 *
 * The MOTION is the opening played in reverse. The opening slides the rack in from the
 * right and decelerates into dead centre; this one holds centre while the CTA content
 * reads, then slides the rack OUT to the left as the neighbours drift in to fill the
 * gap — the issue being put back on the shelf.
 *
 * The face shown is the BACK COVER: the wordmark, the follow column and the CTA cards,
 * laid out in one centred stack (a back cover, not a spread).
 *
 * Timing keeps the base's raw-frame tail lock (`useCurrentFrame()` +
 * `durationInFrames`), the one sanctioned exception to the MAG_TEMPO rule, so the
 * close always lands on the sequence tail.
 */
export const EndingSocialsV2: React.FC<SceneLayoutProps> = (props) => {
  const { title, narration, titleFontSize, descriptionFontSize, socials, websiteLink, showWebsiteButton, ctaButtonText, ctas, fontFamily } = props;
  const p = isPortrait(props.aspectRatio);

  // Same inversion as the cover: dark cover stock, light type, red frame.
  const resolved = resolveMagColors(props);
  const bg = resolved.text;
  const text = resolved.bg;
  const accent = resolved.accent;

  const cards = resolveCtas({ ctas, ctaButtonText, showWebsiteButton, websiteLink }).filter(
    (c) => c.showWebsiteButton && (c.websiteLink.length > 0 || c.ctaButtonText.trim().length > 0),
  );

  const { width, height } = useMagDims();
  const rawFrame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const deskBlur = Math.round(width * 0.012);

  const deckPx = descriptionFontSize ?? (p ? 30 : 20);
  const brandMark = (title || (props.brandName as string) || "").trim();
  const deck = (narration ?? "").trim();
  const kicker = ((props.sectionLabel as string) || "Thank you").trim();

  // ── Booklet geometry — IDENTICAL to MagazineCoverV2 so the bookend matches and
  // `coverBox()` stays correct for both.
  const cardAspect = 0.75;
  let cardH = height * (p ? 0.98 : 0.92);
  let cardW = cardH * cardAspect;
  const maxCardW = width * (p ? 0.98 : 0.68);
  if (cardW > maxCardW) {
    cardW = maxCardW;
    cardH = cardW / cardAspect;
  }
  const outer = Math.round(cardW * 0.035);
  const border = Math.round(cardW * 0.022);
  const spineW = Math.round(cardW * 0.085);
  const padX = spineW + Math.round(cardW * 0.055);

  // ── Reveal ladder (raw frames, same numbers as the base). ──
  const rev = (from: number, to: number) => interpolate(rawFrame, [from, to], [0, 1], CLAMP);
  const cardO = rev(0, 12);
  const spineP = rev(3, 18);
  const headO = rev(4, 18);
  const ruleP = rev(10, 24);
  const socialO = rev(16, 30);
  const ctaO = rev(22, 36);
  const fineO = rev(28, 42);

  // ── Exit: the opening's slide, reversed. The rack holds centre, then leaves to
  // the LEFT (the opening entered from the right) while the neighbours drift inward.
  const CLOSE = 130;
  const l = interpolate(rawFrame, [durationInFrames - CLOSE, durationInFrames - 1], [0, 1], { ...CLAMP, easing: EASE_OUT });
  const rackTX = interpolate(l, [0, 1], [0, -width * 0.34]);
  const rackScale = interpolate(l, [0, 1], [1.0, 1.08]);
  const rackOpacity = interpolate(l, [0.62, 1], [1, 0]);
  const backdropOpacity = interpolate(l, [0.55, 1], [1, 0]);
  // Neighbours close the gap as the hero leaves.
  const neighbourClose = interpolate(l, [0, 1], [0, cardW * 0.2]);

  // Wordmark sizing — restrained, and fitted so long titles never touch the frame.
  const innerW = cardW - 2 * padX;
  const wordRef = React.useRef<HTMLDivElement>(null);
  const wordTarget = titleFontSize ?? (p ? 64 : 46);
  const wordPx = useFitText(wordRef, wordTarget, p ? 20 : 18, 1, [brandMark, wordTarget, p, innerW], undefined);

  /** A dimmed sibling issue peeking in from one side — same treatment as the opening. */
  const neighbour = (side: -1 | 1) => (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        width: cardW,
        height: cardH,
        transform: `translate(-50%, -50%) translateX(${side * (cardW * 0.78) - side * neighbourClose}px) translateY(${cardH * 0.02}px) scale(0.86)`,
        background: bg,
        border: `${Math.max(2, Math.round(border * 0.5))}px solid ${hexToRgba(accent, 0.55)}`,
        filter: "brightness(0.45) blur(2px)",
        boxShadow: "0 8px 22px rgba(0,0,0,0.5)",
        overflow: "hidden",
      }}
    >
      <Halftone color={text} opacity={0.05} gap={9} />
      <div
        style={{
          position: "absolute",
          top: "6%",
          left: "10%",
          right: "10%",
          height: Math.max(6, cardH * 0.045),
          background: hexToRgba(text, 0.5),
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "10%",
          left: "10%",
          width: "44%",
          height: Math.max(4, cardH * 0.02),
          background: hexToRgba(text, 0.3),
        }}
      />
    </div>
  );

  const cardInner = (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 10,
        background: bg,
        overflow: "hidden",
        boxShadow: "0 6px 16px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.3)",
      }}
    >
      <div style={{ position: "absolute", inset: outer, border: `${border}px solid ${accent}`, overflow: "hidden", background: bg }}>
        <div style={{ position: "absolute", inset: 0, background: bg }} />
        <Halftone color={text} opacity={0.06} gap={9} />

        {/* Thin white inner frame — carried over from the cover. */}
        <div
          style={{
            position: "absolute",
            inset: Math.round(border * 0.55),
            border: `${Math.max(2, Math.round(border * 0.34))}px solid #FFFFFF`,
            pointerEvents: "none",
            zIndex: 2,
          }}
        />

        {/* The red spine bar — the opening's structural mark, repeated here. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: spineW,
            background: accent,
            transformOrigin: "top center",
            transform: `scaleY(${spineP})`,
            zIndex: 3,
          }}
        >
          <div
            style={{
              position: "absolute",
              bottom: "6%",
              left: "50%",
              transform: "translateX(-50%) rotate(180deg)",
              writingMode: "vertical-rl",
              fontFamily: MAG_SANS,
              fontWeight: 800,
              fontSize: Math.max(9, spineW * 0.3),
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: hexToRgba("#FFFFFF", 0.92),
              opacity: headO,
              whiteSpace: "nowrap",
            }}
          >
            {(props.issueLabel as string) ?? kicker}
          </div>
        </div>

        {/* ── Back-cover content stack ── */}
        <div
          style={{
            position: "absolute",
            top: "8%",
            bottom: "7%",
            left: padX,
            right: Math.round(cardW * 0.055),
            zIndex: 4,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <ColHead color={accent} style={{ opacity: headO, marginBottom: p ? 14 : 10 }}>
            {kicker}
          </ColHead>

          <div
            ref={wordRef}
            style={{
              fontFamily: MAG_DISPLAY,
              fontWeight: 800,
              fontSize: wordPx,
              lineHeight: 1.08,
              letterSpacing: "-0.02em",
              color: text,
              opacity: headO,
              overflowWrap: "break-word",
            }}
          >
            {brandMark}
          </div>

          <div
            style={{
              width: cardW * 0.18,
              height: 4,
              background: accent,
              margin: `${p ? 18 : 14}px 0 0`,
              transformOrigin: "left center",
              transform: `scaleX(${ruleP})`,
            }}
          />

          {deck ? (
            <div
              style={{
                marginTop: p ? 16 : 13,
                fontFamily: MAG_SERIF,
                fontStyle: "italic",
                fontSize: deckPx,
                lineHeight: 1.4,
                color: hexToRgba(text, 0.82),
                opacity: rev(14, 30),
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {deck}
            </div>
          ) : null}

          {/* Follow column */}
          <div style={{ marginTop: p ? 26 : 20, opacity: socialO, minHeight: 0 }}>
            <ColHead color={hexToRgba(text, 0.55)} style={{ marginBottom: p ? 12 : 9 }}>
              {((props.followLabel as string) ?? "Follow").trim()}
            </ColHead>
            <div style={{ height: 1, background: hexToRgba(text, 0.2), marginBottom: p ? 14 : 11 }} />
            <SocialIcons
              socials={socials}
              accentColor={accent}
              textColor={text}
              maxPerRow={p ? 3 : 4}
              fontFamily={MAG_SANS}
              aspectRatio={props.aspectRatio}
              iconSize={p ? 32 : 26}
            />
          </div>

          {/* CTA cards */}
          {cards.length > 0 ? (
            <div style={{ marginTop: p ? 24 : 18, opacity: ctaO }}>
              <ColHead color={hexToRgba(text, 0.55)} style={{ marginBottom: p ? 12 : 9 }}>
                {((props.onlineLabel as string) ?? "Online").trim()}
              </ColHead>
              <div style={{ display: "flex", flexDirection: "column", gap: p ? 12 : 9 }}>
                {cards.slice(0, 3).map((c, i) => {
                  const start = 22 + i * 6;
                  const o = interpolate(rawFrame, [start, start + 14], [0, 1], CLAMP);
                  const label = c.ctaButtonText.trim();
                  const link = c.websiteLink.replace(/^https?:\/\//, "").replace(/\/$/, "");
                  return (
                    <div
                      key={i}
                      style={{
                        opacity: o,
                        borderLeft: `4px solid ${accent}`,
                        paddingLeft: p ? 14 : 11,
                      }}
                    >
                      {label ? (
                        <div
                          style={{
                            fontFamily: MAG_SANS,
                            fontWeight: 800,
                            fontSize: Math.max(12, Math.round(deckPx * 0.76)),
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            color: text,
                            marginBottom: link ? 3 : 0,
                          }}
                        >
                          {label}
                        </div>
                      ) : null}
                      {link ? (
                        <div
                          style={{
                            fontFamily: MAG_SERIF,
                            fontSize: Math.max(11, Math.round(deckPx * 0.7)),
                            lineHeight: 1.3,
                            color: hexToRgba(text, 0.74),
                            wordBreak: "break-word",
                          }}
                        >
                          {link}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {/* Newsstand barcode — same corner as the cover, closing the bookend. */}
        <div
          style={{
            position: "absolute",
            right: "7%",
            bottom: "4%",
            background: "#FFFFFF",
            padding: "6px 8px 4px",
            opacity: fineO,
            zIndex: 5,
          }}
        >
          <Barcode color="#111111" width={Math.round(cardW * 0.2)} height={Math.round(cardW * 0.065)} label="0 74820 09221" />
        </div>
      </div>
    </div>
  );

  return (
    <AbsoluteFill style={{ background: MAG_BACKDROP, fontFamily: fontFamily ?? MAG_SERIF, overflow: "hidden" }}>
      <AbsoluteFill style={{ filter: `blur(${deskBlur}px)`, transform: "scale(1.06)", opacity: backdropOpacity }}>
        <DeskBackdrop aspectRatio={props.aspectRatio} accent={accent} parallaxX={0} parallaxY={0} />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          transform: `translateX(${rackTX.toFixed(1)}px) scale(${rackScale.toFixed(4)})`,
          opacity: cardO * rackOpacity,
        }}
      >
        {/* Neighbours are landscape-only — portrait's 0.98-width card leaves no room. */}
        {!p ? (
          <>
            {neighbour(-1)}
            {neighbour(1)}
          </>
        ) : null}

        <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "relative", width: cardW, height: cardH }}>
            <PageThickness sheetInsetX="0px" sheetInsetY="0px" />
            {cardInner}
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
