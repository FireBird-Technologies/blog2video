import { useEffect, useState } from "react";
import { getNewsletterSnippet, sourceErrorMessage, type NewsletterSnippet } from "../api/sources";

interface Props {
  projectId: number;
}

type CopyTarget = "rich" | "html" | "link";

/**
 * "Put this video in a newsletter": a click-to-watch thumbnail linked to the
 * hosted watch page. Email clients can't play video, so this is how video goes
 * into a newsletter. Shown inside the Beehiiv publish modal as the fallback
 * for plans whose API can't write posts (anything below Max/Enterprise).
 *
 * "Copy for editor" puts rich HTML on the clipboard so pasting into a visual
 * editor drops in the image and link directly; "Copy HTML" is for editors with
 * an HTML/code block. Requires a rendered video.
 */
export default function NewsletterSnippetPanel({ projectId }: Props) {
  const [snippet, setSnippet] = useState<NewsletterSnippet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<CopyTarget | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getNewsletterSnippet(projectId)
      .then(({ data }) => {
        if (!cancelled) setSnippet(data);
      })
      .catch((err) => {
        if (!cancelled) setError(sourceErrorMessage(err, "Couldn't create the newsletter snippet."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const flash = (target: CopyTarget) => {
    setCopied(target);
    window.setTimeout(() => setCopied((c) => (c === target ? null : c)), 1800);
  };

  const copy = async (target: CopyTarget) => {
    if (!snippet) return;
    try {
      if (target === "rich" && typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([snippet.html], { type: "text/html" }),
            "text/plain": new Blob([snippet.watch_url], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(target === "link" ? snippet.watch_url : snippet.html);
      }
      flash(target);
    } catch {
      setError("Your browser blocked the clipboard. Select and copy the HTML below instead.");
    }
  };

  const buttonClass =
    "flex-1 px-3 py-2 text-xs font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors";

  return (
    <div>
      <p className="text-xs text-gray-500 mb-4">
        Email can't play video, so readers get a thumbnail that opens the video in their browser. Paste it into
        your post in the Beehiiv editor.
      </p>

      {loading && <div className="text-sm text-gray-400 py-10 text-center">Preparing your newsletter block…</div>}
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">{error}</p>
      )}
      {snippet && !loading && (
        <div className="space-y-4">
          <a href={snippet.watch_url} target="_blank" rel="noopener noreferrer" className="block">
            <img
              src={snippet.thumbnail_url}
              alt="Newsletter thumbnail preview"
              className="w-full rounded-lg border border-gray-200"
            />
          </a>
          <div className="flex flex-col sm:flex-row gap-2">
            <button type="button" onClick={() => void copy("rich")} className={`${buttonClass} bg-purple-600 hover:bg-purple-700 text-white border-purple-600`}>
              {copied === "rich" ? "Copied!" : "Copy for editor"}
            </button>
            <button type="button" onClick={() => void copy("html")} className={buttonClass}>
              {copied === "html" ? "Copied!" : "Copy HTML"}
            </button>
            <button type="button" onClick={() => void copy("link")} className={buttonClass}>
              {copied === "link" ? "Copied!" : "Copy link"}
            </button>
          </div>
          <details className="text-xs">
            <summary className="cursor-pointer text-gray-500 hover:text-gray-700">Show HTML</summary>
            <textarea
              readOnly
              value={snippet.html}
              onFocus={(e) => e.currentTarget.select()}
              className="mt-2 w-full h-28 p-2 font-mono text-[11px] border border-gray-200 rounded-lg bg-gray-50"
            />
          </details>
          <a
            href={snippet.thumbnail_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs text-purple-600 hover:underline"
          >
            Open thumbnail image
          </a>
        </div>
      )}
    </div>
  );
}
