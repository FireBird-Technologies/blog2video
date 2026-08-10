import { Link, useParams } from "react-router-dom";
import { ToolWidget } from "../components/tools/ToolWidgets";
import PublicFooter from "../components/public/PublicFooter";
import PublicHeader from "../components/public/PublicHeader";
import Seo from "../components/seo/Seo";
import { getStructuredInternalLinks, getTool } from "../content/siteContent";
import NotFoundPage from "./NotFoundPage";
import { toolPageSchema } from "../seo/schema";

/**
 * The widget renders above the fold, before any of the article copy.
 *
 * Someone arriving on "free pdf summarizer" wants the box, not an essay about
 * the box. The prose below exists for the crawler and for the smaller group who
 * scroll — putting it first would bury the thing the page promised.
 */
export default function ToolPage() {
  const { slug } = useParams<{ slug: string }>();
  const tool = slug ? getTool(slug) : undefined;

  if (!tool) return <NotFoundPage />;

  const relatedLinks = getStructuredInternalLinks(tool.relatedPaths);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Seo
        title={tool.title}
        description={tool.description}
        path={tool.path}
        schema={toolPageSchema(tool)}
      />
      <PublicHeader />

      <main>
        <section className="border-b border-gray-100 bg-gradient-to-b from-purple-50/40 via-white to-white">
          <div className="mx-auto max-w-6xl px-6 pb-10 pt-16">
            <nav aria-label="Breadcrumb" className="mb-5 text-xs text-gray-400">
              <Link to="/" className="hover:text-gray-600">
                Home
              </Link>
              <span className="mx-2">/</span>
              <Link to="/tools" className="hover:text-gray-600">
                Tools
              </Link>
              <span className="mx-2">/</span>
              <span className="text-gray-500">{tool.eyebrow}</span>
            </nav>

            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
              {tool.eyebrow}
            </p>
            <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {tool.heroTitle}
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-relaxed text-gray-500">
              {tool.heroDescription}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {tool.badges.map((badge) => (
                <span
                  key={badge}
                  className="rounded-full border border-purple-100 bg-white px-3 py-1 text-xs font-medium text-purple-700"
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-10">
          <ToolWidget slug={tool.slug} />
        </section>

        <section className="border-y border-gray-100 bg-gray-50/70">
          <div className="mx-auto max-w-6xl px-6 py-12">
            <div className="grid gap-6 md:grid-cols-3">
              {tool.proofPoints.map((point) => (
                <div key={point} className="rounded-2xl border border-gray-200 bg-white p-6">
                  <p className="text-sm leading-relaxed text-gray-600">{point}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-[1.3fr_0.9fr]">
            <div className="space-y-10">
              {tool.sections.map((section) => (
                <section key={section.title}>
                  <h2 className="text-2xl font-semibold text-gray-900">{section.title}</h2>
                  <div className="mt-4 space-y-4 text-base leading-relaxed text-gray-600">
                    {section.body.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                  {section.bullets?.length ? (
                    <ul className="mt-4 space-y-2 text-sm text-gray-600">
                      {section.bullets.map((bullet) => (
                        <li key={bullet} className="flex gap-2">
                          <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-purple-500" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}
            </div>

            <aside className="space-y-6">
              <div className="rounded-2xl border border-purple-100 bg-purple-50/70 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
                  Next Step
                </p>
                <h2 className="mt-2 text-xl font-semibold text-gray-900">
                  The document, as a video people finish
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">
                  Same file, narrated over its own figures and headings, exported as an MP4 for
                  LinkedIn, YouTube, or your own site.
                </p>
                <Link
                  to="/pdf-to-video"
                  className="mt-4 inline-flex items-center rounded-full bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-700"
                >
                  See how it works
                </Link>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
                  Related Pages
                </p>
                <div className="space-y-4">
                  {relatedLinks.map((link) => (
                    <Link key={link.path} to={link.path} className="block">
                      <p className="text-sm font-semibold text-gray-900">{link.label}</p>
                      <p className="text-sm leading-relaxed text-gray-500">{link.description}</p>
                    </Link>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="border-y border-gray-100 bg-gray-50/70">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <h2 className="text-3xl font-semibold text-gray-900">Frequently asked questions</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {tool.faq.map((entry) => (
                <div key={entry.question} className="rounded-2xl border border-gray-200 bg-white p-6">
                  <h3 className="text-base font-semibold text-gray-900">{entry.question}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-gray-600">{entry.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
