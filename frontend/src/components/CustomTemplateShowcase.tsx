import { useState, useEffect, useRef, useCallback } from "react";
import type { CustomTemplateTheme } from "../api/client";
import CustomPreviewLandscape from "./templatePreviews/CustomPreviewLandscape";
import CustomPreviewPortrait from "./templatePreviews/portrait/CustomPreviewPortrait";

const BRAND_THEMES: { theme: CustomTemplateTheme; name: string; url: string }[] = [
  {
    name: "Vercel",
    url: "https://vercel.com",
    theme: {
      colors: { accent: "#000000", bg: "#FAFAFA", text: "#171717", surface: "#FFFFFF", muted: "#A1A1AA" },
      fonts: { heading: "Geist", body: "Geist", mono: "Geist Mono" },
      borderRadius: 8,
      style: "bold",
      animationPreset: "spring",
      category: "tech",
      patterns: {
        cards: { corners: "rounded", shadowDepth: "subtle", borderStyle: "thin" },
        spacing: { density: "comfortable", gridGap: 24 },
        images: { treatment: "rounded", overlay: "none", captionStyle: "below" },
        layout: { direction: "centered", decorativeElements: ["accent-lines"] },
      },
    },
  },
  {
    name: "Linear",
    url: "https://linear.app",
    theme: {
      colors: { accent: "#5E6AD2", bg: "#0A0B10", text: "#F1F0EE", surface: "#15161E", muted: "#7C7F8A" },
      fonts: { heading: "Inter", body: "Inter", mono: "JetBrains Mono" },
      borderRadius: 10,
      style: "glass",
      animationPreset: "spring",
      category: "saas",
      patterns: {
        cards: { corners: "rounded", shadowDepth: "medium", borderStyle: "accent" },
        spacing: { density: "compact", gridGap: 16 },
        images: { treatment: "rounded", overlay: "gradient", captionStyle: "below" },
        layout: { direction: "centered", decorativeElements: ["gradients"] },
      },
    },
  },
  {
    name: "Stripe",
    url: "https://stripe.com",
    theme: {
      colors: { accent: "#635BFF", bg: "#F6F9FC", text: "#0A2540", surface: "#FFFFFF", muted: "#8898AA" },
      fonts: { heading: "Sohne", body: "Sohne", mono: "Sohne Mono" },
      borderRadius: 12,
      style: "soft",
      animationPreset: "fade",
      category: "fintech",
      patterns: {
        cards: { corners: "rounded", shadowDepth: "medium", borderStyle: "thin" },
        spacing: { density: "spacious", gridGap: 24 },
        images: { treatment: "rounded", overlay: "gradient", captionStyle: "below" },
        layout: { direction: "centered", decorativeElements: ["gradients", "dots"] },
      },
    },
  },
];

const CYCLE_INTERVAL = 6000;
const TYPING_SPEED = 50;

// ─── Typing animation ──────────────────────────────────────────────
function useTypingAnimation(text: string, active: boolean, speed = TYPING_SPEED) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active) { setDisplayed(""); setDone(false); return; }
    let i = 0;
    setDisplayed("");
    setDone(false);
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { setDone(true); clearInterval(interval); }
    }, speed);
    return () => clearInterval(interval);
  }, [text, active, speed]);

  return { displayed, done };
}

