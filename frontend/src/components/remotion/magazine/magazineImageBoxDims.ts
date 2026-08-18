/**
 * Image-adjustment preview boxes for Magazine layouts.
 *
 * Fractions mirror the real layout geometry (MagazineCover card size, MagPlate
 * bands, Colorblock panel splits, EditorialQuote absolute plate, full-bleed
 * MagazinePage backgrounds) so the framing modal matches what renders on screen.
 */
import { GUTTER_W } from "./magazineStyle";

interface ImageBoxDims {
  landscape: { w: number; h: number };
  portrait: { w: number; h: number };
  circular?: boolean;
}

const LANDSCAPE = { w: 1920, h: 1080 };
const PORTRAIT = { w: 1080, h: 1920 };

function asFrac(
  boxW: number,
  boxH: number,
  canvasW: number,
  canvasH: number,
): { w: number; h: number } {
  return { w: boxW / canvasW, h: boxH / canvasH };
}

/** Padded content band inside a full-bleed MagazinePage sheet (steady hold). */
function sheetContent(isPortrait: boolean) {
  const canvasW = isPortrait ? PORTRAIT.w : LANDSCAPE.w;
  const canvasH = isPortrait ? PORTRAIT.h : LANDSCAPE.h;
  const padX = isPortrait ? 0.07 : 0.06;
  const headBand = isPortrait ? 0.1 : 0.09;
  const innerW = canvasW * (1 - 2 * padX);
  const innerH = canvasH * (1 - 2 * padX) * (1 - headBand);
  return { canvasW, canvasH, innerW, innerH };
}

/** Centred 3:4 portrait booklet — MagazineCover.tsx */
function coverBox(isPortrait: boolean) {
  const canvasW = isPortrait ? PORTRAIT.w : LANDSCAPE.w;
  const canvasH = isPortrait ? PORTRAIT.h : LANDSCAPE.h;
  const cardAspect = 0.75;
  let cardH = canvasH * (isPortrait ? 0.98 : 0.92);
  let cardW = cardH * cardAspect;
  const maxCardW = canvasW * (isPortrait ? 0.98 : 0.68);
  if (cardW > maxCardW) {
    cardW = maxCardW;
    cardH = cardW / cardAspect;
  }
  return asFrac(cardW, cardH, canvasW, canvasH);
}

/** MagPlate on the feature spread. */
function featureBox(isPortrait: boolean) {
  const { canvasW, canvasH, innerW, innerH } = sheetContent(isPortrait);
  if (isPortrait) {
    return asFrac(innerW, innerH * 0.32, canvasW, canvasH);
  }
  const gap = GUTTER_W.landscape;
  const kickerBand = innerH * 0.08;
  return asFrac((innerW - gap) / 2, innerH - kickerBand, canvasW, canvasH);
}

/**
 * MagPlate on the "Sidebar" feature variant — FeatureV2.tsx.
 *
 * Differs from `featureBox` because the variant reshapes the slot: the body runs as a
 * single column on ~62% of the spread with the plate ABOVE it, and the facing leaf is
 * the marginal sidebar. So the plate is 62%-wide (landscape) rather than a half-leaf
 * filling the full column height.
 *
 * Keep in lockstep with FeatureV2's JSX: the plate is `height: "30%"` of the flex
 * column, and the body column is `calc(62% - g/2)`.
 */
function featureV2Box(isPortrait: boolean) {
  const { canvasW, canvasH, innerW, innerH } = sheetContent(isPortrait);
  if (isPortrait) {
    // Portrait has no facing leaf — full content width, plate at 30% of the band.
    return asFrac(innerW, innerH * 0.3, canvasW, canvasH);
  }
  const gap = GUTTER_W.landscape;
  const colW = innerW * 0.62 - gap / 2;
  return asFrac(colW, innerH * 0.3, canvasW, canvasH);
}

/** Hero image panel on the colorblock spread (singlePage, 50/50 or 35/65 split). */
function colorblockBox(isPortrait: boolean) {
  const { canvasW, canvasH, innerW, innerH } = sheetContent(isPortrait);
  if (isPortrait) {
    const gap = 22;
    const panelH = ((innerH - gap) * 1.3) / 2;
    return asFrac(innerW, panelH, canvasW, canvasH);
  }
  const gap = GUTTER_W.landscape;
  return asFrac((innerW - gap) / 2, innerH, canvasW, canvasH);
}

/** Absolutely-positioned editorial photo plate — EditorialQuote.tsx */
function editorialQuoteBox(isPortrait: boolean) {
  const { canvasW, canvasH, innerW, innerH } = sheetContent(isPortrait);
  if (isPortrait) {
    return asFrac(innerW * 0.74, innerH * 0.26, canvasW, canvasH);
  }
  return asFrac(innerW * 0.3, innerH * 0.68, canvasW, canvasH);
}

const FULL_BLEED: ImageBoxDims = {
  landscape: { w: 1, h: 1 },
  portrait: { w: 1, h: 1 },
};

export function buildMagazineImageBoxDims(): Record<string, ImageBoxDims> {
  return {
    magazine_cover: {
      landscape: coverBox(false),
      portrait: coverBox(true),
    },
    text_narration: FULL_BLEED,
    timeline_journey: FULL_BLEED,
    feature: {
      landscape: featureBox(false),
      portrait: featureBox(true),
    },
    // The "Sidebar" variant reshapes its image slot, so it needs its OWN exact key —
    // normalizeLayoutId would otherwise strip `__v2` and hand it `feature`'s box,
    // which is the wrong shape. `magazine_cover__v2` and `ending_socials__v2` are
    // deliberately absent: the former keeps the base card geometry exactly, and the
    // latter has no image.
    feature__v2: {
      landscape: featureV2Box(false),
      portrait: featureV2Box(true),
    },
    colorblock: {
      landscape: colorblockBox(false),
      portrait: colorblockBox(true),
    },
    editorial_quote: {
      landscape: editorialQuoteBox(false),
      portrait: editorialQuoteBox(true),
    },
  };
}
