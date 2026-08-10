import type { BlogPost } from "../seoTypes";

/**
 * Cluster C — one post per document type.
 *
 * Individually these are low-volume long tail. Together they cover the shapes a
 * PDF actually arrives in, and each one names an audience precisely enough to
 * be worth landing on. The rule for this cluster: every post must contain at
 * least one thing that is only true of that document type, or it is filler and
 * competes with its own siblings.
 */
export const documentTypePosts: BlogPost[] = [
  {
    slug: "research-paper-to-video-without-losing-the-nuance",
    title: "Research Paper to Video Without Losing the Nuance",
    description:
      "How to make a paper watchable without over-claiming: what to cut, which hedges are load-bearing, and how to handle the figures.",
    category: "Document Types",
    publishedAt: "2026-04-27",
    readTime: "9 min read",
    heroEyebrow: "Research",
    heroTitle: "Research paper to video, without losing the nuance",
    heroDescription:
      "The risk is not that the video is boring. It is that compression turns a careful finding into a claim you would not defend.",
    primaryKeyword: "research paper to video",
    keywordVariant: "academic paper video summary",
    relatedPaths: [
      "/for-researchers",
      "/for-researchers/pdf-to-video",
      "/tools/pdf-summarizer",
      "/blogs/pdf-summarizer-or-pdf-video-summary",
    ],
    sections: [
      {
        heading: "What to cut, in order",
        paragraphs: [
          "A twenty-page paper is roughly ninety minutes of narration. The video is six. So this is almost entirely a cutting exercise, and papers have a conventional structure that makes the order obvious.",
        ],
        bullets: [
          "Related work — cut entirely. It exists for reviewers.",
          "Methodology — reduce to one sentence naming the design and the sample. Anyone who needs more will read the paper.",
          "Robustness checks and appendices — cut, with a line saying they exist.",
          "Limitations — keep. See below; this is the one people wrongly cut.",
          "Finding, its strongest figure, and the implication — this is the video.",
        ],
      },
      {
        heading: "The hedges that are load-bearing",
        paragraphs: [
          "Academic writing hedges deliberately, and compression removes hedges first because they add words without adding claims. That is exactly backwards. 'Associated with' becoming 'causes', 'in this sample' becoming a general statement, 'suggests' becoming 'shows' — each is a small edit and a substantive misrepresentation.",
          "The rule that works: any word doing epistemic work stays, even when it costs runtime. If the narration cannot fit the qualifier, the sentence is wrong at that length and needs restructuring rather than trimming.",
          "This is also why the narration script must be read against the paper before rendering. An automated rewrite will produce fluent, confident sentences, and confidence is precisely the failure mode here.",
        ],
      },
      {
        heading: "Keep the limitations section",
        paragraphs: [
          "Counter-intuitive, and it is the thing that most distinguishes a credible research video from a press-release one. Thirty seconds acknowledging what the study cannot show buys more trust from a knowledgeable audience than two minutes of additional findings.",
          "It also protects you. A paper video that over-claims gets quote-tweeted by people who read the paper, and that correction travels further than the video did.",
        ],
      },
      {
        heading: "Figures, at readable size",
        paragraphs: [
          "Your figures are the reason a research video beats a talking head, and they are almost always unusable as exported. A figure designed for a two-column journal layout has 7pt axis labels that become invisible at phone size.",
          "Crop to the panel that carries the finding — usually one of four — and increase the label size. Then let the narration point at the specific feature rather than describing the chart in general: 'the gap opens after week six' beats 'this chart shows the treatment effect over time'.",
        ],
        bullets: [
          "One figure per scene, never two.",
          "Crop to the panel that matters.",
          "Axis labels at least as large as the body text.",
          "Narration points at a feature, not at the chart.",
        ],
      },
      {
        heading: "The structure that works",
        paragraphs: [
          "Finding first. Academic writing builds to the result; video loses the audience before it arrives. Open with what you found, then spend the middle on why it is credible, and close with what it changes.",
          "This inverts the paper deliberately, and it is the single biggest structural change. Everything else — the cutting, the hedging, the figures — is easier once the finding is at the front.",
        ],
        ctaPath: "/for-researchers",
        ctaLabel: "See the researcher workflow",
      },
    ],
    faq: [
      {
        question: "How long should a research paper video be?",
        answer:
          "Five to eight minutes for a full paper. Under three if it is going in a conference feed or on social, in which case it covers the finding only and links to the paper.",
      },
      {
        question: "Does a video summary hurt citations?",
        answer:
          "The available evidence points the other way — papers with accessible summaries tend to attract more attention, and attention precedes citation. The risk is over-claiming, not accessibility.",
      },
      {
        question: "Should the video include the methodology?",
        answer:
          "One sentence naming the design and sample size. Full methodology belongs in the paper, and viewers who need it are already going there.",
      },
      {
        question: "Who should narrate — an author or a synthesised voice?",
        answer:
          "Either works for content. An author's voice adds credibility for a named-lab audience; synthesis wins when the paper will be updated or translated, since re-recording is the expensive part.",
      },
    ],
    distributionPlan: [
      {
        channel: "site",
        title: "Research Paper to Video Without Losing the Nuance",
        angle: "Anchor post for the academic segment; the hedging section is the differentiator.",
      },
      {
        channel: "substack",
        title: "The hedges you must not cut",
        angle: "Short essay for a research-communication newsletter.",
      },
    ],
  },
  {
    slug: "whitepaper-to-video-for-demand-generation",
    title: "Whitepaper to Video: Getting Value From the Asset You Already Gated",
    description:
      "A whitepaper behind a form reaches the people who filled the form. The video version reaches the ones who never would.",
    category: "Document Types",
    publishedAt: "2026-04-20",
    readTime: "8 min read",
    heroEyebrow: "Marketing",
    heroTitle: "Whitepaper to video for demand generation",
    heroDescription:
      "The download is not the outcome. Most gated whitepapers are downloaded, unread, and forgotten — and the video version fixes the wrong half of that on purpose.",
    primaryKeyword: "whitepaper to video",
    keywordVariant: "gated content to video",
    relatedPaths: [
      "/for-finance-publishers",
      "/pdf-to-video",
      "/distribution-flywheel",
      "/blogs/case-study-to-video-that-a-buyer-will-finish",
    ],
    sections: [
      {
        heading: "The number that should worry you",
        paragraphs: [
          "Gated whitepapers are measured by downloads, which is a measure of form completions, not of reading. Anyone who has looked at the follow-on engagement knows the gap: a large share of downloads are never opened, and of those opened, most are skimmed for the one chart that got shared on social.",
          "So the asset you spent six weeks on is doing two jobs — generating a lead record, and delivering an argument — and it is only reliably doing the first.",
        ],
      },
      {
        heading: "Ungate the argument, keep the gate on the artefact",
        paragraphs: [
          "The move that works is not removing the gate. It is producing an ungated video that carries the argument, and keeping the gated PDF for the people who want the full method, the data appendix, and something citable.",
          "This inverts the usual funnel logic and it holds up: the video does the persuading at the top, and the download becomes a signal of genuine interest rather than the price of finding out whether the content was any good.",
        ],
        bullets: [
          "Ungated: the finding, the evidence, and the implication, in five minutes.",
          "Gated: the full document, the methodology, the data.",
          "The video's description links to the gate, so the download is a deliberate act.",
        ],
      },
      {
        heading: "What goes in the five minutes",
        paragraphs: [
          "Not a summary of the whitepaper. A summary describes; the video should argue. Take the single strongest claim, the one piece of evidence that most supports it, and the practical consequence for the viewer's job.",
          "The temptation is to preview all six sections so viewers know what they are downloading. That produces a trailer, and trailers for documents do not perform, because nobody was waiting for your whitepaper.",
        ],
      },
      {
        heading: "Where it goes",
        paragraphs: [
          "LinkedIn feed for the sixty-to-ninety-second cut, with captions, because it is watched on mute. YouTube for the full five minutes, because that is where the searchable version lives and where a description with links can do work. Embedded on the landing page above the form, which reliably improves form completion because the visitor now knows what they are trading their email for.",
          "The same storyboard produces all three. Cutting a vertical version afterwards from a finished landscape render is the expensive way round.",
        ],
        ctaPath: "/distribution-flywheel",
        ctaLabel: "The distribution model",
      },
      {
        heading: "Measuring it honestly",
        paragraphs: [
          "Downloads will not go up much, and that is the wrong metric anyway. Watch instead for the ratio of downloads to sales conversations, which should improve because the people downloading now know what they are getting, and for the total reach of the argument, which is the number the gate was suppressing.",
        ],
      },
    ],
    faq: [
      {
        question: "Does an ungated video reduce whitepaper downloads?",
        answer:
          "Sometimes slightly, and the downloads you lose are the ones that were never going to read it. The downloads you keep convert at a higher rate because the visitor already knows the argument.",
      },
      {
        question: "How long should a whitepaper video be?",
        answer:
          "Five minutes for the full version, ninety seconds for the feed cut. A whitepaper narrated in full is thirty to forty minutes, which is not a marketing asset.",
      },
      {
        question: "Should the video reveal the main finding?",
        answer:
          "Yes. Withholding it to drive the download produces a trailer, and nobody was anticipating your whitepaper. Give the finding away and gate the depth.",
      },
    ],
    distributionPlan: [
      {
        channel: "site",
        title: "Whitepaper to Video for Demand Generation",
        angle: "Targets B2B marketing teams with existing gated libraries.",
      },
      {
        channel: "medium",
        title: "Ungate the argument, gate the artefact",
        angle: "Contrarian framing for a demand-gen audience.",
      },
    ],
  },
  {
    slug: "annual-report-to-video-for-stakeholders",
    title: "Annual Report to Video: What Stakeholders Actually Watch",
    description:
      "A hundred-page annual report becomes a six-minute video only if you know which six numbers matter. How to choose them.",
    category: "Document Types",
    publishedAt: "2026-04-13",
    readTime: "8 min read",
    heroEyebrow: "Finance",
    heroTitle: "Annual report to video for stakeholders",
    heroDescription:
      "Everyone receives the annual report. Almost nobody reads past the highlights page — which tells you exactly what the video should be.",
    primaryKeyword: "annual report video",
    keywordVariant: "financial report to video",
    relatedPaths: [
      "/for-finance-publishers",
      "/pdf-to-video",
      "/tools/pdf-to-slideshow",
      "/blogs/investor-deck-to-video-for-the-meetings-you-did-not-get",
    ],
    sections: [
      {
        heading: "Start from what the highlights page already tells you",
        paragraphs: [
          "Every annual report has a highlights page, and it exists because the organisation already worked out that nobody reads the rest. That page is the closest thing to a pre-approved video brief you will get, and it is usually four to six numbers with a sentence each.",
          "Start there rather than from the chair's statement. The chair's statement is written to be read once and filed; the highlights are written to be remembered.",
        ],
      },
      {
        heading: "Numbers have to be seen, not just said",
        paragraphs: [
          "This is the specific thing that makes financial documents different. A spoken figure does not stick — a listener will not retain 'revenue up 14 per cent to 312 million against a 4 per cent sector average' from audio alone.",
          "So every number in the narration needs to be on screen while it is said, large, with its comparison next to it. One number per frame. A frame with four figures is a table, and a table on a phone is a grey rectangle.",
        ],
        bullets: [
          "One headline figure per scene, at a size readable on a phone.",
          "Show the comparison — prior year, target, or sector — beside it.",
          "Never a full financial table on screen.",
          "Let the narration explain why the number moved, not restate it.",
        ],
      },
      {
        heading: "The compliance constraint is real",
        paragraphs: [
          "For a listed company, the annual report is a regulated disclosure and the video derived from it inherits that. Forward-looking statements need their disclaimer, figures must match the audited numbers exactly, and a rounded figure in narration that differs from the statement is a problem.",
          "Practically, this means the narration script goes through the same review as the report text, and it means a rendered pipeline is worth more here than a recording: when review comes back with a change, you edit a line and regenerate rather than re-booking the studio.",
        ],
      },
      {
        heading: "Two videos, not one",
        paragraphs: [
          "Stakeholder groups want different things and one video serves neither well. The version for employees is about what the year meant and what happens next. The version for investors and analysts is about the numbers and the guidance.",
          "The same source document produces both, with different cuts. This is cheap when the pipeline is generative and expensive when it is a recorded presentation, which is why most organisations make one video and it is nobody's.",
        ],
      },
      {
        heading: "Where it goes",
        paragraphs: [
          "Investor relations page, above the PDF download. Internal channels for the employee cut. LinkedIn for a ninety-second version of the three headline figures, which reliably outperforms the post that just links the report.",
          "Keep the PDF prominent throughout. The video's job is not to replace the report — it is to make sure the four numbers that matter reach everyone who was sent it.",
        ],
        ctaPath: "/for-finance-publishers",
        ctaLabel: "The finance publishing workflow",
      },
    ],
    faq: [
      {
        question: "How long should an annual report video be?",
        answer:
          "Five to seven minutes for the main version, ninety seconds for the social cut. Longer than that and completion falls off well before the outlook section, which is the part you most want watched.",
      },
      {
        question: "Do figures in the video need the same review as the report?",
        answer:
          "For a regulated filing, yes. The narration script should go through the same approval, and rounding in narration must match the statements.",
      },
      {
        question: "Should the CEO appear on camera?",
        answer:
          "It helps for the employee version, where the person is part of the message. For the numbers-focused investor version, on-screen figures with clear narration outperform a talking head.",
      },
    ],
    distributionPlan: [
      {
        channel: "site",
        title: "Annual Report to Video for Stakeholders",
        angle: "Seasonal high-intent traffic around reporting cycles.",
      },
      {
        channel: "video",
        title: "One number per frame",
        angle: "Show a financial table versus the same data as six frames.",
      },
    ],
  },
  {
    slug: "technical-documentation-to-video-without-a-screen-recording",
    title: "Technical Documentation to Video Without Recording Your Screen",
    description:
      "Docs videos rot because they are recordings of a UI that changed. How to build ones you can regenerate when the docs update.",
    category: "Document Types",
    publishedAt: "2026-04-06",
    readTime: "8 min read",
    heroEyebrow: "Technical",
    heroTitle: "Technical documentation to video, without a screen recording",
    heroDescription:
      "Every docs team has a video showing a UI from two redesigns ago. The fix is making the video a build artefact rather than a recording.",
    primaryKeyword: "documentation to video",
    keywordVariant: "technical docs video",
    relatedPaths: [
      "/for-technical-writers",
      "/code-snippet-to-video",
      "/docx-to-video",
      "/blogs/the-document-to-video-pipeline-end-to-end",
    ],
    sections: [
      {
        heading: "Why docs videos rot faster than docs",
        paragraphs: [
          "Documentation is maintained because editing a page is cheap. A video of the same content is not maintained, because editing it means re-recording — so the docs stay current and the video drifts until someone notices it shows a button that no longer exists.",
          "The result is worse than having no video: a stale walkthrough actively misleads, and users trust it because it is official.",
        ],
      },
      {
        heading: "Make the video a build artefact",
        paragraphs: [
          "The way out is to stop treating the video as a recording and start treating it as something generated from the docs, the same way the docs site is generated from Markdown.",
          "When a page changes, the video for that page regenerates. Nobody re-records, nobody schedules studio time, and the video cannot drift further than the last build. This is the whole argument, and it is why a synthesised narration track is worth more here than a human one — a human voice makes the artefact unregenerable.",
        ],
        bullets: [
          "Source of truth stays the docs page, not a script file.",
          "Narration is synthesised, so regeneration is free.",
          "Version the video alongside the docs version.",
          "Regenerate on release, not on request.",
        ],
      },
      {
        heading: "Code on screen: the specific problem",
        paragraphs: [
          "Technical content has a constraint most document types do not. A code block that fits comfortably in a docs page is unreadable as video, because docs are read at arm's length on a wide screen and video is watched on a phone.",
          "The working limits are roughly twelve lines and sixty characters. Past that, either split the block across scenes or show only the lines that changed with the surrounding context dimmed. Never shrink the font to fit — an illegible code block is worse than a described one.",
        ],
      },
      {
        heading: "What documentation video is good for",
        paragraphs: [
          "Not reference material. Nobody watches a video to look up a parameter, and turning your API reference into video is a waste of both formats.",
          "It works for the conceptual pages — the architecture overview, the 'how this fits together', the getting-started narrative. These are the pages people read once, are the hardest to write, and are where a five-minute explanation genuinely beats a page of prose.",
        ],
      },
      {
        heading: "The interactive exception",
        paragraphs: [
          "Where the thing being explained is genuinely interactive — a debugger session, a dashboard, a multi-step console flow — record it. A generated video cannot show a UI responding, and pretending otherwise produces a worse artefact than a slightly stale recording.",
          "The hybrid most docs teams land on: generate the conceptual sections from the docs, record the interactive ones, and accept that the recorded parts need a maintenance calendar.",
        ],
        ctaPath: "/for-technical-writers",
        ctaLabel: "The technical writing workflow",
      },
    ],
    faq: [
      {
        question: "Which docs pages are worth turning into video?",
        answer:
          "Conceptual and getting-started pages. Reference material is not — people arrive at a reference page looking for one parameter, and video is the worst possible format for lookup.",
      },
      {
        question: "How much code can be on screen at once?",
        answer:
          "About twelve lines at sixty characters, readable on a phone. Beyond that, split across scenes or highlight only the changed lines.",
      },
      {
        question: "Should documentation videos be versioned?",
        answer:
          "Yes, alongside the docs version they were generated from. A user on v2 following a v3 video is the failure this whole approach exists to prevent.",
      },
    ],
    distributionPlan: [
      {
        channel: "site",
        title: "Technical Documentation to Video Without a Screen Recording",
        angle: "Targets docs and developer-experience teams; the build-artefact framing is the hook.",
      },
      {
        channel: "substack",
        title: "Your docs video is a build artefact",
        angle: "Engineering-culture framing for a developer newsletter.",
      },
    ],
  },
  {
    slug: "case-study-to-video-that-a-buyer-will-finish",
    title: "Case Study to Video That a Buyer Will Actually Finish",
    description:
      "Written case studies bury the result under context. Video punishes that harder than prose does. How to restructure.",
    category: "Document Types",
    publishedAt: "2026-03-30",
    readTime: "7 min read",
    heroEyebrow: "Sales",
    heroTitle: "Case study to video that a buyer will finish",
    heroDescription:
      "The written format opens with company background. In video, that is the twenty seconds where you lose them.",
    primaryKeyword: "case study video",
    keywordVariant: "customer story to video",
    relatedPaths: [
      "/pdf-to-video",
      "/tools/pdf-to-video-script-generator",
      "/article-to-linkedin-video",
      "/blogs/whitepaper-to-video-for-demand-generation",
    ],
    sections: [
      {
        heading: "The structure that has to be inverted",
        paragraphs: [
          "Written case studies follow a convention: company background, the challenge, the solution, the results, a quote. It works in print because a skimmer jumps to the results box.",
          "Video has no results box. A viewer given ninety seconds of company background before any outcome leaves, and they leave in the first fifteen seconds, which is before you have said anything worth staying for.",
          "So invert it. Open on the result. 'They cut onboarding from six weeks to nine days' is a first line. 'Acme is a mid-market logistics provider founded in 2011' is not.",
        ],
        bullets: [
          "0–8s: the outcome, as a number.",
          "8–30s: what the situation was before, briefly.",
          "30–70s: what specifically changed.",
          "70–90s: the customer's own words, and where to go next.",
        ],
      },
      {
        heading: "The numbers are the whole asset",
        paragraphs: [
          "A case study without a quantified outcome is a testimonial, and testimonials do not need video. If the study has a real number, that number is the video — on screen, large, for longer than feels comfortable.",
          "Show the before and after together. '6 weeks → 9 days' as a single frame does more work than any amount of narration about efficiency improvements.",
        ],
      },
      {
        heading: "Using the customer quote",
        paragraphs: [
          "The quote in a written case study is usually a sentence of polished praise. Read aloud by a synthesised narrator, polished praise sounds exactly like marketing copy, because it is.",
          "Two options that work. Show it as on-screen text with attribution and let the viewer read it in the customer's register rather than a narrator's. Or, if the customer will record thirty seconds on a phone, use that — imperfect audio from a real person outperforms a perfect read of their written quote.",
        ],
      },
      {
        heading: "Length and placement",
        paragraphs: [
          "Ninety seconds for the version that goes in a feed or a sales email. Three to four minutes for the version on the case study page itself, where the visitor arrived deliberately and will watch more.",
          "In a sales sequence, the ninety-second version does the work. Sales emails containing a short, specific, outcome-first video get replies at a noticeably better rate than the same email linking a PDF — mostly because the recipient can evaluate it without committing to a download.",
        ],
        ctaPath: "/tools/pdf-to-video-script-generator",
        ctaLabel: "Script your case study",
      },
    ],
    faq: [
      {
        question: "How long should a case study video be?",
        answer:
          "Ninety seconds for outbound and feeds; three to four minutes on the case study page. The long version exists for people already evaluating you.",
      },
      {
        question: "Do I need the customer on camera?",
        answer:
          "No, and waiting for it is why most case study videos never ship. On-screen quotes with attribution work. If the customer will record thirty seconds on a phone, that is a bonus, not a prerequisite.",
      },
      {
        question: "What if the case study has no hard numbers?",
        answer:
          "Then it is a testimonial and video adds little. Go back to the customer for one quantified outcome before producing anything.",
      },
    ],
    distributionPlan: [
      {
        channel: "site",
        title: "Case Study to Video That a Buyer Will Finish",
        angle: "Sales-enablement angle; the timing breakdown is the shareable part.",
      },
      {
        channel: "twitter",
        title: "Open on the number",
        angle: "Two opening lines side by side — background versus outcome.",
      },
    ],
  },
  {
    slug: "ebook-to-video-series",
    title: "Ebook to Video Series: One Chapter Is Not One Video",
    description:
      "The obvious mapping produces uneven, unwatchable episodes. How to episode an ebook by argument rather than by chapter.",
    category: "Document Types",
    publishedAt: "2026-03-23",
    readTime: "7 min read",
    heroEyebrow: "Long Form",
    heroTitle: "Ebook to video series",
    heroDescription:
      "Chapters are a print convention. Episodes are a viewing one, and mapping them one to one is why most book-derived series die at episode three.",
    primaryKeyword: "ebook to video",
    keywordVariant: "book to video series",
    relatedPaths: [
      "/pdf-to-course-video",
      "/for-educators",
      "/pdf-to-video",
      "/blogs/how-long-should-a-document-video-be",
    ],
    sections: [
      {
        heading: "Why chapter-per-episode fails",
        paragraphs: [
          "Chapters vary wildly in length — a book with a four-page chapter two and a thirty-page chapter three produces a three-minute episode followed by a twenty-two-minute one. Viewers read that inconsistency as a quality problem even when the content is good.",
          "Chapters also frequently split a single argument across two of them, or bundle three unrelated ones into a single chapter, because print pacing has different constraints. Following that structure means episodes that end mid-thought.",
        ],
      },
      {
        heading: "Episode by argument instead",
        paragraphs: [
          "Go through the book and list every distinct claim it makes — usually somewhere between eight and twenty for a business or non-fiction book. Each of those is a candidate episode, regardless of which chapter it lives in.",
          "Then merge the thin ones and split the fat ones until every episode is six to ten minutes. The result no longer matches the table of contents, and that is correct: the table of contents was designed for a reader who can flip back.",
        ],
        bullets: [
          "List every distinct claim, ignoring chapter boundaries.",
          "Target six to ten minutes per episode.",
          "Each episode must resolve one claim completely.",
          "Merge thin claims, split multi-claim chapters.",
        ],
      },
      {
        heading: "Every episode has to stand alone",
        paragraphs: [
          "A reader starts a book at the beginning. A viewer arrives at episode seven from a recommendation and has no idea what episodes one to six said.",
          "So each episode opens with fifteen seconds of context — what this is part of, and the one thing you need to know from earlier — and closes by resolving its own claim rather than teasing the next. Cliffhangers work for narrative and fail for explanatory content, where the viewer simply leaves.",
        ],
      },
      {
        heading: "Publishing cadence",
        paragraphs: [
          "Weekly beats a single dump. A twelve-episode series released at once is a library nobody starts; released weekly it is a reason to return, and each episode gets its own moment in a feed.",
          "Produce them in a batch and schedule them out. The production efficiency of batching and the distribution advantage of a cadence are not in conflict — only the publishing date differs.",
        ],
      },
      {
        heading: "What the series is for",
        paragraphs: [
          "Be clear about this before starting. If the series is meant to sell the book, each episode should resolve its claim and make the reader want the depth — which means giving away the conclusions and keeping the evidence and examples in the book.",
          "If the series is the product, it needs the evidence too, and it needs to be substantially longer. Trying to do both produces something that half-explains everything and sells nothing.",
        ],
        ctaPath: "/pdf-to-course-video",
        ctaLabel: "The course video workflow",
      },
    ],
    faq: [
      {
        question: "How many episodes should an ebook become?",
        answer:
          "Eight to twenty for a typical non-fiction book, driven by how many distinct claims it makes rather than how many chapters it has.",
      },
      {
        question: "Should episodes follow the book's order?",
        answer:
          "Usually yes, since the argument builds. But move a strong standalone claim to episode one — the first episode gets the most views and should be the best hook, not the introduction.",
      },
      {
        question: "Will a video series cannibalise book sales?",
        answer:
          "Not if the episodes give conclusions and the book keeps the evidence, examples, and detail. The series is discovery; the book is depth.",
      },
    ],
    distributionPlan: [
      {
        channel: "site",
        title: "Ebook to Video Series",
        angle: "Targets authors and publishers; the argument-mapping method is the takeaway.",
      },
      {
        channel: "medium",
        title: "Chapters are not episodes",
        angle: "Craft essay for a writing audience.",
      },
    ],
  },
  {
    slug: "lecture-notes-to-video-for-students-who-skip-lectures",
    title: "Lecture Notes to Video for the Students Who Skip the Lecture",
    description:
      "Recording the lecture reproduces the thing they already skipped. What a generated version does differently, and where it helps most.",
    category: "Document Types",
    publishedAt: "2026-03-16",
    readTime: "7 min read",
    heroEyebrow: "Education",
    heroTitle: "Lecture notes to video",
    heroDescription:
      "A recorded lecture is fifty minutes of a room. A generated one is eight minutes of the argument, at whatever speed the student needs.",
    primaryKeyword: "lecture notes to video",
    keywordVariant: "turn lecture slides into video",
    relatedPaths: [
      "/for-educators",
      "/for-educators/pptx-to-video",
      "/pdf-to-course-video",
      "/blogs/ebook-to-video-series",
    ],
    sections: [
      {
        heading: "Recording the lecture is not the same thing",
        paragraphs: [
          "Most institutions already record lectures, and the recordings are watched much less than the effort implies. They are fifty minutes long, include the room, the questions, the technical fault at minute nine, and the pacing of a live delivery that could not be adjusted for the person watching.",
          "A video generated from the notes is a different artefact: eight minutes covering the same material, structured for someone who is revising rather than attending, watchable at 1.5× the night before a deadline.",
        ],
      },
      {
        heading: "Structure for revision, not for teaching",
        paragraphs: [
          "A lecture builds understanding from nothing, which is why it takes fifty minutes. A revision video assumes the student was introduced to the material once already and needs it consolidated, which is a much shorter job.",
          "That means leading with the definition or result, then the worked example, then the common mistake. The motivating story that opens a good lecture belongs in the lecture; in a revision video it is the part students skip past.",
        ],
        bullets: [
          "Definition or result first.",
          "One worked example, fully.",
          "The mistake students actually make.",
          "No motivating anecdote — that was the lecture's job.",
        ],
      },
      {
        heading: "One concept per video",
        paragraphs: [
          "The strongest argument for generating rather than recording is granularity. A student stuck on one idea can watch the four-minute video about that idea, rather than scrubbing a fifty-minute recording for the eight minutes that address it.",
          "This is also why a set of short videos outperforms one long one even at identical total runtime: the short ones get watched, because finding the relevant one is possible.",
        ],
      },
      {
        heading: "Captions are not optional here",
        paragraphs: [
          "In an educational setting, captions are frequently a legal requirement, and beyond compliance they are what makes technical terminology usable — a student who has only ever read a term needs to see it spelled while hearing it.",
          "A generated pipeline gives you caption files as a by-product, since the script existed before the audio. A recorded lecture requires a transcription pass, which is the step that usually does not happen.",
        ],
      },
      {
        heading: "Updating between terms",
        paragraphs: [
          "Course content changes every year — a new example, a corrected slide, an updated dataset. Re-recording is why last year's video is still up with the old figures in it.",
          "Regenerating from the notes takes minutes, which is the difference between a video library that stays current and one that quietly becomes a liability.",
        ],
        ctaPath: "/for-educators",
        ctaLabel: "The educator workflow",
      },
    ],
    faq: [
      {
        question: "How long should a lecture-derived video be?",
        answer:
          "Six to ten minutes per concept. A fifty-minute lecture typically becomes four to six focused videos rather than one long one.",
      },
      {
        question: "Do these replace lecture recordings?",
        answer:
          "No — they serve a different purpose. Recordings are for students who missed the session; generated videos are for revision, and the two get used at different points in the term.",
      },
      {
        question: "Is a synthesised voice acceptable for teaching material?",
        answer:
          "Students report caring far more about clarity, pacing, and captions than about whether the voice is human. The advantage is that you can regenerate when the content changes.",
      },
    ],
    distributionPlan: [
      {
        channel: "site",
        title: "Lecture Notes to Video",
        angle: "Education segment; strong seasonality around term start and exam periods.",
      },
      {
        channel: "video",
        title: "Fifty minutes versus five",
        angle: "Same concept as lecture recording excerpt and generated revision clip.",
      },
    ],
  },
  {
    slug: "investor-deck-to-video-for-the-meetings-you-did-not-get",
    title: "Investor Deck to Video for the Meetings You Did Not Get",
    description:
      "A deck forwarded without you is a deck read wrong. What a narrated version fixes, and the parts you should never put in one.",
    category: "Document Types",
    publishedAt: "2026-03-09",
    readTime: "7 min read",
    heroEyebrow: "Fundraising",
    heroTitle: "Investor deck to video",
    heroDescription:
      "Your deck gets forwarded to people you will never speak to. The narrated version is the only way you are in the room for that conversation.",
    primaryKeyword: "investor deck video",
    keywordVariant: "pitch deck to video",
    relatedPaths: [
      "/pptx-to-video",
      "/tools/pdf-to-slideshow",
      "/pdf-to-video",
      "/blogs/annual-report-to-video-for-stakeholders",
    ],
    sections: [
      {
        heading: "The forwarding problem",
        paragraphs: [
          "A pitch deck is built for a room. Every slide is a prompt for something you say, which is why a good deck is sparse — the words are yours, not the slide's.",
          "Then the deck gets forwarded. To a partner who was not in the meeting, to an associate doing diligence, to someone's contact who might be interested. At every hop the slides travel and the explanation does not, and the sparse deck that worked beautifully in person becomes twelve slides of unexplained assertions.",
        ],
      },
      {
        heading: "What the narrated version fixes",
        paragraphs: [
          "A five-minute narrated walkthrough travels with the deck and says the things you would have said. The recipient hears the reasoning behind the market sizing rather than inferring it from a number, and hears why the go-to-market sequence is that order.",
          "It also compresses well: someone deciding whether to take the meeting will watch five minutes and will not read twelve slides carefully. The video is the artefact that survives being triaged.",
        ],
      },
      {
        heading: "What not to put in it",
        paragraphs: [
          "The video is a wider-circulation artefact than the deck by construction, and you should assume it will be seen by people you did not send it to — including competitors. That changes what belongs in it.",
        ],
        bullets: [
          "Detailed financial projections — signal the shape, keep the model for the data room.",
          "Named customers who have not agreed to be named publicly.",
          "Cap table and specific terms.",
          "Anything under an NDA you have not checked.",
        ],
      },
      {
        heading: "Structure",
        paragraphs: [
          "The deck's order usually works, with one change: lead with the traction slide if you have traction. The problem-solution opening is convention, and convention is exactly what a triaging investor pattern-matches past.",
          "Keep it to five minutes. Ten minutes signals that the story needs ten minutes, which is itself a signal. If you cannot do it in five, the pitch is not tight enough yet, and finding that out from a script is cheaper than finding it out in a meeting.",
        ],
      },
      {
        heading: "Whose voice",
        paragraphs: [
          "For a fundraise, a founder's own voice is worth the extra effort — investors are partly evaluating you, and a synthesised narrator removes the thing they are assessing.",
          "Record the narration against a rendered visual track rather than screen-recording the deck. Your voice stays, the visuals stay editable, and when the traction number changes next month you re-record one line instead of the whole thing.",
        ],
        ctaPath: "/tools/pdf-to-slideshow",
        ctaLabel: "Storyboard the deck",
      },
    ],
    faq: [
      {
        question: "Should I send a video instead of a deck?",
        answer:
          "Send both. The video gets watched first and decides whether the deck gets opened; the deck is what gets forwarded into diligence.",
      },
      {
        question: "How long should a pitch video be?",
        answer:
          "Five minutes. Investors triage aggressively, and a pitch that needs ten minutes reads as a pitch that is not yet clear.",
      },
      {
        question: "Is it risky to put a pitch in a video?",
        answer:
          "It circulates more widely than a deck, so treat it as semi-public. Keep projections, named customers, and terms out of it.",
      },
    ],
    distributionPlan: [
      {
        channel: "site",
        title: "Investor Deck to Video",
        angle: "High-intent founder audience; the what-not-to-include list is the differentiator.",
      },
      {
        channel: "twitter",
        title: "Your deck gets forwarded without you",
        angle: "Short post on the explanation-loss problem.",
      },
    ],
  },
];
