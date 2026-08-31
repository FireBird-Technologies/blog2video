/**
 * Scene shot server — screenshots ONE generated scene, on demand.
 *
 * WHY A LONG-LIVED PROCESS
 * ------------------------
 * `snapshot-worker.mjs` launches Chrome, screenshots, and closes it. That is
 * right for a once-per-template thumbnail, but the visual check runs per scene
 * ATTEMPT, so a ~2-3s browser cold start each time is exactly the latency
 * ballooning this feature must avoid. This holds one Chrome and a small page
 * pool for the life of the process.
 *
 * Pool size is 3, not 8. Every page compiles Babel and mounts a Remotion Player,
 * so concurrency costs real memory in the backend container — and the check only
 * fires for a minority of scenes, so 3 will rarely be the bottleneck.
 *
 * PROTOCOL
 *   POST /shot  {job, secret}  -> image/webp bytes, or a non-200 with a reason
 *   GET  /health               -> "ok"
 *
 * Every failure returns a non-200 rather than throwing: the Python caller treats
 * any non-200 as "no opinion" and ships the scene unverified.
 *
 * ENV
 *   SCENE_SHOT_PORT      default 7861
 *   SCENE_SHOT_HOST      default 127.0.0.1; set 0.0.0.0 to run as a Compose
 *                        sidecar (the backend container cannot reach this
 *                        container's loopback). Keep the port unpublished.
 *   CAPTURE_FRONTEND_URL the deployed frontend serving /_capture
 *   CAPTURE_SECRET       shared secret, checked on every request
 *   PUPPETEER_EXECUTABLE_PATH  optional, else Chrome channel
 */
import http from "node:http";
import puppeteer from "puppeteer-core";

const PORT = Number(process.env.SCENE_SHOT_PORT || 7861);
const FRONTEND = (process.env.CAPTURE_FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
const SECRET = process.env.CAPTURE_SECRET || "";
const WIDTH = 1920;
const HEIGHT = 1080;
// ONE page, created per shot and closed after.
//
// A pool of pre-opened tabs was the original design (fewer allocations), but
// only one tab can be visible at a time and Chrome throttles rAF in the rest —
// so pooled pages never fired the nested requestAnimationFrame calls that
// `useCaptureReady` waits on. Measured: a lone page became ready in 2s; the same
// page inside a 3-tab pool was still not ready at 20s, and
// --disable-renderer-backgrounding did not fix it.
//
// The BROWSER is still reused, which is where the real cost was (~2-3s of Chrome
// cold start). Opening a tab is milliseconds, so this keeps the speed win and
// drops the failure mode. Shots serialise, which is fine: the visual check fires
// for a minority of scenes.
const POOL_SIZE = 1;
const NAV_TIMEOUT_MS = 20_000;
// MUST exceed the capture page's own readiness fallback.
//
// `useCaptureReady` waits for `__previewFrameSettled` OR gives up after 15s and
// marks ready anyway (for previews that never mount a player). At 15s here the
// server abandoned the page at the exact moment that fallback fired — a race
// that made every shot fail even though the scene had rendered correctly. The
// page needs 15s + two rAFs + a 600ms settle, so allow real headroom.
const READY_TIMEOUT_MS = 22_000;
// Recycle a page after this many shots so long-lived tabs cannot accumulate
// leaked Babel/Player state.
const RECYCLE_AFTER = 25;

let browser = null;
/** @type {{page: import("puppeteer-core").Page, busy: boolean, shots: number}[]} */
let pool = [];

async function ensureBrowser() {
  if (browser && browser.connected) return;
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
  browser = await puppeteer.launch({
    ...(executablePath ? { executablePath } : { channel: "chrome" }),
    headless: true,
    args: [
      "--no-sandbox",
      "--force-color-profile=srgb",
      "--hide-scrollbars",
      "--lang=en-US",
      // CRITICAL for the page pool. Chrome throttles requestAnimationFrame in
      // backgrounded tabs, and only ONE pooled tab can be visible at a time — so
      // the others never fire the nested rAFs that `useCaptureReady` waits on and
      // never become ready. Measured: a lone page was ready in 2s; the same page
      // inside a 3-tab pool was still not ready at 20s.
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-background-timer-throttling",
    ],
  });
  pool = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
    pool.push({ page, busy: false, shots: 0 });
  }
  console.log(`[scene-shot] browser up, ${POOL_SIZE} pages`);
}

