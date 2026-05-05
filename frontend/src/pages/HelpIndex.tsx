import { Link } from "react-router-dom";
import PublicFooter from "../components/public/PublicFooter";
import PublicHeader from "../components/public/PublicHeader";
import Seo from "../components/seo/Seo";
import { helpPosts } from "../content/siteContent";
import { helpIndexSchema } from "../seo/schema";

export default function HelpIndex() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Seo
        title="Help / How-to"
        description="Step-by-step Blog2Video help guides with embedded explainers for creating projects, editing scenes, changing voiceover, and working with templates."
        path="/help"
        schema={helpIndexSchema()}
      />
      <PublicHeader />

      <main>
        <section className="border-b border-gray-100 bg-gradient-to-b from-purple-50/50 via-white to-white">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
              Help / How-to
            </p>
            <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Step-by-step Blog2Video guides with short visual explainers
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-relaxed text-gray-500">
              Learn the core Blog2Video workflows in a wikiHow-style format. Each guide breaks the task into clear steps and includes a small Remotion walkthrough that mirrors the product UI.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {helpPosts.map((post) => (
              <Link
                key={post.slug}
                to={`/help/${post.slug}`}
                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="mb-5 overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                  <img
                    src={post.heroImage || "/og-image-v2.png"}
                    alt={post.heroImageAlt || post.title}
                    className="h-44 w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-600">
                  {post.category}
                </p>
                <h2 className="mt-3 text-xl font-semibold text-gray-900">{post.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">{post.description}</p>
                <div className="mt-5 flex flex-wrap gap-4 text-sm text-gray-500">
                  <span>{post.steps.length} steps</span>
                  <span>{post.readTime}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
