import {
  AdjustmentsHorizontalIcon,
  ArrowRightIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  CursorArrowRaysIcon,
  DocumentTextIcon,
  LockClosedIcon,
  PuzzlePieceIcon,
  VideoCameraIcon,
} from "@heroicons/react/24/outline";
import { Link } from "react-router-dom";
import PublicFooter from "../components/public/PublicFooter";
import PublicHeader from "../components/public/PublicHeader";
import Seo from "../components/seo/Seo";
import { CHROME_EXTENSION_URL } from "../constants/chromeExtension";
import { getStructuredInternalLinks } from "../content/siteContent";
import type { ToolDefinition } from "../content/seoTypes";
import { toolPageSchema } from "../seo/schema";

type ChromeExtensionToolPageProps = {
  tool: ToolDefinition;
};

const workflow = [
  {
    title: "Install",
    description: "Add Blog2Video from the Chrome Web Store and pin it beside your address bar.",
    icon: PuzzlePieceIcon,
  },
  {
    title: "Open an article",
    description: "Visit the blog post or article you want to transform, then open the extension.",
    icon: CursorArrowRaysIcon,
  },
  {
    title: "Choose your style",
    description: "Select a template, voice, length, aspect ratio and stock-footage preference.",
    icon: AdjustmentsHorizontalIcon,
  },
  {
    title: "Create your video",
    description: "Send the article to Blog2Video, then preview, edit and render the finished project.",
    icon: VideoCameraIcon,
  },
];

const featureTitles = ["Capture the article", "Keep creative control", "Finish in Blog2Video"];
const featureIcons = [DocumentTextIcon, AdjustmentsHorizontalIcon, VideoCameraIcon];

function ChromeLogo({ className = "h-12 w-12" }: { className?: string }) {
  return <img src="/chrome-logo.svg" alt="" className={`flex-none ${className}`} aria-hidden="true" />;
}

function BrowserPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[600px] lg:mx-0">
      <div className="relative overflow-hidden rounded-[1.6rem] border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-100/90 px-4 py-3">
          <div className="flex gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ea4335]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#fbbc05]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#34a853]" />
          </div>
          <div className="flex min-w-0 flex-1 items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5">
            <LockClosedIcon className="mr-2 h-3.5 w-3.5 flex-none text-gray-400" />
            <span className="truncate text-[11px] text-gray-400">example.com/your-best-article</span>
          </div>
          <div className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-purple-600 text-[9px] font-bold text-white shadow-sm">
            B2V
          </div>
        </div>

        <div className="relative min-h-[410px] bg-white p-6 sm:min-h-[430px] sm:p-8">
          <div className="max-w-[56%] space-y-4">
            <div className="h-2.5 w-24 rounded-full bg-purple-100" />
            <div className="space-y-2.5">
              <div className="h-5 w-full rounded-full bg-gray-900" />
              <div className="h-5 w-4/5 rounded-full bg-gray-900" />
            </div>
            <div className="h-28 rounded-2xl bg-gray-100" />
            <div className="space-y-2.5 pt-2">
              <div className="h-2.5 w-full rounded-full bg-gray-100" />
              <div className="h-2.5 w-11/12 rounded-full bg-gray-100" />
              <div className="h-2.5 w-4/5 rounded-full bg-gray-100" />
              <div className="h-2.5 w-full rounded-full bg-gray-100" />
            </div>
          </div>

          <div className="absolute bottom-5 right-5 top-5 flex w-[48%] flex-col rounded-2xl border border-purple-100 bg-white p-4 shadow-sm sm:bottom-6 sm:right-6 sm:top-6 sm:p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600 text-[9px] font-bold text-white">
                  B2V
                </div>
                <span className="text-xs font-semibold text-gray-900">Blog2Video</span>
              </div>
              <span className="h-2 w-2 rounded-full bg-green-500" title="Connected" />
            </div>

            <div className="mt-5">
              <p className="text-sm font-semibold text-gray-950 sm:text-base">
                Turn this page into a video
              </p>
              <p className="mt-1 text-[10px] leading-relaxed text-gray-500 sm:text-xs">
                Article found and ready to create.
              </p>
            </div>

            <div className="mt-4 space-y-2">
              {[
                ["Template", "Auto"],
                ["Voice", "Hale"],
                ["Length", "Auto"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                >
                  <span className="text-[9px] text-gray-500 sm:text-[10px]">{label}</span>
                  <span className="text-[9px] font-semibold text-gray-800 sm:text-[10px]">{value}</span>
                </div>
              ))}
            </div>

            <div className="mt-auto rounded-lg bg-purple-600 px-3 py-2.5 text-center text-[10px] font-semibold text-white shadow-sm sm:text-xs">
              Create video
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-5 left-5 flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-700 shadow-sm sm:left-8">
        <CheckCircleIcon className="h-4 w-4 text-green-500" />
        Article extracted
      </div>
    </div>
  );
}

