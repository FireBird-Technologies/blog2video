import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  blogPosts,
  defaultOgImage,
  getBlogPost,
  getHelpPost,
  getMarketingPage,
  getPublicPaths,
  getToolByPath,
  helpPosts,
  marketingPages,
  siteName,
  siteUrl,
  tools,
  toolsHub,
} from "../src/content/siteContent";
import {
  getSubstackDirectoryNichePath,
  getSubstackDirectoryPage,
  getSubstackNichePublications,
  pricingLabels,
  type SubstackDirectoryPage,
} from "../src/content/substackDirectory";
import type { BlogPost, HelpPost, MarketingPage, ToolDefinition } from "../src/content/seoTypes";
import {
  normalizeSchemaForJsonLd,
  SEO_JSON_LD_SCRIPT_ID,
  type JsonLdInput,
} from "../src/seo/jsonLd";
import {
  blogIndexSchema,
  blogPostSchema,
  contactSchema,
  homepageSchema,
  helpIndexSchema,
  helpPostSchema,
  marketingPageSchema,
  pricingSchema,
  substackDirectoryNicheSchema,
  substackDirectoryPublicationSchema,
  toolPageSchema,
  toolsHubSchema,
} from "../src/seo/schema";

const frontendRoot = process.cwd();
const distDir = path.join(frontendRoot, "dist");

