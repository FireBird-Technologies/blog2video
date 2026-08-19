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
