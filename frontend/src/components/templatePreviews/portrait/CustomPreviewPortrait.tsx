import { useState, useEffect, useRef } from "react";
import type { CustomTemplateTheme } from "../../../api/client";

// ─── Portrait scale wrapper (9:16)
const INTERNAL_W = 270;
const INTERNAL_H = 480;

function ScaledCanvas({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.getBoundingClientRect().width / INTERNAL_W);
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ width: "100%", aspectRatio: `${INTERNAL_W}/${INTERNAL_H}`, overflow: "hidden", position: "relative" }}>
      <div style={{ width: INTERNAL_W, height: INTERNAL_H, transform: `scale(${scale})`, transformOrigin: "top left", position: "absolute" }}>
        {children}
      </div>
    </div>
  );
}

// ─── Style helpers (same as landscape)
function getStyleBg(theme: CustomTemplateTheme): React.CSSProperties {
  const s = theme.style;
  if (s === "glass") return { background: `linear-gradient(135deg, ${theme.colors.bg}ee, ${theme.colors.surface}cc)`, backdropFilter: "blur(20px)" };
  if (s === "neon") return { background: theme.colors.bg, boxShadow: `inset 0 0 60px ${theme.colors.accent}15` };
  if (s === "bold") return { background: theme.colors.bg };
  if (s === "soft") return { background: `linear-gradient(180deg, ${theme.colors.bg}, ${theme.colors.surface})` };
  return { background: theme.colors.bg };
}

function getCardStyle(theme: CustomTemplateTheme): React.CSSProperties {
  const corners = theme.patterns?.cards?.corners;
  const shadow = theme.patterns?.cards?.shadowDepth;
  const border = theme.patterns?.cards?.borderStyle;
  return {
    borderRadius: corners === "sharp" ? 4 : corners === "pill" ? 20 : theme.borderRadius,
    backgroundColor: theme.colors.surface,
    border: border === "accent" ? `2px solid ${theme.colors.accent}`
      : border === "gradient" ? `2px solid ${theme.colors.accent}60`
      : theme.style === "neon" ? `1px solid ${theme.colors.accent}30` : `1px solid ${theme.colors.text}08`,
    boxShadow: shadow === "heavy" ? `0 4px 16px ${theme.colors.muted}33`
      : shadow === "medium" ? `0 2px 8px ${theme.colors.muted}22`
      : shadow === "subtle" ? `0 1px 4px ${theme.colors.muted}15`
      : theme.style === "neon" ? `0 0 8px ${theme.colors.accent}15` : "none",
  };
}

