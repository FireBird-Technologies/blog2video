import React from "react";
import { AbsoluteFill, Easing, interpolate, useVideoConfig } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  Barcode,
  CropMarks,
  DeskBackdrop,
  Halftone,
  MAG_BACKDROP,
  MAG_DISPLAY,
  MAG_SANS,
  MAG_SERIF,
  OptionalImg,
  PageThickness,
  hexToRgba,
  isPortrait,
  resolveMagColors,
  useMagDims,
  useMagFrame,
  useReveal,
  useFitText,
} from "../magazineStyle";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** magazine_cover__v2 — a layered newsstand stack with the lead issue pulled forward. */
export const MagazineCoverV2: React.FC<SceneLayoutProps> = (props) => {
  const { titleFontSizeIsUserSet, descriptionFontSizeIsUserSet } = props as SceneLayoutProps & {
    titleFontSizeIsUserSet?: boolean;
    descriptionFontSizeIsUserSet?: boolean;
  };
  const p = isPortrait(props.aspectRatio);
  const colors = resolveMagColors(props);
  const { bg, text, accent } = colors;
  const { width, height } = useMagDims();
  const { fps } = useVideoConfig();
  const frame = useMagFrame();
  const reveal = useReveal(2, 18);
  const title = (props.title || "The New Perspective").trim();
  const deck = (props.narration || "Stories, people and ideas defining what comes next.").trim();
  const byline = String(props.byline ?? "The Editors").replace(/^by\s+/i, "").trim();
  const section = (props.sectionLabel ?? "Feature").trim();
  const newsstandLabel = (props.newsstandLabel ?? "On the newsstand").trim();
  const leadStoryText = String(props.leadStoryText ?? "One lead story.").trim();
  const editionText = String(props.editionText ?? "A whole edition.").trim();
  const titleTarget = props.titleFontSize ?? (p ? 100 : 96);
  const bodyPx = props.descriptionFontSize ?? (p ? 44 : 34);

  const aspect = 0.75;
  let cardH = height * (p ? 0.74 : 0.86);
  let cardW = cardH * aspect;
  const maxW = width * (p ? 0.78 : 0.42);
  if (cardW > maxW) {
    cardW = maxW;
    cardH = cardW / aspect;
  }
  const travel = interpolate(frame, [0, 34], [p ? height * 0.08 : width * 0.05, 0], { ...CLAMP, easing: Easing.out(Easing.cubic) });
  const zoom = interpolate(frame, [0, fps * 5], [1.055, 1], CLAMP);
  const outer = Math.max(12, Math.round(cardW * 0.035));
  const hasMedia = Boolean(props.imageUrl || props.videoUrl);

  /* ── Auto-fit ──────────────────────────────────────────────
     Title and deck (rendered twice — once on the main card, once again in
     the editorial aside, both mounted simultaneously) render in full
     immediately, only the whole scene reveals via opacity — direct refs are
     safe. Title previously only had a manual Math.min(titlePx, cardW*0.17)
     clamp (caps, doesn't DOM-measure/shrink); useFitText's own maxPx acts as
     that same ceiling now, so the clamp is redundant and removed. Deck's two
     instances are independently fitted since they sit in differently-sized
     boxes (cardW*0.57 vs a fixed 430px aside).

     A titleFontSize locked on the BASE magazine_cover (a very differently
     proportioned card) carries over verbatim when a scene switches to this
     __v2 variant — variants deliberately share the base's raw prop values.
     That left titles stuck at whatever tiny size was locked in for the base
     layout's card shape, with no way for this card's own much larger budget
     to ever kick in. Clamp the effective target (and, when locked, the fit
     floor) to a sensible fraction of THIS card's height so the title always
     reads as a cover headline here, regardless of what was locked upstream. */
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const deckRef = React.useRef<HTMLParagraphElement>(null);
  const asideDeckRef = React.useRef<HTMLParagraphElement>(null);
  const titleMinForCard = Math.round(cardH * 0.075);
  const effectiveTitleTarget = Math.max(titleTarget, titleMinForCard);
  const titlePx = useFitText(
    titleRef,
    effectiveTitleTarget,
    titleFontSizeIsUserSet ? effectiveTitleTarget : 24,
    1,
    [title, effectiveTitleTarget, titleFontSizeIsUserSet, p, cardW],
    titleFontSizeIsUserSet ? effectiveTitleTarget : Math.round(cardH * 0.13),
  );
  const deckPx = useFitText(
    deckRef,
    bodyPx,
    descriptionFontSizeIsUserSet ? bodyPx : 12,
    1,
    [deck, bodyPx, descriptionFontSizeIsUserSet, p, cardW],
    descriptionFontSizeIsUserSet ? bodyPx : Math.round(cardH * 0.16),
  );
  const asideDeckPx = useFitText(
    asideDeckRef,
    bodyPx,
    descriptionFontSizeIsUserSet ? bodyPx : 12,
    1,
    [deck, bodyPx, descriptionFontSizeIsUserSet, p, height],
    descriptionFontSizeIsUserSet ? bodyPx : p ? Math.round(height * 0.075) : undefined,
  );

  const ghostIssue = (offsetX: number, offsetY: number, rotate: number, tone: string, label: string) => (
    <div style={{ position: "absolute", width: cardW, height: cardH, transform: `translate(${offsetX}px, ${offsetY}px) rotate(${rotate}deg)`, background: tone, boxShadow: "0 18px 42px rgba(0,0,0,.3)", overflow: "hidden" }}>
      <CropMarks color={accent} inset={outer} opacity={0.32} />
      <div style={{ position: "absolute", left: outer * 1.5, right: outer * 1.5, top: outer * 1.6, borderTop: `2px solid ${accent}` }} />
      <div style={{ position: "absolute", left: outer * 1.5, top: outer * 2.1, fontFamily: MAG_DISPLAY, fontWeight: 900, fontSize: cardW * 0.13, textTransform: "uppercase", color: bg }}>{label}</div>
      <Halftone color={bg} opacity={0.06} gap={9} />
    </div>
  );

  return (
    <AbsoluteFill style={{ background: MAG_BACKDROP, overflow: "hidden", fontFamily: props.fontFamily || MAG_SERIF }}>
      <DeskBackdrop aspectRatio={props.aspectRatio} accent={accent} />
      <div style={{ position: "absolute", zIndex: 10, left: p ? "50%" : "14%", top: p ? "8%" : "50%", transform: p ? "translateX(-50%)" : "translateY(-50%)", width: cardW, height: cardH, opacity: reveal }}>
        {ghostIssue(-cardW * 0.16, cardH * 0.045, -7, "#56483d", "Review")}
        {ghostIssue(cardW * 0.16, cardH * 0.025, 6, "#302c29", "Journal")}
      </div>

      <div style={{ position: "absolute", zIndex: 20, left: p ? "50%" : "36%", top: p ? "11%" : "50%", width: cardW, height: cardH, transform: `${p ? "translateX(-50%)" : "translateY(-50%)"} translateX(${travel}px) scale(${zoom})`, opacity: reveal }}>
        <PageThickness sheetInsetX="0px" sheetInsetY="0px" layers={5} />
        <div style={{ position: "absolute", inset: 0, zIndex: 8, overflow: "hidden", color: bg, background: text, boxShadow: "0 22px 62px rgba(0,0,0,.48)" }}>
          {hasMedia ? (
            <OptionalImg
              src={props.imageUrl}
              videoUrl={props.videoUrl}
              videoMuted={props.videoMuted}
              videoVolume={props.videoVolume}
              videoDurationInFrames={props.videoDurationInFrames}
              videoStartInFrames={props.videoStartInFrames}
              imageObjectPosition={props.imageObjectPosition}
              imageZoom={props.imageZoom}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom})` }}
            />
          ) : (
            <Halftone color={bg} opacity={0.08} gap={8} />
          )}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.58) 0%, rgba(0,0,0,.02) 42%, rgba(0,0,0,.82) 100%)" }} />
          <div style={{ position: "absolute", inset: outer, border: `${Math.max(5, Math.round(cardW * 0.012))}px solid ${accent}` }} />
          <div style={{ position: "absolute", left: outer * 1.8, right: outer * 1.8, top: outer * 1.6, display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: MAG_SANS, fontSize: Math.max(10, bodyPx * 0.55), fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase" }}>
            <span>{section}</span><span>{props.issueLabel || "No. 01"}</span>
          </div>
          <div style={{ position: "absolute", left: outer * 1.8, right: outer * 1.8, top: cardH * 0.11, borderTop: `2px solid ${accent}`, opacity: reveal }} />
          <h1 ref={titleRef} style={{ position: "absolute", left: outer * 1.65, right: outer * 1.65, top: cardH * 0.13, margin: 0, fontFamily: MAG_DISPLAY, fontWeight: 900, fontSize: titlePx, lineHeight: .9, letterSpacing: "-.055em", textTransform: "uppercase", overflowWrap: "break-word" }}>{title}</h1>
          <div style={{ position: "absolute", left: outer * 1.8, right: outer * 1.8, bottom: cardH * 0.075, display: "grid", gridTemplateColumns: "1fr auto", gap: 18, alignItems: "end" }}>
            <div>
              <div style={{ width: 62, borderTop: `4px solid ${accent}`, marginBottom: 13 }} />
              <p ref={deckRef} style={{ margin: 0, maxWidth: cardW * 0.57, fontFamily: MAG_SERIF, fontSize: deckPx, lineHeight: 1.35, fontStyle: "italic" }}>{deck}</p>
              {byline && <div style={{ marginTop: 12, fontFamily: MAG_SANS, fontSize: Math.max(10, bodyPx * .55), fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: hexToRgba(bg, .75) }}>By {byline}</div>}
            </div>
            <div style={{ background: bg, padding: 5 }}><Barcode color={text} width={Math.round(cardW * .17)} height={Math.round(cardW * .05)} /></div>
          </div>
        </div>
      </div>

      <aside
        style={{
          position: "absolute",
          zIndex: 30,
          left: p ? "9%" : "74%",
          right: p ? "9%" : "5%",
          top: p ? "71%" : "22%",
          bottom: p ? "4%" : "18%",
          background: MAG_BACKDROP,
          color: bg,
          opacity: reveal,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          textAlign: p ? "center" : "left",
          alignItems: p ? "center" : "stretch",
        }}
      >
          {newsstandLabel && <div style={{ fontFamily: MAG_SANS, color: accent, fontWeight: 800, letterSpacing: ".28em", textTransform: "uppercase", fontSize: Math.max(13, bodyPx * .7) }}>{newsstandLabel}</div>}
          <div style={{ borderTop: `1px solid ${hexToRgba(bg, .38)}`, margin: p ? "16px 0" : "22px 0", width: "100%" }} />
          <div style={{ fontFamily: MAG_DISPLAY, fontSize: titleTarget * .56, lineHeight: 1.05, fontWeight: 800 }}>{leadStoryText}<br /><em style={{ color: accent }}>{editionText}</em></div>
          <p ref={asideDeckRef} style={{ margin: p ? "14px 0 0" : undefined, fontFamily: MAG_SERIF, fontSize: asideDeckPx, lineHeight: p ? 1.35 : 1.55, color: hexToRgba(bg, .7), maxWidth: p ? width * .78 : 430 }}>{deck}</p>
      </aside>
    </AbsoluteFill>
  );
};
