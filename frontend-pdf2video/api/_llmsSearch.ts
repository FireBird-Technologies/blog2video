/**
 * Search behind GET /llms?query= and /llms/json?query=.
 *
 * Deliberately dependency-free and index-free at runtime: the corpus is a static
 * asset (/llms-index.json, written by scripts/build-seo.ts) that the handler
 * fetches from its own origin. No database, no vector store, no embedding call
 * on the request path — the whole site is ~330KB of text, which is small enough
 * that lexical scoring in memory beats the latency and cost of anything smarter.
 *
 * Shared by the Vercel handler (api/llms.ts) and the Cloudflare Pages Function
 * (functions/llms.ts) so the two hosts can never drift apart.
 */

export type LlmsDoc = {
  path: string;
  title: string;
  description: string;
  type: "page" | "tool" | "post";
  blocks: string[];
};

export type LlmsIndex = {
  generatedAt: string;
  site: string;
  name: string;
  docs: LlmsDoc[];
};

export type Hit = {
  title: string;
  url: string;
  type: LlmsDoc["type"];
  score: number;
  description: string;
  excerpts: string[];
};

/** Words carrying no discriminating signal in a query over one product's site. */
const STOP_WORDS = new Set([
  "a", "about", "all", "also", "an", "and", "any", "are", "as", "at", "be",
  "been", "but", "by", "can", "could", "did", "do", "does", "for", "from",
  "get", "got", "had", "has", "have", "here", "how", "i", "if", "in", "into",
  "is", "it", "its", "just", "make", "me", "more", "most", "my", "need", "not",
  "of", "on", "only", "or", "should", "so", "some", "such", "than", "that",
  "the", "their", "them", "then", "there", "these", "they", "this", "those",
  "to", "up", "use", "using", "very", "want", "was", "we", "were", "what",
  "when", "where", "which", "who", "why", "will", "with", "would", "you",
  "your",
]);

/**
 * Vocabulary bridges for the handful of questions agents actually arrive with.
 * The site says "pricing" and "$19.99"; a model asks "how much does it cost".
 * Without this the pricing page loses to any blog post that happens to use the
 * word "cost" in passing. Kept deliberately short — this is a bridge for known
 * commercial intents, not a general thesaurus.
 */
const ALIASES: Record<string, string[]> = {
  cost: ["price", "pricing", "plan"],
  costs: ["price", "pricing", "plan"],
  price: ["pricing", "cost", "plan"],
  pricing: ["price", "cost", "plan"],
  cheap: ["price", "pricing", "free"],
  signup: ["account", "sign", "login"],
  register: ["account", "sign", "login"],
  account: ["sign", "login", "google"],
  refund: ["cancel", "billing", "subscription"],
  cancel: ["refund", "billing", "subscription"],
  length: ["long", "duration", "minutes"],
  duration: ["long", "length", "minutes"],
  languages: ["language", "voice", "narration"],
  voice: ["narration", "voiceover", "elevenlabs"],
  logo: ["brand", "branding", "watermark"],
};

export type WeightedTerm = { term: string; weight: number };

/**
 * Alias hits are worth a fraction of a real query term. At equal weight a
 * common expansion ("account" -> "google") drowns the word the user actually
 * typed, and every SEO page on the site outranks the one with the answer.
 */
const ALIAS_WEIGHT = 0.35;

function tokenize(input: string): WeightedTerm[] {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((term) => term.length > 1 && !STOP_WORDS.has(term));

  const weights = new Map<string, number>();
  for (const term of base) weights.set(term, 1);
  for (const term of base) {
    for (const alias of ALIASES[term] ?? []) {
      if (!weights.has(alias)) weights.set(alias, ALIAS_WEIGHT);
    }
  }
  return [...weights].map(([term, weight]) => ({ term, weight }));
}

/**
 * Light stemming so "converting"/"converts"/"converter" all match "convert".
 * A real stemmer is not worth the bytes for a corpus this size.
 */
