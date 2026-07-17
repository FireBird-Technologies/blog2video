import { Link, useSearchParams } from "react-router-dom";
import PublicFooter from "../components/public/PublicFooter";
import PublicHeader from "../components/public/PublicHeader";
import Seo from "../components/seo/Seo";
import { blogPosts } from "../content/siteContent";
import { blogIndexSchema } from "../seo/schema";

const POSTS_PER_PAGE = 10;

export default function Blog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sortedPosts = [...blogPosts].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
  const featuredPost = sortedPosts[0];
  const remainingPosts = sortedPosts.slice(1);
  const totalPages = Math.max(1, Math.ceil(remainingPosts.length / POSTS_PER_PAGE));

  const requestedPage = Number(searchParams.get("page") ?? "1");
  const currentPage = Number.isFinite(requestedPage)
    ? Math.min(Math.max(1, Math.trunc(requestedPage)), totalPages)
    : 1;
  const isFirstPage = currentPage === 1;

  const latestPosts = remainingPosts.slice(
    (currentPage - 1) * POSTS_PER_PAGE,
    currentPage * POSTS_PER_PAGE
  );

  const goToPage = (page: number) => {
    const next = new URLSearchParams(searchParams);
    if (page <= 1) {
      next.delete("page");
    } else {
      next.set("page", String(page));
    }
    setSearchParams(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const featuredImage = featuredPost.heroImage || "/og-image-v2.png";
  const featuredAlt = featuredPost.heroImageAlt || featuredPost.title;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Seo
        title="Blog"
        description="Educational content, SEO workflows, repurposing playbooks, and programmatic-video strategy for Blog2Video."
        path="/blogs"
        schema={blogIndexSchema()}
      />
      <PublicHeader />

      <main>
        <section className="border-b border-gray-100 bg-gradient-to-b from-purple-50/40 via-white to-white">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
              Blog
            </p>
            <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              SEO, repurposing, and content systems for written-first creators
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-relaxed text-gray-500">
              The Blog2Video blog now covers commercial workflows, creator systems, programmatic SEO, and the cross-channel playbooks needed to turn one piece of writing into multiple durable assets.
            </p>
          </div>
        </section>

        {isFirstPage && (
          <section className="mx-auto max-w-6xl px-6 py-16">
            <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
              <Link
                to={`/blogs/${featuredPost.slug}`}
                className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-6 overflow-hidden rounded-2xl border border-gray-100 bg-gray-50">
                  <img
                    src={featuredImage}
                    alt={featuredAlt}
                    className="h-72 w-full object-cover"
                    loading="eager"
                  />
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
                  Featured
                </p>
                <h2 className="mt-4 text-3xl font-semibold text-gray-900">
                  {featuredPost.title}
                </h2>
                <p className="mt-4 text-base leading-relaxed text-gray-600">
                  {featuredPost.description}
                </p>
                <div className="mt-6 flex flex-wrap gap-4 text-sm text-gray-500">
                  <span>{featuredPost.category}</span>
                  <span>{featuredPost.publishedAt}</span>
                  <span>{featuredPost.readTime}</span>
                </div>
              </Link>

              <div className="rounded-3xl border border-gray-200 bg-gray-50/70 p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
                  Topics Covered
                </p>
                <div className="mt-6 space-y-4 text-sm text-gray-600">
                  <p>Bottom-of-funnel commercial pages and conversion content.</p>
                  <p>Use-case playbooks for technical bloggers, educators, researchers, Medium writers, and Substack operators.</p>
                  <p>Programmatic SEO patterns, measurement loops, and distribution systems.</p>
                  <p>Template and production workflows for turning articles into videos with more consistency.</p>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="border-t border-gray-100 bg-gray-50/70">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <h2 className="text-3xl font-semibold text-gray-900">Latest posts</h2>
            <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {latestPosts.map((post) => (
                <Link
                  key={post.slug}
                  to={`/blogs/${post.slug}`}
                  className="rounded-2xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md"
                >
                  <div className="mb-5 overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                    <img
                      src={post.heroImage || "/og-image-v2.png"}
                      alt={post.heroImageAlt || post.title}
                      className="h-48 w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-600">
                    {post.category}
                  </p>
                  <h3 className="mt-3 text-xl font-semibold text-gray-900">
                    {post.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-gray-600">
                    {post.description}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-4 text-sm text-gray-500">
                    <span>{post.publishedAt}</span>
                    <span>{post.readTime}</span>
                  </div>
                </Link>
              ))}
            </div>

            {totalPages > 1 && (
              <nav
                aria-label="Blog pagination"
                className="mt-12 flex items-center justify-center gap-2"
              >
                <button
                  type="button"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => goToPage(page)}
                    aria-current={page === currentPage ? "page" : undefined}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      page === currentPage
                        ? "bg-purple-600 text-white"
                        : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </nav>
            )}
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
