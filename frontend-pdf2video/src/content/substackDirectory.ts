import type {
  DirectoryPricingModel,
  FaqItem,
  SubstackNiche,
  SubstackPublication,
} from "./seoTypes";

export const pricingLabels: Record<DirectoryPricingModel, string> = {
  free: "Free",
  paid: "Paid",
  freemium: "Freemium",
};

export const substackPublications: SubstackPublication[] = [
  {
    slug: "lennys-newsletter",
    name: "Lenny's Newsletter",
    tagline: "Product, growth, and career notes for startup operators.",
    description:
      "A startup-operator publication often used as a reference point for product management, growth loops, and tactical execution.",
    audience: "Product leaders, startup teams, and ambitious operators.",
    pricingModel: "freemium",
    cadence: "Weekly",
    tone: "Tactical and operator-led",
    bestFor: ["Product strategy", "Growth experiments", "PM career development"],
    topics: ["product", "startups", "growth", "careers"],
    differentiator: "Interview-heavy operating advice translated into practical playbooks.",
  },
  {
    slug: "the-pragmatic-engineer",
    name: "The Pragmatic Engineer",
    tagline: "Engineering leadership and software-industry analysis.",
    description:
      "A widely referenced software-industry publication focused on engineering systems, org design, and technical career leverage.",
    audience: "Senior engineers, managers, and technical leaders.",
    pricingModel: "freemium",
    cadence: "Weekly",
    tone: "Analytical and technical",
    bestFor: ["Engineering leadership", "Developer careers", "Technical org design"],
    topics: ["engineering", "software", "careers", "leadership"],
    differentiator: "Pairs industry analysis with operator-level engineering detail.",
  },
  {
    slug: "stratechery",
    name: "Stratechery",
    tagline: "Deep strategy analysis for technology and media businesses.",
    description:
      "A strategy-focused publication centered on business models, platforms, and the long-term logic behind technology markets.",
    audience: "Executives, strategists, operators, and analysts.",
    pricingModel: "paid",
    cadence: "Multiple times weekly",
    tone: "Strategic and essay-driven",
    bestFor: ["Tech strategy", "Platform analysis", "Media economics"],
    topics: ["strategy", "technology", "media", "economics"],
    differentiator: "Turns platform and market shifts into coherent strategic frameworks.",
  },
  {
    slug: "not-boring",
    name: "Not Boring",
    tagline: "Optimistic business essays on startups, tech, and markets.",
    description:
      "A narrative-driven business publication that blends technology, investing, and startup storytelling with a high-energy voice.",
    audience: "Founders, startup followers, and investing-curious readers.",
    pricingModel: "freemium",
    cadence: "Weekly",
    tone: "Energetic and narrative",
    bestFor: ["Startup trends", "Market storytelling", "Tech investing"],
    topics: ["startups", "investing", "technology", "creator-economy"],
    differentiator: "Strong point of view with an accessible, story-led style.",
  },
  {
    slug: "the-generalist",
    name: "The Generalist",
    tagline: "Long-form profiles and business explainers across technology.",
    description:
      "A research-heavy publication known for founder, company, and market deep dives that help readers build broader business literacy.",
    audience: "Generalist investors, operators, and curious founders.",
    pricingModel: "freemium",
    cadence: "Weekly",
    tone: "Research-led and expansive",
    bestFor: ["Company deep dives", "Market analysis", "Founder context"],
    topics: ["startups", "venture-capital", "technology", "economics"],
    differentiator: "Makes dense company and market stories readable for broad business audiences.",
  },
  {
    slug: "every",
    name: "Every",
    tagline: "Business, creativity, and modern work across multiple desks.",
    description:
      "A multi-voice publication that blends business ideas, internet work, AI experimentation, and reflective essays on building.",
    audience: "Knowledge workers, creators, and modern operators.",
    pricingModel: "freemium",
    cadence: "Multiple times weekly",
    tone: "Editorial and reflective",
    bestFor: ["AI workflows", "Modern work", "Productivity writing"],
    topics: ["ai", "productivity", "work", "writing"],
    differentiator: "Feels like a small publication rather than a single-voice newsletter.",
  },
  {
    slug: "dense-discovery",
    name: "Dense Discovery",
    tagline: "Curated ideas, products, culture, and internet signals.",
    description:
      "A curation-forward publication for readers who want smart links, tools, cultural references, and thoughtful recommendations.",
    audience: "Curious generalists, designers, and internet-savvy readers.",
    pricingModel: "free",
    cadence: "Weekly",
    tone: "Curated and tasteful",
    bestFor: ["Curation", "Design taste", "Cultural discovery"],
    topics: ["design", "media", "productivity", "culture"],
    differentiator: "High-signal curation with consistent editorial taste.",
  },
  {
    slug: "platformer",
    name: "Platformer",
    tagline: "Independent reporting on social platforms and the internet.",
    description:
      "A reporting-driven publication centered on online platforms, moderation, policy, and the politics of internet power.",
    audience: "Media watchers, policy readers, and tech observers.",
    pricingModel: "freemium",
    cadence: "Weekly",
    tone: "Reported and current",
    bestFor: ["Platform news", "Internet policy", "Media coverage"],
    topics: ["media", "politics", "technology", "policy"],
    differentiator: "Strong beat reporting around online platforms and governance.",
  },
  {
    slug: "sinocism",
    name: "Sinocism",
    tagline: "China analysis for policy, markets, and geopolitics readers.",
    description:
      "A specialist publication used by readers who need close tracking of China policy, politics, and business context.",
    audience: "Policy professionals, analysts, and geopolitics readers.",
    pricingModel: "paid",
    cadence: "Multiple times weekly",
    tone: "Specialist and analytical",
    bestFor: ["China policy", "Geopolitics", "Macro context"],
    topics: ["politics", "policy", "economics", "global-affairs"],
    differentiator: "High-trust coverage for a narrow but serious readership.",
  },
  {
    slug: "big-technology",
    name: "Big Technology",
    tagline: "Tech power, AI, and platform accountability.",
    description:
      "A tech-analysis publication focused on the behavior and impact of large technology platforms, especially during AI shifts.",
    audience: "Tech policy readers, founders, and industry observers.",
    pricingModel: "freemium",
    cadence: "Weekly",
    tone: "Critical and topical",
    bestFor: ["AI industry coverage", "Big tech analysis", "Platform scrutiny"],
    topics: ["ai", "technology", "policy", "media"],
    differentiator: "Blends reporting, interviews, and opinion around big-tech behavior.",
  },
  {
    slug: "garbage-day",
    name: "Garbage Day",
    tagline: "Internet culture, media weirdness, and online behavior.",
    description:
      "A sharp, voicey publication on internet culture, memes, and the feedback loops shaping online discourse.",
    audience: "Media people, online-native readers, and culture watchers.",
    pricingModel: "freemium",
    cadence: "Weekly",
    tone: "Voicey and internet-native",
    bestFor: ["Internet culture", "Media commentary", "Trend observation"],
    topics: ["culture", "media", "entertainment", "technology"],
    differentiator: "Strong personality paired with sharp internet pattern recognition.",
  },
  {
    slug: "creator-science",
    name: "Creator Science",
    tagline: "Systems and growth thinking for independent creators.",
    description:
      "A creator-business publication focused on audience building, offer design, and operating a durable independent media business.",
    audience: "Creators, educators, and independent media builders.",
    pricingModel: "freemium",
    cadence: "Weekly",
    tone: "Instructional and generous",
    bestFor: ["Audience growth", "Creator monetization", "Newsletter systems"],
    topics: ["creator-economy", "marketing", "writing", "business"],
    differentiator: "Turns creator-business tactics into repeatable frameworks.",
  },
  {
    slug: "future-commerce",
    name: "Future Commerce",
    tagline: "Retail, commerce, and brand strategy for modern operators.",
    description:
      "A commerce-focused publication covering e-commerce, retail strategy, and how brands build attention and demand.",
    audience: "Brand builders, marketers, and commerce operators.",
    pricingModel: "freemium",
    cadence: "Weekly",
    tone: "Strategic and brand-aware",
    bestFor: ["E-commerce strategy", "Retail trends", "Brand positioning"],
    topics: ["e-commerce", "retail", "marketing", "brands"],
    differentiator: "Connects commerce performance with brand and market positioning.",
  },
  {
    slug: "one-useful-thing",
    name: "One Useful Thing",
    tagline: "Practical AI thinking for knowledge work and education.",
    description:
      "A pragmatic AI publication focused on concrete workflows, education, and how people actually use AI in serious work.",
    audience: "Educators, knowledge workers, and AI-curious teams.",
    pricingModel: "free",
    cadence: "Weekly",
    tone: "Practical and explanatory",
    bestFor: ["AI workflows", "Education", "Knowledge work"],
    topics: ["ai", "education", "productivity", "work"],
    differentiator: "Grounds AI discussion in practical application and thoughtful caution.",
  },
  {
    slug: "letters-from-an-american",
    name: "Letters from an American",
    tagline: "US politics and history explained through current events.",
    description:
      "A broad-reach political publication that contextualizes current events with historical framing and civic explanation.",
    audience: "General readers who want political context rather than hot takes.",
    pricingModel: "free",
    cadence: "Daily",
    tone: "Contextual and civic",
    bestFor: ["US politics", "History context", "Civic understanding"],
    topics: ["politics", "history", "policy", "culture"],
    differentiator: "Large mainstream audience built through accessible political context.",
  },
  {
    slug: "the-diff",
    name: "The Diff",
    tagline: "Technology, markets, and business-model thinking.",
    description:
      "A business-and-tech publication centered on market structure, software, and long-range analytical framing.",
    audience: "Analysts, investors, and business-minded operators.",
    pricingModel: "paid",
    cadence: "Weekly",
    tone: "Analytical and concept-heavy",
    bestFor: ["Market structure", "Tech business models", "Analytical reading"],
    topics: ["economics", "technology", "investing", "strategy"],
    differentiator: "High-density business thinking with a strong analytical voice.",
  },
  {
    slug: "slow-boring",
    name: "Slow Boring",
    tagline: "Policy, politics, and urbanist thinking.",
    description:
      "A politics-and-policy publication that often appeals to readers who want more than reactive news coverage.",
    audience: "Policy readers, politically engaged generalists, and urbanists.",
    pricingModel: "freemium",
    cadence: "Multiple times weekly",
    tone: "Opinionated and policy-focused",
    bestFor: ["Policy analysis", "Urbanism", "Political commentary"],
    topics: ["policy", "politics", "urbanism", "economics"],
    differentiator: "Pragmatic policy thinking instead of pure news churn.",
  },
  {
    slug: "the-free-press",
    name: "The Free Press",
    tagline: "Opinion, reporting, and debate-led culture coverage.",
    description:
      "A publication used by readers who want essays, interviews, and culture-political commentary with a distinct editorial point of view.",
    audience: "Broad public-affairs and culture readers.",
    pricingModel: "freemium",
    cadence: "Multiple times weekly",
    tone: "Debate-led and editorial",
    bestFor: ["Culture commentary", "Public affairs", "Interviews"],
    topics: ["culture", "politics", "media", "society"],
    differentiator: "A publication-style experience built around strong editorial positioning.",
  },
  {
    slug: "no-mercy-no-malice",
    name: "No Mercy / No Malice",
    tagline: "Business, markets, and power with a distinct voice.",
    description:
      "A voice-driven business publication known for sharp takes on markets, companies, and cultural power.",
    audience: "Business readers who like strong voice and conviction.",
    pricingModel: "free",
    cadence: "Weekly",
    tone: "Punchy and opinionated",
    bestFor: ["Business commentary", "Market takes", "Brand voice study"],
    topics: ["business", "marketing", "economics", "media"],
    differentiator: "Memorable style and a clear point of view.",
  },
  {
    slug: "how-they-grow",
    name: "How They Grow",
    tagline: "Growth teardowns and user-acquisition lessons.",
    description:
      "A growth-operator publication centered on case studies, growth loops, and practical user-acquisition lessons.",
    audience: "Growth marketers, founders, and product teams.",
    pricingModel: "freemium",
    cadence: "Weekly",
    tone: "Tactical and teardown-driven",
    bestFor: ["Growth marketing", "Acquisition loops", "Case-study learning"],
    topics: ["growth", "marketing", "startups", "product"],
    differentiator: "Growth lessons anchored in concrete examples rather than generic advice.",
  },
  {
    slug: "divinations",
    name: "Divinations",
    tagline: "Data, forecasting, and analytical thinking for modern work.",
    description:
      "A data-and-decision publication that appeals to analytical readers who care about systems, metrics, and interpretation.",
    audience: "Analysts, operators, and quantitatively minded readers.",
    pricingModel: "paid",
    cadence: "Weekly",
    tone: "Analytical and measured",
    bestFor: ["Data literacy", "Forecasting", "Analytical frameworks"],
    topics: ["data", "economics", "productivity", "analysis"],
    differentiator: "Makes analytical thinking feel editorial rather than academic.",
  },
  {
    slug: "human-parts",
    name: "Human Parts",
    tagline: "Essays on culture, relationships, and being a person online.",
    description:
      "An essay-centered publication for readers who want reflective, emotionally intelligent writing rather than tactics.",
    audience: "Readers of reflective essays and personal writing.",
    pricingModel: "freemium",
    cadence: "Weekly",
    tone: "Reflective and literary",
    bestFor: ["Personal essays", "Relationships", "Culture writing"],
    topics: ["writing", "culture", "psychology", "society"],
    differentiator: "Leans into emotional depth and essay craft.",
  },
  {
    slug: "the-browser",
    name: "The Browser",
    tagline: "High-signal curation of writing from across the web.",
    description:
      "A curation-heavy publication for readers who want smart links and editorial selection rather than original essay volume.",
    audience: "Generalists and readers who value curation.",
    pricingModel: "free",
    cadence: "Daily",
    tone: "Curated and restrained",
    bestFor: ["Reading discovery", "Curation models", "Generalist learning"],
    topics: ["curation", "culture", "media", "learning"],
    differentiator: "Editorial taste as the core product.",
  },
  {
    slug: "the-ankler",
    name: "The Ankler",
    tagline: "Entertainment business and Hollywood coverage.",
    description:
      "An entertainment-industry publication focused on the business side of Hollywood, media deal-making, and cultural power.",
    audience: "Media professionals and entertainment-business readers.",
    pricingModel: "paid",
    cadence: "Multiple times weekly",
    tone: "Insider and business-focused",
    bestFor: ["Entertainment business", "Hollywood coverage", "Media analysis"],
    topics: ["entertainment", "media", "business", "culture"],
    differentiator: "Entertainment coverage centered on power and economics.",
  },
  {
    slug: "tangle",
    name: "Tangle",
    tagline: "News summaries that compare arguments across the aisle.",
    description:
      "A current-events publication designed for readers who want a clearer summary of competing viewpoints.",
    audience: "Readers seeking balanced current-events context.",
    pricingModel: "freemium",
    cadence: "Daily",
    tone: "Explanatory and comparative",
    bestFor: ["Current events", "Politics summaries", "Balanced framing"],
    topics: ["politics", "policy", "media", "society"],
    differentiator: "Structures disagreement into readable summaries.",
  },
  {
    slug: "the-dispatch",
    name: "The Dispatch",
    tagline: "Politics and policy coverage with a publication model.",
    description:
      "A publication-style newsroom on Substack that blends reporting, commentary, and recurring editorial franchises.",
    audience: "Politics and policy readers who want publication-style depth.",
    pricingModel: "freemium",
    cadence: "Daily",
    tone: "Reported and editorial",
    bestFor: ["Policy coverage", "Newsroom-style publishing", "Political analysis"],
    topics: ["politics", "policy", "media", "society"],
    differentiator: "A more newsroom-like model than a solo-newsletter brand.",
  },
  {
    slug: "heatmap-news",
    name: "Heatmap News",
    tagline: "Climate and energy news for a modern policy audience.",
    description:
      "A climate-and-energy publication focused on policy, markets, and how climate issues intersect with business and public life.",
    audience: "Climate readers, policy teams, and curious generalists.",
    pricingModel: "free",
    cadence: "Multiple times weekly",
    tone: "Topical and policy-aware",
    bestFor: ["Climate coverage", "Energy policy", "Markets and regulation"],
    topics: ["climate", "policy", "energy", "business"],
    differentiator: "Makes climate coverage feel current and sector-aware rather than abstract.",
  },
  {
    slug: "pirate-wires",
    name: "Pirate Wires",
    tagline: "Technology, politics, and culture from a strongly voiced perspective.",
    description:
      "A publication mixing technology, politics, and culture with a sharp editorial stance and internet-native sensibility.",
    audience: "Readers who enjoy voicey commentary at the edge of tech and politics.",
    pricingModel: "freemium",
    cadence: "Weekly",
    tone: "Provocative and opinionated",
    bestFor: ["Tech commentary", "Culture wars coverage", "Voice study"],
    topics: ["technology", "politics", "culture", "media"],
    differentiator: "Polarizing but memorable editorial positioning.",
  },
  {
    slug: "feed-me",
    name: "Feed Me",
    tagline: "Food writing, restaurant culture, and hospitality thinking.",
    description:
      "A publication for readers who want smart food writing, hospitality coverage, and a point of view on restaurant culture.",
    audience: "Food enthusiasts, hospitality people, and culture readers.",
    pricingModel: "free",
    cadence: "Weekly",
    tone: "Cultural and sensory",
    bestFor: ["Food writing", "Restaurant culture", "Hospitality commentary"],
    topics: ["food", "culture", "hospitality", "travel"],
    differentiator: "Treats food as both industry and culture.",
  },
  {
    slug: "culture-study",
    name: "Culture Study",
    tagline: "Sharp essays on culture, media, and identity.",
    description:
      "A culture-essay publication for readers who want smart interpretation of media, trends, and social behavior.",
    audience: "Culture readers and essay lovers.",
    pricingModel: "freemium",
    cadence: "Weekly",
    tone: "Essayistic and interpretive",
    bestFor: ["Culture essays", "Media interpretation", "Identity and trends"],
    topics: ["culture", "media", "society", "writing"],
    differentiator: "Strong interpretive essays rather than reactive commentary.",
  },
  {
    slug: "capital-gains",
    name: "Capital Gains",
    tagline: "Investing ideas and market commentary for curious readers.",
    description:
      "A market-and-investing publication for readers who want sharper frameworks around companies, narratives, and capital allocation.",
    audience: "Investors, founders, and market-curious operators.",
    pricingModel: "paid",
    cadence: "Weekly",
    tone: "Analytical and market-aware",
    bestFor: ["Investing frameworks", "Market narratives", "Company analysis"],
    topics: ["investing", "economics", "business", "markets"],
    differentiator: "Designed more around frameworks than ticker chatter.",
  },
  {
    slug: "money-stuff",
    name: "Money Stuff",
    tagline: "Markets and finance explained with wit and repetition-resistant writing.",
    description:
      "A finance publication famous for making market structure and absurdity feel readable for busy professionals.",
    audience: "Finance readers, lawyers, and market-curious generalists.",
    pricingModel: "free",
    cadence: "Daily",
    tone: "Witty and analytical",
    bestFor: ["Finance reading", "Market structure", "Business humor"],
    topics: ["finance", "markets", "economics", "law"],
    differentiator: "Extremely distinctive voice in a dense subject area.",
  },
  {
    slug: "the-split-ticket",
    name: "The Split Ticket",
    tagline: "Elections, polling, and campaign analysis.",
    description:
      "A specialist politics publication focused on polling, campaign behavior, and electoral interpretation.",
    audience: "Election watchers, analysts, and politics junkies.",
    pricingModel: "free",
    cadence: "Weekly",
    tone: "Quantitative and political",
    bestFor: ["Elections", "Polling analysis", "Campaign context"],
    topics: ["politics", "data", "policy", "media"],
    differentiator: "Strong fit for readers who like politics through numbers.",
  },
  {
    slug: "construction-physics",
    name: "Construction Physics",
    tagline: "Industrial systems, technology, and why hard things stay hard.",
    description:
      "A niche systems publication used by readers who want serious analysis of infrastructure, manufacturing, and technological constraints.",
    audience: "Engineers, industrialists, and systems thinkers.",
    pricingModel: "paid",
    cadence: "Weekly",
    tone: "Systems-oriented and detailed",
    bestFor: ["Industrial systems", "Manufacturing", "Technology history"],
    topics: ["engineering", "manufacturing", "science", "economics"],
    differentiator: "High-trust writing about physical-world bottlenecks and systems.",
  },
  {
    slug: "experimental-history",
    name: "Experimental History",
    tagline: "Essays, experiments, and idea-driven internet writing.",
    description:
      "A publication that appeals to readers who like curiosity, clever experiments, and internet-native long-form essays.",
    audience: "Writers, curious builders, and internet essay readers.",
    pricingModel: "free",
    cadence: "Weekly",
    tone: "Curious and playful",
    bestFor: ["Essay craft", "Curiosity-driven writing", "Internet thinking"],
    topics: ["writing", "science", "culture", "productivity"],
    differentiator: "Feels exploratory without losing intellectual seriousness.",
  },
  {
    slug: "the-profile",
    name: "The Profile",
    tagline: "Profiles and lessons from ambitious founders and creators.",
    description:
      "A profile-led publication used by readers who want stories and lessons from high-performing people across industries.",
    audience: "Founders, creators, and ambition-driven readers.",
    pricingModel: "freemium",
    cadence: "Weekly",
    tone: "Aspirational and profile-based",
    bestFor: ["Founder stories", "Creator profiles", "Career inspiration"],
    topics: ["careers", "startups", "creator-economy", "leadership"],
    differentiator: "Builds around the profile format rather than pure advice.",
  },
  {
    slug: "the-audience-strategy",
    name: "The Audience Strategy",
    tagline: "Media growth, audience development, and editorial packaging.",
    description:
      "A strategy publication for people trying to grow attention-based businesses with stronger editorial packaging and distribution.",
    audience: "Media operators, marketers, and publication builders.",
    pricingModel: "freemium",
    cadence: "Weekly",
    tone: "Strategic and publishing-aware",
    bestFor: ["Audience growth", "Editorial strategy", "Packaging ideas"],
    topics: ["media", "marketing", "writing", "creator-economy"],
    differentiator: "Treats audience growth as a publishing-systems problem.",
  },
  {
    slug: "banner-year",
    name: "Banner Year",
    tagline: "Sports business, fandom, and media dynamics.",
    description:
      "A sports-and-media publication for readers who care about how fandom, leagues, and sports media businesses evolve.",
    audience: "Sports-media readers and culture-minded fans.",
    pricingModel: "free",
    cadence: "Weekly",
    tone: "Conversational and analytical",
    bestFor: ["Sports business", "Sports media", "Fandom analysis"],
    topics: ["sports", "media", "business", "culture"],
    differentiator: "Looks at sports through media and market dynamics.",
  },
  {
    slug: "after-school",
    name: "After School",
    tagline: "Education, parenting, and how children learn.",
    description:
      "A practical education publication for readers thinking about school, parenting, and learning systems.",
    audience: "Parents, educators, and learning-focused readers.",
    pricingModel: "free",
    cadence: "Weekly",
    tone: "Practical and caring",
    bestFor: ["Education thinking", "Parenting", "Learning systems"],
    topics: ["education", "parenting", "psychology", "society"],
    differentiator: "Brings pedagogy and family context together.",
  },
  {
    slug: "the-longevity-curve",
    name: "The Longevity Curve",
    tagline: "Longevity, health routines, and evidence-aware optimization.",
    description:
      "A health-and-longevity publication for readers who want practical frameworks without pure wellness hype.",
    audience: "Health-conscious professionals and evidence-seeking readers.",
    pricingModel: "freemium",
    cadence: "Weekly",
    tone: "Practical and evidence-aware",
    bestFor: ["Longevity", "Health routines", "Evidence-first wellness"],
    topics: ["health", "longevity", "science", "productivity"],
    differentiator: "Balances optimization language with evidence awareness.",
  },
  {
    slug: "the-climate-brief",
    name: "The Climate Brief",
    tagline: "Climate markets, policy, and adaptation signals.",
    description:
      "A climate publication for readers who want the intersection of markets, regulation, and sector-level adaptation.",
    audience: "Climate operators, investors, and policy-adjacent readers.",
    pricingModel: "freemium",
    cadence: "Weekly",
    tone: "Briefing-style and analytical",
    bestFor: ["Climate markets", "Adaptation", "Policy context"],
    topics: ["climate", "energy", "policy", "markets"],
    differentiator: "Treats climate as an operating environment, not just a topic beat.",
  },
  {
    slug: "cyber-signals",
    name: "Cyber Signals",
    tagline: "Cybersecurity patterns for technical and executive readers.",
    description:
      "A cybersecurity publication designed for readers who want patterns, risk framing, and plain-language interpretation.",
    audience: "Security leaders, technical teams, and execs.",
    pricingModel: "freemium",
    cadence: "Weekly",
    tone: "Clear and risk-aware",
    bestFor: ["Security trends", "Risk communication", "Cyber education"],
    topics: ["cybersecurity", "technology", "policy", "risk"],
    differentiator: "Bridges specialist security topics and business understanding.",
  },
];

