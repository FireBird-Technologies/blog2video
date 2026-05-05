import { useEffect, useMemo, useState } from "react";
import { Player } from "@remotion/player";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type HelpFlowKey =
  | "create-project"
  | "edit-scene"
  | "change-voiceover"
  | "custom-template"
  | "change-template";

interface HelpScene {
  label: string;
  title: string;
  note: string;
  focus: string;
}

interface HelpFlow {
  title: string;
  badge: string;
  scenes: HelpScene[];
}

const HELP_FLOWS: Record<HelpFlowKey, HelpFlow> = {
  "create-project": {
    title: "Create a Project",
    badge: "Project Wizard",
    scenes: [
      { label: "Step 1", title: "Click New", note: "Open the guided project flow from the dashboard.", focus: "new" },
      { label: "Step 2", title: "Add Source", note: "Paste a URL or upload a document as the project source.", focus: "source" },
      { label: "Step 3", title: "Pick Template", note: "Choose a visual system before generation starts.", focus: "template" },
      { label: "Step 4", title: "Choose Voice", note: "Select narration settings or choose no voiceover.", focus: "voice" },
      { label: "Step 5", title: "Generate", note: "Create the project and open the scene editor.", focus: "generate" },
    ],
  },
  "edit-scene": {
    title: "Edit a Scene",
    badge: "Scene Editor",
    scenes: [
      { label: "Step 1", title: "Open Project", note: "Start from a generated project with scenes ready.", focus: "project" },
      { label: "Step 2", title: "Scenes Tab", note: "Find the scene that needs a targeted edit.", focus: "tab" },
      { label: "Step 3", title: "Open Editor", note: "Edit one scene without rebuilding the video.", focus: "editor" },
      { label: "Step 4", title: "Adjust Details", note: "Change text, narration, layout, or visuals.", focus: "fields" },
      { label: "Step 5", title: "Save", note: "Review the edited moment in context.", focus: "save" },
    ],
  },
  "change-voiceover": {
    title: "Change Voiceover",
    badge: "Voice Controls",
    scenes: [
      { label: "Step 1", title: "Select Voice", note: "Choose the main voice during project creation.", focus: "voice" },
      { label: "Step 2", title: "Preview Audio", note: "Listen before generating the project.", focus: "preview" },
      { label: "Step 3", title: "Edit Scene", note: "Open one scene when narration needs a fix.", focus: "scene" },
      { label: "Step 4", title: "Rewrite Script", note: "Update the line exactly as it should be spoken.", focus: "script" },
      { label: "Step 5", title: "Regenerate", note: "Regenerate that scene's voiceover only.", focus: "regenerate" },
    ],
  },
  "custom-template": {
    title: "Create a Custom Template",
    badge: "Template Creator",
    scenes: [
      { label: "Step 1", title: "Templates Area", note: "Open the dashboard template library.", focus: "library" },
      { label: "Step 2", title: "Craft Template", note: "Start a branded template from a reference.", focus: "craft" },
      { label: "Step 3", title: "Extract Theme", note: "Analyze a website URL for brand direction.", focus: "extract" },
      { label: "Step 4", title: "Tune Style", note: "Adjust color, typography, radius, and motion.", focus: "style" },
      { label: "Step 5", title: "Save", note: "Reuse the custom template in future projects.", focus: "save" },
    ],
  },
  "change-template": {
    title: "Change Template",
    badge: "Project Settings",
    scenes: [
      { label: "Step 1", title: "Open Project", note: "Start with an existing generated project.", focus: "project" },
      { label: "Step 2", title: "Settings", note: "Find the current template assignment.", focus: "settings" },
      { label: "Step 3", title: "Pick Template", note: "Choose a built-in or custom template.", focus: "picker" },
      { label: "Step 4", title: "Confirm", note: "Relayout scenes while preserving narration.", focus: "confirm" },
      { label: "Step 5", title: "Review", note: "Check long text scenes after the rebuild.", focus: "review" },
    ],
  },
};

const colors = {
  bg: "#0f1020",
  panel: "#ffffff",
  muted: "#6b7280",
  text: "#111827",
  purple: "#7c3aed",
  purpleSoft: "#ede9fe",
  border: "#e5e7eb",
};

