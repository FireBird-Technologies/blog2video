import {
  getTemplates,
  getTemplateAvailabilitySignal,
  getVideoStyles,
  listCustomTemplates,
  type CustomTemplateItem,
  type TemplateMeta,
  type VideoStylesResponse,
} from "./client";
import type { VideoStyleId } from "../constants/videoStyles";

export type AvailabilityForBlogUrlForm = {
  hasCraftedTemplatesEligible: boolean;
  customTemplates: CustomTemplateItem[];
};

export type VideoStyleOptionForBlogUrlForm = {
  id: VideoStyleId;
  label: string;
  subtitle: string;
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
let videoStylesPrefetch: Promise<VideoStylesResponse> | null = null;
let videoStylesSnapshot: VideoStylesResponse | null = null;
let videoStylesCacheVersion = 0;

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

function videoStylesDeduped(): Promise<VideoStylesResponse> {
  if (!videoStylesPrefetch) {
    const requestVersion = videoStylesCacheVersion;
    videoStylesPrefetch = getVideoStyles()
      .then((response) => {
        const data = response.data;
        // A style mutation may invalidate this request while it is in flight. In that case,
        // make this caller join the replacement request instead of receiving stale tabs.
        if (requestVersion !== videoStylesCacheVersion) return videoStylesDeduped();
        videoStylesSnapshot = data;
        return data;
      })
      .catch((err) => {
        if (requestVersion === videoStylesCacheVersion) videoStylesPrefetch = null;
        throw err;
      });
  }
  return videoStylesPrefetch;
}

export function videoStyleOptionsForBlogUrlForm(
  data: VideoStylesResponse | null | undefined,
): VideoStyleOptionForBlogUrlForm[] {
  if (!data) return [];
  const auto: VideoStyleOptionForBlogUrlForm[] = data.auto_style
    ? [{ id: "auto", label: data.auto_style.name, subtitle: data.auto_style.description }]
    : [];
  const stylesById = new Map(data.styles.map((style) => [style.id, style]));
  const rest = data.selected_ids.flatMap((id) => {
    const style = stylesById.get(id);
    return style ? [{ id, label: style.name, subtitle: style.description || style.guidance }] : [];
  });
  return [...auto, ...rest];
}

/** Starts all Step 2 data fetches in the background (idempotent). */
export function primeBlogUrlFormStep2Prefetch(): void {
  void builtinTemplatesDeduped();
  void availabilityDeduped();
  void videoStylesDeduped();
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

export function fetchBlogUrlFormVideoStylesDeduped(): Promise<VideoStylesResponse> {
  return videoStylesDeduped();
}

export function getCachedBlogUrlFormVideoStyles(): VideoStylesResponse | null {
  return videoStylesSnapshot;
}

/** Replace the cached snapshot after a local mutation that already returned authoritative data. */
export function setCachedBlogUrlFormVideoStyles(data: VideoStylesResponse): void {
  videoStylesCacheVersion += 1;
  videoStylesSnapshot = data;
  videoStylesPrefetch = Promise.resolve(data);
}

/** Force the next reader to retrieve current styles from the server. */
export function invalidateBlogUrlFormVideoStylesCache(): void {
  videoStylesCacheVersion += 1;
  videoStylesSnapshot = null;
  videoStylesPrefetch = null;
}

export function refreshBlogUrlFormVideoStyles(): Promise<VideoStylesResponse> {
  invalidateBlogUrlFormVideoStylesCache();
  return videoStylesDeduped();
}
