import type { ToolDefinition } from "./seoTypes";

/**
 * PDF2Video's own free tools.
 *
 * These replaced an inherited copy of blog2video.app's blog/newsletter tools,
 * which could never ship here: their article-length copy is already indexed on
 * that domain, and a second copy on this one is the duplicate-content risk
 * App.tsx warns about. Everything below is written for this domain and
 * describes widgets that only exist here.
 *
 * Each tool runs completely for a signed-out visitor (see
 * ../components/tools/ — extraction, analysis, and download are all
 * client-side) and gates exactly one action: producing a rendered video, which
 * needs our models and renderer. The copy on every page says which is which,
 * because a page that hides the limit until the last click converts once and
 * never again.
 */

export const toolsHub = {
  path: "/tools",
  title: "Free PDF Tools: Summarize, Extract, Narrate, and Storyboard Documents",
  description:
    "Free browser-based PDF tools — summarizer, text extractor, audio reader, video script generator, and slideshow storyboard maker. No upload, no account for the free tier.",
  heroTitle: "Free PDF tools that run in your browser, not on our servers.",
  heroDescription:
    "Summarize a report, pull its text, hear it read aloud, script it as a video, or storyboard it as slides. Every tool works signed out — your file never leaves the tab.",
};

export const tools: ToolDefinition[] = [
  {
    slug: "pdf-summarizer",
    path: "/tools/pdf-summarizer",
    title: "Free PDF Summarizer",
    description:
      "Summarize any PDF in your browser. Extracts the document's highest-signal sentences, with page count, read time, and key terms. No upload, no account.",
    eyebrow: "Summarizer",
    heroTitle: "Summarize a PDF without uploading it anywhere.",
    heroDescription:
      "Drop in a report, paper, or whitepaper and get the sentences that carry its argument, ranked and returned in reading order. Extraction runs in this tab, so the file never reaches a server.",
    category: "analyzer",
    icon: "SU",
    primaryKeyword: "pdf summarizer",
    keywordVariant: "summarize pdf free",
    badges: ["Runs in-browser", "No file upload", "Free, no account"],
    proofPoints: [
      "Returns your document's own sentences, so there is nothing for a model to hallucinate.",
      "Shows page count, reading time, and the terms the document actually leans on.",
      "Handles text-based PDFs entirely client-side — the file is never transmitted.",
    ],
    sections: [
      {
        title: "What this summarizer actually does",
        body: [
          "It scores every sentence in your document by how much of the document's own core vocabulary it carries, then returns the strongest ones in the order they appeared. This is extractive summarisation, and the distinction matters: nothing is rewritten, so nothing can be invented. What you read is what the author wrote.",
          "That trade-off is deliberate. An abstractive summary reads better and is occasionally wrong in ways you cannot detect without reading the source — which defeats the purpose. For triage, for deciding whether a fifty-page report deserves your afternoon, the author's own load-bearing sentences are the more useful artefact.",
        ],
        bullets: [
          "Three lengths: brief, standard, and detailed.",
          "Key-term chips show what the document keeps returning to.",
          "Compression percentage tells you how much you skipped.",
        ],
      },
      {
        title: "Why the file never leaves your browser",
        body: [
          "PDF text extraction happens in JavaScript on your machine. There is no upload step, no temporary storage, and no request carrying your document anywhere. For anyone handling a draft, an embargoed report, or a client deliverable, that is not a feature — it is the minimum bar, and most free summarizers do not clear it.",
          "The practical limit is that scanned PDFs contain images rather than text, and there is nothing in the file for the browser to read. If that happens the tool says so plainly and offers a paste box instead of failing silently.",
        ],
      },
      {
        title: "When a summary is not what you needed",
        body: [
          "Summaries solve a reading problem. They do not solve a distribution problem. If you are summarising your own document because the full version is not getting read, a shorter document will not fix that — it will be the same thing, ignored faster.",
          "The version people finish is the narrated one: the same argument, the same figures, read aloud over visuals, watchable on a phone. That is what PDF2Video does with the document you just summarised, and the summary above is a reasonable script outline for it.",
        ],
      },
    ],
    faq: [
      {
        question: "Is this PDF summarizer really free?",
        answer:
          "Yes, and without an account. Summarising, copying, and downloading are unlimited because they run on your machine, not ours. A free account is only needed for the AI-rewritten summary and for turning the document into a narrated video.",
      },
      {
        question: "Does my PDF get uploaded?",
        answer:
          "No. Text extraction runs in your browser using the platform's own decompression APIs. No request carrying your file is made, which is why the tool works with your network tab open and nothing to see.",
      },
      {
        question: "Why does it not work on my scanned PDF?",
        answer:
          "A scanned document is a picture of a page. There is no text layer for the browser to read, so optical character recognition would be needed first. Run it through an OCR tool, or paste the text in directly.",
      },
      {
        question: "How is this different from asking ChatGPT to summarize a PDF?",
        answer:
          "A language model rewrites your document in its own words, which reads better and can quietly misstate a finding. This returns your author's sentences verbatim. For a first pass on a document you have not read, verbatim is usually the safer default.",
      },
    ],
    relatedPaths: [
      "/tools/pdf-to-text",
      "/tools/pdf-to-video-script-generator",
      "/pdf-to-video",
      "/for-researchers",
    ],
  },
  {
    slug: "pdf-to-video-script-generator",
    path: "/tools/pdf-to-video-script-generator",
    title: "Free PDF to Video Script Generator",
    description:
      "Turn a PDF into a scene-by-scene video script. Splits the document at its own headings, times each scene at narration pace, and exports a script you can shoot.",
    eyebrow: "Script Generator",
    heroTitle: "Turn a PDF into a scene-by-scene video script.",
    heroDescription:
      "Upload a document and get it broken into timed scenes using its own headings — with per-scene narration, a word count, and a runtime you can plan around. Free, in-browser, no account.",
    category: "generator",
    icon: "VS",
    primaryKeyword: "pdf to video script generator",
    keywordVariant: "video script generator from document",
    badges: ["Scene-by-scene", "Real runtimes", "Free, no account"],
    proofPoints: [
      "Splits at the document's own headings rather than at an arbitrary word count.",
      "Times every scene at 150 words per minute, the pace real narration lands on.",
      "Exports a plain-text script you can hand to a voice actor or edit anywhere.",
    ],
    sections: [
      {
        title: "The structural half of scripting, done for you",
        body: [
          "Most people writing a video script from a document get stuck in the same place: not on the words, but on the shape. How many scenes should a twelve-page report become? Where does one end? How long will the whole thing run? Those are structural questions with mechanical answers, and this tool answers them.",
          "It reads the document's headings and treats each as a scene boundary, then breaks any run of prose longer than your chosen scene length at a sentence boundary so no single scene outruns its visuals. Every scene comes back with its own word count and a runtime at narration pace.",
        ],
        bullets: [
          "Tight, standard, and relaxed scene lengths for social, general, and desk viewing.",
          "Total runtime updates live, so you can see a 40-page report is a 26-minute video before you commit to it.",
          "Copy or download the full script — free, however long the document.",
        ],
      },
      {
        title: "What 150 words per minute means for your document",
        body: [
          "Conversational narration runs at roughly 150 words per minute. Newsreaders push 180, audiobooks sit nearer 140, and anything past 200 stops being listenable. Using 150 as the default means a 1,500-word section is a ten-minute video — which is often the moment someone realises their document needs cutting, not filming.",
          "That realisation is worth having before you record anything, and it is the main reason this tool shows runtimes per scene rather than just for the whole file.",
        ],
      },
      {
        title: "Where the free tool stops",
        body: [
          "The script this produces is your document's prose, segmented and timed. It is a real script in the sense that you could record it, and for a well-written document that is often enough.",
          "What it does not do is rewrite. Written prose and spoken narration are different registers: subordinate clauses that read fine collapse when spoken, and a sentence with three commas needs to become three sentences. That rewrite, the per-scene visual choices, and the render itself are what a free account adds.",
        ],
      },
    ],
    faq: [
      {
        question: "How does it decide where scenes start?",
        answer:
          "At the document's headings. It detects them by shape — short lines with no terminal punctuation, numbered section labels, or title case — then breaks any long run of prose at a sentence boundary so no scene exceeds your chosen length.",
      },
      {
        question: "Can I use the script somewhere other than PDF2Video?",
        answer:
          "Yes. Copy and download are unrestricted. The output is plain text with scene numbers, titles, and durations, which pastes cleanly into a teleprompter, a doc, or another editor.",
      },
      {
        question: "How accurate is the runtime estimate?",
        answer:
          "It assumes 150 words per minute with no pauses. Real narration with breaths and beats between scenes typically runs five to ten per cent longer, so treat the estimate as a floor.",
      },
      {
        question: "What does the free account add?",
        answer:
          "The narration rewrite, visuals chosen per scene, a narrator voice, and the rendered MP4. The scene breakdown carries over, so nothing you did here is repeated.",
      },
    ],
    relatedPaths: [
      "/tools/pdf-to-slideshow",
      "/tools/pdf-summarizer",
      "/pdf-to-video",
      "/pdf-to-youtube-video",
    ],
  },
  {
    slug: "pdf-to-audio",
    path: "/tools/pdf-to-audio",
    title: "Free PDF to Audio Reader",
    description:
      "Have any PDF read aloud in your browser. Pick a voice and speed, see the listen time before you start, and step through the document segment by segment.",
    eyebrow: "Audio Reader",
    heroTitle: "Have your PDF read aloud, right now, in this tab.",
    heroDescription:
      "Drop in a document and press play. It uses the voices already on your device, so there is nothing to upload, nothing to install, and no account — you hear the first sentence within a second.",
    category: "generator",
    icon: "AU",
    primaryKeyword: "pdf to audio",
    keywordVariant: "pdf audio reader free",
    badges: ["Instant playback", "No upload", "Free, no account"],
    proofPoints: [
      "Plays immediately using your device's own voices — no queue, no processing wait.",
      "Shows listen time before you start, adjusted for the speed you pick.",
      "Segments the document so long files do not get cut off mid-sentence.",
    ],
    sections: [
      {
        title: "Why this plays instantly when other PDF-to-audio tools make you wait",
        body: [
          "Most tools in this category upload your file, run server-side text-to-speech, and email you an MP3 some minutes later. That is the right architecture if you want a downloadable file with a good voice. It is the wrong one if you want to start listening to a report on the walk to a meeting.",
          "This tool uses the speech synthesiser already built into your browser and operating system. There is no upload and no render, so playback starts as fast as the text can be extracted — usually under a second for a normal report.",
        ],
        bullets: [
          "Four playback speeds, with the listen-time estimate updating for each.",
          "Long documents are split into segments so no engine truncates them.",
          "The current segment's text is shown while it plays, so you can follow along.",
        ],
      },
      {
        title: "The honest limitation of browser voices",
        body: [
          "Device voices are robotic. They mispronounce technical terms, flatten questions, and read a table as a stream of numbers. For skimming a document you already half-know, that is completely fine. For anything anyone else will hear, it is not.",
          "There is also a hard technical limit worth stating plainly: the Web Speech API can play audio but provides no way to capture it. No browser-based tool can hand you an MP3 of a device voice — that is not a paywall, it is the API. A downloadable file requires the audio to be synthesised somewhere it can be recorded, which means a server.",
        ],
      },
      {
        title: "When you want the narration to be shareable",
        body: [
          "The moment the audio is for someone else — a client, a class, a subscriber list — the requirements change. You need a voice that does not announce itself as synthetic, a file you can attach or upload, and usually visuals, because a twenty-minute audio file of a report is a hard thing to ask anyone to sit through.",
          "That is the version PDF2Video renders: the same document, narrated in a studio-grade voice, cut against its own figures and headings, exported as an MP4 that plays anywhere.",
        ],
      },
    ],
    faq: [
      {
        question: "Can I download the audio as an MP3?",
        answer:
          "Not from the browser preview — the Web Speech API exposes no capture channel, so no in-browser tool can. Downloadable audio has to be synthesised server-side, which a free account covers along with much better voices.",
      },
      {
        question: "Why do I only see a few voices, or none?",
        answer:
          "The list comes from your operating system, so it varies by device and browser. Chrome on desktop typically offers the most; some Linux installs ship none at all. The word and runtime figures still work either way.",
      },
      {
        question: "Does it work on a scanned PDF?",
        answer:
          "No — a scan has no text layer to read. The tool detects this and offers a paste box rather than playing silence.",
      },
      {
        question: "Is there a length limit?",
        answer:
          "No. The document is split into short segments and played in sequence, which is also what stops longer files being truncated by the speech engine.",
      },
    ],
    relatedPaths: [
      "/tools/pdf-to-slideshow",
      "/tools/pdf-to-text",
      "/pdf-to-video",
      "/for-educators",
    ],
  },
  {
    slug: "pdf-to-text",
    path: "/tools/pdf-to-text",
    title: "Free PDF to Text Converter",
    description:
      "Extract clean text from a PDF in your browser. Rejoins layout line-breaks, detects headings, exports .txt or Markdown. No upload, no watermark, no account.",
    eyebrow: "Converter",
    heroTitle: "Pull clean text out of a PDF without uploading it.",
    heroDescription:
      "Layout line-breaks rejoined, hyphenated words repaired, headings detected. Copy it, download it as .txt or Markdown, and get word count, page count, and read time alongside.",
    category: "formatter",
    icon: "TX",
    primaryKeyword: "pdf to text",
    keywordVariant: "extract text from pdf free",
    badges: ["Clean output", "Markdown export", "Free, unlimited"],
    proofPoints: [
      "Rejoins hard-wrapped paragraphs instead of dumping one line per visual line.",
      "Repairs words split by end-of-line hyphens, which most extractors leave broken.",
      "Three output modes: clean prose, raw extraction, or Markdown with headings.",
    ],
    sections: [
      {
        title: "Why most PDF text extraction comes out unreadable",
        body: [
          "A PDF does not store paragraphs. It stores glyphs at coordinates, and the line breaks you see are layout decisions, not sentence boundaries. Naive extraction therefore returns a hard-wrapped mess: one line per visual line, words split across hyphens, headings indistinguishable from body copy.",
          "This tool reassembles it. A line that ends mid-clause is joined to the next; a line ending in sentence punctuation keeps its break; a word broken by an end-of-line hyphen is stitched back together. Short lines with no terminal punctuation are recognised as headings, which is what makes the Markdown export useful rather than decorative.",
        ],
        bullets: [
          "Clean prose — paragraphs as the author wrote them.",
          "As extracted — exactly what came out, when you need to see the raw shape.",
          "Markdown — detected headings promoted to level-two headings, ready for a doc or a repo.",
        ],
      },
      {
        title: "Nothing here is gated, and nothing is uploaded",
        body: [
          "Extraction, cleanup, copying, and both downloads are free and unlimited, signed in or not. There is no page cap, no watermark, and no email wall, because none of this costs us anything — it runs on your machine using APIs your browser already ships.",
          "That also answers the privacy question before it is asked. Open your network tab while you use this: there is no request carrying your document, because there is nowhere for it to go.",
        ],
      },
      {
        title: "What people usually do next",
        body: [
          "Extracting text is rarely the goal. It is step one of something else — feeding a model, rebuilding a deck, quoting a source, or getting a document into a format people will actually engage with.",
          "If it is the last of those, the text file will not help. A report nobody finished reading as a PDF is a report nobody will finish reading as a .txt. The format that changes the outcome is video: the same content, narrated, watchable in the places your audience already is.",
        ],
      },
    ],
    faq: [
      {
        question: "Is there a page limit or a watermark?",
        answer:
          "Neither. Extraction is unlimited and the output is plain text with nothing added. The tool runs entirely in your browser, so there is no per-use cost to recover.",
      },
      {
        question: "Which PDFs will not work?",
        answer:
          "Scanned or image-only PDFs, because they contain no text layer. A small number of PDFs also store text inside compressed object streams that browser-side extraction cannot reach; the tool detects both cases and tells you rather than returning gibberish.",
      },
      {
        question: "Does it preserve tables?",
        answer:
          "Not as tables. Table cells come out as text in reading order, which is usually adequate for search and quoting but not for re-importing into a spreadsheet.",
      },
      {
        question: "Can I use the extracted text commercially?",
        answer:
          "That depends on the document's licence, not on us. The tool imposes no terms on its output — we never see it.",
      },
    ],
    relatedPaths: [
      "/tools/pdf-summarizer",
      "/tools/pdf-to-video-script-generator",
      "/docx-to-video",
      "/pdf-to-video",
    ],
  },
  {
    slug: "pdf-to-slideshow",
    path: "/tools/pdf-to-slideshow",
    title: "Free PDF to Slideshow Storyboard Maker",
    description:
      "Turn a PDF into a slide-by-slide storyboard with headlines, on-screen bullets, narration, and per-slide timings. Preview in 16:9, 9:16, or square. Free CSV export.",
    eyebrow: "Storyboard",
    heroTitle: "Lay a PDF out as slides before you build anything.",
    heroDescription:
      "Every slide gets a headline, the two or three lines that belong on screen, the narration underneath, and a duration. Preview it landscape, vertical, or square, and export the whole plan as CSV.",
    category: "generator",
    icon: "SL",
    primaryKeyword: "pdf to slideshow",
    keywordVariant: "document to slideshow video storyboard",
    badges: ["16:9, 9:16, 1:1", "CSV export", "Free, no account"],
    proofPoints: [
      "Separates what goes on screen from what gets said — the distinction most decks get wrong.",
      "Times slides against their own narration instead of a fixed hold.",
      "Exports every slide as CSV, whatever the document's length.",
    ],
    sections: [
      {
        title: "On-screen text and narration are not the same text",
        body: [
          "The failure mode of every automatic slideshow maker is putting the paragraph on the slide and then reading the paragraph aloud. The viewer reads faster than the narrator speaks, finishes early, and disengages — which is why so many auto-generated explainers feel dead.",
          "This storyboard splits the two. Each slide gets a headline and two or three condensed on-screen lines pulled from that section's strongest sentences, while the full narration sits underneath as speaker text. Same source, two registers, which is how a slide is supposed to work.",
        ],
        bullets: [
          "Headlines come from the document's own section headings.",
          "On-screen lines are truncated to fit a real frame, not a text box that scrolls.",
          "Narration keeps the full prose, so nothing is lost.",
        ],
      },
      {
        title: "Why fixed slide timings feel wrong",
        body: [
          "Set every slide to eight seconds and half of them linger while the other half vanish mid-sentence. The default here paces each slide by the length of its own narration, which is the same rule a human editor applies without thinking about it.",
          "The fixed options are still there, because sometimes you want a metronome — a background loop for a stand at a conference, say. The tool shows you the runtime both ways so the choice is informed.",
        ],
      },
      {
        title: "From storyboard to a video you can post",
        body: [
          "The CSV export is the complete plan: slide number, headline, on-screen lines, narration, and seconds. You can build from it in any editor, and plenty of people will.",
          "Rendering it here skips that step. The same storyboard gets typeset in a branded template, narrated in the voice you choose, and exported as an MP4 in each aspect ratio you need — which is the point at which one document becomes a LinkedIn post, a YouTube upload, and a Shorts clip rather than three separate jobs.",
        ],
      },
    ],
    faq: [
      {
        question: "Does it use the images from my PDF?",
        answer:
          "The free storyboard is text-only — it plans the structure. Figures and charts from your document are placed into the frames when the video is rendered with an account.",
      },
      {
        question: "Why does the preview show only the first five slides?",
        answer:
          "To keep the page fast. The CSV export contains every slide in the document, however long it is, and it is free.",
      },
      {
        question: "Can one document produce landscape and vertical versions?",
        answer:
          "Yes. Switch the frame shape and the storyboard re-flows — vertical frames fit an extra on-screen line. Rendering produces a separate MP4 per ratio from the same source.",
      },
      {
        question: "Is this a PowerPoint converter?",
        answer:
          "No — it produces a storyboard and, with an account, a video. If you specifically need editable .pptx slides, use a PDF-to-PowerPoint converter instead. This is for the case where the deck was only ever going to become a video.",
      },
    ],
    relatedPaths: [
      "/tools/pdf-to-video-script-generator",
      "/tools/pdf-summarizer",
      "/pptx-to-video",
      "/pdf-to-course-video",
    ],
  },
];

export function getTool(slug: string): ToolDefinition | undefined {
  return tools.find((tool) => tool.slug === slug);
}

export function getToolByPath(path: string): ToolDefinition | undefined {
  return tools.find((tool) => tool.path === path);
}

export const toolPaths = tools.map((tool) => tool.path);
