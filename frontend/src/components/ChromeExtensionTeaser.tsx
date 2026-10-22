import { CHROME_EXTENSION_URL } from "../constants/chromeExtension";

/** Chrome's mark as flat shapes: three colour segments, a white ring and a blue centre. */
function ChromeMark() {
  return (
    <div
      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] border border-gray-200 bg-white"
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]">
        <path fill="#ea4335" d="M12 12 1.608 6A12 12 0 0 1 22.392 6Z" />
        <path fill="#fbbc04" d="M12 12 22.392 6A12 12 0 0 1 12 24Z" />
        <path fill="#34a853" d="M12 12 12 24A12 12 0 0 1 1.608 6Z" />
        <circle cx="12" cy="12" r="5.6" fill="#fff" />
        <circle cx="12" cy="12" r="4.1" fill="#4285f4" />
      </svg>
    </div>
  );
}

export default function ChromeExtensionTeaser() {
  return (
    <div className="reveal h-full">
      <div className="group flex h-full flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <ChromeMark />
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500">Chrome extension</span>
        </div>

        <div>
          <h3 className="text-lg font-semibold leading-snug tracking-tight text-gray-900">
            Create videos from any article you&apos;re reading
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
            Extract the active page, choose a template and voice, and send it to Blog2Video from your
            browser.
          </p>
        </div>

        <a href={CHROME_EXTENSION_URL} target="_blank" rel="noreferrer" className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-purple-600 transition-colors hover:text-purple-700">
          Add to Chrome
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
