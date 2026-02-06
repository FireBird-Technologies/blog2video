import json
import asyncio
import dspy

from app.dspy_modules import ensure_dspy_configured

# ─── Component library: each key is a layout type with its example code ───

COMPONENT_LIBRARY: dict[str, dict] = {
    "code_block": {
        "name": "Code Block",
        "when": "Scene shows code snippets, terminal commands, API calls, config files, or any programming content",
        "example": '''import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

const ACCENT = "#7C3AED";

const CodeScene: React.FC<{ title: string; narration: string; imageUrl?: string }> = ({ title }) => {
  const frame = useCurrentFrame();
  const titleOp = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const codeOp = interpolate(frame, [15, 40], [0, 1], { extrapolateRight: "clamp" });
  const codeY = interpolate(frame, [15, 40], [30, 0], { extrapolateRight: "clamp" });
  const lineReveal = interpolate(frame, [20, 80], [0, 6], { extrapolateRight: "clamp" });
  const cursorBlink = Math.floor(frame / 15) % 2;

  const codeLines = [
    'const fetchData = async (url) => {',
    '  const res = await fetch(url);',
    '  if (!res.ok) throw new Error(res.status);',
    '  return res.json();',
    '};',
    'export default fetchData;',
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: "#0A0A0A", padding: "80px 100px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <h2 style={{ color: "#FFF", fontSize: 42, fontWeight: 700, fontFamily: "Inter, sans-serif", opacity: titleOp, marginBottom: 40 }}>{title}</h2>
      <div style={{ backgroundColor: "#1a1a2e", borderRadius: 16, padding: "32px 40px", border: "1px solid #333", opacity: codeOp, transform: `translateY(${codeY}px)` }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#FF5F57" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#FEBC2E" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#28C840" }} />
        </div>
        {codeLines.map((line, i) => (
          <div key={i} style={{ fontFamily: "'Fira Code', 'Courier New', monospace", fontSize: 22, lineHeight: 2, color: i < Math.floor(lineReveal) ? "#E0E0E0" : "transparent", transition: "color 0.3s" }}>
            {line}{i === Math.floor(lineReveal) && <span style={{ opacity: cursorBlink, color: ACCENT }}>|</span>}
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 4, backgroundColor: ACCENT }} />
    </AbsoluteFill>
  );
};
export default CodeScene;''',
    },
    "bullet_list": {
        "name": "Bullet List / Key Points",
        "when": "Scene lists features, benefits, steps, takeaways, or any enumerated items",
        "example": '''import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

const ACCENT = "#7C3AED";

const BulletScene: React.FC<{ title: string; narration: string; imageUrl?: string }> = ({ title }) => {
  const frame = useCurrentFrame();
  const titleOp = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  const bullets = ["Faster iteration cycles", "Lower infrastructure cost", "Built-in type safety", "Automatic scaling"];

  return (
    <AbsoluteFill style={{ backgroundColor: "#FFFFFF", padding: "80px 120px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ position: "absolute", top: -60, right: -60, width: 350, height: 350, borderRadius: "50%", border: `2px solid ${ACCENT}15` }} />
      <h2 style={{ color: "#0A0A0A", fontSize: 48, fontWeight: 700, fontFamily: "Inter, sans-serif", opacity: titleOp, marginBottom: 48 }}>{title}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {bullets.map((b, i) => {
          const delay = 20 + i * 12;
          const op = interpolate(frame, [delay, delay + 15], [0, 1], { extrapolateRight: "clamp" });
          const x = interpolate(frame, [delay, delay + 15], [-40, 0], { extrapolateRight: "clamp" });
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 20, opacity: op, transform: `translateX(${x}px)` }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${ACCENT}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ color: ACCENT, fontWeight: 700, fontSize: 18, fontFamily: "Inter, sans-serif" }}>{i + 1}</span>
              </div>
              <span style={{ color: "#1a1a1a", fontSize: 28, fontFamily: "Inter, sans-serif", fontWeight: 500 }}>{b}</span>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 4, backgroundColor: ACCENT }} />
    </AbsoluteFill>
  );
};
export default BulletScene;''',
    },
    "flow_diagram": {
        "name": "Flow Diagram / Architecture",
        "when": "Scene explains a pipeline, workflow, architecture, process steps, or data flow",
        "example": '''import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

const ACCENT = "#7C3AED";

const FlowScene: React.FC<{ title: string; narration: string; imageUrl?: string }> = ({ title }) => {
  const frame = useCurrentFrame();
  const titleOp = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  const steps = ["Input Data", "Process", "Validate", "Output"];

  return (
    <AbsoluteFill style={{ backgroundColor: "#FFFFFF", padding: "80px 100px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
      <h2 style={{ color: "#0A0A0A", fontSize: 44, fontWeight: 700, fontFamily: "Inter, sans-serif", opacity: titleOp, marginBottom: 60 }}>{title}</h2>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {steps.map((step, i) => {
          const delay = 15 + i * 18;
          const scale = interpolate(frame, [delay, delay + 15], [0.5, 1], { extrapolateRight: "clamp" });
          const op = interpolate(frame, [delay, delay + 15], [0, 1], { extrapolateRight: "clamp" });
          const arrowOp = interpolate(frame, [delay + 8, delay + 18], [0, 1], { extrapolateRight: "clamp" });
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ padding: "20px 32px", borderRadius: 14, backgroundColor: i === steps.length - 1 ? ACCENT : "#F5F3FF", border: `2px solid ${i === steps.length - 1 ? ACCENT : ACCENT + "40"}`, transform: `scale(${scale})`, opacity: op }}>
                <span style={{ fontSize: 22, fontWeight: 600, color: i === steps.length - 1 ? "#FFF" : "#1a1a1a", fontFamily: "Inter, sans-serif" }}>{step}</span>
              </div>
              {i < steps.length - 1 && (
                <svg width="32" height="20" style={{ opacity: arrowOp }}><path d="M0 10 L24 10 M18 4 L24 10 L18 16" stroke={ACCENT} strokeWidth="2.5" fill="none" /></svg>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 4, backgroundColor: ACCENT }} />
    </AbsoluteFill>
  );
};
export default FlowScene;''',
    },
    "comparison": {
        "name": "Comparison / Split Screen",
        "when": "Scene compares two things: before/after, pros/cons, old/new, option A vs B",
        "example": '''import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

const ACCENT = "#7C3AED";

const CompareScene: React.FC<{ title: string; narration: string; imageUrl?: string }> = ({ title }) => {
  const frame = useCurrentFrame();
  const titleOp = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const leftX = interpolate(frame, [10, 30], [-60, 0], { extrapolateRight: "clamp" });
  const rightX = interpolate(frame, [10, 30], [60, 0], { extrapolateRight: "clamp" });
  const op = interpolate(frame, [10, 30], [0, 1], { extrapolateRight: "clamp" });
  const dividerH = interpolate(frame, [5, 35], [0, 100], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#FFFFFF", padding: "80px 100px", display: "flex", flexDirection: "column" }}>
      <h2 style={{ color: "#0A0A0A", fontSize: 44, fontWeight: 700, fontFamily: "Inter, sans-serif", opacity: titleOp, marginBottom: 48, textAlign: "center" }}>{title}</h2>
      <div style={{ display: "flex", flex: 1, gap: 0, position: "relative" }}>
        <div style={{ flex: 1, padding: 40, opacity: op, transform: `translateX(${leftX}px)` }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <span style={{ fontSize: 24 }}>✕</span>
          </div>
          <h3 style={{ fontSize: 28, fontWeight: 600, color: "#0A0A0A", fontFamily: "Inter, sans-serif", marginBottom: 16 }}>Before</h3>
          <p style={{ fontSize: 22, color: "#666", fontFamily: "Inter, sans-serif", lineHeight: 1.7 }}>Manual processes, slow iteration, error-prone deployments.</p>
        </div>
        <div style={{ width: 2, backgroundColor: "#E5E7EB", alignSelf: "center", height: `${dividerH}%`, borderRadius: 1 }} />
        <div style={{ flex: 1, padding: 40, opacity: op, transform: `translateX(${rightX}px)` }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: "#DCFCE7", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <span style={{ fontSize: 24 }}>✓</span>
          </div>
          <h3 style={{ fontSize: 28, fontWeight: 600, color: "#0A0A0A", fontFamily: "Inter, sans-serif", marginBottom: 16 }}>After</h3>
          <p style={{ fontSize: 22, color: "#666", fontFamily: "Inter, sans-serif", lineHeight: 1.7 }}>Automated CI/CD, fast feedback loops, reliable releases.</p>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 4, backgroundColor: ACCENT }} />
    </AbsoluteFill>
  );
};
export default CompareScene;''',
    },
    "metric": {
        "name": "Metric / Big Number",
        "when": "Scene shows statistics, percentages, KPIs, performance numbers, or quantitative results",
        "example": '''import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

const ACCENT = "#7C3AED";

const MetricScene: React.FC<{ title: string; narration: string; imageUrl?: string }> = ({ title }) => {
  const frame = useCurrentFrame();
  const titleOp = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const numVal = Math.floor(interpolate(frame, [10, 50], [0, 97], { extrapolateRight: "clamp" }));
  const barW = interpolate(frame, [10, 50], [0, 85], { extrapolateRight: "clamp" });
  const subOp = interpolate(frame, [35, 50], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0A0A0A", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", top: -100, left: -100, width: 500, height: 500, borderRadius: "50%", border: `2px solid ${ACCENT}15` }} />
      <h3 style={{ color: "#999", fontSize: 24, fontWeight: 500, fontFamily: "Inter, sans-serif", opacity: titleOp, marginBottom: 24, textTransform: "uppercase", letterSpacing: 4 }}>{title}</h3>
      <div style={{ fontSize: 140, fontWeight: 800, fontFamily: "Inter, sans-serif", color: "#FFF", lineHeight: 1 }}>{numVal}<span style={{ color: ACCENT }}>%</span></div>
      <div style={{ width: 400, height: 8, backgroundColor: "#222", borderRadius: 4, marginTop: 32, overflow: "hidden" }}>
        <div style={{ width: `${barW}%`, height: "100%", backgroundColor: ACCENT, borderRadius: 4 }} />
      </div>
      <p style={{ color: "#888", fontSize: 22, fontFamily: "Inter, sans-serif", marginTop: 24, opacity: subOp }}>Reduction in deployment failures</p>
      <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 4, backgroundColor: ACCENT }} />
    </AbsoluteFill>
  );
};
export default MetricScene;''',
    },
    "text_narration": {
        "name": "Text + Geometric Shapes",
        "when": "General narration, introductions, conclusions, or explanations that don't fit other categories",
        "example": '''import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

const ACCENT = "#7C3AED";

const TextScene: React.FC<{ title: string; narration: string; imageUrl?: string }> = ({ title, narration }) => {
  const frame = useCurrentFrame();
  const titleOp = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" });
  const textOp = interpolate(frame, [15, 40], [0, 1], { extrapolateRight: "clamp" });
  const textY = interpolate(frame, [15, 40], [20, 0], { extrapolateRight: "clamp" });
  const circleScale = interpolate(frame, [0, 35], [0, 1], { extrapolateRight: "clamp" });
  const barW = interpolate(frame, [5, 25], [0, 120], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#FFFFFF", padding: "80px 120px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ position: "absolute", top: -60, right: -60, width: 300, height: 300, borderRadius: "50%", border: `2px solid ${ACCENT}20`, transform: `scale(${circleScale})` }} />
      <div style={{ position: "absolute", top: 80, left: 120, width: barW, height: 4, backgroundColor: ACCENT, borderRadius: 2 }} />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1100 }}>
        <h1 style={{ color: "#0A0A0A", fontSize: 52, fontWeight: 700, opacity: titleOp, marginBottom: 24, fontFamily: "Inter, sans-serif", lineHeight: 1.2 }}>{title}</h1>
        <div style={{ width: 50, height: 4, backgroundColor: ACCENT, borderRadius: 2, marginBottom: 24 }} />
        <p style={{ color: "#404040", fontSize: 27, lineHeight: 1.8, opacity: textOp, transform: `translateY(${textY}px)`, maxWidth: 950, fontFamily: "Inter, sans-serif" }}>{narration}</p>
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 4, backgroundColor: ACCENT }} />
    </AbsoluteFill>
  );
};
export default TextScene;''',
    },
    "quote_callout": {
        "name": "Quote / Callout / Definition",
        "when": "Scene highlights a quote, key definition, important insight, warning, or callout box",
        "example": '''import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

const ACCENT = "#7C3AED";

const QuoteScene: React.FC<{ title: string; narration: string; imageUrl?: string }> = ({ title, narration }) => {
  const frame = useCurrentFrame();
  const barH = interpolate(frame, [0, 25], [0, 100], { extrapolateRight: "clamp" });
  const textOp = interpolate(frame, [10, 30], [0, 1], { extrapolateRight: "clamp" });
  const textX = interpolate(frame, [10, 30], [-30, 0], { extrapolateRight: "clamp" });
  const labelOp = interpolate(frame, [20, 35], [0, 1], { extrapolateRight: "clamp" });
  const glowOp = interpolate(frame, [5, 40], [0, 0.15], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 120px" }}>
      <div style={{ position: "absolute", top: "20%", left: "10%", width: 400, height: 400, borderRadius: "50%", background: `radial-gradient(circle, ${ACCENT}${Math.round(glowOp * 255).toString(16).padStart(2, "0")}, transparent)` }} />
      <div style={{ display: "flex", gap: 40, alignItems: "stretch", maxWidth: 1000, position: "relative" }}>
        <div style={{ width: 6, backgroundColor: ACCENT, borderRadius: 3, height: `${barH}%`, alignSelf: "center", flexShrink: 0 }} />
        <div style={{ opacity: textOp, transform: `translateX(${textX}px)` }}>
          <p style={{ color: "#FFFFFF", fontSize: 36, fontWeight: 600, fontFamily: "Inter, sans-serif", lineHeight: 1.6, fontStyle: "italic", marginBottom: 24 }}>"{narration}"</p>
          <p style={{ color: ACCENT, fontSize: 18, fontWeight: 500, fontFamily: "Inter, sans-serif", opacity: labelOp, textTransform: "uppercase", letterSpacing: 3 }}>{title}</p>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 4, backgroundColor: ACCENT }} />
    </AbsoluteFill>
  );
};
export default QuoteScene;''',
    },
    "image_caption": {
        "name": "Image with Caption / Visual Explainer",
        "when": "Scene should show a blog image with explanatory text, screenshot, diagram from the article",
        "example": '''import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";

const ACCENT = "#7C3AED";

const ImageCaptionScene: React.FC<{ title: string; narration: string; imageUrl?: string }> = ({ title, narration, imageUrl }) => {
  const frame = useCurrentFrame();
  const imgOp = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" });
  const imgScale = interpolate(frame, [0, 25], [1.05, 1], { extrapolateRight: "clamp" });
  const textOp = interpolate(frame, [15, 35], [0, 1], { extrapolateRight: "clamp" });
  const textY = interpolate(frame, [15, 35], [20, 0], { extrapolateRight: "clamp" });
  const borderW = interpolate(frame, [5, 30], [0, 100], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#FFFFFF", display: "flex", flexDirection: "row", alignItems: "center", padding: "60px 80px", gap: 60 }}>
      <div style={{ flex: 1, borderRadius: 16, overflow: "hidden", opacity: imgOp, transform: `scale(${imgScale})`, boxShadow: "0 20px 60px rgba(0,0,0,0.1)", border: `2px solid ${ACCENT}20` }}>
        {imageUrl ? (
          <Img src={imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", aspectRatio: "16/10", backgroundColor: "#F3F0FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", backgroundColor: `${ACCENT}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", backgroundColor: ACCENT }} />
            </div>
          </div>
        )}
      </div>
      <div style={{ flex: 1, opacity: textOp, transform: `translateY(${textY}px)` }}>
        <div style={{ width: `${borderW}%`, height: 4, backgroundColor: ACCENT, borderRadius: 2, marginBottom: 20 }} />
        <h2 style={{ color: "#0A0A0A", fontSize: 38, fontWeight: 700, fontFamily: "Inter, sans-serif", marginBottom: 20, lineHeight: 1.3 }}>{title}</h2>
        <p style={{ color: "#555", fontSize: 22, fontFamily: "Inter, sans-serif", lineHeight: 1.7 }}>{narration}</p>
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 4, backgroundColor: ACCENT }} />
    </AbsoluteFill>
  );
};
export default ImageCaptionScene;''',
    },
    "timeline": {
        "name": "Timeline / Steps / Chronological",
        "when": "Scene shows a sequence of events, timeline, version history, chronological steps, or ordered milestones",
        "example": '''import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

const ACCENT = "#7C3AED";

const TimelineScene: React.FC<{ title: string; narration: string; imageUrl?: string }> = ({ title }) => {
  const frame = useCurrentFrame();
  const titleOp = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  const items = [
    { label: "Phase 1", desc: "Planning & Research" },
    { label: "Phase 2", desc: "Implementation" },
    { label: "Phase 3", desc: "Testing & QA" },
    { label: "Phase 4", desc: "Deployment" },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: "#FFFFFF", padding: "70px 100px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <h2 style={{ color: "#0A0A0A", fontSize: 44, fontWeight: 700, fontFamily: "Inter, sans-serif", opacity: titleOp, marginBottom: 50, textAlign: "center" }}>{title}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 0, position: "relative", paddingLeft: 40 }}>
        {/* Vertical line */}
        <div style={{ position: "absolute", left: 15, top: 0, width: 2, height: `${interpolate(frame, [15, 80], [0, 100], { extrapolateRight: "clamp" })}%`, backgroundColor: `${ACCENT}30`, borderRadius: 1 }} />
        {items.map((item, i) => {
          const delay = 20 + i * 15;
          const op = interpolate(frame, [delay, delay + 12], [0, 1], { extrapolateRight: "clamp" });
          const x = interpolate(frame, [delay, delay + 12], [-30, 0], { extrapolateRight: "clamp" });
          const dotScale = interpolate(frame, [delay, delay + 8], [0, 1], { extrapolateRight: "clamp" });
          return (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 28, marginBottom: 36, opacity: op, transform: `translateX(${x}px)` }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: i === items.length - 1 ? ACCENT : `${ACCENT}20`, border: `2px solid ${ACCENT}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transform: `scale(${dotScale})`, marginLeft: -16 }}>
                <span style={{ color: i === items.length - 1 ? "#FFF" : ACCENT, fontSize: 14, fontWeight: 700 }}>{i + 1}</span>
              </div>
              <div>
                <h3 style={{ fontSize: 22, fontWeight: 600, color: "#0A0A0A", fontFamily: "Inter, sans-serif", marginBottom: 4 }}>{item.label}</h3>
                <p style={{ fontSize: 18, color: "#666", fontFamily: "Inter, sans-serif" }}>{item.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 4, backgroundColor: ACCENT }} />
    </AbsoluteFill>
  );
};
export default TimelineScene;''',
    },
}

