import { lazy, Suspense } from "react";
import { Link, useLocation } from "react-router-dom";
import PublicFooter from "../components/public/PublicFooter";
import PublicHeader from "../components/public/PublicHeader";
import Seo from "../components/seo/Seo";
import {
  getMarketingPage,
  getStructuredInternalLinks,
  getTemplateProfile,
} from "../content/siteContent";
import { templateProfiles } from "../content/marketingBase";
import { getSceneLayoutLabel } from "../utils/layoutLabels";
import NotFoundPage from "./NotFoundPage";
import { marketingPageSchema } from "../seo/schema";

const BlogDemoPlayer = lazy(() => import("../components/BlogDemoPlayer"));

export default function TemplatePageView() {
  const location = useLocation();
  const page = getMarketingPage(location.pathname);

  if (!page) return <NotFoundPage />;

  const slug = location.pathname.replace("/templates/", "");
  const templateProfile = getTemplateProfile(slug);
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

      {/* Template Navigation Strip */}
      <div className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-6xl px-6">
          <nav className="flex gap-1 overflow-x-auto py-3 scrollbar-hide" aria-label="Templates">
            {templateProfiles.map((t) => {
              const isActive = slug === t.slug;
              return (
                <Link
                  key={t.slug}
                  to={`/templates/${t.slug}`}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-purple-600 text-white"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  {t.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <main>
        {/* Hero */}
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

        {/* Live Preview */}
        {templateProfile?.previewSceneKey && (
          <section className="border-b border-gray-100 bg-gray-50/50">
            <div className="mx-auto max-w-5xl px-6 py-16">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-purple-600 text-center">
                Live Preview
              </p>
              <h2 className="text-2xl font-semibold text-gray-900 text-center mb-2">
                See {templateProfile.name} in action
              </h2>
              <p className="text-sm text-gray-500 text-center mb-8 max-w-xl mx-auto">
                This preview cycles through {templateProfile.name}'s layouts with real content to show how each scene type looks and feels.
              </p>
              <Suspense fallback={<div className="aspect-video w-full rounded-2xl bg-gray-200 animate-pulse" />}>
                <BlogDemoPlayer sceneKey={templateProfile.previewSceneKey} />
              </Suspense>
            </div>
          </section>
        )}

        {/* Proof Points */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-6 md:grid-cols-3">
            {page.proofPoints.map((proofPoint) => (
              <div key={proofPoint} className="rounded-2xl border border-gray-200 bg-white p-6">
                <p className="text-sm leading-relaxed text-gray-600">{proofPoint}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Layout Showcase */}
        {templateProfile?.layouts && templateProfile.layouts.length > 0 && (
          <section className="border-y border-gray-100 bg-gray-50/70">
            <div className="mx-auto max-w-6xl px-6 py-16">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
                Layouts
              </p>
              <h2 className="text-3xl font-semibold text-gray-900">
                {templateProfile.layouts.length} scene layouts in {templateProfile.name}
              </h2>
              <p className="mt-3 max-w-2xl text-base text-gray-500">
                Each layout is automatically selected based on the content type in your article. You can also override layouts manually in the scene editor.
              </p>
              <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {templateProfile.layouts.map((layout) => (
                  <div
                    key={layout}
                    className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-sm font-medium text-gray-800"
                  >
                    {getSceneLayoutLabel(templateProfile.slug, layout)}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Content Sections */}
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
              <div className="rounded-2xl border border-gray-200 bg-white p-6">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
                  Other Templates
                </p>
              <div className="space-y-3">
                {templateProfiles
                    .filter((t) => t.slug !== slug)
                    .map((t) => {
                      const tPage = getMarketingPage(`/templates/${t.slug}`);
                      if (!tPage) return null;
                      return (
                        <Link key={t.slug} to={`/templates/${t.slug}`} className="block rounded-lg p-2 -mx-2 transition-colors hover:bg-gray-50">
                          <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                          <p className="text-xs text-gray-500">{t.bestFor.split(",")[0].trim()}</p>
                        </Link>
                      );
                    })}
              </div>
              </div>

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

        {/* FAQ */}
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

        {/* Prev / Next Navigation */}
        {(() => {
          const currentIdx = templateProfiles.findIndex((t) => t.slug === slug);
          const prev = currentIdx > 0 ? templateProfiles[currentIdx - 1] : null;
          const next = currentIdx < templateProfiles.length - 1 ? templateProfiles[currentIdx + 1] : null;
          if (!prev && !next) return null;
          return (
            <section className="mx-auto max-w-6xl px-6 py-10">
              <div className="flex items-stretch gap-4">
                {prev ? (
                  <Link
                    to={`/templates/${prev.slug}`}
                    className="flex flex-1 items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 transition-colors hover:border-purple-200 hover:bg-purple-50/30"
                  >
                    <svg className="h-5 w-5 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    <div>
                      <p className="text-xs text-gray-400">Previous template</p>
                      <p className="text-sm font-semibold text-gray-900">{prev.name}</p>
                    </div>
                  </Link>
                ) : <div className="flex-1" />}
                {next ? (
                  <Link
                    to={`/templates/${next.slug}`}
                    className="flex flex-1 items-center justify-end gap-4 rounded-2xl border border-gray-200 bg-white p-5 text-right transition-colors hover:border-purple-200 hover:bg-purple-50/30"
                  >
                    <div>
                      <p className="text-xs text-gray-400">Next template</p>
                      <p className="text-sm font-semibold text-gray-900">{next.name}</p>
                    </div>
                    <svg className="h-5 w-5 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </Link>
                ) : <div className="flex-1" />}
              </div>
            </section>
          );
        })()}

        {/* CTA */}
        <section className="mx-auto max-w-4xl px-6 py-16 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
            Get Started
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
