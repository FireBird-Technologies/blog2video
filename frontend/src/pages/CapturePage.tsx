import { useEffect, useState, type FC } from "react";
import { useSearchParams } from "react-router-dom";
import { TEMPLATE_PREVIEWS, TEMPLATE_PREVIEWS_PORTRAIT } from "../components/templatePreviewRegistry";
import { CaptureContext } from "../components/templatePreviews/PosterOrPlayer";
import CustomPreviewLandscape from "../components/templatePreviews/CustomPreviewLandscape";
import CraftedTemplatePreview from "../components/templatePreviews/CraftedTemplatePreview";
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
  /** design_blueprint.version — 2 means the outro renders its own CTA;
   *  1 (or absent) means the CTA overlay replaces it. */
  design_blueprint?: { version?: number } | null;
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

/** Signals `window.__captureReady` once the scene is painted and parked on its
 *  target frame, so puppeteer screenshots a settled composition.
 *
 *  When the preview drives a Remotion player it sets `__previewFrameSettled`
 *  after seeking to `thumbnailFrame`; we wait for that (bounded) before the
 *  usual fonts + settle window, otherwise the screenshot can land on frame ~0
 *  while the composition is still mounting. */
function useCaptureReady(dep: unknown) {
  useEffect(() => {
    let cancelled = false;
    const w = window as unknown as {
      __captureReady?: boolean;
      __previewFrameSettled?: boolean;
    };
    w.__captureReady = false;
    const started = Date.now();

    const markReady = () => {
      if (cancelled) return;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setTimeout(() => {
            if (!cancelled) w.__captureReady = true;
          }, 600);
        }),
      );
    };

    // Wait for the player to park on its frame; give up after 15s so previews
    // that never mount a player (static/CSS ones) still capture.
    const waitForFrame = () => {
      if (cancelled) return;
      if (w.__previewFrameSettled || Date.now() - started > 15_000) {
        markReady();
        return;
      }
      setTimeout(waitForFrame, 100);
    };

    if (document.fonts?.ready) {
      document.fonts.ready.then(waitForFrame).catch(waitForFrame);
    } else {
      waitForFrame();
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
            // So the captured thumbnail shows the ending the real video renders:
            // a v2 outro draws its own CTA, a v1 outro is replaced by the overlay.
            designVersion: (data.design_blueprint as { version?: number } | null)
              ?.version,
            previewImageUrl: null,
            logoUrls: data.logo_urls,
            ogImage: data.og_image,
            // Scenes are PREVIEW_SCENE_FRAMES = 150 long and fade out at the end,
            // so stay clear of both the intro animation and the outgoing fade:
            // ~110 is fully settled mid-scene.
            thumbnailFrame: 110,
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

/** Crafted-template capture from a LOCAL bundle: fetch the raw preview_file TSX
 *  source from `srcUrl` (served by the capture script) and render it via the
 *  same compile path the app uses, so `scripts/capture-crafted-thumbnails.ts`
 *  can screenshot a bundle's real preview before it's uploaded to R2. */
function CraftedCapture({ srcUrl, name }: { srcUrl: string; name: string }) {
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(srcUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`preview source ${r.status}`);
        return r.text();
      })
      .then((t) => {
        if (!cancelled) setSource(t);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [srcUrl]);

  useCaptureReady(source ? srcUrl : null);

  if (error) return <div style={{ padding: 24, color: "#fff" }}>Capture error: {error}</div>;
  if (!source) return <div style={{ padding: 24, color: "#888" }}>Loading…</div>;

  return (
    <div id="capture-root" style={{ width: 1920, height: 1080, overflow: "hidden", position: "relative", background: "#000" }}>
      <CaptureContext.Provider value={true}>
        <CraftedTemplatePreview
          templateId={`local-${name}`}
          previewSource={source}
          name={name}
          thumbnailMode
        />
      </CaptureContext.Provider>
    </div>
  );
}

