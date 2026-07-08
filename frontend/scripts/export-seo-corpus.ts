import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { blogPosts } from "../src/content/blogPosts";
import { marketingPages } from "../src/content/siteContent";
import { tools } from "../src/content/tools";
import { pricingPage } from "../src/content/pricingContent";
import { errorReference } from "../src/content/errorReference";
import { userManual } from "../src/content/userManual";
import { helpPosts } from "../src/content/helpPosts";
import type { BlogPost, HelpPost, MarketingPage, ToolDefinition } from "../src/content/seoTypes";
import type { PricingPage } from "../src/content/pricingTypes";
import type { SupportDoc } from "../src/content/supportTypes";

type CorpusEntry = {
  id: string;
  source: "blog" | "marketing" | "tool" | "pricing" | "support" | "help";
  slug: string;
  title: string;
  description: string;
  primary_keyword: string;
  keyword_variant: string;
  related_paths: string[];
  route: string;
  headings: string[];
  faq_questions: string[];
  body: string;
};

// --- Off-topic classifier (build-time corpus gate) ---------------------------
// The support bot answers ONLY from this corpus. Blog/marketing pages that talk
// about competitors or features Blog2Video doesn't have (e.g. AI avatars) poison
// the corpus and make the bot hallucinate — or even recommend a competitor like
// HeyGen. Before writing the corpus we run each blog/marketing doc through the
// same OpenRouter LLM the bot uses and drop any doc that isn't exclusively about
// Blog2Video. Verdicts are cached by content hash so `npm run dev`/`build` (which
// run this script every time) stay fast.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
// Mirror the model the support bot uses (backend/app/support/llm_client.py).
const CLASSIFIER_MODEL = process.env.SUPPORT_LLM_MODEL || "qwen/qwen-2.5-7b-instruct";
const SKIP_LLM = process.env.SEO_CORPUS_SKIP_LLM === "1";
const CACHE_PATH = path.resolve(process.cwd(), "scripts/.seo-corpus-classification-cache.json");
const CLASSIFY_CONCURRENCY = 6;

type Classification = { keep: boolean; reason: string };
type CacheShape = Record<string, Classification>;

