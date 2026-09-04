// Level-2 check: does a generated scene component actually RUN?
//
// `_parse_check` proves the code parses; nothing proved it executes. Template
// 179 shipped a `steps` scene with 7,782 characters of valid, parsing,
// fully-validated code that rendered a BLANK FRAME — it evaluated without
// throwing but returned an empty tree, because it read props.bullets on a
// scene the render path fills via props.steps. No static check can see that.
//
// This harness compiles the snippet the same way the preview does (Babel, react
// preset), injects the same free variables (KIT_EXPORT_NAMES + the Remotion
// APIs), calls the component, and reports whether anything was actually drawn.
//
// Usage: node scene_runtime_harness.mjs <payload.json>
//   payload: { code, props, kitNames, babelPath }
// Prints one line of JSON: { ok, error, nodes, empty }

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const payload = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));

function out(obj) {
  process.stdout.write(JSON.stringify(obj));
  process.exit(0);
}

let babel;
try {
  babel = await import(pathToFileURL(payload.babelPath).href);
  babel = babel.default ?? babel;
} catch (e) {
  // Fail OPEN: a missing toolchain must never block generation. Same convention
  // as _parse_check and validate_wrapped_component_code.
  out({ ok: true, skipped: `babel unavailable: ${e.message}` });
}

// Strip imports/exports exactly as compileComponent.ts does before wrapping.
const raw = String(payload.code || "")
  .replace(/^\s*import[^\n]*\n/gm, "")
  .replace(/^\s*export\s+default\s+/gm, "")
  .replace(/^\s*export\s+/gm, "");

let compiled;
try {
  compiled = babel.transform(raw, { presets: ["react"] }).code;
} catch (e) {
  out({ ok: false, error: `Babel: ${e.message}` });
}

// ── The injected runtime ────────────────────────────────────────────────────
// Counting is the point: we need to know whether the component produced any
// real element, so createElement records every node it builds.
let nodeCount = 0;
let textCount = 0;

// A CSS property name is a JS identifier (camelCase) or a custom property
// (--foo). Anything else — a bare number, an empty key — is a typo that the
// browser rejects at style-application time.
const VALID_STYLE_KEY = /^(--[\w-]+|[A-Za-z][A-Za-z0-9]*)$/;

const assertValidStyle = (style) => {
  if (!style || typeof style !== "object" || Array.isArray(style)) return;
  for (const key of Object.keys(style)) {
    if (VALID_STYLE_KEY.test(key)) continue;
    throw new TypeError(
      `style={{ ${JSON.stringify(key)}: … }} is not a CSS property. The browser ` +
        `refuses to set a property with this name and the render throws inside ` +
        `the element, blanking the scene. It is almost always a stray token left ` +
        `in the style object — delete it. Every style key must be camelCase ` +
        `(backgroundColor, marginTop) or a --custom-property.`,
    );
  }
};

// Depth guard: a scene that renders itself (directly or through a helper)
// would otherwise recurse until the stack blows, turning a real defect into an
// unreadable RangeError. 64 is far deeper than any legitimate scene tree.
let renderDepth = 0;
const MAX_RENDER_DEPTH = 64;

const React = {
  createElement: (type, props, ...children) => {
    nodeCount += 1;
    const flat = children.flat(Infinity);
    for (const c of flat) {
      if (typeof c === "string" ? c.trim() : typeof c === "number") textCount += 1;
    }
    // A style key must be a real CSS property name. React's server renderer
    // happily emits `{ 1: 1 }` as "1:1px", but the BROWSER refuses to set a
    // property named "1" and the render throws inside the <div> — which is why
    // the error boundary blames an anonymous div rather than the scene.
    //
    // Template 192's metrics_ledger shipped exactly `style={{ 1: 1, position:
    // 'absolute', ... }}` in its PORTRAIT branch: a stray token left in an
    // object literal. It crashed only in portrait, and this harness passed it in
    // both orientations, because nothing ever inspected the style keys.
    assertValidStyle(props && props.style);
    // A FUNCTION type is a sub-component the scene defined itself — call it.
    //
    // This used to build the element object and stop, so a helper's body was
    // never executed and the harness was structurally blind to every defect
    // inside one. Template 191 shipped a `BulletRow` helper reading the outer
    // `props` (which does not exist in its scope): it threw "props is not
    // defined" on the first frame in the browser, while this gate — the one
    // level that RUNS the component — reported it clean, because the helper
    // was only ever constructed, never called.
    //
    // React itself renders these children, so calling them here is what makes
    // "it ran" mean the same thing in both places.
    if (typeof type === "function" && renderDepth < MAX_RENDER_DEPTH) {
      renderDepth += 1;
      try {
        type({ ...props, children: flat });
      } finally {
        renderDepth -= 1;
      }
    }
    return { $$typeof: Symbol.for("react.element"), type, props: { ...props, children: flat } };
  },
  Fragment: Symbol.for("react.fragment"),
  useState: (v) => [typeof v === "function" ? v() : v, () => {}],
  useMemo: (f) => f(),
  useCallback: (f) => f,
  useRef: () => ({ current: null }),
  useEffect: () => {},
  useLayoutEffect: () => {},
  useContext: () => ({}),
};

