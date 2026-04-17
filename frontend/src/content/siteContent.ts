import { alternativePages } from "./alternativePages";
import { blogPosts } from "./blogPosts";
import { coreCommercialPages } from "./corePages";
import { featurePages } from "./featurePages";
import { defaultCta, templateProfiles } from "./marketingBase";
import { programmaticPages } from "./programmaticPages";
import { resourcePages } from "./resourcePages";
import type { BlogPost, MarketingPage } from "./seoTypes";
import { getSubstackDirectoryPage, substackDirectoryPaths } from "./substackDirectory";
import { templatePages } from "./templatePages";
import { getTool, getToolByPath, tools, toolsHub } from "./tools";
import { useCasePages } from "./useCasePages";

export const siteUrl = "https://blog2video.app";
export const siteName = "Blog2Video";
export const defaultOgImage = `${siteUrl}/og-image-v2.png`;
export const organizationName = "FireBird Technologies";

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
  { href: "/blog-to-video", label: "Blog to Video" },
  { href: "/for-technical-bloggers", label: "Use Cases" },
  { href: "/templates/geometric-explainer", label: "Templates" },
  { href: toolsHub.path, label: "Tools" },
  { href: "/blogs", label: "Blog" },
  { href: "/pricing", label: "Pricing" },
];

export const templateMenuLinks = [
  ...templateProfiles.map((template) => ({
    href: `/templates/${template.slug}`,
    label: template.name,
    description: template.bestFor.split(",")[0].trim(),
  })),
  {
    href: "/custom-branded-video-templates",
    label: "Custom Templates",
    description: "Create a reusable branded template from your website or brand system.",
  },
];

export const toolsMenuLinks = [
  {
    href: toolsHub.path,
    label: "All Tools",
    description: "Browse calculators, analyzers, formatters, generators, and the Substack directory.",
  },
  ...tools.map((tool) => ({
    href: tool.path,
    label: tool.title,
    description: tool.description,
  })),
];

export const footerGroups = [
  {
    title: "Core Workflows",
    links: [
      "/blog-to-video",
      "/article-to-video",
      "/url-to-video",
      "/pdf-to-video",
      "/blog-to-youtube-video",
      "/blog-to-shorts",
    ],
  },
  {
    title: "Use Cases",
    links: [
      "/for-technical-bloggers",
      "/for-technical-writers",
      "/for-educators",
      "/for-researchers",
      "/for-medium-writers",
      "/for-substack-writers",
    ],
  },
  {
    title: "Templates",
    links: [
      "/templates/nightfall",
      "/templates/newscast",
      "/templates/spotlight",
      "/templates/whiteboard",
      "/templates/gridcraft",
      "/templates/matrix",
      "/templates/newspaper",
      "/templates/geometric-explainer",
      "/custom-branded-video-templates",
    ],
  },
  {
    title: "Comparisons",
    links: [
      "/lumen5-alternative",
      "/pictory-alternative",
      "/blog2video-vs-lumen5",
      "/blog2video-vs-pictory",
      "/blog2video-vs-invideo",
      "/blog2video-vs-descript",
    ],
  },
  {
    title: "Tools",
    links: [
      toolsHub.path,
      "/tools/medium-partner-program-earnings-calculator",
      "/tools/substack-revenue-calculator",
      "/tools/markdown-to-medium-substack-formatter",
      "/tools/headline-analyzer",
      "/tools/quote-card-generator",
    ],
  },
  {
    title: "Resources",
    links: [
      "/distribution-flywheel",
      "/measurement-playbook",
      "/blogs",
      "/contact",
      "/pricing",
    ],
  },
];

export const featuredPagePaths = [
  "/blog-to-video",
  "/pdf-to-video",
  "/for-technical-bloggers",
  "/for-medium-writers",
  "/distribution-flywheel",
  "/measurement-playbook",
];

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

  const substackDirectoryPage = getSubstackDirectoryPage(path);
  if (substackDirectoryPage) return substackDirectoryPage.title;

  return "Blog2Video";
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
    ...substackDirectoryPaths,
    ...blogPosts.map((post) => `/blogs/${post.slug}`),
  ];
}

export function getPublicLinkDetails(path: string) {
  if (path === "/blogs") {
    return {
      path,
      label: "Blog",
      description:
        "Educational content, SEO workflows, repurposing playbooks, and product updates for Blog2Video.",
    };
  }

  if (path === "/pricing") {
    return {
      path,
      label: "Pricing",
      description: "Blog2Video pricing for free, pay-as-you-go, Standard, Pro, and custom team plans.",
    };
  }

  if (path === "/contact") {
    return {
      path,
      label: "Contact",
      description: "Talk to Blog2Video about support, enterprise use cases, and team workflows.",
    };
  }

  if (path === toolsHub.path) {
    return {
      path,
      label: "Tools",
      description: toolsHub.description,
    };
  }

  const marketingPage = getMarketingPage(path);
  if (marketingPage) {
    return {
      path,
      label: marketingPage.heroTitle,
      description: marketingPage.description,
    };
  }

  const tool = getToolByPath(path);
  if (tool) {
    return {
      path,
      label: tool.title,
      description: tool.description,
    };
  }

  if (path.startsWith("/blogs/")) {
    const post = getBlogPost(path.replace("/blogs/", ""));
    if (post) {
      return {
        path,
        label: post.title,
        description: post.description,
      };
    }
  }

  const substackDirectoryPage = getSubstackDirectoryPage(path);
  if (substackDirectoryPage) {
    return {
      path,
      label: substackDirectoryPage.title,
      description: substackDirectoryPage.description,
    };
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

export {
  blogPosts,
  defaultCta,
  getTool,
  getToolByPath,
  templateProfiles,
  tools,
  toolsHub,
};