async function acquire(timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const slot = pool.find((s) => !s.busy);
    if (slot) {
      slot.busy = true;
      return slot;
    }
    if (Date.now() > deadline) return null;
    await new Promise((r) => setTimeout(r, 60));
  }
}

async function release(slot) {
  slot.shots += 1;
  if (slot.shots >= RECYCLE_AFTER) {
    try {
      await slot.page.close();
      slot.page = await browser.newPage();
      await slot.page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
      slot.shots = 0;
    } catch (e) {
      console.warn(`[scene-shot] page recycle failed: ${e.message}`);
    }
  }
  slot.busy = false;
}

async function shoot(job, payload) {
  await ensureBrowser();
  const slot = await acquire();
  if (!slot) throw new Error("all pages busy");
  try {
    // Hand the scene payload to the page directly rather than having it fetch
    // the job back from the backend. The job store is per-process, so a fetch
    // can land on a different uvicorn worker than the one that stored it; this
    // sidesteps that entirely and saves a round trip. The page still supports
    // the fetch path as a fallback when no payload is injected.
    if (payload) {
      await slot.page.evaluateOnNewDocument((p) => {
        window.__sceneCaptureJob = p;
      }, payload);
    }
    const url = `${FRONTEND}/_capture?scene=1&job=${encodeURIComponent(job)}&secret=${encodeURIComponent(SECRET)}`;
    // `domcontentloaded`, not `networkidle0`.
    //
    // The app fires analytics requests that are blocked or aborted in headless
    // Chrome, so the network may never go idle and the navigation burns its
    // whole timeout before the page is even inspected. `__captureReady` is the
    // real readiness signal — it flips only once the scene has compiled, the
    // player has settled on its frame, and fonts have loaded — so waiting on it
    // directly is both faster and more accurate.
    await slot.page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
    try {
      await slot.page.waitForFunction("window.__captureReady === true", { timeout: READY_TIMEOUT_MS });
    } catch (e) {
      // Say WHY it never became ready — "Waiting failed: 15000ms exceeded" alone
      // is undiagnosable, and this is the one step with real moving parts.
      const diag = await slot.page
        .evaluate(() => ({
          injected: !!window.__sceneCaptureJob,
          ready: window.__captureReady ?? null,
          root: !!document.querySelector("#capture-root"),
          text: (document.body?.innerText || "").slice(0, 160),
        }))
        .catch(() => null);
      throw new Error(`captureReady timeout — ${JSON.stringify(diag)}`);
    }
    await slot.page.evaluate(() => document.fonts?.ready);
    const el = await slot.page.$("#capture-root");
    if (!el) throw new Error("#capture-root not found");
    // Quality 70, not 82: this image is only ever seen by a vision model, and
    // smaller bytes mean a faster upload on a latency-sensitive path.
    return Buffer.from(await el.screenshot({ type: "webp", quality: 70 }));
  } finally {
    await release(slot);
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200).end("ok");
    return;
  }
  if (req.method !== "POST" || !req.url.startsWith("/shot")) {
    res.writeHead(404).end("not found");
    return;
  }
  let body = "";
  req.on("data", (c) => {
    body += c;
    if (body.length > 1e6) req.destroy();
  });
  req.on("end", async () => {
    try {
      const { job, secret, payload } = JSON.parse(body || "{}");
      if (!SECRET || secret !== SECRET) {
        res.writeHead(403).end("bad secret");
        return;
      }
      if (!job) {
        res.writeHead(400).end("missing job");
        return;
      }
      const png = await shoot(job, payload);
      res.writeHead(200, { "Content-Type": "image/webp", "Content-Length": png.length });
      res.end(png);
    } catch (e) {
      console.warn(`[scene-shot] ${e.message}`);
      res.writeHead(500).end(String(e.message || e));
    }
  });
});

// Bind 127.0.0.1 by default — the safe choice when the backend runs beside this
// process on the same host. In Docker Compose the backend is a DIFFERENT
// container with its own loopback, so it cannot reach 127.0.0.1 here; that
// deployment sets SCENE_SHOT_HOST=0.0.0.0 and keeps the port OFF `ports:` so it
// stays on the internal network. Requests are authenticated by CAPTURE_SECRET
// either way.
const HOST = process.env.SCENE_SHOT_HOST || "127.0.0.1";

server.listen(PORT, HOST, () => {
  console.log(`[scene-shot] listening on ${HOST}:${PORT}, frontend=${FRONTEND}`);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => {
    try {
      if (browser) await browser.close();
    } catch {
      /* shutting down anyway */
    }
    process.exit(0);
  });
}
