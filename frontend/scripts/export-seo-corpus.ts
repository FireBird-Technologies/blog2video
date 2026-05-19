import { mkdir, writeFile } from "node:fs/promises";
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
  const entries: CorpusEntry[] = [
    ...blogPosts.map(fromBlogPost),
    ...marketingPages.map(fromMarketingPage),
    ...tools.map(fromTool),
    fromPricingPage(pricingPage),
    fromSupportDoc(errorReference),
    fromSupportDoc(userManual),
    ...helpPosts.map(fromHelpPost),
  ];

  const outPath = path.resolve(
    process.cwd(),
    "../backend/app/support/seo_corpus.json",
  );
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(entries, null, 2), "utf8");

  const counts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.source] = (acc[e.source] ?? 0) + 1;
    return acc;
  }, {});
  console.log(
    `Wrote ${entries.length} entries to ${outPath}`,
    JSON.stringify(counts),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