# Build a short summary of all types for the planner
_COMPONENT_MENU = "\n".join(
    f"- {key}: {info['name']} — {info['when']}"
    for key, info in COMPONENT_LIBRARY.items()
)


# ─── Layout Planner (cheap LLM picks components) ─────────────────────────

class PickLayout(dspy.Signature):
    """
    You are a video scene layout planner. Given a scene's title, narration, and
    visual description, pick the 1-4 BEST component types from the menu.

    RULES:
    - NEVER pick ONLY "text_narration" — always try to find a more specific component.
    - If the narration mentions ANY code, terminal commands, API calls → include "code_block"
    - If the narration lists features, steps, or benefits → include "bullet_list"
    - If the narration describes a process or flow → include "flow_diagram"
    - If the narration has numbers, percentages, stats → include "metric"
    - If comparing two approaches → include "comparison"
    - If there's a key quote or definition → include "quote_callout"
    - If an image from the blog would help → include "image_caption"
    - If describing chronological phases → include "timeline"
    - "text_narration" is a LAST RESORT for scenes that truly don't fit anything else.

    Pick as many as are relevant — if the scene has code AND bullet points AND a
    flow, include all three. The generator will combine elements from each.
    Return ONLY a JSON array of component keys, e.g. ["code_block", "bullet_list"].
    """

    scene_title: str = dspy.InputField(desc="Title of the scene")
    narration: str = dspy.InputField(desc="Narration text")
    visual_description: str = dspy.InputField(desc="What should be shown visually")
    component_menu: str = dspy.InputField(desc="Available component types and when to use them")

    chosen_components: str = dspy.OutputField(
        desc='JSON array of 1-4 component keys from the menu, e.g. ["code_block", "bullet_list", "flow_diagram"]. '
        'Pick ALL that are relevant to the scene content. Return ONLY the JSON array.'
    )


