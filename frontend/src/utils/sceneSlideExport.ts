import type { PlayerRef } from "@remotion/player";
import type { Project } from "../api/client";
import { getSceneExportFrameSchedule } from "./sceneFrameSchedule";
import { getTemplateConfig } from "../components/remotion/templateConfig";

const EXPORT_CAPTURE_SCALE = 2;

function finitePositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() => window.setTimeout(resolve, 200))
    )
  );
}

async function waitUntilFrame(
  player: PlayerRef,
  target: number,
  maxMs = 3000
): Promise<void> {
  const start = performance.now();
  while (performance.now() - start < maxMs) {
    if (Math.abs(player.getCurrentFrame() - target) <= 1) {
      await waitForPaint();
      await waitForPaint();
      return;
    }
    await new Promise((r) => requestAnimationFrame(r));
  }
  await waitForPaint();
}

// ── Image helpers ─────────────────────────────────────────────────────────────

/**
 * Fetch a URL as a data: URL using a fresh crossOrigin="anonymous" request
 * with a cache-buster, guaranteeing a CORS-enabled response from the server.
 * (Same technique as MosaicImageReveal's ?cors=1 trick.)
 */
function loadCrossOriginDataUrl(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (!src || src.startsWith("data:") || src.startsWith("blob:")) {
      resolve(src || null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    const sep = src.includes("?") ? "&" : "?";
    img.src = `${src}${sep}_b2v_export=1`;
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth || 1;
        c.height = img.naturalHeight || 1;
        const ctx = c.getContext("2d");
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0);
        resolve(c.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    window.setTimeout(() => resolve(null), 12000);
  });
}

/** Draw image onto a canvas sized to `dw × dh`, simulating object-fit. */
function simulateObjectFit(
  raw: HTMLImageElement,
  dw: number,
  dh: number,
  fit: "cover" | "contain"
): string {
  const safeDw = Number.isFinite(dw) && dw > 0 ? dw : 1;
  const safeDh = Number.isFinite(dh) && dh > 0 ? dh : 1;
  const nw = raw.naturalWidth || safeDw;
  const nh = raw.naturalHeight || safeDh;
  if (!Number.isFinite(nw) || !Number.isFinite(nh) || nw <= 0 || nh <= 0) {
    const c = document.createElement("canvas");
    c.width = Math.round(safeDw);
    c.height = Math.round(safeDh);
    return c.toDataURL("image/png");
  }
  const c = document.createElement("canvas");
  c.width = Math.round(safeDw);
  c.height = Math.round(safeDh);
  const ctx = c.getContext("2d")!;
  const s = fit === "cover" ? Math.max(safeDw / nw, safeDh / nh) : Math.min(safeDw / nw, safeDh / nh);
  const fw = nw * s, fh = nh * s;
  if (!Number.isFinite(fw) || !Number.isFinite(fh)) return c.toDataURL("image/png");
  ctx.drawImage(raw, (safeDw - fw) / 2, (safeDh - fh) / 2, fw, fh);
  return c.toDataURL("image/png");
}

/**
 * Replace every <img> and background-image URL with an inlined data: URL so
 * html2canvas can draw them without canvas taint. Also pre-simulates
 * object-fit: cover/contain because html2canvas does not support that CSS property.
 * Returns a cleanup function that restores all originals.
 */
