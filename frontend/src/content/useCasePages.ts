import { createFaq, createPage } from "./marketingBase";
import type { MarketingPage } from "./seoTypes";

export const useCasePages: MarketingPage[] = [
  createPage({
    path: "/for-technical-bloggers",
    title: "Blog2Video for Technical Bloggers",
    description:
      "Repurpose technical blog posts into narrated videos with code blocks, diagrams, and educational templates.",
    eyebrow: "Use case",
    heroTitle: "Built for technical bloggers who want search, video, and authority to compound together",
    heroDescription:
      "Technical creators already do the hard part: they write detailed, useful content. Blog2Video helps that work travel further across YouTube, Shorts, and social video.",
    category: "use-case",
    primaryKeyword: "video tool for technical bloggers",
    keywordVariant: "technical blog to video",
    proofPoints: [
      "Supports code snippets, diagrams, metrics, and educational structure.",
      "Fits creators who publish on personal blogs, Medium, Substack, and dev communities.",
      "Turns one strong post into multiple reusable content assets.",
    ],
    sections: [
      {
        title: "Why this audience benefits first",
        body: [
          "Technical bloggers often have more substance than time. They do not need another idea generator. They need leverage from work they have already published.",
        ],
      },
    ],
    recommendedTemplate: "matrix",
    recommendedTemplateReason:
      "Matrix matches technical audiences well because it feels native to developer and AI-focused content while keeping examples readable.",
    faq: createFaq(
      "technical blog repurposing",
      "Technical bloggers with archives of tutorials, reviews, and explainers",
      "Blog2Video preserves structure, visuals, and code-aware layouts in a way that generic B-roll generators usually cannot."
    ),
    relatedPaths: [
      "/blog-to-video",
      "/for-medium-writers",
      "/blogs/how-technical-bloggers-can-repurpose-posts-into-youtube-videos",
      "/templates/matrix",
    ],
  }),
  createPage({
    path: "/for-technical-writers",
    title: "Blog2Video for Technical Writers and Documentation Teams",
    description:
      "Turn documentation, how-tos, and technical guides into videos that help teams distribute product knowledge.",
    eyebrow: "Use case",
    heroTitle: "Technical writing can become a video channel, not just a docs function",
    heroDescription:
      "Documentation teams already own valuable educational content. Blog2Video helps turn that material into videos for onboarding, product education, and distribution.",
    category: "use-case",
    primaryKeyword: "video tool for technical writers",
    keywordVariant: "documentation to video",
    proofPoints: [
      "Converts documentation into product walkthroughs and customer education assets.",
      "Extends written knowledge into onboarding and support channels.",
      "Keeps the clarity and fidelity of the original instructions.",
    ],
    sections: [
      {
        title: "A content multiplier for docs teams",
        body: [
          "Good docs are expensive to produce. Turning them into video gives support, onboarding, and product marketing another distribution surface from the same source content.",
        ],
      },
    ],
    recommendedTemplate: "geometric-explainer",
    recommendedTemplateReason:
      "Geometric Explainer works especially well for docs because it keeps long instructional content easy to follow and easy to update.",
    faq: createFaq(
      "documentation to video",
      "Documentation teams, developer relations, and product education teams",
      "Blog2Video starts from the content you already maintain and turns it into structured scenes instead of forcing you to rebuild the logic inside a separate video editor."
    ),
    relatedPaths: [
      "/docx-to-video",
      "/code-snippet-to-video",
      "/blogs/how-to-turn-documentation-into-product-walkthrough-videos",
      "/templates/geometric-explainer",
    ],
  }),
  createPage({
    path: "/for-educators",
    title: "Blog2Video for Educators and Course Creators",
    description:
      "Convert lesson plans, PDFs, and presentation material into accessible educational videos.",
    eyebrow: "Use case",
    heroTitle: "Turn lessons, guides, and slide decks into educational videos faster",
    heroDescription:
      "Blog2Video gives educators a way to extend lesson content into reusable explainers without recording every module manually.",
    category: "use-case",
    primaryKeyword: "video tool for educators",
    keywordVariant: "lesson plan to video",
    proofPoints: [
      "Supports PDFs, docs, and decks that are already part of the teaching workflow.",
      "Works for asynchronous learning, course libraries, and lesson recaps.",
      "Maintains instructional structure instead of reducing content into a generic summary.",
    ],
    sections: [
      {
        title: "Useful for both solo educators and teams",
        body: [
          "Whether you teach independently or inside a larger organization, video lets core lessons travel further. The best workflow is one that starts from material you already trust.",
        ],
      },
    ],
    recommendedTemplate: "whiteboard",
    recommendedTemplateReason:
      "Whiteboard is the strongest fit for educators because it keeps lesson pacing approachable and diagram-friendly.",
    faq: createFaq(
      "educational video creation from written material",
      "Teachers, instructors, and course creators",
      "Blog2Video is strong for educational content because it respects structure, uses scenes intentionally, and avoids the generic feel of stock-footage-first tools."
    ),
    relatedPaths: [
      "/pdf-to-video",
      "/pptx-to-video",
      "/blogs/pdf-to-video-fastest-workflow-for-educators",
      "/templates/whiteboard",
    ],
  }),
  createPage({
    path: "/for-researchers",
    title: "Blog2Video for Researchers and Research Communication",
    description:
      "Turn research papers, summaries, and findings into clear explainer videos for broader reach.",
    eyebrow: "Use case",
    heroTitle: "Make research easier to understand, cite, and share through video",
    heroDescription:
      "Research often gets trapped in formats that are hard for broader audiences to consume. Blog2Video helps convert structured findings into accessible explainer videos.",
    category: "use-case",
    primaryKeyword: "research paper to video",
    keywordVariant: "video tool for researchers",
    proofPoints: [
      "Useful for summaries, explainers, lab communication, and educational outreach.",
      "Turns dense content into a clearer distribution asset without flattening the insight.",
      "Works well with structured templates that support evidence and key takeaways.",
    ],
    sections: [
      {
        title: "A better format for distribution",
        body: [
          "Researchers often need a lighter-weight explanation layer around the original work. Video is useful when the goal is broader understanding, faster sharing, and easier onboarding for new audiences.",
        ],
      },
    ],
    recommendedTemplate: "gridcraft",
    recommendedTemplateReason:
      "Gridcraft is a strong fit for research because it handles evidence, comparisons, and structured argumentation cleanly.",
    faq: createFaq(
      "research communication through video",
      "Researchers, analysts, and technical experts",
      "Blog2Video turns structured content into structured scenes, which makes it better for research communication than visually generic AI generators."
    ),
    relatedPaths: [
      "/pdf-to-video",
      "/diagram-to-video",
      "/blogs/how-to-convert-research-papers-into-explainer-videos",
      "/templates/gridcraft",
    ],
  }),
  createPage({
    path: "/for-newsletters",
    title: "Blog2Video for Newsletter Operators",
    description:
      "Turn newsletters into serialized video content you can distribute on YouTube, Shorts, and social channels.",
    eyebrow: "Use case",
    heroTitle: "Use your newsletter archive as the source for a repeatable video series",
    heroDescription:
      "If you publish ideas every week, you already have the raw material for a durable video engine. Blog2Video helps turn that archive into reusable episodes and clips.",
    category: "use-case",
    primaryKeyword: "newsletter to video",
    keywordVariant: "turn newsletter into video",
    proofPoints: [
      "Strong fit for recurring commentary, founder updates, and educational newsletters.",
      "Turns archive content into a library of reusable video assets.",
      "Pairs well with Substack and cross-channel publishing workflows.",
    ],
    sections: [
      {
        title: "A better way to compound weekly publishing",
        body: [
          "Newsletter operators already show up consistently. Video lets that consistency travel into discovery surfaces where subscribers have not met you yet.",
        ],
      },
    ],
    recommendedTemplate: "newspaper",
    recommendedTemplateReason:
      "Newspaper is ideal for newsletter-led publishing because it feels serialized, editorial, and designed for recurring updates.",
    faq: createFaq(
      "newsletter to video repurposing",
      "Newsletter operators and audience-first creators",
      "Blog2Video is especially useful when the original content already exists on a weekly cadence and needs a dependable distribution flywheel."
    ),
    relatedPaths: [
      "/for-substack-writers",
      "/distribution-flywheel",
      "/blogs/how-to-turn-a-substack-archive-into-a-video-library",
      "/templates/newspaper",
    ],
  }),
  createPage({
    path: "/for-medium-writers",
    title: "Blog2Video for Medium Writers",
    description:
      "Repurpose Medium posts into video explainers, YouTube content, and short-form clips that point back to your site.",
    eyebrow: "Use case",
    heroTitle: "Use Medium as a discovery channel and your site as the SEO home",
    heroDescription:
      "Writers publishing on Medium can use Blog2Video to turn strong posts into video assets while linking audience attention back to owned channels.",
    category: "use-case",
    primaryKeyword: "medium post to video",
    keywordVariant: "video tool for Medium writers",
    proofPoints: [
      "Lets Medium become a top-of-funnel awareness channel instead of your only publishing destination.",
      "Supports repurposing posts into videos and linking traffic back to owned pages.",
      "Works well for founder-led thought leadership and product education.",
    ],
    sections: [
      {
        title: "Why Medium should not be the only destination",
        body: [
          "Medium can be a strong discovery layer, but your best SEO equity should compound on owned pages. A video workflow helps you turn Medium pieces into cross-channel assets that point back to the site.",
        ],
      },
    ],
    recommendedTemplate: "nightfall",
    recommendedTemplateReason:
      "Nightfall is a good fit for Medium-style thought leadership because it makes essay-driven pieces feel premium and authored.",
    faq: createFaq(
      "Medium post to video repurposing",
      "Medium writers building audience and brand authority",
      "Blog2Video gives you a way to turn Medium content into owned-channel video assets instead of letting the content stop at one platform."
    ),
    relatedPaths: [
      "/distribution-flywheel",
      "/for-technical-bloggers",
      "/blogs/medium-post-to-video-workflow",
      "/blog-to-youtube-video",
    ],
  }),
  createPage({
    path: "/for-substack-writers",
    title: "Blog2Video for Substack Writers",
    description:
      "Turn Substack newsletters into videos, recurring show formats, and cross-channel content assets.",
    eyebrow: "Use case",
    heroTitle: "Turn Substack essays and updates into a repeatable video publishing system",
    heroDescription:
      "Substack is a powerful home for audience relationships. Blog2Video helps you turn those newsletters into videos that create discovery and reinforce the brand.",
    category: "use-case",
    primaryKeyword: "substack to video",
    keywordVariant: "video tool for Substack writers",
    proofPoints: [
      "Turns recurring newsletters into recurring video episodes and clips.",
      "Supports audience growth beyond the inbox by extending content to video platforms.",
      "Fits weekly publishing loops and archive-based reuse.",
    ],
    sections: [
      {
        title: "A natural extension of the newsletter habit",
        body: [
          "Writers on Substack already have the cadence. The opportunity is to turn that cadence into more surfaces for discovery without multiplying production cost.",
        ],
      },
    ],
    recommendedTemplate: "newspaper",
    recommendedTemplateReason:
      "Newspaper is the strongest fit for Substack-driven publishing because it feels like an editorial show format built from recurring essays and updates.",
    faq: createFaq(
      "Substack to video repurposing",
      "Writers who publish regular newsletters and want broader distribution",
      "Blog2Video helps use the newsletter archive as a durable content asset instead of forcing you to record everything manually."
    ),
    relatedPaths: [
      "/for-newsletters",
      "/distribution-flywheel",
      "/blogs/substack-newsletter-to-video-workflow",
      "/templates/newspaper",
    ],
  }),
];
