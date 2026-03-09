import { createFaq, createPage, templateProfiles } from "./marketingBase";
import type { MarketingPage } from "./seoTypes";

export const templatePages: MarketingPage[] = templateProfiles.map((template) =>
  createPage({
    path: `/templates/${template.slug}`,
    title: `${template.name} Video Template`,
    description: `${template.description} See when to use the ${template.name} template inside Blog2Video.`,
    eyebrow: "Template",
    heroTitle: `${template.name} template for content-first video production`,
    heroDescription: `${template.description} ${template.bestFor}`,
    category: "template",
    primaryKeyword: `${template.slug.replace(/-/g, " ")} template`,
    keywordVariant: `${template.name} video template`,
    proofPoints: [template.bestFor, template.differentiator, template.styleFit],
    sections: [
      {
        title: "When this template wins",
        body: [template.bestFor, template.differentiator],
      },
      {
        title: "How to choose it",
        body: [
          template.styleFit,
          "The right template is less about decoration and more about matching structure, tone, and audience expectations.",
        ],
      },
    ],
    recommendedTemplate: template.slug,
    recommendedTemplateReason:
      "This page documents where the template is strongest so you can match format, message, and audience intentionally.",
    faq: createFaq(
      `${template.name} template usage`,
      "Creators matching content structure to template choice",
      "Blog2Video's templates are designed around communication patterns, not just cosmetic skin changes."
    ),
    relatedPaths: [
      "/blog-to-video",
      "/custom-branded-video-templates",
      "/pricing",
      "/blogs/best-templates-for-explainer-videos",
    ],
  })
);