const useCurrentFrame = () => Number(payload.frame ?? 30);
const useVideoConfig = () => ({
  fps: 30,
  width: payload.props?.aspectRatio === "portrait" ? 1080 : 1920,
  height: payload.props?.aspectRatio === "portrait" ? 1920 : 1080,
  durationInFrames: 150,
});
const interpolate = (input, inputRange, outputRange, options) => {
  // Mirror Remotion's hard failure: a non-finite progress value is a real crash
  // in production ("Cannot interpolate an input which is not a number"), and it
  // is one of the defects this level exists to surface.
  if (typeof input !== "number" || !Number.isFinite(input)) {
    throw new TypeError(
      `interpolate() got a non-numeric first argument (${JSON.stringify(input)}) — ` +
        `this crashes at runtime.`,
    );
  }
  // The 4th argument used to be omitted from this signature entirely, which
  // made the harness structurally blind to a whole class of crash: a scene
  // writing `easing: Easing.inOutCubic` (no such member — see the Easing proxy
  // below) passes `undefined`, and Remotion CALLS it. That throws "easing is
  // not a function" during render, which freezes the entire preview page, and
  // this level — the one gate that actually runs the component — never saw it
  // because the options object was never even received.
  if (options && typeof options === "object" && "easing" in options) {
    if (typeof options.easing !== "function") {
      throw new TypeError(
        `interpolate() was given an easing that is not a function ` +
          `(${String(options.easing)}). Remotion calls it, so this throws ` +
          `"easing is not a function" during render and blanks the scene.`,
      );
    }
  }
  return Array.isArray(outputRange) ? outputRange[0] : 0;
};
// Remotion's spring() validates its arguments and THROWS on a bad `fps` —
// `"fps" must be a number, but you passed a value of type undefined`. The stub
// used to be `() => 1`, ignoring its argument entirely, so a scene calling
// `spring({ frame, fps })` without ever destructuring `fps` from
// useVideoConfig() sailed through this gate and then crashed the preview on
// first paint. Validate the same fields Remotion validates, for the same
// reason the interpolate/Easing stubs above do: this is the one gate that
// runs the component, so a permissive stub here is a blind spot, not a
// convenience.
const spring = (opts) => {
  if (!opts || typeof opts !== "object") {
    throw new TypeError(
      `spring() was called with no options object. It requires at least ` +
        `{ frame, fps } — Remotion throws otherwise.`,
    );
  }
  for (const key of ["fps", "frame"]) {
    const v = opts[key];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      throw new TypeError(
        `spring() got "${key}" of type ${typeof v} (${JSON.stringify(v)}), but it ` +
          `must be a finite number. Remotion validates this and throws ` +
          `'"${key}" must be a number', which crashes the scene on its first ` +
          `frame. Destructure it from the hook: ` +
          `\`const { fps } = useVideoConfig();\` and \`const frame = useCurrentFrame();\`.`,
      );
    }
  }
  return 1;
};
const random = () => 0.5;

// Remotion's REAL Easing surface, read off the live module. There are no flat
// combined members: `inOutCubic`, `easeInOut`, `inOutQuad` and friends do not
// exist and must be composed — `Easing.inOut(Easing.cubic)`.
const EASING_MEMBERS = {
  bezier: () => (t) => t, linear: (t) => t, ease: (t) => t,
  in: (f) => f, out: (f) => f, inOut: (f) => f,
  quad: (t) => t, cubic: (t) => t, sin: (t) => t, circle: (t) => t,
  exp: (t) => t, back: () => (t) => t, bounce: (t) => t, elastic: () => (t) => t,
  poly: () => (t) => t, step0: (t) => t, step1: (t) => t,
};

