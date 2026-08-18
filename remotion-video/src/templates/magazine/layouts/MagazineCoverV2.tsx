import React from "react";
import { AbsoluteFill, useVideoConfig, interpolate, Easing } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  MAG_DISPLAY,
  MAG_SERIF,
  MAG_SANS,
  MAG_BACKDROP,
  Barcode,
  Halftone,
  DeskBackdrop,
  OptionalImg,
  PageThickness,
  resolveMagColors,
  isPortrait,
  useReveal,
  hexToRgba,
  useMagFrame,
  useMagDims,
} from "../magazineStyle";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const EASE_OUT = Easing.out(Easing.cubic);

/**
 * MagazineCoverV2 — "Newsstand"
 *
 * Variant of `magazine_cover`. Same props, different composition.
 *
 * Base raises a single booklet upright off a blurred desk (rotateX 78°→0) with a
 * centred masthead over a hairline rule. This one changes the SHOT rather than the
 * object: the issue sits face-on in a newsstand RACK, flanked by two dimmed,
 * frame-clipped sibling covers, and the camera finds it with a lateral slide that
 * decelerates into dead centre — no raise, no hinge.
 *
 * Inside the cover the masthead is re-set LEFT-aligned against a full-height red
 * spine bar, replacing the base's centred masthead + hairline.
 *
 * The card geometry (3:4 aspect, the same cardH/maxCardW clamp) is deliberately
 * IDENTICAL to the base so `coverBox()` in magazineImageBoxDims.ts stays correct
 * for both — this variant needs no image-box entry of its own.
 *
 * The palette inversion (black cover, white type) is the cover's signature and is
 * kept: `bg = resolved.text`, `text = resolved.bg`.
 */
