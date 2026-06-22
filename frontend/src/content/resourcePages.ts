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
    keywordVariant: "Google video SEO checklist",
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
          "Rename the video file itself to include the target keyword before uploading — search engines read the filename.",
          "Target at least 5-8 minutes of substantive runtime where the topic supports it; longer, fully-watched videos tend to outrank short ones for the same query.",
        ],
      },
      {
        title: "On-page and YouTube metadata checklist",
        body: [
          "Metadata should make the video easy for viewers and search engines to understand. Avoid keyword stuffing. The title, description, chapters, and surrounding page copy should all reinforce the same topic.",
        ],
        bullets: [
          "Put the primary keyword or close variant in the title naturally, ideally within the first 5-12 words.",
          "Write a description of at least 200 words that opens with the target keyword, summarizes the outcome, links to the canonical article, and includes useful resources.",
          "Add chapters with descriptive labels that match real sections of the video.",
          "Upload or generate a clean transcript so the topic is machine-readable.",
          "Use tags sparingly for variants, brand terms, and common misspellings.",
          "Set the correct YouTube category so the platform groups the video with relevant content and surfaces it in related playlists.",
          "Design the thumbnail to make a single visual promise that matches the title — thumbnail CTR is one of the strongest ranking signals you control directly.",
          "Add end screens, cards, and a playlist placement so the video keeps earning watch time after it ends.",
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
      {
        question: "Do YouTube tags still matter for SEO?",
        answer:
          "Tags carry far less weight than title, description, and the first 30 seconds of watch time, but a handful of accurate variant and misspelling tags still help YouTube disambiguate the topic. Don't rely on them as a primary ranking lever.",
      },
      {
        question: "How long should an SEO-focused video be?",
        answer:
          "Long enough to fully answer the search intent and hold attention — for most repurposed blog content that's 5-8+ minutes. Favor completed watch time over hitting a specific length target.",
      },
      {
        question: "Is this different from a YouTube SEO checklist?",
        answer:
          "Yes. This checklist covers the full path from source article to a published, embeddable video on Google and YouTube. For the platform-specific YouTube upload checklist — file names, categories, end screens, playlists — see the dedicated YouTube SEO checklist.",
      },
    ],
    relatedPaths: [
      "/youtube-seo-checklist",
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
    path: "/youtube-seo-checklist",
    title: "YouTube SEO Checklist for Repurposed Blog Videos",
    description:
      "A platform-specific YouTube SEO checklist: target keyword, file naming, title, description, tags, category, thumbnail, end screens, and playlists.",
    eyebrow: "Checklist",
    heroTitle: "The YouTube SEO checklist for every video you upload",
    heroDescription:
      "Use this before you publish any blog-to-video upload: target keyword, file name, title and description format, tags, category, thumbnail, captions, end screens, and playlist placement.",
    category: "resource",
    primaryKeyword: "youtube seo checklist",
    keywordVariant: "youtube video seo checklist",
    badges: ["Upload-ready", "YouTube algorithm", "Repurposed blog videos"],
    proofPoints: [
      "Covers the platform-specific upload steps that a general video SEO checklist doesn't: file naming, category, end screens, playlists.",
      "Built for repurposed blog content, not just standalone YouTube-first creators.",
      "Pairs with the broader video SEO checklist for the full article-to-published-video path.",
    ],
    workflowSteps: [
      "Pick one target keyword before you script or upload anything.",
      "Name the video file with the target keyword before uploading.",
      "Write the title, description, and tags around that same keyword.",
      "Set the category, thumbnail, end screens, and playlist placement before publishing.",
    ],
    sections: [
      {
        title: "Before you upload",
        body: [
          "YouTube's algorithm starts reading signals before the video is even public. Get these right first so the rest of the checklist has something solid to build on.",
        ],
        bullets: [
          "Choose one target keyword your audience actually searches for — check YouTube's autosuggest to confirm real demand.",
          "Rename the video file to include the target keyword (e.g. blog-to-video-seo-checklist.mp4) before uploading.",
          "Write or generate accurate captions and a full transcript — auto-captions help, but a clean transcript is more reliable for indexing.",
          "Plan the thumbnail and title together so they make one clear, specific promise.",
        ],
      },
      {
        title: "Title, description, and tags",
        body: [
          "Metadata should read naturally for a human first. Search engines reward content that earns watch time, not just keyword density.",
        ],
        bullets: [
          "Keep the title 5-12 words and include the target keyword once, without stuffing.",
          "Open the description with the target keyword in the first sentence; aim for 200+ words total.",
          "Link back to the canonical article and any related videos inside the description.",
          "Add tags for close variants, brand terms, and common misspellings — a handful is enough, not a wall of tags.",
        ],
      },
      {
        title: "Category, thumbnail, and engagement signals",
        body: [
          "These are the platform-specific levers a generic video SEO checklist usually skips, and they materially affect how YouTube distributes the video after upload.",
        ],
        bullets: [
          "Set the correct video category so YouTube groups it with relevant content and surfaces it in related playlists.",
          "Design a thumbnail that makes one visual promise matching the title — thumbnail CTR directly affects how much YouTube continues to promote the video.",
          "Add chapters with descriptive, keyword-relevant labels for any video over 3-4 minutes.",
          "Add end screens and cards pointing to your next-best video, and place the video into a relevant playlist.",
          "Target enough runtime to fully answer the topic — longer videos with strong retention tend to outrank shorter, thinner ones for the same query.",
        ],
      },
    ],
    recommendedTemplate: "spotlight",
    recommendedTemplateReason:
      "Spotlight's punchy pacing and clear hooks help repurposed blog videos hold attention long enough to satisfy YouTube's watch-time signals.",
    faq: [
      {
        question: "What's the single most important item on a YouTube SEO checklist?",
        answer:
          "Picking one real target keyword before you script, upload, or title anything. Every other item — file name, title, description, tags, thumbnail — should reinforce that same keyword.",
      },
      {
        question: "Does renaming the video file before upload actually matter?",
        answer:
          "Yes, though it's a minor signal compared to title and watch time. YouTube reads the file name as one more piece of context about the topic, so it's a low-effort step worth doing every time.",
      },
      {
        question: "How is this different from a general video SEO checklist?",
        answer:
          "This one is scoped to the YouTube upload flow specifically — file names, categories, end screens, playlists. For the broader path from source article to published, embeddable video across Google and YouTube, see the video SEO checklist.",
      },
      {
        question: "Do chapters and end screens really affect ranking?",
        answer:
          "Indirectly. Chapters help viewers find what they want faster, which improves watch time and reduces drop-off. End screens and playlists keep viewers on YouTube longer. Both feed the engagement signals YouTube's algorithm actually optimizes for.",
      },
    ],
    relatedPaths: [
      "/video-seo-checklist",
      "/blog-to-youtube-video",
      "/distribution-flywheel",
      "/blogs/video-seo-ranking-traffic-blog2video",
    ],
    cta: {
      title: "Generate the video, then run this checklist before you publish",
      body:
        "Paste a finished article into Blog2Video, generate a narrated video, then work through this checklist before it goes live on YouTube.",
      primaryLabel: "Try Blog2Video free",
      primaryHref: "/",
      secondaryLabel: "See the video SEO checklist",
      secondaryHref: "/video-seo-checklist",
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
  createPage({
    path: "/for-finance-publishers",
    title: "Custom Branded Video Templates for Finance Publishers | Blog2Video",
    description:
      "Blog2Video builds custom branded video templates for finance writers, analysts, and newsletter publishers. Your brand identity, your content structure, your template built by expert designers.",
    eyebrow: "Use Case",
    heroTitle: "Custom branded video templates for finance publishers and writers",
    heroDescription:
      "Finance content has its own visual language: authority, precision, and data clarity. Our designers study your brand, your industry, and your audience to build a video template that looks like yours and no one else's.",
    category: "use-case",
    primaryKeyword: "video templates for finance publishers",
    keywordVariant: "custom branded video for finance writers",
    badges: ["Finance Content", "Custom Templates", "Newsletter Video", "Brand Identity"],
    proofPoints: [
      "Every template is built from scratch around your brand: your fonts, colors, content structure, and visual identity.",
      "Our designers study your website, social presence, and published material before a single scene is drawn.",
      "Finance publishers get a template that signals authority to their audience, not a generic AI-generated look.",
    ],
    workflowSteps: [
      "We gather the essentials from your brand: website, social pages, fonts, colors, themes, design philosophy, and the visual patterns common in your corner of the finance industry.",
      "Our designers write an extensive design document drawing on your material, our accumulated expertise across finance clients, and AI refinement before anything is executed.",
      "We build the template inside our custom AI editor designed for motion graphics, with your designer reviewing every scene, controlling every placement, and iterating until it is right.",
      "We share the initial template with you, incorporate your feedback, and refine until the result fully reflects your brand. Then it is yours to reuse across every piece of content you publish.",
    ],
    sections: [
      {
        title: "Why finance content demands a purpose-built template",
        body: [
          "Finance publishers operate in a space where credibility is everything. Your readers are evaluating your content against Bloomberg terminals, Wall Street research decks, and decades of authoritative financial media. A generic video template signals immediately that you are not in that league.",
          "The visual language of serious finance content is specific: clean data presentation, considered typography, structured layouts that make numbers and analysis easy to follow. These things cannot be approximated by picking a stock template from a library. They have to be designed with your brand and your audience in mind.",
          "Blog2Video builds custom templates for finance writers, analysts, newsletter publishers, and book authors who want video that earns the same trust their written work already commands.",
        ],
      },
      {
        title: "How we research and build your template",
        body: [
          "We start from the very basics. For every client we gather information on the essentials: your website, social pages, fonts, colors, themes, and brand design philosophy. We also study the visual patterns common in your specific area of finance, whether that is personal finance, market analysis, macroeconomics, or investment strategy.",
          "We ask you for this information directly, and we supplement it with our own research into whatever branded material we can find. We ensure the finished template does not conflict with your existing visual identity. It extends it.",
          "We then produce an extensive design document. This document draws on everything we learned from you and on the collective wisdom we have built up working across all our clients, especially those in finance and adjacent industries. We give it to our design experts to refine, and we feed it through our AI systems before a single frame is produced.",
        ],
      },
      {
        title: "Building with our custom AI editor",
        body: [
          "We have built a custom AI editor internally, specifically designed for motion graphics production. The design document feeds into this editor to give the template its initial skin. From there, a dedicated designer reviews every scene individually, requests regenerations where the output is not right, adds detail manually, and fixes every element in its correct position.",
          "The editor gives our designers all the tools they need to work quickly and with precision. They also have access to other AI tools to bring additional artifacts and information into the template as needed. The result is not an automated output. It is a designed product that happens to be built with AI assistance.",
          "Once the template is built, we share it with you for review. If anything does not feel right, we refine it. We continue until you are confident the template represents your brand accurately.",
        ],
        bullets: [
          "Branded templates are infinitely reusable across every article, newsletter issue, or post you publish.",
          "Custom charts, infographics, animations, and typefaces can all be built into your template.",
          "Customizations based on updated brand direction can always be added.",
        ],
      },
      {
        title: "What finance publishers say about the result",
        body: [
          "Cosmo DeStefano is a finance strategist and author of Wealth Your Way, a book and Substack newsletter helping readers build lasting financial independence through clear, actionable frameworks. He came to Blog2Video skeptical that any tool or team could translate his writing voice into video without losing what made it his.",
          "\"As a book author and Substack writer, I was genuinely skeptical that any tool or team could translate my writing into video content that actually sounded like me. Blog2Video changed my mind completely. The production quality is sharp, turnaround has been consistently fast, and the team has been genuinely responsive at every step. What impressed me most was their commitment to building a custom template that matched my brand rather than simply dropping my posts into a generic layout. The result is video content that feels like a natural extension of my writing, not a diluted version of it. The experience has been professional, collaborative, and worth every dollar, at a fraction of what traditional video production would have cost. For any writer or content creator who wants to extend their work into video without sacrificing what makes their brand distinctive, Blog2Video is absolutely worth a serious look.\"",
          "Cosmo DeStefano, Finance Strategist and Author, Wealth Your Way",
        ],
      },
    ],
    recommendedTemplate: "bloomberg",
    recommendedTemplateReason:
      "The Bloomberg template gives finance content the visual authority of a professional trading terminal, with ticker chrome, dashboard panels, and data layouts that signal credibility to finance audiences immediately.",
    faq: [
      {
        question: "What makes a custom template different from Blog2Video's standard templates?",
        answer:
          "Standard templates are high quality but designed for broad use. A custom template is built entirely around your brand: your specific fonts, colors, layout logic, and content style. Every video you produce from it looks unmistakably like yours.",
      },
      {
        question: "How do you learn enough about my brand to design the template?",
        answer:
          "We ask you for the essentials directly and supplement that with independent research into your website, social presence, and published material. We also draw on what we know about visual conventions in your specific area of finance. The design document we produce before building anything reflects all of this.",
      },
      {
        question: "Can I reuse the template across all my future content?",
        answer:
          "Yes. Once your template is built it is yours to use for every article, newsletter issue, or analysis you publish. There is no per-video design cost. The template renders your brand consistently every time.",
      },
      {
        question: "What types of finance content work well with a custom template?",
        answer:
          "Market analysis, investment strategy, personal finance, macroeconomic commentary, earnings breakdowns, newsletter issues, and book-based content all convert well. If you are already publishing written finance content, a custom template gives it a video channel with no additional design overhead.",
      },
    ],
    cta: {
      title: "Get a branded video template built for your finance content",
      body: "Tell us about your brand and our design team will build a template that makes every video you publish look like it belongs in the same league as your writing.",
      primaryLabel: "Sign up for free",
      primaryHref: "/",
      secondaryLabel: "Request a custom template",
      secondaryHref: "/custom-branded-video-templates",
    },
    relatedPaths: [
      "/custom-branded-video-templates",
      "/for-substack-writers",
      "/newsletter-to-video",
      "/pricing",
    ],
  }),
];
