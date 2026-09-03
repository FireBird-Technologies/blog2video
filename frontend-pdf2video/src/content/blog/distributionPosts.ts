import type { BlogPost } from "../seoTypes";

/**
 * Cluster D — craft and distribution.
 *
 * These are the posts that earn links rather than clicks. They target
 * how-to-do-it-well queries from people who have already decided to make the
 * video, which makes them the natural interior of the internal-link graph: the
 * converter posts route here, and these route to the tools.
 */
export const distributionPosts: BlogPost[] = [
  {
    slug: "what-goes-on-the-slide-and-what-goes-in-the-voiceover",
    title: "What Goes on the Slide and What Goes in the Voiceover",
    description:
      "Putting the same words in both channels is the most common mistake in document video. The split that actually works.",
    category: "Craft",
    heroImage: "/blog/blog-cover-what-goes-on-the-slide-and-what-goes-in-the-voiceover.png",
    heroImageAlt:
      "Putting the same words in both channels is the most common mistake in document video. The split that actually works.",
    publishedAt: "2026-03-02",
    readTime: "7 min read",
    heroEyebrow: "Craft",
    heroTitle: "What goes on the slide, and what goes in the voiceover",
    heroDescription:
      "Viewers read at 240 words a minute and listen at 150. Put the same text in both places and they finish reading first, then leave.",
    primaryKeyword: "slide text vs narration",
    keywordVariant: "what to put on a video slide",
    relatedPaths: [
      "/tools/pdf-to-slideshow",
      "/tools/pdf-to-video-script-generator",
      "/blogs/turn-a-pdf-into-a-video-slideshow",
      "/blogs/writing-narration-from-written-prose",
    ],
    sections: [
      {
        heading: "The arithmetic behind the rule",
        paragraphs: [
          "Silent reading runs at roughly 240 words per minute. Narration runs at 150. Put a forty-word paragraph on screen and read it aloud, and the viewer finishes it in ten seconds while the narrator takes sixteen. For six seconds they have nothing to do, and this repeats on every slide.",
          "That dead time is what makes auto-generated slideshows feel lifeless. It is not the template or the voice — it is that one of the two channels is always idle.",
        ],
      },
      {
        heading: "The split that works",
        paragraphs: [
          "Give each channel a different job. The screen holds the claim: short, declarative, scannable. The narration holds the reasoning: the why, the caveat, the example.",
          "The viewer reads the claim in two seconds, then spends the remaining twelve listening to why it is true while the claim stays visible as an anchor. Both channels are working, and neither is repeating the other.",
        ],
        bullets: [
          "On screen: the claim. Under fifteen words per line, two or three lines maximum.",
          "In narration: the reasoning, the evidence, the qualification.",
          "Overlap: only the key term or the number, deliberately repeated for retention.",
          "Never: the same sentence in both.",
        ],
      },
      {
        heading: "The exceptions",
        paragraphs: [
          "Numbers should appear in both. A spoken figure does not stick, so saying 'thirty-four per cent' while '34%' is on screen is reinforcement rather than redundancy.",
          "Technical terms and proper nouns too. A viewer who has only read a term needs to see the spelling while hearing the pronunciation, and vice versa.",
          "Direct quotations should be on screen and not narrated, or narrated and not on screen — reading a quote aloud while it is displayed is the standard redundancy again, and quotes are long enough for it to hurt.",
        ],
      },
      {
        heading: "How this changes what you write",
        paragraphs: [
          "It means you are writing two things from one source, not adapting one thing. Take a section of your document and produce a three-word headline, two condensed lines, and a full narration paragraph. They come from the same prose and none of them is the prose.",
          "The mechanical part of this — finding the strongest sentences for the on-screen lines while keeping the full text as narration — is what our storyboard tool does, and seeing the split laid out per slide is usually more convincing than the argument for it.",
        ],
        ctaPath: "/tools/pdf-to-slideshow",
        ctaLabel: "See the split on your own document",
      },
      {
        heading: "Testing it",
        paragraphs: [
          "Watch your video on mute. If it still makes sense, you have put too much on screen and the narration is decorative. Then listen with your eyes closed. If that also makes complete sense, the screen is decorative.",
          "A well-split video fails both tests slightly, and that is the point: each channel needs the other.",
        ],
      },
    ],
    faq: [
      {
        question: "How many words should be on a video slide?",
        answer:
          "A headline plus two or three lines under about fifteen words each. Around forty words total is the ceiling for something read comfortably on a phone.",
      },
      {
        question: "Should captions count as on-screen text?",
        answer:
          "They are a separate layer and do duplicate the narration by design, for accessibility and mute viewing. Keep them visually distinct from your content text so they read as captions.",
      },
      {
        question: "What if my content is genuinely text-heavy?",
        answer:
          "Then it needs more slides, not fuller ones. A dense section becomes four scenes with one claim each rather than one scene with a paragraph.",
      },
    ],
    distributionPlan: [
      {
        channel: "site",
        title: "What Goes on the Slide and What Goes in the Voiceover",
        angle: "Craft post that earns links from production and presentation round-ups.",
      },
      {
        channel: "video",
        title: "The mute test",
        angle: "Play a badly split video on mute, then a well-split one. Self-demonstrating.",
      },
    ],
  },
  {
    slug: "writing-narration-from-written-prose",
    title: "Writing Narration From Written Prose: Six Rewrites That Always Apply",
    description:
      "Written and spoken English are different registers. Six mechanical transformations that make document prose speakable.",
    category: "Craft",
    heroImage: "/blog/blog-cover-writing-narration-from-written-prose.png",
    heroImageAlt:
      "Written and spoken English are different registers. Six mechanical transformations that make document prose speakable.",
    publishedAt: "2026-02-23",
    readTime: "7 min read",
    heroEyebrow: "Craft",
    heroTitle: "Writing narration from written prose",
    heroDescription:
      "Your document reads well. Read aloud, it will not work, and the reasons are specific and fixable.",
    primaryKeyword: "write narration from document",
    keywordVariant: "voiceover script from written text",
    relatedPaths: [
      "/tools/pdf-to-video-script-generator",
      "/tools/pdf-to-audio",
      "/blogs/what-goes-on-the-slide-and-what-goes-in-the-voiceover",
      "/blogs/pdf-to-video-ai-what-it-does-and-what-it-fakes",
    ],
    sections: [
      {
        heading: "1. Break the subordinate clauses",
        paragraphs: [
          "A sentence with two subordinate clauses is fine on a page, because a reader can hold the structure visually and re-read the opening if the ending surprises them. A listener cannot. By the time the main verb arrives they have lost the subject.",
          "Split at every clause boundary. Three short sentences beat one correct long one, every time, in narration.",
        ],
      },
      {
        heading: "2. Kill the passive voice",
        paragraphs: [
          "'It was determined that the intervention produced no measurable effect' is standard academic register and unlistenable. 'We found no measurable effect' is the same claim, spoken.",
          "Passive constructions hide the actor, and a listener trying to work out who did what has stopped following the argument.",
        ],
      },
      {
        heading: "3. Replace every reference to the document",
        paragraphs: [
          "Written prose is full of navigation: 'as noted above', 'see Section 4', 'the following table', 'the aforementioned constraint'. None of these mean anything in a linear medium — there is no above, and the listener cannot see Section 4.",
          "Replace with a restatement. 'As noted above' becomes 'we said earlier that...' with the actual content repeated, because the listener probably does not remember it.",
        ],
        bullets: [
          "'See Figure 3' → 'this chart shows...' with the chart on screen.",
          "'As discussed in Section 2' → restate the point in one clause.",
          "'The following' → 'here is' or just say the thing.",
          "'The aforementioned' → name it again.",
        ],
      },
      {
        heading: "4. Unpack the acronyms, once",
        paragraphs: [
          "A reader who forgets an acronym scans back to the definition. A listener cannot, so an acronym introduced at minute one and used at minute six is noise.",
          "Expand on first use in narration, then use the acronym only if it appears frequently after that. If it appears three times across ten minutes, say the full term every time — the redundancy costs four seconds and saves comprehension.",
        ],
      },
      {
        heading: "5. Say the numbers the way a person says them",
        paragraphs: [
          "'A 34.7% increase' reads fine. Spoken, 'thirty-four point seven per cent' is precision nobody retains. Say 'about thirty-five per cent' in narration and put 34.7% on screen, where the precision belongs.",
          "The exception is regulated content, where the exact figure has to be spoken. There, slow down and let it sit — a precise number needs a beat either side of it.",
        ],
      },
      {
        heading: "6. Add the signposts back",
        paragraphs: [
          "Written documents signpost visually with headings, whitespace, and numbering. Strip those and the listener has no idea where they are in the argument.",
          "Put the signposts into the narration: 'there are three reasons for this — here is the first', 'that is the finding; now what it means for practice'. These feel clumsy on a page and are essential in audio.",
        ],
        ctaPath: "/tools/pdf-to-video-script-generator",
        ctaLabel: "Generate a draft script",
      },
      {
        heading: "The test that catches everything else",
        paragraphs: [
          "Read the script aloud, all of it, at pace. Every place you stumble, run out of breath, or have to re-read a clause is a place the narrator will too, and a place the listener will lose the thread.",
          "This takes as long as the video runtime and catches more than any checklist. It is also the step that most reliably gets skipped.",
        ],
      },
    ],
    faq: [
      {
        question: "Can AI do this rewrite reliably?",
        answer:
          "The mechanical parts, yes — clause splitting, passive voice, document references. What it also does is drop qualifiers and firm up hedged claims, so the output needs reading against the source.",
      },
      {
        question: "How much longer does narration get after rewriting?",
        answer:
          "Usually ten to twenty per cent, because splitting clauses and restating references adds words. Budget for it when estimating runtime.",
      },
      {
        question: "Should I write the script or edit an extracted one?",
        answer:
          "Edit an extracted one. Starting from your document's own sentences keeps the claims accurate; starting from a blank page invites you to restate things slightly wrong.",
      },
    ],
    distributionPlan: [
      {
        channel: "site",
        title: "Writing Narration From Written Prose",
        angle: "Practical craft reference; highly linkable from writing and podcasting communities.",
      },
      {
        channel: "substack",
        title: "Six rewrites that make prose speakable",
        angle: "Direct republication for a writing-craft newsletter.",
      },
    ],
  },
  {
    slug: "pdf-to-youtube-the-upload-checklist",
    title: "PDF to YouTube: The Upload Checklist Nobody Does",
    description:
      "The render is the easy part. Twelve things to get right on the upload, in the order they affect whether the video is found.",
    category: "Distribution",
    heroImage: "/blog/blog-cover-pdf-to-youtube-the-upload-checklist.png",
    heroImageAlt:
      "The render is the easy part. Twelve things to get right on the upload, in the order they affect whether the video is found.",
    publishedAt: "2026-02-16",
    readTime: "8 min read",
    heroEyebrow: "Distribution",
    heroTitle: "PDF to YouTube: the upload checklist",
    heroDescription:
      "A document video uploaded with a default title and no description is a file on a server. Twelve steps, in priority order.",
    primaryKeyword: "pdf to youtube video",
    keywordVariant: "upload document video to youtube",
    relatedPaths: [
      "/pdf-to-youtube-video",
      "/youtube-seo-checklist",
      "/video-seo-checklist",
      "/blogs/document-video-seo-what-actually-gets-indexed",
    ],
    sections: [
      {
        heading: "Before you upload",
        paragraphs: [
          "Two decisions matter more than everything on the upload page, and both are made earlier.",
        ],
        bullets: [
          "The first eight seconds. Document videos overwhelmingly open with a title card and a preamble, which is exactly when viewers leave. Open on the finding.",
          "The thumbnail. Text-heavy document content needs a thumbnail carrying one number or one claim in a font readable at 120 pixels wide. A frame from the video is not a thumbnail.",
        ],
      },
      {
        heading: "The title",
        paragraphs: [
          "Not the document's title. A report called 'Q3 Sector Analysis: Logistics and Warehousing' is a filename; 'Warehouse costs rose 14% — here is what changed' is a title someone clicks.",
          "Front-load the specific thing. YouTube truncates at around sixty characters in most surfaces, and the truncated version is what most people read.",
        ],
      },
      {
        heading: "The description, properly",
        paragraphs: [
          "This is the most under-used field in document video. The first two lines appear above the fold and function as a second title. Everything after is indexable text that helps YouTube understand a video whose audio is your only signal.",
          "Put the link to the source PDF in the first two lines. People who want the document should not have to expand a description to find it — and that click is the whole reason for making the video, for most teams.",
        ],
        bullets: [
          "Lines 1–2: the claim, and the link to the document.",
          "Then: a 100–200 word summary of the argument, in prose.",
          "Then: chapter timestamps.",
          "Then: links to related videos and the canonical page.",
        ],
      },
      {
        heading: "Chapters",
        paragraphs: [
          "Timestamps in the description become chapter markers, and for document video they matter more than for most content: a viewer who wants your methodology section can jump to it, which converts a bounce into a partial watch.",
          "Your video was built from the document's headings, so the chapter list already exists — it is the scene list. This is a two-minute job that most uploads skip.",
        ],
      },
      {
        heading: "Captions: upload, do not auto-generate",
        paragraphs: [
          "Auto-captions mangle technical terminology, and document video is full of it. If you generated the video from a script, you have the exact text — upload it as an SRT.",
          "Uploaded captions are also indexed with more confidence than auto-generated ones, and they are what makes the video usable on mute, which is how a large share of feed viewing happens.",
        ],
      },
      {
        heading: "After upload",
        paragraphs: [
          "Embed the video on the page hosting the PDF, above the download. This does two jobs: it improves time-on-page for the document's landing page, and it gives visitors a way to evaluate the document before committing to reading it.",
          "Then link back the other way. The video description points at the document page, the document page embeds the video, and both surfaces reinforce each other.",
        ],
        ctaPath: "/youtube-seo-checklist",
        ctaLabel: "The full YouTube checklist",
      },
    ],
    faq: [
      {
        question: "Should the video title match the document title?",
        answer:
          "Almost never. Document titles are descriptive and formal; video titles need to state the specific finding. Keep the document title in the description for people searching it by name.",
      },
      {
        question: "Do chapters actually help?",
        answer:
          "For document video, yes — they let viewers jump to the section they care about, which turns bounces into partial watches. And the chapter list is already your scene list.",
      },
      {
        question: "Is it worth uploading a video that will get few views?",
        answer:
          "If it is embedded on the page it supports, yes. Many document videos earn their keep through the landing page rather than through YouTube discovery.",
      },
    ],
    distributionPlan: [
      {
        channel: "site",
        title: "PDF to YouTube: The Upload Checklist",
        angle: "Practical checklist; strong candidate for bookmarking and internal sharing.",
      },
      {
        channel: "twitter",
        title: "The description field is the most wasted space on YouTube",
        angle: "Thread on the four-part description structure.",
      },
    ],
  },
  {
    slug: "pdf-to-linkedin-video-that-survives-the-feed",
    title: "PDF to LinkedIn Video That Survives the Feed",
    description:
      "LinkedIn plays video on mute, in a small frame, to someone scrolling. Six constraints that determine whether a document video works there.",
    category: "Distribution",
    heroImage: "/blog/blog-cover-pdf-to-linkedin-video-that-survives-the-feed.png",
    heroImageAlt:
      "LinkedIn plays video on mute, in a small frame, to someone scrolling. Six constraints that determine whether a document video works there.",
    publishedAt: "2026-02-09",
    readTime: "7 min read",
    heroEyebrow: "Distribution",
    heroTitle: "PDF to LinkedIn video that survives the feed",
    heroDescription:
      "The feed is a hostile environment for document content: no sound, a small frame, and about two seconds to earn the next ten.",
    primaryKeyword: "pdf to linkedin video",
    keywordVariant: "document video for linkedin",
    relatedPaths: [
      "/article-to-linkedin-video",
      "/blog-to-linkedin-video",
      "/linkedin-carousel-generator",
      "/blogs/pdf-to-youtube-the-upload-checklist",
    ],
    sections: [
      {
        heading: "Assume no sound",
        paragraphs: [
          "LinkedIn autoplays muted. A meaningful share of views never unmute, which means for those viewers the narration does not exist and the video is a silent slideshow with captions.",
          "So the video has to work silently. Captions are not accessibility here, they are the primary channel — burned in rather than a sidecar file, positioned away from the bottom edge where the UI overlays them.",
        ],
      },
      {
        heading: "Two seconds, not eight",
        paragraphs: [
          "YouTube gives you about eight seconds before a viewer decides. A feed gives you two, because leaving costs nothing but a thumb movement.",
          "The first frame has to carry a complete claim. Not a logo, not a title card, not a fade-in — the number or the statement, legible immediately. Everything else is the second thing they see, if there is one.",
        ],
      },
      {
        heading: "Vertical or square, never landscape",
        paragraphs: [
          "Landscape video in a mobile feed occupies about a fifth of the screen. Square occupies roughly half; vertical fills it. That difference is larger than any content decision you will make.",
          "Square is the safe default for LinkedIn specifically, since it works on desktop too, where a meaningful share of LinkedIn use still happens. Vertical is better on mobile and worse on desktop.",
        ],
        bullets: [
          "Square 1:1 — the LinkedIn default.",
          "Vertical 4:5 — allowed, and the best mobile compromise.",
          "9:16 — save it for Shorts and Reels.",
          "16:9 — only if the video also lives on YouTube and you are cross-posting.",
        ],
      },
      {
        heading: "Ninety seconds",
        paragraphs: [
          "Document videos on LinkedIn should be sixty to ninety seconds carrying exactly one idea. Not a summary of the report — one finding from it.",
          "The full version lives on YouTube or your site, and the post's text links there. Trying to fit the whole document into the feed cut is how you get a video that covers everything and communicates nothing.",
        ],
      },
      {
        heading: "The post text does half the work",
        paragraphs: [
          "The video does not stand alone. The accompanying text is what appears in the feed before anyone presses play, and it is indexed, quotable, and skimmable in a way the video is not.",
          "Write the claim in the first line, before the 'see more' fold. Then the context in a short paragraph. Then the link to the document — in a comment rather than the post body if you are avoiding link suppression, though the effect of that is smaller than commonly claimed.",
        ],
        ctaPath: "/article-to-linkedin-video",
        ctaLabel: "The LinkedIn workflow",
      },
    ],
    faq: [
      {
        question: "What is the best aspect ratio for LinkedIn video?",
        answer:
          "Square 1:1 as the default, since it works on both mobile and desktop. Vertical 4:5 if your audience is overwhelmingly mobile.",
      },
      {
        question: "How long should a LinkedIn document video be?",
        answer:
          "Sixty to ninety seconds, covering one finding. Longer versions belong on YouTube with the post linking to them.",
      },
      {
        question: "Do I need burned-in captions?",
        answer:
          "Yes. LinkedIn's own caption rendering is inconsistent across surfaces, and muted autoplay means captions are doing the primary communication rather than supporting it.",
      },
    ],
    distributionPlan: [
      {
        channel: "site",
        title: "PDF to LinkedIn Video That Survives the Feed",
        angle: "Platform-specific guidance for the channel most B2B document teams care about.",
      },
      {
        channel: "twitter",
        title: "Landscape video in a mobile feed",
        angle: "Screenshot comparison of 16:9 vs 1:1 vs 4:5 at real phone size.",
      },
    ],
  },
  {
    slug: "document-video-seo-what-actually-gets-indexed",
    title: "Document Video SEO: What Search Engines Can Actually Read",
    description:
      "Search engines do not watch your video. What they index instead, and how to make sure the right text exists.",
    category: "Distribution",
    heroImage: "/blog/blog-cover-document-video-seo-what-actually-gets-indexed.png",
    heroImageAlt:
      "Search engines do not watch your video. What they index instead, and how to make sure the right text exists.",
    publishedAt: "2026-02-02",
    readTime: "8 min read",
    heroEyebrow: "SEO",
    heroTitle: "Document video SEO: what actually gets indexed",
    heroDescription:
      "The video is opaque to a crawler. Everything that makes it findable is text you have to write separately.",
    primaryKeyword: "video seo for documents",
    keywordVariant: "how video gets indexed",
    relatedPaths: [
      "/video-seo-checklist",
      "/youtube-seo-checklist",
      "/blogs/pdf-to-youtube-the-upload-checklist",
      "/measurement-playbook",
    ],
    sections: [
      {
        heading: "What a crawler sees",
        paragraphs: [
          "Not the video. A search engine indexing your page sees the page's HTML, the structured data, and — where you provided it — the transcript and caption file. The MP4 itself contributes almost nothing.",
          "This is the whole basis of video SEO and it is consistently misunderstood. Ranking is not a reward for a good video; it is a consequence of the text surrounding it being good and specific.",
        ],
        bullets: [
          "Page title and heading structure.",
          "VideoObject structured data — name, description, thumbnail, duration, upload date.",
          "The transcript, if it is on the page as text.",
          "The caption file, where the platform indexes it.",
        ],
      },
      {
        heading: "Put the transcript on the page",
        paragraphs: [
          "The single highest-return action, and the most commonly skipped. A ten-minute video is 1,500 words of specific, on-topic text. Published on the page below the player, that text is indexable, quotable, and answers long-tail queries the video's title never could.",
          "It also helps real people: a meaningful share of visitors will scan the transcript rather than watch, which is a completed visit rather than a bounce.",
          "If you generated the video from a script, this text already exists. Publishing it costs nothing.",
        ],
      },
      {
        heading: "VideoObject structured data",
        paragraphs: [
          "Structured data is how a page tells a search engine that it contains a video and what the video is. Without it, a page with an embedded player often reads as a page with an image.",
          "Include name, description, thumbnailUrl, uploadDate, duration, and contentUrl or embedUrl. The description here is a separate field from your page's meta description and should be written for it, not copied.",
        ],
      },
      {
        heading: "Do not compete with yourself",
        paragraphs: [
          "A specific and common mistake with document video: publishing the video on its own page, with a title and description almost identical to the PDF's landing page. Now two of your pages target the same query and both rank worse than one would.",
          "Embed the video on the document's existing page instead. One URL, both formats, all the signals consolidated. If the video genuinely warrants its own page — a series episode, say — make sure its title targets a different query.",
        ],
      },
      {
        heading: "The YouTube-versus-self-hosting trade",
        paragraphs: [
          "YouTube gives you discovery and costs you the page. A YouTube-hosted video embedded on your site sends engagement signals to YouTube's page, not yours, and the ranking video in search results is often YouTube's URL rather than yours.",
          "Self-hosting keeps the signals but gives up YouTube's discovery entirely. Most teams should do both — upload to YouTube for discovery and embed a self-hosted copy on the document's canonical page — accepting the small duplication cost for the coverage.",
        ],
        ctaPath: "/video-seo-checklist",
        ctaLabel: "The full checklist",
      },
    ],
    faq: [
      {
        question: "Does adding a video improve a page's ranking?",
        answer:
          "Not directly. It improves time on page and reduces bounce, which correlate with ranking. The direct gain comes from the transcript and structured data the video lets you add.",
      },
      {
        question: "Should the transcript be visible or hidden?",
        answer:
          "Visible. Hidden text is a long-standing spam signal, and visitors genuinely use transcripts — a collapsible section that is open by default is the sensible compromise.",
      },
      {
        question: "Is a YouTube embed as good as self-hosting for SEO?",
        answer:
          "For your page's ranking, self-hosting is better because the engagement signals stay with you. For total reach, YouTube wins on discovery. Doing both is usually correct.",
      },
    ],
    distributionPlan: [
      {
        channel: "site",
        title: "Document Video SEO: What Actually Gets Indexed",
        angle: "Technical SEO post; earns links from marketing and SEO communities.",
      },
      {
        channel: "medium",
        title: "Search engines do not watch your video",
        angle: "Reframe for a general marketing audience.",
      },
    ],
  },
  {
    slug: "captions-and-accessibility-for-document-video",
    title: "Captions and Accessibility for Document Video",
    description:
      "Captions, transcripts, contrast, and pacing — the requirements, why document video fails them specifically, and how to fix each.",
    category: "Craft",
    heroImage: "/blog/blog-cover-captions-and-accessibility-for-document-video.png",
    heroImageAlt:
      "Captions, transcripts, contrast, and pacing — the requirements, why document video fails them specifically, and how to fix each.",
    publishedAt: "2026-01-26",
    readTime: "7 min read",
    heroEyebrow: "Accessibility",
    heroTitle: "Captions and accessibility for document video",
    heroDescription:
      "Text-heavy video has accessibility problems that talking-head video does not, and most of them are invisible to the person who made it.",
    primaryKeyword: "video captions accessibility",
    keywordVariant: "accessible document video",
    relatedPaths: [
      "/for-educators",
      "/multilingual-video-generation",
      "/blogs/what-goes-on-the-slide-and-what-goes-in-the-voiceover",
      "/blogs/pdf-to-youtube-the-upload-checklist",
    ],
    sections: [
      {
        heading: "The problem specific to document video",
        paragraphs: [
          "A talking-head video with captions is broadly accessible: the captions carry the audio, and the visual channel is a person. Document video is different, because the visual channel carries information — a chart, a number, a diagram — that captions do not describe.",
          "So a viewer using a screen reader, or watching without being able to see the frame clearly, gets the narration and misses the evidence. This is the failure that automated accessibility checks do not catch.",
        ],
      },
      {
        heading: "Fix one: narrate the visuals",
        paragraphs: [
          "The cheapest and most effective fix. Instead of 'this chart shows the trend', say 'costs rose steadily from January, then jumped fourteen per cent in September'. The narration now contains the information the chart contains.",
          "This is better writing regardless of accessibility — a viewer looking at their phone one-handed on a train also benefits — which is why it is the fix to do first.",
        ],
      },
      {
        heading: "Fix two: captions that are actually correct",
        paragraphs: [
          "Auto-generated captions are around 90–95% accurate on clean audio and considerably worse on technical vocabulary, which is what document video is made of. A caption track that renders your product name three different ways is worse than useless for search and for readers.",
          "If the video was generated from a script, the exact text exists — upload it rather than auto-generating. That is a thirty-second step that removes the entire problem.",
        ],
        bullets: [
          "Upload a script-derived SRT rather than auto-generating.",
          "Two lines maximum, around seven words each.",
          "One second minimum per cue.",
          "Position away from the bottom edge, where platform UI overlays sit.",
        ],
      },
      {
        heading: "Fix three: contrast and type size",
        paragraphs: [
          "Document video inherits document typography, and document typography assumes a page at reading distance. WCAG AA wants 4.5:1 contrast for normal text — grey-on-white body copy from a report frequently fails, and looks fine to the person who made it because they know what it says.",
          "Type size is the related problem. Anything intended to be read on a phone needs to be roughly twice its slide size. If you cannot fit the text at that size, the frame has too much text.",
        ],
      },
      {
        heading: "Fix four: pacing",
        paragraphs: [
          "Text on screen needs to be readable at the slowest reasonable reading speed, not yours. The working rule is about 180 words per minute of on-screen text — noticeably slower than average silent reading — plus a beat before the scene changes.",
          "A frame that holds three lines therefore needs at least four or five seconds, regardless of how long the narration takes. When narration is shorter than that, extend the hold rather than cutting early.",
        ],
      },
      {
        heading: "The transcript, again",
        paragraphs: [
          "Publishing the full transcript on the page is the single accessibility measure that also does the most for SEO, and it serves people who cannot use video at all for whatever reason — bandwidth, environment, preference.",
          "If the narration describes the visuals properly, as above, the transcript is a genuinely complete alternative to the video rather than a partial one.",
        ],
        ctaPath: "/multilingual-video-generation",
        ctaLabel: "Captions in other languages",
      },
    ],
    faq: [
      {
        question: "Are captions legally required?",
        answer:
          "In many contexts yes — public sector bodies, education, and large employers in several jurisdictions. Requirements vary, but the practical answer for anything published is to caption it.",
      },
      {
        question: "Are auto-captions good enough?",
        answer:
          "Not for technical content. Accuracy drops sharply on domain vocabulary and proper nouns. If you have the script, uploading it is faster than correcting auto-captions anyway.",
      },
      {
        question: "How do I make charts accessible in video?",
        answer:
          "Narrate what the chart shows in specific terms — the direction, the magnitude, the turning point — rather than referring to it. That single change covers most of the gap.",
      },
    ],
    distributionPlan: [
      {
        channel: "site",
        title: "Captions and Accessibility for Document Video",
        angle: "Compliance-driven search intent, especially from education and public sector.",
      },
      {
        channel: "substack",
        title: "The accessibility problem checkers do not catch",
        angle: "Essay on visual-channel information loss.",
      },
    ],
  },
  {
    slug: "measuring-whether-the-video-beat-the-pdf",
    title: "Measuring Whether the Video Actually Beat the PDF",
    description:
      "Views are not the comparison. Four metrics that tell you whether the video version was worth making.",
    category: "Distribution",
    heroImage: "/blog/blog-cover-measuring-whether-the-video-beat-the-pdf.png",
    heroImageAlt:
      "Views are not the comparison. Four metrics that tell you whether the video version was worth making.",
    publishedAt: "2026-01-19",
    readTime: "7 min read",
    heroEyebrow: "Measurement",
    heroTitle: "Measuring whether the video beat the PDF",
    heroDescription:
      "A video with more views than the PDF had downloads has proved nothing. Here is the comparison that means something.",
    primaryKeyword: "measure video vs pdf performance",
    keywordVariant: "content format performance comparison",
    relatedPaths: [
      "/measurement-playbook",
      "/distribution-flywheel",
      "/blogs/document-video-seo-what-actually-gets-indexed",
      "/blogs/whitepaper-to-video-for-demand-generation",
    ],
    sections: [
      {
        heading: "Why views versus downloads is meaningless",
        paragraphs: [
          "A view on most platforms is counted after two or three seconds of autoplay. A download requires a deliberate click, and often a form. These are not comparable units, and comparing them makes video look ten times better than it is.",
          "The comparison that means something is completions: how many people consumed the whole argument, in either format.",
        ],
      },
      {
        heading: "Metric 1 — completed consumptions",
        paragraphs: [
          "For video, take views multiplied by average percentage viewed, or better, use the platform's count of viewers reaching the end. For the PDF, this is harder but not impossible: a hosted PDF viewer or a tracked download plus a scroll-depth proxy on an HTML version gets you close.",
          "The typical finding for document content is that the video's completion count exceeds the PDF's substantially, while its view count exceeds it enormously. The first number is the real one.",
        ],
      },
      {
        heading: "Metric 2 — cost per completion",
        paragraphs: [
          "Divide production time by completions. The PDF's production cost is already sunk, which is what makes the video's marginal cost the relevant figure: you are not comparing writing a report against making a video, you are comparing making a video against doing nothing more with a report you already wrote.",
          "That framing usually makes the video look good, and it is the honest framing rather than a favourable one.",
        ],
      },
      {
        heading: "Metric 3 — downstream action",
        paragraphs: [
          "Completions are engagement, not outcome. The question that decides whether to keep doing this is whether the video produced the thing the document was for — a demo request, a citation, a reply, an enrolment.",
          "Attribute carefully. The most common pattern is that the video is discovered first and the document is the conversion surface, which naive last-touch attribution reports as the document doing all the work and the video doing none.",
        ],
        bullets: [
          "Tag the link from the video description distinctly.",
          "Look at assisted conversions, not last touch.",
          "Track document downloads that originate from the video's page separately.",
        ],
      },
      {
        heading: "Metric 4 — reach among non-readers",
        paragraphs: [
          "The strategic reason for making the video is reaching people who would never have opened the PDF. That is measurable: look at the audience overlap between the video's viewers and the document's downloaders.",
          "If they are largely the same people, the video is serving your existing audience differently, which is fine but is not the argument you made for it. If the overlap is small, the video is doing the job.",
        ],
      },
      {
        heading: "What a fair test looks like",
        paragraphs: [
          "Publish both, promote both equally, and give it a quarter. Comparing a video you promoted hard against a PDF sitting on a resources page measures your promotion, not the format.",
          "And run it on more than one document. Format effects are smaller than content effects, so a single comparison mostly tells you which document was better.",
        ],
        ctaPath: "/measurement-playbook",
        ctaLabel: "The measurement playbook",
      },
    ],
    faq: [
      {
        question: "What is a good completion rate for a document video?",
        answer:
          "For a five-minute explanatory video, 40–50% average view duration is healthy. Below 25% usually means the opening is not earning the next thirty seconds.",
      },
      {
        question: "How do I measure PDF engagement at all?",
        answer:
          "Host it in a tracked viewer rather than serving a raw file, or publish an HTML version alongside and measure scroll depth on that. A raw download tells you almost nothing.",
      },
      {
        question: "How long before the comparison is meaningful?",
        answer:
          "A quarter, and across several documents. Video discovery compounds more slowly than a download campaign, so a two-week read will understate it.",
      },
    ],
    distributionPlan: [
      {
        channel: "site",
        title: "Measuring Whether the Video Beat the PDF",
        angle: "Closes the loop for teams already producing; supports renewal and expansion.",
      },
      {
        channel: "medium",
        title: "Views versus downloads is not a comparison",
        angle: "Analytics-focused piece for a marketing operations audience.",
      },
    ],
  },
  {
    slug: "the-ai-video-generators-that-are-not-slop",
    title: "The AI Video Generators That Are Not Slop (Documents Expose the Rest)",
    description:
      "A document has ground truth in it, which makes it the least forgiving input in this category. Here is the test that sorts the tools that render your file from the ones that generate around it.",
    category: "Craft",
    heroImage: "/blog/blog-cover-pdf-to-video-ai-what-it-does-and-what-it-fakes.png",
    heroImageAlt:
      "A document has ground truth in it, which makes it the least forgiving input in this category. The test that sorts the tools that render your file from the ones that generate around it.",
    publishedAt: "2026-08-19",
    readTime: "7 min read",
    heroEyebrow: "Evaluation",
    heroTitle: "Documents are where AI video slop stops being deniable",
    heroDescription:
      "With a prompt as the input there is nothing to check the output against. With a report as the input there is — every figure, every citation, every chart. That is why documents are the honest test.",
    primaryKeyword: "ai video maker",
    keywordVariant: "ai slop",
    relatedPaths: [
      "/pdf-to-video",
      "/ai-scene-editor",
      "/blogs/pdf-to-video-ai-what-it-does-and-what-it-fakes",
      "/blogs/what-goes-on-the-slide-and-what-goes-in-the-voiceover",
    ],
    sections: [
      {
        heading: "A document is the least forgiving input there is",
        paragraphs: [
          "Most complaints about AI video are aesthetic — the plastic faces, the drifting drone shot, the stock image with a slow zoom. Those are symptoms. The underlying condition is that a prompt-driven pipeline has no source of truth, so nothing it outputs can be wrong in a way anyone can point at.",
          "Feed it a document and that protection disappears. Your annual report says 14.2%. Your paper cites a specific study. Your deck has a waterfall chart with labelled segments. A viewer can open the file and check. Anything the tool invented is now falsifiable, which is exactly why documents are the input that sorts this category.",
        ],
      },
      {
        heading: "The invention test",
        paragraphs: [
          "There is one question worth asking about any tool in this space, and it is not about the model, the voice, or the export resolution. It is this: does anything appear on screen that did not come out of my file?",
          "A tool that passes shows you your chart, your number, your section heading, your diagram. A tool that fails shows you a generated approximation of a chart, or footage of a laboratory over a paragraph about clinical results, or a stylised city skyline above a supply chain figure. The second kind is not a weaker version of the first. It is a different product doing a different job, and the job is decoration.",
          "This matters more than it sounds, because decoration in a document video is not neutral. It implies evidence that does not exist. A generic laboratory shot over your results section is a visual claim you did not make and cannot support.",
        ],
        bullets: [
          "Every figure on screen should be traceable to a page in the source.",
          "Charts should be your charts, not redrawn approximations of them.",
          "Generated footage attached to a factual claim is a liability, not production value.",
          "If the tool cannot show you where an element came from, assume it came from nowhere.",
        ],
      },
      {
        heading: "Programmatic rendering is what makes passing possible",
        paragraphs: [
          "A tool can only put your chart on screen if it extracted your chart and had somewhere structured to put it. That is what programmatic video means in practice: layouts are components with defined slots, the content pulled out of your document is the data filling those slots, and the render is deterministic. Same file in, same frames out.",
          "Determinism is not a technical nicety here. It is the difference between reviewing a video and gambling on one. If you proofread a render and approve it, that approval still holds after you fix a typo and re-render, because only the changed element changes. A sampled pipeline gives you a new video every time, which means every regeneration invalidates the review you just did.",
          "It also means an error has a cause. A number in the wrong place traces back to an extraction that misread a column, and that is fixable. A number that a model simply produced traces back to nothing.",
        ],
      },
      {
        heading: "Accuracy is not the same as watchable",
        paragraphs: [
          "You can render perfectly correct information into something nobody finishes. Deterministic output guarantees fidelity, not attention, and a stack of accurate slides read aloud is its own kind of unwatchable.",
          "The part that closes that gap is a template a person designed: the type scale, how long a figure holds before the narrator moves on, what a chart does while it is being explained, the restraint to leave a slide nearly empty when the voiceover is carrying the weight. Those decisions get made once, by someone watching the same eight seconds forty times, and are then applied by machine across every document you put through.",
          "Handing those decisions to a model instead produces the average of every video it has been trained on. The average of everything is precisely what people mean by slop — not badly made, but made by nobody in particular.",
        ],
      },
      {
        heading: "What to ask before you commit a document to a tool",
        paragraphs: [
          "Most of this is answerable from a sample gallery and a free tier, before any procurement conversation starts.",
        ],
        bullets: [
          "Show me a sample where a real figure from the source document appears on screen, correctly.",
          "Can I read the narration script before rendering? The rewrite step is where a hedge quietly becomes a claim.",
          "Can I edit one scene, or only regenerate the whole video?",
          "Are the templates fixed designs, or is a model choosing the layout each time?",
          "Do two documents run through the same template come out looking like the same publisher?",
        ],
      },
      {
        heading: "Where this is built, for documents and for posts",
        paragraphs: [
          "PDF2Vid is the document side of this: reports, decks, whitepapers, research papers, lecture notes, technical documentation. Your file is parsed, its real content is bound into designed layouts, and the render is deterministic — which is the only way the invention test above can be passed rather than approximated.",
          "The same engine points at written publishing over at Blog2Video, for posts, articles, and newsletter issues, where the source is a URL rather than a file. If your content lives as writing on the web rather than as a document, that is the one to start with — and it carries a longer version of the argument for why programmatic rendering and human-designed templates are the two things that separate this category.",
        ],
        ctaPath: "https://blog2video.app",
        ctaLabel: "Read the post-and-newsletter version at Blog2Video",
      },
    ],
    faq: [
      {
        question: "What makes an AI video generator 'slop'?",
        answer:
          "Generating imagery and narration around a topic rather than rendering the source you supplied. With a document as input it is easy to spot: nothing on screen traces back to a page in your file.",
      },
      {
        question: "Why do documents expose this more than prompts do?",
        answer:
          "Because a document contains checkable facts. A prompt-generated video cannot be wrong about anything, since there is nothing to compare it to. A video made from your annual report can be wrong about 14.2%, and a reader can find out.",
      },
      {
        question: "Does deterministic rendering mean the video is not AI-made?",
        answer:
          "No. AI still handles extraction, scene segmentation, rewriting prose into spoken narration, layout matching, and voice. What it does not do is draw the frames or invent the design, which is where the failure modes people call slop actually live.",
      },
      {
        question: "I have blog posts rather than PDFs. Which tool applies?",
        answer:
          "Blog2Video, which takes a URL or a post as the source. PDF2Vid is the right one when the content arrives as a file — a report, a deck, a paper, a set of notes.",
      },
    ],
    distributionPlan: [
      {
        channel: "site",
        title: "The AI Video Generators That Are Not Slop",
        angle: "Evaluation piece for a buyer comparing the category with a real document in hand.",
      },
      {
        channel: "medium",
        title: "Documents are where AI video slop stops being deniable",
        angle: "Argument-led version for a marketing and comms audience.",
      },
      {
        channel: "substack",
        title: "The invention test",
        angle: "Short essay on the single question that sorts document-to-video tools.",
      },
    ],
  },
];
