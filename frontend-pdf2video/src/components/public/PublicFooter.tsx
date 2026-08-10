import { Link } from "react-router-dom";
import { footerGroups } from "../../content/siteContent";
import { BLOG2VIDEO_URL } from "../../config/urls";

const LOGO_TEXT = "P2V";
const SITE_NAME = "PDF2Video";

/** Footer paths that aren't marketing pages, so `getMarketingPage` can't name them. */
const STATIC_LINK_LABELS: Record<string, string> = {
  "/tools": "Tools",
  "/help": "Help",
  "/blogs": "Blog",
  "/pricing": "Pricing",
  "/contact": "Contact",
  "/terms": "Terms of Service",
  "/privacy": "Privacy Policy",
};

/** Words whose casing the generic title-caser would get wrong. */
const LABEL_WORD_CASING: Record<string, string> = {
  pdf: "PDF",
  docx: "DOCX",
  pptx: "PPTX",
  url: "URL",
  ai: "AI",
  seo: "SEO",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  blog2video: "Blog2Video",
  heygen: "HeyGen",
  lumen5: "Lumen5",
  veed: "VEED",
  invideo: "InVideo",
  vs: "vs",
  to: "to",
  for: "for",
  and: "and",
};

/**
 * Footer links need a short label, but `MarketingPage` only carries
 * `heroTitle` — a full sentence ("Turn PDFs into video explainers without
 * manually rebuilding the deck") that would wrap badly in a six-column
 * footer. The last path segment is already a clean slug, so title-case that
 * instead and keep the sentence for the page itself.
 */
function labelFromPath(path: string): string {
  const slug = path.replace(/^\//, "").split("/").pop() ?? path;
  return slug
    .split("-")
    .map((word, index) => {
      const cased = LABEL_WORD_CASING[word];
      if (cased) {
        // Lowercase connectors ("for", "to") still capitalise if they lead.
        return index === 0 ? cased.charAt(0).toUpperCase() + cased.slice(1) : cased;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

export default function PublicFooter() {
  return (
    <footer className="border-t border-gray-100 bg-gray-50/70">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <div className="lg:col-span-1">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-600 text-[11px] font-bold text-white">
                {LOGO_TEXT}
              </div>
              <span className="text-lg font-semibold text-gray-900">{SITE_NAME}</span>
            </div>
            <p className="text-sm leading-relaxed text-gray-500">
              Turn PDFs, reports, whitepapers, and decks into narrated, branded videos people
              actually finish.
            </p>
            <a
              href={BLOG2VIDEO_URL}
              className="mt-3 inline-block text-sm text-gray-500 transition-colors hover:text-gray-900"
            >
              Have a blog instead? Try Blog2Video →
            </a>
          </div>

          {footerGroups.map((group) => (
            <div key={group.title}>
              <p className="mb-3 text-sm font-semibold text-gray-900">{group.title}</p>
              <div className="space-y-2">
                {group.links.map((path) => {
                  const label = STATIC_LINK_LABELS[path] ?? labelFromPath(path);

                  return (
                    <Link
                      key={path}
                      to={path}
                      className="block text-sm text-gray-500 transition-colors hover:text-gray-900"
                    >
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
