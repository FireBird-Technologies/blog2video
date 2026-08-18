import React from "react";
import { useVideoConfig, interpolate, Img } from "remotion";
import { SceneLayoutProps } from "../types";
import { SakuraClip } from "../components/SakuraClip";
import {
  SAKURA,
  SAKURA_DISPLAY_FONT,
  SAKURA_BODY_FONT,
  SakuraScene,
  useSakuraFrame,
  SakuraVineFrame,
  BrushUnderline,
  hexToRgba,
  readableTextColor,
  petalTint,
} from "../sakuraStyle";

/**
 * SakuraSectionV2 — "Folding Screen" (byōbu)
 *
 * Variant of `sakura_section`. Same props, different composition.
 *
 * Base is a headline-left / 620×700-photo-right split under a GrowingSakuraTree.
 * This one is a folding screen: THREE leaves with visible fold seams, the copy
 * inset in leaf 1 and the image bleeding across leaves 2–3.
 *
 * The screen folds along the frame's LONG axis — vertical leaves side by side in
 * landscape, horizontal leaves stacked in portrait. Forcing vertical leaves in
 * portrait gave the copy a third of an already-narrow measure and broke words
 * mid-word, and the copy leaf is given a larger share than an even third.
 *
 * What makes it read as a screen rather than a two-column split:
 *   • each leaf hinges open on its own stagger, about the seam it is joined on,
 *     so the screen unfolds progressively instead of the whole card fading up;
 *   • the seams are drawn as lit/shadowed edges, so the panels look folded rather
 *     than merely adjacent;
 *   • SakuraVineFrame replaces the growing tree as the chrome, and the ambient
 *     moves to komorebi (dappled light) — the base uses mist_gold.
 *
 * NOTE the image slot changes shape (two-thirds of a wide screen, vs the base's
 * 620×700 portrait-ish card), so this variant declares its OWN entry in
 * imageBoxConfig.ts + LAYOUT_IMAGE_ASPECT rather than inheriting the base's.
 *
 * Seeds 19/29 are fresh.
 */
