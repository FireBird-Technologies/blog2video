import type { CoverflowTemplate } from "./CoverflowCarousel";
import YourOwnBrandPreview from "./templatePreviews/YourOwnBrandPreview";
import YourOwnBrandPreviewPortrait from "./templatePreviews/portrait/YourOwnBrandPreviewPortrait";

/** Id of the "Your Own Brand" CTA card; the sign-in gate sits right after it. */
export const BRAND_CARD_ID = "your-own-brand";

/** Inserts the "Your Own Brand" CTA card right after `anchorId`. */
export function withCtaCards(
  templates: CoverflowTemplate[],
  { anchorId, onBrandSelect }: { anchorId: string; onBrandSelect: () => void },
): CoverflowTemplate[] {
  const list = [...templates];
  const anchorIdx = list.findIndex((t) => t.id === anchorId);
  list.splice(anchorIdx >= 0 ? anchorIdx + 1 : 1, 0, {
    id: BRAND_CARD_ID,
    name: "Your Own Brand",
    subtitle: "Get a custom template tailored to your brand",
    Preview: YourOwnBrandPreview,
    PreviewPortrait: YourOwnBrandPreviewPortrait,
    onSelect: onBrandSelect,
  });
  return list;
}
