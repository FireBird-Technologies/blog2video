import { createFaq, createPage, templateBySlug } from "./marketingBase";
import type { ContentSection, MarketingPage } from "./seoTypes";

type ProgrammaticSeed = {
  path: string;
  title: string;
  description: string;
  eyebrow: string;
  heroTitle: string;
  heroDescription: string;
  primaryKeyword: string;
  keywordVariant: string;
  recommendedTemplate: string;
  recommendedTemplateReason?: string;
  proofPoints: string[];
  sections: ContentSection[];
  relatedPaths: string[];
};

const seeds: ProgrammaticSeed[] = [
  {
    path: "/pdf-to-course-video",
    title: "PDF To Course Video Workflow",
    description:
      "Turn educational PDFs into course-style videos with narration, structure, and reusable lesson pacing.",
    eyebrow: "Programmatic workflow",
    heroTitle: "Turn static PDFs into course-ready video lessons",
    heroDescription:
      "Use existing educational PDFs as the source for lesson videos that are easier to distribute and revisit.",
    primaryKeyword: "pdf to course video",
    keywordVariant: "course pdf to video",
    recommendedTemplate: "whiteboard",
    proofPoints: [
      "Fits courses, training libraries, and asynchronous lessons.",
      "Extends existing lesson material into video without re-recording from scratch.",
      "Works well for educational teams building reusable curriculum assets.",
    ],
    sections: [
      {
        title: "Best use case",
        body: [
          "This workflow is strong when the original PDF already has a teaching arc and needs a more engaging delivery format.",
        ],
      },
    ],
    relatedPaths: ["/pdf-to-video", "/for-educators", "/templates/whiteboard"],
  },
  {
    path: "/docx-to-linkedin-video",
    title: "DOCX To LinkedIn Video Workflow",
    description:
      "Turn internal or external DOCX-based thought leadership into LinkedIn-ready video explainers.",
    eyebrow: "Programmatic workflow",
    heroTitle: "Turn written thought leadership into LinkedIn video without rebuilding the argument",
    heroDescription:
      "Use document-first workflows to create polished, professional video explainers for LinkedIn distribution.",
    primaryKeyword: "docx to LinkedIn video",
    keywordVariant: "document to LinkedIn video",
    recommendedTemplate: "spotlight",
    proofPoints: [
      "Useful for founder posts, customer education, and B2B thought leadership.",
      "Helps document-first teams extend ideas into video-native distribution.",
      "Supports faster reuse of existing written assets.",
    ],
    sections: [
      {
        title: "Best use case",
        body: [
          "This workflow works when a detailed document needs to become a sharper, more shareable video asset for professional audiences.",
        ],
      },
    ],
    relatedPaths: ["/docx-to-video", "/for-technical-writers", "/blog-to-shorts"],
  },
  {
    path: "/pptx-to-youtube-video",
    title: "PPTX To YouTube Video Workflow",
    description:
      "Convert slide decks into YouTube explainers without re-recording every presentation.",
    eyebrow: "Programmatic workflow",
    heroTitle: "Turn decks into YouTube explainers that keep the narrative intact",
    heroDescription:
      "Presentation teams can use slide-first material as the input for reusable YouTube content.",
    primaryKeyword: "pptx to YouTube video",
    keywordVariant: "powerpoint to YouTube video",
    recommendedTemplate: "gridcraft",
    proofPoints: [
      "Works for webinars, talks, and internal training decks.",
      "Extends presentation content into evergreen discovery surfaces.",
      "Reduces the cost of turning decks into publishable content.",
    ],
    sections: [
      {
        title: "Best use case",
        body: [
          "This is useful when the deck already communicates the idea clearly and the goal is to publish it outside the original room.",
        ],
      },
    ],
    relatedPaths: ["/pptx-to-video", "/blog-to-youtube-video", "/templates/gridcraft"],
  },
  {
    path: "/url-to-linkedin-video",
    title: "URL To LinkedIn Video Workflow",
    description:
      "Turn live URLs into LinkedIn-ready video explainers for product, founder, and educational distribution.",
    eyebrow: "Programmatic workflow",
    heroTitle: "Turn published pages into professional LinkedIn videos quickly",
    heroDescription:
      "Repurpose existing published content into a polished professional video for a distribution channel that rewards clarity and authority.",
    primaryKeyword: "url to LinkedIn video",
    keywordVariant: "webpage to LinkedIn video",
    recommendedTemplate: "nightfall",
    proofPoints: [
      "Useful for product launches, founder commentary, and customer education.",
      "Turns already-published content into a professional video asset fast.",
      "Creates a clean bridge from site content to social distribution.",
    ],
    sections: [
      {
        title: "Best use case",
        body: [
          "Use this when the content already lives on a public page and the next step is extending it into a professional video for a social audience.",
        ],
      },
    ],
    relatedPaths: ["/url-to-video", "/distribution-flywheel", "/for-medium-writers"],
  },
  {
    path: "/url-to-tiktok-video",
    title: "URL To TikTok Video Workflow",
    description:
      "Turn published written content into short, vertical video assets for TikTok-style distribution.",
    eyebrow: "Programmatic workflow",
    heroTitle: "Turn a published URL into a vertical video hook",
    heroDescription:
      "Use long-form written content as the source for short, attention-grabbing videos that point viewers back to the deeper asset.",
    primaryKeyword: "url to TikTok video",
    keywordVariant: "article to TikTok video",
    recommendedTemplate: "spotlight",
    proofPoints: [
      "Makes short-form video easier to maintain from existing content.",
      "Useful for teaser clips and discovery-led distribution.",
      "Lets one published page feed multiple channels.",
    ],
    sections: [
      {
        title: "Best use case",
        body: [
          "When a long-form piece already exists, short-form distribution is often the fastest way to create new discovery around it.",
        ],
      },
    ],
    relatedPaths: ["/blog-to-shorts", "/distribution-flywheel", "/url-to-video"],
  },
  {
    path: "/for-medium-writers/blog-to-video",
    title: "Blog To Video for Medium Writers",
    description:
      "Use Medium posts as the starting point for videos that create discovery and point back to owned properties.",
    eyebrow: "Programmatic use case",
    heroTitle: "Turn Medium articles into videos without letting Medium own all the attention",
    heroDescription:
      "A Medium-first writing workflow becomes more durable when every strong article can also become a reusable video asset.",
    primaryKeyword: "Medium blog to video",
    keywordVariant: "turn Medium article into video",
    recommendedTemplate: "nightfall",
    proofPoints: [
      "Great for founder-led essays and product thought leadership.",
      "Turns Medium into a discovery layer, not the only content home.",
      "Supports link-back workflows into site pages and product pages.",
    ],
    sections: [
      {
        title: "Best use case",
        body: [
          "Use this when Medium helps reach new readers, but your site and product pages should still compound the value over time.",
        ],
      },
    ],
    relatedPaths: ["/for-medium-writers", "/distribution-flywheel", "/blog-to-video"],
  },
  {
    path: "/for-substack-writers/blog-to-video",
    title: "Blog To Video for Substack Writers",
    description:
      "Turn Substack essays and newsletter posts into videos that support audience growth and retention.",
    eyebrow: "Programmatic use case",
    heroTitle: "Turn newsletter essays into video episodes and clips",
    heroDescription:
      "Substack writers can build more distribution around every issue by turning strong newsletter posts into repeatable video content.",
    primaryKeyword: "Substack post to video",
    keywordVariant: "turn Substack article into video",
    recommendedTemplate: "newspaper",
    proofPoints: [
      "Fits recurring essays, commentary, and editorial shows.",
      "Helps each newsletter travel beyond the inbox.",
      "Makes archive reuse far easier.",
    ],
    sections: [
      {
        title: "Best use case",
        body: [
          "This is strongest when a recurring newsletter already exists and the goal is to transform each issue into a wider distribution asset.",
        ],
      },
    ],
    relatedPaths: ["/for-substack-writers", "/for-newsletters", "/distribution-flywheel"],
  },
  {
    path: "/for-technical-writers/docx-to-video",
    title: "DOCX To Video for Technical Writers",
    description:
      "Turn technical documentation documents into videos that support onboarding, education, and product adoption.",
    eyebrow: "Programmatic use case",
    heroTitle: "Use documentation documents as the source for customer and user education videos",
    heroDescription:
      "Technical writers can turn existing documentation artifacts into explainers without rebuilding them from zero in a video tool.",
    primaryKeyword: "technical writer docx to video",
    keywordVariant: "documentation docx to video",
    recommendedTemplate: "geometric-explainer",
    proofPoints: [
      "Useful for enablement, onboarding, and developer education.",
      "Extends documentation into formats more audiences will actually consume.",
      "Maintains the precision of the original instructions.",
    ],
    sections: [
      {
        title: "Best use case",
        body: [
          "This workflow is ideal when the instruction set already exists in DOCX form and needs a more scalable way to reach users.",
        ],
      },
    ],
    relatedPaths: ["/for-technical-writers", "/docx-to-video", "/code-snippet-to-video"],
  },
  {
    path: "/for-researchers/pdf-to-video",
    title: "PDF To Video for Researchers",
    description:
      "Convert research PDFs into accessible explainer videos for labs, reports, and public communication.",
    eyebrow: "Programmatic use case",
    heroTitle: "Use research PDFs as the source for clearer explainer videos",
    heroDescription:
      "Researchers can communicate complex findings more effectively by turning structured PDFs into accessible videos.",
    primaryKeyword: "research pdf to video",
    keywordVariant: "pdf research paper to video",
    recommendedTemplate: "gridcraft",
    proofPoints: [
      "Useful for research summaries, findings, and lab updates.",
      "Makes dense knowledge more accessible to non-specialist audiences.",
      "Works well when evidence and structure matter.",
    ],
    sections: [
      {
        title: "Best use case",
        body: [
          "Use this workflow when the original research PDF is authoritative but the audience needs a simpler, more visual explanation layer.",
        ],
      },
    ],
    relatedPaths: ["/for-researchers", "/pdf-to-video", "/diagram-to-video"],
  },
  {
    path: "/for-educators/pptx-to-video",
    title: "PPTX To Video for Educators",
    description:
      "Turn lecture decks into reusable lesson videos for asynchronous learning.",
    eyebrow: "Programmatic use case",
    heroTitle: "Use lecture decks as the foundation for reusable teaching videos",
    heroDescription:
      "Educators can turn slide-based lessons into reusable video assets that work outside the live classroom or workshop.",
    primaryKeyword: "educator pptx to video",
    keywordVariant: "lecture deck to video",
    recommendedTemplate: "whiteboard",
    proofPoints: [
      "Fits lesson recaps, flipped classroom material, and training libraries.",
      "Keeps existing curriculum assets useful across more formats.",
      "Reduces the need to manually re-record every lesson.",
    ],
    sections: [
      {
        title: "Best use case",
        body: [
          "This is strongest when the deck already holds the lesson structure and the next step is a more accessible delivery format.",
        ],
      },
    ],
    relatedPaths: ["/for-educators", "/pptx-to-video", "/templates/whiteboard"],
  },
  {
    path: "/for-newsletters/url-to-video",
    title: "URL To Video for Newsletter Operators",
    description:
      "Turn published newsletter archive URLs into videos that expand distribution beyond the inbox.",
    eyebrow: "Programmatic use case",
    heroTitle: "Use published newsletter archives as a repeatable video source",
    heroDescription:
      "Instead of leaving newsletters trapped on the site or inbox, turn those published URLs into reusable video content.",
    primaryKeyword: "newsletter url to video",
    keywordVariant: "newsletter archive to video",
    recommendedTemplate: "newspaper",
    proofPoints: [
      "Makes newsletter archives reusable and discoverable in new formats.",
      "Fits opinion, analysis, and update-heavy publishing habits.",
      "Supports a recurring editorial show format.",
    ],
    sections: [
      {
        title: "Best use case",
        body: [
          "When your newsletter archive is already public, URL-first video generation makes it easy to create recurring episodes or clips from each issue.",
        ],
      },
    ],
    relatedPaths: ["/for-newsletters", "/url-to-video", "/distribution-flywheel"],
  },
  {
    path: "/article-to-linkedin-video",
    title: "Article To LinkedIn Video Workflow",
    description:
      "Turn article-style thought leadership into polished LinkedIn explainers for professional distribution.",
    eyebrow: "Programmatic workflow",
    heroTitle: "Use long-form articles as the source for professional LinkedIn video",
    heroDescription:
      "Article-first teams can turn written thought leadership into distribution-ready video without rewriting the message from zero.",
    primaryKeyword: "article to LinkedIn video",
    keywordVariant: "thought leadership article to video",
    recommendedTemplate: "nightfall",
    proofPoints: [
      "Useful for B2B thought leadership and founder education.",
      "Extends article ideas into a faster-scrolling professional feed.",
      "Works well when the underlying writing is already strong.",
    ],
    sections: [
      {
        title: "Best use case",
        body: [
          "Use this workflow when the article already exists and the next job is to increase discovery among professional audiences.",
        ],
      },
    ],
    relatedPaths: ["/article-to-video", "/url-to-linkedin-video", "/for-medium-writers"],
  },
  {
    path: "/article-to-youtube-video",
    title: "Article To YouTube Video Workflow",
    description:
      "Turn long-form articles into YouTube explainers with structure, narration, and reusable scenes.",
    eyebrow: "Programmatic workflow",
    heroTitle: "Translate article depth into YouTube-ready explanation",
    heroDescription:
      "Article-driven teams can use the same underlying argument to rank on search and distribute on YouTube.",
    primaryKeyword: "article to YouTube video",
    keywordVariant: "essay to YouTube video",
    recommendedTemplate: "gridcraft",
    proofPoints: [
      "Useful for essays, analysis, and educational content.",
      "Pairs search-friendly writing with discovery-friendly video.",
      "Preserves depth without forcing manual video production.",
    ],
    sections: [
      {
        title: "Best use case",
        body: [
          "Use this when the article already has durable value and deserves a longer-form explainer rather than a short social cut.",
        ],
      },
    ],
    relatedPaths: ["/article-to-video", "/blog-to-youtube-video", "/templates/gridcraft"],
  },
  {
    path: "/blog-to-linkedin-video",
    title: "Blog To LinkedIn Video Workflow",
    description:
      "Turn blog posts into LinkedIn-ready explainers for founder distribution, product education, and B2B growth.",
    eyebrow: "Programmatic workflow",
    heroTitle: "Use blog posts to publish thoughtful LinkedIn video faster",
    heroDescription:
      "If the post already exists, LinkedIn video becomes a distribution step instead of a separate creative project.",
    primaryKeyword: "blog to LinkedIn video",
    keywordVariant: "turn blog into LinkedIn video",
    recommendedTemplate: "spotlight",
    proofPoints: [
      "Useful for founder-led content and product education.",
      "Extends written insight into a channel with different discovery mechanics.",
      "Works especially well for punchier benefit-first cuts.",
    ],
    sections: [
      {
        title: "Best use case",
        body: [
          "This is strongest when the original post has a clean takeaway that deserves a faster-paced professional distribution format.",
        ],
      },
    ],
    relatedPaths: ["/blog-to-video", "/article-to-linkedin-video", "/blog-to-shorts"],
  },
  {
    path: "/pdf-to-youtube-video",
    title: "PDF To YouTube Video Workflow",
    description:
      "Turn PDFs into YouTube explainers for educational, research, and knowledge-sharing use cases.",
    eyebrow: "Programmatic workflow",
    heroTitle: "Use PDFs as the source for evergreen YouTube explainers",
    heroDescription:
      "A strong PDF can become a longer-form educational video when the structure is preserved and the pacing is built around explanation.",
    primaryKeyword: "pdf to YouTube video",
    keywordVariant: "pdf explainer to YouTube",
    recommendedTemplate: "whiteboard",
    proofPoints: [
      "Useful for educational and research-led content.",
      "Turns static documents into more reusable video assets.",
      "Improves discoverability beyond downloads and email attachments.",
    ],
    sections: [
      {
        title: "Best use case",
        body: [
          "Choose this workflow when a PDF deserves more distribution and context than a static download can provide on its own.",
        ],
      },
    ],
    relatedPaths: ["/pdf-to-video", "/pdf-to-course-video", "/for-researchers"],
  },
  {
    path: "/docx-to-youtube-video",
    title: "DOCX To YouTube Video Workflow",
    description:
      "Turn DOCX guides and internal knowledge into public or customer-facing YouTube explainers.",
    eyebrow: "Programmatic workflow",
    heroTitle: "Turn document-first content into YouTube education",
    heroDescription:
      "When the knowledge already exists in DOCX form, YouTube can become another distribution channel instead of a brand-new workload.",
    primaryKeyword: "docx to YouTube video",
    keywordVariant: "doc to YouTube video",
    recommendedTemplate: "geometric-explainer",
    proofPoints: [
      "Useful for onboarding guides, playbooks, and customer education.",
      "Turns written operating knowledge into reusable public assets.",
      "Preserves step-by-step clarity well.",
    ],
    sections: [
      {
        title: "Best use case",
        body: [
          "Use this when the document already has a clear instructional sequence and the next job is broader distribution.",
        ],
      },
    ],
    relatedPaths: ["/docx-to-video", "/for-technical-writers", "/blog-to-youtube-video"],
  },
  {
    path: "/for-technical-bloggers/blog-to-shorts",
    title: "Blog To Shorts for Technical Bloggers",
    description:
      "Turn technical blog posts into vertical teaser clips that create discovery around deeper written content.",
    eyebrow: "Programmatic use case",
    heroTitle: "Create technical short-form clips from blog posts without losing the core idea",
    heroDescription:
      "Short clips work best when they tease one precise lesson or surprising result from a longer technical article.",
    primaryKeyword: "technical blog to shorts",
    keywordVariant: "technical article to short video",
    recommendedTemplate: "spotlight",
    proofPoints: [
      "Creates discovery around long-form technical posts.",
      "Lets technical creators stay active on short-form platforms without inventing separate ideas.",
      "Works best with clear hooks and one strong takeaway.",
    ],
    sections: [
      {
        title: "Best use case",
        body: [
          "Use this when a deeper article has a single sharp claim or lesson that deserves a teaser format.",
        ],
      },
    ],
    relatedPaths: ["/for-technical-bloggers", "/blog-to-shorts", "/code-snippet-to-video"],
  },
  {
    path: "/for-medium-writers/article-to-video",
    title: "Article To Video for Medium Writers",
    description:
      "Turn Medium-style essays into video assets that support brand awareness and owned-channel traffic.",
    eyebrow: "Programmatic use case",
    heroTitle: "Use essay-driven Medium writing as the source for stronger video distribution",
    heroDescription:
      "Thoughtful Medium writing often has a strong argument already. Video helps extend that argument to new audiences and channels.",
    primaryKeyword: "Medium article to video",
    keywordVariant: "essay to video for Medium writers",
    recommendedTemplate: "nightfall",
    proofPoints: [
      "Great for thought leadership, essays, and founder commentary.",
      "Extends Medium posts beyond the platform itself.",
      "Pairs nicely with canonical site content and narrative-style video.",
    ],
    sections: [
      {
        title: "Best use case",
        body: [
          "Use this when the article has a distinctive viewpoint and deserves more than one distribution surface.",
        ],
      },
    ],
    relatedPaths: ["/for-medium-writers", "/article-to-video", "/distribution-flywheel"],
  },
  {
    path: "/for-substack-writers/url-to-video",
    title: "URL To Video for Substack Writers",
    description:
      "Turn public Substack issue URLs into explainers and recurring editorial videos.",
    eyebrow: "Programmatic use case",
    heroTitle: "Use public Substack issue URLs as a video publishing source",
    heroDescription:
      "If the issue is already public, URL-first generation makes it easy to turn Substack essays into serialized video output.",
    primaryKeyword: "Substack URL to video",
    keywordVariant: "public Substack issue to video",
    recommendedTemplate: "newspaper",
    proofPoints: [
      "Fits recurring issue-based publishing habits.",
      "Makes each public issue reusable beyond the inbox and archive.",
      "Supports editorial-style video formats.",
    ],
    sections: [
      {
        title: "Best use case",
        body: [
          "Use this when your newsletter issues are already public on the web and you want a lighter-weight route into video.",
        ],
      },
    ],
    relatedPaths: ["/for-substack-writers", "/for-newsletters/url-to-video", "/distribution-flywheel"],
  },
  {
    path: "/convert-political-blog-to-video",
    title: "Convert Political Blog To Video",
    description:
      "Turn political blogs, commentary posts, and policy explainers into structured videos without rewriting the entire argument.",
    eyebrow: "Programmatic niche page",
    heroTitle: "Convert political blog posts into recurring video explainers",
    heroDescription:
      "Political writing already has the story arc, the claims, and the timeline. Blog2Video helps turn that structure into repeatable video output for YouTube, socials, and newsletter-led distribution.",
    primaryKeyword: "convert political blog to video",
    keywordVariant: "political blog to video",
    recommendedTemplate: "custom-branded-templates",
    recommendedTemplateReason:
      "Political publishers usually benefit most from a custom template because recurring commentary works best when every episode feels tied to the same editorial identity, segments, and publication style.",
    proofPoints: [
      "Strong fit for commentary, policy breakdowns, election coverage, and issue explainers.",
      "Works well when each post already has a clear argument, timeline, or fact pattern.",
      "Supports a serialized editorial format instead of one-off video production.",
    ],
    sections: [
      {
        title: "Why this niche fits blog-to-video especially well",
        body: [
          "Political blogs often already read like scripts in outline form: headline, context, evidence, quotes, and conclusion. That makes them unusually compatible with structured video generation.",
          "Instead of reinterpreting the same issue from scratch for every channel, you can use the article as the source and publish the same analysis in video form with much less manual effort.",
        ],
      },
    ],
    relatedPaths: ["/blog-to-video", "/for-newsletters/url-to-video", "/templates/newspaper"],
  },
  {
    path: "/convert-healthcare-blog-to-video",
    title: "Convert Healthcare Blog To Video",
    description:
      "Turn healthcare blog posts into clear explainer videos for patient education, clinician communication, and health-brand content.",
    eyebrow: "Programmatic niche page",
    heroTitle: "Convert healthcare blog posts into clear, trust-building videos",
    heroDescription:
      "Healthcare content already does the hard part by organizing complex information carefully. Blog2Video helps turn those posts into calm, structured videos that are easier to consume and share.",
    primaryKeyword: "convert healthcare blog to video",
    keywordVariant: "healthcare blog to video",
    recommendedTemplate: "custom-branded-templates",
    recommendedTemplateReason:
      "Healthcare brands usually need a custom template so the output feels trustworthy, readable, and aligned with the clinic, practice, or health brand identity across every patient-facing video.",
    proofPoints: [
      "Useful for patient education, treatment explainers, care-pathway walkthroughs, and practice marketing.",
      "Keeps structure and terminology intact instead of flattening everything into generic stock-footage scripts.",
      "Works best when clarity, credibility, and readability matter more than flashy visuals.",
    ],
    sections: [
      {
        title: "Why healthcare content benefits from structure-first video",
        body: [
          "Healthcare posts tend to be step-based, definition-heavy, and accuracy-sensitive. That structure translates well to explainer video when the platform preserves the original organization.",
          "This makes blog-to-video useful for clinics, healthcare brands, medical educators, and health publishers who want repeatable patient or audience education without creating every video manually.",
        ],
      },
    ],
    relatedPaths: ["/blog-to-video", "/templates/geometric-explainer", "/custom-branded-video-templates"],
  },
  {
    path: "/convert-finance-blog-to-video",
    title: "Convert Finance Blog To Video",
    description:
      "Turn finance blog posts into data-led videos for market commentary, investing education, and research communication.",
    eyebrow: "Programmatic niche page",
    heroTitle: "Convert finance blog posts into data-first explainer videos",
    heroDescription:
      "Finance content already relies on comparisons, metrics, and structured reasoning. Blog2Video helps convert that written analysis into videos without losing the logic that made the original piece useful.",
    primaryKeyword: "convert finance blog to video",
    keywordVariant: "finance blog to video",
    recommendedTemplate: "custom-branded-templates",
    recommendedTemplateReason:
      "Finance publishers benefit from custom templates because analyst-style videos often need a house look that matches research portals, firm branding, and repeat market-update formats.",
    proofPoints: [
      "Strong fit for market updates, earnings recaps, investing explainers, and research summaries.",
      "Handles structured arguments, metrics, and comparisons better than generic stock-media workflows.",
      "Useful for publishers who want recurring analyst-style or market-brief formats.",
    ],
    sections: [
      {
        title: "Why finance posts convert cleanly into video",
        body: [
          "Finance blogs often already contain the exact ingredients a good explainer needs: thesis, evidence, comparisons, and key numbers. That makes them a natural fit for template-driven video generation.",
          "Instead of building charts and callouts from zero in a traditional editor, you can use the article as the content source and turn each new post into a repeatable market or investing video format.",
        ],
      },
    ],
    relatedPaths: ["/blog-to-video", "/templates/gridcraft", "/custom-branded-video-templates"],
  },
  {
    path: "/convert-engineering-blog-to-video",
    title: "Convert Engineering Blog To Video",
    description:
      "Turn engineering blog posts into technical videos that preserve architecture, tradeoffs, and implementation detail.",
    eyebrow: "Programmatic niche page",
    heroTitle: "Convert engineering blog posts into technical explainer videos",
    heroDescription:
      "Engineering posts already carry the insights. Blog2Video helps transform architecture writeups, system design breakdowns, and postmortems into videos without stripping out the substance.",
    primaryKeyword: "convert engineering blog to video",
    keywordVariant: "engineering blog to video",
    recommendedTemplate: "custom-branded-templates",
    recommendedTemplateReason:
      "Engineering teams often get the most value from a custom template because it lets architecture explainers and postmortems feel consistent with the company's own technical brand and product identity.",
    proofPoints: [
      "Strong fit for architecture explainers, performance writeups, infra postmortems, and product engineering updates.",
      "Preserves structure better than generic AI video tools that flatten technical detail.",
      "Gives engineering content a polished visual system without needing stock footage.",
    ],
    sections: [
      {
        title: "Why engineering writing compounds well in video form",
        body: [
          "Engineering teams already invest heavily in writing up what changed, why it mattered, and how the system works. Turning that writing into video helps the same ideas travel further across YouTube, social, and internal education.",
          "This is especially useful when the post already has a clear sequence of problem, design choice, implementation, and result that can map naturally to scenes.",
        ],
      },
    ],
    relatedPaths: ["/for-technical-bloggers", "/blog-to-video", "/templates/nightfall"],
  },
  {
    path: "/convert-coding-blog-to-video",
    title: "Convert Coding Blog To Video",
    description:
      "Turn coding blog posts into code-friendly explainer videos for developer education, tutorials, and tool walkthroughs.",
    eyebrow: "Programmatic niche page",
    heroTitle: "Convert coding blog posts into code-first video explainers",
    heroDescription:
      "If the blog post already teaches something useful, Blog2Video can turn that lesson into a video without forcing you to start over with a camera, editor, or brand-new script.",
    primaryKeyword: "convert coding blog to video",
    keywordVariant: "coding blog to video",
    recommendedTemplate: "custom-branded-templates",
    recommendedTemplateReason:
      "Coding publishers benefit from custom templates when they want tutorials, walkthroughs, and tool explainers to feel like a recognizable series rather than disconnected one-off videos.",
    proofPoints: [
      "Ideal for code walkthroughs, CLI tutorials, framework guides, and dev-tool explainers.",
      "Fits posts where code, commands, and technical terminology are central to the lesson.",
      "Lets developer educators reuse written tutorials across multiple channels.",
    ],
    sections: [
      {
        title: "Why coding posts are strong source material",
        body: [
          "Coding blogs usually already have a lesson structure: setup, code example, explanation, and result. That shape makes them easier to convert into coherent video scenes than generic marketing posts.",
          "For dev-focused creators, this means one tutorial can become a blog post, a YouTube explainer, and short clips without inventing a separate content idea for every channel.",
        ],
      },
    ],
    relatedPaths: ["/for-technical-bloggers", "/code-snippet-to-video", "/templates/matrix"],
  },
  {
    path: "/convert-tutorial-blog-to-video",
    title: "Convert Tutorial Blog To Video",
    description:
      "Turn tutorial-style blog posts into step-by-step videos for education, onboarding, and product adoption.",
    eyebrow: "Programmatic niche page",
    heroTitle: "Convert tutorial blog posts into step-by-step videos",
    heroDescription:
      "Tutorials already have sequencing built in. Blog2Video helps transform that sequence into narrated video so every how-to post can also become a reusable teaching asset.",
    primaryKeyword: "convert tutorial blog to video",
    keywordVariant: "tutorial blog to video",
    recommendedTemplate: "custom-branded-templates",
    recommendedTemplateReason:
      "Tutorial-heavy publishers usually benefit from a custom template because it turns many how-to posts into one consistent teaching format that viewers learn to recognize over time.",
    proofPoints: [
      "Strong fit for how-to content, product walkthroughs, onboarding guides, and educational lessons.",
      "Works especially well when the article is already broken into steps or milestones.",
      "Helps tutorial-heavy sites build a repeatable video library over time.",
    ],
    sections: [
      {
        title: "Why tutorial content is naturally reusable in video",
        body: [
          "Tutorial posts are already designed to guide someone from one step to the next. That structure is exactly what makes them good video inputs.",
          "Instead of writing one tutorial for the blog and then recreating the same explanation in a separate workflow, you can let the article become the source for a second format that compounds over time.",
        ],
      },
    ],
    relatedPaths: ["/blog-to-video", "/templates/whiteboard", "/how-to-turn-a-blog-post-into-a-video"],
  },
];

export const programmaticPages: MarketingPage[] = seeds.map((seed) =>
  createPage({
    ...seed,
    category: "programmatic",
    recommendedTemplateReason:
      seed.recommendedTemplateReason ??
      templateBySlug[seed.recommendedTemplate].differentiator,
    faq: createFaq(
      seed.primaryKeyword,
      "Teams using an existing source asset as the starting point",
      "Blog2Video is strongest when the original content already contains structure, examples, and a clear narrative that can be preserved in video."
    ),
  })
);
