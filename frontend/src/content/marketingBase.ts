import type { FaqItem, MarketingPage, PageCta, TemplateProfile } from "./seoTypes";

export const defaultCta: PageCta = {
  title: "Turn your existing content into a video this week",
  body:
    "Paste a URL, upload a document, or use an existing newsletter archive and convert it into a polished video without starting from a blank timeline.",
  primaryLabel: "Start with 2 free videos",
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
    name: "Stick Man",
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
      "ending_socials",
    ],
    longDescription:
      "Newscast is a broadcast-style template built for content that should feel like it belongs on a news desk. Deep navy fields, crimson accents, steel type, optional full-bleed plates, and persistent ticker and lower-third chrome frame every scene. Layouts range from Newscast Opening and Anchor Narrative to Live Metrics Board, Briefing Code Panel, Headline Insight, Side-by-Side Brief, Segment Break, and Field Image Focus — so briefings, roundups, and analysis read as authoritative on-air segments rather than slideshows.",
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
  {
    slug: "blackswan",
    name: "BlackSwan",
    description:
      "A dark, cinematic template with fluid motion, neon-lit water effects, and dramatic storytelling energy.",
    bestFor: "Cinematic narratives, brand films, high-stakes stories, and visually immersive content.",
    differentiator:
      "Delivers a full cinematic feel — fluid animations, neon water effects, and arc-driven layouts — without needing a film crew.",
    styleFit: "Best for cinematic storytelling and content that demands visual drama.",
    previewSceneKey: "preview-blackswan",
    layouts: [
      "droplet_intro",
      "neon_narrative",
      "arc_features",
      "flight_path",
      "dive_insight",
      "signal_split",
      "pulse_metric",
      "reactor_code",
      "ending_socials",
    ],
    longDescription:
      "BlackSwan is a cinematic dark template built for content that needs to feel visually immersive and emotionally resonant. Fluid neon-water animations, glowing arc shapes, and bird-in-flight motion create a sense of scale and drama that most AI video templates can't match. Layouts like Droplet Intro, Neon Narrative, Flight Path, and Dive Insight are designed for storytelling-first content — brand films, long-form explainers, and high-stakes narratives where the visual intensity matches the weight of the message.",
    idealFor: [
      "Brand films and company story videos",
      "High-stakes product or technology narratives",
      "Cinematic explainers and long-form storytelling",
      "Event recaps and keynote highlight reels",
      "Founder manifestos and vision statements",
    ],
    exampleTopics: [
      "Why we built this company from nothing",
      "The technology that changes everything",
      "A cinematic look at five years of product evolution",
    ],
  },
  {
    slug: "mosaic",
    name: "Mosaic",
    description:
      "A bold, art-forward template that fragments visuals into tiled compositions with expressive typography.",
    bestFor: "Creative content, art direction, culture writing, design showcases, and editorial pieces.",
    differentiator:
      "Turns written content into an art-directed visual experience — fragmented image tiles, kinetic text, and expressive color work together to feel designed rather than generated.",
    styleFit: "Best for art, design, culture, and creatively-led content.",
    previewSceneKey: "preview-mosaic",
    layouts: [
      "mosaic_title",
      "mosaic_text",
      "mosaic_phrases",
      "mosaic_stream",
      "mosaic_punch",
      "mosaic_metric",
      "mosaic_close",
      "ending_socials",
    ],
    longDescription:
      "Mosaic is an art-forward template that fragments images into tiled compositions and pairs them with expressive kinetic typography. The template is built for content where visual identity matters as much as the message — design showcases, culture writing, editorial art direction, and creative campaigns. Layouts like Mosaic Phrases, Mosaic Stream, and Mosaic Punch prioritize rhythm and visual flow, making the final video feel like a designed artifact rather than an auto-generated slide deck.",
    idealFor: [
      "Art and design showcases",
      "Culture, fashion, and lifestyle editorial content",
      "Creative agency and portfolio pieces",
      "Music, film, and entertainment content",
      "Brand identity and campaign storytelling",
    ],
    exampleTopics: [
      "The design principles behind our rebrand",
      "How street culture shapes modern product aesthetics",
      "Five artists redefining visual storytelling in 2025",
    ],
  },
  {
    slug: "bloomberg",
    name: "Bloomberg",
    description:
      "A terminal-style financial template with live-data aesthetics, ticker chrome, and market-desk authority.",
    bestFor: "Finance content, market analysis, economic explainers, and data-driven business reporting.",
    differentiator:
      "Gives financial and data-heavy content the visual authority of a professional trading terminal — ticker feeds, dashboard panels, and chart overlays without the custom build cost.",
    styleFit: "Best for finance, economics, business data, and market reporting.",
    previewSceneKey: "preview-bloomberg",
    layouts: [
      "terminal_boot",
      "terminal_narrative",
      "terminal_metric",
      "terminal_chart",
      "terminal_dashboard",
      "terminal_list",
      "terminal_split",
      "terminal_table",
      "terminal_ticker",
      "terminal_data_viz",
      "terminal_profile",
      "terminal_options",
      "ending_socials",
    ],
    longDescription:
      "Bloomberg is a terminal-style template that brings the visual language of professional financial media to video content. Dark backgrounds, amber-on-black monospace data panels, live-market ticker chrome, and chart overlays create an aesthetic that immediately signals credibility to finance audiences. Layouts cover the full range of financial storytelling — from Terminal Boot and Narrative panels to Metric dashboards, Chart overlays, Split comparisons, Table data views, and Ticker feeds — so market analysis, economic explainers, and data-heavy business reporting all render with appropriate authority.",
    idealFor: [
      "Market analysis and financial commentary",
      "Economic explainers and macro trend breakdowns",
      "Earnings reports and company performance recaps",
      "Investment thesis and portfolio strategy content",
      "Fintech product and API explainers",
    ],
    exampleTopics: [
      "Q3 earnings breakdown: what the numbers actually mean",
      "Why the yield curve inversion matters for your portfolio",
      "How central bank policy shapes startup valuations",
    ],
  },
  {
    slug: "chronicle",
    name: "Chronicle",
    description:
      "A richly textured historical template with parchment, wax seals, illuminated drop caps, and archival gravitas.",
    bestFor: "History content, long-form narrative journalism, biographical storytelling, and archival research.",
    differentiator:
      "Wraps written history and narrative journalism in a visual system that feels genuinely archival — illuminated manuscripts, embossed imagery, book-page transitions, and quill-ink motion give the content earned gravitas.",
    styleFit: "Best for history, biography, long-form narrative, and archival storytelling.",
    previewSceneKey: "preview-chronicle",
    layouts: [
      "book_open",
      "parchment_scroll",
      "chapter_plate",
      "chronicle_timeline",
      "illuminated_quote",
      "ledger_stats",
      "map_reveal",
      "decree_seal",
      "versus_folio",
      "ending_socials",
    ],
    longDescription:
      "Chronicle is a historically-styled template that draws from illuminated manuscripts, archival documents, and antique cartography to create a visual language appropriate for serious historical and biographical content. Parchment textures, wax seal transitions, embossed imagery, ornamental borders, and quill-ink animations give the template a sense of earned authority. Layouts like Book Open, Chronicle Timeline, Map Reveal, and Decree Seal are purpose-built for narrative history, long-form journalism, and biographical storytelling where the visual weight should match the depth of the content.",
    idealFor: [
      "Historical analysis and documentary-style content",
      "Biographical profiles and life-story narratives",
      "Long-form narrative journalism",
      "Academic and archival research explainers",
      "Heritage, culture, and tradition storytelling",
    ],
    exampleTopics: [
      "The rise and fall of the Roman grain trade",
      "Ada Lovelace: the first programmer the world forgot",
      "How the Silk Road shaped the modern global economy",
    ],
  },
  {
    slug: "economist",
    name: "The Economist",
    description:
      "A precise editorial template in the style of a printed weekly — red masthead, serif headlines, ruled charts, and data tables.",
    bestFor: "Business and finance analysis, economic explainers, data-driven journalism, and policy briefings.",
    differentiator:
      "Renders your content as a genuine print-weekly spread — house-red accents, column layouts, and signature ruled charts — giving analytical writing instant editorial authority.",
    styleFit: "Best for serious, data-forward analysis and editorial journalism.",
    previewSceneKey: "preview-economist",
    layouts: [
      "cover_reveal",
      "leader_article",
      "section_divider",
      "chart_line",
      "chart_bar",
      "data_table",
      "pros_cons",
      "key_indicators",
      "leader_quote",
      "image_feature",
      "ending_socials",
    ],
    longDescription:
      "The Economist template renders written analysis as a printed weekly newspaper, complete with a red masthead, serif headlines, multi-column body copy, and the publication's signature ruled charts. Layouts like Cover Reveal, Leader Article, Chart Line, Chart Bar, Data Table, Pros & Cons, and Key Indicators are purpose-built for business, finance, and economic content where precision and editorial authority matter. The result reads like a feature in a serious newspaper rather than a generic AI video — ideal for turning analytical writing and data-heavy reporting into video.",
    idealFor: [
      "Business and finance analysis",
      "Economic and policy explainers",
      "Data-driven journalism and reporting",
      "Market and industry briefings",
      "Editorial commentary and opinion pieces",
    ],
    exampleTopics: [
      "Why central banks are split on cutting rates",
      "The numbers behind the global trade slowdown",
      "What the latest jobs report really tells us",
    ],
  },
  {
    slug: "stickman_football",
    name: "Stickmen Football Match",
    description:
      "A playful hand-drawn football template with animated stickman players, a match-day pitch, and chalkboard-style charts and tickers.",
    bestFor: "Sports recaps, match analysis, fan content, and any energetic, lighthearted explainer.",
    differentiator:
      "Brings your content to life with animated stickman footballers dribbling, passing, and scoring — a hand-drawn match-day world that no stock-footage tool can replicate.",
    styleFit: "Best for sports storytelling, playful explainers, and content that should feel fun and kinetic.",
    previewSceneKey: "preview-stickman-football",
    layouts: [
      "kickoff_title",
      "passing_play",
      "ball_control",
      "freekick_setup",
      "goal_moment",
      "injury_break",
      "match_stats",
      "football_data_viz",
      "football_ticker",
      "text_narration",
      "ending_socials",
    ],
    longDescription:
      "Stickman Football turns written content into an animated match-day broadcast played out by hand-drawn stickman footballers. Players run on, trap long balls, dribble, set up free kicks, and celebrate goals across a green pitch, while chalkboard-style data visualizations, match-stat cards, and league tickers carry the numbers. Layouts like Kickoff Title, Passing Play, Goal Moment, Match Stats, and Football Data Viz make sports recaps, tactical breakdowns, and fan explainers feel energetic and alive without any footage, presenters, or production crew.",
    idealFor: [
      "Match recaps and weekend round-ups",
      "Tactical breakdowns and player analysis",
      "Sports newsletters and fan-channel content",
      "League standings and stat-driven updates",
      "Playful explainers that need a fun, kinetic tone",
    ],
    exampleTopics: [
      "Five takeaways from the weekend's biggest match",
      "How the underdogs pulled off the upset",
      "The numbers behind this season's title race",
    ],
  },
  {
    slug: "stickman_2",
    name: "Stickmen 2: Night Edition",
    description:
      "A moody hand-drawn chalk template with glowing stickman characters telling stories under a starlit night sky.",
    bestFor: "Reflective storytelling, late-night explainers, creative narratives, and atmospheric content.",
    differentiator:
      "Sets your story against a glowing chalk-on-black night world — stickman characters, shooting stars, lanterns, and constellations — for an intimate, cinematic feel built entirely from hand-drawn animation.",
    styleFit: "Best for narrative, reflective, and atmospheric content that benefits from a calm, cinematic mood.",
    previewSceneKey: "preview-stickman-2",
    layouts: [
      "chalk_title",
      "night_walk",
      "shooting_star",
      "lantern_dialogue",
      "constellation_stats",
      "moonphase_chart",
      "shadow_comparison",
      "signal_fire_scene",
      "neon_countdown",
      "data_visualisation",
      "ticker_table",
      "ending_socials",
    ],
    longDescription:
      "Stickman 2 is a hand-drawn chalk template that stages your content as glowing white line-art on a deep night sky. Stickman characters walk beneath the stars, watch shooting stars streak overhead, trade lantern-lit dialogue, and gather around signal fires, while constellation stat boards, moon-phase charts, and chalk data visualizations carry the information. Layouts like Chalk Title, Night Walk, Lantern Dialogue, Shadow Comparison, and Neon Countdown give reflective stories, creative narratives, and atmospheric explainers an intimate, cinematic feel without any footage or production setup.",
    idealFor: [
      "Reflective and narrative-driven storytelling",
      "Late-night or atmospheric explainers",
      "Creative and personal-brand content",
      "Calm, mood-first educational pieces",
      "Stories that benefit from a cinematic, hand-drawn aesthetic",
    ],
    exampleTopics: [
      "A quiet reflection on why we build at night",
      "The story behind a single big idea",
      "Lessons learned, told under the stars",
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
