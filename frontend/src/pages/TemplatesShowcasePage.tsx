import { TEMPLATE_PREVIEWS, TEMPLATE_DESCRIPTIONS } from "../components/templatePreviewRegistry";
import CoverflowCarousel, { type CoverflowTemplate } from "../components/CoverflowCarousel";
import PublicFooter from "../components/public/PublicFooter";
import PublicHeader from "../components/public/PublicHeader";

const CAROUSEL_TEMPLATES: CoverflowTemplate[] = Object.entries(TEMPLATE_PREVIEWS).map(
  ([id, Preview]) => ({
    id,
    Preview,
    name: TEMPLATE_DESCRIPTIONS[id]?.title ?? id,
    subtitle: TEMPLATE_DESCRIPTIONS[id]?.subtitle ?? "",
  })
);

// Start the coverflow centered on Newspaper (fall back to first if not found).
const INITIAL_INDEX = Math.max(0, CAROUSEL_TEMPLATES.findIndex((t) => t.id === "newspaper"));

export default function TemplatesShowcasePage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <PublicHeader />

      {/* ── Hero ── */}
      <section className="pt-20 pb-10 px-6 text-center">
        <p className="text-xs font-semibold text-purple-600 tracking-widest uppercase mb-4">
          Template Showcase
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
          Pick your video's look
        </h1>
        <p className="text-base text-gray-500 max-w-lg mx-auto leading-relaxed">
          From broadcast newscasts to hand-drawn whiteboards, every built-in template comes fully
          animated with its own layouts, motion, and color theme.
        </p>
      </section>

      {/* ── Coverflow ── */}
      <section className="flex-1 pb-24 px-6 overflow-x-clip">
        <div className="max-w-6xl mx-auto">
          <CoverflowCarousel templates={CAROUSEL_TEMPLATES} initialIndex={INITIAL_INDEX} />
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
