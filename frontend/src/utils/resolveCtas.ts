export type ResolvedCta = {
  ctaButtonText: string;
  websiteLink: string;
  showWebsiteButton: boolean;
};

type RawCta = {
  ctaButtonText?: unknown;
  websiteLink?: unknown;
  showWebsiteButton?: unknown;
};

type LegacySource = {
  ctas?: unknown;
  ctaButtonText?: unknown;
  websiteLink?: unknown;
  showWebsiteButton?: unknown;
};

const str = (v: unknown): string => (typeof v === "string" ? v : "");

const normalizeOne = (raw: RawCta): ResolvedCta => ({
  ctaButtonText: str(raw.ctaButtonText),
  websiteLink: str(raw.websiteLink).trim(),
  showWebsiteButton: raw.showWebsiteButton !== false,
});

/**
 * Mirror of `remotion-video/src/templates/shared/resolveCtas.ts`. Reads either
 * the new `ctas` array or legacy single-CTA fields and returns a normalized
 * array (length >= 1). Socials are handled separately as a scene-level field.
 */
export function resolveCtas(source: LegacySource | null | undefined): ResolvedCta[] {
  const src = source ?? {};

  if (Array.isArray(src.ctas) && src.ctas.length > 0) {
    const normalized = src.ctas
      .filter((c): c is RawCta => !!c && typeof c === "object")
      .map(normalizeOne);
    if (normalized.length > 0) return normalized.slice(0, 3);
  }

  return [
    {
      ctaButtonText: str(src.ctaButtonText),
      websiteLink: str(src.websiteLink).trim(),
      showWebsiteButton: src.showWebsiteButton !== false,
    },
  ];
}
