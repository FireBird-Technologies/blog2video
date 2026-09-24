import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useScrollReveal } from "../hooks/useScrollReveal";
import PublicHeader from "../components/public/PublicHeader";
import PublicFooter from "../components/public/PublicFooter";
import Seo from "../components/seo/Seo";

// Placeholders until the plugin is live on WordPress.org and the zip is
// hosted somewhere permanent. Swap these two constants in when ready — no
// other code on this page needs to change.
const WORDPRESS_ORG_URL = "https://wordpress.org/plugins/blog2video/";
const PLUGIN_ZIP_URL = "/downloads/blog2video.zip";

interface Step {
  title: string;
  description: string;
}

const STEPS: Step[] = [
  {
    title: "Install the plugin",
    description:
      "Upload the Blog2Video zip in Plugins → Add New, or install it directly from the WordPress.org directory. Activate it — that's it, no configuration file to edit.",
  },
  {
    title: "Connect your account",
    description:
      "Open Settings → Blog2Video and click Connect. You'll approve the connection from your Blog2Video account — WordPress never sees or stores your password, only a revocable site token.",
  },
  {
    title: "Open any post",
    description:
      "A Blog2Video panel appears right in the post editor sidebar. Pick a template, a voice, and generate — your post's own content becomes the script, no copy-pasting.",
  },
  {
    title: "Render and embed",
    description:
      "Preview the draft, adjust scenes if you want, then render. “Add video to post” drops it straight into the post as a block — published the moment you hit Update.",
  },
];

interface Feature {
  icon: string;
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  {
    icon: "✍️",
    title: "Your post, already scripted",
    description:
      "No blank page. The plugin reads the post you're editing and turns it straight into a video script, or pulls from any article URL you paste in.",
  },
  {
    icon: "🎨",
    title: "Real templates, real voices",
    description:
      "The same template gallery and voice catalog as the Blog2Video web app — pick a style, preview a voice, and see exactly what you'll get before you generate.",
  },
  {
    icon: "🎬",
    title: "Scene-by-scene editing",
    description:
      "Rewrite narration, swap visuals, reorder or regenerate individual scenes — without ever leaving the WordPress editor tab.",
  },
  {
    icon: "🖌️",
    title: "Your brand, on every video",
    description:
      "Logo watermark, accent colors, fonts and caption styling carry your site's look, set once per project from the same panel.",
  },
  {
    icon: "⚡",
    title: "One click to publish",
    description:
      "“Add video to post” inserts a live, always-current embed as a normal Gutenberg block — no manual uploads, no separate hosting to manage.",
  },
  {
    icon: "🔐",
    title: "Nothing stored, nothing shared",
    description:
      "The connection uses a short-lived approval code and a revocable token. Your Blog2Video password never touches WordPress, and you can disconnect any time.",
  },
];

