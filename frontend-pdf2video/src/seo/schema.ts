import {
  brandSameAs,
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
  HelpPost,
  MarketingPage,
  SubstackNiche,
  SubstackPublication,
  ToolDefinition,
} from "../content/seoTypes";

/**
 * The product's price range as one reusable Offer.
 *
 * Kept as AggregateOffer because PDF2Video is freemium, not free: the entry
 * price is genuinely $0 (1 video, lifetime, no card) and the ceiling is the Pro
 * plan. Search engines surface the low end as a "Free" annotation in the SERP —
 * which several competitors on the pdf-to-video results carry and we did not —
 * while the range keeps the claim truthful.
 *
 * Mirrors pricingContent.ts. If prices move there, move them here.
 */
const freemiumOffer = {
  "@type": "AggregateOffer",
  priceCurrency: "USD",
  lowPrice: "0",
  highPrice: "59.99",
  offerCount: "5",
};

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
  const organizationId = `${siteUrl}/#organization`;
  const websiteId = `${siteUrl}/#website`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": organizationId,
      name: siteName,
      alternateName: "PDF 2 Video",
      legalName: organizationName,
      url: siteUrl,
      logo: `${siteUrl}/Logo-Firebird.webp`,
      sameAs: brandSameAs,
      parentOrganization: {
        "@type": "Organization",
        name: organizationName,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": websiteId,
      name: siteName,
      alternateName: "PDF 2 Video",
      url: siteUrl,
      publisher: { "@id": organizationId },
      sameAs: brandSameAs,
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "@id": `${siteUrl}/#software`,
      name: siteName,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: siteUrl,
      image: defaultOgImage,
      sameAs: brandSameAs,
      description:
        "Turn PDFs, reports, whitepapers, and decks into structured narrated videos.",
      offers: freemiumOffer,
      brand: { "@id": organizationId },
      publisher: { "@id": organizationId },
    },
  ];
}

export function pricingSchema() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: `${siteName} Pricing`,
      url: `${siteUrl}/pricing`,
      description:
        `${siteName} pricing for free, pay-as-you-go, Standard, Pro, and custom team plans.`,
      image: defaultOgImage,
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: siteName,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: `${siteUrl}/pricing`,
      description:
        "Turn PDFs, reports, and decks into narrated videos with reusable templates and AI scene editing.",
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
      name: `Contact ${siteName}`,
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

export function helpIndexSchema() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${siteName} Help / How-to`,
      url: `${siteUrl}/help`,
      description:
        "Step-by-step help guides for project creation, scene editing, voiceover, and templates.",
    },
    breadcrumbList([
      { name: "Home", path: "/" },
      { name: "Help", path: "/help" },
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
      name: `${siteName} free tools`,
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
  const pageUrl = `${siteUrl}${page.path}`;
  const schemas: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: page.title,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: pageUrl,
      image: defaultOgImage,
      description: page.description,
      // Freemium, stated as a range rather than a flat "price: 0": there is a
      // genuine free tier (1 video, lifetime, no card — see pricingContent.ts
      // FREE_FEATURES_INCLUDED), and paid usage runs from $2.80/video up to the
      // $59.99/mo Pro plan. AggregateOffer is the honest shape for that; a bare
      // price:0 would claim the whole product is free, which it is not.
      offers: freemiumOffer,
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

  // Pages that spell out a real, page-specific procedure get HowTo markup.
  // Pages still on the shared `workflowBase` boilerplate do not — identical
  // steps repeated across dozens of URLs is not a procedure worth marking up.
  if (page.workflowTitle && page.workflowSteps.length) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: page.workflowTitle,
      description: page.description,
      image: defaultOgImage,
      mainEntityOfPage: pageUrl,
      step: page.workflowSteps.map((step, index) => ({
        "@type": "HowToStep",
        position: index + 1,
        text: step,
      })),
    });
  }

  const faq = faqSchema(page.faq, {
    pageUrl,
    name: `FAQ — ${page.heroTitle}`,
  });
  if (faq) schemas.push(faq);

  return schemas;
}

export function toolPageSchema(tool: ToolDefinition) {
  const schemas: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      // WebApplication rather than SoftwareApplication: these run in the page,
      // with no install step, and the free Offer below is the claim the page
      // actually makes — every tool is usable without an account.
      "@type": "WebApplication",
      name: tool.title,
      applicationCategory: "UtilitiesApplication",
      browserRequirements: "Requires JavaScript",
      operatingSystem: "Web",
      url: `${siteUrl}${tool.path}`,
      image: defaultOgImage,
      description: tool.description,
      isAccessibleForFree: true,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      featureList: tool.proofPoints,
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

export function helpPostSchema(post: HelpPost) {
  const articleImage = post.heroImage ? `${siteUrl}${post.heroImage}` : defaultOgImage;
  const pagePath = `/help/${post.slug}`;
  const pageUrl = `${siteUrl}${pagePath}`;
  const schemas: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: post.title,
      headline: post.title,
      description: post.description,
      datePublished: post.publishedAt,
      dateModified: post.publishedAt,
      mainEntityOfPage: pageUrl,
      image: articleImage,
      totalTime: `PT${Math.max(1, Number.parseInt(post.readTime, 10) || 5)}M`,
      step: post.steps.map((step, index) => ({
        "@type": "HowToStep",
        position: index + 1,
        name: step.title,
        text: [...step.body, ...(step.bullets ?? [])].join(" "),
        image: step.image ? `${siteUrl}${step.image.src}` : undefined,
      })),
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
      { name: "Help", path: "/help" },
      { name: post.title, path: pagePath },
    ]),
  ];

  const faq = faqSchema(post.faq, {
    pageUrl,
    name: `FAQ — ${post.title}`,
  });
  if (faq) schemas.push(faq);

  return schemas;
}