const nicheSeeds: Array<
  Omit<SubstackNiche, "relatedNicheSlugs"> & { relatedNicheSlugs?: string[] }
> = [
  {
    slug: "ai",
    name: "AI",
    title: "Best AI Substacks",
    description: "Curated AI Substacks for builders, operators, and readers tracking practical model adoption.",
    audience: "AI builders, operators, and generalist tech readers.",
    angle: "Use this page to compare AI publications by operator depth, practical workflow value, and pricing model.",
    publicationSlugs: ["one-useful-thing", "big-technology", "every", "not-boring"],
  },
  {
    slug: "startups",
    name: "Startups",
    title: "Best Startup Substacks",
    description: "A niche page for startup readers comparing founder-led and operator-led newsletters.",
    audience: "Founders, startup teams, and ambitious generalists.",
    angle: "Compare startup publications by stage fit, tactical depth, and how directly they translate into operating decisions.",
    publicationSlugs: ["lennys-newsletter", "not-boring", "the-generalist", "the-profile"],
  },
  {
    slug: "saas",
    name: "SaaS",
    title: "Best SaaS Substacks",
    description: "Substack newsletters for SaaS operators, product teams, and growth-minded founders.",
    audience: "SaaS founders, PMs, and revenue operators.",
    angle: "Use the SaaS niche page to find newsletters that cover recurring revenue, product distribution, and expansion strategy.",
    publicationSlugs: ["lennys-newsletter", "how-they-grow", "the-pragmatic-engineer", "every"],
  },
  {
    slug: "product-management",
    name: "Product Management",
    title: "Best Product Management Substacks",
    description: "Curated product-management newsletters for PM craft, strategy, and execution.",
    audience: "PMs, product leaders, and startup operators.",
    angle: "Great for readers who want product strategy, growth loops, and decision-making frameworks.",
    publicationSlugs: ["lennys-newsletter", "every", "the-generalist", "the-profile"],
  },
  {
    slug: "software-engineering",
    name: "Software Engineering",
    title: "Best Software Engineering Substacks",
    description: "Engineering-focused Substacks covering technical leadership, software systems, and career leverage.",
    audience: "Senior engineers, managers, and technical ICs.",
    angle: "Use this page to compare engineering newsletters by technical density and leadership relevance.",
    publicationSlugs: ["the-pragmatic-engineer", "construction-physics", "the-diff", "cyber-signals"],
  },
  {
    slug: "devtools",
    name: "DevTools",
    title: "Best DevTools Substacks",
    description: "Substacks for developer tooling, engineering businesses, and technical product strategy.",
    audience: "Devtool founders, engineers, and product teams.",
    angle: "Compare publications that help technical builders think about tooling markets, engineering leverage, and product distribution.",
    publicationSlugs: ["the-pragmatic-engineer", "the-diff", "lennys-newsletter", "every"],
  },
  {
    slug: "web-development",
    name: "Web Development",
    title: "Best Web Development Substacks",
    description: "Web-development newsletters with useful commentary for frontend, product, and internet-native builders.",
    audience: "Frontend developers and web-first builders.",
    angle: "Browse for workflow, product, and internet-development thinking rather than low-level tutorials alone.",
    publicationSlugs: ["the-pragmatic-engineer", "every", "experimental-history", "dense-discovery"],
  },
  {
    slug: "data",
    name: "Data",
    title: "Best Data Substacks",
    description: "A data niche page for analysis, metrics, and data-informed decision making.",
    audience: "Analysts, data teams, and quantitatively minded operators.",
    angle: "Best when you want analytical writing, forecasting habits, and metrics-rich thinking.",
    publicationSlugs: ["divinations", "the-split-ticket", "money-stuff", "the-diff"],
  },
  {
    slug: "design",
    name: "Design",
    title: "Best Design Substacks",
    description: "Design-oriented Substacks for taste, systems thinking, and editorial curation.",
    audience: "Designers, creative directors, and product builders.",
    angle: "Use this niche when taste, curation, and clear visual/editorial thinking matter more than software tutorials.",
    publicationSlugs: ["dense-discovery", "culture-study", "every", "the-browser"],
  },
  {
    slug: "writing",
    name: "Writing",
    title: "Best Writing Substacks",
    description: "Writing newsletters for craft, essays, distribution, and durable publishing habits.",
    audience: "Writers, essayists, and creator-operators.",
    angle: "Compare newsletters by essay depth, publishing systems, and voice development.",
    publicationSlugs: ["human-parts", "experimental-history", "creator-science", "culture-study"],
  },
  {
    slug: "marketing",
    name: "Marketing",
    title: "Best Marketing Substacks",
    description: "Substacks for modern marketing, audience growth, packaging, and distribution.",
    audience: "Marketers, growth teams, and creators.",
    angle: "Great for readers who care about distribution, positioning, and audience-building systems.",
    publicationSlugs: ["creator-science", "how-they-grow", "future-commerce", "the-audience-strategy"],
  },
  {
    slug: "seo",
    name: "SEO",
    title: "Best SEO Substacks",
    description: "A curated SEO-adjacent Substack niche for audience growth, publishing leverage, and discovery loops.",
    audience: "SEO teams, content strategists, and growth marketers.",
    angle: "Use this page when you want smarter thinking about distribution and content packaging rather than keyword dashboards alone.",
    publicationSlugs: ["creator-science", "the-audience-strategy", "how-they-grow", "lennys-newsletter"],
  },
  {
    slug: "copywriting",
    name: "Copywriting",
    title: "Best Copywriting Substacks",
    description: "Substack newsletters for stronger editorial packaging, persuasion, and writing clarity.",
    audience: "Copywriters, marketers, and founders.",
    angle: "Look here for newsletters that sharpen messaging, packaging, and audience resonance.",
    publicationSlugs: ["creator-science", "human-parts", "culture-study", "no-mercy-no-malice"],
  },
  {
    slug: "creator-economy",
    name: "Creator Economy",
    title: "Best Creator Economy Substacks",
    description: "Curated creator-economy newsletters covering monetization, audience growth, and independent media.",
    audience: "Creators, newsletter operators, and media builders.",
    angle: "Compare how different publications think about monetization, packaging, and creator-business durability.",
    publicationSlugs: ["creator-science", "the-profile", "every", "the-audience-strategy"],
  },
  {
    slug: "no-code",
    name: "No-code",
    title: "Best No-code Substacks",
    description: "No-code-adjacent Substacks for builders who think in systems, product loops, and pragmatic AI automation.",
    audience: "No-code builders and indie operators.",
    angle: "Useful for discovering publications that reward shipping systems over hype alone.",
    publicationSlugs: ["every", "creator-science", "lennys-newsletter", "one-useful-thing"],
  },
  {
    slug: "venture-capital",
    name: "Venture Capital",
    title: "Best Venture Capital Substacks",
    description: "A venture-capital niche page for firm strategy, startup markets, and investor commentary.",
    audience: "Investors, founders, and market readers.",
    angle: "Compare VC-leaning Substacks by market context, company analysis, and narrative style.",
    publicationSlugs: ["the-generalist", "not-boring", "capital-gains", "stratechery"],
  },
  {
    slug: "investing",
    name: "Investing",
    title: "Best Investing Substacks",
    description: "Investing newsletters on Substack for markets, companies, and decision frameworks.",
    audience: "Investors, founders, and analytically minded readers.",
    angle: "Use this page to find publications that fit your appetite for company analysis, market narrative, or capital-allocation thinking.",
    publicationSlugs: ["capital-gains", "money-stuff", "the-diff", "not-boring"],
  },
  {
    slug: "personal-finance",
    name: "Personal Finance",
    title: "Best Personal Finance Substacks",
    description: "A personal-finance niche page with publications that make money, markets, and financial behavior easier to understand.",
    audience: "General readers, professionals, and financially curious creators.",
    angle: "Useful when you want financial ideas explained without institutional jargon.",
    publicationSlugs: ["money-stuff", "capital-gains", "the-diff", "no-mercy-no-malice"],
  },
  {
    slug: "crypto",
    name: "Crypto",
    title: "Best Crypto Substacks",
    description: "Crypto-adjacent Substacks for market context, internet-native trends, and risk-aware commentary.",
    audience: "Crypto-curious readers, builders, and market watchers.",
    angle: "Use this niche for thoughtful market context and internet-finance crossover, not just speculation.",
    publicationSlugs: ["pirate-wires", "not-boring", "money-stuff", "the-diff"],
  },
  {
    slug: "economics",
    name: "Economics",
    title: "Best Economics Substacks",
    description: "Economics newsletters on Substack for markets, policy, incentives, and systems thinking.",
    audience: "Economics readers, policy generalists, and operators.",
    angle: "Good for comparing publications that explain incentives, policy, and macro themes in readable terms.",
    publicationSlugs: ["the-diff", "money-stuff", "slow-boring", "stratechery"],
  },
  {
    slug: "politics",
    name: "Politics",
    title: "Best Politics Substacks",
    description: "Political Substacks spanning current events, ideology, polling, and policy interpretation.",
    audience: "Politically engaged readers and policy watchers.",
    angle: "Browse here when you want politics explained through context, numbers, or editorial voice.",
    publicationSlugs: ["letters-from-an-american", "tangle", "slow-boring", "the-dispatch"],
  },
  {
    slug: "policy",
    name: "Policy",
    title: "Best Policy Substacks",
    description: "Substack newsletters for public policy, regulation, and issue-area context.",
    audience: "Policy professionals, analysts, and informed generalists.",
    angle: "Use this niche to compare publications with stronger policy density and less pure news churn.",
    publicationSlugs: ["slow-boring", "sinocism", "heatmap-news", "the-dispatch"],
  },
  {
    slug: "climate",
    name: "Climate",
    title: "Best Climate Substacks",
    description: "Climate Substacks for energy, adaptation, policy, and business implications.",
    audience: "Climate builders, analysts, and policy readers.",
    angle: "A good niche for comparing climate coverage through the lens of markets, regulation, and applied strategy.",
    publicationSlugs: ["heatmap-news", "the-climate-brief", "future-commerce", "sinocism"],
  },
  {
    slug: "health",
    name: "Health",
    title: "Best Health Substacks",
    description: "Health-focused Substacks for routines, systems, evidence, and practical decision making.",
    audience: "Health-conscious readers, coaches, and generalists.",
    angle: "Use this niche for evidence-aware health publications rather than wellness hype alone.",
    publicationSlugs: ["the-longevity-curve", "one-useful-thing", "after-school", "human-parts"],
  },
  {
    slug: "longevity",
    name: "Longevity",
    title: "Best Longevity Substacks",
    description: "Longevity newsletters on Substack with a bias toward practical routines and evidence-aware frameworks.",
    audience: "Professionals interested in healthy lifespan and routines.",
    angle: "A useful niche if you want longevity writing that feels practical, not just speculative.",
    publicationSlugs: ["the-longevity-curve", "one-useful-thing", "divinations", "human-parts"],
  },
  {
    slug: "science",
    name: "Science",
    title: "Best Science Substacks",
    description: "Science Substacks for explanation, evidence, and specialist curiosity.",
    audience: "Science readers, students, and analytically minded generalists.",
    angle: "Browse this niche when you want explanation-heavy writing and research-aware thinking.",
    publicationSlugs: ["experimental-history", "construction-physics", "one-useful-thing", "the-longevity-curve"],
  },
  {
    slug: "biotech",
    name: "Biotech",
    title: "Best Biotech Substacks",
    description: "Biotech-adjacent newsletters covering science, markets, and the business of health.",
    audience: "Biotech operators, investors, and science readers.",
    angle: "A helpful niche for readers who want biotech context through science and market framing.",
    publicationSlugs: ["the-longevity-curve", "capital-gains", "experimental-history", "the-diff"],
  },
  {
    slug: "media",
    name: "Media",
    title: "Best Media Substacks",
    description: "Media Substacks for publishing strategy, internet platforms, entertainment, and commentary.",
    audience: "Media operators, journalists, and internet observers.",
    angle: "Useful when you want the business and behavior layer of media, not just headlines.",
    publicationSlugs: ["platformer", "garbage-day", "the-ankler", "the-audience-strategy"],
  },
  {
    slug: "entertainment",
    name: "Entertainment",
    title: "Best Entertainment Substacks",
    description: "Entertainment newsletters on Substack for Hollywood, fandom, and media power.",
    audience: "Entertainment-business readers and culture fans.",
    angle: "Browse here for writing about the business and culture of entertainment, not just reviews.",
    publicationSlugs: ["the-ankler", "garbage-day", "culture-study", "banner-year"],
  },
  {
    slug: "film",
    name: "Film",
    title: "Best Film Substacks",
    description: "Film and criticism-adjacent Substacks with strong editorial voice and cultural framing.",
    audience: "Film lovers, critics, and culture readers.",
    angle: "Best for readers who want criticism, media context, and cultural interpretation.",
    publicationSlugs: ["culture-study", "the-ankler", "garbage-day", "the-browser"],
  },
  {
    slug: "fashion",
    name: "Fashion",
    title: "Best Fashion Substacks",
    description: "Fashion-adjacent Substacks with strong taste, curation, and culture awareness.",
    audience: "Fashion readers, creators, and culture observers.",
    angle: "Use this page for publications that combine taste, identity, and industry context.",
    publicationSlugs: ["culture-study", "dense-discovery", "human-parts", "the-browser"],
  },
  {
    slug: "food",
    name: "Food",
    title: "Best Food Substacks",
    description: "Food newsletters on Substack for restaurant culture, hospitality, and thoughtful recommendations.",
    audience: "Food enthusiasts, hospitality people, and lifestyle readers.",
    angle: "A good niche for readers who want food as culture and industry, not only recipes.",
    publicationSlugs: ["feed-me", "dense-discovery", "future-commerce", "culture-study"],
  },
  {
    slug: "travel",
    name: "Travel",
    title: "Best Travel Substacks",
    description: "Travel-adjacent Substacks for observation, recommendations, and place-based writing.",
    audience: "Travel readers and experience-driven creators.",
    angle: "Browse for publications that treat travel as perspective and curation rather than generic tourism lists.",
    publicationSlugs: ["dense-discovery", "feed-me", "the-browser", "human-parts"],
  },
  {
    slug: "education",
    name: "Education",
    title: "Best Education Substacks",
    description: "Education newsletters on Substack for learning design, school systems, and teaching practice.",
    audience: "Educators, parents, and learning designers.",
    angle: "Use this niche when you want practical education thinking with a systems lens.",
    publicationSlugs: ["after-school", "one-useful-thing", "experimental-history", "creator-science"],
  },
  {
    slug: "parenting",
    name: "Parenting",
    title: "Best Parenting Substacks",
    description: "Parenting Substacks for family systems, education, and emotionally intelligent writing.",
    audience: "Parents and family-oriented readers.",
    angle: "Best for readers who want parenting writing that feels thoughtful instead of purely reactive.",
    publicationSlugs: ["after-school", "human-parts", "culture-study", "letters-from-an-american"],
  },
  {
    slug: "philosophy",
    name: "Philosophy",
    title: "Best Philosophy Substacks",
    description: "Philosophy-adjacent Substacks for ideas, essays, and durable thinking.",
    audience: "Idea readers, essay lovers, and thoughtful generalists.",
    angle: "Useful when you want reflective writing with conceptual depth and strong voice.",
    publicationSlugs: ["experimental-history", "human-parts", "culture-study", "the-browser"],
  },
  {
    slug: "psychology",
    name: "Psychology",
    title: "Best Psychology Substacks",
    description: "Psychology newsletters on Substack for behavior, relationships, and self-understanding.",
    audience: "Curious generalists and psychology-minded readers.",
    angle: "Browse for publications that connect behavior, culture, and lived experience.",
    publicationSlugs: ["human-parts", "after-school", "the-longevity-curve", "culture-study"],
  },
  {
    slug: "productivity",
    name: "Productivity",
    title: "Best Productivity Substacks",
    description: "Productivity newsletters for systems, knowledge work, and better operating habits.",
    audience: "Knowledge workers, founders, and creators.",
    angle: "A strong niche for readers who want better systems for work, learning, and publishing.",
    publicationSlugs: ["every", "one-useful-thing", "creator-science", "divinations"],
  },
  {
    slug: "careers",
    name: "Careers",
    title: "Best Careers Substacks",
    description: "Career-focused Substacks for advancement, leverage, and modern work decisions.",
    audience: "Ambitious professionals and operators.",
    angle: "Use this page for publications that make career growth feel strategic rather than motivational.",
    publicationSlugs: ["lennys-newsletter", "the-pragmatic-engineer", "the-profile", "creator-science"],
  },
  {
    slug: "leadership",
    name: "Leadership",
    title: "Best Leadership Substacks",
    description: "Leadership newsletters on Substack for management, judgment, and organization design.",
    audience: "Managers, executives, and team leads.",
    angle: "Browse for newsletters that connect leadership to systems, communication, and decision quality.",
    publicationSlugs: ["the-pragmatic-engineer", "lennys-newsletter", "the-profile", "stratechery"],
  },
  {
    slug: "sales",
    name: "Sales",
    title: "Best Sales Substacks",
    description: "Sales-adjacent Substacks for persuasion, positioning, and commercial thinking.",
    audience: "Sales teams, founders, and go-to-market operators.",
    angle: "Useful for readers who want strong commercial judgment and better positioning signals.",
    publicationSlugs: ["no-mercy-no-malice", "creator-science", "future-commerce", "how-they-grow"],
  },
  {
    slug: "e-commerce",
    name: "E-commerce",
    title: "Best E-commerce Substacks",
    description: "E-commerce newsletters covering brand, retention, merchandising, and digital commerce strategy.",
    audience: "Brand builders, e-commerce operators, and growth teams.",
    angle: "Compare publications that think about commerce as both brand and performance system.",
    publicationSlugs: ["future-commerce", "how-they-grow", "dense-discovery", "the-audience-strategy"],
  },
  {
    slug: "retail",
    name: "Retail",
    title: "Best Retail Substacks",
    description: "Retail-focused Substacks for trends, merchandising, and commerce-system insight.",
    audience: "Retail strategists, operators, and brand teams.",
    angle: "A good niche for readers who care about how stores, brands, and channels evolve together.",
    publicationSlugs: ["future-commerce", "dense-discovery", "feed-me", "not-boring"],
  },
  {
    slug: "real-estate",
    name: "Real Estate",
    title: "Best Real Estate Substacks",
    description: "Real-estate-adjacent Substacks for markets, policy, and urban development context.",
    audience: "Real estate readers, urbanists, and policy-minded professionals.",
    angle: "Use this page when you want real-estate context through markets and urbanism rather than sales hype.",
    publicationSlugs: ["slow-boring", "letters-from-an-american", "money-stuff", "capital-gains"],
  },
  {
    slug: "cybersecurity",
    name: "Cybersecurity",
    title: "Best Cybersecurity Substacks",
    description: "Cybersecurity newsletters for risk, technical context, and executive understanding.",
    audience: "Security practitioners, leaders, and risk-aware operators.",
    angle: "Great for readers who want cybersecurity explained clearly enough to inform action.",
    publicationSlugs: ["cyber-signals", "the-pragmatic-engineer", "platformer", "the-diff"],
  },
  {
    slug: "law",
    name: "Law",
    title: "Best Law Substacks",
    description: "Law-adjacent Substacks for regulation, institutions, and business implications.",
    audience: "Lawyers, policy people, and business readers.",
    angle: "Use this niche for publications that make legal and regulatory systems more legible to non-specialists.",
    publicationSlugs: ["money-stuff", "sinocism", "tangle", "the-free-press"],
  },
  {
    slug: "history",
    name: "History",
    title: "Best History Substacks",
    description: "History-adjacent Substacks for context-rich essays and long-range thinking.",
    audience: "History readers and context-seeking generalists.",
    angle: "A good niche when you want current questions reframed through history and long-term patterns.",
    publicationSlugs: ["letters-from-an-american", "experimental-history", "construction-physics", "the-browser"],
  },
  {
    slug: "sports",
    name: "Sports",
    title: "Best Sports Substacks",
    description: "Sports Substacks for fandom, league economics, and media behavior.",
    audience: "Sports readers and media-minded fans.",
    angle: "Best for readers who want sports framed as culture, business, and media system.",
    publicationSlugs: ["banner-year", "the-ankler", "culture-study", "garbage-day"],
  },
];

