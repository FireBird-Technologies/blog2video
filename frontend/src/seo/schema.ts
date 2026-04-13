import {
  defaultOgImage,
  organizationName,
  siteName,
  siteUrl,
} from "../content/siteContent";
import type { BlogPost, FaqItem, MarketingPage } from "../content/seoTypes";

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
      description:
        "Turn blog posts, articles, PDFs, and documents into structured narrated videos.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: `${siteUrl}/pricing`,
      },
    },
  ];
}

export function pricingSchema() {
  const sharedOfferFields = {
    availability: "https://schema.org/InStock",
    url: `${siteUrl}/pricing`,
  };

  return [
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
      publisher: {
        "@type": "Organization",
        name: organizationName,
      },
      offers: [
        {
          "@type": "Offer",
          name: "Free",
          price: "0",
          priceCurrency: "USD",
          ...sharedOfferFields,
        },
        {
          "@type": "Offer",
          name: "Per Video",
          price: "3",
          priceCurrency: "USD",
          ...sharedOfferFields,
        },
        {
          "@type": "Offer",
          name: "Standard",
          price: "25",
          priceCurrency: "USD",
          ...sharedOfferFields,
        },
        {
          "@type": "Offer",
          name: "Pro",
          price: "50",
          priceCurrency: "USD",
          ...sharedOfferFields,
        },
      ],
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
      publisher: {
        "@type": "Organization",
        name: organizationName,
      },
      offers: {
        "@type": "Offer",
        priceCurrency: "USD",
        price: "0",
        availability: "https://schema.org/InStock",
        url: `${siteUrl}/pricing`,
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