/** Minimal .env reader — the script has no dotenv dep and the key lives in backend/.env. */
async function loadOpenRouterKey(): Promise<string | undefined> {
  if (process.env.OPEN_ROUTER_KEY) return process.env.OPEN_ROUTER_KEY;
  const envPath = path.resolve(process.cwd(), "../backend/.env");
  let text: string;
  try {
    text = await readFile(envPath, "utf8");
  } catch {
    return undefined;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*OPEN_ROUTER_KEY\s*=\s*(.*)$/.exec(line);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return undefined;
}

const CLASSIFIER_SYSTEM_PROMPT = `You are a content classifier for the Blog2Video support knowledge base. The support bot answers ONLY from documents you keep, so it must never learn about competitors' features or features Blog2Video lacks.

ABOUT BLOG2VIDEO (blog2video.app): It turns written content — blog posts, articles, URLs, PDFs, DOCX, PPTX, newsletters — into narrated videos with templates, scenes, voiceover, branding, and export/embed. All of those input formats and output destinations (LinkedIn, TikTok, YouTube, Shorts, etc.) ARE Blog2Video features.

Your ONLY job is to filter out documents that would make the bot describe something that is NOT a real Blog2Video feature, or that name a competitor. Keep everything else.

Set "keep": false ONLY if the document:
- compares Blog2Video against, or is positioned as an alternative to, another named product/company (HeyGen, Synthesia, Pictory, Lumen5, VEED, InVideo, Descript, Canva, Runway, etc.), OR
- primarily describes another product/tool (Loom, Microsoft Teams, ChatGPT, Claude, Gemini, NotebookLM, Substack, LinkedIn, etc.) rather than Blog2Video, OR
- describes a capability Blog2Video does NOT have — most importantly AI avatars / talking-head presenters / virtual spokespeople, or live streaming.

Set "keep": true for everything else, INCLUDING:
- how-to / feature / use-case pages about Blog2Video's own workflow, even if they mention an input format (PDF, DOCX, URL) or an output platform (LinkedIn, TikTok, YouTube) — those are Blog2Video features.
- pages that briefly mention another tool only as passing context, as long as the page is fundamentally about using Blog2Video.

Examples:
- "Convert a PDF to a video with Blog2Video" -> {"keep": true, "reason": "PDF-to-video is a Blog2Video feature"}
- "Turn your URL into a TikTok video" -> {"keep": true, "reason": "url-to-video is a Blog2Video feature"}
- "Blog2Video vs HeyGen" -> {"keep": false, "reason": "compares against a competitor"}
- "Best HeyGen alternative for avatars" -> {"keep": false, "reason": "avatar feature Blog2Video lacks + competitor"}
- "How to grow your Substack newsletter" -> {"keep": false, "reason": "about Substack, not Blog2Video"}

Respond with ONLY a JSON object, no prose: {"keep": true|false, "reason": "<=12 words"}`;

// Fingerprint of the classifier prompt + model. Folded into the cache key so that
// editing the prompt (or switching model) automatically invalidates stale verdicts.
let _promptFingerprint: string | null = null;
function promptFingerprint(): string {
  if (_promptFingerprint === null) {
    _promptFingerprint = createHash("sha256")
      .update(CLASSIFIER_SYSTEM_PROMPT + "\n" + CLASSIFIER_MODEL)
      .digest("hex")
      .slice(0, 8);
  }
  return _promptFingerprint as string;
}

/** Hash the content we actually send to the classifier, so edits invalidate the cache. */
function classificationHash(entry: CorpusEntry): string {
  const excerpt = `${entry.title}\n${entry.description}\n${entry.body.slice(0, 1500)}`;
  return createHash("sha256").update(excerpt).digest("hex").slice(0, 16);
}

function cacheKey(entry: CorpusEntry): string {
  return `${entry.id}@${classificationHash(entry)}@${promptFingerprint()}`;
}

async function classifyIsB2VOnly(entry: CorpusEntry, apiKey: string): Promise<Classification> {
  const excerpt = `${entry.title}\n${entry.description}\n${entry.body.slice(0, 1500)}`;
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://blog2video.app",
      "X-Title": "Blog2Video SEO Corpus Classifier",
    },
    body: JSON.stringify({
      model: CLASSIFIER_MODEL,
      temperature: 0,
      max_tokens: 60,
      messages: [
        { role: "system", content: CLASSIFIER_SYSTEM_PROMPT },
        { role: "user", content: `Document id: ${entry.id}\n\n${excerpt}` },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? "";
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) {
    // Unparseable → keep, so a flaky classifier never silently deletes real content.
    return { keep: true, reason: "unparseable classifier response — kept by default" };
  }
  const parsed = JSON.parse(match[0]) as { keep?: unknown; reason?: unknown };
  return {
    keep: parsed.keep !== false,
    reason: typeof parsed.reason === "string" ? parsed.reason : "",
  };
}

/** Classify entries with a small concurrency limit, reusing the on-disk cache. */
async function classifyEntries(
  entries: CorpusEntry[],
  apiKey: string,
  cache: CacheShape,
): Promise<Map<string, Classification>> {
  const results = new Map<string, Classification>();
  const todo: CorpusEntry[] = [];
  for (const entry of entries) {
    const cached = cache[cacheKey(entry)];
    if (cached) results.set(entry.id, cached);
    else todo.push(entry);
  }
  console.log(
    `[classify] ${entries.length} blog/marketing docs — ${entries.length - todo.length} cached, ${todo.length} to classify`,
  );

  let index = 0;
  async function worker() {
    while (index < todo.length) {
      const entry = todo[index++];
      try {
        const result = await classifyIsB2VOnly(entry, apiKey);
        cache[cacheKey(entry)] = result;
        results.set(entry.id, result);
      } catch (err) {
        // Keep on error — never drop content because the API hiccupped.
        console.warn(`[classify] ${entry.id} failed (${String(err)}) — keeping`);
        results.set(entry.id, { keep: true, reason: "classifier error — kept" });
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CLASSIFY_CONCURRENCY, todo.length) }, worker),
  );
  return results;
}

function joinNonEmpty(parts: (string | undefined)[]): string {
  return parts.filter((p): p is string => Boolean(p && p.trim())).join("\n");
}

function fromBlogPost(post: BlogPost): CorpusEntry {
  const headings = post.sections.map((s) => s.heading);
  const faqQuestions = post.faq.map((f) => f.question);
  const body = joinNonEmpty([
    post.heroTitle,
    post.heroDescription,
    post.description,
    ...post.sections.flatMap((s) => [
      s.heading,
      ...(s.paragraphs ?? []),
      ...(s.bullets ?? []),
    ]),
    ...post.faq.flatMap((f) => [f.question, f.answer]),
  ]);
  return {
    id: `blog:${post.slug}`,
    source: "blog",
    slug: post.slug,
    title: post.title,
    description: post.description,
    primary_keyword: post.primaryKeyword,
    keyword_variant: post.keywordVariant,
    related_paths: post.relatedPaths ?? [],
    route: `/blog/${post.slug}`,
    headings,
    faq_questions: faqQuestions,
    body,
  };
}

function fromMarketingPage(page: MarketingPage): CorpusEntry {
  const headings = page.sections.map((s) => s.title);
  const faqQuestions = page.faq.map((f) => f.question);
  const body = joinNonEmpty([
    page.heroTitle,
    page.heroDescription,
    page.description,
    ...(page.proofPoints ?? []),
    ...(page.workflowSteps ?? []),
    ...page.sections.flatMap((s) => [
      s.title,
      ...(s.body ?? []),
      ...(s.bullets ?? []),
    ]),
    ...page.faq.flatMap((f) => [f.question, f.answer]),
  ]);
  return {
    id: `marketing:${page.path}`,
    source: "marketing",
    slug: page.path.replace(/^\//, "") || "home",
    title: page.title,
    description: page.description,
    primary_keyword: page.primaryKeyword,
    keyword_variant: page.keywordVariant,
    related_paths: page.relatedPaths ?? [],
    route: page.path,
    headings,
    faq_questions: faqQuestions,
    body,
  };
}

function fromTool(tool: ToolDefinition): CorpusEntry {
  const headings = tool.sections.map((s) => s.title);
  const faqQuestions = tool.faq.map((f) => f.question);
  const body = joinNonEmpty([
    tool.heroTitle,
    tool.heroDescription,
    tool.description,
    ...(tool.proofPoints ?? []),
    ...tool.sections.flatMap((s) => [
      s.title,
      ...(s.body ?? []),
      ...(s.bullets ?? []),
    ]),
    ...tool.faq.flatMap((f) => [f.question, f.answer]),
  ]);
  return {
    id: `tool:${tool.slug}`,
    source: "tool",
    slug: tool.slug,
    title: tool.title,
    description: tool.description,
    primary_keyword: tool.primaryKeyword,
    keyword_variant: tool.keywordVariant,
    related_paths: tool.relatedPaths ?? [],
    route: tool.path,
    headings,
    faq_questions: faqQuestions,
    body,
  };
}

function fromPricingPage(page: PricingPage): CorpusEntry {
  const headings = page.plans.map((p) => p.name);
  const faqQuestions = page.faq.map((f) => f.question);
  const planDetails = page.plans.map((p) => {
    const priceStr = p.monthlyPrice != null
      ? `$${p.monthlyPrice}/month${p.annualMonthlyPrice != null ? ` (or $${p.annualMonthlyPrice}/month billed annually, $${p.annualTotalPrice}/year)` : ""}`
      : "Custom pricing";
    const features = p.featuresIncluded.join(", ");
    const excluded = p.featuresExcluded.length > 0 ? ` Not included: ${p.featuresExcluded.join(", ")}.` : "";
    const notes = p.notes.length > 0 ? ` Notes: ${p.notes.join("; ")}.` : "";
    return `${p.name} (${p.tagline}): ${priceStr}. ${p.videoLimitLabel}. Features: ${features}.${excluded}${notes}`;
  });
  const body = joinNonEmpty([
    page.title,
    page.description,
    ...planDetails,
    ...page.faq.flatMap((f) => [f.question, f.answer]),
  ]);
  return {
    id: `marketing:${page.path}`,
    source: "pricing",
    slug: page.path.replace(/^\//, ""),
    title: page.title,
    description: page.description,
    primary_keyword: page.primaryKeyword,
    keyword_variant: page.keywordVariant,
    related_paths: page.relatedPaths,
    route: page.path,
    headings,
    faq_questions: faqQuestions,
    body,
  };
}

function fromSupportDoc(doc: SupportDoc): CorpusEntry {
  return {
    id: doc.id,
    source: "support",
    slug: doc.id.replace("support:", ""),
    title: doc.title,
    description: doc.description,
    primary_keyword: doc.primaryKeyword,
    keyword_variant: doc.keywordVariant,
    related_paths: doc.relatedPaths,
    route: doc.route,
    headings: doc.headings,
    faq_questions: doc.faq_questions,
    body: doc.body,
  };
}

function fromHelpPost(post: HelpPost): CorpusEntry {
  const headings = post.steps.map((s) => s.title);
  const faqQuestions = post.faq.map((f) => f.question);
  const body = joinNonEmpty([
    post.heroTitle,
    post.heroDescription,
    post.description,
    ...post.steps.flatMap((s) => [s.title, ...(s.body ?? []), ...(s.bullets ?? [])]),
    ...post.faq.flatMap((f) => [f.question, f.answer]),
  ]);
  return {
    id: `help:${post.slug}`,
    source: "help",
    slug: post.slug,
    title: post.title,
    description: post.description,
    primary_keyword: post.primaryKeyword,
    keyword_variant: post.keywordVariant,
    related_paths: post.relatedPaths ?? [],
    route: `/help/${post.slug}`,
    headings,
    faq_questions: faqQuestions,
    body,
  };
}

async function main() {
  const allEntries: CorpusEntry[] = [
    ...blogPosts.map(fromBlogPost),
    ...marketingPages.map(fromMarketingPage),
    ...tools.map(fromTool),
    fromPricingPage(pricingPage),
    fromSupportDoc(errorReference),
    fromSupportDoc(userManual),
    ...helpPosts.map(fromHelpPost),
  ];

  // Authoritative product docs are always kept — never let a classifier misfire
  // drop the user manual, help articles, pricing, or tool pages.
  const alwaysKeep = allEntries.filter((e) => e.source !== "blog" && e.source !== "marketing");
  const toClassify = allEntries.filter((e) => e.source === "blog" || e.source === "marketing");

  let kept = allEntries;
  const excluded: { id: string; reason: string }[] = [];

  const apiKey = SKIP_LLM ? undefined : await loadOpenRouterKey();
  if (SKIP_LLM) {
    console.warn("[classify] SEO_CORPUS_SKIP_LLM=1 — skipping off-topic gate, keeping all docs");
  } else if (!apiKey) {
    console.warn(
      "[classify] OPEN_ROUTER_KEY not found (checked env + ../backend/.env) — skipping off-topic gate, keeping all docs. Set SEO_CORPUS_SKIP_LLM=1 to silence.",
    );
  } else {
    let cache: CacheShape = {};
    try {
      cache = JSON.parse(await readFile(CACHE_PATH, "utf8")) as CacheShape;
    } catch {
      /* no cache yet */
    }

    const verdicts = await classifyEntries(toClassify, apiKey, cache);
    await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");

    kept = allEntries.filter((e) => {
      const v = verdicts.get(e.id);
      if (v && !v.keep) {
        excluded.push({ id: e.id, reason: v.reason });
        return false;
      }
      return true;
    });
  }

  const outPath = path.resolve(
    process.cwd(),
    "../backend/app/support/seo_corpus.json",
  );
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(kept, null, 2), "utf8");

  if (excluded.length > 0) {
    console.log(`\nExcluded ${excluded.length} off-topic/comparison docs from support corpus:`);
    for (const { id, reason } of excluded) {
      console.log(`  - ${id}${reason ? ` — ${reason}` : ""}`);
    }
    console.log("");
  }

  const counts = kept.reduce<Record<string, number>>((acc, e) => {
    acc[e.source] = (acc[e.source] ?? 0) + 1;
    return acc;
  }, {});
  console.log(
    `Wrote ${kept.length}/${allEntries.length} entries to ${outPath} ` +
      `(${excluded.length} excluded, ${alwaysKeep.length} always-kept authoritative docs)`,
    JSON.stringify(counts),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
