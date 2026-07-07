import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { TEMPLATE_PREVIEWS, TEMPLATE_PREVIEWS_PORTRAIT } from "../components/templatePreviewRegistry";
import { CaptureContext } from "../components/templatePreviews/PosterOrPlayer";

/**
 * Hidden route used by `scripts/capture-posters.ts` (puppeteer) to render a
 * single built-in template preview full-bleed at composition size and screenshot
 * it into a static poster. Not linked anywhere in the app.
 *
 * `/_capture?template=<id>&orientation=landscape|portrait`
 *
 * The preview is rendered in `thumbnailMode` (so its own pause/seek effects park
 * it on a representative still frame) but wrapped in `CaptureContext=true` so the
 * poster short-circuit is bypassed and the real preview renders. `#capture-root`
 * is the exact composition-sized box puppeteer screenshots.
 */
export default function CapturePage() {
  const [params] = useSearchParams();
  const templateId = params.get("template") ?? "";
  const orientation = params.get("orientation") === "portrait" ? "portrait" : "landscape";

  const Preview =
    orientation === "portrait"
      ? TEMPLATE_PREVIEWS_PORTRAIT[templateId]
      : TEMPLATE_PREVIEWS[templateId];

  const width = orientation === "portrait" ? 1080 : 1920;
  const height = orientation === "portrait" ? 1920 : 1080;

  // Signal readiness once fonts have loaded and a couple of frames + a short
  // settle window have elapsed, so puppeteer screenshots a fully painted scene.
  useEffect(() => {
    let cancelled = false;
    (window as unknown as { __captureReady?: boolean }).__captureReady = false;
    const markReady = () => {
      if (cancelled) return;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setTimeout(() => {
            if (!cancelled) (window as unknown as { __captureReady?: boolean }).__captureReady = true;
          }, 600);
        }),
      );
    };
    if (document.fonts?.ready) {
      document.fonts.ready.then(markReady).catch(markReady);
    } else {
      markReady();
    }
    return () => {
      cancelled = true;
    };
  }, [templateId, orientation]);

  if (!Preview) {
    return <div style={{ padding: 24 }}>Unknown template: {templateId}</div>;
  }

  return (
    <div style={{ margin: 0, padding: 0, background: "#000" }}>
      {/* Keep the poster clean: hide global app chrome (the fixed support-widget
          launcher) and each preview's scene-nav dot pill, which would otherwise
          be baked into the screenshot. The nav-dot buttons all carry an
          aria-label starting with "Preview "; hide the pill that contains them. */}
      <style>{`
        .fixed.bottom-4.right-4 { display: none !important; }
        #capture-root :has(> [aria-label^="Preview "]) { display: none !important; }
      `}</style>
      <div
        id="capture-root"
        style={{ width, height, overflow: "hidden", position: "relative", background: "#000" }}
      >
        <CaptureContext.Provider value={true}>
          <Preview thumbnailMode />
        </CaptureContext.Provider>
      </div>
    </div>
  );
}
