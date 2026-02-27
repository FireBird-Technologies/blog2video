import { useState, useEffect, useRef } from "react";
import type { CustomTemplateTheme } from "../../api/client";

// ─── Scale wrapper (matches other preview components)
const INTERNAL_W = 480;
const INTERNAL_H = 270;

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
    <div
      ref={ref}
      style={{ width: "100%", aspectRatio: `${INTERNAL_W}/${INTERNAL_H}`, overflow: "hidden", position: "relative" }}
    >
      <div style={{ width: INTERNAL_W, height: INTERNAL_H, transform: `scale(${scale})`, transformOrigin: "top left", position: "absolute" }}>
        {children}
      </div>
    </div>
  );
}

// ─── Style helpers
function getStyleBg(theme: CustomTemplateTheme): React.CSSProperties {
  const s = theme.style;
  if (s === "glass") return { background: `linear-gradient(135deg, ${theme.colors.bg}ee, ${theme.colors.surface}cc)`, backdropFilter: "blur(20px)" };
  if (s === "neon") return { background: theme.colors.bg, boxShadow: `inset 0 0 60px ${theme.colors.accent}15` };
  if (s === "bold") return { background: theme.colors.bg };
  if (s === "soft") return { background: `linear-gradient(180deg, ${theme.colors.bg}, ${theme.colors.surface})` };
  return { background: theme.colors.bg }; // minimal
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
    nodes.push(
      <div key="grad" style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: `radial-gradient(circle, ${theme.colors.accent}20, transparent 70%)` }} />
    );
  }
  if (elems.includes("accent-lines")) {
    nodes.push(
      <div key="line" style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", backgroundColor: theme.colors.accent }} />
    );
  }
  if (elems.includes("dots")) {
    nodes.push(
      <div key="dots" style={{ position: "absolute", bottom: 10, right: 10, width: 60, height: 60, opacity: 0.1, backgroundImage: `radial-gradient(${theme.colors.accent} 1.5px, transparent 1.5px)`, backgroundSize: "8px 8px" }} />
    );
  }
  if (elems.includes("background-shapes")) {
    nodes.push(
      <div key="shape" style={{ position: "absolute", bottom: -20, left: -20, width: 100, height: 100, borderRadius: theme.borderRadius, backgroundColor: `${theme.colors.accent}08`, transform: "rotate(15deg)" }} />
    );
  }

  // Always add a subtle accent circle if nothing else
  if (nodes.length === 0) {
    nodes.push(
      <div key="circle" style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", border: `2px solid ${theme.colors.accent}20` }} />
    );
  }

  return <>{nodes}</>;
}

