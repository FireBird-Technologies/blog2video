import { CHROME_EXTENSION_URL } from "../constants/chromeExtension";
import { useExtensionBrowser } from "../hooks/useExtensionBrowser";

interface ChromeExtensionButtonProps {
  className?: string;
  onClick?: () => void;
  /** "pill": white button with purple outline. "row": plain menu row. */
  variant?: "pill" | "row";
}

/**
 * "Add to {browser}" button with the browser's own logo. Renders nothing in
 * Safari, Firefox or mobile browsers, which can't install the extension.
 */
const ChromeExtensionButton = ({ className = "", onClick, variant = "pill" }: ChromeExtensionButtonProps) => {
  const browser = useExtensionBrowser();
  if (!browser) return null;

  const common = {
    href: CHROME_EXTENSION_URL,
    target: "_blank",
    rel: "noopener noreferrer",
    onClick,
    "aria-label": `Add the Blog2Video extension to ${browser.name}`,
    title: "Turn the page you're viewing into a video",
  };

  if (variant === "row") {
    return (
      <a
        {...common}
        className={`group flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-600 hover:bg-purple-50 hover:text-purple-700 transition-colors ${className}`}
      >
        <img src={browser.logo} alt="" className="h-5 w-5 transition-transform duration-700 group-hover:rotate-[360deg]" aria-hidden="true" />
        Add to {browser.name}
      </a>
    );
  }

  return (
    <a
      {...common}
      className={`group inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-purple-500 bg-white py-1 pl-2 pr-2.5 text-xs font-medium text-purple-700 transition-all duration-300 hover:-translate-y-px hover:border-purple-600 hover:bg-purple-50 hover:text-purple-800 hover:shadow-md hover:shadow-purple-500/15 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 ${className}`}
    >
      <img
        src={browser.logo}
        alt=""
        className="h-4 w-4 transition-transform duration-700 ease-out group-hover:rotate-[360deg]"
        aria-hidden="true"
      />
      <span>Add to {browser.name}</span>
      <svg
        aria-hidden="true"
        className="-ml-1 h-3 w-0 -translate-x-1 opacity-0 transition-all duration-300 group-hover:ml-0 group-hover:w-3 group-hover:translate-x-0 group-hover:opacity-100"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
      </svg>
    </a>
  );
};

export default ChromeExtensionButton;
