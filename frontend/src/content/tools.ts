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
    slug: "substack-directory",
    path: "/tools/substack-directory",
    title: "Substack Directory by Niche",
    description:
      "Browse curated Substack niches, pricing-model pages, and publication profiles through a scalable directory built for discovery and internal linking.",
    eyebrow: "Directory",
    heroTitle: "Find the right Substack niches, not just a random list of newsletters.",
    heroDescription:
      "Explore curated niche pages, pricing slices, and publication profiles designed to help creators map where a newsletter brand fits.",
    category: "directory",
    icon: "SD",
    primaryKeyword: "substack directory by niche",
    keywordVariant: "best substacks by niche",
    badges: ["Niche pages", "Pricing filters", "Publication profiles"],
    proofPoints: [
      "Niche pages are internally linked for discovery instead of living as isolated listicles.",
      "Pricing-model variants create useful slices for free, paid, and freemium newsletter research.",
      "Publication profiles add depth beyond a single scrolling directory page.",
    ],
    sections: [
      {
        title: "How this directory is organized",
        body: [
          "The directory starts with niches, then gives you pricing-model views inside each niche, plus publication profile pages that explain positioning, audience fit, and editorial differentiators.",
          "That structure makes the directory easier to browse and much more scalable than a single mega-list.",
        ],
      },
      {
        title: "How to use the niche and pricing pages",
        body: [
          "Start with the closest niche page, then narrow further using free, paid, or freemium pricing slices. If you want deeper context on a publication, open the profile page for its audience, tone, and best-fit use case.",
        ],
      },
    ],
    faq: [
      {
        question: "Is this directory editorial or official?",
        answer:
          "It is curated editorially for discovery. Pricing model, cadence, and positioning should be treated as a practical classification layer rather than an official platform listing.",
      },
      {
        question: "Why include pricing-model pages?",
        answer:
          "Because many creators are not just choosing by topic. They are benchmarking what free, paid, and freemium newsletter businesses look like inside a niche.",
      },
    ],
    relatedPaths: [
      "/tools/substack-revenue-calculator",
      "/tools/markdown-to-medium-substack-formatter",
      "/for-substack-writers",
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
];

export function getTool(slug: string) {
  return tools.find((tool) => tool.slug === slug);
}

export function getToolByPath(path: string) {
  return tools.find((tool) => tool.path === path);
}
