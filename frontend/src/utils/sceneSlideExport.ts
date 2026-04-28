import type { PlayerRef } from "@remotion/player";
import type { Project } from "../api/client";
import { getSceneExportFrameSchedule } from "./sceneFrameSchedule";

/** Remotion places the live composition inside this element. */
const REMOTION_PLAYER_SELECTOR = ".__remotion-player";

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
      requestAnimationFrame(() => window.setTimeout(resolve, 80))
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
  const nw = raw.naturalWidth || dw;
  const nh = raw.naturalHeight || dh;
  const c = document.createElement("canvas");
  c.width = dw;
  c.height = dh;
  const ctx = c.getContext("2d")!;
  const s = fit === "cover" ? Math.max(dw / nw, dh / nh) : Math.min(dw / nw, dh / nh);
  const fw = nw * s, fh = nh * s;
  ctx.drawImage(raw, (dw - fw) / 2, (dh - fh) / 2, fw, fh);
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
 * WHY we temporarily strip the transform:
 * Remotion applies `transform: translateX(-50%) translateY(-50%) scale(S)` directly
 * on .__remotion-player to fit e.g. 1920×1080 inside a smaller player box.
 *
 * html2canvas uses getBoundingClientRect() to compute child positions relative to the
 * root element. With the scale transform in place, every child's position is in scaled
 * "visual" coordinates while the output canvas is at the logical (1920×1080) size —
 * so all content lands in the top-left corner at the wrong scale.
 *
 * By temporarily setting transform:none + top:0 + left:0, the canvas gets the full
 * 1920×1080 layout and child getBoundingClientRect() values match logical positions.
 * We restore the original styles immediately after the capture resolves.
 */
async function captureCompositionToDataUrl(playerContainer: HTMLElement): Promise<string> {
  const compositionEl =
    (playerContainer.querySelector(REMOTION_PLAYER_SELECTOR) as HTMLElement | null) ??
    playerContainer;

  const restoreImages = await inlineImagesForCapture(compositionEl);

  // Stash the styles we're about to override.
  const stash = {
    transform: compositionEl.style.transform,
    top: compositionEl.style.top,
    left: compositionEl.style.left,
    // Keep position:absolute — changing it to static breaks absolutely-placed children.
  };

  compositionEl.style.transform = "none";
  compositionEl.style.top = "0";
  compositionEl.style.left = "0";

  // One full paint cycle so the browser recalculates layout.
  await waitForPaint();

  try {
    const html2canvas = (await import("html2canvas")).default;

    // Scale:2 on a 1920×1080 element → 3840×2160 px canvas (crisp on any display).
    const canvas = await html2canvas(compositionEl, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: null,
      // Do NOT use foreignObjectRendering: it sizes the SVG via getBoundingClientRect()
      // which still returns the old visual size right after we changed the transform.
      foreignObjectRendering: false,
    });

    const dataUrl = canvas.toDataURL("image/png");
    if (!dataUrl || dataUrl.length < 300) {
      throw new Error("Capture produced an empty image — ensure the preview is fully loaded.");
    }
    return dataUrl;
  } finally {
    // Restore original styles — order matters, transform last.
    compositionEl.style.top = stash.top;
    compositionEl.style.left = stash.left;
    compositionEl.style.transform = stash.transform;
    restoreImages();
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Seek each scene to ~65%, wait for layout, capture. */
export async function captureSceneSnapshots(
  player: PlayerRef,
  project: Project
): Promise<{ dataUrl: string; title: string; safeSlug: string }[]> {
  const schedule = getSceneExportFrameSchedule(project);
  if (!schedule.length) throw new Error("No scenes to export.");

  const wasPlaying = player.isPlaying();
  player.pause();

  const playerContainer = player.getContainerNode();
  if (!playerContainer) throw new Error("Preview not ready — let it fully load first.");

  const out: { dataUrl: string; title: string; safeSlug: string }[] = [];

  try {
    for (const step of schedule) {
      player.seekTo(step.frame);
      await waitUntilFrame(player, step.frame);

      try {
        const dataUrl = await captureCompositionToDataUrl(playerContainer);
        out.push({ dataUrl, title: step.title, safeSlug: step.safeSlug });
      } catch (e) {
        throw new Error(
          `Scene "${step.title}": ${e instanceof Error ? e.message : "capture failed"}. ` +
            "If images are blank, ensure your R2 bucket has CORS (Access-Control-Allow-Origin) configured."
        );
      }
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
  project: Project
): Promise<void> {
  const base = projectBaseName(project);
  const shots = await captureSceneSnapshots(player, project);
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
  const iw = firstImg.naturalWidth || 1920;
  const ih = firstImg.naturalHeight || 1080;
  const slideW = 10; // inches
  const slideH = parseFloat(((ih / iw) * slideW).toFixed(4));
  pptx.defineLayout({ name: "B2V_SLIDE", width: slideW, height: slideH });
  pptx.layout = "B2V_SLIDE";

  for (const s of shots) {
    pptx.addSlide().addImage({ data: s.dataUrl, x: 0, y: 0, w: slideW, h: slideH });
  }

  await pptx.writeFile({ fileName: `${base}_scenes.pptx` });
}

export async function exportScenesPdf(
  player: PlayerRef,
  project: Project
): Promise<void> {
  const base = projectBaseName(project);
  const shots = await captureSceneSnapshots(player, project);
  const { jsPDF } = await import("jspdf");
  let doc: import("jspdf").jsPDF | null = null;

  for (const s of shots) {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Could not decode capture."));
      i.src = s.dataUrl;
    });
    const iw = img.naturalWidth || 1920;
    const ih = img.naturalHeight || 1080;
    const sc = Math.min(1, 1200 / Math.max(iw, ih));
    const w = Math.round(iw * sc);
    const h = Math.round(ih * sc);

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

/**
 * Downloads each scene as its own PNG. A 300 ms gap between each prevents
 * the browser from blocking sequential downloads.
 */
export async function exportScenesPng(
  player: PlayerRef,
  project: Project
): Promise<void> {
  const base = projectBaseName(project);
  const shots = await captureSceneSnapshots(player, project);

  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    const b64 = s.dataUrl.split(",")[1] ?? "";
    if (!b64) throw new Error(`Empty image data for scene ${i + 1}.`);
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
    downloadBlob(new Blob([bytes], { type: "image/png" }), `${base}_${s.safeSlug}.png`);
    if (i < shots.length - 1) await new Promise((r) => window.setTimeout(r, 300));
  }
}