export const substackNiches: SubstackNiche[] = nicheSeeds.map((seed, index, all) => ({
  ...seed,
  relatedNicheSlugs:
    seed.relatedNicheSlugs ||
    [all[(index + 1) % all.length].slug, all[(index + 5) % all.length].slug, all[(index + 11) % all.length].slug],
}));

export function getSubstackDirectoryNichePath(slug: string) {
  return `/tools/substack-directory/${slug}`;
}

export function getSubstackDirectoryPricingPath(
  nicheSlug: string,
  pricing: DirectoryPricingModel
) {
  return `/tools/substack-directory/${nicheSlug}/pricing/${pricing}`;
}

export function getSubstackPublicationPath(slug: string) {
  return `/tools/substack-directory/publication/${slug}`;
}

export function getSubstackNiche(slug: string) {
  return substackNiches.find((niche) => niche.slug === slug);
}

export function getSubstackPublication(slug: string) {
  return substackPublications.find((publication) => publication.slug === slug);
}

export function getSubstackNichePublications(
  niche: SubstackNiche,
  pricing?: DirectoryPricingModel
) {
  const publications = niche.publicationSlugs
    .map((slug) => getSubstackPublication(slug))
    .filter((publication): publication is SubstackPublication => Boolean(publication));

  const filtered = pricing
    ? publications.filter((publication) => publication.pricingModel === pricing)
    : publications;

  return filtered.length ? filtered : publications;
}