function focusStyle(active: boolean) {
  return {
    borderColor: active ? colors.purple : colors.border,
    boxShadow: active ? "0 0 0 4px rgba(124, 58, 237, 0.16)" : "0 12px 30px rgba(15, 16, 32, 0.08)",
    transform: active ? "scale(1.02)" : "scale(1)",
  };
}

function Pill({ children, active = false }: { children: React.ReactNode; active?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "8px 12px",
        fontSize: 18,
        fontWeight: 700,
        background: active ? colors.purpleSoft : "#f3f4f6",
        color: active ? colors.purple : colors.muted,
      }}
    >
      {children}
    </span>
  );
}

function WizardMock({ focus }: { focus: string }) {
  return (
    <div style={{ display: "grid", gap: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ margin: 0, color: colors.muted, fontSize: 18, fontWeight: 700 }}>Dashboard</p>
          <h3 style={{ margin: "6px 0 0", fontSize: 34 }}>Start a new video</h3>
        </div>
        <button style={{ ...buttonStyle, ...focusStyle(focus === "new") }}>+ New</button>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <Pill active={focus === "source"}>1 Project</Pill>
        <Pill active={focus === "template"}>2 Template</Pill>
        <Pill active={focus === "voice"}>3 Voice</Pill>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 18 }}>
        <div style={{ ...cardStyle, ...focusStyle(focus === "source") }}>
          <p style={labelStyle}>Source URL</p>
          <div style={inputStyle}>https://example.com/blog/how-ai-video-works</div>
          <p style={{ color: colors.muted, fontSize: 18 }}>Or upload a PDF, DOCX, PPTX, or document.</p>
        </div>
        <div style={{ ...cardStyle, ...focusStyle(focus === "template") }}>
          <p style={labelStyle}>Template</p>
          <div style={templateThumbStyle}>Spotlight</div>
          <div style={{ marginTop: 12 }}><Pill active>Preview selected</Pill></div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 18 }}>
        <div style={{ ...cardStyle, ...focusStyle(focus === "voice") }}>
          <p style={labelStyle}>Voice</p>
          <div style={{ display: "flex", gap: 12 }}>
            <Pill active>Female</Pill>
            <Pill>US Accent</Pill>
            <Pill>Preview</Pill>
          </div>
        </div>
        <button style={{ ...buttonStyle, ...focusStyle(focus === "generate") }}>Generate project</button>
      </div>
    </div>
  );
}

function SceneEditorMock({ focus }: { focus: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "0.75fr 1.25fr", gap: 18 }}>
      <div style={{ ...cardStyle, minHeight: 520 }}>
        <p style={labelStyle}>Project tabs</p>
        {["Preview", "Scenes", "Audio", "Settings"].map((tab) => (
          <div key={tab} style={{ ...listItemStyle, ...focusStyle((focus === "tab" || focus === "project") && tab === "Scenes") }}>
            {tab}
          </div>
        ))}
      </div>
      <div style={{ ...cardStyle, ...focusStyle(focus === "editor") }}>
        <p style={labelStyle}>Scene editor</p>
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ ...inputStyle, ...focusStyle(focus === "fields") }}>Title: The core idea</div>
          <div style={{ ...textareaStyle, ...focusStyle(focus === "fields") }}>Narration: This scene explains the key point in one clean sentence.</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={inputStyle}>Layout: statement</div>
            <div style={inputStyle}>Image focus: center</div>
          </div>
          <button style={{ ...buttonStyle, alignSelf: "end", ...focusStyle(focus === "save") }}>Save scene</button>
        </div>
      </div>
    </div>
  );
}

function VoiceMock({ focus }: { focus: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
      <div style={{ ...cardStyle, ...focusStyle(focus === "voice" || focus === "preview") }}>
        <p style={labelStyle}>Project voice</p>
        <h3 style={sectionTitleStyle}>Choose during creation</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <Pill active={focus === "voice"}>Female</Pill>
          <Pill>British</Pill>
          <Pill active={focus === "preview"}>Play preview</Pill>
          <Pill>No voiceover</Pill>
        </div>
      </div>
      <div style={{ ...cardStyle, ...focusStyle(focus === "scene" || focus === "script" || focus === "regenerate") }}>
        <p style={labelStyle}>Scene narration</p>
        <div style={{ ...textareaStyle, ...focusStyle(focus === "script") }}>Rewrite this line so it sounds natural when spoken aloud.</div>
        <label style={{ ...listItemStyle, ...focusStyle(focus === "regenerate") }}>
          <span style={{ color: colors.purple, fontWeight: 900 }}>On</span>
          Regenerate voiceover for this scene
        </label>
      </div>
    </div>
  );
}

