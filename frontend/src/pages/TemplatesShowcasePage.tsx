import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { TEMPLATE_PREVIEWS, TEMPLATE_PREVIEWS_PORTRAIT, TEMPLATE_DESCRIPTIONS } from "../components/templatePreviewRegistry";
import CoverflowCarousel, { type CoverflowTemplate, type CoverflowOrientation } from "../components/CoverflowCarousel";
import OrientationToggle from "../components/OrientationToggle";
import YourOwnBrandPreview from "../components/templatePreviews/YourOwnBrandPreview";
import YourOwnBrandPreviewPortrait from "../components/templatePreviews/portrait/YourOwnBrandPreviewPortrait";
import DesignerTemplateRequestModal from "../components/DesignerTemplateRequestModal";
import { useAuth } from "../hooks/useAuth";
import PublicFooter from "../components/public/PublicFooter";
import PublicHeader from "../components/public/PublicHeader";

const CAROUSEL_TEMPLATES: CoverflowTemplate[] = Object.entries(TEMPLATE_PREVIEWS).map(
  ([id, Preview]) => ({
    id,
    Preview,
    PreviewPortrait: TEMPLATE_PREVIEWS_PORTRAIT[id],
    name: TEMPLATE_DESCRIPTIONS[id]?.title ?? id,
    subtitle: TEMPLATE_DESCRIPTIONS[id]?.subtitle ?? "",
  })
);

export default function TemplatesShowcasePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [designerOpen, setDesignerOpen] = useState(false);
  const [orientation, setOrientation] = useState<CoverflowOrientation>("landscape");

  // "Your Own Brand" CTA card: logged-in users get the in-app designer request
  // modal; logged-out visitors are routed to the public Contact page.
  const handleBrandClick = () => {
    if (user) setDesignerOpen(true);
    else navigate("/contact");
  };

  // Insert the "Your Own Brand" CTA right after Whiteboard (before Newspaper),
  // and recompute the initial index against the augmented list so Whiteboard
  // stays centered with the brand card one step to its right.
  const carouselTemplates = useMemo<CoverflowTemplate[]>(() => {
    const list = [...CAROUSEL_TEMPLATES];
    const wbIdx = list.findIndex((t) => t.id === "whiteboard");
    const insertAt = wbIdx >= 0 ? wbIdx + 1 : 1;
    list.splice(insertAt, 0, {
      id: "your-own-brand",
      name: "Your Own Brand",
      subtitle: "Get a custom template tailored to your brand",
      Preview: YourOwnBrandPreview,
      PreviewPortrait: YourOwnBrandPreviewPortrait,
      onSelect: handleBrandClick,
    });
    return list;
  }, [user]);
  const initialIndex = Math.max(
    0,
    carouselTemplates.findIndex((t) => t.id === "whiteboard")
  );

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
          From broadcast newscasts to hand-drawn whiteboards, every template comes fully
          animated with its own layouts, motion, and color theme.
        </p>
      </section>

      {/* ── Coverflow ── */}
      <section className="flex-1 pb-24 px-6 overflow-x-clip">
        <div className="max-w-6xl mx-auto">
          <OrientationToggle orientation={orientation} onChange={setOrientation} className="mb-8" />
          {/* key forces a clean remount on orientation change — resets every
              preview at once instead of swapping in place (which flickered). */}
          <CoverflowCarousel key={orientation} templates={carouselTemplates} initialIndex={initialIndex} orientation={orientation} />
        </div>
      </section>

      <PublicFooter />

      <DesignerTemplateRequestModal open={designerOpen} onClose={() => setDesignerOpen(false)} />
    </div>
  );
}
