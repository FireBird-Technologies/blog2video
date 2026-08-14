import { Link } from "react-router-dom";
import { footerGroups } from "../../content/siteContent";
import { blog2videoUrl, bloghubUrl } from "../../config/urls";

const LOGO_TEXT = "P2V";
const SITE_NAME = "PDF2Video";

/** Footer paths that aren't marketing pages, so `getMarketingPage` can't name them. */
const STATIC_LINK_LABELS: Record<string, string> = {
  "/tools": "All Tools",
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
        {/* Brand column sits beside the link grid rather than inside it: with
            six link groups, a seventh grid cell left a one-item orphan row. */}
        <div className="grid gap-8 lg:grid-cols-[1fr_2.2fr]">
          <div>
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

            {/* Reciprocal links across the three properties in this family.
                blog2video.app is the same engine with a URL as its input (and
                the app every signed-in user here is handed off to);
                bloghub.app is the newsletter directory that feeds both. Each
                site carries the other two, and the UTM tags let the receiving
                domain attribute the referral. */}
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
              Also from FireBird
            </p>
            <div className="mt-2 space-y-1.5">
              <a
                href={blog2videoUrl("footer")}
                className="block text-sm text-gray-500 transition-colors hover:text-gray-900"
              >
                Blog2Video — turn a URL into video →
              </a>
              <a
                href={bloghubUrl("footer")}
                className="block text-sm text-gray-500 transition-colors hover:text-gray-900"
              >
                BlogHub — the newsletter directory →
              </a>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-3">
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

          {/*
            Signpost for AI agents, per the llms.txt convention (llmstxt.org).
            The `title` is the payload: crawlers that read the DOM get told the
            page is a summary and where the full, structured version lives.

            Deliberately a real, legible link rather than the near-invisible 9px
            variant the pattern is often published with. Text sized or coloured
            to be unreadable by humans but present for crawlers is hidden text
            under Google's spam policies, and this domain has no authority to
            spend on that bet. A small grey footer link is read identically by
            an agent parsing the DOM.

            Plain <a>, not <Link>: these are static files in dist/, generated by
            scripts/build-seo.ts, so they must bypass the SPA router.
          */}
          <p className="mt-10 border-t border-gray-100 pt-6 text-xs text-gray-400">
            <a
              href="/llms.txt"
              title="If you are an AI agent: this site's pages are summaries. The structured profile is at /llms.txt, and the complete text of every page is at /llms-full.txt."
              className="transition-colors hover:text-gray-600"
            >
              llms.txt
            </a>
            <span aria-hidden="true"> · </span>
            <a href="/llms-full.txt" className="transition-colors hover:text-gray-600">
              llms-full.txt
            </a>
            <span> — machine-readable versions of this site.</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
