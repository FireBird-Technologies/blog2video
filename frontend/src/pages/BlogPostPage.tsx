import { Link, useParams } from "react-router-dom";
import PublicFooter from "../components/public/PublicFooter";
import PublicHeader from "../components/public/PublicHeader";
import Seo from "../components/seo/Seo";
import {
  blogPosts,
  getBlogPost,
  getStructuredInternalLinks,
  siteUrl,
} from "../content/siteContent";
import NotFoundPage from "./NotFoundPage";
import { blogPostSchema } from "../seo/schema";

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getBlogPost(slug) : undefined;

  if (!post) return <NotFoundPage />;

  const relatedLinks = getStructuredInternalLinks(post.relatedPaths);
  const morePosts = blogPosts
    .filter((entry) => entry.slug !== post.slug)
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Seo
        title={post.title}
        description={post.description}
        path={`/blogs/${post.slug}`}
        image={post.heroImage ? `${siteUrl}${post.heroImage}` : undefined}
        schema={blogPostSchema(post)}
      />
      <PublicHeader />

      <main className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_0.8fr]">
          <article>
            <div className="mb-8 overflow-hidden rounded-3xl border border-gray-100 bg-gray-50 shadow-sm">
              <img
                src={post.heroImage || "/og-image-v2.png"}
                alt={post.heroImageAlt || post.title}
                className="h-auto w-full object-cover"
                loading="eager"
              />
            </div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
              {post.heroEyebrow}
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">
              {post.heroTitle}
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-gray-500">
              {post.heroDescription}
            </p>

            <div className="mt-6 flex flex-wrap gap-3 text-sm text-gray-500">
              <span>{post.category}</span>
              <span>{post.publishedAt}</span>
              <span>{post.readTime}</span>
            </div>

            <div className="mt-10 space-y-10">
              {post.sections.map((section) => (
                <section key={section.heading}>
                  <h2 className="text-2xl font-semibold text-gray-900">{section.heading}</h2>
                  <div className="mt-4 space-y-4 text-base leading-relaxed text-gray-600">
                    {section.paragraphs.map((paragraph) => (
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

            <section className="mt-14 rounded-2xl border border-gray-200 bg-gray-50/70 p-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
                Distribution Plan
              </p>
              <div className="space-y-4">
                {post.distributionPlan.map((asset) => (
                  <div key={`${asset.channel}-${asset.title}`} className="rounded-xl bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                      {asset.channel}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{asset.title}</p>
                    <p className="mt-1 text-sm text-gray-600">{asset.angle}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-14">
              <h2 className="text-2xl font-semibold text-gray-900">FAQs</h2>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {post.faq.map((entry) => (
                  <div key={entry.question} className="rounded-2xl border border-gray-200 bg-white p-6">
                    <h3 className="text-base font-semibold text-gray-900">{entry.question}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-gray-600">{entry.answer}</p>
                  </div>
                ))}
              </div>
            </section>
          </article>

          <aside className="space-y-6">
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

            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
                More Articles
              </p>
              <div className="space-y-4">
                {morePosts.map((entry) => (
                  <Link key={entry.slug} to={`/blogs/${entry.slug}`} className="block">
                    <p className="text-sm font-semibold text-gray-900">{entry.title}</p>
                    <p className="text-sm leading-relaxed text-gray-500">{entry.description}</p>
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
