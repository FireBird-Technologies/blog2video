import CraftYourTemplateCard from "../components/CraftYourTemplateCard";
import {
  CustomTemplateBadge,
  NewTemplateBadge,
  TEMPLATE_DESCRIPTIONS,
} from "../components/templatePreviewRegistry";
import HelpFakeTemplatePreview from "./HelpFakeTemplatePreview";

export default function TemplateChangePickerDemo({
  tab = "builtin",
}: {
  tab?: "builtin" | "custom";
}) {
  const templateChangeDraft = tab === "custom" ? "custom_demo" : "gridcraft";
  const builtInTemplates = [
    { id: "gridcraft", name: "Gridcraft", new_template: false },
    { id: "spotlight", name: "Spotlight", new_template: false },
    { id: "nightfall", name: "Nightfall", new_template: false },
    { id: "newscast", name: "Newscast", new_template: true },
    { id: "default", name: "Geometric Explainer", new_template: false },
    { id: "newspaper", name: "Newspaper", new_template: false },
  ];
  const dummyCustomTemplates = [
    {
      id: "custom_demo",
      name: "Your Brand",
      accent: "#7C3AED",
      bg: "linear-gradient(135deg, #ffffff 0%, #f5f3ff 48%, #ddd6fe 100%)",
      text: "#111827",
    },
    {
      id: "custom_finance",
      name: "Finance Brief",
      accent: "#0F766E",
      bg: "linear-gradient(135deg, #ecfdf5 0%, #ccfbf1 48%, #99f6e4 100%)",
      text: "#134e4a",
    },
    {
      id: "custom_editorial",
      name: "Editorial Desk",
      accent: "#EA580C",
      bg: "linear-gradient(135deg, #fff7ed 0%, #fed7aa 52%, #fdba74 100%)",
      text: "#431407",
    },
  ];

  const CustomTemplatePreview = ({
    template,
    compact = false,
  }: {
    template: (typeof dummyCustomTemplates)[number];
    compact?: boolean;
  }) => (
    <div
      className="relative flex min-h-[56px] items-center justify-center overflow-hidden"
      style={{ aspectRatio: compact ? undefined : "16/9", background: template.bg }}
    >
      <div
        className="absolute left-3 top-3 h-2 w-10 rounded-full"
        style={{ background: template.accent }}
      />
      <div
        className="rounded-xl border border-white/70 bg-white/78 px-4 py-3 text-center shadow-sm"
        style={{ color: template.text }}
      >
        <div className="text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: template.accent }}>
          Custom
        </div>
        <div className={compact ? "mt-0.5 text-[10px] font-black" : "mt-1 text-lg font-black"}>
          {template.name}
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-gray-200/70 overflow-hidden flex flex-col max-h-[92vh]">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Change Template</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Pick a new template. Scenes will be relaid out while preserving narration and text.
          </p>
        </div>
        <button className="text-gray-400 hover:text-gray-600 p-1 rounded-lg" aria-label="Close">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 flex flex-col gap-4">
        <div className="flex gap-1 p-1 bg-gray-100/60 rounded-xl w-fit">
          <button
            type="button"
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
              tab === "builtin" ? "bg-white text-purple-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Built-in
          </button>
          <button
            type="button"
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
              tab === "custom" ? "bg-white text-purple-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Custom
          </button>
        </div>

        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 mb-2">Selected preview</p>
          <div className="rounded-xl overflow-hidden border-2 border-purple-500 shadow-[0_0_0_3px_rgba(124,58,237,0.08)]">
            <div className="relative max-h-[200px] overflow-hidden">
              {tab === "custom" ? (
                <CustomTemplatePreview template={dummyCustomTemplates[0]} />
              ) : (
                <HelpFakeTemplatePreview templateId={templateChangeDraft} />
              )}
            </div>
            <div className="px-3 py-2 bg-purple-50/80 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-gray-800 truncate">
                {tab === "custom" ? dummyCustomTemplates[0].name : TEMPLATE_DESCRIPTIONS[templateChangeDraft]?.title ?? templateChangeDraft}
              </span>
            </div>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 mb-2">
            All {tab === "builtin" ? "built-in" : "custom"} templates
          </p>
          <div className="border border-gray-200/60 rounded-xl p-4 max-h-[240px] overflow-y-auto bg-gray-50/40">
            {tab === "builtin" ? (
              <div className="grid grid-cols-3 gap-4">
                {builtInTemplates.map((template) => {
                  const desc = TEMPLATE_DESCRIPTIONS[template.id];
                  const isSel = templateChangeDraft === template.id;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      className={`text-left rounded-lg overflow-hidden transition-all ${
                        isSel
                          ? "ring-2 ring-purple-500 ring-offset-1 ring-offset-gray-50"
                          : template.new_template
                          ? "ring-1 ring-purple-400/60 hover:ring-purple-500"
                          : "ring-1 ring-gray-200/60 hover:ring-purple-300/60"
                      }`}
                    >
                      <div className="relative overflow-hidden max-h-[70px] min-h-[56px]">
                        <HelpFakeTemplatePreview templateId={template.id} thumbnail />
                        {template.new_template && (
                          <div className="absolute top-0.5 left-0.5 z-[1]">
                            <NewTemplateBadge />
                          </div>
                        )}
                      </div>
                      <div className={`px-2 py-1 ${isSel ? "bg-purple-50/90" : "bg-white/90"}`}>
                        <div className="text-[10px] font-semibold text-gray-800 truncate">{desc?.title ?? template.name}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                <CraftYourTemplateCard
                  variant="default"
                  isPro
                  onClick={() => undefined}
                  onKeyDown={() => undefined}
                />
                {dummyCustomTemplates.map((template) => {
                  const isSel = template.id === templateChangeDraft;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      className={`text-left rounded-lg overflow-hidden border-2 transition-all ${
                        isSel
                          ? "border-purple-500 shadow-[0_0_0_2px_rgba(124,58,237,0.12)]"
                          : "border-gray-200/60 hover:border-purple-300/60"
                      }`}
                    >
                      <div className="relative isolate overflow-hidden max-h-[70px] min-h-[56px]">
                        <div className="absolute top-0.5 left-0.5 z-[5]">
                          <CustomTemplateBadge />
                        </div>
                        <CustomTemplatePreview template={template} compact />
                      </div>
                      <div className={`px-2 py-1 ${isSel ? "bg-purple-50/80" : "bg-white/80"}`}>
                        <div className="text-[10px] font-semibold text-gray-800 truncate">{template.name}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50/50">
        <button type="button" className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-xl">
          Cancel
        </button>
        <button type="button" className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl">
          Confirm
        </button>
      </div>
    </div>
  );
}
