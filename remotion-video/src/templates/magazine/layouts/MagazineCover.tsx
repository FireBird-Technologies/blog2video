import React from "react";
import { AbsoluteFill, Img, useVideoConfig, interpolate, Easing } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  MAG_DISPLAY,
  MAG_SERIF,
  MAG_SANS,
  MAG_BACKDROP,
  Barcode,
  Halftone,
  DeskBackdrop,
  PageThickness,
  resolveMagColors,
  isPortrait,
  useReveal,
  hexToRgba,
  useMagFrame,
} from "../magazineStyle";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const EASE_OUT = Easing.out(Easing.cubic);

/**
 * Hero cover — a portrait magazine BOOKLET picked up off a table and zoomed into
 * the centre of the frame, à la a TIME 100 cover. The cover keeps a tall 3:4
 * portrait shape (never stretched to the canvas), sits large and centred with the
 * table BLURRED behind it (depth-of-field), and stays sharp. A thick red border
 * frames the cover: the scene TITLE is the heavy display masthead across the top
 * (where "TIME" sits), a full-bleed cover photo behind it, and the cover-line
 * block bottom-left carries the kicker + NARRATION deck + byline. When no photo is
 * supplied it renders the same framed cover over clean paper (oversized ghost
 * initial) so the hero always reads as a magazine cover.
 */
