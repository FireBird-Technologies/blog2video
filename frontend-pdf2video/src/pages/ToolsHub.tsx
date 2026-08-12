import { Link } from "react-router-dom";
import PublicFooter from "../components/public/PublicFooter";
import PublicHeader from "../components/public/PublicHeader";
import Seo from "../components/seo/Seo";
import { tools, toolsHub } from "../content/tools";
import { toolsHubSchema } from "../seo/schema";

/**
 * Real hub, indexable.
 *
 * This page was previously an empty noindex placeholder, because the tools it
 * would have listed were a copy of blog2video.app's — and a second copy of
 * indexed article content on a second domain is a duplicate-content problem.
 * The five tools here are PDF2Video's own: original copy, and widgets that
 * exist nowhere else. See content/tools.ts.
 */
export default function ToolsHub() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Seo
        title={toolsHub.title}
        description={toolsHub.description}
        path={toolsHub.path}
        schema={toolsHubSchema()}
      />
      <PublicHeader />

      <main>
        <section className="border-b border-gray-100 bg-gradient-to-b from-purple-50/40 via-white to-white">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
              Free Tools
            </p>
            <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {toolsHub.heroTitle}
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-relaxed text-gray-500">
              {toolsHub.heroDescription}
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => (
              <Link
                key={tool.slug}
                to={tool.path}
                className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-xs font-bold text-white">
                  {tool.icon}
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-600">
                  {tool.eyebrow}
                </p>
                <h2 className="mt-2 text-xl font-semibold text-gray-900 group-hover:text-purple-700">
                  {tool.title}
                </h2>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-gray-600">
                  {tool.description}
                </p>
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {tool.badges.map((badge) => (
                    <span
                      key={badge}
                      className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] text-gray-500"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="border-t border-gray-100 bg-gray-50/70">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">
                  What "free" means on these pages
                </h2>
                <div className="mt-4 space-y-4 text-base leading-relaxed text-gray-600">
                  <p>
                    Free means a Google account and no card. It does not mean anonymous: every
                    tool here does its work on our servers — extraction through the same parser
                    our video pipeline uses, and summarising, scripting, storyboarding, and
                    narration through real models. Each run costs us something, so each run needs
                    to belong to someone.
                  </p>
                  <p>
                    What you get back is yours. Copy it, download it, use it somewhere else. Your
                    document is processed to produce your result — it is not saved as a project
                    and it is not used to train anything.
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
                  Start Here
                </p>
                <div className="space-y-4">
                  <Link to="/pdf-to-video" className="block">
                    <p className="text-sm font-semibold text-gray-900">PDF to video</p>
                    <p className="text-sm leading-relaxed text-gray-500">
                      The full pipeline: document in, narrated MP4 out.
                    </p>
                  </Link>
                  <Link to="/blogs" className="block">
                    <p className="text-sm font-semibold text-gray-900">The blog</p>
                    <p className="text-sm leading-relaxed text-gray-500">
                      Workflows for turning reports, papers, and decks into video.
                    </p>
                  </Link>
                  <Link to="/pricing" className="block">
                    <p className="text-sm font-semibold text-gray-900">Pricing</p>
                    <p className="text-sm leading-relaxed text-gray-500">
                      What the rendered videos cost once the free tier runs out.
                    </p>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