function getDecorations(theme: CustomTemplateTheme): React.ReactNode {
  const elems = theme.patterns?.layout?.decorativeElements || ["none"];
  const nodes: React.ReactNode[] = [];
  if (elems.includes("gradients")) {
    nodes.push(<div key="grad" style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: `radial-gradient(circle, ${theme.colors.accent}20, transparent 70%)` }} />);
  }
  if (elems.includes("accent-lines")) {
    nodes.push(<div key="line" style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", backgroundColor: theme.colors.accent }} />);
  }
  if (elems.includes("dots")) {
    nodes.push(<div key="dots" style={{ position: "absolute", bottom: 10, right: 10, width: 60, height: 60, opacity: 0.1, backgroundImage: `radial-gradient(${theme.colors.accent} 1.5px, transparent 1.5px)`, backgroundSize: "8px 8px" }} />);
  }
  if (nodes.length === 0) {
    nodes.push(<div key="circle" style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", border: `2px solid ${theme.colors.accent}20` }} />);
  }
  return <>{nodes}</>;
}

// ─── Slide 1: Hero
function SlideHero({ active, theme, name }: { active: boolean; theme: CustomTemplateTheme; name?: string }) {
  const [titleVis, setTitleVis] = useState(false);
  const [barW, setBarW] = useState(0);
  const [subVis, setSubVis] = useState(false);

  useEffect(() => {
    if (!active) { setTitleVis(false); setBarW(0); setSubVis(false); return; }
    const t1 = setTimeout(() => setBarW(80), 100);
    const t2 = setTimeout(() => setTitleVis(true), 300);
    const t3 = setTimeout(() => setSubVis(true), 600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [active]);

  const br = theme.borderRadius;

  return (
    <div style={{
      width: "100%", height: "100%", position: "relative", overflow: "hidden",
      display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
      padding: "0 28px", textAlign: "center",
      ...getStyleBg(theme),
    }}>
      {getDecorations(theme)}

      <div style={{
        width: barW, height: 3, backgroundColor: theme.colors.accent, borderRadius: 2, marginBottom: 18, alignSelf: "center",
        transition: "width 0.5s cubic-bezier(0.16,1,0.3,1)",
      }} />

      <div style={{
        fontSize: 32, fontWeight: 800, color: theme.colors.text, lineHeight: 1.2,
        fontFamily: `${theme.fonts.heading}, system-ui, sans-serif`,
        opacity: titleVis ? 1 : 0, transform: titleVis ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
        letterSpacing: theme.style === "bold" ? "-0.04em" : "-0.02em",
      }}>
        {name || "Custom Template"}
      </div>

      <div style={{
        fontSize: 13, color: theme.colors.muted, marginTop: 10,
        fontFamily: `${theme.fonts.body}, system-ui, sans-serif`, fontWeight: 400,
        opacity: subVis ? 1 : 0, transform: subVis ? "translateY(0)" : "translateY(10px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
        display: "flex", alignItems: "center", gap: 6, justifyContent: "center",
      }}>
        <span style={{
          display: "inline-block", padding: "2px 8px", borderRadius: br / 2,
          backgroundColor: `${theme.colors.accent}18`, color: theme.colors.accent,
          fontSize: 11, fontWeight: 600, textTransform: "capitalize",
        }}>
          {theme.style}
        </span>
        <span>{theme.category || "custom"} template</span>
      </div>

      <div style={{
        display: "flex", gap: 6, marginTop: 18, opacity: subVis ? 1 : 0,
        transition: "opacity 0.5s ease 0.2s", alignItems: "center", justifyContent: "center", flexWrap: "wrap",
      }}>
        {[theme.colors.accent, theme.colors.bg, theme.colors.text, theme.colors.surface, theme.colors.muted].map((c, i) => (
          <div key={i} style={{
            width: 16, height: 16, borderRadius: "50%",
            backgroundColor: c, border: `1.5px solid ${theme.colors.text}15`,
          }} />
        ))}
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 3, backgroundColor: theme.colors.accent }} />
    </div>
  );
}

// ─── Slide 2: Content — stacked cards for portrait
function SlideContent({ active, theme, name }: { active: boolean; theme: CustomTemplateTheme; name?: string }) {
  const [visible, setVisible] = useState<number[]>([]);
  const [titleVis, setTitleVis] = useState(false);

  const items = [
    "AI-powered script generation",
    "Automatic scene detection",
    "Professional narration voices",
  ];

  useEffect(() => {
    if (!active) { setVisible([]); setTitleVis(false); return; }
    const t0 = setTimeout(() => setTitleVis(true), 100);
    const timers = items.map((_, i) =>
      setTimeout(() => setVisible((v) => [...v, i]), 260 + i * 160)
    );
    return () => { clearTimeout(t0); timers.forEach(clearTimeout); };
  }, [active]);

  const density = theme.patterns?.spacing?.density || "balanced";
  const gap = density === "compact" ? 8 : density === "spacious" ? 16 : 12;
  const cardStyles = getCardStyle(theme);

  return (
    <div style={{
      width: "100%", height: "100%", position: "relative", overflow: "hidden",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "24px 22px", gap,
      ...getStyleBg(theme),
    }}>
      {getDecorations(theme)}

      <div style={{
        textAlign: "center", marginBottom: 4,
        opacity: titleVis ? 1 : 0, transform: titleVis ? "translateY(0)" : "translateY(10px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
      }}>
        <div style={{ fontSize: 9, color: theme.colors.accent, fontWeight: 700, fontFamily: `${theme.fonts.body}, sans-serif`, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 4 }}>Key Features</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: theme.colors.text, fontFamily: `${theme.fonts.heading}, system-ui, sans-serif`, lineHeight: 1.2 }}>
          {name || "Custom Template"}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap, width: "100%" }}>
        {items.map((item, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
            ...cardStyles,
            opacity: visible.includes(i) ? 1 : 0,
            transform: visible.includes(i) ? "translateX(0)" : "translateX(16px)",
            transition: "opacity 0.4s ease, transform 0.4s ease",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: theme.colors.accent, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: theme.colors.text, fontFamily: `${theme.fonts.body}, sans-serif`, fontWeight: 500 }}>{item}</span>
          </div>
        ))}
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 3, backgroundColor: theme.colors.accent }} />
    </div>
  );
}

