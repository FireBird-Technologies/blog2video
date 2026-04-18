import {
  defaultOgImage,
  organizationName,
  siteName,
  siteUrl,
} from "../content/siteContent";
import { pricingLabels } from "../content/substackDirectory";
import { tools, toolsHub } from "../content/tools";
import type {
  BlogPost,
  FaqItem,
  MarketingPage,
  SubstackNiche,
  SubstackPublication,
  ToolDefinition,
} from "../content/seoTypes";

function breadcrumbList(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${siteUrl}${item.path}`,
    })),
  };
}

function faqSchema(
  faq: FaqItem[],
  meta?: { pageUrl: string; name?: string }
) {
  if (!faq.length) return null;

  const pageUrl = meta?.pageUrl ?? siteUrl;
  const faqName = meta?.name?.trim() || "Frequently asked questions";

  // No nested @context — parent uses { @context, @graph } from normalizeSchemaForJsonLd
  return {
    "@type": "FAQPage",
    "@id": `${pageUrl}#faqpage`,
    name: faqName,
    url: pageUrl,
    mainEntity: faq.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: entry.answer,
      },
    })),
  };
}

export function homepageSchema() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: organizationName,
      url: siteUrl,
      logo: `${siteUrl}/Logo-Firebird.webp`,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: siteName,
      url: siteUrl,
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: siteName,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: siteUrl,
      image: defaultOgImage,
      description:
        "Turn blog posts, articles, PDFs, and documents into structured narrated videos.",
      brand: {
        "@type": "Organization",
        name: organizationName,
      },
      publisher: {
        "@type": "Organization",
        name: organizationName,
      },
    },
  ];
}

export function pricingSchema() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Blog2Video Pricing",
      url: `${siteUrl}/pricing`,
      description:
        "Blog2Video pricing for free, pay-as-you-go, Standard, Pro, and custom team plans.",
      image: defaultOgImage,
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Blog2Video",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: `${siteUrl}/pricing`,
      description:
        "Turn blog posts, articles, PDFs, and documents into narrated videos with reusable templates and AI scene editing.",
      image: defaultOgImage,
      brand: {
        "@type": "Organization",
        name: organizationName,
      },
      publisher: {
        "@type": "Organization",
        name: organizationName,
      },
    },
    breadcrumbList([
      { name: "Home", path: "/" },
      { name: "Pricing", path: "/pricing" },
    ]),
  ];
}

export function contactSchema() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "ContactPage",
      name: "Contact Blog2Video",
      url: `${siteUrl}/contact`,
      about: {
        "@type": "Organization",
        name: organizationName,
      },
    },
    breadcrumbList([
      { name: "Home", path: "/" },
      { name: "Contact", path: "/contact" },
    ]),
  ];
}

export function blogIndexSchema() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Blog",
      name: `${siteName} Blog`,
      url: `${siteUrl}/blogs`,
      description:
        "SEO, repurposing, distribution, and programmatic-video strategy for written-first creators.",
    },
    breadcrumbList([
      { name: "Home", path: "/" },
      { name: "Blog", path: "/blogs" },
    ]),
  ];
}

export function toolsHubSchema() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: toolsHub.title,
      url: `${siteUrl}${toolsHub.path}`,
      description: toolsHub.description,
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Blog2Video tools",
      itemListElement: tools.map((tool, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: tool.title,
        url: `${siteUrl}${tool.path}`,
      })),
    },
    breadcrumbList([
      { name: "Home", path: "/" },
      { name: "Tools", path: toolsHub.path },
    ]),
  ];
}

export function marketingPageSchema(page: MarketingPage) {
  const schemas: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: page.title,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: `${siteUrl}${page.path}`,
      image: defaultOgImage,
      description: page.description,
      brand: {
        "@type": "Organization",
        name: organizationName,
      },
      publisher: {
        "@type": "Organization",
        name: organizationName,
      },
    },
    breadcrumbList([
      { name: "Home", path: "/" },
      { name: page.heroTitle, path: page.path },
    ]),
  ];

  const faq = faqSchema(page.faq, {
    pageUrl: `${siteUrl}${page.path}`,
    name: `FAQ — ${page.heroTitle}`,
  });
  if (faq) schemas.push(faq);

  return schemas;
}

