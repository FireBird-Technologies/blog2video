import type { ReactNode } from "react";
import type { CraftedTemplateItem, CustomTemplateItem, Project, TemplateMeta } from "../api/client";
import {
  NewTemplateBadge,
  TEMPLATE_DESCRIPTIONS,
  TEMPLATE_PREVIEWS,
} from "./templatePreviewRegistry";
import CustomPreview from "./templatePreviews/CustomPreview";
import CustomPreviewLandscape from "./templatePreviews/CustomPreviewLandscape";
import CraftedTemplatePreview from "./templatePreviews/CraftedTemplatePreview";

/** Built-in or custom template preview for settings / picker (matches BlogUrlForm step 2 styling). */
export function TemplateAssignPreview({
  templateId,
  customTemplates,
  craftedTemplates = [],
  projectCustomTheme,
  projectName,
  variant,
  previewCompileScope,
}: {
  templateId: string;
  customTemplates: CustomTemplateItem[];
  craftedTemplates?: CraftedTemplateItem[];
  projectCustomTheme: Project["custom_theme"];
  projectName?: string;
  variant: "large" | "thumb";
  /** Pass current user id string so crafted preview compile cache cannot cross accounts. */
  previewCompileScope?: string;
}) {
  if (templateId.startsWith("crafted_")) {
    const ct = craftedTemplates.find((c) => c.id === templateId);
    // Render the lightweight bundled marquee preview rather than the full
    // scene-by-scene playback. The settings card is a "what template am I
    // using" affordance, not a video preview surface — the marquee is the
    // right level of detail and it doesn't need the layout package.
    if (ct) {
      return (
        <CraftedTemplatePreview
          templateId={ct.id}
          compileCacheScope={previewCompileScope}
          previewSource={ct.preview_file ?? null}
          previewImageUrl={ct.preview_image_url ?? null}
          name={ct.name}
          thumbnailMode={variant === "thumb"}
          showLoaderOnEmptyOrError
        />
      );
    }
    return (
      <div
        className={`flex w-full items-center justify-center bg-gray-100 text-center text-xs text-gray-400 ${
          variant === "thumb" ? "min-h-[64px] max-h-[80px] p-2" : "aspect-video p-4"
        }`}
      >
        Designer template preview unavailable
      </div>
    );
  }
  if (templateId.startsWith("custom_")) {
    const cid = parseInt(templateId.replace("custom_", ""), 10);
    const ct = customTemplates.find((c) => c.id === cid);
    if (ct) {
      return variant === "large" ? (
        <CustomPreview
          theme={ct.theme}
          name={ct.name}
          previewImageUrl={ct.preview_image_url}
          introCode={ct.intro_code || undefined}
          outroCode={ct.outro_code || undefined}
          contentCodes={ct.content_codes || undefined}
          contentArchetypeIds={ct.content_archetype_ids || undefined}
          logoUrls={ct.logo_urls}
          ogImage={ct.og_image}
        />
      ) : (
        <CustomPreviewLandscape
          theme={ct.theme}
          name={ct.name}
          introCode={ct.intro_code || undefined}
          outroCode={ct.outro_code || undefined}
          contentCodes={ct.content_codes || undefined}
          contentArchetypeIds={ct.content_archetype_ids || undefined}
          previewImageUrl={ct.preview_image_url}
          logoUrls={ct.logo_urls}
          ogImage={ct.og_image}
        />
      );
    }
    if (projectCustomTheme) {
      const fallback = (
        <CustomPreview
          theme={projectCustomTheme}
          name={projectName || "Custom"}
          previewImageUrl={null}
          introCode={undefined}
          outroCode={undefined}
          contentCodes={undefined}
          contentArchetypeIds={undefined}
          logoUrls={undefined}
          ogImage={undefined}
        />
      );
      if (variant === "thumb") {
        return (
          <div className="relative w-full overflow-hidden max-h-[80px] min-h-[64px] bg-gray-50">
            {fallback}
          </div>
        );
      }
      return fallback;
    }
    return (
      <div
        className={`flex w-full items-center justify-center bg-gray-100 text-center text-xs text-gray-400 ${
          variant === "thumb" ? "min-h-[64px] max-h-[80px] p-2" : "aspect-video p-4"
        }`}
      >
        Custom template preview unavailable
      </div>
    );
  }

  const Comp = TEMPLATE_PREVIEWS[templateId];
  if (Comp) {
    if (variant === "thumb") {
      return (
        <div className="relative w-full overflow-hidden max-h-[80px] min-h-[64px] bg-gray-50">
          <Comp key={templateId} />
        </div>
      );
    }
    return <Comp key={templateId} />;
  }
  return (
    <div
      className={`flex w-full items-center justify-center bg-gray-100 text-gray-300 ${
        variant === "thumb" ? "min-h-[64px] max-h-[80px] text-[10px] px-1" : "aspect-video text-sm"
      }`}
    >
      {templateId}
    </div>
  );
}

