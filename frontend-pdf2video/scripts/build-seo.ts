import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  blogPosts,
  defaultOgImage,
  getBlogPost,
  getMarketingPage,
  getPublicPaths,
  getRelatedBlogPosts,
  getToolByPath,
  marketingPages,
  siteName,
  siteUrl,
  tools,
  toolsHub,
} from "../src/content/siteContent";
import type { BlogPost, MarketingPage, ToolDefinition } from "../src/content/seoTypes";
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
  marketingPageSchema,
  pricingSchema,
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
  return `<main><article>${heroImg}<p>${escapeHtml(post.heroEyebrow)}</p><h1>${escapeHtml(post.heroTitle)}</h1><p>${escapeHtml(post.heroDescription)}</p><time datetime="${post.publishedAt}">${post.publishedAt}</time>${sectionsHtml}${faqHtml}</article>${renderRelatedPostsHtml(post)}</main>`;
}

function renderRelatedPostsHtml(post: BlogPost): string {
  const related = getRelatedBlogPosts(post, 4);
  if (!related.length) return "";
  const items = related
    .map(
      (entry) =>
        `<li><a href="/blogs/${entry.slug}"><h3>${escapeHtml(entry.title)}</h3></a><p>${escapeHtml(entry.description)}</p></li>`
    )
    .join("");
  return `<nav aria-label="Related articles"><h2>Related articles</h2><ul>${items}</ul></nav>`;
}

