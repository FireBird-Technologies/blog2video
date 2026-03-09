import { Link } from "react-router-dom";
import {
  featuredPagePaths,
  featuredPostSlugs,
  getBlogPost,
  getMarketingPage,
} from "../../content/siteContent";

export default function LandingResourceSection() {
  const pages = featuredPagePaths
    .map((path) => getMarketingPage(path))
    .filter((page): page is NonNullable<typeof page> => Boolean(page));
  const posts = featuredPostSlugs
    .map((slug) => getBlogPost(slug))
    .filter((post): post is NonNullable<typeof post> => Boolean(post));

  return (
    <section className="border-t border-gray-100 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="reveal">
          <p className="mb-4 text-center text-xs font-medium uppercase tracking-widest text-purple-600">
            SEO Surface
          </p>
          <h2 className="text-center text-2xl font-semibold text-gray-900 sm:text-3xl">
            Explore workflows, use cases, and publishing playbooks
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-relaxed text-gray-500">
            Blog2Video now has dedicated pages for high-intent workflows plus practical guides on Medium, Substack, YouTube, and SEO-driven repurposing.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <div className="glass-card p-8">
            <h3 className="text-lg font-semibold text-gray-900">High-intent pages</h3>
            <div className="mt-6 space-y-4">
              {pages.map((page) => (
                <Link key={page.path} to={page.path} className="block">
                  <p className="text-sm font-semibold text-gray-900">{page.heroTitle}</p>
                  <p className="mt-1 text-sm leading-relaxed text-gray-500">
                    {page.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>

          <div className="glass-card p-8">
            <h3 className="text-lg font-semibold text-gray-900">Latest blog playbooks</h3>
            <div className="mt-6 space-y-4">
              {posts.map((post) => (
                <Link key={post.slug} to={`/blogs/${post.slug}`} className="block">
                  <p className="text-sm font-semibold text-gray-900">{post.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-gray-500">
                    {post.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
