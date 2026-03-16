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

function faqSchema(faq: FaqItem[]) {
  if (!faq.length) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
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
      },
    },
  ];
}

export function pricingSchema() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Blog2Video",
      description:
        "Turn blog posts, articles, PDFs, and documents into narrated videos with reusable templates and AI scene editing.",
      brand: {
        "@type": "Organization",
        name: organizationName,
      },
      offers: [
        {
          "@type": "Offer",
          name: "Free",
          price: "0",
          priceCurrency: "USD",
        },
        {
          "@type": "Offer",
          name: "Per Video",
          price: "3",
          priceCurrency: "USD",
        },
        {
          "@type": "Offer",
          name: "Standard",
          price: "25",
          priceCurrency: "USD",
        },
        {
          "@type": "Offer",
          name: "Pro",
          price: "50",
          priceCurrency: "USD",
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
      },
    },
    breadcrumbList([
      { name: "Home", path: "/" },
      { name: page.heroTitle, path: page.path },
    ]),
  ];

  const faq = faqSchema(page.faq);
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

  const faq = faqSchema(post.faq);
  if (faq) schemas.push(faq);

  return schemas;
}
