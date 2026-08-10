import { alternativePages } from "./alternativePages";
import { blogPosts } from "./blogPosts";
import { coreCommercialPages } from "./corePages";
import { featurePages } from "./featurePages";
import { defaultCta, templateProfiles } from "./marketingBase";
import { programmaticPages } from "./programmaticPages";
import { resourcePages } from "./resourcePages";
import type { BlogPost, MarketingPage } from "./seoTypes";
import { templatePages } from "./templatePages";
import { useCasePages } from "./useCasePages";

// This deployment is pdf2video-only — no brand switching (see ../frontend for
// the shared-brand build that has one).
// Production custom domain is pdf2vid.com; the directory, Vercel project, and
// Cloudflare Pages project keep the longer "pdf2video" name. Drives canonical
// tags, OG URLs, sitemap.xml, and robots.txt, so it must match the domain the
// site is actually served from.
export const siteUrl = "https://pdf2vid.com";
export const siteName = "PDF2Video";
/**
 * Social share banner (og:image / twitter:image, and the `image` field on every
 * JSON-LD entity via seo/schema.ts). PDF2Vid-branded, 1672×941.
 *
 * Must stay an absolute URL: crawlers like Slack, X, LinkedIn, and iMessage do
 * not resolve relative paths.
 */
export const defaultOgImage = `${siteUrl}/assets/PDF2Vid.png`;
export const organizationName = "FireBird Technologies";

// Verified brand profiles emitted as schema.org `sameAs`.
// Only include URLs the brand controls or authoritative third-party listings.
export const brandSameAs: string[] = [];

/**
 * Marketing pages shown on this deployment.
 *
 * This deployment is a landing-page-only marketing site: pdf2vid.com sells
 * the product and hands signed-in users off to blog2video.app/dashboard (see
 * PdfLanding.tsx). It deliberately excludes anything that would duplicate
 * blog2video.app's indexed content or that only makes sense for an app the
 * user is already inside of:
 *   - Help articles, tools — indexed article content; a second copy at a
 *     different domain risks a Google duplicate-content penalty.
 * `coreCommercialPages` etc. are short commercial/landing pages (not
 * articles), so they're fine to share with blog2video.
 *
 * Individual /templates/:slug pages ARE included (templatePages.ts), matching
 * ../frontend: each is generated from `templateProfiles` with PDF2Video's own
 * document-framed copy, so they're original text rather than a mirror of
 * blog2video.app. The landing carousel (PdfLanding.tsx, #templates) still
 * exists, but the "Templates" nav item now points at a real page instead of an
 * on-page anchor.
 *
 * Blog posts (/blogs) ARE kept, unlike Help/Tools — this domain has its own,
 * currently-empty blog (content/blogPosts.ts) for PDF2Video-specific SEO/
 * marketing content, written fresh rather than mirrored from blog2video.app.
 */
export const marketingPages: MarketingPage[] = [
  ...coreCommercialPages,
  ...useCasePages,
  ...featurePages,
  ...templatePages,
  ...programmaticPages,
  ...resourcePages,
  ...alternativePages,
];

export const topNavLinks = [
  { href: "/pdf-to-video", label: "PDF to Video" },
  { href: "/for-researchers", label: "Use Cases" },
  { href: "/templates/nightfall", label: "Templates" },
  { href: "/tools", label: "Tools" },
  { href: "/help", label: "Help" },
  { href: "/blogs", label: "Blog" },
  { href: "/pricing", label: "Pricing" },
];

/**
 * Footer mirrors ../frontend's five-group structure, but every link is the
 * document-first equivalent: /pdf-to-video and /docx-to-video lead instead of
 * /blog-to-video, and the use-case column leads with researchers/educators
 * rather than bloggers. Every path here is a real page in `marketingPages`
 * (see the assertion in getPublicPaths' callers) — these pages already
 * existed on this deployment and were simply never linked.
 *
 * Tools and Help are intentionally listed but resolve to empty hub pages
 * (see ToolsHub.tsx / HelpHub.tsx) — this domain must not serve a second copy
 * of blog2video.app's indexed articles.
 */
