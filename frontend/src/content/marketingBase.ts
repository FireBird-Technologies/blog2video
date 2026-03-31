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
    previewSceneKey: "preview-default",
    layouts: ["hero_image", "text_narration", "code_block", "bullet_list", "flow_diagram", "comparison", "metric", "quote_callout", "image_caption", "timeline", "data_visualization"],
    longDescription: "The Geometric Explainer template uses clean lines, structured grids, and deliberate hierarchy to present tutorials, walkthroughs, and technical lessons. Every layout prioritizes readability over decoration, making it ideal for content where comprehension matters more than visual flair. The template handles code blocks, bullet lists, flow diagrams, comparisons, and metrics natively, so technical articles convert into video without losing their structure.",
    idealFor: ["Technical tutorials and how-to guides", "Product onboarding walkthroughs", "Step-by-step educational breakdowns", "API and SDK documentation explainers", "Process and workflow demonstrations"],
    exampleTopics: ["How to set up a CI/CD pipeline", "Getting started with a new API", "Product feature walkthrough for onboarding"],
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
    previewSceneKey: "preview-nightfall",
    layouts: ["cinematic_title", "glass_narrative", "glow_metric", "glass_code", "kinetic_insight", "glass_stack", "split_glass", "chapter_break", "glass_image", "data_visualization"],
    longDescription: "Nightfall is a premium dark cinematic template built for content that needs to feel polished and authoritative. The glass-morphism cards, indigo accent glow, and contrast-heavy typography create a visual identity that elevates technical deep dives, founder stories, and product launches. Each layout — from cinematic titles to glass code blocks to kinetic insight quotes — is designed to make the content feel expensive without relying on stock footage or generic imagery.",
    idealFor: ["Technical deep dives and engineering blogs", "Product launches and announcements", "Founder stories and thought leadership", "SaaS feature explainers", "Code walkthroughs and developer tutorials"],
    exampleTopics: ["Why we rebuilt our data pipeline from scratch", "Launching v2: what changed and why", "How our API handles 10M requests per second"],
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
    previewSceneKey: "preview-gridcraft",
    layouts: ["bento_hero", "bento_features", "bento_highlight", "editorial_body", "kpi_grid", "bento_compare", "bento_code", "pull_quote", "bento_steps"],
    longDescription: "Gridcraft uses warm editorial bento grids to present structured narratives, comparisons, and data-rich content with magazine-quality layouts. The template excels when the source article already contains lists, metrics, step-by-step processes, or product comparisons. Each layout — from bento feature grids to editorial body text to KPI dashboards — gives analytical and marketing content a structured, professional feel that avoids the generic look of most AI video tools.",
    idealFor: ["Comparison posts and tool evaluations", "Data-driven marketing content", "Step-by-step workflow guides", "Product feature breakdowns", "Benchmark and performance analysis"],
    exampleTopics: ["Blog2Video vs Lumen5 vs Pictory: detailed comparison", "Q4 performance dashboard walkthrough", "5 steps to automate your content pipeline"],
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
    previewSceneKey: "preview-spotlight",
    layouts: ["impact_title", "statement", "word_punch", "cascade_list", "stat_stage", "versus", "spotlight_image", "rapid_points", "closer"],
    longDescription: "Spotlight is a bold, high-energy template built around kinetic typography and dramatic pacing. It puts the headline, the claim, and the key number at center stage with rapid-fire transitions that hold viewer attention. The template is designed for YouTube-first content, promotional clips, and short-form hooks where every second needs to earn the next one. Layouts like impact titles, word punch, versus comparisons, and rapid points keep the energy high across the entire video.",
    idealFor: ["YouTube explainers and promotional videos", "Short-form hooks for Shorts and Reels", "Product benefit and feature announcements", "Keynote-style thought leadership clips", "Social media teasers and highlight clips"],
    exampleTopics: ["Why this tool saves 10 hours per week", "Blog2Video: the 60-second pitch", "3 reasons writers should start making video"],
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
    previewSceneKey: "preview-whiteboard",
    layouts: ["drawn_title", "marker_story", "stick_figure_scene", "stats_figures", "stats_chart", "comparison", "countdown_timer", "handwritten_equation", "speech_bubble_dialogue"],
    longDescription: "Whiteboard is a classroom-friendly template that uses hand-drawn visuals, calm pacing, and warm paper-textured backgrounds to present educational content. The layouts mimic a real whiteboard session: marker-style narratives, stick figure scenes, hand-drawn charts, and speech bubble dialogues. This template works best when the goal is comprehension over flash. Students, learners, and onboarding audiences respond to the approachable, informal tone that keeps attention on the lesson rather than the production.",
    idealFor: ["Course content and lesson plans", "Onboarding and training videos", "Process walkthroughs and how-to guides", "Research explanations for general audiences", "Diagram and architecture walkthroughs"],
    exampleTopics: ["How photosynthesis works: a visual guide", "Employee onboarding: company tools walkthrough", "Understanding microservices architecture"],
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
    previewSceneKey: "preview-newspaper",
    layouts: ["news_headline", "article_lead", "pull_quote", "data_snapshot", "fact_check", "news_timeline"],
    longDescription: "Newspaper is an editorial template that brings classic newsprint aesthetics to video. Serif headlines, drop-cap lead paragraphs, vintage paper textures, and 3D camera movements create a format that feels like a published article come to life. The template includes layouts for breaking headlines, fact-check comparisons, data snapshots with animated cards, and timelines — making it ideal for newsletters, weekly updates, and commentary that benefits from the authority and familiarity of a news format.",
    idealFor: ["Newsletter issue recaps and highlights", "Industry news and commentary videos", "Weekly or monthly update series", "Fact-check and analysis content", "Current events and trend breakdowns"],
    exampleTopics: ["This week in AI: the 5 stories that matter", "Fact check: will AI replace content writers?", "Substack digest: turning your best issues into video"],
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
    previewSceneKey: "preview-matrix",
    layouts: ["matrix_title", "terminal_text", "glitch_punch", "data_stream", "cipher_metric", "fork_choice", "matrix_image", "transmission", "awakening"],
    longDescription: "Matrix is a cyberpunk terminal template designed for developer audiences and technically-minded viewers. Green-on-black monospace typography, typewriter text animations, glitch effects, and data stream layouts create a visual identity that feels native to engineering culture. The template includes layouts for terminal-style typewritten text, incoming data streams, red-pill/blue-pill fork choices, cipher-decoded metrics, and intercepted-signal transmissions. Every layout keeps content readable while leaning into a sharper, more experimental aesthetic.",
    idealFor: ["Developer tutorials and code walkthroughs", "AI and machine learning explainers", "Cybersecurity content and demos", "CLI tool and developer tooling launches", "Technical comparison and evaluation content"],
    exampleTopics: ["Building a CLI tool in Rust: from zero to publish", "How our ML pipeline processes 1M predictions per day", "Red team vs blue team: a cybersecurity primer"],
  },
  {
    slug: "newscast",
    name: "Newscast",
    description:
      "A broadcast news package with desk-style glass panels, ticker, lower third, and crimson-navy visuals.",
    bestFor: "Briefings, updates, explainers, and stories that should feel like television news — not print.",
    differentiator:
      "Puts your article into a live-broadcast frame: globe, chrome, and on-air typography without stock b-roll.",
    styleFit: "Best for summaries, fact-first updates, and editorial storytelling with a TV desk rhythm.",
    previewSceneKey: "preview-newscast",
    layouts: [
      "opening",
      "anchor_narrative",
      "live_metrics_board",
      "briefing_code_panel",
      "headline_insight",
      "story_stack",
      "side_by_side_brief",
      "segment_break",
      "field_image_focus",
      "data_visualization",
      "ending_socials",
    ],
    longDescription:
      "Newscast is a broadcast-style template built for content that should feel like it belongs on a news desk. Deep navy fields, crimson accents, steel type, optional full-bleed plates, and persistent ticker and lower-third chrome frame every scene. Layouts range from Newscast Opening and Anchor Narrative to Live Metrics Board, Briefing Code Panel, Headline Insight, Side-by-Side Brief, Segment Break, Field Image Focus, and data visualization — so briefings, roundups, and analysis read as authoritative on-air segments rather than slideshows.",
    idealFor: [
      "Weekly briefings and industry roundups",
      "Policy and regulatory explainers",
      "Crisis or fast-moving story updates",
      "Data-backed segments with charts and metrics",
      "Editorial voiceovers that need a serious broadcast tone",
    ],
    exampleTopics: [
      "Markets close higher after central bank signals",
      "Five takeaways from the climate summit",
      "What the new rules mean for your sector",
    ],
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
