import type { Project } from "../api/client";
import { renderProjectStills } from "../api/client";
import { getSceneExportFrameSchedule } from "./sceneFrameSchedule";

/**
 * Reports export progress so the UI can show which scene is rendering.
 * `completed` is the number of slides finished BEFORE the named one starts, so
 * `{completed: 0, total: 5, title: "Cover"}` means "rendering 1 of 5: Cover".
 * The final call omits `title` and has `completed === total`.
 */
export type ExportProgress = (p: {
  completed: number;
  total: number;
  title?: string;
}) => void;

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

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Produce one image per scene at its chosen frame, rendered by Remotion on the
 * backend — the same pipeline that produces the MP4.
 *
 * Why not screenshot the Player (what this used to do): html-to-image serialises
 * the DOM into an SVG foreignObject, and Chromium silently declines to paint some
 * layers inside it. The magazine cover exported as a blank cream page for exactly
 * that reason — the generated SVG provably contained the masthead, the desk colour
 * and the artwork, yet only the flat page-edge gradient rasterized. html2canvas
 * failed identically, so it was not a library bug to patch around. That approach
 * also had to fight canvas tainting, <video> elements that neither library can
 * draw, and Player remounts detaching the captured node mid-export. Rendering
 * server-side removes all of it.
 *
 * Trade-off: a network round trip and real render time (seconds per slide) instead
 * of an instant local screenshot.
 */
export async function captureSceneSnapshots(
  project: Project,
  timelineFractions?: number[],
  onProgress?: ExportProgress
): Promise<{ dataUrl: string; title: string; safeSlug: string }[]> {
  const schedule = getSceneExportFrameSchedule(project, timelineFractions);
  if (!schedule.length) throw new Error("No scenes to export.");

  // ONE request that streams a slide per line, rather than a request per slide.
  // Each render is ~3.6s, so the UI needs to say which slide it is on — but doing
  // that with separate requests re-runs the workspace sync and re-bundles every
  // time (measured ~89% slower end to end). Streaming keeps the batch speed and
  // still reports progress.
  const out: { dataUrl: string; title: string; safeSlug: string }[] = [];
  onProgress?.({ completed: 0, total: schedule.length, title: schedule[0]!.title });

  await renderProjectStills(project.id, schedule.map((s) => s.frame), ({ index, image }) => {
    const step = schedule[index];
    if (!step) return;
    out.push({ dataUrl: image, title: step.title, safeSlug: step.safeSlug });
    // Report the NEXT slide as in-flight; the last call lands on completed === total.
    onProgress?.({
      completed: index + 1,
      total: schedule.length,
      title: schedule[index + 1]?.title,
    });
  });

  if (out.length !== schedule.length) {
    throw new Error(
      `Expected ${schedule.length} rendered slides but received ${out.length}.`
    );
  }
  return out;
}

function projectBaseName(p: Project): string {
  return (p.name ?? "project").replace(/\s+/g, "_").slice(0, 50);
}

// ── Exporters ─────────────────────────────────────────────────────────────────

export async function exportScenesPptx(
  project: Project,
  timelineFractions?: number[],
  onProgress?: ExportProgress
): Promise<void> {
  const base = projectBaseName(project);
  const shots = await captureSceneSnapshots(project, timelineFractions, onProgress);
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
  project: Project,
  timelineFractions?: number[],
  onProgress?: ExportProgress
): Promise<void> {
  const base = projectBaseName(project);
  const shots = await captureSceneSnapshots(project, timelineFractions, onProgress);
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
  project: Project,
  timelineFractions?: number[],
  onProgress?: ExportProgress
): Promise<void> {
  const base = projectBaseName(project);
  const shots = await captureSceneSnapshots(project, timelineFractions, onProgress);

  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();

  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    const b64 = s.dataUrl.split(",")[1] ?? "";
    if (!b64) throw new Error(`Empty image data for scene ${i + 1}.`);
    zip.file(`${s.safeSlug}.png`, b64, { base64: true });
  }

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  downloadBlob(blob, `${base}_scenes.zip`);
}
