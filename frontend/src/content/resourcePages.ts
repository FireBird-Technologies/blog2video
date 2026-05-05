import { createFaq, createPage } from "./marketingBase";
import type { MarketingPage } from "./seoTypes";

export const resourcePages: MarketingPage[] = [
  createPage({
    path: "/video-seo-checklist",
    title: "Video SEO Checklist for Google and YouTube Rankings",
    description:
      "A practical video SEO checklist for ranking videos on Google, YouTube, Shorts, and embedded article pages.",
    eyebrow: "Checklist",
    heroTitle: "The video SEO checklist for ranking on Google and YouTube",
    heroDescription:
      "Use this checklist before publishing every repurposed blog video: keyword targeting, script structure, metadata, chapters, embeds, schema, thumbnails, and distribution links.",
    category: "resource",
    primaryKeyword: "video SEO checklist",
    keywordVariant: "YouTube SEO checklist",
    badges: ["Google video results", "YouTube metadata", "Repurposed blog videos"],
    proofPoints: [
      "Covers the full path from source article to published video, not just tags and titles.",
      "Works for YouTube videos, embedded blog videos, Shorts, and product explainers.",
      "Built as a linkable resource for SEO, content marketing, and repurposing resource pages.",
    ],
    workflowSteps: [
      "Choose a source article with search intent, product relevance, or proven audience engagement.",
      "Map the target video keyword, title angle, thumbnail promise, and first 30 seconds before editing.",
      "Publish with optimized metadata, chapters, transcript, embed context, and VideoObject schema where possible.",
      "Distribute the video back through the article, newsletter, social clips, and internal links.",
    ],
    sections: [
      {
        title: "Pre-production checklist",
        body: [
          "Video SEO starts before the file exists. The winning videos usually have a clear query, a visible promise, and a script that answers the viewer's question quickly.",
        ],
        bullets: [
          "Pick one primary keyword and one secondary variation.",
          "Confirm the search intent: tutorial, comparison, definition, review, or example.",
          "Turn the first 30 seconds into a direct answer, not a slow introduction.",
          "Plan the thumbnail and title together so they make one clear promise.",
          "Use the original article headings as the first draft of the video structure.",
        ],
      },
      {
        title: "On-page and YouTube metadata checklist",
        body: [
          "Metadata should make the video easy for viewers and search engines to understand. Avoid keyword stuffing. The title, description, chapters, and surrounding page copy should all reinforce the same topic.",
        ],
        bullets: [
          "Put the primary keyword or close variant in the title naturally.",
          "Write a description that summarizes the outcome, links to the canonical article, and includes useful resources.",
          "Add chapters with descriptive labels that match real sections of the video.",
          "Upload or generate a clean transcript so the topic is machine-readable.",
          "Use tags sparingly for variants, brand terms, and common misspellings.",
        ],
      },
      {
        title: "Embedded video SEO checklist",
        body: [
          "For blog-to-video workflows, the article page matters as much as the YouTube page. A strong embed gives Google more context and gives visitors another reason to stay.",
        ],
        bullets: [
          "Embed the video near the section where it answers the reader's intent.",
          "Add a short text summary below the embed for skimmers and crawlers.",
          "Use VideoObject schema when you control the page markup.",
          "Link from the video description back to the article and from the article back to the video.",
          "Add internal links from related blog posts, use-case pages, and tool pages.",
        ],
      },
      {
        title: "Distribution checklist",
        body: [
          "A video has a better chance of ranking when it earns early engagement and sits inside a connected content system. Repurpose the same video into smaller assets instead of treating publish day as the finish line.",
        ],
        bullets: [
          "Cut 3 to 5 short clips from the strongest moments.",
          "Post one clip with a link to the canonical article or YouTube video.",
          "Send the video in a newsletter with a short editorial note.",
          "Add the video to relevant resource pages, comparison pages, and onboarding docs.",
          "Refresh the original article if the video adds new examples or explanations.",
        ],
      },
    ],
    recommendedTemplate: "spotlight",
    recommendedTemplateReason:
      "Spotlight works well for SEO-focused explainers because it turns hooks, keywords, and proof points into clear high-retention scenes.",
    faq: [
      {
        question: "What is video SEO?",
        answer:
          "Video SEO is the practice of making videos easier to discover, understand, and rank across YouTube, Google video results, embedded pages, and social platforms.",
      },
      {
        question: "Does embedding a video help a blog post rank?",
        answer:
          "It can help when the video supports the page's search intent, keeps visitors engaged, and is surrounded by useful text, links, and structured data. The embed should strengthen the page rather than sit there as decoration.",
      },
      {
        question: "Should every blog post become a video?",
        answer:
          "No. Prioritize posts with proven traffic, high commercial intent, strong tutorials, visual explanations, or topics where YouTube also shows demand.",
      },
    ],
    relatedPaths: [
      "/tools/content-repurposing-calculator",
      "/blog-to-youtube-video",
      "/distribution-flywheel",
      "/blogs/video-seo-ranking-traffic-blog2video",
    ],
    cta: {
      title: "Turn the checklist into a repeatable video workflow",
      body:
        "Paste a finished article into Blog2Video, generate a narrated video, then use this checklist to publish it with stronger metadata, embeds, and distribution.",
      primaryLabel: "Try Blog2Video free",
      primaryHref: "/",
      secondaryLabel: "Use the calculator",
      secondaryHref: "/tools/content-repurposing-calculator",
    },
  }),
  createPage({
    path: "/distribution-flywheel",
    title: "Blog2Video Distribution Flywheel for Medium, Substack, and Video",
    description:
      "A canonical-first distribution workflow that uses your site, Medium, Substack, and video together.",
    eyebrow: "Resource",
    heroTitle: "Run one canonical publishing system across your site, Medium, Substack, and video",
    heroDescription:
      "The strongest SEO and audience strategy is not picking one channel. It is using each channel differently while keeping your site as the canonical home of the content.",
    category: "resource",
    primaryKeyword: "content distribution flywheel",
    keywordVariant: "Medium Substack SEO workflow",
    proofPoints: [
      "Keeps owned-site SEO compounding while still using external platforms for discovery.",
      "Turns each post into a site page, newsletter angle, Medium story, and video asset.",
      "Creates consistent branded search and cross-channel reinforcement over time.",
    ],
    sections: [
      {
        title: "Canonical-first publishing workflow",
        body: [
          "Publish the full, search-targeted version on Blog2Video first. That page becomes the canonical asset that accumulates internal links, schema, and long-term search value.",
          "Then adapt the idea for Substack and Medium instead of posting the exact same piece everywhere. Substack gets commentary and relationship-building. Medium gets narrative thought leadership and distribution hooks.",
        ],
        bullets: [
          "Canonical site post with strong internal links and CTA.",
          "Substack adaptation with extra opinion and an owned-site CTA.",
          "Medium adaptation with a tighter founder-led hook and contextual links.",
          "Video version for YouTube and Shorts that points back to the site page.",
        ],
      },
      {
        title: "Publishing checklist",
        body: [
          "Each topic should produce multiple assets inside the same week so the idea compounds instead of disappearing after one publish.",
        ],
        bullets: [
          "Publish the canonical article on the site.",
          "Adapt it into a Substack issue with a different opening and CTA.",
          "Adapt it into a Medium post with a different framing angle.",
          "Render one long-form explainer and one short-form teaser from the same source.",
        ],
      },
    ],
    recommendedTemplate: "newspaper",
    recommendedTemplateReason:
      "Newspaper works especially well for recurring cross-channel publishing because it gives each piece a serialized editorial feel.",
    faq: createFaq(
      "cross-channel content repurposing",
      "Founders and creators publishing across owned and rented channels",
      "Blog2Video operationalizes a repeatable workflow where each idea becomes multiple assets instead of one-off posts that disappear."
    ),
    relatedPaths: [
      "/for-medium-writers",
      "/for-substack-writers",
      "/blog-to-youtube-video",
      "/blogs/how-to-distribute-one-article-across-blog-newsletter-youtube-and-shorts",
    ],
  }),
  createPage({
    path: "/measurement-playbook",
    title: "SEO Measurement Playbook for Blog2Video",
    description:
      "Track indexation, impressions, CTR, conversions, and channel assists across your SEO program.",
    eyebrow: "Resource",
    heroTitle: "Measure SEO by page type, not just by total traffic",
    heroDescription:
      "The fastest way to learn what is working is to separate commercial pages, blog posts, templates, and programmatic pages so each cluster can improve on its own.",
    category: "resource",
    primaryKeyword: "seo measurement playbook",
    keywordVariant: "search console measurement framework",
    proofPoints: [
      "Makes it easier to see what kind of pages are ranking, converting, and stagnating.",
      "Helps rewrite metadata and internal links based on evidence rather than guesses.",
      "Turns Search Console and Bing data into a weekly operating loop.",
    ],
    sections: [
      {
        title: "Core measurement stack",
        body: [
          "Use Google Search Console and Bing Webmaster Tools to monitor coverage, indexation, and query performance. The sitemap generated by this project should be submitted to both search engines after deployment.",
        ],
        bullets: [
          "Track indexation by page type.",
          "Monitor CTR for pages with high impressions.",
          "Watch assisted signups from Medium and Substack referrals.",
          "Prioritize pages ranking in positions 8 through 20 for optimization.",
        ],
      },
      {
        title: "Weekly reporting cadence",
        body: [
          "Review new indexing issues, pages gaining impressions, and pages that are close to ranking on page one. Then feed those learnings back into metadata, internal links, FAQ depth, and content updates.",
        ],
      },
    ],
    recommendedTemplate: "gridcraft",
    recommendedTemplateReason:
      "Gridcraft is a natural fit for reporting and measurement content because it handles KPI-style communication cleanly.",
    faq: createFaq(
      "SEO measurement",
      "Teams running multiple page types and content channels",
      "Blog2Video's content system gives you enough structure to measure clusters separately instead of treating all organic traffic as one undifferentiated number."
    ),
    relatedPaths: [
      "/distribution-flywheel",
      "/blogs/programmatic-video-generation-for-content-marketers",
      "/blogs/content-repurposing-workflow-for-solo-founders",
      "/pricing",
    ],
  }),
];