export default function ChromeExtensionToolPage({ tool }: ChromeExtensionToolPageProps) {
  const relatedLinks = getStructuredInternalLinks(tool.relatedPaths);

  return (
    <div className="min-h-screen bg-white text-gray-950">
      <Seo
        title={tool.title}
        description={tool.description}
        path={tool.path}
        schema={toolPageSchema(tool)}
      />
      <PublicHeader />

      <main>
        <section className="relative overflow-hidden border-b border-gray-200 bg-white">
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-6 py-20 lg:grid-cols-[0.9fr_1.1fr] lg:py-24">
            <div className="relative z-10">
              <div className="inline-flex items-center gap-3 rounded-full border border-purple-100 bg-white px-3 py-2 shadow-sm">
                <ChromeLogo className="h-7 w-7" />
                <span className="pr-1 text-xs font-semibold uppercase tracking-[0.16em] text-purple-700">
                  Blog2Video for Chrome
                </span>
              </div>

              <h1 className="mt-7 max-w-2xl text-4xl font-bold leading-[1.08] tracking-tight text-gray-950 sm:text-5xl lg:text-[3.65rem]">
                Turn the page you&apos;re reading into a video.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-gray-600">
                Extract the article, choose your template and voice, and start a Blog2Video project
                without copying a single paragraph.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href={CHROME_EXTENSION_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-6 py-3.5 text-sm font-semibold text-white  transition hover:bg-purple-700"
                >
                  <ChromeLogo className="h-5 w-5" />
                  Add to Chrome
                  <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                </a>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-6 py-3.5 text-sm font-semibold text-gray-800 shadow-sm transition hover:border-purple-200 hover:text-purple-700"
                >
                  See how it works
                  <ArrowRightIcon className="h-4 w-4" />
                </a>
              </div>

              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-gray-500">
                {["Article extraction", "Template & voice controls", "Secure account connection"].map(
                  (item) => (
                    <span key={item} className="inline-flex items-center gap-1.5">
                      <CheckCircleIcon className="h-4 w-4 text-green-500" />
                      {item}
                    </span>
                  ),
                )}
              </div>
            </div>

            <BrowserPreview />
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-24 border-b border-gray-100 bg-white py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
                From page to project
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-gray-950 sm:text-4xl">
                Four steps. No copy-pasting.
              </h2>
              <p className="mt-4 text-base leading-7 text-gray-600">
                Keep your research flow intact while Blog2Video handles the handoff from article to
                editable video project.
              </p>
            </div>

            <div className="relative mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              <div className="absolute left-[12%] right-[12%] top-8 hidden h-px bg-purple-200 lg:block" aria-hidden="true" />
              {workflow.map((step, index) => {
                const Icon = step.icon;
                return (
                  <article
                    key={step.title}
                    className="relative rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
                  >
                    <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl border border-purple-100 bg-purple-50 text-purple-600 shadow-sm">
                      <Icon className="h-7 w-7" />
                      <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-purple-600 text-[10px] font-bold text-white">
                        {index + 1}
                      </span>
                    </div>
                    <h3 className="mt-5 text-lg font-semibold text-gray-950">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-gray-600">{step.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-gray-50 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid gap-6 lg:grid-cols-3">
              {tool.proofPoints.map((point, index) => {
                const Icon = featureIcons[index];
                return (
                  <article
                    key={point}
                    className="rounded-3xl border border-gray-200 bg-white p-7 shadow-sm"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-purple-100 bg-purple-50 text-purple-600">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h2 className="mt-6 text-xl font-semibold text-gray-950">{featureTitles[index]}</h2>
                    <p className="mt-3 text-sm leading-7 text-gray-600">{point}</p>
                  </article>
                );
              })}
            </div>

            <div className="mt-8 grid overflow-hidden rounded-3xl border border-purple-100 bg-purple-50/70 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="p-8 sm:p-10">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-purple-100 bg-white text-purple-600">
                  <LockClosedIcon className="h-7 w-7" />
                </div>
                <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
                  Secure by design
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900">
                  Connect without sharing your password
                </h2>
                <p className="mt-4 max-w-xl text-sm leading-7 text-gray-600">
                  {tool.sections[1]?.body[0]}
                </p>
              </div>

              <div className="border-t border-purple-100 p-8 sm:p-10 lg:border-l lg:border-t-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
                  Your project stays editable
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900">
                  Preview, refine and render on Blog2Video
                </h2>
                <p className="mt-4 text-sm leading-7 text-gray-600">{tool.sections[2]?.body[0]}</p>
                <div className="mt-7 flex flex-wrap gap-2">
                  {["Preview scenes", "Edit the result", "Render & download"].map((label) => (
                    <span
                      key={label}
                      className="rounded-full border border-purple-100 bg-white px-3 py-1.5 text-xs font-medium text-purple-700"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-gray-100 bg-white py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
                  Questions
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-gray-950 sm:text-4xl">
                  Before you install
                </h2>
                <p className="mt-4 text-sm leading-7 text-gray-600">
                  Everything you need to know about using Blog2Video from Chrome.
                </p>
              </div>

              <div className="space-y-4">
                {tool.faq.map((entry) => (
                  <article key={entry.question} className="rounded-2xl border border-gray-200 bg-white p-6">
                    <h3 className="text-base font-semibold text-gray-950">{entry.question}</h3>
                    <p className="mt-3 text-sm leading-7 text-gray-600">{entry.answer}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-gray-100 bg-white py-16">
          <div className="mx-auto max-w-6xl px-6">
            <div className="flex flex-col items-start justify-between gap-8 rounded-3xl border border-purple-100 bg-purple-50/70 p-6 sm:p-8 md:flex-row md:items-center">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
                  Ready when your next article is
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-gray-900">
                  Put Blog2Video one click from your address bar.
                </h2>
              </div>
              <a
                href={CHROME_EXTENSION_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex flex-none items-center justify-center gap-2 rounded-full bg-purple-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-purple-700"
              >
                Add to Chrome
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>

        <section className="border-b border-gray-100 bg-white py-10">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-6">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
              Keep exploring
            </span>
            {relatedLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700 transition hover:text-purple-700"
              >
                {link.label}
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </Link>
            ))}
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
