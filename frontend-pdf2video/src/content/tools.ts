import type { ToolDefinition } from "./seoTypes";

/**
 * PDF2Video's own AI document tools.
 *
 * These replaced an inherited copy of blog2video.app's blog/newsletter tools,
 * which could never ship here: their article-length copy is already indexed on
 * that domain, and a second copy on this one is the duplicate-content risk
 * App.tsx warns about. Everything below is written for this domain and
 * describes widgets that only exist here.
 *
 * COPY RULE: every tool requires a free account and does its work server-side
 * against real models (backend: app/routers/free_tools.py). An earlier version
 * of these pages ran heuristics in the browser and advertised "no upload, no
 * account" — none of that is true any more, and none of it should reappear
 * here. If you change what a tool does, change these claims in the same commit.
 */

export const toolsHub = {
  path: "/tools",
  title: "Free AI PDF Tools: Summarize, Script, Narrate, and Storyboard Documents",
  description:
    "Free AI tools for documents — summarizer, video script writer, narrator, storyboard builder, and text extractor. Sign in with Google, no card required.",
  heroTitle: "AI tools for the documents nobody finishes reading.",
  heroDescription:
    "Summarize a report, script it as a video, hear it in a studio voice, or storyboard it as slides. Real models doing real work — free with a Google account.",
};

