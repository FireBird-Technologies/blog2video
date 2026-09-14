import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { SocialIcons } from "../../SocialIcons";
import { resolveCtas } from "../../../../utils/resolveCtas";
import { SceneLayoutProps } from "../types";
import { useAvailableHeight, useFitText } from "../components/useFitText";
import { Barcode, Halftone, Kicker, MAG_DISPLAY, MAG_SANS, MAG_SERIF, MAG_TEMPO, MagazinePage, Rule, hexToRgba, isPortrait, resolveMagColors, useReveal } from "../magazineStyle";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** ending_socials__v2 — an editorial subscription card tucked into the final spread. */
export const EndingSocialsV2: React.FC<SceneLayoutProps> = (props) => {
  const p = isPortrait(props.aspectRatio);
  const colors = resolveMagColors(props);
  const { bg, text, accent } = colors;
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const reveal = useReveal(2, 18);
  const title = (props.title || props.brandName || "Keep the story going").trim();
  const deck = (props.narration || "The next issue is already taking shape.").trim();
  const { titleFontSize, descriptionFontSize } = props;
  const titleTarget = titleFontSize ?? (p ? 100 : 88);
  const descriptionTarget = descriptionFontSize ?? (p ? 60 : 48);
  const { titleFontSizeIsUserSet, descriptionFontSizeIsUserSet } = props as SceneLayoutProps & {
    titleFontSizeIsUserSet?: boolean;
    descriptionFontSizeIsUserSet?: boolean;
  };

  /* ── Auto-fit ──────────────────────────────────────────────
     Use the same measured fitter and lock contract as the established template
     layouts. The title receives a bounded share of the left column; the deck
     receives the real space left beneath it. A Studio lock (or a stored manual
     scene size) pins minPx to targetPx, deliberately disabling shrink-to-fit. */
  const copyColumnRef = React.useRef<HTMLElement>(null);
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const deckRef = React.useRef<HTMLParagraphElement>(null);
  const titleAvailable = useAvailableHeight(
    titleRef,
    copyColumnRef,
    [title, deck, titleTarget, descriptionTarget, p],
  );
  const titleBudget = titleAvailable > 0 ? Math.max(1, Math.round(titleAvailable * 0.58)) : undefined;
  const { px: titlePx } = useFitText(
    titleRef,
    titleTarget,
    titleFontSizeIsUserSet ? titleTarget : Math.max(24, Math.round(titleTarget * 0.4)),
    [title, titleTarget, titleFontSizeIsUserSet, titleBudget, p],
    titleBudget,
  );
  const deckAvailable = useAvailableHeight(
    deckRef,
    copyColumnRef,
    [deck, descriptionTarget, titlePx, p],
  );
  const { px: bodyPx } = useFitText(
    deckRef,
    descriptionTarget,
    descriptionFontSizeIsUserSet ? descriptionTarget : Math.max(12, Math.round(descriptionTarget * 0.45)),
    [deck, descriptionTarget, descriptionFontSizeIsUserSet, titlePx, deckAvailable, p],
    deckAvailable || undefined,
  );
  const cards = resolveCtas(props).filter((card) => card.showWebsiteButton && (card.ctaButtonText.trim() || card.websiteLink));
  const cardX = interpolate(reveal, [0, 1], [p ? 0 : 90, 0]);

  // The insert finishes revealing at frame 20, remains fully readable for one
  // second, then the sheet hinges shut to expose a purpose-built back cover.
  const contentLoadedAt = Math.ceil((2 + 18) * MAG_TEMPO);
  const closeStart = contentLoadedAt + fps;
  const closeEnd = closeStart + Math.round(fps * 1.15);
  const pageTurn = interpolate(frame, [closeStart, closeEnd], [0, 1], {
    ...CLAMP,
    easing: Easing.inOut(Easing.cubic),
  });
  const insideOpacity = interpolate(pageTurn, [0.58, 0.84], [1, 0], CLAMP);
  const backCoverIn = interpolate(pageTurn, [0.38, 0.62], [0, 1], CLAMP);
  const backContentIn = interpolate(frame, [closeStart + Math.round(fps * 0.72), closeEnd + Math.round(fps * 0.42)], [0, 1], CLAMP);
  const backCardH = height * (p ? 0.84 : 0.88);
  const backCardW = Math.min(backCardH * 0.75, width * (p ? 0.86 : 0.58));
  const backBorder = Math.max(9, Math.round(backCardW * 0.025));
  const backTitlePx = Math.min(titlePx * (p ? 0.72 : 0.62), backCardW * 0.12);
  const backBodyPx = Math.min(bodyPx * (p ? 0.72 : 0.62), backCardW * 0.046);

  return (
    <AbsoluteFill style={{ background: "#14120E", overflow: "hidden", perspective: 1800 }}>
      {/* Closed back cover, revealed beneath the turning inside sheet. */}
      <AbsoluteFill style={{ zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", opacity: backCoverIn }}>
        <div
          style={{
            position: "relative",
            width: backCardW,
            height: backCardH,
            overflow: "hidden",
            background: text,
            color: bg,
            border: `${backBorder}px solid ${accent}`,
            boxShadow: "0 30px 80px rgba(0,0,0,.52), 12px 10px 0 rgba(255,255,255,.1)",
            transform: `scale(${0.94 + backCoverIn * 0.06})`,
          }}
        >
          <Halftone color={bg} opacity={0.055} gap={9} />
          <div style={{ position: "absolute", inset: Math.round(backBorder * .7), border: `${Math.max(2, Math.round(backBorder * .22))}px solid ${hexToRgba(bg, .82)}`, pointerEvents: "none" }} />
          <div
            style={{
              position: "absolute",
              inset: p ? "8% 9% 12%" : "8% 10% 12%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              opacity: backContentIn,
              transform: `translateY(${(1 - backContentIn) * 28}px)`,
            }}
          >
            <Kicker color={accent} size={Math.max(11, backBodyPx * .7)}>Back cover</Kicker>
            <h1 style={{ margin: "18px 0 0", width: "100%", fontFamily: MAG_DISPLAY, fontWeight: 900, fontSize: backTitlePx, lineHeight: .94, letterSpacing: "-.04em", textTransform: "uppercase", overflowWrap: "anywhere" }}>{title}</h1>
            <Rule color={accent} progress={backContentIn} thickness={3} width={p ? 96 : 128} style={{ margin: "24px 0" }} />
            {deck && <p style={{ margin: 0, maxWidth: "84%", fontFamily: MAG_SERIF, fontSize: backBodyPx, lineHeight: 1.42, fontStyle: "italic", color: hexToRgba(bg, .74) }}>{deck}</p>}
            {cards.length > 0 && (
              <div style={{ marginTop: p ? 28 : 24, display: "flex", flexDirection: p ? "column" : "row", flexWrap: "wrap", justifyContent: "center", gap: 12 }}>
                {cards.slice(0, 3).map((card, index) => (
                  <div key={index} style={{ background: accent, color: bg, padding: "12px 18px", minWidth: p ? 230 : 180 }}>
                    <div style={{ fontFamily: MAG_SANS, fontSize: Math.max(11, backBodyPx * .58), fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase" }}>{card.ctaButtonText || "Read more"}</div>
                    {card.websiteLink && <div style={{ marginTop: 5, fontFamily: MAG_SERIF, fontSize: Math.max(10, backBodyPx * .52), fontStyle: "italic", overflowWrap: "anywhere" }}>{card.websiteLink}</div>}
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: p ? 28 : 22 }}><SocialIcons socials={props.socials} accentColor={accent} textColor={bg} maxPerRow={p ? 3 : 6} fontFamily={MAG_SANS} aspectRatio={props.aspectRatio} labelFontSize={Math.max(11, backBodyPx * .56)} /></div>
          </div>
          <div style={{ position: "absolute", left: "50%", bottom: "4.5%", transform: "translateX(-50%)", background: bg, padding: 5, opacity: backContentIn }}><Barcode color={text} width={Math.round(backCardW * .22)} height={Math.round(backCardW * .06)} /></div>
        </div>
      </AbsoluteFill>

      {/* A short stack of paper leaves follows the content sheet. Their staggered
          hinges expose separate edges, creating the requested closing riffle. */}
      {[0, 1, 2, 3].map((index) => {
        const leafTurn = interpolate(
          pageTurn,
          [0.1 + index * 0.075, 0.68 + index * 0.075],
          [0, 1],
          CLAMP,
        );
        const leafOpacity = interpolate(leafTurn, [0.64, 0.92], [1, 0], CLAMP);
        return (
          <AbsoluteFill
            key={index}
            style={{
              zIndex: 3 + (3 - index),
              top: index * 2,
              bottom: index * 2,
              left: index * 2,
              right: index * 2,
              transformOrigin: "left center",
              transformStyle: "preserve-3d",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              opacity: leafOpacity,
              background: index % 2 === 0 ? "#F7F4EC" : "#EEE9DE",
              borderRight: `2px solid ${hexToRgba(accent, 0.34)}`,
              boxShadow: `${10 + index * 5}px 7px ${16 + index * 4}px rgba(0,0,0,.2)`,
              transform: `perspective(1800px) rotateY(${-108 * leafTurn}deg) translateZ(${-2 - index * 2}px)`,
            }}
          >
            <div style={{ position: "absolute", inset: 0, opacity: 0.18, background: `repeating-linear-gradient(0deg, transparent 0 34px, ${hexToRgba(text, .12)} 35px, transparent 36px)` }} />
            <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 10, background: "linear-gradient(to left, rgba(0,0,0,.14), transparent)" }} />
          </AbsoluteFill>
        );
      })}

      {/* Open final spread: hold for one second, then hinge closed like a page. */}
      <AbsoluteFill
        style={{
          zIndex: 10,
          transformOrigin: "left center",
          transformStyle: "preserve-3d",
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          opacity: insideOpacity,
          transform: `perspective(1800px) rotateY(${-112 * pageTurn}deg) translateZ(${pageTurn * 10}px)`,
          filter: pageTurn > 0 ? `drop-shadow(${Math.round(30 * pageTurn)}px 8px 28px rgba(0,0,0,.42))` : undefined,
        }}
      >
        <MagazinePage colors={colors} section={props.sectionLabel || "Final Page"} issue={props.issueLabel || "Subscriber Edition"} page={props.pageNumber} aspectRatio={props.aspectRatio} fontFamily={props.fontFamily} runningHeadFontSize={Math.max(10, bodyPx * .52)} cameraMove={props.cameraMove} lightChrome hidePrintTexture={p}>
      <div style={{ height: "100%", display: "flex", flexDirection: p ? "column" : "row", gap: p ? "3%" : "5%", alignItems: "stretch" }}>
        <section ref={copyColumnRef} style={{ flex: p ? "0 0 42%" : "1 1 52%", minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: p ? "2% 3%" : "3% 1% 3% 3%", position: "relative", overflow: "hidden" }}>
          <Halftone color={accent} opacity={0.045} gap={9} style={{ inset: "5% 18% 5% 0" }} />
          <Kicker color={accent} size={Math.max(13, bodyPx * .62)}>Until the next issue</Kicker>
          <Rule color={accent} progress={reveal} thickness={3} width={p ? 106 : 142} style={{ margin: "24px 0 28px" }} />
          <h1 ref={titleRef} style={{ margin: 0, maxWidth: "92%", minHeight: 0, overflow: "hidden", fontFamily: MAG_DISPLAY, fontWeight: 900, fontSize: titlePx, lineHeight: .94, letterSpacing: "-.045em", textTransform: "uppercase", color: text }}>{title}</h1>
          <p ref={deckRef} style={{ margin: "26px 0 0", maxWidth: p ? "92%" : "75%", minHeight: 0, overflow: "hidden", fontFamily: MAG_SERIF, fontSize: bodyPx, lineHeight: 1.5, fontStyle: "italic", color: hexToRgba(text, .68) }}>{deck}</p>
        </section>

        <section style={{ flex: p ? 1 : "0 0 39%", display: "flex", alignItems: "center", justifyContent: "center", padding: p ? "0 5% 3%" : "3% 4% 3% 0" }}>
          <div style={{ width: "100%", maxWidth: p ? 760 : 600, minHeight: p ? 510 : 650, boxSizing: "border-box", position: "relative", background: accent, color: bg, padding: p ? "7% 7% 6%" : "54px 48px 42px", boxShadow: "14px 18px 0 rgba(0,0,0,.08)", transform: `translateX(${cardX}px) rotate(${p ? -1 : 1.5}deg)`, border: `1px solid ${hexToRgba(text, .12)}` }}>
            <div style={{ position: "absolute", left: -7, top: 0, bottom: 0, borderLeft: `14px dotted ${bg}`, opacity: .85 }} />
            <div style={{ fontFamily: MAG_SANS, fontSize: Math.max(11, bodyPx * .52), fontWeight: 800, letterSpacing: ".25em", textTransform: "uppercase" }}>Detach &amp; keep</div>
            <div style={{ borderTop: `2px solid ${bg}`, margin: "18px 0 26px" }} />
            <div style={{ fontFamily: MAG_DISPLAY, fontSize: titlePx * .52, fontWeight: 900, lineHeight: .95, textTransform: "uppercase" }}>Your next<br />chapter starts here.</div>
            {cards.length > 0 && <div style={{ marginTop: 30, display: "flex", flexDirection: "column", gap: 16 }}>{cards.slice(0, 3).map((card, index) => <div key={index} style={{ background: bg, color: text, padding: "15px 18px" }}><div style={{ fontFamily: MAG_SANS, fontSize: Math.max(12, bodyPx * .62), fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase" }}>{card.ctaButtonText || "Read more"}</div>{card.websiteLink && <div style={{ marginTop: 5, fontFamily: MAG_SERIF, fontSize: Math.max(12, bodyPx * .58), fontStyle: "italic", color: hexToRgba(text, .65), overflowWrap: "anywhere" }}>{card.websiteLink}</div>}</div>)}</div>}
            <div style={{ marginTop: 28 }}><SocialIcons socials={props.socials} accentColor={bg} textColor={bg} maxPerRow={p ? 4 : 3} fontFamily={MAG_SANS} aspectRatio={props.aspectRatio} labelFontSize={Math.max(12, bodyPx * .6)} /></div>
            <div style={{ marginTop: 28, display: "flex", justifyContent: "flex-end" }}><div style={{ background: bg, padding: 5 }}><Barcode color={text} width={100} height={30} /></div></div>
          </div>
        </section>
      </div>
        </MagazinePage>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
