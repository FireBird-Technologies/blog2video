// Render a generated scene in a REAL browser with the REAL FitText, and report
// what the console says. This is the one thing ReactDOMServer cannot tell us:
// useLayoutEffect (where FitText measures and holds delayRender) only runs here.
const fs = require("fs");
const puppeteer = require("puppeteer-core");

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sceneFile = process.argv[2];
const sceneCode = fs.readFileSync(sceneFile, "utf8");

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const page = await browser.newPage();
  const logs = [];
  page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));

  const babelSrc = fs.readFileSync("node_modules/@babel/standalone/babel.min.js", "utf8");
  const reactSrc = fs.readFileSync("node_modules/react/umd/react.production.min.js", "utf8");
  const domSrc = fs.readFileSync("node_modules/react-dom/umd/react-dom.production.min.js", "utf8");

  await page.setContent("<!doctype html><html><body><div id=root></div></body></html>");
  await page.addScriptTag({ content: reactSrc });
  await page.addScriptTag({ content: domSrc });
  await page.addScriptTag({ content: babelSrc });

  const result = await page.evaluate((code) => {
    const out = { error: null, html: "", text: "" };
    try {
      const cleaned = code.replace(/^import\s+.*$/gm, "").replace(/^export\s+(default\s+)?/gm, "");
      const js = Babel.transform(cleaned, { presets: ["react"], filename: "g.tsx" }).code;

      const R = React;
      const useCurrentFrame = () => 30;
      const useVideoConfig = () => ({ fps: 30, width: 1920, height: 1080, durationInFrames: 150 });
      const interpolate = (f, i, o) => (Array.isArray(o) ? o[o.length - 1] : 0);
      const spring = () => 1, random = () => 0.5;
      const E = (t) => t;
      const Easing = { bezier: () => E, linear: E, ease: E, in: f=>f, out: f=>f, inOut: f=>f,
        quad:E, cubic:E, quint:E, sin:E, circle:E, exp:E, back:()=>E, bounce:E, elastic:()=>E, poly:()=>E };
      const AbsoluteFill = (p) => R.createElement("div", { style: { position:"absolute", inset:0, ...p.style } }, p.children);
      const Sequence = (p) => R.createElement("div", null, p.children);
      const Img = (p) => R.createElement("img", p);

      // REAL FitText behaviour is what we want to test, but the kit module is
      // TS. Emulate its critical property: it measures in useLayoutEffect.
      const FitText = (p) => {
        const ref = R.useRef(null);
        const [px, setPx] = R.useState(p.fontSize || 64);
        R.useLayoutEffect(() => {
          const el = ref.current;
          if (!el) return;
          const h = el.scrollHeight;      // real layout read
          if (h > 0) setPx((s) => s);
        });
        return R.createElement("div", { ref, style: { fontSize: px, ...(p.style||{}) } }, p.children);
      };
      const SocialIcons = () => R.createElement("div", null, "socials");
      const palette = { accent:"#E8481C", accentText:"#E8481C", bg:"#000", text:"#fff",
        panel:"#111", header:"#0a0a0a", border:"#222", muted:"#aaa", subtle:"#777", surface:"#111" };

      const names = ["React","useCurrentFrame","useVideoConfig","interpolate","spring","Easing",
        "AbsoluteFill","Sequence","Img","random","FitText","SocialIcons","readableOn",
        "ensureContrast","withAlpha","useKit","derivePalette","palette"];
      const vals  = [R, useCurrentFrame, useVideoConfig, interpolate, spring, Easing,
        AbsoluteFill, Sequence, Img, random, FitText, SocialIcons,
        (a)=>typeof a==="string"?a:"#fff", (a)=>typeof a==="string"?a:"#fff",
        (a)=>typeof a==="string"?a:"#fff",
        ()=>({palette, type:new Proxy({},{get:()=>48}), variant:"default"}),
        ()=>palette, palette];

      const C = new Function(...names, js + "\nreturn SceneComponent;")(...vals);
      const props = { displayText:"FireBird Technologies", narrationText:"vo",
        sceneTitle:"AI / ML ENGINEERING", aspectRatio:"landscape", sceneIndex:0, totalScenes:10,
        brandColors:{background:"#000000",text:"#FFFFFF",accent:"#E8481C",primary:"#E8481C"},
        headingFont:"Inter", bodyFont:"Inter", titleFontSize:96, descriptionFontSize:30,
        layoutProps:{}, logoUrl:"https://x.invalid/l.png", imageUrl:"https://x.invalid/i.jpg",
        metrics:[{value:"3.2M",label:"Active Users"},{value:"99.9%",label:"Uptime SLA"}],
        ctaProps:{ ctas:[{ctaButtonText:"Get started",websiteLink:"fb.dev"}], socials:[{platform:"x",handle:"@fb"}] } };

      const root = ReactDOM.createRoot(document.getElementById("root"));
      root.render(R.createElement(C, props));
    } catch (e) {
      out.error = e.message + "\n" + (e.stack||"").split("\n").slice(0,4).join("\n");
    }
    return out;
  }, sceneCode);

  await new Promise(r => setTimeout(r, 600));
  const dom = await page.evaluate(() => {
    const el = document.getElementById("root");
    return { html: el.innerHTML.length, text: (el.innerText||"").trim().slice(0,120) };
  });

  console.log("=== " + sceneFile.split("/").pop() + " ===");
  if (result.error) console.log("EVAL ERROR:", result.error);
  console.log("domLen:", dom.html, "| visibleText:", JSON.stringify(dom.text));
  if (logs.length) console.log("console:\n  " + logs.slice(0,8).join("\n  "));
  await browser.close();
})();
