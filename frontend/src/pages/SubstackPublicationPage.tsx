import { Link, useLocation } from "react-router-dom";
import PublicFooter from "../components/public/PublicFooter";
import PublicHeader from "../components/public/PublicHeader";
import Seo from "../components/seo/Seo";
import {
  getSubstackDirectoryNichePath,
  getSubstackDirectoryPage,
  pricingLabels,
  substackNiches,
} from "../content/substackDirectory";
import NotFoundPage from "./NotFoundPage";
import { substackDirectoryPublicationSchema } from "../seo/schema";

export default function SubstackPublicationPage() {
  const location = useLocation();
  const page = getSubstackDirectoryPage(location.pathname);

  if (!page || page.kind !== "publication") return <NotFoundPage />;

  const relatedNiches = substackNiches
    .filter((niche) => niche.publicationSlugs.includes(page.publication.slug))
    .slice(0, 6);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Seo
        title={page.title}
        description={page.description}
        path={page.path}
        schema={substackDirectoryPublicationSchema(page.publication, page.path, page.faq)}
      />
      <PublicHeader />

      <main>
        <section className="border-b border-gray-100 bg-gradient-to-b from-purple-50/40 via-white to-white">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
              Publication Profile
            </p>
            <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {page.publication.name}
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-relaxed text-gray-500">
              {page.publication.description}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="rounded-full border border-purple-100 bg-white px-3 py-1 text-xs font-medium text-purple-700">
                {pricingLabels[page.publication.pricingModel]}
              </span>
              <span className="rounded-full border border-purple-100 bg-white px-3 py-1 text-xs font-medium text-purple-700">
                {page.publication.cadence}
              </span>
              <span className="rounded-full border border-purple-100 bg-white px-3 py-1 text-xs font-medium text-purple-700">
                {page.publication.tone}
              </span>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-10">
              <section>
                <h2 className="text-2xl font-semibold text-gray-900">Why readers choose it</h2>
                <p className="mt-4 text-base leading-relaxed text-gray-600">
                  {page.publication.differentiator}
                </p>
              </section>
              <section>
                <h2 className="text-2xl font-semibold text-gray-900">Best fit</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {page.publication.bestFor.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm font-medium text-gray-600"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </section>
              <section>
                <h2 className="text-2xl font-semibold text-gray-900">Topic map</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {page.publication.topics.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-purple-100 bg-purple-50 px-3 py-1 text-sm font-medium text-purple-700"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </section>
            </div>

            <aside className="space-y-6">
              <div className="rounded-2xl border border-gray-200 bg-white p-6">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
                  Audience
                </p>
                <p className="text-sm leading-relaxed text-gray-600">{page.publication.audience}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-6">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
                  Related Niche Pages
                </p>
                <div className="space-y-4">
                  {relatedNiches.map((niche) => (
                    <Link key={niche.slug} to={getSubstackDirectoryNichePath(niche.slug)} className="block">
                      <p className="text-sm font-semibold text-gray-900">{niche.title}</p>
                      <p className="text-sm leading-relaxed text-gray-500">{niche.description}</p>
                    </Link>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-purple-100 bg-purple-50/60 p-6">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
                  Related Tools
                </p>
                <div className="space-y-4">
                  <Link to="/tools/substack-revenue-calculator" className="block">
                    <p className="text-sm font-semibold text-gray-900">Substack revenue calculator</p>
                    <p className="text-sm leading-relaxed text-gray-500">
                      Benchmark the economics behind a paid or freemium newsletter model.
                    </p>
                  </Link>
                  <Link to="/tools/headline-analyzer" className="block">
                    <p className="text-sm font-semibold text-gray-900">Headline analyzer</p>
                    <p className="text-sm leading-relaxed text-gray-500">
                      Tighten packaging once you know the kind of publication voice you want to emulate.
                    </p>
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="border-y border-gray-100 bg-gray-50/70">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <h2 className="text-3xl font-semibold text-gray-900">Frequently asked questions</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {page.faq.map((entry) => (
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