export const MagazineCover: React.FC<SceneLayoutProps> = (props) => {
  const { title, narration, imageUrl, imageObjectPosition, imageZoom, titleFontSize, descriptionFontSize, fontFamily } = props;
  const brand = (props.brandName ?? "").trim();
  const kicker = (props.sectionLabel || "Feature").trim();
  const deck = (narration ?? "").trim();
  const titleText = (title ?? "").trim();

  const p = isPortrait(props.aspectRatio);
  const { bg, text, accent } = resolveMagColors(props);
  const frame = useMagFrame();
  const { fps, width, height } = useVideoConfig();

  const establishing = props.establishingShot ?? props.pageNumber === "01";

  const [imgFailed, setImgFailed] = React.useState(false);
  React.useEffect(() => { setImgFailed(false); }, [imageUrl]);
  const showPhoto = !!imageUrl && !imgFailed;
  const onImg = "#FFFFFF";
  const mastheadCol = showPhoto ? onImg : accent;
  const coverTextCol = showPhoto ? onImg : text;
  const brandInitial = (titleText || brand || "").charAt(0).toUpperCase();

  // ---- Geometry: a large, centred 3:4 portrait booklet. Fills most of the
  // frame height, leaving the blurred desk visible to the sides (a real magazine
  // shape, never stretched to the canvas aspect).
  const cardAspect = 0.75; // w / h
  // Sized to leave a clear margin on every side so the booklet never clips and
  // reads as a centred object on the desk (not edge-to-edge).
  let cardH = height * (p ? 0.82 : 0.72);
  let cardW = cardH * cardAspect;
  const maxCardW = width * (p ? 0.82 : 0.5);
  if (cardW > maxCardW) {
    cardW = maxCardW;
    cardH = cardW / cardAspect;
  }
  const outer = Math.round(cardW * 0.035); // white margin inside the card
  const border = Math.round(cardW * 0.022); // red frame thickness
  // Right-hand gutter the bottom cover-lines must keep clear of the newsstand
  // barcode (bottom-right) so no text is ever overprinted by it.
  const barcodeClearW = Math.round(cardW * 0.26);

  // ---- Masthead (title) sizing — wraps between words, each word fits the cover.
  const mastInnerW = cardW - 2 * outer - 2 * border;
  const words = titleText.split(/\s+/).filter(Boolean);
  const longestWord = words.length ? Math.max(...words.map((w) => w.length)) : 1;
  const mastheadPx = Math.min(titleFontSize ?? (p ? 92 : 62), (mastInnerW * 0.92) / Math.max(1, longestWord * 0.6));
  const deckPx = descriptionFontSize ?? (p ? 16 : 19);

  // ---- Reveals: masthead first, then the cover-line block cascades in.
  const imgScale = interpolate(frame, [0, fps * 5], [1.06, 1.0], CLAMP);
  const wordmarkO = useReveal(6, 14);
  const frameP = useReveal(2, 14);
  const cardO = useReveal(0, 14);

  const wStart = 14;
  const wStagger = Math.max(2, Math.round(fps * 0.07));
  const wDur = Math.round(fps * 0.3);
  const lastEnd = wStart + Math.max(0, words.length - 1) * wStagger + wDur;

  const kickerO = interpolate(frame, [lastEnd - 4, lastEnd + 10], [0, 1], CLAMP);
  const ruleP = interpolate(frame, [lastEnd + 14, lastEnd + 28], [0, 1], CLAMP);
  const deckO = interpolate(frame, [lastEnd + 22, lastEnd + 40], [0, 1], CLAMP);
  const bylineO = interpolate(frame, [lastEnd + 30, lastEnd + 46], [0, 1], CLAMP);

  // ---- Establishing fade (root only). The magazine stays sharp; the desk blur
  // supplies the depth-of-field as the cover is picked up and zoomed in.
  const entryFade = establishing ? interpolate(frame, [0, 12], [0, 1], CLAMP) : 1;
  const deskBlur = Math.round(width * 0.012);

  // ---- Hero entrance: the magazine starts LYING FLAT on the desk (hinged on its
  // bottom edge, tilted back away from the camera) and is RAISED upright into a
  // dead-centre, camera-facing rest pose, coming forward (scaling up) as it lifts.
  // The hinge sits on the BOTTOM edge (transformOrigin 50% 100%, set on the
  // wrapper) so only the top edge arcs up — the bottom stays pinned and can never
  // sweep off-canvas, so it cannot clip.
  const enterFrames = establishing ? 46 : 26;
  const e = interpolate(frame, [0, enterFrames], [0, 1], { ...CLAMP, easing: EASE_OUT });
  const enterRotX = interpolate(e, [0, 1], [78, 0]);            // lying flat → standing upright
  const enterScale = interpolate(e, [0, 1], [0.82, 1]);         // comes forward toward the camera
  const enterTY = interpolate(e, [0, 1], [height * 0.05, 0]);   // lifts off the desk
  const cardTransform = `perspective(1700px) translateY(${enterTY.toFixed(1)}px) rotateX(${enterRotX.toFixed(2)}deg) scale(${enterScale.toFixed(4)})`;

  const cardInner = (
    <div style={{ position: "absolute", inset: 0, zIndex: 10, background: bg, overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.5), 0 8px 22px rgba(0,0,0,0.3)" }}>
      {/* Red frame */}
      <div style={{ position: "absolute", inset: outer, border: `${border}px solid ${accent}`, overflow: "hidden", background: bg }}>
        {/* Paper base — ALWAYS rendered so the cover is never blank, even if no
            photo is supplied or the photo fails to load. */}
        <div style={{ position: "absolute", inset: 0, background: bg }} />
        <Halftone color={text} opacity={0.06} gap={9} />
        {!showPhoto && brandInitial ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: MAG_DISPLAY,
              fontWeight: 900,
              fontSize: cardW * 1.1,
              lineHeight: 1,
              color: hexToRgba(accent, 0.06),
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            {brandInitial}
          </div>
        ) : null}

        {/* Cover photo on top of the paper base. A broken/missing URL falls back
            to the paper cover (onError) instead of blanking the whole scene. */}
        {showPhoto ? (
          <>
            <Img
              src={imageUrl as string}
              onError={() => setImgFailed(true)}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: imageObjectPosition ?? "50% 50%",
                transform: `scale(${(imageZoom ?? 1) * imgScale})`,
              }}
            />
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "30%", background: "linear-gradient(to bottom, rgba(0,0,0,0.32), transparent)" }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "58%", background: "linear-gradient(to top, rgba(0,0,0,0.68), rgba(0,0,0,0.18) 55%, transparent)" }} />
          </>
        ) : null}

        {/* Thin white inner frame — the hairline rule the real TIME cover keeps
            between the red border and the photograph. */}
        <div
          style={{
            position: "absolute",
            inset: Math.round(border * 0.55),
            border: `${Math.max(2, Math.round(border * 0.34))}px solid #FFFFFF`,
            pointerEvents: "none",
            zIndex: 2,
          }}
        />

        {/* Masthead wordmark = the scene title, word-by-word reveal. */}
        {titleText ? (
          <h1
            style={{
              position: "absolute",
              top: "3.5%",
              left: "5%",
              right: "5%",
              margin: 0,
              textAlign: "center",
              fontFamily: MAG_DISPLAY,
              fontWeight: 900,
              fontSize: mastheadPx,
              lineHeight: 0.92,
              letterSpacing: "-0.01em",
              color: mastheadCol,
              textTransform: "uppercase",
              textShadow: showPhoto ? "0 2px 18px rgba(0,0,0,0.4)" : "none",
            }}
          >
            {words.map((w, i) => {
              const s = wStart + i * wStagger;
              const o = interpolate(frame, [s, s + wDur], [0, 1], CLAMP);
              const y = interpolate(frame, [s, s + wDur], [18, 0], CLAMP);
              return (
                <span key={i} style={{ display: "inline-block", opacity: o, transform: `translateY(${y}px)`, marginRight: mastheadPx * 0.18 }}>
                  {w}
                </span>
              );
            })}
          </h1>
        ) : null}

        {/* Hairline under the masthead — the fine newsstand rule. Sits low
            enough to clear a two-line masthead. */}
        <div
          style={{
            position: "absolute",
            top: "25%",
            left: "8%",
            right: "8%",
            height: 2,
            background: showPhoto ? hexToRgba(onImg, 0.55) : hexToRgba(text, 0.25),
            opacity: wordmarkO,
            transformOrigin: "center",
            transform: `scaleX(${frameP})`,
          }}
        />

        {/* Cover-line block — bottom-left (the editorial text, on the cover). The
            bottom lines reserve a right gutter so they never run under the
            barcode in the bottom-right corner. */}
        <div style={{ position: "absolute", left: "8%", right: "8%", bottom: "8%" }}>
          {kicker ? (
            <div
              style={{
                opacity: kickerO,
                fontFamily: MAG_SANS,
                fontWeight: 800,
                fontSize: Math.max(12, cardW * 0.03),
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: showPhoto ? onImg : accent,
                marginBottom: cardW * 0.022,
              }}
            >
              {kicker}
            </div>
          ) : null}

          <div style={{ width: cardW * 0.16, height: 4, background: accent, margin: `${cardW * 0.026}px 0`, transformOrigin: "left center", transform: `scaleX(${ruleP})` }} />

          {deck ? (
            <div
              style={{
                opacity: deckO,
                fontFamily: MAG_SERIF,
                fontStyle: "italic",
                fontWeight: 500,
                fontSize: deckPx,
                lineHeight: 1.35,
                color: coverTextCol,
                paddingRight: barcodeClearW,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                textShadow: showPhoto ? "0 1px 10px rgba(0,0,0,0.4)" : "none",
              }}
            >
              {deck}
            </div>
          ) : null}

          {brand ? (
            <div
              style={{
                marginTop: cardW * 0.022,
                opacity: bylineO,
                fontFamily: MAG_SANS,
                fontWeight: 700,
                fontSize: Math.max(11, cardW * 0.024),
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: showPhoto ? hexToRgba(onImg, 0.85) : hexToRgba(text, 0.6),
                paddingRight: barcodeClearW,
              }}
            >
              By {brand}
            </div>
          ) : null}
        </div>

        {/* Newsstand barcode — bottom-right corner of the cover. */}
        <div
          style={{
            position: "absolute",
            right: "7%",
            bottom: "4%",
            background: "#FFFFFF",
            padding: "6px 8px 4px",
            opacity: bylineO,
            boxShadow: showPhoto ? "0 4px 14px rgba(0,0,0,0.22)" : "none",
          }}
        >
          <Barcode color="#111111" width={Math.round(cardW * 0.2)} height={Math.round(cardW * 0.065)} label="0 74820 09221" />
        </div>
      </div>
    </div>
  );

  return (
    <AbsoluteFill style={{ background: MAG_BACKDROP, fontFamily: fontFamily ?? MAG_SERIF, overflow: "hidden", opacity: entryFade }}>
      {/* Blurred table behind the magazine — static (no parallax / no camera
          zoom) so the heavy blur raster doesn't re-paint every frame. */}
      <AbsoluteFill style={{ filter: `blur(${deskBlur}px)`, transform: "scale(1.06)" }}>
        <DeskBackdrop aspectRatio={props.aspectRatio} accent={accent} parallaxX={0} parallaxY={0} />
      </AbsoluteFill>

      {/* The magazine — a flat, centred portrait card that zooms in (2D only) and
          holds dead-centre. Stays sharp; the desk blur supplies the depth. */}
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            position: "relative",
            width: cardW,
            height: cardH,
            opacity: cardO,
            transform: cardTransform,
            transformOrigin: "50% 100%",
          }}
        >
          {/* Page block under the cover gives it a subtle physical edge. */}
          <PageThickness sheetInsetX="0px" sheetInsetY="0px" />
          {cardInner}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