export function toolPageSchema(tool: ToolDefinition) {
  const schemas: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: tool.title,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: `${siteUrl}${tool.path}`,
      image: defaultOgImage,
      description: tool.description,
      brand: {
        "@type": "Organization",
        name: organizationName,
      },
      publisher: {
        "@type": "Organization",
        name: organizationName,
      },
    },
    breadcrumbList([
      { name: "Home", path: "/" },
      { name: "Tools", path: toolsHub.path },
      { name: tool.title, path: tool.path },
    ]),
  ];

  const faq = faqSchema(tool.faq, {
    pageUrl: `${siteUrl}${tool.path}`,
    name: `FAQ — ${tool.title}`,
  });
  if (faq) schemas.push(faq);

  return schemas;
}

export function substackDirectoryNicheSchema(
  niche: SubstackNiche,
  publications: SubstackPublication[],
  path: string,
  faq: FaqItem[],
  pricing?: "free" | "paid" | "freemium"
) {
  const name = pricing ? `${pricingLabels[pricing]} ${niche.title}` : niche.title;
  const schemas: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name,
      url: `${siteUrl}${path}`,
      description: niche.description,
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `${name} publication list`,
      itemListElement: publications.map((publication, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: publication.name,
        url: `${siteUrl}/tools/substack-directory/publication/${publication.slug}`,
      })),
    },
    breadcrumbList([
      { name: "Home", path: "/" },
      { name: "Tools", path: toolsHub.path },
      { name: "Substack Directory", path: "/tools/substack-directory" },
      { name, path },
    ]),
  ];

  const faqPage = faqSchema(faq, {
    pageUrl: `${siteUrl}${path}`,
    name: `FAQ — ${name}`,
  });
  if (faqPage) schemas.push(faqPage);

  return schemas;
}

export function substackDirectoryPublicationSchema(
  publication: SubstackPublication,
  path: string,
  faq: FaqItem[]
) {
  const schemas: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      name: `${publication.name} on Substack`,
      url: `${siteUrl}${path}`,
      description: publication.description,
      mainEntity: {
        "@type": "CreativeWork",
        name: publication.name,
        description: publication.tagline,
      },
    },
    breadcrumbList([
      { name: "Home", path: "/" },
      { name: "Tools", path: toolsHub.path },
      { name: "Substack Directory", path: "/tools/substack-directory" },
      { name: publication.name, path },
    ]),
  ];

  const faqPage = faqSchema(faq, {
    pageUrl: `${siteUrl}${path}`,
    name: `FAQ — ${publication.name}`,
  });
  if (faqPage) schemas.push(faqPage);

  return schemas;
}

export function blogPostSchema(post: BlogPost) {
  const articleImage = post.heroImage ? `${siteUrl}${post.heroImage}` : defaultOgImage;
  const schemas: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: post.title,
      description: post.description,
      datePublished: post.publishedAt,
      dateModified: post.publishedAt,
      mainEntityOfPage: `${siteUrl}/blogs/${post.slug}`,
      image: articleImage,
      author: {
        "@type": "Person",
        name: "Arslan Shahid",
      },
      publisher: {
        "@type": "Organization",
        name: organizationName,
        logo: {
          "@type": "ImageObject",
          url: `${siteUrl}/Logo-Firebird.webp`,
        },
      },
    },
    breadcrumbList([
      { name: "Home", path: "/" },
      { name: "Blog", path: "/blogs" },
      { name: post.title, path: `/blogs/${post.slug}` },
    ]),
  ];

  const faq = faqSchema(post.faq, {
    pageUrl: `${siteUrl}/blogs/${post.slug}`,
    name: `FAQ — ${post.title}`,
  });
  if (faq) schemas.push(faq);

  return schemas;
}