export const substackDirectoryPaths = [
  ...substackNiches.flatMap((niche) => [
    getSubstackDirectoryNichePath(niche.slug),
    getSubstackDirectoryPricingPath(niche.slug, "free"),
    getSubstackDirectoryPricingPath(niche.slug, "paid"),
    getSubstackDirectoryPricingPath(niche.slug, "freemium"),
  ]),
  ...substackPublications.map((publication) => getSubstackPublicationPath(publication.slug)),
];

export type SubstackDirectoryPage =
  | {
      kind: "niche";
      niche: SubstackNiche;
      pricing?: DirectoryPricingModel;
      path: string;
      title: string;
      description: string;
      faq: FaqItem[];
      publications: SubstackPublication[];
    }
  | {
      kind: "publication";
      publication: SubstackPublication;
      path: string;
      title: string;
      description: string;
      faq: FaqItem[];
    };

export function getSubstackDirectoryPage(path: string): SubstackDirectoryPage | undefined {
  const publicationPrefix = "/tools/substack-directory/publication/";
  if (path.startsWith(publicationPrefix)) {
    const publication = getSubstackPublication(path.replace(publicationPrefix, ""));
    if (!publication) return undefined;

    return {
      kind: "publication",
      publication,
      path,
      title: `${publication.name} on Substack`,
      description: `${publication.name} profile page with audience fit, editorial angle, pricing model, cadence, and related niche pages.`,
      faq: [
        {
          question: `Who is ${publication.name} best for?`,
          answer: `${publication.name} is best for ${publication.audience.toLowerCase()} with interest in ${publication.bestFor.slice(0, 2).join(" and ")}.`,
        },
        {
          question: `Is ${publication.name} free or paid?`,
          answer: `In this directory, ${publication.name} is classified as ${pricingLabels[publication.pricingModel].toLowerCase()}. Treat that as an editorial planning label rather than an official pricing guarantee.`,
        },
      ],
    };
  }

  const pricingMatch = path.match(
    /^\/tools\/substack-directory\/([^/]+)\/pricing\/(free|paid|freemium)$/
  );
  if (pricingMatch) {
    const [, nicheSlug, pricingValue] = pricingMatch;
    const niche = getSubstackNiche(nicheSlug);
    if (!niche) return undefined;
    const pricing = pricingValue as DirectoryPricingModel;
    const publications = getSubstackNichePublications(niche, pricing);

    return {
      kind: "niche",
      niche,
      pricing,
      path,
      title: `${pricingLabels[pricing]} ${niche.title}`,
      description: `Browse ${pricingLabels[pricing].toLowerCase()} Substack picks in ${niche.name.toLowerCase()} with editorial notes, audience fit, and related newsletter profiles.`,
      publications,
      faq: [
        {
          question: `Why filter ${niche.name.toLowerCase()} Substacks by ${pricingLabels[pricing].toLowerCase()}?`,
          answer: `Because pricing model changes how a newsletter grows, converts, and behaves as a business. This page helps you compare ${pricingLabels[pricing].toLowerCase()} options inside the same niche.`,
        },
        {
          question: `Are these official Substack rankings?`,
          answer:
            "No. They are editorially curated niche pages designed to help with discovery and comparison.",
        },
      ],
    };
  }

  const nichePrefix = "/tools/substack-directory/";
  if (path.startsWith(nichePrefix)) {
    const niche = getSubstackNiche(path.replace(nichePrefix, ""));
    if (!niche) return undefined;
    const publications = getSubstackNichePublications(niche);

    return {
      kind: "niche",
      niche,
      path,
      title: niche.title,
      description: niche.description,
      publications,
      faq: [
        {
          question: `What makes a good ${niche.name.toLowerCase()} Substack?`,
          answer: `The best ${niche.name.toLowerCase()} newsletters usually combine a clear editorial angle, a durable audience promise, and a publishing cadence the writer can actually sustain.`,
        },
        {
          question: `How should I use this ${niche.name.toLowerCase()} directory page?`,
          answer: `Start with the editorial fit, then narrow by pricing model and open the publication profiles that match your audience and tone goals.`,
        },
      ],
    };
  }

  return undefined;
}
