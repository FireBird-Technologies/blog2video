import { Link } from "react-router-dom";
import PublicFooter from "../components/public/PublicFooter";
import PublicHeader from "../components/public/PublicHeader";
import Seo from "../components/seo/Seo";
import { tools, toolsHub } from "../content/siteContent";
import type { ToolCategory } from "../content/seoTypes";
import { substackDirectoryPaths } from "../content/substackDirectory";
import { toolsHubSchema } from "../seo/schema";

const categoryLabels: Record<ToolCategory, string> = {
  calculator: "Calculators",
  formatter: "Formatter",
  directory: "Directory",
  analyzer: "Analyzer",
  generator: "Generator",
};

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
              Tools
            </p>
            <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {toolsHub.heroTitle}
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-relaxed text-gray-500">
              {toolsHub.heroDescription}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <span className="rounded-full border border-purple-100 bg-white px-4 py-2 text-sm font-medium text-purple-700">
                {tools.length} interactive tools
              </span>
              <span className="rounded-full border border-purple-100 bg-white px-4 py-2 text-sm font-medium text-purple-700">
                {substackDirectoryPaths.length} directory pages
              </span>
              <span className="rounded-full border border-purple-100 bg-white px-4 py-2 text-sm font-medium text-purple-700">
                Built for Medium, Substack, and writing-first workflows
              </span>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {tools.map((tool) => (
              <Link
                key={tool.slug}
                to={tool.path}
                className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-50 text-sm font-bold text-purple-700">
                    {tool.icon}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-600">
                      {categoryLabels[tool.category]}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-gray-900">{tool.title}</h2>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-gray-600">{tool.description}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {tool.badges.slice(0, 3).map((badge) => (
                    <span
                      key={badge}
                      className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-500"
                    >
                      {badge}
                    </span>
                  ))}
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