// ─── Slide 1: Hero with template name
function SlideHero({ active, theme, name }: { active: boolean; theme: CustomTemplateTheme; name?: string }) {
  const [titleVis, setTitleVis] = useState(false);
  const [barW, setBarW] = useState(0);
  const [subVis, setSubVis] = useState(false);

  useEffect(() => {
    if (!active) { setTitleVis(false); setBarW(0); setSubVis(false); return; }
    const t1 = setTimeout(() => setBarW(100), 100);
    const t2 = setTimeout(() => setTitleVis(true), 300);
    const t3 = setTimeout(() => setSubVis(true), 600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [active]);

  const br = theme.borderRadius;
  const direction = theme.patterns?.layout?.direction || "centered";
  const isLeft = direction === "left-aligned" || direction === "asymmetric";

  return (
    <div style={{
      width: "100%", height: "100%", position: "relative", overflow: "hidden",
      display: "flex", flexDirection: "column",
      justifyContent: "center",
      alignItems: isLeft ? "flex-start" : "center",
      padding: isLeft ? "0 48px" : "0 60px",
      textAlign: isLeft ? "left" : "center",
      ...getStyleBg(theme),
    }}>
      {getDecorations(theme)}

      {/* Accent bar */}
      <div style={{
        width: barW, height: 4, backgroundColor: theme.colors.accent, borderRadius: 2, marginBottom: 20,
        transition: "width 0.5s cubic-bezier(0.16,1,0.3,1)",
        ...(isLeft ? {} : { alignSelf: "center" }),
      }} />

      {/* Title */}
      <div style={{
        fontSize: 38, fontWeight: 800, color: theme.colors.text, lineHeight: 1.2,
        fontFamily: `${theme.fonts.heading}, system-ui, sans-serif`,
        opacity: titleVis ? 1 : 0, transform: titleVis ? "translateY(0)" : "translateY(24px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
        letterSpacing: theme.style === "bold" ? "-0.04em" : "-0.02em",
      }}>
        {name || "Custom Template"}
      </div>

      {/* Subtitle */}
      <div style={{
        fontSize: 16, color: theme.colors.muted, marginTop: 12,
        fontFamily: `${theme.fonts.body}, system-ui, sans-serif`, fontWeight: 400,
        opacity: subVis ? 1 : 0, transform: subVis ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
        display: "flex", alignItems: "center", gap: 8,
        ...(isLeft ? {} : { justifyContent: "center" }),
      }}>
        <span style={{
          display: "inline-block", padding: "2px 8px", borderRadius: br / 2,
          backgroundColor: `${theme.colors.accent}18`, color: theme.colors.accent,
          fontSize: 12, fontWeight: 600, textTransform: "capitalize",
        }}>
          {theme.style}
        </span>
        <span>{theme.category || "custom"} template</span>
      </div>

      {/* Color swatches + pattern pills */}
      <div style={{
        display: "flex", gap: 6, marginTop: 20, opacity: subVis ? 1 : 0,
        transition: "opacity 0.5s ease 0.2s", alignItems: "center", flexWrap: "wrap",
        ...(isLeft ? {} : { justifyContent: "center" }),
      }}>
        {[theme.colors.accent, theme.colors.bg, theme.colors.text, theme.colors.surface, theme.colors.muted].map((c, i) => (
          <div key={i} style={{
            width: 18, height: 18, borderRadius: "50%",
            backgroundColor: c, border: `1.5px solid ${theme.colors.text}15`,
          }} />
        ))}
        {theme.patterns && (
          <>
            <div style={{ width: 1, height: 14, backgroundColor: `${theme.colors.text}20`, margin: "0 4px" }} />
            {[
              theme.patterns.cards?.corners,
              theme.patterns.spacing?.density,
              theme.patterns.images?.treatment,
            ].filter(Boolean).map((label, i) => (
              <span key={i} style={{
                fontSize: 8, padding: "1px 5px", borderRadius: 6,
                backgroundColor: `${theme.colors.accent}15`, color: theme.colors.accent,
                fontFamily: `${theme.fonts.body}, sans-serif`, fontWeight: 600,
                textTransform: "capitalize",
              }}>
                {label}
              </span>
            ))}
          </>
        )}
      </div>

      {/* Bottom accent */}
      <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 4, backgroundColor: theme.colors.accent }} />
    </div>
  );
}

