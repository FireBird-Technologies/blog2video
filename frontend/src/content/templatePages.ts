import { createFaq, createPage, templateProfiles } from "./marketingBase";
import type { MarketingPage } from "./seoTypes";

export const templatePages: MarketingPage[] = templateProfiles.map((template) =>
  createPage({
    path: `/templates/${template.slug}`,
    title: `${template.name} Video Template | Blog2Video`,
    description: `${template.description} ${template.bestFor} See all ${template.layouts?.length ?? 0} layouts, watch a live preview, and learn when to use ${template.name}.`,
    eyebrow: "Template",
    heroTitle: `${template.name}: ${template.styleFit.replace(/^Best /, "")}`,
    heroDescription: template.longDescription || `${template.description} ${template.bestFor}`,
    category: "template",
    primaryKeyword: `${template.slug.replace(/-/g, " ")} template`,
    keywordVariant: `${template.name} video template`,
    proofPoints: [
      template.bestFor,
      template.differentiator,
      `Includes ${template.layouts?.length ?? 0} scene layouts: ${(template.layouts ?? []).slice(0, 4).join(", ")}${(template.layouts ?? []).length > 4 ? ", and more" : ""}.`,
    ],
    sections: [
      {
        title: `When to use ${template.name}`,
        body: [
          template.bestFor,
          template.differentiator,
          `${template.name} is designed for specific content types where the visual style directly supports the message. Choosing the right template is about matching structure, tone, and audience expectations — not just picking a color scheme.`,
        ],
        bullets: template.idealFor,
      },
      {
        title: `Available layouts in ${template.name}`,
        body: [
          `${template.name} includes ${template.layouts?.length ?? 0} layouts. Each layout is purpose-built for a different type of content, from titles and body text to code blocks, comparisons, data visualizations, and pull quotes.`,
          "When Blog2Video generates a video from your article, it automatically selects the best layout for each scene based on the content type. You can also override layouts manually in the scene editor.",
        ],
        bullets: template.layouts?.map((l) => l.replace(/_/g, " ").replace(/-/g, " ")),
      },
      {
        title: "Example topics",
        body: [
          `Here are the kinds of articles and topics that work best with the ${template.name} template. If your content matches any of these patterns, ${template.name} is likely the strongest choice.`,
        ],
        bullets: template.exampleTopics,
      },
    ],
    recommendedTemplate: template.slug,
    recommendedTemplateReason:
      `This page documents where ${template.name} is strongest so you can match format, message, and audience intentionally.`,
    faq: [
      {
        question: `What content works best with the ${template.name} template?`,
        answer: template.bestFor,
      },
      {
        question: `How many layouts does ${template.name} include?`,
        answer: `${template.name} includes ${template.layouts?.length ?? 0} purpose-built layouts: ${(template.layouts ?? []).join(", ")}. Each layout is designed for a specific content type and automatically selected based on your article structure.`,
      },
      {
        question: `Can I switch to ${template.name} after generating a video?`,
        answer: `Yes. You can switch templates at any time without losing your scene edits. The same content renders differently depending on the template, so you can preview ${template.name} before committing.`,
      },
      ...createFaq(
        `${template.name} template usage`,
        "Creators matching content structure to template choice",
        "Blog2Video's templates are designed around communication patterns, not just cosmetic skin changes."
      ),
    ],
    relatedPaths: [
      "/blog-to-video",
      "/custom-branded-video-templates",
      "/pricing",
      "/blogs/best-templates-for-explainer-videos",
    ],
  })
);