export const MagazineCoverV2: React.FC<SceneLayoutProps> = (props) => {
  const {
    title,
    narration,
    imageUrl,
    videoUrl,
    videoMuted,
    videoVolume,
    videoDurationInFrames,
    videoStartInFrames,
    imageObjectPosition,
    imageZoom,
    titleFontSize,
    descriptionFontSize,
    fontFamily,
  } = props;

  const brand = ((props.byline as string) ?? "").trim().replace(/^by\s+/i, "");
  const kicker = (props.sectionLabel || "Feature").trim();
  const deck = (narration ?? "").trim();
  const titleText = (title ?? "").trim();

  const p = isPortrait(props.aspectRatio);
  // Hero inversion — same as the base: black cover with white type, red frame.
  const resolved = resolveMagColors(props);
  const bg = resolved.text;
  const text = resolved.bg;
  const accent = resolved.accent;

  const frame = useMagFrame();
  const { fps } = useVideoConfig();
  const { width, height } = useMagDims();

  const establishing = props.establishingShot ?? props.pageNumber === "01";

  const [imgFailed, setImgFailed] = React.useState(false);
  React.useEffect(() => { setImgFailed(false); }, [imageUrl]);
  const showPhoto = !!(imageUrl || props.videoUrl) && !imgFailed;
  const onImg = "#FFFFFF";
  const mastheadCol = text;
  const coverTextCol = showPhoto ? onImg : text;
  const brandInitial = (titleText || brand || "").charAt(0).toUpperCase();

  // ---- Geometry: unchanged from the base, so the image box stays valid.
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
  const barcodeClearW = Math.round(cardW * 0.26);

  // The red spine bar down the cover's left edge — this variant's structural mark.
  const spineW = Math.round(cardW * 0.085);

  // ---- Masthead sizing. Same auto-fit machinery as the base (it is load-bearing
  // for arbitrary title lengths), with the inner width reduced by the spine bar and
  // the text left-aligned instead of centred.
  const mastInnerW = cardW - 2 * outer - 2 * border - spineW;
  const words = titleText.split(/\s+/).filter(Boolean);
  const longestWord = words.length ? Math.max(...words.map((w) => w.length)) : 1;
  const basePx = p ? 92 : 62;
  const widthCapPx = (mastInnerW * 0.92) / Math.max(1, longestWord * 0.72);
  const mastLineHeight = 1.12;
  const mastBandH = cardH * 0.205;
  const avgCharW = 0.72;
  const usableW = mastInnerW * 0.94; // left-aligned, so only a small right inset
  const estLinesAt = (px: number) => {
    const perLine = Math.max(1, Math.floor(usableW / (px * avgCharW)));
    const totalChars = titleText.replace(/\s+/g, " ").length || 1;
    return Math.max(words.length > 1 ? 2 : 1, Math.ceil(totalChars / perLine));
  };
  let autoFitPx = Math.min(basePx, widthCapPx);
  for (let i = 0; i < 24; i++) {
    const lines = estLinesAt(autoFitPx);
    if (lines * autoFitPx * mastLineHeight <= mastBandH) break;
    autoFitPx *= 0.94;
  }
  autoFitPx = Math.max(14, autoFitPx);
  const safetyMaxPx = Math.min(widthCapPx, (cardH * 0.5) / mastLineHeight);
  const mastheadPx =
    titleFontSize != null ? Math.max(14, Math.min(titleFontSize, safetyMaxPx)) : autoFitPx;
  const deckPx = descriptionFontSize ?? (p ? 16 : 19);

  // ---- Reveals
  const imgScale = interpolate(frame, [0, fps * 5], [1.06, 1.0], CLAMP);
  const wordmarkO = useReveal(6, 14);
  const cardO = useReveal(0, 12);

  const wStart = 14;
  const wStagger = Math.max(2, Math.round(fps * 0.07));
  const wDur = Math.round(fps * 0.3);
  const lastEnd = wStart + Math.max(0, words.length - 1) * wStagger + wDur;

  const kickerO = interpolate(frame, [lastEnd - 4, lastEnd + 10], [0, 1], CLAMP);
  const ruleP = interpolate(frame, [lastEnd + 14, lastEnd + 28], [0, 1], CLAMP);
  const deckO = interpolate(frame, [lastEnd + 22, lastEnd + 40], [0, 1], CLAMP);
  const bylineO = interpolate(frame, [lastEnd + 30, lastEnd + 46], [0, 1], CLAMP);
  const spineP = useReveal(3, 16);

  const entryFade = establishing ? interpolate(frame, [0, 12], [0, 1], CLAMP) : 1;
  const deskBlur = Math.round(width * 0.012);

  // ---- The rack slide. The whole rack drifts right-to-left and decelerates so the
  // hero card lands dead centre: the camera finding the issue on the shelf, rather
  // than the base's pick-up-and-raise.
  const enterFrames = establishing ? 52 : 30;
  const e = interpolate(frame, [0, enterFrames], [0, 1], { ...CLAMP, easing: EASE_OUT });
  const rackTX = interpolate(e, [0, 1], [width * 0.34, 0]);
  // A whisper of settle-back so it reads as physical rather than a linear slide.
  const rackScale = interpolate(e, [0, 0.75, 1], [1.1, 1.02, 1.0], CLAMP);

  /** A dimmed sibling issue peeking in from one side, behind the hero. */
  const neighbour = (side: -1 | 1) => (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        width: cardW,
        height: cardH,
        // Sits just outboard of the hero and slightly lower, as racked issues do.
        transform: `translate(-50%, -50%) translateX(${side * cardW * 0.78}px) translateY(${cardH * 0.02}px) scale(0.86)`,
        background: bg,
        border: `${Math.max(2, Math.round(border * 0.5))}px solid ${hexToRgba(accent, 0.55)}`,
        filter: "brightness(0.45) blur(2px)",
        boxShadow: "0 8px 22px rgba(0,0,0,0.5)",
        overflow: "hidden",
      }}
    >
      <Halftone color={text} opacity={0.05} gap={9} />
      {/* A suggestion of a masthead so the neighbour reads as a magazine, not a slab. */}
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
      {/* Red frame */}
      <div style={{ position: "absolute", inset: outer, border: `${border}px solid ${accent}`, overflow: "hidden", background: bg }}>
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

        {showPhoto ? (
          <>
            <OptionalImg
              src={imageUrl as string}
              videoUrl={videoUrl}
              videoMuted={videoMuted}
              videoVolume={videoVolume}
              videoDurationInFrames={videoDurationInFrames}
              videoStartInFrames={videoStartInFrames}
              imageObjectPosition={imageObjectPosition}
              imageZoom={imageZoom}
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
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "34%", background: "linear-gradient(to bottom, rgba(0,0,0,0.42), transparent)" }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "58%", background: "linear-gradient(to top, rgba(0,0,0,0.68), rgba(0,0,0,0.18) 55%, transparent)" }} />
          </>
        ) : null}

        {/* Thin white inner frame — kept from the base. */}
        <div
          style={{
            position: "absolute",
            inset: Math.round(border * 0.55),
            border: `${Math.max(2, Math.round(border * 0.34))}px solid #FFFFFF`,
            pointerEvents: "none",
            zIndex: 2,
          }}
        />

        {/* ── The red spine bar: this variant's structural mark, replacing the
               base's centred masthead + hairline rule. Grows down from the top. ── */}
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
          {/* Issue label running up the bar. */}
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
              opacity: wordmarkO,
              whiteSpace: "nowrap",
            }}
          >
            {(props.issueLabel as string) ?? kicker}
          </div>
        </div>

        {/* Masthead — LEFT-aligned, clear of the spine bar. */}
        {titleText ? (
          <h1
            style={{
              position: "absolute",
              top: "3.5%",
              left: spineW + Math.round(cardW * 0.045),
              right: "5%",
              margin: 0,
              textAlign: "left",
              fontFamily: MAG_DISPLAY,
              fontWeight: 900,
              fontSize: mastheadPx,
              lineHeight: mastLineHeight,
              letterSpacing: "-0.01em",
              overflowWrap: "break-word",
              color: mastheadCol,
              textTransform: "uppercase",
              textShadow: showPhoto ? "0 2px 18px rgba(0,0,0,0.4)" : "none",
              zIndex: 4,
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

        {/* Cover-line block — bottom, inset past the spine bar. */}
        <div style={{ position: "absolute", left: spineW + Math.round(cardW * 0.045), right: "8%", bottom: "8%", zIndex: 4 }}>
          {kicker ? (
            <div
              style={{
                opacity: kickerO,
                fontFamily: MAG_SANS,
                fontWeight: 800,
                fontSize: Math.max(12, cardW * 0.03, deckPx * 1.15),
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: showPhoto ? onImg : accent,
                marginBottom: cardW * 0.022,
              }}
            >
              {kicker}
            </div>
          ) : null}

          <div
            style={{
              width: cardW * 0.16,
              height: 4,
              background: accent,
              margin: `${cardW * 0.026}px 0`,
              transformOrigin: "left center",
              transform: `scaleX(${ruleP})`,
            }}
          />

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
                fontSize: Math.max(11, cardW * 0.024, deckPx * 0.9),
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

        {/* Newsstand barcode */}
        <div
          style={{
            position: "absolute",
            right: "7%",
            bottom: "4%",
            background: "#FFFFFF",
            padding: "6px 8px 4px",
            opacity: bylineO,
            boxShadow: showPhoto ? "0 4px 14px rgba(0,0,0,0.22)" : "none",
            zIndex: 4,
          }}
        >
          <Barcode color="#111111" width={Math.round(cardW * 0.2)} height={Math.round(cardW * 0.065)} label="0 74820 09221" />
        </div>
      </div>
    </div>
  );

  return (
    <AbsoluteFill style={{ background: MAG_BACKDROP, fontFamily: fontFamily ?? MAG_SERIF, overflow: "hidden", opacity: entryFade }}>
      {/* Blurred backdrop — static, so the heavy blur raster paints once. */}
      <AbsoluteFill style={{ filter: `blur(${deskBlur}px)`, transform: "scale(1.06)" }}>
        <DeskBackdrop aspectRatio={props.aspectRatio} accent={accent} parallaxX={0} parallaxY={0} />
      </AbsoluteFill>

      {/* The rack: neighbours + hero, sliding in together as one unit. */}
      <AbsoluteFill
        style={{
          transform: `translateX(${rackTX.toFixed(1)}px) scale(${rackScale.toFixed(4)})`,
          opacity: cardO,
        }}
      >
        {/* Neighbours sit behind the hero. Portrait has no room for them beside a
            0.98-width card, so they are landscape-only. */}
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