type SeoPayload = {
  title: string;
  description: string;
  path: string;
  /** Set when this URL is a duplicate that should consolidate onto another URL. */
  canonicalPath?: string;
  image?: string;
  schema?: Record<string, unknown>[] | Record<string, unknown>;
  noindex?: boolean;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderBlogPostHtml(post: BlogPost): string {
  const heroImg = post.heroImage
    ? `<img src="${post.heroImage}" alt="${escapeHtml(post.heroImageAlt ?? "")}" />`
    : "";
  const sectionsHtml = post.sections
    .map((s) => {
      const paras = s.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
      const bullets = s.bullets?.length
        ? `<ul>${s.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`
        : "";
      return `<section><h2>${escapeHtml(s.heading)}</h2>${paras}${bullets}</section>`;
    })
    .join("");
  const faqHtml = post.faq.length
    ? `<section><h2>Frequently Asked Questions</h2>${post.faq
        .map((f) => `<div><h3>${escapeHtml(f.question)}</h3><p>${escapeHtml(f.answer)}</p></div>`)
        .join("")}</section>`
    : "";
  return `<main><article>${heroImg}<p>${escapeHtml(post.heroEyebrow)}</p><h1>${escapeHtml(post.heroTitle)}</h1><p>${escapeHtml(post.heroDescription)}</p><time datetime="${post.publishedAt}">${post.publishedAt}</time>${sectionsHtml}${faqHtml}</article></main>`;
}

function renderBlogIndexHtml(posts: BlogPost[]): string {
  const sorted = [...posts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const postsHtml = sorted
    .map(
      (post) =>
        `<article><a href="/blogs/${post.slug}"><h2>${escapeHtml(post.title)}</h2></a><p>${escapeHtml(post.description)}</p><time datetime="${post.publishedAt}">${post.publishedAt}</time></article>`
    )
    .join("");
  return `<main><h1>Blog</h1>${postsHtml}</main>`;
}

function renderHelpPostHtml(post: HelpPost): string {
  const stepsHtml = post.steps
    .map((s) => {
      const body = s.body.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
      const bullets = s.bullets?.length
        ? `<ul>${s.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`
        : "";
      return `<section><h2>${escapeHtml(s.title)}</h2>${body}${bullets}</section>`;
    })
    .join("");
  const faqHtml = post.faq.length
    ? `<section><h2>Frequently Asked Questions</h2>${post.faq
        .map((f) => `<div><h3>${escapeHtml(f.question)}</h3><p>${escapeHtml(f.answer)}</p></div>`)
        .join("")}</section>`
    : "";
  return `<main><article><h1>${escapeHtml(post.heroTitle)}</h1><p>${escapeHtml(post.heroDescription)}</p>${stepsHtml}${faqHtml}</article></main>`;
}

function renderHelpIndexHtml(posts: HelpPost[]): string {
  const postsHtml = posts
    .map(
      (post) =>
        `<article><a href="/help/${post.slug}"><h2>${escapeHtml(post.title)}</h2></a><p>${escapeHtml(post.description)}</p></article>`
    )
    .join("");
  return `<main><h1>Help</h1>${postsHtml}</main>`;
}

function renderMarketingPageHtml(page: MarketingPage): string {
  const sectionsHtml = page.sections
    .map((s) => {
      const body = s.body.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
      const bullets = s.bullets?.length
        ? `<ul>${s.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`
        : "";
      return `<section><h2>${escapeHtml(s.title)}</h2>${body}${bullets}</section>`;
    })
    .join("");
  const faqHtml = page.faq.length
    ? `<section><h2>Frequently Asked Questions</h2>${page.faq
        .map((f) => `<div><h3>${escapeHtml(f.question)}</h3><p>${escapeHtml(f.answer)}</p></div>`)
        .join("")}</section>`
    : "";
  return `<main><h1>${escapeHtml(page.heroTitle)}</h1><p>${escapeHtml(page.heroDescription)}</p>${sectionsHtml}${faqHtml}</main>`;
}

function renderFaqHtml(faq: { question: string; answer: string }[]): string {
  if (!faq.length) return "";
  return `<section><h2>Frequently Asked Questions</h2>${faq
    .map((f) => `<div><h3>${escapeHtml(f.question)}</h3><p>${escapeHtml(f.answer)}</p></div>`)
    .join("")}</section>`;
}

function renderToolsHubHtml(): string {
  const toolsHtml = tools
    .map(
      (tool) =>
        `<article><a href="${tool.path}"><h2>${escapeHtml(tool.title)}</h2></a><p>${escapeHtml(tool.description)}</p></article>`
    )
    .join("");
  return `<main><h1>${escapeHtml(toolsHub.heroTitle)}</h1><p>${escapeHtml(toolsHub.heroDescription)}</p>${toolsHtml}</main>`;
}

function renderToolPageHtml(tool: ToolDefinition): string {
  const sectionsHtml = tool.sections
    .map((s) => {
      const body = s.body.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
      const bullets = s.bullets?.length
        ? `<ul>${s.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`
        : "";
      return `<section><h2>${escapeHtml(s.title)}</h2>${body}${bullets}</section>`;
    })
    .join("");
  const proofHtml = tool.proofPoints?.length
    ? `<ul>${tool.proofPoints.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>`
    : "";
  return `<main><p>${escapeHtml(tool.eyebrow)}</p><h1>${escapeHtml(tool.heroTitle)}</h1><p>${escapeHtml(tool.heroDescription)}</p>${proofHtml}${sectionsHtml}${renderFaqHtml(tool.faq)}</main>`;
}

function renderSubstackDirectoryHtml(page: SubstackDirectoryPage): string {
  if (page.kind === "publication") {
    const { publication } = page;
    const bestFor = publication.bestFor.length
      ? `<ul>${publication.bestFor.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`
      : "";
    return `<main><article><h1>${escapeHtml(publication.name)}</h1><p>${escapeHtml(publication.tagline)}</p><p>${escapeHtml(publication.description)}</p><section><h2>Who it is for</h2><p>${escapeHtml(publication.audience)}</p>${bestFor}</section><section><h2>Publication details</h2><ul><li>Pricing: ${escapeHtml(pricingLabels[publication.pricingModel])}</li><li>Cadence: ${escapeHtml(publication.cadence)}</li><li>Tone: ${escapeHtml(publication.tone)}</li></ul><p>${escapeHtml(publication.differentiator)}</p></section>${renderFaqHtml(page.faq)}</article></main>`;
  }

  const { niche } = page;
  const publicationsHtml = page.publications
    .map(
      (publication) =>
        `<article><a href="/tools/substack-directory/publication/${publication.slug}"><h3>${escapeHtml(publication.name)}</h3></a><p>${escapeHtml(publication.tagline)}</p><p>${escapeHtml(pricingLabels[publication.pricingModel])} · ${escapeHtml(publication.cadence)}</p></article>`
    )
    .join("");
  return `<main><h1>${escapeHtml(page.title)}</h1><p>${escapeHtml(page.description)}</p><p>${escapeHtml(niche.audience)}</p><p>${escapeHtml(niche.angle)}</p><section><h2>Publications</h2>${publicationsHtml}</section>${renderFaqHtml(page.faq)}</main>`;
}

function getAppHtml(routePath: string): string {
  if (routePath === "/blogs") return renderBlogIndexHtml(blogPosts);
  if (routePath.startsWith("/blogs/")) {
    const post = getBlogPost(routePath.replace("/blogs/", ""));
    if (post) return renderBlogPostHtml(post);
  }
  if (routePath === "/help") return renderHelpIndexHtml(helpPosts);
  if (routePath.startsWith("/help/")) {
    const post = getHelpPost(routePath.replace("/help/", ""));
    if (post) return renderHelpPostHtml(post);
  }
  const page = getMarketingPage(routePath);
  if (page) return renderMarketingPageHtml(page);

  if (routePath === toolsHub.path) return renderToolsHubHtml();

  const tool = getToolByPath(routePath);
  if (tool) return renderToolPageHtml(tool);

  const directoryPage = getSubstackDirectoryPage(routePath);
  if (directoryPage) return renderSubstackDirectoryHtml(directoryPage);

  return "";
}

// A pricing filter that resolves to the same publications as its parent niche is a
// duplicate of that niche page. This happens when every publication in the niche
// shares one pricing model, or when nothing matches and getSubstackNichePublications
// falls back to returning the full list. Such pages stay crawlable and useful, but
// they consolidate onto the parent niche instead of competing with it.
function getDuplicatePricingParentPath(page: SubstackDirectoryPage): string | undefined {
  if (page.kind !== "niche" || !page.pricing) return undefined;

  const toKey = (publications: { slug: string }[]) =>
    publications
      .map((publication) => publication.slug)
      .sort()
      .join(",");

  const parentKey = toKey(getSubstackNichePublications(page.niche));
  if (toKey(page.publications) !== parentKey) return undefined;

  return getSubstackDirectoryNichePath(page.niche.slug);
}

function getSeoPayload(routePath: string): SeoPayload {
  if (routePath === "/") {
    return {
      title: "Turn Blog Posts Into Videos",
      description:
        "Turn blog posts, articles, PDFs, and documents into narrated videos with templates, voiceover, scene editing, and cross-channel distribution workflows.",
      path: routePath,
      schema: homepageSchema(),
    };
  }

  if (routePath === "/pricing") {
    return {
      title: "Pricing",
      description:
        "Blog2Video pricing for free, pay-as-you-go, Standard, Pro, and custom team plans.",
      path: routePath,
      schema: pricingSchema(),
    };
  }

  if (routePath === "/contact") {
    return {
      title: "Contact",
      description:
        "Talk to Blog2Video about support, enterprise use cases, custom deployments, and team workflows.",
      path: routePath,
      schema: contactSchema(),
    };
  }

  if (routePath === "/blogs") {
    return {
      title: "Blog",
      description:
        "Educational content, SEO workflows, repurposing playbooks, and programmatic-video strategy for Blog2Video.",
      path: routePath,
      schema: blogIndexSchema(),
    };
  }

  if (routePath === "/help") {
    return {
      title: "Help / How-to",
      description:
        "Step-by-step Blog2Video help guides with embedded explainers for creating projects, editing scenes, changing voiceover, and working with templates.",
      path: routePath,
      schema: helpIndexSchema(),
    };
  }

  if (routePath === "/404") {
    return {
      title: "Page Not Found",
      description: "The page you requested could not be found.",
      path: routePath,
      noindex: true,
    };
  }

  if (routePath.startsWith("/blogs/")) {
    const post = getBlogPost(routePath.replace("/blogs/", ""));
    if (post) {
      return {
        title: post.title,
        description: post.description,
        path: routePath,
        image: post.heroImage ? `${siteUrl}${post.heroImage}` : undefined,
        schema: blogPostSchema(post),
      };
    }
  }

  if (routePath.startsWith("/help/")) {
    const post = getHelpPost(routePath.replace("/help/", ""));
    if (post) {
      return {
        title: post.title,
        description: post.description,
        path: routePath,
        image: post.heroImage ? `${siteUrl}${post.heroImage}` : undefined,
        schema: helpPostSchema(post),
      };
    }
  }

  const page = getMarketingPage(routePath);
  if (page) {
    return {
      title: page.title,
      description: page.description,
      path: routePath,
      schema: marketingPageSchema(page),
    };
  }

  if (routePath === toolsHub.path) {
    return {
      title: toolsHub.title,
      description: toolsHub.description,
      path: routePath,
      schema: toolsHubSchema(),
    };
  }

  const tool = getToolByPath(routePath);
  if (tool) {
    return {
      title: tool.title,
      description: tool.description,
      path: routePath,
      schema: toolPageSchema(tool),
    };
  }

  const directoryPage = getSubstackDirectoryPage(routePath);
  if (directoryPage) {
    return {
      title: directoryPage.title,
      description: directoryPage.description,
      path: routePath,
      canonicalPath: getDuplicatePricingParentPath(directoryPage),
      schema:
        directoryPage.kind === "publication"
          ? substackDirectoryPublicationSchema(
              directoryPage.publication,
              directoryPage.path,
              directoryPage.faq
            )
          : substackDirectoryNicheSchema(
              directoryPage.niche,
              directoryPage.publications,
              directoryPage.path,
              directoryPage.faq,
              directoryPage.pricing
            ),
    };
  }

  return {
    title: siteName,
    description: "Turn written content into polished videos.",
    path: routePath,
  };
}

function buildHeadTags(routePath: string) {
  const payload = getSeoPayload(routePath);
  const canonicalUrl = `${siteUrl}${payload.canonicalPath ?? payload.path}`;
  const fullTitle = payload.title.includes(siteName)
    ? payload.title
    : `${payload.title} | ${siteName}`;
  const ogImage = payload.image ?? defaultOgImage;

  return `
<title>${escapeHtml(fullTitle)}</title>
<meta name="description" content="${escapeHtml(payload.description)}" />
<meta name="robots" content="${payload.noindex ? "noindex, nofollow" : "index, follow"}" />
<link rel="canonical" href="${canonicalUrl}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${siteName}" />
<meta property="og:title" content="${escapeHtml(fullTitle)}" />
<meta property="og:description" content="${escapeHtml(payload.description)}" />
<meta property="og:url" content="${canonicalUrl}" />
<meta property="og:image" content="${ogImage}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(fullTitle)}" />
<meta name="twitter:description" content="${escapeHtml(payload.description)}" />
<meta name="twitter:image" content="${ogImage}" />
${
  payload.schema
    ? `<script type="application/ld+json" id="${SEO_JSON_LD_SCRIPT_ID}">${JSON.stringify(
        normalizeSchemaForJsonLd(payload.schema as JsonLdInput)
      )}</script>`
    : ""
}
`.trim();
}

function renderUrl(url: string) {
  const appHtml = getAppHtml(url);
  const head = buildHeadTags(url);
  return { appHtml, head };
}

function normalizePath(routePath: string) {
  return routePath === "/" ? "/" : routePath.replace(/\/+$/, "");
}

function toFilePath(routePath: string) {
  const normalized = normalizePath(routePath);
  if (normalized === "/") return path.join(distDir, "index.html");
  return path.join(distDir, normalized.slice(1), "index.html");
}

async function ensureDirFor(filePath: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

// The homepage is written back to dist/index.html, which is also the file we read
// as the template. Re-running this script without a fresh `vite build` would
// otherwise read the rendered homepage as the template and inject the homepage's
// head into every page, compounding once per run. Sanitizing first makes the
// build idempotent no matter what state dist/index.html is in.
function sanitizeTemplate(template: string) {
  return template
    .replace(/<title>[\s\S]*?<\/title>\s*/gi, "")
    .replace(/<meta\s+name="description"[^>]*>\s*/gi, "")
    .replace(/<meta\s+name="robots"[^>]*>\s*/gi, "")
    .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, "")
    .replace(/<meta\s+property="og:[^"]*"[^>]*>\s*/gi, "")
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*>\s*/gi, "")
    .replace(
      new RegExp(
        `<script\\s+type="application/ld\\+json"\\s+id="${SEO_JSON_LD_SCRIPT_ID}">[\\s\\S]*?</script>\\s*`,
        "gi"
      ),
      ""
    )
    .replace(/<div id="root">\s*<main>[\s\S]*<\/main>\s*<\/div>/i, '<div id="root"></div>');
}

function injectRenderedMarkup(template: string, appHtml: string, head: string) {
  return template
    .replace("<div id=\"root\"></div>", `<div id="root">${appHtml}</div>`)
    .replace("</head>", `${head}\n</head>`);
}

function createUrlSet(paths: string[]) {
  const lastmod = new Date().toISOString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths
  .map(
    (entry) => `  <url>
    <loc>${siteUrl}${entry}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${entry === "/" ? "1.0" : "0.8"}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;
}

async function buildPrerenderedPages() {
  const template = sanitizeTemplate(await readFile(path.join(distDir, "index.html"), "utf8"));
  const publicPaths = getPublicPaths();

  for (const routePath of publicPaths) {
    let rendered;
    try {
      rendered = renderUrl(routePath);
    } catch (error) {
      console.error(`Failed to prerender route: ${routePath}`);
      throw error;
    }

    const { appHtml, head } = rendered;
    const filePath = toFilePath(routePath);
    await ensureDirFor(filePath);
    await writeFile(filePath, injectRenderedMarkup(template, appHtml, head), "utf8");
  }
}

// A sitemap should only advertise canonical URLs. Pages that consolidate onto a
// different URL stay crawlable but are not submitted for indexing.
function isCanonicalPath(routePath: string) {
  const { canonicalPath } = getSeoPayload(routePath);
  return !canonicalPath || canonicalPath === routePath;
}

async function buildSeoFiles() {
  const allPaths = getPublicPaths().filter(isCanonicalPath);
  const blogPaths = blogPosts.map((post) => `/blogs/${post.slug}`);
  const pagePaths = allPaths.filter((entry) => !entry.startsWith("/blogs/"));

  const sitemapPages = createUrlSet(pagePaths);
  const sitemapBlogs = createUrlSet(blogPaths);
  const now = new Date().toISOString();

  const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${siteUrl}/sitemap-pages.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${siteUrl}/sitemap-blogs.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
</sitemapindex>
`;

  const robots = `User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /project/
Disallow: /subscription
Disallow: /api/

Sitemap: ${siteUrl}/sitemap.xml
Sitemap: ${siteUrl}/sitemap-index.xml
`;

  const routeManifest = JSON.stringify(
    {
      generatedAt: now,
      pages: marketingPages.map((page) => ({
        path: page.path,
        category: page.category,
        primaryKeyword: page.primaryKeyword,
      })),
      blogPosts: blogPosts.map((post) => ({
        path: `/blogs/${post.slug}`,
        category: post.category,
        primaryKeyword: post.primaryKeyword,
      })),
      helpPosts: helpPosts.map((post) => ({
        path: `/help/${post.slug}`,
        category: post.category,
        primaryKeyword: post.primaryKeyword,
      })),
    },
    null,
    2
  );

  const searchChecklist = `# Search Console And Bing Setup

1. Deploy the current build.
2. Verify ${siteUrl} in Google Search Console.
3. Verify ${siteUrl} in Bing Webmaster Tools.
4. Submit ${siteUrl}/sitemap-index.xml.
5. Submit ${siteUrl}/sitemap.xml.
6. Create page-type filters using the generated \`seo-route-manifest.json\`.
7. Review impressions, CTR, and index coverage weekly.
`;

  await Promise.all([
    writeFile(path.join(distDir, "robots.txt"), robots, "utf8"),
    writeFile(path.join(distDir, "sitemap.xml"), createUrlSet(allPaths), "utf8"),
    writeFile(path.join(distDir, "sitemap-pages.xml"), sitemapPages, "utf8"),
    writeFile(path.join(distDir, "sitemap-blogs.xml"), sitemapBlogs, "utf8"),
    writeFile(path.join(distDir, "sitemap-index.xml"), sitemapIndex, "utf8"),
    writeFile(path.join(distDir, "seo-route-manifest.json"), routeManifest, "utf8"),
    writeFile(path.join(distDir, "search-console-checklist.md"), searchChecklist, "utf8"),
  ]);
}

async function main() {
  await buildPrerenderedPages();
  await buildSeoFiles();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
