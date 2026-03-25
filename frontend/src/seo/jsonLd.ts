/**
 * Single source of truth for how schema arrays are serialized to JSON-LD.
 * Must match between static prerender (build-seo) and client Seo.tsx so crawlers
 * see one script tag — otherwise a second script duplicates FAQPage and breaks rich results.
 */
export type JsonLdInput = Record<string, unknown>[] | Record<string, unknown>;

export function normalizeSchemaForJsonLd(schema: JsonLdInput | undefined): Record<string, unknown> | null {
  if (schema === undefined) return null;
  if (Array.isArray(schema)) {
    return { "@context": "https://schema.org", "@graph": schema };
  }
  return schema;
}

export const SEO_JSON_LD_SCRIPT_ID = "seo-json-ld";