// ─── Slide 2: Content preview — layout varies by theme patterns
function SlideContent({ active, theme, name }: { active: boolean; theme: CustomTemplateTheme; name?: string }) {
  const [visible, setVisible] = useState<number[]>([]);
  const [titleVis, setTitleVis] = useState(false);

  const items = [
    { text: "AI-powered script generation", icon: "pen" },
    { text: "Automatic scene detection", icon: "eye" },
    { text: "Professional narration voices", icon: "mic" },
  ];

  useEffect(() => {
    if (!active) { setVisible([]); setTitleVis(false); return; }
    const t0 = setTimeout(() => setTitleVis(true), 100);
    const timers = items.map((_, i) =>
      setTimeout(() => setVisible((v) => [...v, i]), 250 + i * 150)
    );
    return () => { clearTimeout(t0); timers.forEach(clearTimeout); };
  }, [active]);

  const direction = theme.patterns?.layout?.direction || "centered";
  const density = theme.patterns?.spacing?.density || "balanced";
  const gap = density === "compact" ? 6 : density === "spacious" ? 14 : 10;
  const cardStyles = getCardStyle(theme);

  // Choose arrangement based on theme direction
  if (direction === "left-aligned") {
    // Split layout: title left, cards right
    return (
      <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", display: "flex", ...getStyleBg(theme) }}>
        {getDecorations(theme)}
        <div style={{ flex: "0 0 42%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 28px" }}>
          <div style={{
            fontSize: 10, color: theme.colors.accent, fontWeight: 700,
            fontFamily: `${theme.fonts.body}, sans-serif`, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8,
            opacity: titleVis ? 1 : 0, transition: "opacity 0.4s ease",
          }}>Key Features</div>
          <div style={{
            fontSize: 24, fontWeight: 800, color: theme.colors.text, lineHeight: 1.2,
            fontFamily: `${theme.fonts.heading}, system-ui, sans-serif`,
            opacity: titleVis ? 1 : 0, transform: titleVis ? "translateY(0)" : "translateY(12px)",
            transition: "opacity 0.5s ease, transform 0.5s ease",
          }}>{name || "Custom Template"}</div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 24px 0 0", gap }}>
          {items.map((item, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
              ...cardStyles,
              opacity: visible.includes(i) ? 1 : 0,
              transform: visible.includes(i) ? "translateX(0)" : "translateX(20px)",
              transition: "opacity 0.4s ease, transform 0.4s ease",
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: theme.colors.accent, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: theme.colors.text, fontFamily: `${theme.fonts.body}, sans-serif`, fontWeight: 500 }}>{item.text}</span>
            </div>
          ))}
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 4, backgroundColor: theme.colors.accent }} />
      </div>
    );
  }

  if (direction === "asymmetric") {
    // Asymmetric: large title top-left, smaller cards scattered right
    return (
      <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", padding: "24px 32px", ...getStyleBg(theme) }}>
        {getDecorations(theme)}
        <div style={{
          opacity: titleVis ? 1 : 0, transform: titleVis ? "translateY(0)" : "translateY(16px)",
          transition: "opacity 0.5s ease, transform 0.5s ease",
          marginBottom: 16,
        }}>
          <div style={{
            fontSize: 28, fontWeight: 800, color: theme.colors.text, lineHeight: 1.15,
            fontFamily: `${theme.fonts.heading}, system-ui, sans-serif`,
            maxWidth: "55%",
          }}>{name || "Custom Template"}</div>
        </div>
        <div style={{ display: "flex", gap, flexWrap: "wrap" }}>
          {items.map((item, i) => (
            <div key={i} style={{
              padding: "10px 16px", flex: i === 0 ? "1 1 55%" : "1 1 40%",
              ...cardStyles,
              opacity: visible.includes(i) ? 1 : 0,
              transform: visible.includes(i) ? "translateY(0)" : "translateY(14px)",
              transition: `opacity 0.4s ease ${i * 0.1}s, transform 0.4s ease ${i * 0.1}s`,
            }}>
              <div style={{ fontSize: 10, color: theme.colors.accent, fontWeight: 700, fontFamily: `${theme.fonts.body}, sans-serif`, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                Feature {i + 1}
              </div>
              <div style={{ fontSize: 13, color: theme.colors.text, fontFamily: `${theme.fonts.body}, sans-serif`, fontWeight: 500 }}>{item.text}</div>
            </div>
          ))}
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 4, backgroundColor: theme.colors.accent }} />
      </div>
    );
  }

  // "centered" (default): stacked centered layout
  return (
    <div style={{
      width: "100%", height: "100%", position: "relative", overflow: "hidden",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "20px 40px", textAlign: "center",
      ...getStyleBg(theme),
    }}>
      {getDecorations(theme)}
      <div style={{
        fontSize: 10, color: theme.colors.accent, fontWeight: 700,
        fontFamily: `${theme.fonts.body}, sans-serif`, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6,
        opacity: titleVis ? 1 : 0, transition: "opacity 0.4s ease",
      }}>Key Features</div>
      <div style={{
        fontSize: 22, fontWeight: 800, color: theme.colors.text, lineHeight: 1.2, marginBottom: 16,
        fontFamily: `${theme.fonts.heading}, system-ui, sans-serif`,
        opacity: titleVis ? 1 : 0, transform: titleVis ? "translateY(0)" : "translateY(10px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
      }}>{name || "Custom Template"}</div>
      <div style={{ display: "flex", gap, width: "100%", justifyContent: "center" }}>
        {items.map((item, i) => (
          <div key={i} style={{
            flex: "1 1 0", padding: "12px 10px", textAlign: "center", maxWidth: 140,
            ...cardStyles,
            opacity: visible.includes(i) ? 1 : 0,
            transform: visible.includes(i) ? "scale(0.9)" : "scale(1)",
            transition: `opacity 0.4s ease ${i * 0.12}s, transform 0.3s ease ${i * 0.12}s`,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: theme.colors.accent, margin: "0 auto 8px" }} />
            <div style={{ fontSize: 11, color: theme.colors.text, fontFamily: `${theme.fonts.body}, sans-serif`, fontWeight: 500, lineHeight: 1.3 }}>{item.text}</div>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 4, backgroundColor: theme.colors.accent }} />
    </div>
  );
}