// ─── Slide 3: Typography
function SlideTypo({ active, theme }: { active: boolean; theme: CustomTemplateTheme }) {
  const [vis, setVis] = useState(false);
  useEffect(() => {
    if (!active) { setVis(false); return; }
    const t = setTimeout(() => setVis(true), 200);
    return () => clearTimeout(t);
  }, [active]);

  const br = theme.borderRadius;

  return (
    <div style={{
      width: "100%", height: "100%", position: "relative", overflow: "hidden",
      display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
      padding: "0 28px", gap: 18, textAlign: "center",
      ...getStyleBg(theme),
    }}>
      {getDecorations(theme)}

      <div style={{ opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(16px)", transition: "opacity 0.5s ease, transform 0.5s ease" }}>
        <div style={{ fontSize: 9, color: theme.colors.muted, fontFamily: `${theme.fonts.body}, sans-serif`, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 4 }}>Heading</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: theme.colors.text, fontFamily: `${theme.fonts.heading}, system-ui, sans-serif`, lineHeight: 1.2 }}>{theme.fonts.heading}</div>
      </div>

      <div style={{ opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(16px)", transition: "opacity 0.5s ease 0.15s, transform 0.5s ease 0.15s" }}>
        <div style={{ fontSize: 9, color: theme.colors.muted, fontFamily: `${theme.fonts.body}, sans-serif`, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 4 }}>Body</div>
        <div style={{ fontSize: 13, fontWeight: 400, color: theme.colors.text, fontFamily: `${theme.fonts.body}, system-ui, sans-serif`, lineHeight: 1.5 }}>
          {theme.fonts.body} — The quick brown fox
        </div>
      </div>

      <div style={{ opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(16px)", transition: "opacity 0.5s ease 0.3s, transform 0.5s ease 0.3s", width: "100%" }}>
        <div style={{ fontSize: 9, color: theme.colors.muted, fontFamily: `${theme.fonts.body}, sans-serif`, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 4 }}>Mono</div>
        <div style={{
          fontSize: 11, color: theme.colors.accent, fontFamily: `${theme.fonts.mono}, monospace`,
          padding: "6px 10px", borderRadius: br / 2,
          backgroundColor: `${theme.colors.accent}10`,
        }}>
          const theme = extractFromURL()
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 3, backgroundColor: theme.colors.accent }} />
    </div>
  );
}

// ─── Dots
function SlideDots({ total, current, accent, onDotClick }: { total: number; current: number; accent: string; onDotClick: (i: number) => void }) {
  return (
    <div style={{ display: "flex", gap: 5, position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", zIndex: 10 }}>
      {Array.from({ length: total }, (_, i) => (
        <button key={i} onClick={() => onDotClick(i)} style={{
          width: i === current ? 16 : 5, height: 5, borderRadius: 3,
          background: i === current ? accent : `${accent}40`,
          border: "none", cursor: "pointer", padding: 0,
          transition: "all 0.3s ease",
        }} />
      ))}
    </div>
  );
}

// ─── Main
const SLIDE_DURATION = 3500;

interface CustomPreviewPortraitProps {
  theme: CustomTemplateTheme;
  name?: string;
}

export default function CustomPreviewPortrait({ theme, name }: CustomPreviewPortraitProps) {
  const slides = [SlideHero, SlideContent, SlideTypo];
  const [current, setCurrent] = useState(0);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setActive(true), 200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setActive(false);
      setTimeout(() => {
        setCurrent((c) => (c + 1) % slides.length);
        setActive(true);
      }, 150);
    }, SLIDE_DURATION);
    return () => clearInterval(id);
  }, [slides.length]);

  const handleDot = (i: number) => {
    setActive(false);
    setTimeout(() => { setCurrent(i); setActive(true); }, 100);
  };

  const SlideComp = slides[current];

  return (
    <ScaledCanvas>
      <div style={{ width: "100%", height: "100%", position: "relative" }}>
        <SlideComp active={active} theme={theme} name={name} />
        <SlideDots total={slides.length} current={current} accent={theme.colors.accent} onDotClick={handleDot} />
      </div>
    </ScaledCanvas>
  );
}
