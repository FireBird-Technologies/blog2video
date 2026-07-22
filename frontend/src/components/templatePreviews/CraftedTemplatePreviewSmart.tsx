import CustomPreview from "./CustomPreview";
import CustomPreviewLandscape from "./CustomPreviewLandscape";
import CraftedTemplatePreview from "./CraftedTemplatePreview";
import type { CraftedTemplateItem, CustomTemplateTheme } from "../../api/client";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Build a usable theme for the composition sample props: prefer the bundled
 *  theme, else synthesize a minimal one from `preview_colors`. CustomPreview
 *  only reads `colors.{accent,bg,text}` + `fonts.body`, so a partial theme is
 *  safe at runtime (cast mirrors the existing inline crafted preview calls). */
function resolveTheme(item: CraftedTemplateItem): CustomTemplateTheme {
  if (item.theme) return item.theme;
  const pc = item.preview_colors ?? { accent: "#E5484D", bg: "#0B0E11", text: "#F4F6F8" };
  return {
    colors: { accent: pc.accent, bg: pc.bg, text: pc.text, surface: pc.bg, muted: pc.text },
    fonts: { heading: "inherit", body: "inherit", mono: "monospace" },
  } as unknown as CustomTemplateTheme;
}

/**
 * Crafted-template preview that prefers the REAL composition.
 *
 * When the crafted item has shipped its frontend module graph
 * (`frontend_files` + `frontend_entry_rel` — fetched on demand via
 * `ensureCraftedTemplateDetail`), we render the actual composition + scene
 * components through {@link CustomPreview}/{@link CustomPreviewLandscape}
 * (same path the real video uses), so the picker card is pixel-identical to
 * the rendered scenes. Until the graph is present (or if a bundle ships no
 * frontend package), we fall back to {@link CraftedTemplatePreview}, which
 * compiles the single bundled marquee `preview_file`, then the static
 * `preview_image_url`, then a placeholder.
 *
 * Shared across every crafted card (FJ, LaDuc, …); not template-specific.
 */
interface CraftedTemplatePreviewSmartProps {
  item: CraftedTemplateItem;
  compileCacheScope?: string;
  /** Grid thumbnail mode (landscape variant, freeze-frame). */
  thumbnailMode?: boolean;
  /** Spinner while compiling (use for the large featured card). */
  showLoaderOnEmptyOrError?: boolean;
  /**
   * Force a static, zero-Player render (themed name placeholder). Set on mobile
   * for non-selected grid tiles so the step-2 grid never mounts many live
   * Remotion Players at once (iOS Safari OOMs and reloads the tab otherwise).
   */
  staticThumb?: boolean;
}

function hasFrontendGraph(item: CraftedTemplateItem): boolean {
  // Always render the bundled marquee `preview_file` via CraftedTemplatePreview,
  // even after the frontend module graph has been fetched. Rendering the real
  // composition once the bundle loaded caused the card to swap from the preview
  // file to the live component; we want the preview file to show consistently.
  void item;
  return false;
}

export default function CraftedTemplatePreviewSmart({
  item,
  compileCacheScope,
  thumbnailMode = false,
  showLoaderOnEmptyOrError = false,
  staticThumb = false,
}: CraftedTemplatePreviewSmartProps) {
  if (hasFrontendGraph(item)) {
    const shared = {
      theme: resolveTheme(item) as any,
      name: item.name,
      validLayouts: (item as any).valid_layouts,
      frontendFiles: (item as any).frontend_files,
      frontendEntryRel: (item as any).frontend_entry_rel,
      publicAssetUrls: (item as any).public_asset_urls,
      previewImageUrl: item.preview_image_url ?? undefined,
      logoUrls: (item as any).logo_urls,
      ogImage: (item as any).og_image,
    };
    return thumbnailMode ? (
      <CustomPreviewLandscape
        {...({ ...shared, showLoaderOnEmptyOrError: false, thumbnailFrame: 135, thumbnailMode: true, staticThumb } as any)}
      />
    ) : (
      <CustomPreview {...({ ...shared, showLoaderOnEmptyOrError } as any)} />
    );
  }

  return (
    <CraftedTemplatePreview
      templateId={item.id}
      compileCacheScope={compileCacheScope}
      previewSource={item.preview_file ?? null}
      previewImageUrl={item.preview_image_url ?? null}
      name={item.name}
      thumbnailMode={thumbnailMode}
      showLoaderOnEmptyOrError={showLoaderOnEmptyOrError}
      staticThumb={staticThumb}
      theme={resolveTheme(item)}
    />
  );
}