export default function WordPressPlugin() {
  const revealRef = useScrollReveal();
  const { user } = useAuth();
  const navigate = useNavigate();

  const primaryCta = () => {
    if (user) {
      navigate("/dashboard");
    } else {
      navigate("/signin");
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Seo
        title="WordPress Plugin"
        description="Turn any WordPress post into a narrated video without leaving the editor. Install the Blog2Video plugin, connect your account, and publish videos straight from Gutenberg."
        path="/wordpress-plugin"
      />
      <PublicHeader />

      {/* ── Hero ── */}
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 h-[280px] w-[280px] rounded-full bg-purple-500/[0.06] blur-3xl sm:h-[600px] sm:w-[600px]" />
          <div className="absolute -bottom-32 -left-32 h-[240px] w-[240px] rounded-full bg-[#7c3aed]/[0.05] blur-3xl sm:h-[500px] sm:w-[500px]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
          <p className="mb-4 text-xs font-medium uppercase tracking-widest text-purple-600">
            WordPress Plugin
          </p>
          <h1 className="mx-auto max-w-3xl text-3xl font-bold leading-tight text-gray-900 sm:text-4xl md:text-5xl">
            Turn every post into a video, without leaving WordPress
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-gray-600 sm:text-lg">
            Install the Blog2Video plugin, connect your account once, and generate, edit and
            publish narrated videos straight from the post editor — your content, your templates,
            your voices.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={primaryCta}
              className="rounded-xl bg-[#7c3aed] px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-600/20 transition hover:bg-[#6d28d9]"
            >
              {user ? "Go to your dashboard" : "Get started free"}
            </button>
            <a
              href={WORDPRESS_ORG_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-gray-200 bg-white px-7 py-3.5 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
            >
              View on WordPress.org
            </a>
          </div>
          <p className="mt-4 text-xs text-gray-400">
            Free to install &middot; works with your existing Blog2Video plan
          </p>
        </div>
      </div>

      {/* ── Mockup: the panel, roughly as it looks inside WordPress ── */}
      <div className="relative mx-auto max-w-5xl px-4 pb-6 sm:px-6">
        <div className="glass-card mx-auto flex max-w-3xl items-center gap-2 rounded-t-2xl border-b-0 px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-red-400/70" />
          <span className="h-3 w-3 rounded-full bg-yellow-400/70" />
          <span className="h-3 w-3 rounded-full bg-green-400/70" />
          <span className="ml-3 truncate text-xs text-gray-400">
            yoursite.com/wp-admin/post.php
          </span>
        </div>
        <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-b-2xl border border-t-0 border-gray-200 bg-gray-50/80 p-6 sm:flex-row sm:p-8">
          <div className="flex-1 space-y-3">
            <div className="h-4 w-2/3 rounded bg-gray-200" />
            <div className="h-3 w-full rounded bg-gray-200/70" />
            <div className="h-3 w-11/12 rounded bg-gray-200/70" />
            <div className="h-3 w-4/5 rounded bg-gray-200/70" />
            <div className="mt-4 h-32 w-full rounded-xl bg-gray-200/50" />
            <div className="h-3 w-full rounded bg-gray-200/70" />
            <div className="h-3 w-3/4 rounded bg-gray-200/70" />
          </div>
          <div className="w-full flex-shrink-0 rounded-2xl border border-purple-100 bg-white p-4 shadow-sm sm:w-64">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-purple-600">
              Blog2Video
            </p>
            <p className="mt-2 text-sm font-semibold text-gray-900">Create your video</p>
            <div className="mt-3 space-y-2">
              <div className="rounded-lg border border-purple-200 bg-purple-50/70 px-3 py-2 text-xs font-medium text-gray-700">
                Template: Geometric Explainer
              </div>
              <div className="rounded-lg border border-purple-200 bg-purple-50/70 px-3 py-2 text-xs font-medium text-gray-700">
                Voice: Hale
              </div>
            </div>
            <div className="mt-4 rounded-lg bg-[#7c3aed] px-3 py-2.5 text-center text-xs font-semibold text-white">
              Generate video
            </div>
            <div className="mt-2 rounded-lg border border-purple-200 px-3 py-2.5 text-center text-xs font-semibold text-purple-500">
              Add video to post
            </div>
          </div>
        </div>
      </div>

      <div ref={revealRef}>
        {/* ── Feature grid ── */}
        <div className="border-t border-gray-100 bg-[rgba(246,247,249,0.70)] py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-medium uppercase tracking-widest text-purple-600">
                Why use the plugin
              </p>
              <h2 className="mt-3 text-2xl font-bold text-gray-900 sm:text-3xl">
                Everything the web app does, without the tab-switching
              </h2>
              <p className="mt-3 text-base leading-7 text-gray-600">
                The plugin isn't a stripped-down version — it's the same generation engine,
                template gallery and voice catalog, wired directly into the editor you already
                write in.
              </p>
            </div>

            <div className="reveal-group mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="glass-card reveal p-7">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-100 text-xl">
                    {feature.icon}
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-gray-900">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Steps ── */}
        <div className="bg-white py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-medium uppercase tracking-widest text-purple-600">
                Setup
              </p>
              <h2 className="mt-3 text-2xl font-bold text-gray-900 sm:text-3xl">
                Live in four steps
              </h2>
              <p className="mt-3 text-base leading-7 text-gray-600">
                Most sites are connected and generating their first video in under five minutes.
              </p>
            </div>

            <div className="reveal-group mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, index) => (
                <div key={step.title} className="reveal relative">
                  <div className="glass-card relative h-full p-6 pt-9">
                    <div className="absolute -top-5 left-6 flex h-10 w-10 items-center justify-center rounded-full bg-[#7c3aed] text-sm font-bold text-white shadow-lg shadow-purple-600/25">
                      {index + 1}
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-gray-600">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Requirements ── */}
        <div className="border-t border-gray-100 bg-[rgba(246,247,249,0.70)] py-16">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="glass-card reveal grid gap-8 p-8 sm:grid-cols-3 sm:p-10">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Requirements
                </p>
                <p className="mt-2 text-sm leading-6 text-gray-700">
                  WordPress 6.2+ and PHP 7.4+. Your site must be served over HTTPS to connect.
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Works with
                </p>
                <p className="mt-2 text-sm leading-6 text-gray-700">
                  The classic and block (Gutenberg) editors. Any Blog2Video plan, free included.
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Pricing
                </p>
                <p className="mt-2 text-sm leading-6 text-gray-700">
                  The plugin itself is free. Video generation uses your existing Blog2Video plan
                  and credits.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── CTA band ── */}
        <div className="bg-white py-20">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              Ready to connect your site?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-gray-600">
              Create a free Blog2Video account, install the plugin, and your next post can ship
              with a video attached.
            </p>

            <div className="glass-card reveal mx-auto mt-8 flex max-w-xl flex-col items-center gap-4 p-8">
              <div className="flex flex-col items-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={primaryCta}
                  className="rounded-full bg-[#7c3aed] px-7 py-3 text-sm font-semibold text-white transition hover:bg-[#6d28d9]"
                >
                  {user ? "Go to your dashboard" : "Create free account"}
                </button>
                <a
                  href={PLUGIN_ZIP_URL}
                  className="rounded-full border border-gray-200 px-7 py-3 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
                >
                  Download plugin (.zip)
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}