export const footerGroups = [
  {
    title: "Core Workflows",
    links: [
      "/pdf-to-video",
      "/docx-to-video",
      "/pptx-to-video",
      "/diagram-to-video",
      "/pdf-to-youtube-video",
      "/pdf-to-course-video",
      "/url-to-video",
    ],
  },
  {
    title: "Use Cases",
    links: [
      "/for-researchers",
      "/for-educators",
      "/for-technical-writers",
      "/for-finance-publishers",
      "/for-newsletters",
      "/for-medium-writers",
    ],
  },
  {
    title: "Templates",
    links: [
      "/templates/nightfall",
      "/templates/newscast",
      "/templates/chronicle",
      "/templates/magazine",
      "/custom-branded-video-templates",
    ],
  },
  {
    title: "Comparisons",
    links: [
      "/heygen-alternative",
      "/lumen5-alternative",
      "/pictory-alternative",
      "/veed-alternative",
      "/blog2video-vs-lumen5",
      "/blog2video-vs-pictory",
      "/blog2video-vs-invideo",
      "/blog2video-vs-descript",
    ],
  },
  {
    title: "Resources",
    links: [
      "/video-seo-checklist",
      "/distribution-flywheel",
      "/measurement-playbook",
      "/tools",
      "/help",
      "/blogs",
      "/contact",
      "/pricing",
      "/terms",
      "/privacy",
    ],
  },
];

export const featuredPagePaths: string[] = [];
export const featuredPostSlugs = blogPosts.slice(0, 6).map((post) => post.slug);

export function getMarketingPage(path: string): MarketingPage | undefined {
  return marketingPages.find((page) => page.path === path);
}

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}

export function getDisplayTitle(path: string): string {
  if (path === "/") return "Home";
  if (path === "/pricing") return "Pricing";
  if (path === "/contact") return "Contact";
  if (path === "/blogs") return "Blog";

  const marketingPage = getMarketingPage(path);
  if (marketingPage) return marketingPage.heroTitle;

  const blogSlugPrefix = "/blogs/";
  if (path.startsWith(blogSlugPrefix)) {
    const post = getBlogPost(path.replace(blogSlugPrefix, ""));
    if (post) return post.title;
  }

  return siteName;
}

export function getPublicPaths(): string[] {
  return [
    "/",
    "/pricing",
    "/contact",
    "/blogs",
    ...marketingPages.map((page) => page.path),
    ...blogPosts.map((post) => `/blogs/${post.slug}`),
  ];
}

export function getPublicLinkDetails(path: string) {
  if (path === "/pricing") {
    return { path, label: "Pricing", description: `${siteName} pricing for free, pay-as-you-go, Standard, Pro, and custom team plans.` };
  }
  if (path === "/contact") {
    return { path, label: "Contact", description: `Talk to ${siteName} about support, enterprise use cases, and team workflows.` };
  }
  if (path === "/blogs") {
    return { path, label: "Blog", description: `Document-to-video workflows and research publishing playbooks for ${siteName}.` };
  }

  const marketingPage = getMarketingPage(path);
  if (marketingPage) {
    return { path, label: marketingPage.heroTitle, description: marketingPage.description };
  }

  if (path.startsWith("/blogs/")) {
    const post = getBlogPost(path.replace("/blogs/", ""));
    if (post) return { path, label: post.title, description: post.description };
  }

  return null;
}

export function getStructuredInternalLinks(paths: string[]) {
  return paths
    .map((path) => getPublicLinkDetails(path))
    .filter(Boolean) as Array<{ path: string; label: string; description: string }>;
}

export function getTemplateProfile(slug: string) {
  return templateProfiles.find((template) => template.slug === slug);
}

export { getRelatedBlogPosts } from "./relatedPosts";
export { blogPosts, defaultCta, templateProfiles };
