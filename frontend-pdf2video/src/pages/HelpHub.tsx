import { Link } from "react-router-dom";
import PublicFooter from "../components/public/PublicFooter";
import PublicHeader from "../components/public/PublicHeader";
import Seo from "../components/seo/Seo";
import { BLOG2VIDEO_URL } from "../config/urls";

/**
 * Deliberately empty hub — same reasoning as ToolsHub.tsx.
 *
 * Help articles are long-form indexed content on blog2video.app; mirroring
 * them onto pdf2vid.com is the duplicate-content case App.tsx calls out.
 * This page exists so the "Help" nav item resolves, points users at the real
 * help centre, and stays noindex until PDF2Video has its own articles.
 */
export default function HelpHub() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Seo
        title="Help"
        description="Get help with PDF2Video — turning PDFs, reports, and decks into narrated video."
        path="/help"
        noindex
      />
      <PublicHeader />
      <main className="mx-auto flex max-w-4xl flex-col items-center px-6 py-28 text-center">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
          Help
        </p>
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-900">
          Need a hand with your documents?
        </h1>
        <p className="mb-8 max-w-2xl text-lg leading-relaxed text-gray-500">
          PDF2Video-specific guides are being written. Our full help centre — covering
          scripts, voices, templates, and rendering — is available on Blog2Video, and the
          team is always one message away.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href={`${BLOG2VIDEO_URL}/help`}
            className="rounded-lg bg-purple-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-purple-700"
          >
            Visit the help centre
          </a>
          <Link
            to="/contact"
            className="rounded-lg border border-gray-200 px-5 py-3 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:text-gray-900"
          >
            Contact support
          </Link>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