function CustomTemplateMock({ focus }: { focus: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 18 }}>
      <div style={{ ...cardStyle, ...focusStyle(focus === "library" || focus === "craft") }}>
        <p style={labelStyle}>My Templates</p>
        <div style={templateThumbStyle}>Brand Library</div>
        <button style={{ ...buttonStyle, width: "100%", marginTop: 16 }}>Craft custom template</button>
      </div>
      <div style={{ ...cardStyle }}>
        <p style={labelStyle}>Custom template creator</p>
        <div style={{ ...inputStyle, ...focusStyle(focus === "extract") }}>https://yourbrand.com</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
          <div style={{ ...swatchStyle, background: "#6d28d9", ...focusStyle(focus === "style") }}>Accent</div>
          <div style={{ ...swatchStyle, background: "#111827", color: "#fff", ...focusStyle(focus === "style") }}>Text</div>
        </div>
        <button style={{ ...buttonStyle, marginTop: 16, ...focusStyle(focus === "save") }}>Save template</button>
      </div>
    </div>
  );
}

function ChangeTemplateMock({ focus }: { focus: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "0.85fr 1.15fr", gap: 18 }}>
      <div style={{ ...cardStyle, ...focusStyle(focus === "project" || focus === "settings") }}>
        <p style={labelStyle}>Project settings</p>
        <div style={templateThumbStyle}>Current: Nightfall</div>
        <button style={{ ...buttonStyle, width: "100%", marginTop: 16 }}>Change template</button>
      </div>
      <div style={{ ...cardStyle, ...focusStyle(focus === "picker" || focus === "confirm" || focus === "review") }}>
        <p style={labelStyle}>Template picker</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ ...templateThumbStyle, ...focusStyle(focus === "picker") }}>Gridcraft</div>
          <div style={templateThumbStyle}>Custom Brand</div>
        </div>
        <div style={{ ...listItemStyle, marginTop: 16, ...focusStyle(focus === "confirm") }}>
          Preserve narration, display text, and voiceovers
        </div>
        <button style={{ ...buttonStyle, marginTop: 16, ...focusStyle(focus === "review") }}>Review updated scenes</button>
      </div>
    </div>
  );
}

function MockSurface({ flowKey, focus }: { flowKey: HelpFlowKey; focus: string }) {
  if (flowKey === "create-project") return <WizardMock focus={focus} />;
  if (flowKey === "edit-scene") return <SceneEditorMock focus={focus} />;
  if (flowKey === "change-voiceover") return <VoiceMock focus={focus} />;
  if (flowKey === "custom-template") return <CustomTemplateMock focus={focus} />;
  return <ChangeTemplateMock focus={focus} />;
}