function renderBlogIndexHtml(posts: BlogPost[]): string {
  if (!posts.length) {
    return `<main><h1>Blog</h1><p>We're just getting started here — first posts are on the way.</p></main>`;
  }
  const sorted = [...posts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const postsHtml = sorted
    .map(
      (post) =>
        `<article><a href="/blogs/${post.slug}"><h2>${escapeHtml(post.title)}</h2></a><p>${escapeHtml(post.description)}</p><time datetime="${post.publishedAt}">${post.publishedAt}</time></article>`
    )
    .join("");
  return `<main><h1>Blog</h1>${postsHtml}</main>`;
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

function renderToolsHubHtml(): string {
  const toolsHtml = tools
    .map(
      (tool) =>
        `<article><a href="${tool.path}"><h2>${escapeHtml(tool.title)}</h2></a><p>${escapeHtml(tool.description)}</p></article>`
    )
    .join("");
  return `<main><h1>${escapeHtml(toolsHub.heroTitle)}</h1><p>${escapeHtml(toolsHub.heroDescription)}</p>${toolsHtml}</main>`;
}

/**
 * Tool pages render their widget client-side, so the prerendered markup carries
 * the article half only — the H1, the proof points, the prose, and the FAQ. That
 * is the part a crawler can read anyway; the widget is a form.
 */
function renderToolPageHtml(tool: ToolDefinition): string {
  const proofHtml = tool.proofPoints.length
    ? `<ul>${tool.proofPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul>`
    : "";
  const sectionsHtml = tool.sections
    .map((section) => {
      const body = section.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
      const bullets = section.bullets?.length
        ? `<ul>${section.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>`
        : "";
      return `<section><h2>${escapeHtml(section.title)}</h2>${body}${bullets}</section>`;
    })
    .join("");
  const faqHtml = tool.faq.length
    ? `<section><h2>Frequently Asked Questions</h2>${tool.faq
        .map((entry) => `<div><h3>${escapeHtml(entry.question)}</h3><p>${escapeHtml(entry.answer)}</p></div>`)
        .join("")}</section>`
    : "";
  return `<main><p>${escapeHtml(tool.eyebrow)}</p><h1>${escapeHtml(tool.heroTitle)}</h1><p>${escapeHtml(tool.heroDescription)}</p>${proofHtml}${sectionsHtml}${faqHtml}</main>`;
}

/**
 * Server-rendered pdf2video hero.
 *
 * The SPA is JavaScript-rendered, which costs crawlability. This is a
 * brand-new homepage with no authority to fall back on, so its H1 and opening
 * copy ship in the HTML rather than waiting for hydration.
 */
function renderPdfHomeHtml(): string {
  return `<main><h1>Turn your PDF into a video in minutes</h1><p>Nobody opens the PDF. Everybody watches the video.</p><p>Upload a document. Get a narrated, branded video in minutes. Reports, whitepapers, research notes, decks, and one-pagers. No editor, no camera, no timeline to fight with.</p><section><h2>The PDF graveyard</h2><p>Documents are the worst performing format you own. They ask for a quiet room and twenty uninterrupted minutes, and nobody has either. Meanwhile the same argument, narrated over clean visuals, gets watched to the end on a phone in a lift.</p></section><section><h2>Three steps. Four minutes.</h2><h3>Upload your document</h3><p>Drop in a PDF, Word doc, or slide deck. We pull out the structure, the headings, the key figures, and the argument.</p><h3>Pick your look and voice</h3><p>Choose a template and a narrator. Add your logo and brand colours once and every future video inherits them.</p><h3>Download and publish</h3><p>Get an MP4 ready for LinkedIn, YouTube, email, or your own site.</p></section><section><h2>Why this is not another AI video generator</h2><p>Most AI video tools generate footage. PDF2Video renders. Every frame is drawn from a real design system, which means your figures are your figures, your quotes are word for word, and your logo is the right shade of your logo.</p></section></main>`;
}

function getAppHtml(routePath: string): string {
  if (routePath === "/") return renderPdfHomeHtml();
  if (routePath === "/blogs") return renderBlogIndexHtml(blogPosts);
  if (routePath === toolsHub.path) return renderToolsHubHtml();
  if (routePath.startsWith("/blogs/")) {
    const post = getBlogPost(routePath.replace("/blogs/", ""));
    if (post) return renderBlogPostHtml(post);
  }

  const tool = getToolByPath(routePath);
  if (tool) return renderToolPageHtml(tool);

  const page = getMarketingPage(routePath);
  if (page) return renderMarketingPageHtml(page);

  return "";
}

function getSeoPayload(routePath: string): SeoPayload {
  if (routePath === "/") {
    return {
      title: "PDF to Video: Turn Any Document Into a Narrated Video",
      description:
        "Upload a PDF, report, or whitepaper. Get a branded, narrated video in minutes. No editors, no cameras, no generic AI slop. Free to try.",
      path: routePath,
      schema: homepageSchema(),
    };
  }

  if (routePath === "/pricing") {
    return {
      title: "Pricing",
      description: `${siteName} pricing for free, pay-as-you-go, Standard, Pro, and custom team plans.`,
      path: routePath,
      schema: pricingSchema(),
    };
  }

  if (routePath === "/contact") {
    return {
      title: "Contact",
      description: `Talk to ${siteName} about support, enterprise use cases, custom deployments, and team workflows.`,
      path: routePath,
      schema: contactSchema(),
    };
  }

  if (routePath === "/blogs") {
    return {
      title: "Blog",
      description: `Document-to-video workflows and research publishing playbooks for ${siteName}.`,
      path: routePath,
      schema: blogIndexSchema(),
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

  if (routePath === toolsHub.path) {
    return {
      title: toolsHub.title,
      description: toolsHub.description,
      path: routePath,
      schema: toolsHubSchema(),
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

  const tool = getToolByPath(routePath);
  if (tool) {
    return {
      title: tool.title,
      description: tool.description,
      path: routePath,
      schema: toolPageSchema(tool),
    };
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

  return {
    title: siteName,
    description: "Turn written content into polished videos.",
    path: routePath,
  };
}

/**
 * Intrinsic size of `defaultOgImage` (public/assets/PDF2Vid.png).
 *
 * LinkedIn and WhatsApp in particular are more reliable at rendering a large
 * card when width/height are declared, since it saves them fetching the image
 * before deciding on a layout. Keep in sync if the banner is replaced — the
 * build asserts these match the real file.
 */
const OG_IMAGE_WIDTH = 1672;
const OG_IMAGE_HEIGHT = 941;

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
<meta property="og:image:width" content="${OG_IMAGE_WIDTH}" />
<meta property="og:image:height" content="${OG_IMAGE_HEIGHT}" />
<meta property="og:image:alt" content="${escapeHtml(siteName)}" />
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
  // /help is still an empty, noindex hub page (HelpHub.tsx) so its nav item
  // resolves; it carries no article content and is deliberately kept out of
  // getPublicPaths(), so it is neither prerendered nor listed here. /tools and
  // /blogs ARE included, but only ever with PDF2Video's own tools and posts
  // (content/tools.ts, content/blogPosts.ts) — never a copy of anything
  // indexed on blog2video.app. That's what actually keeps this domain free of
  // duplicate content, more so than any route removal or robots meta tag.
  const allPaths = getPublicPaths().filter(isCanonicalPath);

  const sitemapPages = createUrlSet(allPaths);
  const now = new Date().toISOString();

  const robots = `User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /project/
Disallow: /subscription
Disallow: /api/

Sitemap: ${siteUrl}/sitemap.xml
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
      tools: tools.map((tool) => ({
        path: tool.path,
        category: tool.category,
        primaryKeyword: tool.primaryKeyword,
      })),
    },
    null,
    2
  );

  const searchChecklist = `# Search Console And Bing Setup

1. Deploy the current build.
2. Verify ${siteUrl} in Google Search Console.
3. Verify ${siteUrl} in Bing Webmaster Tools.
4. Submit ${siteUrl}/sitemap.xml.
5. Create page-type filters using the generated \`seo-route-manifest.json\`.
6. Review impressions, CTR, and index coverage weekly.
`;

  await Promise.all([
    writeFile(path.join(distDir, "robots.txt"), robots, "utf8"),
    writeFile(path.join(distDir, "sitemap.xml"), sitemapPages, "utf8"),
    writeFile(path.join(distDir, "seo-route-manifest.json"), routeManifest, "utf8"),
    writeFile(path.join(distDir, "search-console-checklist.md"), searchChecklist, "utf8"),
  ]);
}

/**
 * Fail the build if the share banner is missing, or if OG_IMAGE_WIDTH/HEIGHT
 * have drifted from the real file. A wrong-but-plausible og:image:width makes
 * crawlers lay the card out incorrectly, which is invisible until someone
 * shares a link — so catch it here instead.
 */
async function assertOgImage() {
  const relative = defaultOgImage.replace(siteUrl, "");
  const file = path.join(distDir, relative);
  let bytes: Awaited<ReturnType<typeof readFile>>;
  try {
    bytes = await readFile(file);
  } catch {
    throw new Error(
      `og:image missing from build output: ${relative}\n` +
        `defaultOgImage (content/siteContent.ts) must point at a file in public/.`,
    );
  }
  // PNG: IHDR width/height are big-endian uint32s at byte offsets 16 and 20.
  const isPng = bytes.subarray(1, 4).toString("ascii") === "PNG";
  if (!isPng) return; // only PNG is introspected; other formats are trusted
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== OG_IMAGE_WIDTH || height !== OG_IMAGE_HEIGHT) {
    throw new Error(
      `og:image dimensions out of sync: ${relative} is ${width}×${height}, ` +
        `but build-seo.ts declares ${OG_IMAGE_WIDTH}×${OG_IMAGE_HEIGHT}. ` +
        `Update OG_IMAGE_WIDTH/OG_IMAGE_HEIGHT.`,
    );
  }
}

async function main() {
  await assertOgImage();
  await buildPrerenderedPages();
  await buildSeoFiles();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