export default function ProjectTemplateSettingsCard({
  templateId,
  customTemplates,
  craftedTemplates = [],
  projectCustomTheme,
  projectName,
  templateMetas,
  disabled = false,
  emphasizeChangeButton = false,
  previewOverride,
  previewCompileScope,
  onChangeTemplate,
}: {
  templateId: string;
  customTemplates: CustomTemplateItem[];
  craftedTemplates?: CraftedTemplateItem[];
  projectCustomTheme: Project["custom_theme"];
  projectName?: string;
  templateMetas: TemplateMeta[];
  disabled?: boolean;
  emphasizeChangeButton?: boolean;
  previewOverride?: ReactNode;
  previewCompileScope?: string;
  onChangeTemplate: () => void;
}) {
  const selectedCustom =
    templateId.startsWith("custom_")
      ? customTemplates.find((ct) => ct.id === parseInt(templateId.replace("custom_", ""), 10))
      : null;
  const selectedCrafted =
    templateId.startsWith("crafted_")
      ? craftedTemplates.find((ct) => ct.id === templateId)
      : null;
  const selectedDesc = TEMPLATE_DESCRIPTIONS[templateId];
  const assignedBuiltinNew =
    !templateId.startsWith("custom_") &&
    templateMetas.some((t) => t.id === templateId && t.new_template === true);

  return (
    <div>
      <h2 className="text-base font-medium text-gray-900 mb-1">Project Template</h2>
      <p className="text-xs text-gray-400 mb-5">
        Rebuild scene layouts for a new template while preserving narration, display text, voiceovers.
      </p>
      <div className="glass-card p-6 overflow-visible relative z-20">
        <div className="flex flex-row items-stretch gap-4">
          <div className="shrink-0 self-start w-[9.5rem] sm:w-40 rounded-xl overflow-hidden border-2 border-purple-500 shadow-[0_0_0_3px_rgba(124,58,237,0.08)]">
            {previewOverride ?? (
              <TemplateAssignPreview
                templateId={templateId}
                customTemplates={customTemplates}
                craftedTemplates={craftedTemplates}
                projectCustomTheme={projectCustomTheme}
                projectName={projectName}
                variant="thumb"
                previewCompileScope={previewCompileScope}
              />
            )}
            <div className="px-2 py-1.5 bg-purple-50/80 flex items-center justify-center gap-1">
              <div className="w-4 h-4 rounded-full bg-purple-600 flex items-center justify-center shrink-0">
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-between items-end text-right gap-2 min-h-0">
            <div className="flex flex-col items-end gap-1">
              <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                Current template
              </label>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <span className="text-sm font-semibold text-gray-800">
                  {selectedCustom ? selectedCustom.name : selectedCrafted ? selectedCrafted.name : selectedDesc?.title ?? templateId}
                </span>
                {assignedBuiltinNew && <NewTemplateBadge className="shrink-0" />}
                {selectedCustom && (
                  <span
                    className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white shrink-0"
                    style={{ backgroundColor: selectedCustom.preview_colors.accent }}
                  >
                    Custom
                  </span>
                )}
                {selectedCrafted && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white bg-amber-500 shrink-0">
                    Designer
                  </span>
                )}
              </div>
              {selectedCustom ? (
                <div className="text-[11px] text-gray-400">Custom template</div>
              ) : selectedCrafted ? (
                <div className="text-[11px] text-gray-400">Designer template</div>
              ) : selectedDesc?.subtitle ? (
                <div className="text-[11px] text-gray-400">{selectedDesc.subtitle}</div>
              ) : null}
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={onChangeTemplate}
              className={`shrink-0 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-semibold rounded-xl transition-all ${
                emphasizeChangeButton ? "ring-4 ring-purple-200 scale-[1.03]" : ""
              }`}
            >
              Change template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
