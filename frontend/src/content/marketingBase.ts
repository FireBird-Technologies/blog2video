import type { FaqItem, MarketingPage, PageCta, TemplateProfile } from "./seoTypes";

export const defaultCta: PageCta = {
  title: "Turn your existing content into a video this week",
  body:
    "Paste a URL, upload a document, or use an existing newsletter archive and convert it into a polished video without starting from a blank timeline.",
  primaryLabel: "Start with your first video",
  primaryHref: "/",
  secondaryLabel: "See pricing",
  secondaryHref: "/pricing",
};

export const workflowBase = [
  "Add the source URL or upload the document you already have.",
  "Pick the output style, voice, and template that best match the audience.",
  "Review the generated scenes, narration, diagrams, and visuals.",
  "Render the final video and reuse it across YouTube, Shorts, LinkedIn, Medium, and Substack.",
];

export const templateProfiles: TemplateProfile[] = [
  {
    slug: "geometric-explainer",
    name: "Geometric Explainer",
    description:
      "A clean, structured explainer look for tutorials, walkthroughs, and technical lessons.",
    bestFor: "Educational breakdowns, product explainers, and technical onboarding.",
    differentiator:
      "Keeps complex concepts readable with deliberate hierarchy and diagram-friendly layouts.",
    styleFit: "Best when clarity matters more than cinematic flair.",
  },
  {
    slug: "nightfall",
    name: "Nightfall",
    description:
      "A premium dark cinematic template with contrast-heavy typography and high-gloss motion.",
    bestFor: "Founder stories, product launches, dramatic explainers, and thought-leadership clips.",
    differentiator:
      "Makes polished product narratives feel expensive without relying on stock-footage filler.",
    styleFit: "Best for premium positioning, storytelling, and launches.",
  },
  {
    slug: "gridcraft",
    name: "Gridcraft",
    description:
      "Warm editorial bento grids designed for comparisons, metrics, and structured narratives.",
    bestFor: "Benchmarks, listicles, comparison posts, dashboards, and data-heavy tutorials.",
    differentiator:
      "Gives technical or analytical content a magazine-quality layout rather than a generic AI look.",
    styleFit: "Best when the article already has lists, data, or product comparisons.",
  },
  {
    slug: "spotlight",
    name: "Spotlight",
    description:
      "Bold kinetic typography that puts the headline, numbers, and message at center stage.",
    bestFor: "Promotional content, keynote-style clips, product benefits, and short-form hooks.",
    differentiator:
      "Ideal for strong claims, punchy lines, and audience-retention focused video edits.",
    styleFit: "Best for bold hooks and high-impact promotional narratives.",
  },
  {
    slug: "whiteboard",
    name: "Whiteboard",
    description:
      "A classroom-friendly visual system built for teaching, diagrams, and guided explanation.",
    bestFor: "Course content, tutorials, lesson plans, onboarding, and process walkthroughs.",
    differentiator:
      "Turns educational content into something approachable without losing the original structure.",
    styleFit: "Best for educators and knowledge-transfer content.",
  },
  {
    slug: "newspaper",
    name: "Newspaper",
    description:
      "An editorial news format built for summaries, updates, and fact-first storytelling.",
    bestFor: "Newsletters, current-events analysis, commentary, and media-style explainers.",
    differentiator:
      "Makes recurring publishing formats feel serialized and highly recognizable.",
    styleFit: "Best for recurring newsletters, commentary, and weekly updates.",
  },
  {
    slug: "matrix",
    name: "Matrix",
    description:
      "A glitch-forward technical visual identity designed for dev audiences and futuristic demos.",
    bestFor: "Developer content, AI tooling launches, cybersecurity explainers, and code-centric stories.",
    differentiator:
      "Leans into technical identity while keeping the content readable and visual.",
    styleFit: "Best for technical audiences that expect a sharper, more experimental look.",
  },
];

export const templateBySlug = Object.fromEntries(
  templateProfiles.map((template) => [template.slug, template])
) as Record<string, TemplateProfile>;

export function createFaq(
  subject: string,
  audience: string,
  differentiator: string
): FaqItem[] {
  return [
    {
      question: `What makes Blog2Video useful for ${subject}?`,
      answer: `${audience} can start from the content they already wrote, keep the original structure intact, and turn it into a video without rebuilding everything inside a traditional editor.`,
    },
    {
      question: `Will the ${subject} workflow still sound like my real content?`,
      answer:
        "Yes. Blog2Video uses your article, newsletter, or document as the source of truth, so the output is grounded in your real content rather than a generic stock-footage script.",
    },
    {
      question: "How is it different from generic AI video generators?",
      answer: differentiator,
    },
  ];
}

export function createPage(
  input: Omit<MarketingPage, "workflowSteps" | "badges" | "cta"> &
    Partial<Pick<MarketingPage, "workflowSteps" | "badges" | "cta">>
): MarketingPage {
  return {
    workflowSteps: workflowBase,
    badges: [],
    cta: defaultCta,
    ...input,
  };
}