# ─── Scene Generator (main LLM generates code) ──────────────────────────

class SceneToRemotion(dspy.Signature):
    """
    Generate a visually RICH Remotion (React) component for a single video scene.

    ═══ CRITICAL: NO SIMPLE TEXT OVERLAYS ═══
    NEVER just show a title and paragraph of text. ALWAYS build structured visual
    elements from the narration content. Extract REAL data from the narration:
    - If narration mentions code → hardcode the actual code lines and animate them
    - If narration lists items → build animated bullet/numbered list with actual items
    - If narration describes a process → build actual flow diagram boxes with labels
    - If narration has numbers/stats → animate the real numbers counting up
    - If narration compares things → build a real split-screen with actual labels
    - If narration quotes something → show the actual quote in a callout
    The narration text should be BROKEN DOWN into visual elements, not displayed as-is.

    ═══ DESIGN SYSTEM ═══
    Use the user-specified colors from the input fields:
    - Background color: use the bg_color input field value
    - Text color: use the text_color input field value
    - Accent color: use the accent_color input field for highlights, dividers, shapes, active states
    - Geometric decorations: circles, bars, gradients as background accents
    - Font: "Inter, sans-serif" — fontWeight 700 headings, 500 body
    - Bottom accent stripe: absolute, bottom 0, full width, 4px, accent_color

    ═══ ANIMATION ═══
    - useCurrentFrame() + interpolate() for ALL animations — nothing should be static
    - Stagger reveals: title first (frame 0-20), then content items one by one
    - Code: line-by-line reveal with typing cursor blinking
    - Bullets: slide in from left one-by-one with 10-15 frame delays
    - Flow steps: appear sequentially with scale + fade
    - Numbers: count up via Math.floor(interpolate(...))
    - Shapes: scale/rotate in as background decorations
    - Images: fade in with subtle scale animation
    - If the user provides animation_instructions, follow those instructions
      for animation style. For example: "smooth fade-in transitions" or
      "bounce effects on bullets" or "slide from right".

    ═══ TECHNICAL RULES ═══
    - Import from "remotion": AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig
    - Img from remotion for images (NOT <img>)
    - Default-exported functional React component
    - Props: { title: string; narration: string; imageUrl?: string }
    - Do NOT import React
    - Output ONLY TypeScript/JSX code, no markdown fences

    ═══ SCENE 0 (HERO) ═══
    Scene 0: image-only. Full-screen Img + fade-in + scale. NO text.

    ═══ IMPORTANT ═══
    Follow the reference example(s) closely for layout structure and animation
    patterns, but REPLACE ALL PLACEHOLDER CONTENT with REAL content extracted
    from the narration and visual description. Parse the narration to extract
    actual items, code, numbers, steps, comparisons, etc.
    """

    scene_title: str = dspy.InputField(desc="Title of this scene")
    narration: str = dspy.InputField(desc="Narration text (empty for Scene 0)")
    visual_description: str = dspy.InputField(desc="What to show visually")
    available_images: str = dspy.InputField(desc="JSON array of image paths")
    scene_index: int = dspy.InputField(desc="0-based index. Scene 0 = hero.")
    total_scenes: int = dspy.InputField(desc="Total scenes in the video")
    example_code: str = dspy.InputField(
        desc="Reference Remotion component(s) for the chosen layout type(s). "
        "Follow these patterns for structure and animation."
    )
    accent_color: str = dspy.InputField(
        desc="User-chosen accent color hex (e.g. '#7C3AED'). Use this for all highlights, dividers, active states, accent stripe."
    )
    bg_color: str = dspy.InputField(
        desc="User-chosen background color hex (e.g. '#0A0A0A'). Use this as the main background."
    )
    text_color: str = dspy.InputField(
        desc="User-chosen text color hex (e.g. '#FFFFFF'). Use this for all body/heading text."
    )
    animation_instructions: str = dspy.InputField(
        desc="Optional user instructions for animation style. If empty, use default animations. "
        "If provided, adapt animation patterns accordingly (e.g. 'use bounce effects', 'slide from right')."
    )

    remotion_jsx: str = dspy.OutputField(
        desc="Complete Remotion React component (TypeScript/JSX). "
        "Must match the reference layout style with real content from the narration. "
        "Must use the user-specified accent_color, bg_color, and text_color. "
        "Single default-exported component. No markdown fences."
    )


