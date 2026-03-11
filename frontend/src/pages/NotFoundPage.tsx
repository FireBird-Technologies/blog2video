import { Link } from "react-router-dom";
import PublicFooter from "../components/public/PublicFooter";
import PublicHeader from "../components/public/PublicHeader";
import Seo from "../components/seo/Seo";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Seo
        title="Page Not Found"
        description="The page you requested could not be found."
        path="/404"
        noindex
      />
      <PublicHeader />
      <main className="mx-auto flex max-w-4xl flex-col items-center px-6 py-28 text-center">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
          404
        </p>
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-900">
          This page does not exist
        </h1>
        <p className="mb-8 max-w-2xl text-lg leading-relaxed text-gray-500">
          The route may have moved, expired, or never existed. Head back to the main workflows or the blog and keep exploring.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="rounded-lg bg-purple-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-purple-700"
          >
            Go home
          </Link>
          <Link
            to="/blogs"
            className="rounded-lg border border-gray-200 px-5 py-3 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:text-gray-900"
          >
            Visit the blog
          </Link>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
