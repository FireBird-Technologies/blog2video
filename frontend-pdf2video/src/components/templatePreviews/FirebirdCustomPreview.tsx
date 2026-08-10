import { useEffect, useState } from "react";
import type { CustomTemplateTheme } from "../../api/client";
import { getFeaturedPublicTemplates } from "../../api/client";
import CustomPreview from "./CustomPreview";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Marketing-page preview for the Custom Templates feature. Renders a featured
 * public custom template (the same kind shown in the landing-page
 * CustomTemplateShowcase) through the real {@link CustomPreview} compiler, so the
 * `/templates/custom` page shows a live brand-extracted layout instead of a
 * built-in Remotion composition.
 *
 * Prefers the Firebird Technologies template (ID 13). Some databases (e.g. the
 * testing DB) don't have ID 13, so we also request the Metal template (ID 46,
 * https://www.metal.so/) as a fallback and use whichever the backend returns.
 */
const PREFERRED_TEMPLATE_IDS = [13, 46];

interface FeaturedTemplate {
  id: number;
  name: string;
  theme: CustomTemplateTheme;
  intro_code: string | null;
  content_codes: string[] | null;
  outro_code: string | null;
  content_archetype_ids: any;
  preview_image_url: string;
  logo_urls: string[];
  og_image: string;
}

export default function FirebirdCustomPreview() {
  const [template, setTemplate] = useState<FeaturedTemplate | null>(null);

  useEffect(() => {
    let cancelled = false;
    getFeaturedPublicTemplates(PREFERRED_TEMPLATE_IDS)
      .then((res) => {
        if (cancelled) return;
        const results: FeaturedTemplate[] = res.data || [];
        // Prefer the first id that the backend actually returned.
        const chosen =
          PREFERRED_TEMPLATE_IDS.map((id) => results.find((t) => t.id === id)).find(
            Boolean,
          ) ??
          results[0] ??
          null;
        setTemplate(chosen);
      })
      .catch((err) =>
        console.error("[FirebirdCustomPreview] failed to fetch template:", err),
      );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="relative w-full aspect-video overflow-hidden">
        {template ? (
          <CustomPreview
            theme={template.theme}
            name={template.name}
            introCode={template.intro_code || undefined}
            outroCode={template.outro_code || undefined}
            contentCodes={template.content_codes || undefined}
            contentArchetypeIds={template.content_archetype_ids || undefined}
            previewImageUrl={template.preview_image_url}
            logoUrls={template.logo_urls}
            ogImage={template.og_image}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-50">
            <div className="w-7 h-7 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