function HelpDemoComposition({ flowKey }: { flowKey: HelpFlowKey }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const flow = HELP_FLOWS[flowKey];
  const framesPerScene = fps * 4;
  const sceneIndex = Math.min(Math.floor(frame / framesPerScene), flow.scenes.length - 1);
  const scene = flow.scenes[sceneIndex];
  const localFrame = frame - sceneIndex * framesPerScene;
  const entrance = spring({ frame: localFrame, fps, config: { damping: 18, stiffness: 120 } });
  const pulse = interpolate(localFrame % 60, [0, 30, 60], [0.96, 1.04, 0.96]);

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg, #100f24 0%, #312e81 55%, #6d28d9 100%)", padding: 72 }}>
      <div style={{ display: "grid", gridTemplateColumns: "0.42fr 1fr", gap: 42, height: "100%" }}>
        <aside style={{ color: "#fff", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <p style={{ margin: 0, letterSpacing: 4, textTransform: "uppercase", fontSize: 20, opacity: 0.75 }}>
              {flow.badge}
            </p>
            <h2 style={{ margin: "18px 0 0", fontSize: 64, lineHeight: 1, fontWeight: 900 }}>{flow.title}</h2>
          </div>
          <div style={{ transform: `translateY(${interpolate(entrance, [0, 1], [28, 0])}px)`, opacity: entrance }}>
            <p style={{ margin: 0, color: "#ddd6fe", fontSize: 26, fontWeight: 800 }}>{scene.label}</p>
            <h3 style={{ margin: "10px 0", fontSize: 44, lineHeight: 1.05 }}>{scene.title}</h3>
            <p style={{ margin: 0, color: "#ede9fe", fontSize: 25, lineHeight: 1.35 }}>{scene.note}</p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {flow.scenes.map((entry, index) => (
              <div
                key={entry.label}
                style={{
                  width: index === sceneIndex ? 58 : 20,
                  height: 14,
                  borderRadius: 999,
                  background: index === sceneIndex ? "#fff" : "rgba(255,255,255,0.35)",
                  transition: "width 200ms ease",
                }}
              />
            ))}
          </div>
        </aside>
        <main
          style={{
            background: "rgba(255,255,255,0.94)",
            borderRadius: 42,
            padding: 30,
            boxShadow: "0 40px 120px rgba(0,0,0,0.35)",
            transform: `scale(${pulse})`,
          }}
        >
          <MockSurface flowKey={flowKey} focus={scene.focus} />
        </main>
      </div>
    </AbsoluteFill>
  );
}

const buttonStyle: React.CSSProperties = {
  border: `2px solid ${colors.purple}`,
  borderRadius: 18,
  background: colors.purple,
  color: "#fff",
  padding: "18px 24px",
  fontSize: 22,
  fontWeight: 800,
};

const cardStyle: React.CSSProperties = {
  border: `2px solid ${colors.border}`,
  borderRadius: 26,
  background: colors.panel,
  padding: 24,
  transition: "all 180ms ease",
};

const labelStyle: React.CSSProperties = {
  margin: "0 0 12px",
  color: colors.purple,
  letterSpacing: 3,
  textTransform: "uppercase",
  fontSize: 16,
  fontWeight: 900,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "0 0 16px",
  color: colors.text,
  fontSize: 32,
};

const inputStyle: React.CSSProperties = {
  border: `2px solid ${colors.border}`,
  borderRadius: 18,
  padding: 18,
  color: colors.text,
  background: "#f9fafb",
  fontSize: 22,
  fontWeight: 700,
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 150,
  lineHeight: 1.35,
};

const templateThumbStyle: React.CSSProperties = {
  borderRadius: 22,
  minHeight: 148,
  padding: 22,
  display: "flex",
  alignItems: "end",
  color: "#fff",
  fontSize: 28,
  fontWeight: 900,
  background: "linear-gradient(135deg, #111827, #7c3aed)",
};

const listItemStyle: React.CSSProperties = {
  border: `2px solid ${colors.border}`,
  borderRadius: 18,
  padding: 18,
  marginBottom: 12,
  display: "flex",
  gap: 14,
  alignItems: "center",
  color: colors.text,
  background: "#fff",
  fontSize: 22,
  fontWeight: 800,
};

const swatchStyle: React.CSSProperties = {
  border: `2px solid ${colors.border}`,
  borderRadius: 18,
  color: "#fff",
  minHeight: 96,
  padding: 18,
  display: "flex",
  alignItems: "end",
  fontSize: 22,
  fontWeight: 900,
};

interface HelpDemoPlayerProps {
  sceneKey: string;
}

export default function HelpDemoPlayer({ sceneKey }: HelpDemoPlayerProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const flowKey = (sceneKey in HELP_FLOWS ? sceneKey : "create-project") as HelpFlowKey;
  const durationInFrames = useMemo(() => HELP_FLOWS[flowKey].scenes.length * 4 * 30, [flowKey]);

  return (
    <div className="my-8 overflow-hidden rounded-2xl border border-gray-200 bg-gray-950 shadow-lg">
      <div style={{ aspectRatio: "16/9", width: "100%" }}>
        {mounted ? (
          <Player
            component={HelpDemoComposition}
            inputProps={{ flowKey }}
            durationInFrames={durationInFrames}
            compositionWidth={1920}
            compositionHeight={1080}
            fps={30}
            controls
            autoPlay
            loop
            acknowledgeRemotionLicense
            style={{ width: "100%", height: "100%", display: "block" }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-950 text-sm text-white/60">
            Loading help explainer...
          </div>
        )}
      </div>
    </div>
  );
}
