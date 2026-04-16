import { Link, useLocation } from "react-router-dom";
import PublicFooter from "../components/public/PublicFooter";
import PublicHeader from "../components/public/PublicHeader";
import Seo from "../components/seo/Seo";
import {
  getMarketingPage,
  getStructuredInternalLinks,
  getTemplateProfile,
} from "../content/siteContent";
import NotFoundPage from "./NotFoundPage";
import { marketingPageSchema } from "../seo/schema";

const CUSTOM_TEMPLATE_ID = "custom-branded-templates";
const CUSTOM_TEMPLATE_LINK = "/custom-branded-video-templates";

export default function MarketingPageView() {
  const location = useLocation();
  const page = getMarketingPage(location.pathname);

  if (!page) return <NotFoundPage />;

  const recommendedTemplate = getTemplateProfile(page.recommendedTemplate);
  const recommendedTemplateCard =
    page.recommendedTemplate === CUSTOM_TEMPLATE_ID
      ? {
          name: "Custom Templates",
          href: CUSTOM_TEMPLATE_LINK,
          ctaLabel: "Explore custom templates",
        }
      : recommendedTemplate
        ? {
            name: recommendedTemplate.name,
            href: `/templates/${recommendedTemplate.slug}`,
            ctaLabel: "Explore the template",
          }
        : null;
  const relatedLinks = getStructuredInternalLinks(page.relatedPaths);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Seo
        title={page.title}
        description={page.description}
        path={page.path}
        schema={marketingPageSchema(page)}
      />
      <PublicHeader />

      <main>
        <section className="border-b border-gray-100 bg-gradient-to-b from-purple-50/40 via-white to-white">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
              {page.eyebrow}
            </p>
            <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {page.heroTitle}
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-relaxed text-gray-500">
              {page.heroDescription}
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {[page.primaryKeyword, page.keywordVariant, ...page.badges].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-purple-100 bg-white px-3 py-1 text-xs font-medium text-purple-700"
                >
                  {item}
                </span>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                to={page.cta.primaryHref}
                className="rounded-lg bg-purple-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-purple-700"
              >
                {page.cta.primaryLabel}
              </Link>
              {page.cta.secondaryHref && page.cta.secondaryLabel ? (
                <Link
                  to={page.cta.secondaryHref}
                  className="rounded-lg border border-gray-200 px-5 py-3 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:text-gray-900"
                >
                  {page.cta.secondaryLabel}
                </Link>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-6 md:grid-cols-3">
            {page.proofPoints.map((proofPoint) => (
              <div key={proofPoint} className="rounded-2xl border border-gray-200 bg-white p-6">
                <p className="text-sm leading-relaxed text-gray-600">{proofPoint}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-gray-100 bg-gray-50/70">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="max-w-3xl">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
                Workflow
              </p>
              <h2 className="text-3xl font-semibold text-gray-900">How this page turns into a practical workflow</h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {page.workflowSteps.map((step, index) => (
                <div key={step} className="rounded-2xl border border-gray-200 bg-white p-6">
                  <p className="mb-2 text-sm font-semibold text-purple-600">Step {index + 1}</p>
                  <p className="text-sm leading-relaxed text-gray-600">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-[1.4fr_0.9fr]">
            <div className="space-y-10">
              {page.sections.map((section) => (
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
                          <span className="mt-1 h-2 w-2 rounded-full bg-purple-500" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}
            </div>

            <aside className="space-y-6">
              {recommendedTemplateCard ? (
                <div className="rounded-2xl border border-purple-100 bg-purple-50/60 p-6">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
                    Recommended Template
                  </p>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {recommendedTemplateCard.name}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-gray-600">
                    {page.recommendedTemplateReason}
                  </p>
                  <Link
                    to={recommendedTemplateCard.href}
                    className="mt-4 inline-flex text-sm font-medium text-purple-700 hover:text-purple-800"
                  >
                    {recommendedTemplateCard.ctaLabel}
                  </Link>
                </div>
              ) : null}

              <div className="rounded-2xl border border-gray-200 bg-white p-6">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
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
              {page.faq.map((entry) => (
                <div key={entry.question} className="rounded-2xl border border-gray-200 bg-white p-6">
                  <h3 className="text-base font-semibold text-gray-900">{entry.question}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-gray-600">{entry.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-6 py-16 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
            Call To Action
          </p>
          <h2 className="text-3xl font-semibold text-gray-900">{page.cta.title}</h2>
          <p className="mt-4 text-lg leading-relaxed text-gray-500">{page.cta.body}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to={page.cta.primaryHref}
              className="rounded-lg bg-purple-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-purple-700"
            >
              {page.cta.primaryLabel}
            </Link>
            {page.cta.secondaryHref && page.cta.secondaryLabel ? (
              <Link
                to={page.cta.secondaryHref}
                className="rounded-lg border border-gray-200 px-5 py-3 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:text-gray-900"
              >
                {page.cta.secondaryLabel}
              </Link>
            ) : null}
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
