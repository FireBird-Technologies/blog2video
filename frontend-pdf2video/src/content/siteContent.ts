import { alternativePages } from "./alternativePages";
import { blogPosts } from "./blogPosts";
import { coreCommercialPages } from "./corePages";
import { featurePages } from "./featurePages";
import { defaultCta, templateProfiles } from "./marketingBase";
import { programmaticPages } from "./programmaticPages";
import { resourcePages } from "./resourcePages";
import type { BlogPost, MarketingPage } from "./seoTypes";
import { templatePages } from "./templatePages";
import { getTool, getToolByPath, tools, toolsHub } from "./tools";
import { useCasePages } from "./useCasePages";

// This deployment is pdf2video-only — no brand switching (see ../frontend for
// the shared-brand build that has one).
// The live domain is pdf2vid.com; the directory and Vercel project keep the
// longer "pdf2video" name. Drives canonical tags, OG URLs, sitemap.xml, and
// robots.txt, so it must match the domain the site is actually served from.
export const siteUrl = "https://pdf2vid.com";
export const siteName = "PDF2Video";
export const defaultOgImage = `${siteUrl}/og-image-v2.png`;
export const organizationName = "FireBird Technologies";

// Verified brand profiles emitted as schema.org `sameAs`.
// Only include URLs the brand controls or authoritative third-party listings.
//
// The two sibling properties are here because they are the same organisation's
// products: declaring them lets a search engine resolve pdf2vid.com,
// blog2video.app, and bloghub.app to one entity rather than three unrelated
// domains that happen to link to each other. The reciprocal links live in
// PublicFooter (and in each sibling's own footer).
export const brandSameAs: string[] = [
  "https://blog2video.app",
  "https://bloghub.app",
];

/**
 * Marketing pages shown on this deployment.
 *
 * This deployment is a landing-page-only marketing site: pdf2vid.com sells
 * the product and hands signed-in users off to blog2video.app/dashboard (see
 * PdfLanding.tsx). It deliberately excludes anything that would duplicate
 * blog2video.app's indexed content or that only makes sense for an app the
 * user is already inside of:
 *   - Help articles — indexed article content; a second copy at a different
 *     domain risks a Google duplicate-content penalty.
 * `coreCommercialPages` etc. are short commercial/landing pages (not
 * articles), so they're fine to share with blog2video.
 *
 * /tools is no longer in that excluded set. The five tools in content/tools.ts
 * are PDF2Video's own — original copy, and widgets (components/tools/) that
 * exist only on this domain — so they carry no duplicate-content risk. They are
 * routed separately from `marketingPages` because they render through ToolPage
 * rather than MarketingPageView.
 *
 * Individual /templates/:slug pages ARE included (templatePages.ts), matching
 * ../frontend: each is generated from `templateProfiles` with PDF2Video's own
 * document-framed copy, so they're original text rather than a mirror of
 * blog2video.app. The landing carousel (PdfLanding.tsx, #templates) still
 * exists, but the "Templates" nav item now points at a real page instead of an
 * on-page anchor.
 *
 * Blog posts (/blogs) ARE kept, unlike Help — this domain has its own blog
 * (content/blogPosts.ts) for PDF2Video-specific SEO/marketing content, written
 * fresh rather than mirrored from blog2video.app.
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
 * Footer mirrors ../frontend's group structure, but every link is the
 * document-first equivalent: /pdf-to-video and /docx-to-video lead instead of
 * /blog-to-video, and the use-case column leads with researchers/educators
 * rather than bloggers. Every path here is a real page in `marketingPages`,
 * `tools`, or the static route list — the assertion for that is the link check
 * against getPublicPaths().
 *
 * Help is intentionally listed but resolves to an empty hub page (HelpHub.tsx)
 * — this domain must not serve a second copy of blog2video.app's indexed help
 * articles. Tools now has its own column of real pages.
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
    title: "Free Tools",
    links: [toolsHub.path, ...tools.map((tool) => tool.path)],
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
  if (path === toolsHub.path) return "Tools";

  const marketingPage = getMarketingPage(path);
  if (marketingPage) return marketingPage.heroTitle;

  const tool = getToolByPath(path);
  if (tool) return tool.title;

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
    toolsHub.path,
    ...marketingPages.map((page) => page.path),
    ...tools.map((tool) => tool.path),
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
  if (path === toolsHub.path) {
    return { path, label: "Free Tools", description: toolsHub.description };
  }

  const marketingPage = getMarketingPage(path);
  if (marketingPage) {
    return { path, label: marketingPage.heroTitle, description: marketingPage.description };
  }

  const tool = getToolByPath(path);
  if (tool) {
    return { path, label: tool.title, description: tool.description };
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
export { blogPosts, defaultCta, getTool, getToolByPath, templateProfiles, tools, toolsHub };