export const tools: ToolDefinition[] = [
  {
    slug: "pdf-summarizer",
    path: "/tools/pdf-summarizer",
    title: "Free AI PDF Summarizer",
    description:
      "Summarize any PDF, Word, or PowerPoint file with AI. Reads the whole document and writes a plain-language summary plus key points. Free with a Google account.",
    eyebrow: "Summarizer",
    heroTitle: "Summarize a document with AI, properly.",
    heroDescription:
      "Upload a report, paper, or whitepaper and get a written summary that leads with the finding — not the first page, not a keyword extract. Free with an account.",
    category: "analyzer",
    icon: "SU",
    primaryKeyword: "pdf summarizer",
    keywordVariant: "ai summarize pdf free",
    badges: ["AI-written", "Reads the full document", "Free account"],
    proofPoints: [
      "A language model reads the whole document, not a sample of it.",
      "Instructed to copy every figure exactly and keep hedged claims hedged.",
      "Returns prose plus discrete key points, so you can use either.",
    ],
    sections: [
      {
        title: "What this actually does",
        body: [
          "Your file is extracted server-side using the same parser our video pipeline runs, then a language model reads the extracted text and writes a summary. It is abstractive: the model writes new sentences in plain language rather than pulling quotes out of the original.",
          "It is told to lead with the most important finding rather than with background, because documents build to their conclusion and a summary that does the same is no faster to read than the document.",
        ],
        bullets: [
          "Three depths: brief, standard, and detailed.",
          "Key points come back as discrete standalone sentences.",
          "Key terms show what the document keeps returning to.",
        ],
      },
      {
        title: "The instruction that matters most",
        body: [
          "The risk with an AI summary is not a clumsy sentence. It is a confident one the document never supported — a hedge dropped, a correlation upgraded to a cause, a figure rounded into a different claim.",
          "The prompt is explicit about this: copy numbers exactly including units and precision, preserve qualifiers word for word, and say nothing about anything the document does not state. That reduces the risk substantially. It does not eliminate it, which is why the tool tells you to check the figures rather than implying the output is authoritative.",
        ],
      },
      {
        title: "Why it needs an account",
        body: [
          "Reading a full document through a language model costs real compute on every run. A free Google account covers it, with no card and no trial clock — the account exists so the endpoint is not an open door.",
          "Your document is processed to produce your result. It is not stored as a project and it is not used to train anything.",
        ],
      },
      {
        title: "When a summary is not what you needed",
        body: [
          "Summaries solve a reading problem. They do not solve a distribution problem. If you are summarising your own document because the full version is not getting read, a shorter document will not fix that — it will be the same thing, ignored faster.",
          "The version people finish is the narrated one: the same argument, the same figures, read aloud over visuals, watchable on a phone. That is what PDF2Video does with the document you just summarised, and the summary is a reasonable script outline for it.",
        ],
      },
    ],
    faq: [
      {
        question: "Is this AI PDF summarizer free?",
        answer:
          "Yes, with a free Google account and no card. The account is required because each summary runs a language model over your full document on our servers.",
      },
      {
        question: "Can the AI get the summary wrong?",
        answer:
          "It can, in the specific way summaries go wrong: dropping a qualifier or firming up a hedged claim. The model is instructed to copy figures exactly and preserve hedging, but check the numbers against the source before relying on them.",
      },
      {
        question: "What happens to my document?",
        answer:
          "It is extracted and passed to the model to produce your summary. It is not saved as a project on your account and is not used for training.",
      },
      {
        question: "Why does it not work on my scanned PDF?",
        answer:
          "A scanned document is a picture of a page with no text layer, so there is nothing to read. Run it through OCR first, then upload the result.",
      },
      {
        question: "What file types work?",
        answer:
          "PDF, DOCX, PPTX, Markdown, plain text, and VTT — the same set the main video pipeline accepts, because it is the same extractor.",
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
    title: "Free AI PDF to Video Script Generator",
    description:
      "Turn a document into a scene-by-scene video script with AI. Selects what belongs in a video, rewrites it as spoken narration, and times every scene. Free with an account.",
    eyebrow: "Script Generator",
    heroTitle: "Turn a document into a video script an AI actually wrote.",
    heroDescription:
      "Not your prose chopped into chunks. The model decides what to leave out, moves the finding to scene one, and rewrites the rest for the ear.",
    category: "generator",
    icon: "VS",
    primaryKeyword: "pdf to video script generator",
    keywordVariant: "ai video script from document",
    badges: ["AI-written", "Scene-by-scene", "Free account"],
    proofPoints: [
      "Cuts the document down — methodology and appendices do not make the video.",
      "Rewrites written prose into narration that works spoken aloud.",
      "Every scene comes back timed at a real narration pace.",
    ],
    sections: [
      {
        title: "The cut is the job",
        body: [
          "A twenty-page report narrated end to end is roughly ninety minutes of video, which nobody watches. So the useful work is not segmentation, it is selection — and that is what a model can do here that a splitter cannot.",
          "It is instructed to keep the finding, the evidence for it, and what it means, and to drop related work, detailed methodology, appendices, and anything the document itself treats as supporting material. It also reorders: documents build to their conclusion, and video loses the viewer before it arrives, so the finding goes in scene one.",
        ],
        bullets: [
          "Short, standard, and long, from 5–7 scenes up to 14–20.",
          "A hard ceiling on narration words per scene, so no scene outruns its visuals.",
          "Runtime shown per scene and in total at 150 words per minute.",
        ],
      },
      {
        title: "Written prose is not spoken narration",
        body: [
          "A sentence with two subordinate clauses reads fine and collapses when spoken. Passive constructions hide the actor. Phrases like 'as noted above' and 'see Section 4' mean nothing in a linear medium. Acronyms a reader can scan back for are just noise to a listener.",
          "The model is told to fix all of that: split clauses, prefer active voice, replace document navigation with a restatement of the actual content, expand acronyms on first use, and add the spoken signposts that written headings used to provide.",
        ],
      },
      {
        title: "What to check before you record",
        body: [
          "Read the narration against your document, focusing on numbers and on any sentence that got shorter. Shortening is where meaning goes missing.",
          "The model is instructed to preserve hedging and copy figures exactly, and it is good at it. It is not perfect at it, and a script is cheap to check compared with a video you have to re-record.",
        ],
      },
    ],
    faq: [
      {
        question: "How is this different from pasting my document into ChatGPT?",
        answer:
          "The extraction is the same one our video pipeline uses, so tables and structure survive; the prompt is tuned specifically for the cut and for spoken register; and the output comes back as timed scenes rather than prose you then have to break up.",
      },
      {
        question: "Does it keep my document's exact wording?",
        answer:
          "No, deliberately — written prose does not work read aloud. It keeps your figures and qualifiers exact while rewriting the sentences around them.",
      },
      {
        question: "How accurate is the runtime estimate?",
        answer:
          "It assumes 150 words per minute with no pauses. Real narration with breaths and beats runs five to ten per cent longer, so treat it as a floor.",
      },
      {
        question: "Why do I need an account?",
        answer:
          "Each script is a language model reading your full document on our servers. A free Google account covers it — no card, and the script is yours to copy or download.",
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
    title: "Free PDF to Audio: Narrate a Document in a Studio Voice",
    description:
      "Turn a PDF, Word, or PowerPoint file into narrated audio and download the mp3. Real synthesized narrator voices, not your device's robot voice. Free with an account.",
    eyebrow: "Narration",
    heroTitle: "Have your document narrated, and keep the mp3.",
    heroDescription:
      "Studio-grade synthesis on our servers, returned as a file you can download, attach, or publish. Your browser's built-in speech can play audio but cannot save it.",
    category: "generator",
    icon: "AU",
    primaryKeyword: "pdf to audio",
    keywordVariant: "pdf to mp3 narration",
    badges: ["Downloadable mp3", "Studio voices", "Free account"],
    proofPoints: [
      "Real text-to-speech synthesis, returned as an mp3 you keep.",
      "Handles long documents by splitting them at paragraph boundaries.",
      "Same narrator voices used in our rendered videos.",
    ],
    sections: [
      {
        title: "Why this is a server-side tool",
        body: [
          "Browsers ship a speech synthesiser, and it is genuinely useful for skimming something yourself. It has two limits that matter the moment the audio is for anyone else: the voices are robotic, and the Web Speech API exposes no way to capture the output. No in-browser tool can hand you a file — that is the API, not a paywall.",
          "This tool synthesises on our servers with the same voices our rendered videos use, and returns an mp3. That is a real cost per run, which is why it needs an account.",
        ],
      },
      {
        title: "How long documents are handled",
        body: [
          "One synthesis covers about 5,000 characters, which is roughly twelve minutes of narration. Longer documents are split into sections at paragraph boundaries, so a section never begins mid-sentence, and you narrate them one at a time.",
          "The tool shows how many sections your document became before you start, rather than silently narrating the first chunk and stopping.",
        ],
        bullets: [
          "Female and male narrator voices.",
          "Listen time shown per section before you synthesise.",
          "The exact text that will be read is displayed alongside.",
        ],
      },
      {
        title: "Audio or video?",
        body: [
          "Audio is the right format for documents you need to get through yourself — commuting, walking, anywhere your eyes are busy. It is cheap to produce and needs no visuals.",
          "It falls apart on anything visual. A narrator saying 'as Figure 3 shows' to someone with no Figure 3 has communicated nothing, and spoken figures do not stick. If your document's finding lives in a chart, the video version is the one that works.",
        ],
      },
    ],
    faq: [
      {
        question: "Can I download the audio as an MP3?",
        answer:
          "Yes — that is the point of this tool. Each section comes back as an mp3 with a download button.",
      },
      {
        question: "How long can the document be?",
        answer:
          "Any length. One synthesis covers about 5,000 characters, so longer documents are split into sections at paragraph boundaries and narrated one at a time.",
      },
      {
        question: "Are these better than my computer's built-in voices?",
        answer:
          "Substantially. These are the same synthesised narrator voices used in our rendered videos. Device voices flatten questions and mispronounce technical terms.",
      },
      {
        question: "Does it work on a scanned PDF?",
        answer:
          "No — a scan has no text layer, so there is nothing to read aloud. Run OCR over it first.",
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
    title: "Free PDF to Text Converter With Real Table Handling",
    description:
      "Extract text from PDF, Word, and PowerPoint files using the same parser our video pipeline runs. Tables come out as tables. Markdown or plain text. Free with an account.",
    eyebrow: "Extractor",
    heroTitle: "Extract a document's text without the usual mess.",
    heroDescription:
      "Most extractors return hard-wrapped fragments and scrambled tables. This runs the parser our video pipeline uses, so structure survives — and it reads DOCX and PPTX too.",
    category: "formatter",
    icon: "TX",
    primaryKeyword: "pdf to text",
    keywordVariant: "extract text from pdf with tables",
    badges: ["Tables preserved", "PDF, DOCX, PPTX", "Free account"],
    proofPoints: [
      "Tables come out as Markdown tables, not cells in reading order.",
      "Word and PowerPoint files work, not just PDF.",
      "Markdown or plain text, both downloadable.",
    ],
    sections: [
      {
        title: "Why most PDF text extraction comes out unreadable",
        body: [
          "A PDF does not store paragraphs. It stores glyphs at coordinates, and the line breaks you see are layout decisions, not sentence boundaries. Naive extraction returns one line per visual line, words split across hyphens, headings indistinguishable from body copy, and tables flattened into a stream of cell contents.",
          "This tool runs the extractor our production video pipeline depends on. It reconstructs paragraphs, detects headings, and emits tables as Markdown tables — because the pipeline needs that structure to build scenes, so it had to be solved properly.",
        ],
        bullets: [
          "Markdown — headings and tables preserved, as extracted.",
          "Plain text — the same content with Markdown syntax stripped.",
          "Word count, character count, and estimated reading time alongside.",
        ],
      },
      {
        title: "The one tool here without a model in it",
        body: [
          "Extraction is parsing, not generation, and dressing it up as AI would be a lie. What makes this version better than a browser-side script is not intelligence — it is that a real parser with real table handling runs on a server, and can read formats JavaScript in a tab cannot.",
          "It is still behind the same sign-in as everything else here, because it is the same authenticated endpoint.",
        ],
      },
      {
        title: "What people usually do next",
        body: [
          "Extracting text is rarely the goal. It is step one of something else — feeding a model, rebuilding a deck, quoting a source, or getting a document into a format people will actually engage with.",
          "If it is the last of those, a text file will not help. A report nobody finished reading as a PDF is a report nobody will finish reading as a .txt. The format that changes the outcome is video.",
        ],
      },
    ],
    faq: [
      {
        question: "Does it preserve tables?",
        answer:
          "Yes, as Markdown tables. That is the main thing separating this from a quick browser-side extractor, which returns table cells as a flat run of text.",
      },
      {
        question: "Which file types work?",
        answer:
          "PDF, DOCX, PPTX, Markdown, plain text, and VTT. Scanned PDFs do not, because they contain no text layer.",
      },
      {
        question: "Why does a text extractor need a login?",
        answer:
          "Because the parsing runs on our servers rather than in your browser, on the same authenticated endpoint the other tools use. The account is free.",
      },
      {
        question: "Can I use the extracted text commercially?",
        answer:
          "That depends on the document's licence, not on us. We impose no terms on the output.",
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
    title: "Free AI PDF to Slideshow Storyboard Maker",
    description:
      "Turn a document into a slide-by-slide storyboard with AI. Separate on-screen text and narration per slide, timed, previewable in 16:9, 9:16, or square. Free with an account.",
    eyebrow: "Storyboard",
    heroTitle: "Lay a document out as slides, written by AI.",
    heroDescription:
      "Each slide gets a headline, the two or three lines that belong on screen, and separate narration underneath — because putting the same words in both is why auto-slideshows feel dead.",
    category: "generator",
    icon: "SL",
    primaryKeyword: "pdf to slideshow",
    keywordVariant: "ai document to slideshow storyboard",
    badges: ["AI-written", "16:9, 9:16, 1:1", "Free account"],
    proofPoints: [
      "On-screen text and narration are written separately, never duplicated.",
      "Every slide timed from the narration the model wrote for it.",
      "Full storyboard exports as CSV.",
    ],
    sections: [
      {
        title: "On-screen text and narration are not the same text",
        body: [
          "The failure mode of every automatic slideshow maker is putting the paragraph on the slide and then reading the paragraph aloud. A viewer reads at roughly 240 words per minute and a narrator speaks at 150, so the viewer finishes early, has nothing to do, and disengages. Repeat that twelve times and they leave.",
          "This is the model's hardest instruction here: the screen holds the claim, short and scannable; the narration holds the reasoning behind it. Same source, two registers. Numbers are the one deliberate exception — a figure said aloud should also be on screen, because spoken figures are not retained.",
        ],
        bullets: [
          "Headline under eight words per slide.",
          "Two or three on-screen lines, each under fifteen words.",
          "Narration written separately, and timed.",
        ],
      },
      {
        title: "Pacing that follows the content",
        body: [
          "Each slide's duration comes from the length of its own narration rather than a fixed hold. That is the rule a human editor applies without thinking about it, and its absence is why fixed-interval slideshows feel mechanical — a title slide and a dense chart slide should not share a duration.",
          "Preview the storyboard in landscape, vertical, or square. The frame shape changes how many on-screen lines fit; the content is the same, so one document plans all three cuts at once.",
        ],
      },
      {
        title: "From storyboard to a video you can post",
        body: [
          "The CSV export is the complete plan: slide number, headline, on-screen lines, narration, and seconds. You can build from it in any editor.",
          "Rendering it here skips that step — the same storyboard typeset in a branded template, narrated, and exported as an MP4 in each aspect ratio you need.",
        ],
      },
    ],
    faq: [
      {
        question: "Does it use the images from my PDF?",
        answer:
          "The storyboard is text — it plans the structure and the words. Figures and charts from your document are placed into the frames when the video itself is rendered.",
      },
      {
        question: "How many slides will my document become?",
        answer:
          "You choose roughly how many — 6, 10, 16, or 24 — and the model cuts the document to fit. It selects rather than compresses, so fewer slides means less content, not smaller text.",
      },
      {
        question: "Can one document produce landscape and vertical versions?",
        answer:
          "Yes. The storyboard is the same; the preview re-flows, and vertical frames fit an extra on-screen line.",
      },
      {
        question: "Is this a PowerPoint converter?",
        answer:
          "No — it produces a storyboard and, from that, a video. If you specifically need editable .pptx slides, use a PDF-to-PowerPoint converter instead.",
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