// ─── Slide 3: Typography showcase
function SlideTypo({ active, theme }: { active: boolean; theme: CustomTemplateTheme }) {
  const [vis, setVis] = useState(false);

  useEffect(() => {
    if (!active) { setVis(false); return; }
    const t = setTimeout(() => setVis(true), 200);
    return () => clearTimeout(t);
  }, [active]);

  const br = theme.borderRadius;
  const direction = theme.patterns?.layout?.direction || "centered";
  const isCenter = direction === "centered";

  return (
    <div style={{
      width: "100%", height: "100%", position: "relative", overflow: "hidden",
      display: "flex", flexDirection: "column", justifyContent: "center",
      padding: "0 48px", gap: 16,
      alignItems: isCenter ? "center" : "flex-start",
      textAlign: isCenter ? "center" : "left",
      ...getStyleBg(theme),
    }}>
      {getDecorations(theme)}
      <div style={{
        opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(16px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
      }}>
        <div style={{ fontSize: 10, color: theme.colors.muted, fontFamily: `${theme.fonts.body}, sans-serif`, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
          Heading
        </div>
        <div style={{ fontSize: 32, fontWeight: 800, color: theme.colors.text, fontFamily: `${theme.fonts.heading}, system-ui, sans-serif`, lineHeight: 1.2 }}>
          {theme.fonts.heading}
        </div>
      </div>
      <div style={{
        opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(16px)",
        transition: "opacity 0.5s ease 0.15s, transform 0.5s ease 0.15s",
      }}>
        <div style={{ fontSize: 10, color: theme.colors.muted, fontFamily: `${theme.fonts.body}, sans-serif`, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
          Body
        </div>
        <div style={{ fontSize: 18, fontWeight: 400, color: theme.colors.text, fontFamily: `${theme.fonts.body}, system-ui, sans-serif` }}>
          {theme.fonts.body} — The quick brown fox jumps over the lazy dog
        </div>
      </div>
      <div style={{
        opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(16px)",
        transition: "opacity 0.5s ease 0.3s, transform 0.5s ease 0.3s",
      }}>
        <div style={{ fontSize: 10, color: theme.colors.muted, fontFamily: `${theme.fonts.body}, sans-serif`, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
          Mono
        </div>
        <div style={{
          fontSize: 14, color: theme.colors.accent, fontFamily: `${theme.fonts.mono}, monospace`,
          padding: "6px 10px", borderRadius: br / 2,
          backgroundColor: `${theme.colors.accent}10`,
        }}>
          const theme = extractFromURL()
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 4, backgroundColor: theme.colors.accent }} />
    </div>
  );
}

// ─── Slide indicator dots
function SlideDots({ total, current, accent, onDotClick }: { total: number; current: number; accent: string; onDotClick: (i: number) => void }) {
  return (
    <div style={{ display: "flex", gap: 5, position: "absolute", bottom: 12, right: 14, zIndex: 10 }}>
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          onClick={() => onDotClick(i)}
          style={{
            width: i === current ? 16 : 6, height: 6, borderRadius: 3,
            background: i === current ? accent : `${accent}40`,
            border: "none", cursor: "pointer", padding: 0,
            transition: "all 0.3s ease",
          }}
        />
      ))}
    </div>
  );
}

// ─── Main
const SLIDE_DURATION = 3500;

interface CustomPreviewProps {
  theme: CustomTemplateTheme;
  name?: string;
}

export default function CustomPreview({ theme, name }: CustomPreviewProps) {
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
  }, []);

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