# ─── Service class ────────────────────────────────────────────────────────

class SceneCodeGenerator:
    """
    Two-step scene generator:
    1. A lightweight planner (Sonnet via dspy.Predict) picks which component layout(s) to use
    2. The main LLM generates Remotion code with only the relevant example(s)
    """

    def __init__(self):
        ensure_dspy_configured()

        # Planner: Sonnet with dspy.Predict (no CoT — fast, cheap)
        self._planner = dspy.Predict(PickLayout)
        self.planner = dspy.asyncify(self._planner)

        # Generator: Sonnet with dspy.ChainOfThought (full reasoning)
        self._generator = dspy.ChainOfThought(SceneToRemotion)
        self.generator = dspy.asyncify(self._generator)

    async def _pick_components(
        self,
        scene_title: str,
        narration: str,
        visual_description: str,
    ) -> list[str]:
        """Use Sonnet (Predict, no CoT) to pick the best component type(s)."""
        result = await self.planner(
            scene_title=scene_title,
            narration=narration,
            visual_description=visual_description,
            component_menu=_COMPONENT_MENU,
        )

        # Parse the JSON array of keys
        try:
            raw = result.chosen_components.strip()
            if raw.startswith("```"):
                lines = raw.split("\n")
                raw = "\n".join(lines[1:-1])
            keys = json.loads(raw)
            if isinstance(keys, str):
                keys = [keys]
            # Validate keys exist
            valid = [k for k in keys if k in COMPONENT_LIBRARY]
            if not valid:
                valid = ["text_narration"]
            return valid[:4]  # max 4
        except (json.JSONDecodeError, TypeError):
            return ["text_narration"]

    def _build_example(
        self,
        component_keys: list[str],
        accent_color: str = "#7C3AED",
        bg_color: str = "#0A0A0A",
        text_color: str = "#FFFFFF",
    ) -> str:
        """Assemble the example code string from selected component keys,
        replacing default colors with user-chosen colors."""
        parts = []
        for key in component_keys:
            info = COMPONENT_LIBRARY[key]
            example = info["example"]
            # Replace default colors with user-chosen ones
            example = example.replace('#7C3AED', accent_color)
            example = example.replace('#0A0A0A', bg_color)
            # Be careful: only replace text color #FFFFFF in text-colored contexts
            # The example uses #FFFFFF for text on dark bg and #0A0A0A for text on light bg
            # We keep the logic: text_color for primary text, invert for secondary
            parts.append(
                f"=== {info['name'].upper()} LAYOUT ===\n{example}"
            )
        return "\n\n".join(parts)

    async def generate_scene_code(
        self,
        scene_title: str,
        narration: str,
        visual_description: str,
        available_images: list[str],
        scene_index: int,
        total_scenes: int,
        accent_color: str = "#7C3AED",
        bg_color: str = "#0A0A0A",
        text_color: str = "#FFFFFF",
        animation_instructions: str = "",
    ) -> str:
        """
        Generate Remotion component code for a single scene.
        Step 1: Planner picks layout.  Step 2: Generator writes code.
        """
        # Scene 0 (hero) always uses a fixed template — no planning needed
        if scene_index == 0:
            return self._hero_template(bg_color=bg_color)

        # Step 1: Pick layout with cheap LLM
        chosen = await self._pick_components(
            scene_title, narration, visual_description
        )

        # Step 2: Build example from chosen components only
        example = self._build_example(chosen, accent_color, bg_color, text_color)

        # Step 3: Generate with main LLM
        result = await self.generator(
            scene_title=scene_title,
            narration=narration,
            visual_description=visual_description,
            available_images=json.dumps(available_images),
            scene_index=scene_index,
            total_scenes=total_scenes,
            example_code=example,
            accent_color=accent_color,
            bg_color=bg_color,
            text_color=text_color,
            animation_instructions=animation_instructions or "Use default smooth animations.",
        )

        return self._clean_code(result.remotion_jsx)

    async def generate_all_scenes(
        self,
        scenes_data: list[dict],
        available_images: list[str],
        accent_color: str = "#7C3AED",
        bg_color: str = "#0A0A0A",
        text_color: str = "#FFFFFF",
        animation_instructions: str = "",
    ) -> list[str]:
        """Generate code for all scenes concurrently."""
        total = len(scenes_data)
        tasks = [
            self.generate_scene_code(
                scene_title=s["title"],
                narration=s["narration"],
                visual_description=s["visual_description"],
                available_images=available_images,
                scene_index=i,
                total_scenes=total,
                accent_color=accent_color,
                bg_color=bg_color,
                text_color=text_color,
                animation_instructions=animation_instructions,
            )
            for i, s in enumerate(scenes_data)
        ]
        return await asyncio.gather(*tasks)

    def _hero_template(self, bg_color: str = "#0A0A0A") -> str:
        """Fixed hero scene — full-screen image fade-in, no text."""
        return f'''import {{ AbsoluteFill, Img, interpolate, useCurrentFrame }} from "remotion";

const HeroScene: React.FC<{{ title: string; narration: string; imageUrl?: string }}> = ({{ imageUrl }}) => {{
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 40], [0, 1], {{ extrapolateRight: "clamp" }});
  const scale = interpolate(frame, [0, 60], [1.08, 1.0], {{ extrapolateRight: "clamp" }});

  return (
    <AbsoluteFill style={{{{ backgroundColor: "{bg_color}" }}}}>
      {{imageUrl && (
        <Img
          src={{imageUrl}}
          style={{{{ width: "100%", height: "100%", objectFit: "cover", opacity, transform: `scale(${{scale}})` }}}}
        />
      )}}
    </AbsoluteFill>
  );
}};
export default HeroScene;'''

    def _clean_code(self, code: str) -> str:
        """Remove any markdown fences and clean up the generated code."""
        code = code.strip()
        if code.startswith("```"):
            lines = code.split("\n")
            if lines[-1].strip() == "```":
                lines = lines[1:-1]
            else:
                lines = lines[1:]
            code = "\n".join(lines)
        return code.strip()