// A Proxy, not a plain object, so an INVENTED member fails loudly at the point
// of use instead of silently reading `undefined` and deferring the crash to
// whoever calls it. The previous object literal also carried a `quint` member
// Remotion does not have, so the harness actively vouched for a name that
// crashes in production.
const Easing = new Proxy(EASING_MEMBERS, {
  get(target, prop) {
    if (typeof prop === "string" && !(prop in target)) {
      throw new TypeError(
        `Easing.${prop} does not exist in Remotion — it reads as undefined and is ` +
          `then called, throwing "easing is not a function" at render. Compose it ` +
          `instead, e.g. Easing.inOut(Easing.cubic).`,
      );
    }
    return target[prop];
  },
});

// Host components render as plain tags; kit values are permissive stubs so an
// unexpected shape never masks the defect we are looking for.
const hostNames = ["AbsoluteFill", "Sequence", "Img", "Video", "OffthreadVideo", "Audio", "Series"];
const kitStub = (name) => {
  const C = (props) => React.createElement(name, props, ...(props?.children ?? []));
  C.displayName = name;
  return C;
};

// A REAL palette shape (kit/theme.ts KitPalette). Stubbing this as `{}` made
// every scene doing `color: palette.text` throw "Cannot read properties of
// undefined" — 15 false failures across healthy templates. A stub that is the
// wrong SHAPE reports bugs that do not exist, which is worse than no check.
const paletteStub = {
  accent: "#76B900", accentText: "#76B900",
  bg: "#0B0B0B", bg2: undefined, text: "#FFFFFF",
  panel: "#161616", header: "#111111", border: "#2A2A2A",
  muted: "#B0B0B0", subtle: "#7A7A7A", surface: "#161616",
};

// Any type-scale slot read returns a usable number rather than undefined.
const typeStub = new Proxy({}, { get: () => 48 });

const injectedNames = [];
const injectedValues = [];
const push = (name, value) => { injectedNames.push(name); injectedValues.push(value); };

push("React", React);
push("useCurrentFrame", useCurrentFrame);
push("useVideoConfig", useVideoConfig);
push("interpolate", interpolate);
push("spring", spring);
push("random", random);
push("Easing", Easing);
for (const h of hostNames) push(h, h);

for (const name of payload.kitNames ?? []) {
  if (injectedNames.includes(name)) continue;
  // Helpers must return usable VALUES, not components — a scene doing
  // `color: readableOn(bg)` needs a string back or it silently styles with an
  // object and the defect hides.
  if (/^(readableOn|ensureContrast|withAlpha|clampGradientStop)$/.test(name)) {
    push(name, (a) => (typeof a === "string" ? a : "#ffffff"));
  } else if (name === "derivePalette") {
    push(name, () => paletteStub);
  } else if (name === "useKit") {
    // `const palette = useKit().palette` is the shipped idiom — the hook
    // returns a CONTEXT object, not the palette itself.
    push(name, () => ({ palette: paletteStub, type: typeStub, variant: "default" }));
  } else if (name === "palette") {
    push(name, paletteStub);
  } else if (/^(backgroundCss|cardStyle)$/.test(name)) {
    push(name, () => "#0B0B0B");
  } else if (/^typeScale$/.test(name)) {
    // Numeric-ish bag: any slot read returns a usable size rather than undefined.
    push(name, new Proxy({}, { get: () => 48 }));
  } else if (/^[a-z]/.test(name)) {
    // Unknown lowercase helper: return a permissive object whose every property
    // read yields a string, so `helper(x).y` cannot throw on shape alone.
    push(name, () => new Proxy({}, { get: () => "#FFFFFF" }));
  } else if (name === name.toUpperCase()) {
    push(name, 4.5);
  } else {
    push(name, kitStub(name));
  }
}

let Component;
try {
  const factory = new Function(...injectedNames, `${compiled}\nreturn SceneComponent;`);
  Component = factory(...injectedValues);
} catch (e) {
  out({ ok: false, error: `Module evaluation: ${e.message}` });
}

if (typeof Component !== "function") {
  out({ ok: false, error: "No SceneComponent function was produced by the module." });
}

// ── Geometry pass ───────────────────────────────────────────────────────────
//
// Everything above proves the scene RUNS. It does not prove the result FITS,
// and "text still overflows sometimes" is the standing report. There is no DOM
// here (React is the stub above), so this cannot do real layout — but it does
// not need to for the defects that actually ship. Those are all STATIC: a
// number written into the style object that is already wrong before any layout
// engine sees it.
//
// Deliberately narrow. Every rule below fires only on explicit, absolute
// numbers the scene itself wrote, never on anything inferred from flow layout —
// a false positive here sends a healthy scene into a repair loop that can only
// make it worse, which is a costlier failure than the miss.
const CANVAS_W = useVideoConfig().width;
const CANVAS_H = useVideoConfig().height;