export const SakuraSectionV2: React.FC<SceneLayoutProps> = (props) => {
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
    chapterKanji,
    chapterLabel,
    headline,
    body,
    accentColor,
    bgColor,
    textColor,
    aspectRatio,
    sceneDurationInFrames,
    titleFontSize,
    descriptionFontSize,
    fontFamily,
  } = props;

  const p = aspectRatio === "portrait";
  const frame = useSakuraFrame();
  const { width, height } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 150;

  // Light washi ground here (the base's ink_corner is also light), so the body ink
  // resolves against paper rather than the dark register the intro uses.
  const crimson = accentColor || SAKURA.crimson;
  const ink = readableTextColor(textColor, "light");
  const petal = petalTint(accentColor);

  const displayFont = fontFamily ?? SAKURA_DISPLAY_FONT;
  const bodyFont = fontFamily ?? SAKURA_BODY_FONT;

  const hasMedia = Boolean(imageUrl || videoUrl);

  const heading = (headline ?? "").trim() || title;
  const copy = (body ?? "").trim() || narration;
  const kanji = (chapterKanji ?? "").trim();
  const label = (chapterLabel ?? "").trim();

  // ── Screen geometry ────────────────────────────────────────────────────────
  // The screen folds along the LONG axis: vertical leaves in landscape, horizontal
  // ones in portrait. Splitting a portrait frame into three vertical leaves gave
  // the copy a third of an already-narrow measure and broke words mid-word
  // ("Workin/g", "Headli/ne"), so portrait stacks instead.
  const vPad = p ? height * 0.08 : height * 0.11;
  const screenH = height - vPad * 2;
  const screenW = p ? width * 0.88 : width * 0.82;
  const screenLeft = (width - screenW) / 2;
  /**
   * Copy leaf gets more room than an even split; the image spans the rest.
   * With NO image the leaves have nothing to carry, so the copy spreads across the
   * WHOLE screen and centres in it — otherwise it stayed penned in one third with
   * two blank leaves beside it. The screen still folds as three leaves either way;
   * only what sits on them changes.
   */
  const COPY_FRACTION = p ? 0.36 : 0.34;
  // Text measure/extent. With media this IS the first leaf; without it the copy
  // floats over the whole screen (the leaves become an even three-panel ground).
  const copyLeafW = hasMedia ? (p ? screenW : screenW * COPY_FRACTION) : screenW;
  const copyLeafH = hasMedia ? (p ? screenH * COPY_FRACTION : screenH) : screenH;
  /**
   * Each of the two image leaves. Stacked leaves are FULL WIDTH and split the
   * remaining height; side-by-side leaves are full height and split the remaining
   * width. (Halving the width in portrait left the picture in a narrow left column
   * with the copy spilling across it.)
   * With no media the leaves split the screen evenly so the fold seams stay
   * regularly spaced under the full-width copy.
   */
  const artLeafW = !hasMedia
    ? p
      ? screenW
      : screenW / 3
    : p
      ? screenW
      : (screenW * (1 - COPY_FRACTION)) / 2;
  const artLeafH = !hasMedia
    ? p
      ? screenH / 3
      : screenH
    : p
      ? (screenH * (1 - COPY_FRACTION)) / 2
      : screenH;

  /** Each panel hinges open on its own beat — the unfold. */
  const panelOpen = (i: number) =>
    interpolate(frame, [4 + i * 7, 26 + i * 7], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: (t) => 1 - Math.pow(1 - t, 3),
    });

  const headingOpacity = interpolate(frame, [30, 48], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const copyOpacity = interpolate(frame, [44, 66], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const headingPx = titleFontSize ?? (p ? 60 : 55);
  const copyPx = descriptionFontSize ?? (p ? 35 : 29);

  const mediaStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: (imageZoom ?? 1) < 1 ? "contain" : "cover",
    objectPosition: (imageZoom ?? 1) < 1 ? "center" : (imageObjectPosition ?? "50% 50%"),
    transform: `scale(${imageZoom ?? 1})`,
    display: "block",
  };

  return (
    <SakuraScene
      backdrop="washi_radial"
      entranceLayout="sakura_section__v2"
      bgColor={bgColor}
      accentColor={crimson}
      dur={dur}
      petals={p ? 10 : 14}
      petalIntensity={0.55}
      petalSeed={19}
      petalMode="float"
      ambient="komorebi"
      chrome={
        <SakuraVineFrame
          width={width}
          height={height}
          grow={interpolate(frame, [0, 60], [0, 1], { extrapolateRight: "clamp" })}
          vineColor={hexToRgba(SAKURA.ink, 0.35)}
          leafColor={hexToRgba(SAKURA.crimson, 0.3)}
          blossomColor={petal}
          blossomCenter={SAKURA.gold}
          seed={29}
        />
      }
    >
      {/* ── The screen ── */}
      <div
        style={{
          position: "absolute",
          left: screenLeft,
          top: vPad,
          width: screenW,
          height: screenH,
          display: "flex",
          // Leaves run across the frame in landscape, stacked in portrait.
          flexDirection: p ? "column" : "row",
        }}
      >
        {[0, 1, 2].map((i) => {
          const open = panelOpen(i);
          const isCopyLeaf = i === 0;
          return (
            <div
              key={i}
              style={{
                // Without media every leaf is an equal panel of the ground — the
                // copy is not confined to leaf 0, so leaf 0 must not take the
                // copy's full-screen extent.
                width: isCopyLeaf && hasMedia ? copyLeafW : artLeafW,
                height: isCopyLeaf && hasMedia ? copyLeafH : artLeafH,
                position: "relative",
                overflow: "hidden",
                background: `linear-gradient(180deg, ${hexToRgba(SAKURA.washi, 0.98)} 0%, ${hexToRgba(
                  SAKURA.washi,
                  0.9,
                )} 100%)`,
                // Hinge: each leaf swings open around the seam it is joined on —
                // the left edge when the screen runs across, the top edge when it
                // is stacked, so the fold always reads about the correct axis.
                transform: p
                  ? `perspective(1400px) rotateX(${interpolate(open, [0, 1], [34, 0])}deg)`
                  : `perspective(1400px) rotateY(${interpolate(open, [0, 1], [-38, 0])}deg)`,
                transformOrigin: p ? "center top" : "left center",
                opacity: open,
                // Fold seams: a lit leading edge and a shadowed trailing one, so
                // adjacent leaves read as folded panels rather than one flat card.
                borderLeft: p
                  ? `2px solid ${hexToRgba(SAKURA.gold, 0.6)}`
                  : i === 0
                    ? `2px solid ${hexToRgba(SAKURA.gold, 0.6)}`
                    : `1px solid ${hexToRgba(SAKURA.gold, 0.45)}`,
                borderRight: p
                  ? `2px solid ${hexToRgba(SAKURA.gold, 0.6)}`
                  : i === 2
                    ? `2px solid ${hexToRgba(SAKURA.gold, 0.6)}`
                    : "none",
                borderTop: p && i > 0 ? `1px solid ${hexToRgba(SAKURA.gold, 0.45)}` : undefined,
                boxShadow: p
                  ? i === 2
                    ? `0 18px 44px ${hexToRgba(SAKURA.ink, 0.28)}`
                    : `inset 0 -14px 26px ${hexToRgba(SAKURA.ink, 0.1)}`
                  : i === 2
                    ? `0 18px 44px ${hexToRgba(SAKURA.ink, 0.28)}`
                    : `inset -14px 0 26px ${hexToRgba(SAKURA.ink, 0.12)}`,
              }}
            >
              {/* Leaves 2–3 carry the image, bled across the seam between them. */}
              {hasMedia && i > 0 ? (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    // Shift each leaf's slice so one continuous picture spans both:
                    // side by side in landscape, one above the other in portrait.
                    width: p ? artLeafW : artLeafW * 2,
                    height: p ? artLeafH * 2 : artLeafH,
                    left: p ? 0 : i === 1 ? 0 : -artLeafW,
                    top: p ? (i === 1 ? 0 : -artLeafH) : 0,
                  }}
                >
                  {videoUrl ? (
                    <SakuraClip
                      src={videoUrl}
                      imageObjectPosition={imageObjectPosition}
                      imageZoom={imageZoom}
                      muted={videoMuted}
                      volume={videoVolume}
                      durationInFrames={videoDurationInFrames}
                      startInFrames={videoStartInFrames}
                      style={mediaStyle}
                    />
                  ) : (
                    <Img src={imageUrl!} style={mediaStyle} />
                  )}
                  {/* Paper tint over the photo so it sits in the washi world. */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: hexToRgba(SAKURA.washi, 0.14),
                      mixBlendMode: "overlay",
                    }}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* ── Copy ──
          With media it is INSET IN THE FIRST LEAF, sitting alongside the picture.
          With no media it spans the whole screen and centres in it, both axes, so
          the text is the subject rather than a column beside two blank leaves. */}
      <div
        style={{
          position: "absolute",
          left: screenLeft + (hasMedia ? (p ? 34 : 30) : p ? 60 : 90),
          top: vPad + (hasMedia ? (p ? 34 : 52) : 0),
          // Match the copy LEAF, which is full-width in portrait — not the old
          // even-thirds panel, which cost the text most of its measure.
          width: copyLeafW - (hasMedia ? (p ? 68 : 60) : p ? 120 : 180),
          height: hasMedia ? undefined : copyLeafH,
          maxHeight: hasMedia ? copyLeafH - (p ? 56 : 80) : undefined,
          overflow: "hidden",
          // Centre the block vertically over the screen when it is the only content.
          justifyContent: hasMedia ? "flex-start" : "center",
          textAlign: hasMedia ? "left" : "center",
          alignItems: hasMedia ? "stretch" : "center",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Chapter marker — vertical kanji beside a tracked label, the base's idiom. */}
        {(kanji || label) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: p ? 18 : 16,
              opacity: headingOpacity,
            }}
          >
            {kanji ? (
              <div
                style={{
                  writingMode: "vertical-rl",
                  textOrientation: "upright",
                  fontFamily: displayFont,
                  fontSize: p ? 30 : 25,
                  color: crimson,
                  letterSpacing: "0.1em",
                }}
              >
                {kanji}
              </div>
            ) : null}
            {label ? (
              <div
                style={{
                  fontFamily: bodyFont,
                  fontSize: p ? 18 : 15,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: hexToRgba(ink, 0.6),
                }}
              >
                {label}
              </div>
            ) : null}
          </div>
        )}

        <div
          style={{
            fontFamily: displayFont,
            fontWeight: 700,
            fontSize: headingPx,
            lineHeight: 1.22,
            color: ink,
            opacity: headingOpacity,
            overflowWrap: "anywhere",
          }}
        >
          {heading}
        </div>

        {/* BrushUnderline drives its own clock off startFrame — it reads
            useSakuraFrame() internally, so do not pass a progress value. */}
        <BrushUnderline
          // Beside a picture the rule runs most of the copy column; centred with no
          // picture it would stretch the full screen, so cap it to a rule-like span.
          width={
            hasMedia
              ? copyLeafW - (p ? 200 : 100)
              : Math.min(copyLeafW * 0.34, p ? 420 : 520)
          }
          color={crimson}
          startFrame={40}
          durationFrames={20}
        />

        {copy ? (
          <div
            style={{
              marginTop: p ? 18 : 16,
              fontFamily: bodyFont,
              fontSize: copyPx,
              lineHeight: 1.72,
              color: hexToRgba(ink, 0.86),
              opacity: copyOpacity,
              overflowWrap: "anywhere",
              // Cap the measure when centred: running body copy the full width of
              // the screen would be an unreadably long line.
              maxWidth: hasMedia ? undefined : p ? "100%" : "68%",
            }}
          >
            {copy}
          </div>
        ) : null}
      </div>
    </SakuraScene>
  );
};
