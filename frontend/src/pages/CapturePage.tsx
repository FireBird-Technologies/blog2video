import { useEffect, useState, type FC } from "react";
import { useSearchParams } from "react-router-dom";
import { TEMPLATE_PREVIEWS, TEMPLATE_PREVIEWS_PORTRAIT } from "../components/templatePreviewRegistry";
import { CaptureContext } from "../components/templatePreviews/PosterOrPlayer";
import CustomPreviewLandscape from "../components/templatePreviews/CustomPreviewLandscape";
import { BACKEND_URL } from "../api/client";

/**
 * Hidden route used by the poster/snapshot puppeteer scripts to render a single
 * template preview full-bleed at composition size and screenshot it. Not linked
 * anywhere in the app.
 *
 * Built-in poster: `/_capture?template=<id>&orientation=landscape|portrait`
 * Custom snapshot: `/_capture?custom=<id>&secret=<CAPTURE_SECRET>` (landscape only)
 *
 * The preview renders in `thumbnailMode` (so its own pause/seek effects park it on
 * a representative still frame) wrapped in `CaptureContext=true` so the poster
 * short-circuit is bypassed and the real preview renders. `#capture-root` is the
 * exact composition-sized box puppeteer screenshots. `window.__captureReady`
 * flips true once fonts + a settle window have elapsed.
 */

type CaptureData = {
  theme: unknown;
  name?: string;
  intro_code?: string | null;
  outro_code?: string | null;
  content_codes?: string[] | null;
  content_archetype_ids?: unknown;
  preview_image_url?: string | null;
  logo_urls?: string[];
  og_image?: string;
};

function useCaptureReady(dep: unknown) {
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
  }, [dep]);
}

const HIDE_CHROME_CSS = `
  .fixed.bottom-4.right-4 { display: none !important; }
  #capture-root :has(> [aria-label^="Preview "]) { display: none !important; }
`;

/** Custom-template snapshot: fetch the template's render data via the internal
 *  capture route (shared secret) and render its real landscape preview. */
function CustomCapture({ customId, secret }: { customId: string; secret: string }) {
  const [data, setData] = useState<CaptureData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${BACKEND_URL}/api/custom-templates/internal/capture-data/${customId}`, {
      headers: { "X-Capture-Secret": secret },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`capture-data ${r.status}`);
        return r.json();
      })
      .then((d: CaptureData) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [customId, secret]);

  // Only start the readiness clock once the data has loaded and rendered.
  useCaptureReady(data ? customId : null);

  if (error) return <div style={{ padding: 24, color: "#fff" }}>Capture error: {error}</div>;
  if (!data) return <div style={{ padding: 24, color: "#888" }}>Loading…</div>;

  return (
    <div id="capture-root" style={{ width: 1920, height: 1080, overflow: "hidden", position: "relative", background: "#000" }}>
      <CaptureContext.Provider value={true}>
        {(() => {
          const previewProps: Record<string, unknown> = {
            theme: data.theme,
            name: data.name,
            introCode: data.intro_code || undefined,
            outroCode: data.outro_code || undefined,
            contentCodes: data.content_codes || undefined,
            contentArchetypeIds: data.content_archetype_ids,
            previewImageUrl: null,
            logoUrls: data.logo_urls,
            ogImage: data.og_image,
            thumbnailFrame: 135,
            thumbnailMode: true,
          };
          const AnyPreview = CustomPreviewLandscape as unknown as FC<Record<string, unknown>>;
          return <AnyPreview {...previewProps} />;
        })()}
      </CaptureContext.Provider>
    </div>
  );
}

/** Built-in template poster capture (unchanged behaviour). */
function BuiltinCapture({ templateId, orientation }: { templateId: string; orientation: "landscape" | "portrait" }) {
  const Preview =
    orientation === "portrait" ? TEMPLATE_PREVIEWS_PORTRAIT[templateId] : TEMPLATE_PREVIEWS[templateId];
  const width = orientation === "portrait" ? 1080 : 1920;
  const height = orientation === "portrait" ? 1920 : 1080;

  useCaptureReady(`${templateId}:${orientation}`);

  if (!Preview) {
    return <div style={{ padding: 24 }}>Unknown template: {templateId}</div>;
  }

  return (
    <div id="capture-root" style={{ width, height, overflow: "hidden", position: "relative", background: "#000" }}>
      <CaptureContext.Provider value={true}>
        <Preview thumbnailMode />
      </CaptureContext.Provider>
    </div>
  );
}

export default function CapturePage() {
  const [params] = useSearchParams();
  const customId = params.get("custom");
  const secret = params.get("secret") ?? "";
  const templateId = params.get("template") ?? "";
  const orientation = params.get("orientation") === "portrait" ? "portrait" : "landscape";

  return (
    <div style={{ margin: 0, padding: 0, background: "#000" }}>
      {/* Keep the capture clean: hide global app chrome (support-widget launcher)
          and each preview's scene-nav dot pill, which would otherwise be baked
          into the screenshot. */}
      <style>{HIDE_CHROME_CSS}</style>
      {customId ? (
        <CustomCapture customId={customId} secret={secret} />
      ) : (
        <BuiltinCapture templateId={templateId} orientation={orientation} />
      )}
    </div>
  );
}