type SceneJob = {
  code: string;
  theme: unknown;
  scene_type?: string;
  scene_index?: number;
  total_scenes?: number;
  logo_urls?: string[];
};

/**
 * Renders ONE generated scene for visual verification.
 *
 * `/_capture?scene=1&job=<id>&secret=<CAPTURE_SECRET>`
 *
 * The scene's code is 200-400 lines, far too large for a query string, so it is
 * fetched by job id from a short-lived server-side store.
 *
 * It reuses CustomPreviewLandscape with a single scene rather than
 * reimplementing the composition, so the frame the vision model inspects is
 * pixel-identical to what the real preview renders — a bespoke harness here
 * would risk verifying something users never see.
 *
 * Content scenes deliberately receive NO imageUrl (matching CustomPreview), so
 * the !hasImage branch renders. That is the branch most often reported broken.
 */
const SceneCapture: FC<{ job: string; secret: string }> = ({ job, secret }) => {
  const [data, setData] = useState<SceneJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // The shot server injects the payload before navigation, which avoids a
    // round trip AND the job store's process affinity (it lives in one uvicorn
    // worker, so a fetch can land on a different one). Fall back to fetching
    // when nothing was injected, so the route stays usable by hand.
    const injected = (window as unknown as { __sceneCaptureJob?: SceneJob }).__sceneCaptureJob;
    if (injected?.code) {
      setData(injected);
      return;
    }
    fetch(`${BACKEND_URL}/api/custom-templates/internal/scene-capture-job/${job}`, {
      headers: { "X-Capture-Secret": secret },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`job ${r.status}`))))
      .then((d: SceneJob) => {
        if (!cancelled) setData(d);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [job, secret]);

  useCaptureReady(data ? job : null);

  if (error) return <div style={{ padding: 24, color: "#fff" }}>Scene capture error: {error}</div>;
  if (!data) return <div style={{ padding: 24, color: "#888" }}>Loading…</div>;

  const AnyPreview = CustomPreviewLandscape as unknown as FC<Record<string, unknown>>;
  return (
    <div
      id="capture-root"
      style={{ width: 1920, height: 1080, overflow: "hidden", position: "relative", background: "#000" }}
    >
      <CaptureContext.Provider value={true}>
        <AnyPreview
          theme={data.theme}
          name="Preview"
          // A single scene in the intro slot: CustomPreview renders slot-by-slot,
          // so one code string means one composed frame.
          introCode={data.code}
          contentCodes={undefined}
          outroCode={undefined}
          logoUrls={data.logo_urls ?? []}
          previewImageUrl={null}
          thumbnailFrame={110}
          thumbnailMode={true}
        />
      </CaptureContext.Provider>
    </div>
  );
};

export default function CapturePage() {
  const [params] = useSearchParams();
  const sceneJob = params.get("scene") === "1" ? params.get("job") : null;
  const customId = params.get("custom");
  const craftedSrc = params.get("craftedSrc");
  const craftedName = params.get("name") ?? "Template";
  const secret = params.get("secret") ?? "";
  const templateId = params.get("template") ?? "";
  const orientation = params.get("orientation") === "portrait" ? "portrait" : "landscape";

  return (
    <div style={{ margin: 0, padding: 0, background: "#000" }}>
      {/* Keep the capture clean: hide global app chrome (support-widget launcher)
          and each preview's scene-nav dot pill, which would otherwise be baked
          into the screenshot. */}
      <style>{HIDE_CHROME_CSS}</style>
      {sceneJob ? (
        <SceneCapture job={sceneJob} secret={secret} />
      ) : customId ? (
        <CustomCapture customId={customId} secret={secret} />
      ) : craftedSrc ? (
        <CraftedCapture srcUrl={craftedSrc} name={craftedName} />
      ) : (
        <BuiltinCapture templateId={templateId} orientation={orientation} />
      )}
    </div>
  );
}
