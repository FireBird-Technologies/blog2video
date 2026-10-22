import { WORDPRESS_PLUGIN_URL } from "../constants/wordpressPlugin";

export default function WordPressPluginTeaser() {
  return (
    <div className="reveal h-full">
      <div className="group flex h-full flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-gray-200 bg-white">
            <img src="/wordpress-icon-mono.svg" alt="WordPress" className="h-[22px] w-[22px] object-contain" />
          </div>
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500">WordPress plugin</span>
        </div>

        <div>
          <h3 className="text-lg font-semibold leading-snug tracking-tight text-gray-900">
            Create videos inside your WordPress editor
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
            Turn the post you&apos;re writing into a narrated video, then add it back to the page as a
            Gutenberg block.
          </p>
        </div>

        <a href={WORDPRESS_PLUGIN_URL} target="_blank" rel="noreferrer" className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-purple-600 transition-colors hover:text-purple-700">
          Explore the WordPress plugin
          <svg
              className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
        </a>
      </div>
    </div>
  );
}
