import { useState, useEffect, useRef, useCallback } from "react";
import type { CustomTemplateTheme } from "../api/client";
import { getFeaturedPublicTemplates } from "../api/client";
import CustomPreview from "./templatePreviews/CustomPreview";

interface FeaturedTemplate {
  id: number;
  name: string;
  theme: CustomTemplateTheme;
  intro_code: string | null;
  content_codes: string[] | null;
  outro_code: string | null;
  content_archetype_ids: any;
  preview_image_url: string;
  logo_urls: string[];
  og_image: string;
}

const SHOWCASE_IDS = [44, 38, 46, 13];

// URL to show in the typing animation per template ID
const TEMPLATE_URLS: Record<number, string> = {
  44: "https://anthropic.com",
  38: "https://stripe.com",
  46: "https://mckinsey.com",
  13: "http://firebird-technologies.com",
};

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
  brand: { theme: CustomTemplateTheme; name: string; url: string };
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

// ─── Template selector pills ────────────────────────────────────────
function TemplateSelector({
  templates,
  current,
  onSelect,
}: {
  templates: FeaturedTemplate[];
  current: number;
  onSelect: (i: number) => void;
}) {
  if (templates.length === 0) return null;
  return (
    <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
      {templates.map((t, i) => (
        <button
          key={t.id}
          onClick={() => onSelect(i)}
          className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-300 ${
            i === current
              ? "bg-gray-100 text-gray-700 shadow-sm border border-gray-200/80"
              : "text-gray-400 hover:text-gray-600 border border-transparent"
          }`}
        >
          <div
            className="w-2.5 h-2.5 rounded-full transition-all duration-300 group-hover:scale-110"
            style={{ backgroundColor: t.theme?.colors?.accent ?? "#a855f7" }}
          />
          {t.name}
        </button>
      ))}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────
export default function CustomTemplateShowcase() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const cycleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [templates, setTemplates] = useState<FeaturedTemplate[]>([]);
  const [templateIdx, setTemplateIdx] = useState(0);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch the 4 showcase templates on mount
  useEffect(() => {
    getFeaturedPublicTemplates(SHOWCASE_IDS)
      .then((res) => setTemplates(res.data || []))
      .catch((err) => console.error("[F7-DEBUG] CustomTemplateShowcase: failed to fetch templates:", err));
  }, []);

  const currentTemplate = templates[templateIdx];

  // Derive brand for left-side StepFlow from the current template
  const brand = currentTemplate
    ? {
        name: currentTemplate.name,
        url: TEMPLATE_URLS[currentTemplate.id] ?? `https://${currentTemplate.name.toLowerCase().replace(/\s+/g, "")}.com`,
        theme: currentTemplate.theme,
      }
    : null;

  // When templateIdx changes, reset left-side step animation to 1
  useEffect(() => {
    setStep(1);
  }, [templateIdx]);

  // Fallback timer for single-scene templates (which loop and never fire onAllScenesEnded).
  // Only starts if the current template has 0 or 1 scene codes total.
  useEffect(() => {
    if (!currentTemplate || templates.length === 0) return;
    const sceneCount =
      (currentTemplate.intro_code ? 1 : 0) +
      (currentTemplate.content_codes?.length ?? 0) +
      (currentTemplate.outro_code ? 1 : 0);
    if (sceneCount > 1) return; // multi-scene: onAllScenesEnded handles it
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = setTimeout(() => {
      setTemplateIdx((prev) => (prev + 1) % templates.length);
    }, 10000);
    return () => { if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current); };
  }, [templateIdx, templates.length, currentTemplate]);

  const handleAllScenesEnded = useCallback(() => {
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    setTemplateIdx((prev) => (prev + 1) % templates.length);
  }, [templates.length]);

  // Left side: step 3 → loop back to step 1 after CYCLE_INTERVAL (stays in sync with current template)
  useEffect(() => {
    if (step !== 3) return;
    cycleRef.current = setTimeout(() => {
      setStep(1);
    }, CYCLE_INTERVAL);
    return () => { if (cycleRef.current) clearTimeout(cycleRef.current); };
  }, [step]);

  useEffect(() => {
    if (step === 2) {
      const t = setTimeout(() => setStep(3), 1800);
      return () => clearTimeout(t);
    }
  }, [step]);

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
        <div>
          {/* Two-column: steps left, preview right */}
          <div className="grid md:grid-cols-[0.85fr_1.15fr] gap-6 lg:gap-10 items-start">
            {/* Left: step flow */}
            <div className="order-2 md:order-1 pt-1">
              {brand && <StepFlow step={step} brand={brand} onUrlDone={advanceToStep2} />}
            </div>

            {/* Right: real template preview */}
            <div className="order-1 md:order-2">
              <div className="rounded-xl overflow-hidden border border-gray-200/60 bg-white shadow-sm">
                <div className="relative w-full aspect-video overflow-hidden">
                  {currentTemplate ? (
                    <CustomPreview
                      key={templateIdx}
                      theme={currentTemplate.theme}
                      name={currentTemplate.name}
                      introCode={currentTemplate.intro_code || undefined}
                      outroCode={currentTemplate.outro_code || undefined}
                      contentCodes={currentTemplate.content_codes || undefined}
                      contentArchetypeIds={currentTemplate.content_archetype_ids || undefined}
                      previewImageUrl={currentTemplate.preview_image_url}
                      logoUrls={currentTemplate.logo_urls}
                      ogImage={currentTemplate.og_image}
                      onAllScenesEnded={handleAllScenesEnded}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-50">
                      <div className="w-7 h-7 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin" />
                    </div>
                  )}
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
                <span className="text-[10px] font-semibold transition-colors duration-500" style={{ color: currentTemplate?.theme?.colors?.accent ?? "#a855f7" }}>
                  {currentTemplate?.name ?? ""}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Template selector pills (right side) + Brand selector (left side) */}
      <TemplateSelector templates={templates} current={templateIdx} onSelect={setTemplateIdx} />

      <style>{`
        @keyframes ctsBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
