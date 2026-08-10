import { Link } from "react-router-dom";
import {
  featuredPagePaths,
  featuredPostSlugs,
  footerGroups,
  getBlogPost,
  getMarketingPage,
} from "../../content/siteContent";
import { useAuth } from "../../hooks/useAuth";
import { counterpartOf, getBrand, useBrand, type BrandId } from "../../brand/brand";

/**
 * `brandId` overrides the ambient brand, for pages rendered under the other
 * brand's domain (PdfLanding at /pdf2video on blog2video.app).
 */
export default function PublicFooter({ brandId }: { brandId?: BrandId } = {}) {
  const { user } = useAuth();
  const sessionBrand = useBrand();
  const brand = brandId ? getBrand(brandId) : sessionBrand;
  const isPdfBrand = brand.id === "pdf2video";
  const otherBrand = counterpartOf(brand.id);

  const featuredPages = featuredPagePaths
    .map((path) => getMarketingPage(path))
    .filter((page): page is NonNullable<typeof page> => Boolean(page));
  const featuredPosts = featuredPostSlugs
    .map((slug) => getBlogPost(slug))
    .filter((post): post is NonNullable<typeof post> => Boolean(post));

  return (
    <footer className="border-t border-gray-100 bg-gray-50/70">
      <div className="mx-auto max-w-6xl px-6 py-14">
        {!user ? (
          <div className="mb-12 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
                Explore Workflows
              </p>
              <div className="space-y-3">
                {featuredPages.map((page) => (
                  <Link key={page.path} to={page.path} className="block">
                    <p className="text-sm font-semibold text-gray-900">{page.heroTitle}</p>
                    <p className="text-sm text-gray-500">{page.description}</p>
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
                From The Blog
              </p>
              <div className="space-y-3">
                {featuredPosts.map((post) => (
                  <Link key={post.slug} to={`/blogs/${post.slug}`} className="block">
                    <p className="text-sm font-semibold text-gray-900">{post.title}</p>
                    <p className="text-sm text-gray-500">{post.description}</p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-600 text-[11px] font-bold text-white">
                {brand.logoText}
              </div>
              <span className="text-lg font-semibold text-gray-900">{brand.siteName}</span>
            </div>
            <p className="text-sm leading-relaxed text-gray-500">
              {isPdfBrand
                ? "Turn PDFs, reports, whitepapers, and decks into narrated, branded videos people actually finish."
                : "Turn blog posts, articles, PDFs, and documentation into video workflows that can rank, distribute, and convert."}
            </p>
            {/* Reciprocal cross-brand link — same product, different front door. */}
            <a
              href={otherBrand.siteUrl}
              className="mt-3 inline-block text-sm text-gray-500 transition-colors hover:text-gray-900"
            >
              {isPdfBrand
                ? "Have a blog instead? Try Blog2Video →"
                : "Have a PDF instead? Try PDF2Video →"}
            </a>
          </div>

          {footerGroups.map((group) => (
            <div key={group.title}>
              <p className="mb-3 text-sm font-semibold text-gray-900">{group.title}</p>
              <div className="space-y-2">
                {group.links.map((path) => {
                  const page = getMarketingPage(path);
                  const label =
                    page?.heroTitle ||
                    (path === "/blogs"
                      ? "Blog"
                      : path === "/pricing"
                        ? "Pricing"
                        : path === "/contact"
                          ? "Contact"
                          : path === "/terms"
                            ? "Terms of Service"
                            : path === "/privacy"
                              ? "Privacy Policy"
                              : path);

                  return (
                    <Link
                      key={path}
                      to={path}
                      className="block text-sm text-gray-500 transition-colors hover:text-gray-900"
                    >
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
