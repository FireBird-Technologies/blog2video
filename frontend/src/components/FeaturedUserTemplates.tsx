import React, { useEffect, useState } from "react";
import { getFeaturedPublicTemplates } from "../api/client";
import CustomPreview from "./templatePreviews/CustomPreview";

interface FeaturedTemplate {
  id: number;
  name: string;
  theme: any;
  intro_code: string | null;
  content_codes: string[] | null;
  outro_code: string | null;
  content_archetype_ids: any;
  preview_image_url: string;
  logo_urls: string[];
  og_image: string;
}

export default function FeaturedUserTemplates() {
  const [templates, setTemplates] = useState<FeaturedTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Hardcode the IDs we want to showcase, as requested
  const FEATURED_IDS = [13, 18, 7];

  useEffect(() => {
    getFeaturedPublicTemplates(FEATURED_IDS)
      .then((res) => {
        setTemplates(res.data || []);
      })
      .catch((err) => {
        console.error("Failed to fetch featured templates:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="w-8 h-8 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin"></div>
      </div>
    );
  }

  if (templates.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="animate-fade-in">
        <div className="inline-flex items-center gap-2 mb-4 w-full justify-center">
          <p className="text-xs font-medium text-purple-600 tracking-widest uppercase">
            Showcase
          </p>
        </div>
        <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 text-center mb-4">
          Custom templates created by our users
        </h2>
        <p className="text-sm text-gray-500 text-center max-w-lg mx-auto mb-12 leading-relaxed">
          See how brands have transformed their websites into stunning video templates.
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {templates.map((t) => (
            <div key={t.id} className="flex flex-col gap-3 group">
              <div className="rounded-xl overflow-hidden border border-gray-200/60 bg-white shadow-sm ring-1 ring-transparent hover:ring-purple-200 hover:shadow-lg transition-all relative flex items-center justify-center">
                <div className="relative w-full aspect-video overflow-hidden">
                  <CustomPreview 
                    theme={t.theme} 
                    name={t.name}
                    introCode={t.intro_code || undefined}
                    outroCode={t.outro_code || undefined}
                    contentCodes={t.content_codes || undefined}
                    contentArchetypeIds={t.content_archetype_ids || undefined}
                    previewImageUrl={t.preview_image_url}
                    logoUrls={t.logo_urls}
                    ogImage={t.og_image}
                  />
                </div>
              </div>
              <div className="flex items-center justify-center px-1">
                <h3 className="text-sm font-semibold text-gray-900 group-hover:text-purple-600 transition-colors text-center">
                  {t.name}
                </h3>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
