import { Link, useLocation } from "react-router-dom";
import PublicFooter from "../components/public/PublicFooter";
import PublicHeader from "../components/public/PublicHeader";
import Seo from "../components/seo/Seo";
import {
  getSubstackDirectoryNichePath,
  getSubstackDirectoryPage,
  getSubstackDirectoryPricingPath,
  getSubstackNiche,
  getSubstackPublicationPath,
  pricingLabels,
} from "../content/substackDirectory";
import NotFoundPage from "./NotFoundPage";
import { substackDirectoryNicheSchema } from "../seo/schema";

export default function SubstackDirectoryNichePage() {
  const location = useLocation();
  const page = getSubstackDirectoryPage(location.pathname);

  if (!page || page.kind !== "niche") return <NotFoundPage />;

  const relatedNiches = page.niche.relatedNicheSlugs
    .map((slug) => getSubstackNiche(slug))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Seo
        title={page.title}
        description={page.description}
        path={page.path}
        schema={substackDirectoryNicheSchema(page.niche, page.publications, page.path, page.faq, page.pricing)}
      />
      <PublicHeader />

      <main>
        <section className="border-b border-gray-100 bg-gradient-to-b from-purple-50/40 via-white to-white">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
              Substack Directory
            </p>
            <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {page.title}
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-relaxed text-gray-500">
              {page.pricing
                ? `${page.niche.angle} This page is filtered for ${pricingLabels[page.pricing].toLowerCase()} publications.`
                : page.niche.angle}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="rounded-full border border-purple-100 bg-white px-3 py-1 text-xs font-medium text-purple-700">
                {page.niche.name}
              </span>
              <span className="rounded-full border border-purple-100 bg-white px-3 py-1 text-xs font-medium text-purple-700">
                {page.niche.audience}
              </span>
              {page.pricing ? (
                <span className="rounded-full border border-purple-100 bg-white px-3 py-1 text-xs font-medium text-purple-700">
                  {pricingLabels[page.pricing]}
                </span>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="mb-8 flex flex-wrap gap-3">
            <Link
              to={getSubstackDirectoryNichePath(page.niche.slug)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                !page.pricing
                  ? "border-purple-200 bg-purple-50 text-purple-700"
                  : "border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-900"
              }`}
            >
              All
            </Link>
            {(["free", "paid", "freemium"] as const).map((pricing) => (
              <Link
                key={pricing}
                to={getSubstackDirectoryPricingPath(page.niche.slug, pricing)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  page.pricing === pricing
                    ? "border-purple-200 bg-purple-50 text-purple-700"
                    : "border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-900"
                }`}
              >
                {pricingLabels[pricing]}
              </Link>
            ))}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {page.publications.map((publication) => (
              <Link
                key={publication.slug}
                to={getSubstackPublicationPath(publication.slug)}
                className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{publication.name}</h2>
                    <p className="mt-1 text-sm text-gray-500">{publication.tagline}</p>
                  </div>
                  <span className="rounded-full border border-purple-100 bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">
                    {pricingLabels[publication.pricingModel]}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-gray-600">{publication.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {publication.bestFor.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-500"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="border-y border-gray-100 bg-gray-50/70">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <h2 className="text-3xl font-semibold text-gray-900">
                  How to use this {page.niche.name.toLowerCase()} page
                </h2>
                <div className="mt-6 space-y-4 text-base leading-relaxed text-gray-600">
                  <p>
                    Start with the publications whose audience and tone match your own. Then open the
                    profile pages to compare pricing model, cadence, and editorial differentiator before
                    deciding which newsletter style is closest to your own positioning.
                  </p>
                  <p>
                    If your main question is business model, use the pricing filters above. If your main
                    question is voice or angle, compare the descriptions and best-fit use cases first.
                  </p>
                </div>
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
                      Model how a niche audience might convert into MRR and ARR.
                    </p>
                  </Link>
                  <Link to="/tools/markdown-to-medium-substack-formatter" className="block">
                    <p className="text-sm font-semibold text-gray-900">
                      Markdown to Medium and Substack formatter
                    </p>
                    <p className="text-sm leading-relaxed text-gray-500">
                      Clean your publishing draft once you know which audience and angle you want.
                    </p>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-3xl font-semibold text-gray-900">Frequently asked questions</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {page.faq.map((entry) => (
              <div key={entry.question} className="rounded-2xl border border-gray-200 bg-white p-6">
                <h3 className="text-base font-semibold text-gray-900">{entry.question}</h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">{entry.answer}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
