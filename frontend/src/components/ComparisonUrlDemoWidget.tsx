import { useState } from "react";
import { Link } from "react-router-dom";

async function fetchOgData(url: string): Promise<{ title?: string; description?: string; image?: string }> {
  try {
    const res = await fetch(`https://jsonlink.io/api/extract?url=${encodeURIComponent(url)}`);
    if (!res.ok) return {};
    const data = await res.json();
    return {
      image: data.images?.[0] || undefined,
      title: data.title || undefined,
      description: data.description || undefined,
    };
  } catch {
    return {};
  }
}

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

type OgPreview = {
  title?: string;
  description?: string;
  image?: string;
  hostname: string;
};

export function ComparisonUrlDemoWidget() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<OgPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!isValidHttpUrl(trimmed)) {
      setError("Enter a valid URL starting with https://");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const og = await fetchOgData(trimmed);
      setPreview({ ...og, hostname: new URL(trimmed).hostname });
    } catch {
      setError("Couldn't fetch that URL — try a different one.");
    } finally {
      setLoading(false);
    }
  };

  const signUpHref = preview
    ? `/?ref=comparison-demo&url=${encodeURIComponent(url.trim())}`
    : "/?ref=comparison-demo";

  return (
    <div className="rounded-3xl border border-purple-100 bg-purple-50/60 p-8">
      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
        Try it with your content
      </p>
      <h2 className="text-2xl font-semibold text-gray-900">
        Paste your blog or newsletter URL
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-500">
        See how Blog2Video would structure your actual content — no sign-up needed to preview.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setPreview(null); setError(null); }}
          placeholder="https://yoursubstack.com/p/your-post"
          className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm transition focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-purple-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-60"
        >
          {loading ? "Fetching…" : "Preview"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      {preview && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {preview.image && (
            <img
              src={preview.image}
              alt=""
              className="h-40 w-full object-cover"
            />
          )}
          <div className="p-6">
            <p className="text-xs font-medium text-purple-600">{preview.hostname}</p>
            <h3 className="mt-1 text-base font-semibold leading-snug text-gray-900 line-clamp-2">
              {preview.title || "Your article"}
            </h3>
            {preview.description && (
              <p className="mt-2 text-sm leading-relaxed text-gray-500 line-clamp-3">
                {preview.description}
              </p>
            )}
            <div className="mt-4 rounded-xl border border-purple-100 bg-purple-50/60 p-4">
              <p className="text-sm font-medium text-purple-800">
                Blog2Video would map this article's headings to scenes, write narration from the original text, and generate a polished video in under 3 minutes — no rewriting required.
              </p>
            </div>
            <div className="mt-5">
              <Link
                to={signUpHref}
                className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-700"
              >
                Turn this into a video — free
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
