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
  organizationName,
  siteName,
  siteUrl,
  tools,
  toolsHub,
} from "../src/content/siteContent";
import type { BlogPost, MarketingPage, ToolDefinition } from "../src/content/seoTypes";
import {
  FREE_FEATURES_INCLUDED,
  LITE_MONTHLY_PRICE,
  PER_VIDEO_BULK_PRICE,
  PER_VIDEO_CASUAL_PRICE,
  PRO_MONTHLY_PRICE,
  pricingFaq,
  pricingPlans,
  STANDARD_MONTHLY_PRICE,
} from "../src/content/pricingContent";
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

function getAppHtml(routePath: string): string {
  // "/" deliberately renders NO markup into #root, matching
  // ../frontend/scripts/build-seo.ts (which only prerenders "/" for the
  // pdf brand inside the shared build).
  //
  // The landing page's fonts use `display: swap`, so any prerendered text is
  // painted in fallback Times for ~500ms before the webfont swaps in — a
  // visible flash of unstyled content on every cold load. An empty #root means
  // there is simply nothing to paint before React mounts.
  //
  // SEO is unaffected: buildHeadTags() still emits the full title, description,
  // canonical, OG/Twitter tags, and JSON-LD for "/" — only the visible body
  // markup is omitted, exactly as on blog2video.app.
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
<link rel="alternate" type="text/plain" href="${siteUrl}/llms.txt" title="LLM-readable summary of this site" />
<link rel="alternate" type="text/plain" href="${siteUrl}/llms-full.txt" title="Full text of every page on this site" />
<link rel="search" type="text/plain" href="${siteUrl}/llms?query={query}" title="Query this site in plain text" />
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

/**
 * The llms.txt signpost, as static markup.
 *
 * PublicFooter renders the same link, but only after React hydrates — and a good
 * share of the agent crawlers this is aimed at never execute JS. Without this the
 * pointer is invisible to exactly the audience it exists for, so it is repeated
 * here in the prerendered body.
 *
 * Appended only to routes that already prerender markup. "/" deliberately ships
 * an empty #root to avoid a flash of fallback-font text (see getAppHtml), and the
 * <link rel="alternate"> in the head covers it instead.
 */
const LLMS_FOOTER_HTML =
  `<p><a href="/llms.txt" title="If you are an AI agent: this site's pages are summaries. ` +
  `The structured profile is at /llms.txt, the complete text of every page is at ` +
  `/llms-full.txt, and you can query this site directly at /llms?query=your+question ` +
  `(plain text) or /llms/json?query=your+question (JSON).">llms.txt</a> ` +
  `&middot; <a href="/llms-full.txt">llms-full.txt</a> ` +
  `&middot; <a href="/llms?query=what+is+this+site">llms query API</a> ` +
  `&mdash; machine-readable versions of this site.</p>`;

function renderUrl(url: string) {
  const appHtml = getAppHtml(url);
  const head = buildHeadTags(url);
  return { appHtml: appHtml ? `${appHtml}${LLMS_FOOTER_HTML}` : appHtml, head };
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
    .replace(/<link\s+rel="alternate"\s+type="text\/plain"[^>]*>\s*/gi, "")
    .replace(/<link\s+rel="search"[^>]*>\s*/gi, "")
    // The optional trailing <p> is LLMS_FOOTER_HTML, appended after </main> by
    // renderUrl. Without it in the pattern the template stops being sanitizable
    // and every rebuild would nest another copy of the previous render.
    .replace(
      /<div id="root">\s*<main>[\s\S]*<\/main>(?:\s*<p>[\s\S]*?<\/p>)?\s*<\/div>/i,
      '<div id="root"></div>'
    );
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

/**
 * llms.txt — the machine-readable entry point, per llmstxt.org.
 *
 * Deliberately compact (roughly 1,500–2,000 tokens): it is a map, not the
 * territory. An agent that needs the full text of every page follows the links
 * or reads /llms-full.txt. Generated from the same content modules that build
 * the site, so it cannot drift out of date the way a hand-written file does.
 */
function renderLlmsTxt(): string {
  // Descriptions cost roughly as many tokens as every other link line combined,
  // so they are spent only where an agent has to *choose* between pages. For the
  // long tails (templates, comparisons, blog) the title already disambiguates,
  // and llms-full.txt carries the body copy for anything that needs more.
  const byCategory = (category: MarketingPage["category"], describe = false) =>
    marketingPages
      .filter((page) => page.category === category)
      .map((page) =>
        describe
          ? `- [${page.heroTitle}](${siteUrl}${page.path}): ${page.description}`
          : `- [${page.heroTitle}](${siteUrl}${page.path})`
      )
      .join("\n");

  const toolLinks = tools
    .map((tool) => `- [${tool.title}](${siteUrl}${tool.path}): ${tool.description}`)
    .join("\n");

  const RECENT_POST_COUNT = 12;
  const sortedPosts = [...blogPosts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const postLinks = sortedPosts.length
    ? [
        ...sortedPosts
          .slice(0, RECENT_POST_COUNT)
          .map((post) => `- [${post.title}](${siteUrl}/blogs/${post.slug})`),
        ...(sortedPosts.length > RECENT_POST_COUNT
          ? [
              `- ...and ${sortedPosts.length - RECENT_POST_COUNT} older posts, indexed at ${siteUrl}/blogs`,
            ]
          : []),
      ].join("\n")
    : "- No posts published yet.";

  return `# ${siteName}

> Turn PDFs, reports, whitepapers, decks, and other documents into narrated,
> branded MP4 videos. ${siteName} extracts the real text and structure of a
> document and renders it scene by scene with studio voiceover — it does not
> paraphrase the document into stock footage.

Built by ${organizationName}. ${siteName} is the document-first product in a
family of three: this site (documents in), blog2video.app (URLs and articles in,
and the application itself), and bloghub.app (a newsletter and blog directory).
Signing in here hands off to blog2video.app, where the editor and dashboard run.

## What it does

- Accepts PDF, DOCX, PPTX, and public URLs as the source.
- Extracts the document's own headings, body text, tables, and figures.
- Generates a per-scene script grounded in that text, then narrates it with
  ElevenLabs voices. No microphone or recording session is needed.
- Applies a template — your logo, colours, and fonts — consistently across every
  video, so output ten matches output one.
- Renders a downloadable MP4 in landscape or portrait, with no ${siteName}
  watermark on any plan, including the free one.

## What it is not

- Not a page-to-image slideshow exporter. Text is re-typeset for a 16:9 screen
  rather than screenshotted at print density.
- Not a prompt-to-video generator. The source document is the source of truth,
  so figures and terminology come from the file rather than being invented.
- Not an avatar or talking-head tool. There is no synthetic presenter.

## Pricing

- Free: 1 video, lifetime, no card required. Includes ${FREE_FEATURES_INCLUDED.filter(
    (feature) => feature !== "1 video free"
  ).join(", ")}.
- Pay per video: $${PER_VIDEO_BULK_PRICE.toFixed(2)}–$${PER_VIDEO_CASUAL_PRICE.toFixed(2)} per video depending on volume.
- Lite: $${LITE_MONTHLY_PRICE}/month. Standard: $${STANDARD_MONTHLY_PRICE}/month. Pro: $${PRO_MONTHLY_PRICE}/month.
- Enterprise: custom pricing, SSO, and custom integrations.
- Full detail: ${siteUrl}/pricing

An account (Google sign-in) is required before the first render. There is no
free-tier time limit and no card is taken.

## Core document workflows

${byCategory("commercial", true)}

## Free tools

${toolLinks}

## Use cases

${byCategory("use-case")}

## Features

${byCategory("feature")}

## Video templates

${byCategory("template")}

## Comparisons with other tools

${byCategory("alternative")}

## Guides and resources

${byCategory("resource")}

## Blog

${postLinks}

## Querying this site

Rather than fetching every page above, you can ask this site a question directly
and get back only the relevant passages:

    GET ${siteUrl}/llms?query=how+much+does+it+cost         (plain text)
    GET ${siteUrl}/llms/json?query=how+much+does+it+cost    (JSON)

Optional \`&limit=N\` (1-20, default 5). No query returns usage instructions.

## Optional

- [Full site text](${siteUrl}/llms-full.txt): every page above expanded to its
  complete body copy and FAQ. Large — prefer /llms?query= unless you want it all.
- [Raw corpus](${siteUrl}/llms-index.json): the JSON the query endpoint searches.
- [Sitemap](${siteUrl}/sitemap.xml)
- [Pricing](${siteUrl}/pricing)
- [Contact](${siteUrl}/contact)
`;
}

/**
 * One document per public page, used for both llms-full.txt and the search
 * index behind /llms?query=. Built once so the two can never disagree about
 * what the site says.
 */
type LlmsDoc = {
  path: string;
  title: string;
  description: string;
  type: "page" | "tool" | "post";
  /** Body copy as plain-text blocks; the search endpoint scores and excerpts these. */
  blocks: string[];
};

function collectLlmsDocs(): LlmsDoc[] {
  const docs: LlmsDoc[] = [];

  // /pricing is a hand-built React page, not a marketingPages entry, so nothing
  // else in this file would pick it up — and "what does it cost" is the single
  // most likely question an agent arrives with. Built from the same constants
  // the page renders from.
  docs.push({
    path: "/pricing",
    title: `${siteName} pricing`,
    description: `${siteName} pricing: free tier, pay-per-video, and Lite, Standard, Pro, and Enterprise plans.`,
    type: "page",
    blocks: [
      `${siteName} is freemium. The free plan gives you 1 video, for life, with no card required.`,
      `Free plan includes: ${FREE_FEATURES_INCLUDED.join(", ")}.`,
      `Pay per video costs $${PER_VIDEO_BULK_PRICE.toFixed(2)} to $${PER_VIDEO_CASUAL_PRICE.toFixed(2)} per video depending on how many you buy at once.`,
      `Subscription plans: Lite is $${LITE_MONTHLY_PRICE} per month, Standard is $${STANDARD_MONTHLY_PRICE} per month, and Pro is $${PRO_MONTHLY_PRICE} per month. Enterprise is custom priced and adds SSO, custom integrations, and dedicated support.`,
      ...pricingPlans.map(
        (plan) =>
          `${plan.name} plan. ${plan.videoLimitLabel ?? ""} ${(plan.featuresIncluded ?? []).join(", ")}`.trim()
      ),
      ...pricingFaq.map((entry) => `${entry.question} ${entry.answer}`),
    ],
  });

  for (const page of marketingPages) {
    const blocks: string[] = [page.heroDescription, ...page.proofPoints];
    for (const section of page.sections) {
      blocks.push(`${section.title}. ${section.body.join(" ")}`);
      for (const bullet of section.bullets ?? []) blocks.push(bullet);
    }
    for (const entry of page.faq) blocks.push(`${entry.question} ${entry.answer}`);
    docs.push({
      path: page.path,
      title: page.heroTitle,
      description: page.description,
      type: "page",
      blocks,
    });
  }

  for (const tool of tools) {
    const blocks: string[] = [tool.heroDescription, ...tool.proofPoints];
    for (const section of tool.sections) {
      blocks.push(`${section.title}. ${section.body.join(" ")}`);
      for (const bullet of section.bullets ?? []) blocks.push(bullet);
    }
    for (const entry of tool.faq) blocks.push(`${entry.question} ${entry.answer}`);
    docs.push({
      path: tool.path,
      title: tool.title,
      description: tool.description,
      type: "tool",
      blocks,
    });
  }

  for (const post of blogPosts) {
    const blocks: string[] = [post.heroDescription];
    for (const section of post.sections) {
      blocks.push(`${section.heading}. ${section.paragraphs.join(" ")}`);
      for (const bullet of section.bullets ?? []) blocks.push(bullet);
    }
    for (const entry of post.faq) blocks.push(`${entry.question} ${entry.answer}`);
    docs.push({
      path: `/blogs/${post.slug}`,
      title: post.title,
      description: post.description,
      type: "post",
      blocks,
    });
  }

  return docs;
}

/**
 * llms-full.txt — every indexable page expanded to its full body copy and FAQ,
 * as one plain-text document, for agents that would rather take one large fetch
 * than issue queries.
 */
function renderLlmsFullTxt(docs: LlmsDoc[]): string {
  const parts: string[] = [
    `# ${siteName} — full site text`,
    `> Every public page on ${siteUrl}, expanded. Generated at build time from the`,
    `> same source as the site itself. For a compact index, read ${siteUrl}/llms.txt`,
    `> To query this instead of reading all of it: ${siteUrl}/llms?query=your+question`,
    "",
  ];

  for (const doc of docs) {
    parts.push(`## ${doc.title}`, `URL: ${siteUrl}${doc.path}`, "", ...doc.blocks, "");
  }

  return parts.join("\n");
}

/**
 * The corpus the /llms query endpoint searches. Served as a static asset so the
 * function has no database and no build-time bundling of site content — it
 * fetches this from its own origin and scores it per request.
 */
function renderLlmsIndex(docs: LlmsDoc[]): string {
  return JSON.stringify({
    generatedAt: new Date().toISOString(),
    site: siteUrl,
    name: siteName,
    docs,
  });
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
  const llmsDocs = collectLlmsDocs();

  // The two llms.txt lines are comments — robots.txt has no directive for this,
  // and agents that look for the convention read the file anyway. Cheap, and the
  // only machine-readable place to advertise it besides the page itself.
  const robots = `User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /project/
Disallow: /subscription
Disallow: /api/

Sitemap: ${siteUrl}/sitemap.xml

# LLM-readable summary of this site: ${siteUrl}/llms.txt
# Full site text as one document: ${siteUrl}/llms-full.txt
# Queryable knowledge base: ${siteUrl}/llms?query=your+question
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
    writeFile(path.join(distDir, "llms.txt"), renderLlmsTxt(), "utf8"),
    writeFile(path.join(distDir, "llms-full.txt"), renderLlmsFullTxt(llmsDocs), "utf8"),
    writeFile(path.join(distDir, "llms-index.json"), renderLlmsIndex(llmsDocs), "utf8"),
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