const px = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Walk the element tree, collecting geometry complaints. */
function inspectGeometry(node, depth, inFitText) {
  if (!node || typeof node !== "object" || depth > MAX_RENDER_DEPTH) return [];
  if (Array.isArray(node)) return node.flatMap((c) => inspectGeometry(c, depth + 1, inFitText));

  const found = [];
  const props = node.props || {};
  const style = props.style && typeof props.style === "object" ? props.style : {};
  const name = typeof node.type === "string" ? node.type : node.type?.displayName || "";
  const fitted = inFitText || name === "FitText" || name === "FitBlock";

  // 1. An ABSOLUTE box positioned off the canvas. Only when both the offset and
  //    the size are literal numbers — a percentage or an auto is flow layout and
  //    is none of this pass's business.
  const left = px(style.left);
  const top = px(style.top);
  const w = px(style.width);
  const h = px(style.height);
  // A `transform` MOVES the box, and this pass cannot evaluate one — a matrix,
  // a percentage translate or a scale all change where the element actually
  // lands. The canonical centring idiom is `left:'50%'` + `translateX(-50%)`,
  // and a right-anchored panel is `left:1400` + `translateX(-100%)`, which
  // truly ends at 1400px. Reading left+width alone reported that as "runs to
  // 2164px, past the 1920px frame edge" — a false positive on correct code,
  // and a real one seen in production.
  //
  // Skipping is the right call and this file's own header says why: a false
  // positive sends a healthy scene into a repair loop that can only make it
  // worse, which is a costlier failure than the miss.
  const moved = typeof style.transform === "string" && style.transform.trim() !== "";
  if (style.position === "absolute" && !moved) {
    if (left !== null && w !== null && left + w > CANVAS_W + 1) {
      found.push(
        `an absolutely-positioned box runs to ${Math.round(left + w)}px, past the ` +
          `${CANVAS_W}px frame edge (left:${left} + width:${w})`,
      );
    }
    if (top !== null && h !== null && top + h > CANVAS_H + 1) {
      found.push(
        `an absolutely-positioned box runs to ${Math.round(top + h)}px, past the ` +
          `${CANVAS_H}px frame bottom (top:${top} + height:${h})`,
      );
    }
  }

  // 2. A fixed-size box that cannot hold the text it was given at the fontSize
  //    it declares — the "breaks mid-word" defect. Only outside a FitText,
  //    because inside one the whole point is that the size is negotiable.
  //
  //    0.5em per character is a deliberately FORGIVING average advance width
  //    (a real sans sits nearer 0.5-0.55 for mixed case); at 0.5 this only
  //    fires when the copy overruns its box by a wide margin, which is the
  //    only case worth repairing automatically.
  if (!fitted) {
    const fs = px(style.fontSize);
    const boxW = w !== null ? w : px(style.maxWidth);
    if (fs !== null && boxW !== null && style.whiteSpace === "nowrap") {
      const text = (props.children ?? [])
        .flat(Infinity)
        .filter((c) => typeof c === "string")
        .join(" ");
      if (text && text.length * fs * 0.5 > boxW * 1.15) {
        found.push(
          `a nowrap text box is ${boxW}px wide but holds ~${text.length} characters at ` +
            `${fs}px, which needs roughly ${Math.round(text.length * fs * 0.5)}px — the ` +
            `text is clipped or breaks mid-word`,
        );
      }
    }
  }

  const kids = props.children ?? [];
  return found.concat(
    (Array.isArray(kids) ? kids : [kids]).flatMap((c) => inspectGeometry(c, depth + 1, fitted)),
  );
}

try {
  const tree = Component(payload.props ?? {});
  if (tree === null || tree === undefined || tree === false) {
    out({ ok: false, error: "Component returned nothing (null/undefined).", nodes: 0, empty: true });
  }
  let geometry = [];
  try {
    // Never let a defect in this pass fail a scene: it is the newest and least
    // proven check here, and it is advisory. Same fail-open rule as everything
    // else in this file.
    geometry = inspectGeometry(tree, 0, false).slice(0, 4);
  } catch {
    geometry = [];
  }
  out({ ok: true, nodes: nodeCount, text: textCount, empty: nodeCount === 0, geometry });
} catch (e) {
  out({ ok: false, error: `Render: ${e.message}` });
}
