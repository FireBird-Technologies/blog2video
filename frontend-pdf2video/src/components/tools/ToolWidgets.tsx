import { lazy, Suspense } from "react";

/**
 * Slug → widget registry.
 *
 * Each widget is lazy so a visitor reading the article half of a tool page
 * doesn't pay for the other four tools' code. The fallback is sized to roughly
 * match the loaded widget so the page doesn't jump.
 */

const PdfToVideoScript = lazy(() => import("./PdfToVideoScript"));
const PdfSummarizer = lazy(() => import("./PdfSummarizer"));
const PdfToAudio = lazy(() => import("./PdfToAudio"));
const PdfToText = lazy(() => import("./PdfToText"));
const PdfToSlideshow = lazy(() => import("./PdfToSlideshow"));

const WIDGETS: Record<string, React.ComponentType> = {
  "pdf-to-video-script-generator": PdfToVideoScript,
  "pdf-summarizer": PdfSummarizer,
  "pdf-to-audio": PdfToAudio,
  "pdf-to-text": PdfToText,
  "pdf-to-slideshow": PdfToSlideshow,
};

export function ToolWidget({ slug }: { slug: string }) {
  const Widget = WIDGETS[slug];
  if (!Widget) return null;

  return (
    <Suspense
      fallback={
        <div className="min-h-[420px] animate-pulse rounded-3xl border border-gray-200 bg-gray-50" />
      }
    >
      <Widget />
    </Suspense>
  );
}

export function hasToolWidget(slug: string): boolean {
  return slug in WIDGETS;
}
