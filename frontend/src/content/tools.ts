import type { ToolDefinition } from "./seoTypes";

export const toolsHub = {
  path: "/tools",
  title: "Free Creator And SEO Tools for Medium, Substack, and Content Teams",
  description:
    "Free calculators, analyzers, formatters, generators, and directory pages for Medium, Substack, headlines, and content repurposing workflows.",
  heroTitle: "Free tools for creators who publish from writing first.",
  heroDescription:
    "Estimate revenue, clean up markdown, score headlines, generate shareable quote cards, and browse curated Substack niches without leaving the site.",
};

export const tools: ToolDefinition[] = [
  {
    slug: "content-repurposing-calculator",
    path: "/tools/content-repurposing-calculator",
    title: "Content Repurposing Calculator",
    description:
      "Estimate how many videos, shorts, social posts, and saved production hours your monthly blog output can create.",
    eyebrow: "Calculator",
    heroTitle: "Calculate how much video content your blog archive can generate.",
    heroDescription:
      "Enter your monthly blog output, average post length, and reuse cadence to see the long-form videos, short clips, social posts, and production hours hiding in your written content.",
    category: "calculator",
    icon: "CR",
    primaryKeyword: "content repurposing calculator",
    keywordVariant: "blog to video content calculator",
    badges: ["Blog-to-video math", "Short-form estimates", "Hours saved"],
    proofPoints: [
      "Translates blog cadence into realistic long-form video and short-form clip volume.",
      "Shows how much manual production time automation can save each month.",
      "Creates a simple outreach-worthy asset for content repurposing resource pages.",
    ],
    sections: [
      {
        title: "What this calculator estimates",
        body: [
          "Most content teams underestimate the amount of video inventory already sitting inside their blog, newsletter, or resource library. This calculator starts with the posts you publish each month, then models how many videos, clips, and social assets those posts can support.",
          "The output is a planning estimate, not a promise. Use it to decide whether repurposing should be a weekly workflow, a campaign sprint, or a larger video SEO program.",
        ],
      },
      {
        title: "How to use the result",
        body: [
          "If the calculator shows a meaningful volume of videos or clips, start with posts that already rank, convert, or explain a core product idea. Those pieces usually deserve video treatment before net-new topics.",
        ],
        bullets: [
          "Use long-form videos for YouTube, demos, and evergreen explainers.",
          "Use short clips for LinkedIn, Shorts, Reels, and newsletter embeds.",
          "Use the saved-hours estimate to compare manual editing against an automated workflow.",
        ],
      },
    ],
    faq: [
      {
        question: "What counts as repurposed content?",
        answer:
          "Repurposed content is any new asset created from an existing source, such as turning one blog post into a narrated video, short clips, social posts, or a newsletter section.",
      },
      {
        question: "Can this calculator help with video SEO planning?",
        answer:
          "Yes. It helps estimate how many optimized video assets you can create from existing written content, which makes it easier to plan YouTube, Google video results, and cross-channel distribution.",
      },
    ],
    relatedPaths: [
      "/video-seo-checklist",
      "/distribution-flywheel",
      "/blog-to-video",
      "/blogs/how-to-distribute-one-article-across-blog-newsletter-youtube-and-shorts",
    ],
  },
  {
    slug: "medium-partner-program-earnings-calculator",
    path: "/tools/medium-partner-program-earnings-calculator",
    title: "Medium Partner Program Earnings Calculator",
    description:
      "Estimate Medium Partner Program earnings with editable assumptions for member read rate, read time, topic mix, geography, and engaged reading minutes.",
    eyebrow: "Calculator",
    heroTitle: "Estimate Medium earnings without pretending the payout model is simple.",
    heroDescription:
      "Model member reads, engaged minutes, and low/base/high payout ranges so you can plan from realistic scenarios instead of screenshots.",
    category: "calculator",
    icon: "MP",
    primaryKeyword: "medium partner program earnings calculator",
    keywordVariant: "medium earnings calculator",
    badges: ["Medium RPM estimate", "Scenario modeling", "Engaged-read math"],
    proofPoints: [
      "Low, base, and high earnings ranges update instantly as assumptions change.",
      "Topic and geography multipliers make the estimate more useful than a flat RPM guess.",
      "Sensitivity notes explain which inputs move the result the most.",
    ],
    sections: [
      {
        title: "What this calculator actually models",
        body: [
          "Medium payouts are not a clean CPM system. The model here starts with monthly views, estimates the member-read share, translates that into engaged reading minutes, then applies an adjustable payout-per-minute assumption.",
          "That makes the output more honest. You can see the implied member reads and reading minutes behind the number instead of trusting a single black-box revenue figure.",
        ],
      },
      {
        title: "How to use it well",
        body: [
          "Use your own analytics where you have them. If you do not, start with conservative defaults, compare the low/base/high bands, and treat the result like a planning estimate rather than a guarantee.",
          "The best use case is editorial decision-making: whether a topic, cadence, or audience focus looks financially attractive enough to keep publishing into.",
        ],
      },
    ],
    faq: [
      {
        question: "Does this calculator predict exact Medium earnings?",
        answer:
          "No. It is a scenario model. Medium payouts vary with member reading behavior, audience quality, and other platform factors. The calculator is designed to make those assumptions visible rather than hide them.",
      },
      {
        question: "Why does the calculator use engaged reading minutes?",
        answer:
          "Because Medium earnings are closer to engagement-weighted payouts than raw pageview monetization. Engaged minutes are a better planning proxy than a flat RPM alone.",
      },
    ],
    relatedPaths: [
      "/tools/substack-revenue-calculator",
      "/tools/headline-analyzer",
      "/blog-to-video",
      "/blogs/video-seo-ranking-traffic-blog2video",
    ],
  },
  {
    slug: "substack-revenue-calculator",
    path: "/tools/substack-revenue-calculator",
    title: "Substack Revenue Calculator",
    description:
      "Forecast Substack revenue from free-to-paid conversion, pricing mix, annual-plan share, churn, and subscriber growth.",
    eyebrow: "Calculator",
    heroTitle: "Model your Substack revenue from conversion, price, and retention.",
    heroDescription:
      "Turn free-subscriber counts into MRR, ARR, churn-adjusted growth, and twelve-month scenarios with assumptions you can actually edit.",
    category: "calculator",
    icon: "SS",
    primaryKeyword: "substack revenue calculator",
    keywordVariant: "substack paid newsletter calculator",
    badges: ["MRR and ARR", "Free-to-paid conversion", "Churn-aware forecast"],
    proofPoints: [
      "Separate monthly and annual plan assumptions expose how pricing mix changes ARR.",
      "Churn and new subscriber inputs make the forecast useful beyond day-one conversion math.",
      "The calculator shows planning ranges instead of a single fragile number.",
    ],
    sections: [
      {
        title: "Why Substack revenue math is mostly conversion plus retention",
        body: [
          "Most newsletter math looks exciting at the top of the funnel. The actual business is shaped by how many free subscribers upgrade, how many stay, and how your annual-plan mix affects cash flow.",
          "That is why this model focuses on paid subscribers, churn drag, and future revenue rather than just multiplying subscribers by your sticker price.",
        ],
      },
      {
        title: "What to use this forecast for",
        body: [
          "Use it for pricing decisions, launch planning, or understanding how much headroom exists before investing more time in newsletter growth. The point is not perfect prediction. It is better decisions.",
        ],
      },
    ],
    faq: [
      {
        question: "Can this calculator handle free-to-paid Substack funnels?",
        answer:
          "Yes. The model starts from free subscribers, then applies conversion, annual-plan share, churn, and growth assumptions to estimate paid revenue.",
      },
      {
        question: "Why include annual-plan share?",
        answer:
          "Because a newsletter with the same paid-subscriber count can look very different depending on how many readers choose annual billing and how much discount you offer.",
      },
    ],
    relatedPaths: [
      "/tools/substack-directory",
      "/tools/headline-analyzer",
      "/for-substack-writers",
      "/blogs/substack-newsletter-to-video-workflow",
    ],
  },
  {
    slug: "markdown-to-medium-substack-formatter",
    path: "/tools/markdown-to-medium-substack-formatter",
    title: "Markdown to Medium and Substack Formatter",
    description:
      "Paste Markdown once and get cleaned Medium-ready and Substack-ready output with deterministic transforms, copy actions, and export support.",
    eyebrow: "Formatter",
    heroTitle: "Clean up Markdown for Medium and Substack without manual reformatting.",
    heroDescription:
      "Preview both outputs side by side, see what changed, and copy or export publishing-safe text in one pass.",
    category: "formatter",
    icon: "MD",
    primaryKeyword: "markdown to medium formatter",
    keywordVariant: "markdown to substack formatter",
    badges: ["Dual output", "Deterministic transforms", "Copy and export"],
    proofPoints: [
      "Medium and Substack tabs share one input but apply destination-specific cleanup.",
      "A visible changelog explains every transform that was applied.",
      "Copy and export actions make it usable as a real publishing utility.",
    ],
    sections: [
      {
        title: "What the formatter does",
        body: [
          "The formatter removes frontmatter, normalizes spacing, cleans heading and list structure, preserves code fences, and adapts common Markdown patterns into cleaner publishing-ready text.",
          "It stays deterministic on purpose. You should be able to trust what happened and why.",
        ],
      },
      {
        title: "Why there are two outputs",
        body: [
          "Medium and Substack are similar but not identical publishing contexts. Medium usually benefits from tighter editorial cleanup, while Substack often wants clearer spacing, quote handling, and newsletter-friendly section flow.",
        ],
      },
    ],
    faq: [
      {
        question: "Does this formatter rewrite my meaning?",
        answer:
          "No. The tool is for structural cleanup and publishing-safe formatting. It does not try to rewrite your argument or invent new content.",
      },
      {
        question: "Can I export the result?",
        answer:
          "Yes. Each output can be copied directly or downloaded as a text file for your publishing workflow.",
      },
    ],
    relatedPaths: [
      "/tools/headline-analyzer",
      "/tools/quote-card-generator",
      "/blogs/medium-post-to-video-workflow",
      "/blogs/substack-newsletter-to-video-workflow",
    ],
  },
  {
    slug: "headline-analyzer",
    path: "/tools/headline-analyzer",
    title: "Headline Analyzer",
    description:
      "Score headlines for clarity, specificity, length, curiosity, audience fit, and platform match across blog, Medium, Substack, and YouTube contexts.",
    eyebrow: "Analyzer",
    heroTitle: "Score your headline and get rewrite suggestions you can actually use.",
    heroDescription:
      "See where a title is strong, where it is vague, and how to improve it for blogs, Medium, Substack, or YouTube without relying on black-box scoring.",
    category: "analyzer",
    icon: "HA",
    primaryKeyword: "headline analyzer",
    keywordVariant: "headline score tool",
    badges: ["Deterministic scoring", "Rewrite suggestions", "Platform modes"],
    proofPoints: [
      "The score is broken into transparent factors instead of hidden behind a single number.",
      "Platform modes help the feedback match blog, newsletter, Medium, or YouTube goals.",
      "Rewrite suggestions are based on the signals the analyzer found, not generic filler.",
    ],
    sections: [
      {
        title: "What gets scored",
        body: [
          "The analyzer looks at length, specificity, number usage, clarity, curiosity, and audience framing. It also adjusts its expectations based on the publishing context you choose.",
          "That means a good YouTube title and a good Medium title are not judged exactly the same way.",
        ],
      },
      {
        title: "What the score is for",
        body: [
          "The point is not to chase a vanity score. It is to quickly see whether a headline is too vague, too long, too flat, or missing a concrete audience or benefit signal.",
        ],
      },
    ],
    faq: [
      {
        question: "Is this analyzer AI-generated?",
        answer:
          "No. The scoring is deterministic and rules-based so you can understand what the tool is rewarding or penalizing.",
      },
      {
        question: "Can it help with newsletter or YouTube titles too?",
        answer:
          "Yes. The mode switch changes how the headline is evaluated and what kind of rewrite suggestions are prioritized.",
      },
    ],
    relatedPaths: [
      "/tools/markdown-to-medium-substack-formatter",
      "/tools/quote-card-generator",
      "/blog-to-youtube-video",
      "/blogs/blog-to-youtube-strategy-for-written-first-creators",
    ],
  },
  {
    slug: "quote-card-generator",
    path: "/tools/quote-card-generator",
    title: "Quote Card Generator",
    description:
      "Create polished quote cards for social sharing with multiple layouts, aspect ratios, accent colors, and PNG export.",
    eyebrow: "Generator",
    heroTitle: "Turn one strong line into a shareable quote card in minutes.",
    heroDescription:
      "Pick a layout, set your colors and aspect ratio, preview the card live, and export a PNG built for social distribution.",
    category: "generator",
    icon: "QC",
    primaryKeyword: "quote card generator",
    keywordVariant: "social quote image generator",
    badges: ["Live preview", "PNG export", "Multiple aspect ratios"],
    proofPoints: [
      "Template styles are designed to feel editorial, not like default meme generators.",
      "Multiple aspect ratios support X, LinkedIn, and square card workflows.",
      "PNG export makes the tool useful as an actual content-distribution asset.",
    ],
    sections: [
      {
        title: "Why quote cards still work",
        body: [
          "A strong quote card can travel farther than a full article when you need something lightweight for social, newsletters, or launch threads. The key is that the visual treatment still needs to look intentional.",
          "This generator focuses on that gap: fast enough to use repeatedly, polished enough to be worth sharing.",
        ],
      },
      {
        title: "How to use it well",
        body: [
          "Use one clear line, keep attribution tight, and choose an aspect ratio that matches the channel where the card will be posted first. The result should feel like a distilled idea, not a screenshot of a paragraph.",
        ],
      },
    ],
    faq: [
      {
        question: "Can I export the card as an image?",
        answer:
          "Yes. The tool exports a PNG after rendering the card with your selected template, size, and accent color.",
      },
      {
        question: "Does it support multiple social sizes?",
        answer:
          "Yes. It includes landscape, square, and portrait-friendly aspect ratios so the card can fit different distribution channels.",
      },
    ],
    relatedPaths: [
      "/tools/headline-analyzer",
      "/tools/markdown-to-medium-substack-formatter",
      "/distribution-flywheel",
      "/blogs/how-to-distribute-one-article-across-blog-newsletter-youtube-and-shorts",
    ],
  },
  {
    slug: "free-remotion-templates",
    path: "/tools/free-remotion-templates",
    title: "Free Remotion Templates",
    description:
      "Download 5 free video templates: Nightfall, Spotlight, Matrix, Gridcraft, and Geometric Explainer. Each is a complete TypeScript source project — unzip, npm install, and run in Remotion Studio.",
    eyebrow: "Free Download",
    heroTitle: "5 free Remotion templates for blog-to-video content.",
    heroDescription:
      "Download Geometric Explainer, Nightfall, Spotlight, Matrix, and Gridcraft — complete TypeScript source code, ready to run in Remotion Studio. Sign in to download the full ZIP.",
    category: "download",
    icon: "FT",
    primaryKeyword: "free remotion templates",
    keywordVariant: "blog to video remotion templates download",
    badges: ["5 Templates", "ZIP Download", "TypeScript Source"],
    proofPoints: [
      "Each template is a standalone Remotion project — unzip, npm install, npx remotion studio, and it runs.",
      "Templates cover cinematic dark, bold kinetic, editorial grid, cyberpunk terminal, and clean explainer visual styles.",
      "Download is free with a Blog2Video account — no credit card required.",
    ],
    sections: [
      {
        title: "What these templates include",
        body: [
          "Each ZIP is a complete standalone Remotion project: TypeScript compositions, all layout components, shared utilities, sample data, and everything needed to run npx remotion studio out of the box.",
          "These are the exact compositions used by Blog2Video's production pipeline — cinematic dark, bold kinetic typography, editorial bento grids, cyberpunk terminal, and structured explainer styles.",
        ],
      },
      {
        title: "How to use the templates",
        body: [
          "After downloading, unzip the archive, run npm install, then npx remotion studio to preview the composition with sample data. Swap in your own data JSON to render your content.",
        ],
        bullets: [
          "Each template folder contains the full Remotion composition in TypeScript/TSX.",
          "Sample data JSON files are included so every layout scene renders correctly on first run.",
          "Swap the sample data for your own content and render with npx remotion render.",
        ],
      },
    ],
    faq: [
      {
        question: "Do I need a paid Blog2Video account to download?",
        answer:
          "No. A free Blog2Video account is all that's required. Sign in with Google and download instantly.",
      },
      {
        question: "Can I use these templates commercially?",
        answer:
          "Yes. The templates are provided for personal and commercial use.",
      },
      {
        question: "Which Remotion version are these templates designed for?",
        answer:
          "The templates are built and tested with Remotion 4.x. Run npm install inside the unzipped project and all correct versions are installed automatically.",
      },
      {
        question: "Can Blog2Video build a custom template for my brand?",
        answer:
          "Yes. Blog2Video Pro includes access to custom template creation tailored to your brand identity, color palette, and content style. See the pricing page for details.",
      },
    ],
    relatedPaths: [
      "/templates/nightfall",
      "/templates/spotlight",
      "/templates/matrix",
      "/templates/gridcraft",
      "/templates/geometric-explainer",
    ],
  },
];

export function getTool(slug: string) {
  return tools.find((tool) => tool.slug === slug);
}

export function getToolByPath(path: string) {
  return tools.find((tool) => tool.path === path);
}
