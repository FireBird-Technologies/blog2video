import { Link } from "react-router-dom";

export default function WordPressPluginTeaser() {
  return (
    <div className="reveal">
      <div
        className="mx-auto flex max-w-4xl flex-col items-center gap-6 rounded-3xl border border-purple-100/60 px-6 py-10 text-center sm:px-12 sm:py-12 md:flex-row md:items-center md:gap-10 md:text-left"
        style={{
          background: "rgba(255,255,255,0.55)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow:
            "0 4px 24px rgba(124,58,237,0.08), 0 1px 2px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.90)",
        }}
      >
        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-[#21759b]/10 text-2xl font-bold text-[#21759b]">
          WP
        </div>

        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-widest text-purple-600">
            New: WordPress Plugin
          </p>
          <h2 className="mt-2 text-xl font-semibold text-gray-900 sm:text-2xl">
            Turn your posts into videos without leaving WordPress
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">
            Install the Blog2Video plugin, connect your account, and generate narrated videos
            straight from the post editor — no copy-pasting, no extra tab.
          </p>
        </div>

        <div className="flex-shrink-0">
          <Link
            to="/tools/wordpress-plugin"
            className="group inline-flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-purple-700"
          >
            Download the plugin
            <svg
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