function stem(term: string): string {
  return term
    .replace(/(ing|edly|edness)$/, "")
    .replace(/(ers|er|ed|es|s)$/, "")
    .replace(/(ion|ions)$/, "");
}

function scoreText(text: string, terms: WeightedTerm[]): number {
  const haystack = ` ${text.toLowerCase()} `;
  let score = 0;
  for (const { term, weight } of terms) {
    // Whole-word hits are worth far more than substring hits, so "video" does
    // not get credit for appearing inside "videography".
    const whole = haystack.split(new RegExp(`\\b${term}\\b`, "g")).length - 1;
    if (whole > 0) {
      score += whole * 3 * weight;
      continue;
    }
    const stemmed = stem(term);
    if (stemmed.length > 2 && haystack.includes(stemmed)) score += weight;
  }
  return score;
}

export function search(index: LlmsIndex, rawQuery: string, limit = 5): Hit[] {
  const terms = tokenize(rawQuery);
  if (!terms.length) return [];

  const hits: Hit[] = [];

  for (const doc of index.docs) {
    // Title and description are the strongest signal of what a page is about,
    // so they are weighted above body copy rather than concatenated into it.
    const titleScore = scoreText(doc.title, terms) * 5;
    const descScore = scoreText(doc.description, terms) * 3;
    const pathScore = scoreText(doc.path.replace(/[/-]/g, " "), terms) * 4;

    const scoredBlocks = doc.blocks
      .map((block) => ({ block, score: scoreText(block, terms) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    // Normalised by document length. Without this a 3,000-word blog post beats
    // the focused page on any common term purely by accumulating more hits, and
    // the endpoint sends agents to essays instead of answers.
    const rawBody = scoredBlocks.reduce((sum, entry) => sum + entry.score, 0);
    const bodyScore = rawBody / Math.sqrt(Math.max(doc.blocks.length, 1));

    // An agent asking "convert pdf to video" wants the page that does it, not an
    // essay that discusses it. Blog posts are long and keyword-dense enough to
    // outrank the product page on raw overlap, so canonical pages get a nudge.
    const TYPE_WEIGHT = { page: 1.35, tool: 1.2, post: 1 } as const;
    const total = (titleScore + descScore + pathScore + bodyScore) * TYPE_WEIGHT[doc.type];
    if (total <= 0) continue;

    hits.push({
      title: doc.title,
      url: `${index.site}${doc.path}`,
      type: doc.type,
      score: Math.round(total * 10) / 10,
      description: doc.description,
      excerpts: scoredBlocks.slice(0, 3).map((entry) => entry.block),
    });
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function renderUsage(site: string): string {
  return `# ${site}/llms — queryable knowledge base

Ask a question and get only the relevant parts of this site back, instead of
fetching every page.

  GET ${site}/llms?query=how+much+does+it+cost         -> plain text
  GET ${site}/llms/json?query=how+much+does+it+cost    -> JSON

Optional: &limit=N (1-20, default 5)

Other entry points:
  ${site}/llms.txt        compact map of the site (~3.7k tokens)
  ${site}/llms-full.txt   complete text of every page, one document
  ${site}/llms-index.json the raw corpus this endpoint searches
`;
}

export function renderText(query: string, hits: Hit[], site: string): string {
  if (!hits.length) {
    return `No matches for "${query}" on ${site}.\n\nTry broader terms, or read ${site}/llms.txt for a map of what is here.\n`;
  }

  const body = hits
    .map((hit, index) => {
      const excerpts = hit.excerpts.map((excerpt) => `   ${excerpt}`).join("\n\n");
      return `${index + 1}. ${hit.title}\n   ${hit.url}\n\n${excerpts}`;
    })
    .join("\n\n---\n\n");

  return `Query: ${query}\nSource: ${site}\n${hits.length} result(s)\n\n${body}\n`;
}
