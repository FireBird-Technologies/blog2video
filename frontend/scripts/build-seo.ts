import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import React from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { renderToString } from "react-dom/server";
import { Route, Routes } from "react-router-dom";
import { StaticRouter } from "react-router-dom/server";
import { ErrorModalProvider } from "../src/contexts/ErrorModalContext";
import {
  blogPosts,
  defaultOgImage,
  getBlogPost,
  getMarketingPage,
  getPublicPaths,
  marketingPages,
  siteName,
  siteUrl,
} from "../src/content/siteContent";
import { AuthProvider } from "../src/hooks/useAuth";
import Blog from "../src/pages/Blog";
import BlogPostPage from "../src/pages/BlogPostPage";
import Contact from "../src/pages/Contact";
import Landing from "../src/pages/Landing";
import MarketingPageView from "../src/pages/MarketingPageView";
import NotFoundPage from "../src/pages/NotFoundPage";
import Pricing from "../src/pages/Pricing";
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
} from "../src/seo/schema";

const frontendRoot = process.cwd();
const distDir = path.join(frontendRoot, "dist");

type SeoPayload = {
  title: string;
  description: string;
  path: string;
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
        schema: blogPostSchema(post),
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

  return {
    title: siteName,
    description: "Turn written content into polished videos.",
    path: routePath,
  };
}

function buildHeadTags(routePath: string) {
  const payload = getSeoPayload(routePath);
  const canonicalUrl = `${siteUrl}${payload.path}`;
  const fullTitle = payload.title.includes(siteName)
    ? payload.title
    : `${payload.title} | ${siteName}`;

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
<meta property="og:image" content="${defaultOgImage}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(fullTitle)}" />
<meta name="twitter:description" content="${escapeHtml(payload.description)}" />
<meta name="twitter:image" content="${defaultOgImage}" />
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
  const routes = [
    React.createElement(Route, { key: "/", path: "/", element: React.createElement(Landing) }),
    React.createElement(Route, { key: "/pricing", path: "/pricing", element: React.createElement(Pricing) }),
    React.createElement(Route, { key: "/contact", path: "/contact", element: React.createElement(Contact) }),
    React.createElement(Route, { key: "/blogs", path: "/blogs", element: React.createElement(Blog) }),
    React.createElement(Route, { key: "/blogs/:slug", path: "/blogs/:slug", element: React.createElement(BlogPostPage) }),
    ...marketingPages.map((page) =>
      React.createElement(Route, {
        key: page.path,
        path: page.path,
        element: React.createElement(MarketingPageView),
      })
    ),
    React.createElement(Route, { key: "*", path: "*", element: React.createElement(NotFoundPage) }),
  ];

  const appHtml = renderToString(
    React.createElement(
      GoogleOAuthProvider,
      { clientId: "placeholder" },
      React.createElement(
        StaticRouter,
        { location: url },
        React.createElement(
          AuthProvider,
          null,
          React.createElement(
            ErrorModalProvider,
            null,
            React.createElement(Routes, null, routes)
          )
        )
      )
    )
  );

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

function injectRenderedMarkup(template: string, appHtml: string, head: string) {
  return template
    .replace(/<title>[\s\S]*?<\/title>/i, "")
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
  const template = await readFile(path.join(distDir, "index.html"), "utf8");
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

  const notFound = renderUrl("/404");
  await writeFile(
    path.join(distDir, "404.html"),
    injectRenderedMarkup(template, notFound.appHtml, notFound.head),
    "utf8"
  );
}

async function buildSeoFiles() {
  const allPaths = getPublicPaths();
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
