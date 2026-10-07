import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BACKEND_URL } from "../api/client";
import { apiDocs as docs, type ApiDocBlock, type ApiDocEndpoint } from "../content/apiDocs";
import { useAuth } from "../hooks/useAuth";
import PublicHeader from "../components/public/PublicHeader";
import PublicFooter from "../components/public/PublicFooter";
import Seo from "../components/seo/Seo";
import { apiDocsSchema } from "../seo/schema";

const METHOD_STYLES: Record<string, string> = {
  GET: "bg-sky-50 text-sky-700 ring-sky-200",
  POST: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  PUT: "bg-amber-50 text-amber-700 ring-amber-200",
  PATCH: "bg-violet-50 text-violet-700 ring-violet-200",
  DELETE: "bg-rose-50 text-rose-700 ring-rose-200",
};

function baseUrl(): string {
  return BACKEND_URL || window.location.origin;
}

function anchorFor(e: ApiDocEndpoint): string {
  return `${e.method}-${e.path}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** Renders `code` spans and ==highlighted== text inside prose written in the docs catalog. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|==[^=]+==)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("`") && part.endsWith("`") ? (
          <code key={i} className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[0.85em] text-gray-800">
            {part.slice(1, -1)}
          </code>
        ) : part.startsWith("==") && part.endsWith("==") ? (
          <span key={i} className="font-medium text-purple-700">
            {part.slice(2, -2)}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function useCopy(): [string | null, (id: string, text: string) => void] {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const copy = useCallback((id: string, text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(id);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(null), 1800);
      })
      .catch(() => setCopied(null));
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [copied, copy];
}

function CodeBlock({
  label,
  text,
  copyId,
  copied,
  onCopy,
}: {
  label: string;
  text: string;
  copyId: string;
  copied: string | null;
  onCopy: (id: string, text: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-800 bg-gray-900">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400">{label}</span>
        <button
          type="button"
          onClick={() => onCopy(copyId, text)}
          className="rounded px-1.5 py-0.5 text-[11px] text-gray-400 hover:bg-white/10 hover:text-white"
        >
          {copied === copyId ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-96 overflow-auto p-3 text-xs leading-relaxed text-gray-100">
        <code>{text}</code>
      </pre>
    </div>
  );
}

function FieldTable({ rows, showIn }: { rows: { name: string; in?: string; type: string; required: boolean; description: string }[]; showIn?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-left text-xs">
        <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
          <tr>
            <th className="px-3 py-2 font-medium">Name</th>
            {showIn && <th className="px-3 py-2 font-medium">In</th>}
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r) => (
            <tr key={`${r.in ?? ""}-${r.name}`} className="align-top">
              <td className="whitespace-nowrap px-3 py-2 font-mono text-gray-900">
                {r.name}
                {r.required && <span className="ml-1 text-rose-500" title="Required">*</span>}
              </td>
              {showIn && <td className="px-3 py-2 text-gray-500">{r.in}</td>}
              <td className="whitespace-nowrap px-3 py-2 text-gray-500">{r.type}</td>
              <td className="px-3 py-2 text-gray-700">
                <Rich text={r.description} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EndpointCard({
  e,
  copied,
  onCopy,
}: {
  e: ApiDocEndpoint;
  copied: string | null;
  onCopy: (id: string, text: string) => void;
}) {
  const id = anchorFor(e);
  const hasRequest = e.request_example !== null && e.request_example !== undefined;
  return (
    <article id={id} className="scroll-mt-32 glass-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold ring-1 ring-inset ${METHOD_STYLES[e.method] ?? "bg-gray-100 text-gray-700 ring-gray-200"}`}
        >
          {e.method}
        </span>
        <code className="break-all font-mono text-sm text-gray-900">{e.path}</code>
      </div>
      <h3 className="mt-3 text-base font-semibold text-gray-900">{e.summary}</h3>
      {e.description && (
        <p className="mt-1 text-sm leading-relaxed text-gray-600">
          <Rich text={e.description} />
        </p>
      )}

      {e.params.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-2 text-xs font-semibold text-gray-900">Parameters</h4>
          <FieldTable rows={e.params} showIn />
        </div>
      )}

      {e.body && (
        <div className="mt-4">
          <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-900">
            Request body
            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-normal text-gray-500">
              {e.body.content_type}
            </span>
          </h4>
          <FieldTable rows={e.body.fields} />
        </div>
      )}

      <div className={`mt-4 grid gap-3 ${hasRequest ? "lg:grid-cols-2" : ""}`}>
        {hasRequest && (
          <CodeBlock
            label="Request"
            text={asText(e.request_example).replace(/\$B2V/g, baseUrl()).replace(/\$KEY/g, "$B2V_API_KEY")}
            copyId={`req-${id}`}
            copied={copied}
            onCopy={onCopy}
          />
        )}
        {e.response_example !== null && e.response_example !== undefined ? (
          <CodeBlock
            label={`Response · ${e.status}`}
            text={asText(e.response_example)}
            copyId={`res-${id}`}
            copied={copied}
            onCopy={onCopy}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-gray-200 px-3 py-2.5 text-xs text-gray-500">
            Response · {e.status}
          </div>
        )}
      </div>
      {e.response_note && (
        <p className="mt-2 text-xs leading-relaxed text-gray-500">
          <Rich text={e.response_note} />
        </p>
      )}
      {e.errors.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-gray-500">
          {e.errors.map((err) => (
            <li key={err}>
              <span className="font-medium text-gray-700">Error:</span> <Rich text={err} />
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function GuideBlock({ block, copied, onCopy, id }: { block: ApiDocBlock; copied: string | null; onCopy: (id: string, text: string) => void; id: string }) {
  if (block.type === "p") {
    return (
      <p className="text-sm leading-relaxed text-gray-600">
        <Rich text={block.text} />
      </p>
    );
  }
  if (block.type === "example") {
    const hasBody = block.body !== undefined;
    return (
      <div className={`grid gap-3 ${hasBody ? "lg:grid-cols-2" : ""}`}>
        {hasBody && (
          <CodeBlock label="Body" text={asText(block.body)} copyId={`body-${id}`} copied={copied} onCopy={onCopy} />
        )}
        <CodeBlock
          label={`Response · ${block.status}`}
          text={asText(block.response)}
          copyId={`res-${id}`}
          copied={copied}
          onCopy={onCopy}
        />
      </div>
    );
  }
  if (block.type === "list") {
    return (
      <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-gray-600">
        {block.items.map((item) => (
          <li key={item}>
            <Rich text={item} />
          </li>
        ))}
      </ol>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs text-gray-500">
          <tr>
            {block.columns.map((c) => (
              <th key={c} className="px-3 py-2 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {block.rows.map((row) => (
            <tr key={row.join("|")} className="align-top">
              {row.map((cell, i) => (
                <td key={i} className={`px-3 py-2 ${i === 0 ? "whitespace-nowrap font-mono text-gray-900" : "text-gray-600"}`}>
                  <Rich text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The endpoint reference (guides, sidebar, search, endpoint cards), from content/apiDocs.ts. */
function ApiReference() {
  const [query, setQuery] = useState("");
  const [copied, copy] = useCopy();

  const q = query.trim().toLowerCase();
  const sections = useMemo(() => {
    if (!q) return docs.sections;
    return docs.sections
      .map((s) => ({
        ...s,
        endpoints: s.endpoints.filter((e) =>
          `${e.method} ${e.path} ${e.summary} ${e.description}`.toLowerCase().includes(q),
        ),
      }))
      .filter((s) => s.endpoints.length > 0);
  }, [q]);
  const total = sections.reduce((n, s) => n + s.endpoints.length, 0);

  return (
    <div>
      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Sidebar */}
        <aside className="hidden lg:block">
          <nav className="sticky top-20 max-h-[calc(100vh-6rem)] space-y-5 overflow-y-auto pb-6 text-sm">
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Guides</p>
              <ul className="space-y-0.5">
                {docs.guides.map((g) => (
                  <li key={g.id}>
                    <a href={`#${g.id}`} className="block rounded-md px-2 py-1 text-gray-600 hover:bg-gray-100 hover:text-gray-900">
                      {g.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Endpoints</p>
              <ul className="space-y-0.5">
                {docs.sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="flex items-center justify-between rounded-md px-2 py-1 text-gray-600 hover:bg-gray-100 hover:text-gray-900">
                      <span>{s.title}</span>
                      <span className="text-[11px] text-gray-400">{s.endpoints.length}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </aside>

        <main className="min-w-0 space-y-10">
          {/* Mobile jump menu */}
          <select
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm lg:hidden"
            defaultValue=""
            onChange={(ev) => {
              if (ev.target.value) document.getElementById(ev.target.value)?.scrollIntoView({ behavior: "smooth" });
            }}
            aria-label="Jump to section"
          >
            <option value="" disabled>
              Jump to…
            </option>
            {docs.guides.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
            {docs.sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>

          {!q &&
            docs.guides.map((g) => (
              <section key={g.id} id={g.id} className="scroll-mt-32">
                <h2 className="text-lg font-semibold text-gray-900">{g.title}</h2>
                <div className="mt-3 space-y-3">
                  {g.blocks.map((b, i) => (
                    <GuideBlock key={i} block={b} copied={copied} onCopy={copy} id={`${g.id}-${i}`} />
                  ))}
                </div>
              </section>
            ))}

          <div className="sticky top-16 z-10 -mx-1 bg-white/90 px-1 py-2 backdrop-blur">
            <input
              value={query}
              onChange={(ev) => setQuery(ev.target.value)}
              placeholder="Search endpoints"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
              aria-label="Search endpoints"
            />
            {q && (
              <p className="mt-1.5 text-xs text-gray-500">
                {total} endpoint{total === 1 ? "" : "s"} match “{query.trim()}”
              </p>
            )}
          </div>

          {sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-32">
              <h2 className="text-lg font-semibold text-gray-900">{s.title}</h2>
              <p className="mt-1 text-sm text-gray-500">
                <Rich text={s.description} />
              </p>
              <div className="mt-4 space-y-4">
                {s.endpoints.map((e) => (
                  <EndpointCard key={anchorFor(e)} e={e} copied={copied} onCopy={copy} />
                ))}
              </div>
            </section>
          ))}
          {q && total === 0 && <p className="text-sm text-gray-500">No endpoints match your search.</p>}
        </main>
      </div>
    </div>
  );
}

const SEO_DESCRIPTION =
  "Blog2Video API reference: create, edit and render narrated videos from your own app with an API key.";

/** Public API Documentation page (/api-docs), linked from the landing navbar and the app navbar. */
export default function ApiDocs() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-white">
      <Seo title="API Documentation" description={SEO_DESCRIPTION} path="/api-docs" schema={apiDocsSchema()} />
      <PublicHeader />
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto pb-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">API Documentation</h1>
              <p className="text-sm text-gray-400 mt-1">
                Reference for all endpoints available to API keys. Paths are relative to{" "}
                <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-700">{baseUrl()}</code>.
                The API is included with every paid plan.
              </p>
            </div>
            <Link
              to={user ? "/account/api-keys" : "/signup"}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              {user ? "Manage API Keys" : "Get an API key"}
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
          <div className="mt-8">
            <ApiReference />
          </div>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
