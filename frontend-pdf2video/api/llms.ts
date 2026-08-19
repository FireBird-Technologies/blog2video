/**
 * GET /llms?query=...       -> plain text
 * GET /llms/json?query=...  -> JSON
 *
 * Vercel Edge function. The Cloudflare Pages equivalent is functions/llms.ts;
 * both call the same search module so the two hosts return identical answers.
 */
import { renderText, renderUsage, search, type LlmsIndex } from "./_llmsSearch";

export const config = { runtime: "edge" };

/**
 * The corpus is a static asset on the same deployment, so it is immutable for
 * the life of that deployment. Cache it per isolate to avoid refetching 330KB
 * on every request; a new deploy gets a new isolate and therefore a fresh copy.
 */
let cached: LlmsIndex | null = null;

async function loadIndex(origin: string): Promise<LlmsIndex> {
  if (cached) return cached;
  const response = await fetch(`${origin}/llms-index.json`);
  if (!response.ok) {
    throw new Error(`llms-index.json unavailable (${response.status})`);
  }
  cached = (await response.json()) as LlmsIndex;
  return cached;
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  // Two ways in: Cloudflare routes /llms/json straight here so the path still
  // says "/json", while the Vercel rewrite lands on /api/llms and carries the
  // intent in ?format=json instead. Accept either.
  const wantsJson =
    url.pathname.endsWith("/json") || url.searchParams.get("format") === "json";
  const query = (url.searchParams.get("query") ?? url.searchParams.get("q") ?? "").trim();

  const limitParam = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 20) : 5;

  const textHeaders = {
    "content-type": "text/plain; charset=utf-8",
    // Agents are the only consumers, and they often call from a different origin.
    "access-control-allow-origin": "*",
    "cache-control": "public, max-age=3600",
  };

  let index: LlmsIndex;
  try {
    index = await loadIndex(url.origin);
  } catch {
    return new Response(
      `Knowledge base temporarily unavailable. Read ${url.origin}/llms.txt instead.\n`,
      { status: 503, headers: textHeaders }
    );
  }

  // No query is not an error — it is an agent discovering the endpoint. Tell it
  // how to use it rather than returning an empty result set.
  if (!query) {
    if (wantsJson) {
      return new Response(
        JSON.stringify(
          {
            usage: `${index.site}/llms?query=your+question`,
            json: `${index.site}/llms/json?query=your+question`,
            map: `${index.site}/llms.txt`,
            full: `${index.site}/llms-full.txt`,
            documents: index.docs.length,
            generatedAt: index.generatedAt,
          },
          null,
          2
        ),
        {
          status: 200,
          headers: { ...textHeaders, "content-type": "application/json; charset=utf-8" },
        }
      );
    }
    return new Response(renderUsage(index.site), { status: 200, headers: textHeaders });
  }

  const hits = search(index, query, limit);

  if (wantsJson) {
    return new Response(
      JSON.stringify({ query, site: index.site, count: hits.length, results: hits }, null, 2),
      {
        status: 200,
        headers: { ...textHeaders, "content-type": "application/json; charset=utf-8" },
      }
    );
  }

  return new Response(renderText(query, hits, index.site), { status: 200, headers: textHeaders });
}
