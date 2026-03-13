export type PageCategory =
  | "commercial"
  | "use-case"
  | "feature"
  | "template"
  | "programmatic"
  | "resource";

export interface FaqItem {
  question: string;
  answer: string;
}

export interface ContentSection {
  title: string;
  body: string[];
  bullets?: string[];
}

export interface PageCta {
  title: string;
  body: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}

export interface MarketingPage {
  path: string;
  title: string;
  description: string;
  eyebrow: string;
  heroTitle: string;
  heroDescription: string;
  category: PageCategory;
  primaryKeyword: string;
  keywordVariant: string;
  badges: string[];
  proofPoints: string[];
  workflowSteps: string[];
  sections: ContentSection[];
  recommendedTemplate: string;
  recommendedTemplateReason: string;
  faq: FaqItem[];
  relatedPaths: string[];
  cta: PageCta;
}

export interface TemplateProfile {
  slug: string;
  name: string;
  description: string;
  bestFor: string;
  differentiator: string;
  styleFit: string;
}

export interface BlogSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  component?: string;
  ctaPath?: string;
  ctaLabel?: string;
}

export interface DistributionAsset {
  channel: "site" | "substack" | "medium" | "video";
  title: string;
  angle: string;
}

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  category: string;
  heroImage?: string;
  heroImageAlt?: string;
  publishedAt: string;
  readTime: string;
  heroEyebrow: string;
  heroTitle: string;
  heroDescription: string;
  primaryKeyword: string;
  keywordVariant: string;
  relatedPaths: string[];
  sections: BlogSection[];
  faq: FaqItem[];
  distributionPlan: DistributionAsset[];
}