async function inlineImagesForCapture(root: HTMLElement): Promise<() => void> {
  const restoreFns: Array<() => void> = [];

  // ── <img> elements ────────────────────────────────────────────────────────
  await Promise.all(
    (Array.from(root.querySelectorAll("img")) as HTMLImageElement[]).map(async (img) => {
      const src = img.src;
      if (!src || src.startsWith("data:") || src.startsWith("blob:")) return;

      const dataUrl = await loadCrossOriginDataUrl(src);
      if (!dataUrl) return;

      const computed = window.getComputedStyle(img);
      const fit = computed.objectFit;
      const dw = img.offsetWidth;
      const dh = img.offsetHeight;

      let finalUrl = dataUrl;
      let patchStyle = false;

      if ((fit === "cover" || fit === "contain") && dw > 0 && dh > 0) {
        const raw = new Image();
        await new Promise<void>((res) => { raw.onload = () => res(); raw.onerror = () => res(); raw.src = dataUrl; });
        finalUrl = simulateObjectFit(raw, dw, dh, fit as "cover" | "contain");
        patchStyle = true;
      }

      const origSrc = img.src;
      const origOF = img.style.objectFit;
      const origW = img.style.width;
      const origH = img.style.height;

      img.src = finalUrl;
      if (patchStyle) {
        img.style.objectFit = "fill";
        img.style.width = `${dw}px`;
        img.style.height = `${dh}px`;
      }
      try { await img.decode(); } catch { /* ignore */ }

      restoreFns.push(() => {
        img.src = origSrc;
        img.style.objectFit = origOF;
        img.style.width = origW;
        img.style.height = origH;
      });
    })
  );

  // ── background-image (inline + computed) ──────────────────────────────────
  await Promise.all(
    (Array.from(root.querySelectorAll<HTMLElement>("*"))).map(async (el) => {
      const bg = el.style.backgroundImage || window.getComputedStyle(el).backgroundImage;
      if (!bg || bg === "none" || !bg.includes("url(")) return;

      const re = /url\(["']?([^"')]+)["']?\)/g;
      const replacements: { search: string; data: string }[] = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(bg)) !== null) {
        const u = m[1];
        if (!u || u.startsWith("data:") || u.startsWith("blob:")) continue;
        const d = await loadCrossOriginDataUrl(u);
        if (d) replacements.push({ search: u, data: d });
      }
      if (!replacements.length) return;

      let newBg = bg;
      for (const { search, data } of replacements) newBg = newBg.replace(search, data);
      const origInline = el.style.backgroundImage;
      el.style.backgroundImage = newBg;
      restoreFns.push(() => { el.style.backgroundImage = origInline; });
    })
  );

  await waitForPaint();
  return () => restoreFns.forEach((fn) => fn());
}

// ── Core capture ──────────────────────────────────────────────────────────────

/**
 * Capture the Remotion composition at its native resolution.
 *
 * We capture the composition exactly as currently laid out by the Remotion Player
 * so exported positioning matches what the user sees in preview.
 */
