import { Link } from "react-router-dom";
import PublicFooter from "../components/public/PublicFooter";
import PublicHeader from "../components/public/PublicHeader";
import Seo from "../components/seo/Seo";
import { BLOG2VIDEO_URL } from "../config/urls";

/**
 * Deliberately empty hub.
 *
 * content/tools.ts carries 11 tool definitions, but they are blog/newsletter
 * tools whose article-length copy is already indexed on blog2video.app.
 * Rendering them here would publish a second copy of that content on a second
 * domain, which is exactly the duplicate-content risk App.tsx warns about.
 * So this page exists only so the "Tools" nav item resolves instead of 404ing;
 * it ships no article content and is marked noindex until there are
 * PDF2Video-specific tools to put here.
 */
export default function ToolsHub() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Seo
        title="Tools"
        description="PDF2Video tools for turning documents into narrated video. Coming soon."
        path="/tools"
        noindex
      />
      <PublicHeader />
      <main className="mx-auto flex max-w-4xl flex-col items-center px-6 py-28 text-center">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
          Tools
        </p>
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-900">
          Document tools are on the way
        </h1>
        <p className="mb-8 max-w-2xl text-lg leading-relaxed text-gray-500">
          We're building free calculators and generators for teams who publish from PDFs,
          reports, and decks. In the meantime, our creator tools live on Blog2Video.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href={`${BLOG2VIDEO_URL}/tools`}
            className="rounded-lg bg-purple-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-purple-700"
          >
            Browse tools on Blog2Video
          </a>
          <Link
            to="/pdf-to-video"
            className="rounded-lg border border-gray-200 px-5 py-3 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:text-gray-900"
          >
            Turn a PDF into video
          </Link>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
