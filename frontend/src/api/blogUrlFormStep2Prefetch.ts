import {
  getTemplates,
  getTemplateAvailabilitySignal,
  listCustomTemplates,
  type CustomTemplateItem,
  type TemplateMeta,
} from "./client";

export type AvailabilityForBlogUrlForm = {
  hasCraftedTemplatesEligible: boolean;
  customTemplates: CustomTemplateItem[];
};

let builtinTemplatesPrefetch: Promise<TemplateMeta[]> | null = null;

function builtinTemplatesDeduped(): Promise<TemplateMeta[]> {
  if (!builtinTemplatesPrefetch) {
    builtinTemplatesPrefetch = getTemplates()
      .then((r) => r.data ?? [])
      .catch((err) => {
        builtinTemplatesPrefetch = null;
        throw err;
      });
  }
  return builtinTemplatesPrefetch;
}

let availabilityPrefetch: Promise<AvailabilityForBlogUrlForm> | null = null;

async function availabilityBundle(): Promise<AvailabilityForBlogUrlForm> {
  try {
    const r = await getTemplateAvailabilitySignal();
    const hasCrafted = Boolean(r.data?.has_crafted_templates);
    const hasCustom = Boolean(r.data?.has_custom_templates);
    let customTemplates: CustomTemplateItem[] = [];
    if (hasCustom) {
      try {
        customTemplates = (await listCustomTemplates()).data;
      } catch {
        customTemplates = [];
      }
    }
    return { hasCraftedTemplatesEligible: hasCrafted, customTemplates };
  } catch {
    try {
      const customTemplates = (await listCustomTemplates()).data ?? [];
      return { hasCraftedTemplatesEligible: true, customTemplates };
    } catch {
      return { hasCraftedTemplatesEligible: true, customTemplates: [] };
    }
  }
}

function availabilityDeduped(): Promise<AvailabilityForBlogUrlForm> {
  if (!availabilityPrefetch) {
    availabilityPrefetch = availabilityBundle().catch((err) => {
      availabilityPrefetch = null;
      throw err;
    });
  }
  return availabilityPrefetch;
}

/** Starts built-in templates + availability/custom fetch in the background (idempotent). */
export function primeBlogUrlFormStep2Prefetch(): void {
  void builtinTemplatesDeduped();
  void availabilityDeduped();
}

/**
 * Drops the cached availability/custom-template bundle so the next fetch hits the
 * server fresh. Call after creating or deleting a custom template — otherwise the
 * project-creation picker keeps serving the stale module-cached list until a full
 * page refresh.
 */
export function invalidateBlogUrlFormAvailabilityCache(): void {
  availabilityPrefetch = null;
}

export function fetchBlogUrlFormBuiltinTemplatesDeduped(): Promise<TemplateMeta[]> {
  return builtinTemplatesDeduped();
}

export function fetchBlogUrlFormAvailabilityDeduped(): Promise<AvailabilityForBlogUrlForm> {
  return availabilityDeduped();
}