async function captureCompositionToDataUrl(playerContainer: HTMLElement, compositionWidth: number): Promise<string> {
  // Capture the exact surface users see in preview to avoid geometry drift.
  const captureRoot = playerContainer;

  // Scale up from the container's current on-screen size to the composition's native
  // resolution. In portrait mode the container is much smaller on screen (to fit the
  // viewport) so a fixed pixelRatio:2 would produce a low-res export; this ensures
  // the output is always at least the full composition width.
  const containerW = finitePositive(captureRoot.offsetWidth, compositionWidth);
  const dynamicScale = Math.max(EXPORT_CAPTURE_SCALE, compositionWidth / containerW);

  let restoreImages: () => void = () => {};
  try {
    restoreImages = await inlineImagesForCapture(captureRoot);
  } catch {
    // If image inlining fails (e.g., non-finite canvas ops), continue with raw DOM capture.
    restoreImages = () => {};
  }

  try {
    // Keep text metrics consistent with preview by waiting for webfonts.
    if ("fonts" in document) {
      try {
        await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
      } catch {
        // ignore
      }
    }

    /**
     * Remotion fits the composition with transforms inside the player box; html-to-image otherwise
     * rasterizes that scaled layout into a larger bitmap with content hugging one corner.
     * Lay out at native composition pixels so every export is full-frame like the preview.
     */
    await waitForPaint();

    const { toPng } = await import("html-to-image");

    try {
      const dataUrl = await toPng(captureRoot, {
        pixelRatio: dynamicScale,
        cacheBust: true,
        skipFonts: false,
        backgroundColor: "transparent",
      });
      if (!dataUrl || dataUrl.length < 300) {
        throw new Error("html-to-image produced empty output.");
      }
      return dataUrl;
    } catch {
      const html2canvas = (await import("html2canvas")).default;
      let canvas: HTMLCanvasElement;
      try {
        canvas = await html2canvas(captureRoot, {
          scale: dynamicScale,
          useCORS: true,
          allowTaint: false,
          logging: false,
          backgroundColor: null,
          foreignObjectRendering: false,
        });
      } catch {
        // Final frontend fallback: capture composition at scale 1.
        canvas = await html2canvas(captureRoot, {
          scale: 1,
          useCORS: true,
          allowTaint: false,
          logging: false,
          backgroundColor: null,
          foreignObjectRendering: false,
        });
      }

      const dataUrl = canvas.toDataURL("image/png");
      if (!dataUrl || dataUrl.length < 300) {
        throw new Error("Capture produced an empty image — ensure the preview is fully loaded.");
      }
      return dataUrl;
    }
  } finally {
    restoreImages();
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Seek the player to each scene's chosen frame and capture it.
 * The player must be visible (not opacity:0) and at full composition size
 * so html2canvas sees the real layout with no scale transform.
 */
export async function captureSceneSnapshots(
  player: PlayerRef,
  project: Project,
  timelineFractions?: number[]
): Promise<{ dataUrl: string; title: string; safeSlug: string }[]> {
  const schedule = getSceneExportFrameSchedule(project, timelineFractions);
  if (!schedule.length) throw new Error("No scenes to export.");

  const config = getTemplateConfig(project.template ?? "default");
  const isPortrait = project.aspect_ratio === "portrait";
  const compositionWidth = isPortrait ? config.baseHeight : config.baseWidth;

  const wasPlaying = player.isPlaying();
  player.pause();

  const playerContainer = player.getContainerNode();
  if (!playerContainer) throw new Error("Preview not ready — let it fully load first.");

  const out: { dataUrl: string; title: string; safeSlug: string }[] = [];

  try {
    for (const step of schedule) {
      player.pause();
      player.seekTo(step.frame);
      await waitUntilFrame(player, step.frame);
      let dataUrl: string;
      try {
        dataUrl = await captureCompositionToDataUrl(playerContainer, compositionWidth);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `Scene "${step.title}": could not capture preview at frame ${step.frame}. ${msg}`
        );
      }
      out.push({ dataUrl, title: step.title, safeSlug: step.safeSlug });
    }
  } finally {
    if (wasPlaying) { try { player.play(); } catch { /* ignore */ } }
  }

  return out;
}

function projectBaseName(p: Project): string {
  return (p.name ?? "project").replace(/\s+/g, "_").slice(0, 50);
}

// ── Exporters ─────────────────────────────────────────────────────────────────

export async function exportScenesPptx(
  player: PlayerRef,
  project: Project,
  timelineFractions?: number[]
): Promise<void> {
  const base = projectBaseName(project);
  const shots = await captureSceneSnapshots(player, project, timelineFractions);
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();

  // Derive exact slide dimensions from the captured image's aspect ratio
  // so there are zero letterbox / pillarbox borders in PowerPoint.
  const firstImg = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("Could not decode captured frame."));
    i.src = shots[0].dataUrl;
  });
  const iw = finitePositive(firstImg.naturalWidth, 1920);
  const ih = finitePositive(firstImg.naturalHeight, 1080);
  const slideW = 10; // inches
  const slideH = finitePositive(parseFloat(((ih / iw) * slideW).toFixed(4)), 5.625);
  pptx.defineLayout({ name: "B2V_SLIDE", width: slideW, height: slideH });
  pptx.layout = "B2V_SLIDE";

  for (const s of shots) {
    pptx.addSlide().addImage({ data: s.dataUrl, x: 0, y: 0, w: slideW, h: slideH });
  }

  await pptx.writeFile({ fileName: `${base}_scenes.pptx` });
}

export async function exportScenesPdf(
  player: PlayerRef,
  project: Project,
  timelineFractions?: number[]
): Promise<void> {
  const base = projectBaseName(project);
  const shots = await captureSceneSnapshots(player, project, timelineFractions);
  const { jsPDF } = await import("jspdf");
  let doc: import("jspdf").jsPDF | null = null;

  for (const s of shots) {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Could not decode capture."));
      i.src = s.dataUrl;
    });
    const w = finitePositive(img.naturalWidth, 1920);
    const h = finitePositive(img.naturalHeight, 1080);

    if (!doc) {
      doc = new jsPDF({ unit: "pt", format: [w, h], orientation: w >= h ? "landscape" : "portrait", compress: true });
    } else {
      doc.addPage([w, h], w >= h ? "l" : "p");
    }
    doc.addImage(s.dataUrl, "PNG", 0, 0, w, h);
  }

  if (!doc) throw new Error("No pages generated.");
  doc.save(`${base}_scenes.pdf`);
}

/** Downloads all scene PNGs as a single zip file. */
export async function exportScenesPng(
  player: PlayerRef,
  project: Project,
  timelineFractions?: number[]
): Promise<void> {
  const base = projectBaseName(project);
  const shots = await captureSceneSnapshots(player, project, timelineFractions);

  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();

  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    const b64 = s.dataUrl.split(",")[1] ?? "";
    if (!b64) throw new Error(`Empty image data for scene ${i + 1}.`);
    zip.file(`${String(i + 1).padStart(2, "0")}_${s.safeSlug}.png`, b64, { base64: true });
  }

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  downloadBlob(blob, `${base}_scenes.zip`);
}