// ─── Left column: 3-step flow ───────────────────────────────────────
function StepFlow({
  step,
  brand,
  onUrlDone,
}: {
  step: 1 | 2 | 3;
  brand: (typeof BRAND_THEMES)[0];
  onUrlDone: () => void;
}) {
  const { displayed, done: typingDone } = useTypingAnimation(brand.url, step === 1);
  const [extractReveal, setExtractReveal] = useState(-1);

  useEffect(() => {
    if (typingDone) {
      const t = setTimeout(onUrlDone, 500);
      return () => clearTimeout(t);
    }
  }, [typingDone, onUrlDone]);

  useEffect(() => {
    if (step !== 2) { setExtractReveal(-1); return; }
    let i = -1;
    const interval = setInterval(() => {
      i++;
      if (i > 6) { clearInterval(interval); return; }
      setExtractReveal(i);
    }, 160);
    return () => clearInterval(interval);
  }, [step]);

  const accent = brand.theme.colors.accent;
  const colors = [
    { label: "Accent", value: brand.theme.colors.accent },
    { label: "Bg", value: brand.theme.colors.bg },
    { label: "Text", value: brand.theme.colors.text },
    { label: "Surface", value: brand.theme.colors.surface },
    { label: "Muted", value: brand.theme.colors.muted },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Step 1 */}
      <div className={`transition-all duration-500 ${step === 1 ? "opacity-100" : step > 1 ? "opacity-50" : "opacity-40"}`}>
        <div className="flex items-center gap-3 mb-2.5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-500"
            style={{
              background: step > 1 ? "linear-gradient(135deg, #22c55e, #16a34a)" : step === 1 ? "linear-gradient(135deg, #a855f7, #6366f1)" : "#f3f4f6",
              color: step >= 1 ? "#fff" : "#9ca3af",
            }}
          >
            {step > 1 ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            ) : "1"}
          </div>
          <span className="text-sm font-semibold text-gray-800">Paste any website URL</span>
        </div>
        <div className="ml-10 rounded-lg border border-gray-200/80 bg-white/80 px-3.5 py-2.5 flex items-center gap-2 shadow-sm">
          <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span className="flex-1 text-xs text-gray-500 font-mono truncate">
            {step === 1 ? (
              <>
                {displayed}
                {!typingDone && <span className="inline-block w-[1.5px] h-3.5 bg-purple-500 align-middle ml-px" style={{ animation: "ctsBlink 0.7s step-end infinite" }} />}
              </>
            ) : brand.url}
          </span>
          <span
            className="text-[10px] font-semibold px-2.5 py-1 rounded-md flex-shrink-0 transition-all duration-300"
            style={{
              background: step >= 1 && (typingDone || step > 1) ? `linear-gradient(135deg, ${accent}, ${accent}cc)` : "#f3f4f6",
              color: step >= 1 && (typingDone || step > 1) ? "#fff" : "#9ca3af",
              boxShadow: step >= 1 && (typingDone || step > 1) ? `0 2px 8px ${accent}30` : "none",
            }}
          >
            Extract
          </span>
        </div>
      </div>

      {/* Step 2 */}
      <div className={`transition-all duration-500 ${step === 2 ? "opacity-100" : step > 2 ? "opacity-50" : "opacity-30"}`}>
        <div className="flex items-center gap-3 mb-2.5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-500"
            style={{
              background: step > 2 ? "linear-gradient(135deg, #22c55e, #16a34a)" : step === 2 ? "linear-gradient(135deg, #a855f7, #6366f1)" : "#f3f4f6",
              color: step >= 2 ? "#fff" : "#9ca3af",
            }}
          >
            {step > 2 ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            ) : "2"}
          </div>
          <span className="text-sm font-semibold text-gray-800">We extract your brand</span>
        </div>
        <div className="ml-10 rounded-lg border border-gray-200/80 bg-white/80 p-3.5 shadow-sm">
          <div
            className="mb-2 transition-all duration-300"
            style={{ opacity: step >= 2 && extractReveal >= 0 ? 1 : 0, transform: step >= 2 && extractReveal >= 0 ? "none" : "translateY(4px)" }}
          >
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Brand</span>
            <div className="text-sm font-bold text-gray-800">{brand.name}</div>
          </div>
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            {colors.map((c, i) => (
              <div
                key={c.label}
                className="transition-all duration-300"
                style={{
                  opacity: step >= 2 && extractReveal >= i + 1 ? 1 : 0,
                  transform: step >= 2 && extractReveal >= i + 1 ? "scale(1)" : "scale(0)",
                }}
              >
                <div
                  className="w-6 h-6 rounded-md border border-gray-200"
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              </div>
            ))}
          </div>
          <div
            className="flex flex-wrap gap-1 transition-all duration-300"
            style={{ opacity: step >= 2 && extractReveal >= 6 ? 1 : 0, transform: step >= 2 && extractReveal >= 6 ? "none" : "translateY(4px)" }}
          >
            <span className="px-2 py-0.5 rounded text-[9px] font-semibold" style={{ background: `${accent}15`, color: accent }}>{brand.theme.fonts.heading}</span>
            <span className="px-2 py-0.5 rounded text-[9px] font-medium bg-gray-100 text-gray-500">{brand.theme.style}</span>
            <span className="px-2 py-0.5 rounded text-[9px] font-medium bg-gray-100 text-gray-500">{brand.theme.animationPreset}</span>
          </div>
        </div>
      </div>

      {/* Step 3 */}
      <div className={`transition-all duration-500 ${step === 3 ? "opacity-100" : "opacity-30"}`}>
        <div className="flex items-center gap-3 mb-2.5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-500"
            style={{
              background: step === 3 ? "linear-gradient(135deg, #a855f7, #6366f1)" : "#f3f4f6",
              color: step === 3 ? "#fff" : "#9ca3af",
            }}
          >
            3
          </div>
          <span className="text-sm font-semibold text-gray-800">AI generates your scenes</span>
        </div>
        {step === 3 && (
          <div className="ml-10 flex items-center gap-2 text-xs text-purple-600 font-medium animate-pulse">
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Generating scenes...
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Brand selector pills ───────────────────────────────────────────
function BrandSelector({
  themes,
  current,
  onSelect,
}: {
  themes: typeof BRAND_THEMES;
  current: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      {themes.map((t, i) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-300 ${
            i === current
              ? "bg-gray-100 text-gray-700 shadow-sm border border-gray-200/80"
              : "text-gray-400 hover:text-gray-600 border border-transparent"
          }`}
        >
          <div
            className="w-2.5 h-2.5 rounded-full transition-all duration-300 group-hover:scale-110"
            style={{ backgroundColor: t.theme.colors.accent }}
          />
          {t.name}
        </button>
      ))}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────
export default function CustomTemplateShowcase() {
  const [brandIdx, setBrandIdx] = useState(0);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fading, setFading] = useState(false);
  const cycleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const brand = BRAND_THEMES[brandIdx];

  useEffect(() => {
    if (step !== 3) return;
    cycleRef.current = setTimeout(() => {
      setFading(true);
      setTimeout(() => {
        setBrandIdx((prev) => (prev + 1) % BRAND_THEMES.length);
        setStep(1);
        setFading(false);
      }, 350);
    }, CYCLE_INTERVAL);
    return () => { if (cycleRef.current) clearTimeout(cycleRef.current); };
  }, [step]);

  useEffect(() => {
    if (step === 2) {
      const t = setTimeout(() => setStep(3), 1800);
      return () => clearTimeout(t);
    }
  }, [step]);

  const handleBrandSelect = useCallback((i: number) => {
    if (cycleRef.current) clearTimeout(cycleRef.current);
    setFading(true);
    setTimeout(() => { setBrandIdx(i); setStep(1); setFading(false); }, 250);
  }, []);

  const advanceToStep2 = useCallback(() => setStep(2), []);

  return (
    <div className="reveal">
      {/* Section header — matches other landing sections */}
      <div className="inline-flex items-center gap-2 mb-4 w-full justify-center">
        <p className="text-xs font-medium text-purple-600 tracking-widest uppercase">
          Custom Templates
        </p>
        <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-600 rounded-full">
          Pro
        </span>
      </div>
      <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 text-center mb-4">
        Your brand, pixel-perfect
      </h2>
      <p className="text-sm text-gray-500 text-center max-w-lg mx-auto mb-8 leading-relaxed">
        Drop a URL. We extract every color, font, and style choice — then generate
        video scenes that look like your design team made them.
      </p>

      {/* Main showcase card */}
      <div className="glass-card p-6 sm:p-8 rounded-xl hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all max-w-5xl mx-auto">
        <div
          className="transition-opacity duration-300"
          style={{ opacity: fading ? 0 : 1 }}
        >
          {/* Two-column: steps left, preview right */}
          <div className="grid md:grid-cols-[0.85fr_1.15fr] gap-6 lg:gap-10 items-start">
            {/* Left: step flow */}
            <div className="order-2 md:order-1 pt-1">
              <StepFlow step={step} brand={brand} onUrlDone={advanceToStep2} />
            </div>

            {/* Right: live preview */}
            <div className="order-1 md:order-2">
              <div className="grid grid-cols-[1fr_auto] gap-3 items-start">
                {/* Landscape */}
                <div className="rounded-xl overflow-hidden border border-gray-200/60 bg-white shadow-sm">
                  <div className="relative w-full aspect-video overflow-hidden">
                    <CustomPreviewLandscape theme={brand.theme} name={brand.name} />
                  </div>
                </div>
                {/* Portrait — smaller, tucked to the right */}
                <div className="hidden sm:block rounded-xl overflow-hidden border border-gray-200/60 shadow-sm" style={{ width: 100 }}>
                  <div style={{ aspectRatio: "9/16" }}>
                    <CustomPreviewPortrait theme={brand.theme} name={brand.name} />
                  </div>
                </div>
              </div>
              {/* Live label */}
              <div className="flex items-center justify-center gap-4 mt-3">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium">Live preview</span>
                </div>
                <span className="text-[10px] text-gray-300">|</span>
                <span className="text-[10px] font-semibold transition-colors duration-500" style={{ color: brand.theme.colors.accent }}>
                  {brand.name}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Brand selector */}
      <BrandSelector themes={BRAND_THEMES} current={brandIdx} onSelect={handleBrandSelect} />

      <style>{`
        @keyframes ctsBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
