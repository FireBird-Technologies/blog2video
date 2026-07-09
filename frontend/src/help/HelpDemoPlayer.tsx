import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Player } from "@remotion/player";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type {
  CustomTemplateItem,
  Project,
  Scene,
  SavedVoiceFromAPI,
  TemplateMeta,
  VoicePreview,
} from "../api/client";
import BlogUrlForm, { type BlogUrlFormDemoMode } from "../components/BlogUrlForm";
import CustomTemplateCreator, {
  type CustomTemplateCreatorDemoMode,
} from "../components/CustomTemplateCreator";
import MyVoices, { type MyVoicesDemoMode } from "../pages/MyVoices";
import SharedProjectTabs, { type ProjectTabId, type ProjectTabItem } from "../components/ProjectTabs";
import SceneListRow from "../components/SceneListRow";
import HelpFakeTemplatePreview from "./HelpFakeTemplatePreview";
import ProjectTemplateSettingsCard from "../components/ProjectTemplateSettingsCard";
import ProductSceneCard from "../components/SceneCard";
import SceneEditModal, { type SceneEditModalDemoMode } from "../components/SceneEditModal";
import TemplateChangePickerDemo from "./TemplateChangePickerDemo";
import VoiceItem from "../components/VoiceItem";
import {
  CustomTemplateBadge,
  TEMPLATE_DESCRIPTIONS,
  TEMPLATE_PREVIEWS,
} from "../components/templatePreviewRegistry";

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
  subtitle: string;
  productArea: string;
  scenes: HelpScene[];
}

const HELP_FLOWS: Record<HelpFlowKey, HelpFlow> = {
  "create-project": {
    title: "How to create a project",
    subtitle: "Project wizard",
    productArea: "Dashboard -> New Project",
    scenes: [
      { label: "Step 1", title: "Click New", note: "Open the three-step wizard from the dashboard.", focus: "new" },
      { label: "Step 2", title: "Add source", note: "Paste a URL or upload the document you want to turn into video.", focus: "source" },
      { label: "Step 3", title: "Pick template", note: "Choose the visual system before generation starts.", focus: "template" },
      { label: "Step 4", title: "Choose voice", note: "Select the voice, accent, language, or no voiceover.", focus: "voice" },
      { label: "Step 5", title: "Generate", note: "Create the project and review the generated scenes.", focus: "generate" },
    ],
  },
  "edit-scene": {
    title: "How to edit a scene",
    subtitle: "Scene editor",
    productArea: "Project -> Scenes",
    scenes: [
      { label: "Step 1", title: "Open Scenes", note: "Use the project tab row and switch to the Scenes tab.", focus: "tab" },
      { label: "Step 2", title: "Review scenes", note: "Scan the scene list layout to find the moment that needs a change.", focus: "layout" },
      { label: "Step 3", title: "Open editor", note: "Click the scene edit button to open the edit modal.", focus: "editor" },
      { label: "Step 4", title: "Adjust fields", note: "Edit title, display text, narration, layout, or image direction.", focus: "fields" },
      { label: "Step 5", title: "Save", note: "Save the scene and replay it in context.", focus: "save" },
    ],
  },
  "change-voiceover": {
    title: "How to change voiceover",
    subtitle: "Voice library + scene audio",
    productArea: "Dashboard -> My Voices",
    scenes: [
      { label: "Step 1", title: "Open My Voices", note: "Go to the dashboard voice library where saved voices are managed.", focus: "my-voices" },
      { label: "Step 2", title: "Add a voice", note: "Use Create custom voice to open the voice creation modal.", focus: "add-voice" },
      { label: "Step 3", title: "Clone your voice", note: "Choose Voice clone and upload a clean sample to create your narrator.", focus: "clone" },
      { label: "Step 4", title: "Rewrite script", note: "Open the scene and edit the sentence exactly as it should be spoken.", focus: "script" },
      { label: "Step 5", title: "Regenerate audio", note: "Turn on regenerate voiceover for that scene and save.", focus: "regenerate" },
    ],
  },
  "custom-template": {
    title: "How to create a custom template",
    subtitle: "Custom template creator",
    productArea: "Dashboard -> Templates",
    scenes: [
      { label: "Step 1", title: "Open Templates", note: "Go to the template library in the dashboard.", focus: "library" },
      { label: "Step 2", title: "Craft template", note: "Start the custom template creator.", focus: "craft" },
      { label: "Step 3", title: "Extract theme", note: "Paste a brand URL and let Blog2Video read the style.", focus: "extract" },
      { label: "Step 4", title: "Tune style", note: "Adjust colors, typography, radius, and video style.", focus: "style" },
      { label: "Step 5", title: "Save template", note: "Generate and reuse the template across projects.", focus: "save" },
    ],
  },
  "change-template": {
    title: "How to change template after creation",
    subtitle: "Project settings",
    productArea: "Project -> Settings",
    scenes: [
      { label: "Step 1", title: "Open Settings", note: "Start inside the project and switch to the Settings tab.", focus: "settings-tab" },
      { label: "Step 2", title: "Find video generation", note: "In settings, use the video generation template card.", focus: "generation-menu" },
      { label: "Step 3", title: "Change template", note: "Click Change template to open the template picker.", focus: "change-template" },
      { label: "Step 4", title: "Confirm relayout", note: "Rebuild layouts while keeping narration and voiceovers.", focus: "confirm" },
      { label: "Step 5", title: "Review scenes", note: "Play the updated project and check long text scenes.", focus: "review" },
    ],
  },
};

const colors = {
  background: "#f8fafc",
  panel: "#ffffff",
  panelSoft: "#f9fafb",
  border: "#e5e7eb",
  text: "#111827",
  muted: "#6b7280",
  softText: "#374151",
  purple: "#7c3aed",
  purpleDark: "#5b21b6",
  purpleSoft: "#f3e8ff",
  green: "#16a34a",
  amber: "#f59e0b",
  red: "#ef4444",
};

const shadow = "0 24px 70px rgba(15, 23, 42, 0.10)";

function focusStyle(active: boolean): CSSProperties {
  return {
    borderColor: active ? colors.purple : colors.border,
    boxShadow: active ? "0 0 0 6px rgba(124, 58, 237, 0.14), 0 18px 45px rgba(124, 58, 237, 0.16)" : "none",
    transform: active ? "translateY(-3px)" : "translateY(0)",
  };
}

function Card({
  children,
  active = false,
  style,
}: {
  children: ReactNode;
  active?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        border: `2px solid ${active ? colors.purple : colors.border}`,
        borderRadius: 24,
        background: colors.panel,
        padding: 22,
        ...focusStyle(active),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Button({
  children,
  active = false,
  subtle = false,
}: {
  children: ReactNode;
  active?: boolean;
  subtle?: boolean;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 999,
        padding: "14px 22px",
        border: `2px solid ${active ? colors.purple : subtle ? colors.border : colors.purple}`,
        background: subtle ? colors.panel : colors.purple,
        color: subtle ? colors.text : "#fff",
        fontSize: 20,
        fontWeight: 800,
        ...focusStyle(active),
      }}
    >
      {children}
    </div>
  );
}

function Field({ label, value, active = false, large = false }: { label: string; value: string; active?: boolean; large?: boolean }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <p style={labelStyle}>{label}</p>
      <div
        style={{
          border: `2px solid ${active ? colors.purple : colors.border}`,
          borderRadius: 18,
          background: colors.panelSoft,
          padding: large ? "18px 20px 56px" : "16px 18px",
          minHeight: large ? 116 : undefined,
          color: colors.text,
          fontSize: 21,
          lineHeight: 1.35,
          fontWeight: 700,
          ...focusStyle(active),
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Pill({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "9px 14px",
        background: active ? colors.purpleSoft : colors.panelSoft,
        color: active ? colors.purpleDark : colors.softText,
        border: `2px solid ${active ? "#d8b4fe" : colors.border}`,
        fontSize: 18,
        fontWeight: 800,
      }}
    >
      {children}
    </span>
  );
}

function Stepper({ active }: { active: string }) {
  const steps = [
    ["source", "Project"],
    ["template", "Template"],
    ["voice", "Voice"],
  ];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      {steps.map(([key, label], index) => (
        <div key={key} style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 999,
              display: "grid",
              placeItems: "center",
              background: active === key ? colors.purple : colors.panelSoft,
              color: active === key ? "#fff" : colors.muted,
              border: `2px solid ${active === key ? colors.purple : colors.border}`,
              fontSize: 18,
              fontWeight: 900,
            }}
          >
            {index + 1}
          </div>
          <span style={{ color: active === key ? colors.text : colors.muted, fontSize: 20, fontWeight: 800 }}>{label}</span>
          {index < steps.length - 1 && <div style={{ width: 44, height: 2, background: colors.border }} />}
        </div>
      ))}
    </div>
  );
}

function Sidebar({ active }: { active: string }) {
  const items = ["Dashboard", "Projects", "Templates", "Voices", "Settings"];
  return (
    <aside style={{ width: 240, borderRight: `1px solid ${colors.border}`, padding: 22, background: "#fbfbfd" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
        <div style={{ width: 34, height: 34, borderRadius: 12, background: colors.purple }} />
        <strong style={{ fontSize: 22 }}>Blog2Video</strong>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {items.map((item) => {
          const isActive = active === item.toLowerCase();
          return (
            <div
              key={item}
              style={{
                borderRadius: 16,
                padding: "14px 16px",
                background: isActive ? colors.purpleSoft : "transparent",
                color: isActive ? colors.purpleDark : colors.softText,
                fontSize: 20,
                fontWeight: 800,
              }}
            >
              {item}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function AppWindow({ children, sidebarActive = "dashboard" }: { children: ReactNode; sidebarActive?: string }) {
  return (
    <div style={{ height: "100%", borderRadius: 34, overflow: "hidden", background: colors.panel, boxShadow: shadow, border: `1px solid ${colors.border}` }}>
      <div style={{ height: 54, display: "flex", alignItems: "center", gap: 10, padding: "0 20px", borderBottom: `1px solid ${colors.border}`, background: "#fff" }}>
        <span style={{ width: 14, height: 14, borderRadius: 999, background: colors.red }} />
        <span style={{ width: 14, height: 14, borderRadius: 999, background: colors.amber }} />
        <span style={{ width: 14, height: 14, borderRadius: 999, background: colors.green }} />
        <div style={{ marginLeft: 18, borderRadius: 999, background: colors.panelSoft, color: colors.muted, padding: "8px 18px", fontSize: 16, fontWeight: 700 }}>
          app.blog2video.com
        </div>
      </div>
      <div style={{ display: "flex", height: "calc(100% - 54px)" }}>
        <Sidebar active={sidebarActive} />
        <main style={{ flex: 1, padding: 26, background: colors.background }}>{children}</main>
      </div>
    </div>
  );
}

const TEMPLATE_IDS_BY_NAME: Record<string, string> = {
  Geometric: "default",
  Gridcraft: "gridcraft",
  Nightfall: "nightfall",
  Spotlight: "spotlight",
  Whiteboard: "whiteboard",
  Matrix: "matrix",
  Newspaper: "newspaper",
  Newscast: "newscast",
};

const DEMO_SCENE: Scene = {
  id: 3,
  project_id: 101,
  order: 3,
  title: "The key takeaway",
  narration_text: "This scene explains the key point in a shorter spoken sentence.",
  display_text: "AI search changes how readers discover answers.",
  visual_description: "Clean search interface with highlighted answer box",
  remotion_code: JSON.stringify({ layout: "statement" }),
  voiceover_path: "scene_3.mp3",
  duration_seconds: 7,
  extra_hold_seconds: 0,
  created_at: "2026-05-05T00:00:00Z",
};

const DEMO_PROJECT: Project = {
  id: 101,
  // Demo project has no real owner — it's shown to everyone. Sentinel id
  // never matches a real user, so `project.user_id === user?.id` is always
  // false (viewer is treated as a non-owner collaborator).
  user_id: -1,
  name: "AI Search Explainer",
  blog_url: "https://yourblog.com/how-ai-search-works",
  blog_content: null,
  status: "ready",
  template: "spotlight",
  voice_gender: "female",
  voice_accent: "american",
  accent_color: "#7C3AED",
  bg_color: "#FFFFFF",
  text_color: "#111827",
  animation_instructions: null,
  studio_unlocked: false,
  studio_port: null,
  player_port: null,
  r2_video_key: null,
  r2_video_url: null,
  logo_r2_url: null,
  logo_position: "bottom_right",
  logo_opacity: 0.9,
  logo_size: 1,
  custom_voice_id: null,
  voice_emotion: null,
  aspect_ratio: "landscape",
  video_style: "promotional",
  video_length: "medium",
  ai_assisted_editing_count: 0,
  created_at: "2026-05-05T00:00:00Z",
  updated_at: "2026-05-05T00:00:00Z",
  scenes: [DEMO_SCENE],
  assets: [],
};

function TemplateCard({
  name,
  active = false,
  custom = false,
}: {
  name: string;
  active?: boolean;
  custom?: boolean;
}) {
  const templateId = TEMPLATE_IDS_BY_NAME[name] ?? "default";
  const Preview = TEMPLATE_PREVIEWS[templateId];
  const description = TEMPLATE_DESCRIPTIONS[templateId];

  return (
    <Card active={active} style={{ padding: 14 }}>
      <div style={{ position: "relative", height: 120, borderRadius: 18, overflow: "hidden", background: colors.panelSoft }}>
        {Preview ? <Preview thumbnailMode /> : null}
        {custom ? <CustomTemplateBadge className="absolute right-2 top-2" /> : null}
      </div>
      <div style={{ marginTop: 12 }}>
        <strong style={{ display: "block", color: colors.text, fontSize: 20, lineHeight: 1.1 }}>
          {custom ? name : description?.title ?? name}
        </strong>
        <span style={{ display: "block", marginTop: 4, color: colors.muted, fontSize: 14, lineHeight: 1.25, fontWeight: 650 }}>
          {custom ? "Custom template" : description?.subtitle ?? "Template preview"}
        </span>
      </div>
    </Card>
  );
}

function CreateProjectScreen({ focus }: { focus: string }) {
  const activeStep = focus === "template" ? "template" : focus === "voice" ? "voice" : "source";
  return (
    <AppWindow sidebarActive="dashboard">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 22 }}>
        <div>
          <p style={eyebrowStyle}>Dashboard</p>
          <h3 style={screenTitleStyle}>Projects</h3>
        </div>
        <Button active={focus === "new"}>+ New</Button>
      </div>
      <Card style={{ minHeight: 640 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <div>
            <p style={eyebrowStyle}>New project</p>
            <h4 style={modalTitleStyle}>Create video from content</h4>
          </div>
          <Stepper active={activeStep} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.25fr 0.75fr", gap: 22 }}>
          <div style={{ display: "grid", gap: 18 }}>
            <Field label="Source URL" value="https://yourblog.com/how-ai-search-works" active={focus === "source"} />
            <Field label="Project name" value="AI Search Explainer" />
            <Card active={focus === "source"} style={{ background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={labelStyle}>Upload instead</p>
                <p style={smallTextStyle}>PDF, DOCX, PPTX, Markdown, or TXT</p>
              </div>
              <Button subtle>Choose file</Button>
            </Card>
            <div style={{ display: "flex", gap: 14 }}>
              <Pill>Short</Pill>
              <Pill active>Medium</Pill>
              <Pill>Detailed</Pill>
            </div>
          </div>
          <div style={{ display: "grid", gap: 18 }}>
            <TemplateCard name="Spotlight" active={focus === "template"} />
            <Card active={focus === "voice"}>
              <p style={labelStyle}>Voice</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <Pill active>Female</Pill>
                <Pill>American</Pill>
                <Pill>Preview</Pill>
              </div>
            </Card>
            <Button active={focus === "generate"}>Generate project</Button>
          </div>
        </div>
      </Card>
    </AppWindow>
  );
}

const HELP_PROJECT_TABS: ProjectTabItem[] = [
  { id: "scenes", label: "Scenes" },
  { id: "script", label: "Script" },
  { id: "images", label: "Images" },
  { id: "audio", label: "Audio" },
  { id: "settings", label: "Settings" },
];

function ProjectTabs({ active }: { active: ProjectTabId }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <SharedProjectTabs tabs={HELP_PROJECT_TABS} active={active} onChange={() => undefined} size="lg" />
    </div>
  );
}

function HelpSceneCard({ active = false }: { active?: boolean }) {
  return (
    <Card active={active} style={{ padding: 0, overflow: "hidden", background: "#fff" }}>
      <div style={{ transform: "scale(1.38)", transformOrigin: "top left", width: "72.5%" }}>
        <ProductSceneCard scene={DEMO_SCENE} />
      </div>
      <div style={{ padding: "0 18px 18px", display: "flex", justifyContent: "end" }}>
        <Button active={active}>Edit</Button>
      </div>
    </Card>
  );
}

function SceneEditorScreen({ focus }: { focus: string }) {
  return (
    <AppWindow sidebarActive="projects">
      <p style={eyebrowStyle}>Project</p>
      <h3 style={screenTitleStyle}>AI Search Explainer</h3>
      <ProjectTabs active={focus === "tab" || focus === "project" ? "scenes" : "scenes"} />
      <div style={{ display: "grid", gap: 14 }}>
        <HelpSceneCard />
        <HelpSceneCard active={focus === "editor"} />
        <HelpSceneCard />
      </div>
      <div style={{ position: "absolute", inset: "190px 110px 60px 500px", pointerEvents: "none" }}>
        <Card active={focus === "fields" || focus === "save"} style={{ boxShadow: shadow, pointerEvents: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <p style={eyebrowStyle}>Scene editor</p>
              <h4 style={modalTitleStyle}>Edit scene 3</h4>
            </div>
            <Pill active>Manual edit</Pill>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Display text" value="AI search changes how readers discover answers." active={focus === "fields"} large />
            <Field label="Narration" value="This scene explains the key point in a shorter spoken sentence." active={focus === "fields"} large />
            <Field label="Layout" value="Statement" active={focus === "fields"} />
            <Field label="Image prompt" value="Clean search interface with highlighted answer box" active={focus === "fields"} />
          </div>
          <div style={{ marginTop: 18, display: "flex", justifyContent: "end" }}>
            <Button active={focus === "save"}>Save changes</Button>
          </div>
        </Card>
      </div>
    </AppWindow>
  );
}

function VoiceScreen({ focus }: { focus: string }) {
  return (
    <AppWindow sidebarActive={focus === "voice" || focus === "preview" ? "dashboard" : "projects"}>
      <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 22 }}>
        <Card active={focus === "voice" || focus === "preview"} style={{ minHeight: 650 }}>
          <p style={eyebrowStyle}>Wizard voice step</p>
          <h4 style={modalTitleStyle}>Choose narration</h4>
          <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
            <Card active={focus === "voice"} style={{ padding: 10 }}>
              <VoiceItem
                name="Rachel"
                subtitle="Female - American - clear product narration"
                hasPreview
                isPlaying={focus === "preview"}
                onPlay={() => undefined}
                isSelected
                actions={<Pill active>Selected</Pill>}
              />
            </Card>
            <Card active={focus === "preview"} style={{ padding: 10 }}>
              <VoiceItem
                name="Preview with project text"
                subtitle="Listen before generating"
                hasPreview
                isPlaying={focus === "preview"}
                onPlay={() => undefined}
                actions={<Button active={focus === "preview"}>Preview</Button>}
              />
            </Card>
            <Pill>No voiceover</Pill>
          </div>
        </Card>
        <Card active={focus === "scene" || focus === "script" || focus === "regenerate"} style={{ minHeight: 650 }}>
          <p style={eyebrowStyle}>Scene-level fix</p>
          <h4 style={modalTitleStyle}>Regenerate one voiceover</h4>
          <div style={{ marginTop: 18, display: "grid", gap: 16 }}>
            <HelpSceneCard active={focus === "scene"} />
            <Field label="Narration text" value="Rewrite this line so it sounds natural when spoken aloud." active={focus === "script"} large />
            <Card active={focus === "regenerate"} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong style={{ fontSize: 22 }}>Regenerate voiceover</strong>
                <p style={smallTextStyle}>Updates audio for this scene only</p>
              </div>
              <Pill active>On</Pill>
            </Card>
          </div>
        </Card>
      </div>
    </AppWindow>
  );
}

function CustomTemplateScreen({ focus }: { focus: string }) {
  return (
    <AppWindow sidebarActive="templates">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <p style={eyebrowStyle}>My Templates</p>
          <h3 style={screenTitleStyle}>Brand template library</h3>
        </div>
        <Button active={focus === "craft"}>Craft custom template</Button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1.2fr", gap: 22 }}>
        <div style={{ display: "grid", gap: 16 }}>
          <TemplateCard name="Geometric" />
          <TemplateCard name="Your Brand" active={focus === "library"} custom />
        </div>
        <Card active={focus === "extract" || focus === "style" || focus === "save"} style={{ minHeight: 600 }}>
          <p style={eyebrowStyle}>Custom template creator</p>
          <h4 style={modalTitleStyle}>Build from your brand</h4>
          <div style={{ marginTop: 18, display: "grid", gap: 16 }}>
            <Field label="Reference website" value="https://yourbrand.com" active={focus === "extract"} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <Card active={focus === "style"} style={{ background: "#7c3aed", color: "#fff" }}><strong>Accent</strong><br />#7C3AED</Card>
              <Card active={focus === "style"}><strong>Typography</strong><br /><span style={smallTextStyle}>Inter + display font</span></Card>
              <Card active={focus === "style"}><strong>Radius</strong><br /><span style={smallTextStyle}>Rounded cards</span></Card>
            </div>
            <TemplateCard name="Live preview" active={focus === "style"} />
            <Button active={focus === "save"}>Create template</Button>
          </div>
        </Card>
      </div>
    </AppWindow>
  );
}

function AppNavbar() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 32px",
        borderBottom: `1px solid ${colors.border}`,
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: colors.purple }} />
        <strong style={{ fontSize: 20, color: colors.text, letterSpacing: -0.2 }}>Blog2Video</strong>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
        {["Dashboard", "Templates", "Voices"].map((label) => (
          <span key={label} style={{ color: colors.softText, fontSize: 17, fontWeight: 700 }}>{label}</span>
        ))}
        <div style={{ width: 36, height: 36, borderRadius: 999, background: colors.purpleSoft, color: colors.purpleDark, fontSize: 15, fontWeight: 900, display: "grid", placeItems: "center" }}>
          AS
        </div>
      </div>
    </div>
  );
}

function BrowserStage({
  url,
  children,
}: {
  url: string;
  children: ReactNode;
}) {
  return (
    <div style={{ height: "100%", borderRadius: 34, overflow: "hidden", background: colors.panel, boxShadow: shadow, border: `1px solid ${colors.border}` }}>
      <div style={{ height: 54, display: "flex", alignItems: "center", gap: 10, padding: "0 20px", borderBottom: `1px solid ${colors.border}`, background: "#fff" }}>
        <span style={{ width: 14, height: 14, borderRadius: 999, background: colors.red }} />
        <span style={{ width: 14, height: 14, borderRadius: 999, background: colors.amber }} />
        <span style={{ width: 14, height: 14, borderRadius: 999, background: colors.green }} />
        <div style={{ marginLeft: 18, borderRadius: 999, background: colors.panelSoft, color: colors.muted, padding: "8px 18px", fontSize: 16, fontWeight: 700 }}>
          {url}
        </div>
      </div>
      <div style={{ height: "calc(100% - 54px)", display: "flex", flexDirection: "column", background: colors.background, overflow: "hidden" }}>
        <AppNavbar />
        <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function ChangeTemplateScreen({ focus }: { focus: string }) {
  const pickerOpen = focus === "change-template" || focus === "confirm" || focus === "review";
  const cardFakePreview = <HelpFakeTemplatePreview templateId="nightfall" thumbnail />;

  const tabsHighlighted = focus === "settings-tab";

  return (
    <BrowserStage url="app.blog2video.com/project/142">
      <div style={{ padding: 32, position: "relative" }}>
        <p style={eyebrowStyle}>Project</p>
        <h3 style={screenTitleStyle}>AI Search Explainer</h3>
        <div
          style={{
            display: "inline-block",
            marginTop: 14,
            marginBottom: 22,
            padding: 4,
            borderRadius: 14,
            background: tabsHighlighted ? "rgba(124, 58, 237, 0.10)" : "transparent",
            boxShadow: tabsHighlighted ? "0 0 0 3px rgba(124, 58, 237, 0.18)" : "none",
            transition: "all 200ms ease",
          }}
        >
          <ProjectTabs active="settings" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
          <Card>
            <h4 style={{ margin: 0, color: colors.text, fontSize: 24 }}>Font family</h4>
            <p style={{ ...smallTextStyle, marginTop: 6 }}>Leave as Default to use the template's built-in fonts.</p>
            <Field label="Font family" value="Default (template)" />
            <div style={{ marginTop: 16, display: "flex", justifyContent: "end" }}>
              <Button subtle>Save font</Button>
            </div>
          </Card>
          <div
            style={{
              border: focus === "generation-menu" || focus === "change-template" ? `2px solid ${colors.purple}` : `2px solid ${colors.border}`,
              borderRadius: 24,
              background: colors.panel,
              padding: 22,
              ...focusStyle(focus === "generation-menu" || focus === "change-template"),
            }}
          >
            <ProjectTemplateSettingsCard
              templateId="nightfall"
              customTemplates={[]}
              projectCustomTheme={null}
              projectName="AI Search Explainer"
              templateMetas={[]}
              emphasizeChangeButton={focus === "change-template"}
              previewOverride={cardFakePreview}
              onChangeTemplate={() => undefined}
            />
          </div>
          <Card>
            <h4 style={{ margin: 0, color: colors.text, fontSize: 24 }}>Global Text Sizes</h4>
            <p style={{ ...smallTextStyle, marginTop: 6 }}>Applied to all scenes at once.</p>
            <Field label="Title font size" value="84" />
            <Field label="Display text size" value="42" />
          </Card>
          <Card>
            <h4 style={{ margin: 0, color: colors.text, fontSize: 24 }}>Colors</h4>
            <p style={{ ...smallTextStyle, marginTop: 6 }}>Theme colors applied across all scenes.</p>
            <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
              {[
                ["Accent color", "#7C3AED"],
                ["Text color", "#111827"],
                ["Background color", "#F8FAFC"],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
                  <span style={{ color: colors.softText, fontSize: 18, fontWeight: 750 }}>{label}</span>
                  <span style={{ color: colors.text, fontSize: 17, fontWeight: 800 }}>{value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
        {pickerOpen ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(15, 23, 42, 0.28)",
              backdropFilter: "blur(8px)",
              padding: 22,
            }}
          >
            <div style={{ width: "100%", display: "flex", justifyContent: "center", transform: "scale(1.05)" }}>
              <TemplateChangePickerDemo tab={focus === "review" ? "custom" : "builtin"} />
            </div>
          </div>
        ) : null}
      </div>
    </BrowserStage>
  );
}

function HelpVideoStage({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div style={{ height: "100%", borderRadius: 34, overflow: "hidden", background: colors.panel, boxShadow: shadow, border: `1px solid ${colors.border}` }}>
      <div style={{ height: 54, display: "flex", alignItems: "center", gap: 10, padding: "0 20px", borderBottom: `1px solid ${colors.border}`, background: "#fff" }}>
        <span style={{ width: 14, height: 14, borderRadius: 999, background: colors.red }} />
        <span style={{ width: 14, height: 14, borderRadius: 999, background: colors.amber }} />
        <span style={{ width: 14, height: 14, borderRadius: 999, background: colors.green }} />
        <div style={{ marginLeft: 18, borderRadius: 999, background: colors.panelSoft, color: colors.muted, padding: "8px 18px", fontSize: 16, fontWeight: 700 }}>
          app.blog2video.com
        </div>
      </div>
      <div
        style={{
          position: "relative",
          height: "calc(100% - 54px)",
          minHeight: 660,
          background: "linear-gradient(135deg, #f8fafc 0%, #f5f3ff 46%, #eef2ff 100%)",
          padding: 28,
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, opacity: 0.42 }}>
          <div>
            <p style={eyebrowStyle}>Blog2Video</p>
            <h3 style={screenTitleStyle}>Workspace</h3>
          </div>
          <Button>+ New</Button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18, opacity: 0.28 }}>
          {["Recent project", "Templates", "Voices"].map((label) => (
            <Card key={label} style={{ minHeight: 150 }}>
              <p style={labelStyle}>{label}</p>
              <div style={{ marginTop: 18, height: 18, width: "72%", borderRadius: 999, background: "#e5e7eb" }} />
              <div style={{ marginTop: 10, height: 14, width: "48%", borderRadius: 999, background: "#ede9fe" }} />
            </Card>
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(15, 23, 42, 0.24)",
            backdropFilter: "blur(8px)",
            padding: 22,
          }}
        >
          <div style={{ width: "100%", display: "flex", justifyContent: "center", transform: "scale(1.18)" }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

const HELP_DEMO_SCENES: Scene[] = [
  {
    id: 1,
    project_id: 101,
    order: 1,
    title: "How AI search reshapes discovery",
    narration_text: "AI search is changing how people find answers, summarising results instead of just linking to them.",
    display_text: "AI search is changing how people find answers.",
    visual_description: "Search bar with floating answer card",
    remotion_code: JSON.stringify({ layout: "statement" }),
    voiceover_path: "scene_1.mp3",
    duration_seconds: 6,
    extra_hold_seconds: 0,
    created_at: "2026-05-05T00:00:00Z",
  },
  DEMO_SCENE,
  {
    id: 5,
    project_id: 101,
    order: 5,
    title: "What this means for SEO",
    narration_text: "Optimising for AI answers means writing content that is easy for models to extract and cite.",
    display_text: "Write content that AI can extract and cite.",
    visual_description: "Diagram of a model citing a blog post",
    remotion_code: JSON.stringify({ layout: "statement" }),
    voiceover_path: "scene_5.mp3",
    duration_seconds: 8,
    extra_hold_seconds: 0,
    created_at: "2026-05-05T00:00:00Z",
  },
];

function ProjectScenesHelpStage({
  focus,
}: {
  focus: string;
}) {
  const showCards = focus !== "tab";
  const showModal = focus === "fields" || focus === "save";
  const highlightEdit = focus === "editor";
  const tabsHighlighted = focus === "tab";

  return (
    <BrowserStage url="app.blog2video.com/project/142">
      <div style={{ padding: 32, position: "relative", minHeight: 660 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 22 }}>
          <div>
            <p style={eyebrowStyle}>Project</p>
            <h3 style={screenTitleStyle}>AI Search Explainer</h3>
          </div>
          <Button subtle>Render video</Button>
        </div>
        <div
          style={{
            display: "inline-block",
            marginBottom: 22,
            padding: 4,
            borderRadius: 18,
            background: tabsHighlighted ? "rgba(124, 58, 237, 0.10)" : "transparent",
            boxShadow: tabsHighlighted ? "0 0 0 3px rgba(124, 58, 237, 0.18)" : "none",
            transition: "all 200ms ease",
          }}
        >
          <ProjectTabs active="scenes" />
        </div>
        {showCards ? (
          <div className="space-y-2" style={{ pointerEvents: "none" }}>
            {HELP_DEMO_SCENES.map((scene, i) => (
              <SceneListRow
                key={scene.id}
                scene={scene}
                index={i}
                expanded={false}
                showAudio
                highlightEdit={highlightEdit && scene.id === DEMO_SCENE.id}
                onToggleExpand={() => undefined}
                onEdit={() => undefined}
                onDelete={() => undefined}
              />
            ))}
          </div>
        ) : (
          <Card style={{ minHeight: 420, display: "grid", placeItems: "center", color: colors.muted }}>
            <div style={{ textAlign: "center" }}>
              <strong style={{ display: "block", color: colors.text, fontSize: 28 }}>Scenes tab</strong>
              <p style={{ margin: "10px 0 0", fontSize: 20 }}>Open this tab to review and edit each generated scene.</p>
            </div>
          </Card>
        )}

        {showModal ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(15, 23, 42, 0.28)",
              backdropFilter: "blur(8px)",
              padding: 22,
              pointerEvents: "none",
            }}
          >
            <div style={{ width: "100%", height: "100%", position: "relative" }}>
              <SceneEditModal
                open
                onClose={() => undefined}
                scene={DEMO_SCENE}
                project={DEMO_PROJECT}
                imageItems={[]}
                availableImageItems={[]}
                onSaved={() => undefined}
                demoMode={{ editMode: "manual" }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </BrowserStage>
  );
}

function VoiceCreationDemoModal({ focus }: { focus: string }) {
  const cloneActive = focus === "clone";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(15, 23, 42, 0.28)",
        backdropFilter: "blur(8px)",
        padding: 28,
      }}
    >
      <Card active={cloneActive} style={{ width: 650, padding: 28, boxShadow: shadow }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <h4 style={modalTitleStyle}>Create custom voice</h4>
          <span style={{ color: colors.muted, fontSize: 24, fontWeight: 700 }}>x</span>
        </div>
        <p style={{ ...smallTextStyle, marginBottom: 12 }}>Choose one way to create your voice:</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, padding: 6, background: colors.panelSoft, borderRadius: 18, marginBottom: 20 }}>
          <Pill active={false}>Build from options</Pill>
          <Pill active={false}>Describe in your own words</Pill>
          <Pill active={cloneActive}>Voice clone</Pill>
        </div>
        <div>
          <p style={labelStyle}>Voice clone</p>
          <p style={{ ...smallTextStyle, marginTop: 6 }}>
            Upload an audio or video file, about 2 minutes. Record in a quiet space and speak clearly.
          </p>
          <Field label="Voice name" value="My cloned voice" active={cloneActive} />
          <Card active={cloneActive} style={{ marginTop: 14, borderStyle: "dashed", textAlign: "center", background: colors.panelSoft }}>
            <div style={{ width: 58, height: 58, margin: "0 auto 12px", borderRadius: 18, display: "grid", placeItems: "center", background: colors.purpleSoft, color: colors.purpleDark, fontSize: 28, fontWeight: 900 }}>
              mic
            </div>
            <strong style={{ display: "block", fontSize: 20, color: colors.text }}>Upload an audio or video file</strong>
            <p style={{ ...smallTextStyle, marginTop: 6 }}>MP3, WAV, M4A, MP4, or MOV</p>
          </Card>
          <Card active={cloneActive} style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", padding: 16 }}>
            <span style={{ fontSize: 18, color: colors.softText, fontWeight: 750 }}>Remove background sound</span>
            <Pill active>On</Pill>
          </Card>
          <div style={{ marginTop: 18, display: "flex", justifyContent: "end", gap: 12 }}>
            <Button subtle>Cancel</Button>
            <Button active={cloneActive}>Create voice</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

const HELP_DEMO_MY_VOICES_LIST: SavedVoiceFromAPI[] = [
  {
    id: 1001,
    voice_id: "demo_my_narrator",
    name: "My Narrator",
    preview_url: null,
    source: "custom",
    custom_voice_id: 501,
    gender: "male",
    accent: "british",
  } as SavedVoiceFromAPI,
  {
    id: 1002,
    voice_id: "demo_rachel",
    name: "Rachel",
    preview_url: null,
    source: "elevenlabs",
    gender: "female",
    accent: "american",
  } as SavedVoiceFromAPI,
];

function MyVoicesDashboardStage({ focus }: { focus: string }) {
  const demoMode = useMemo<MyVoicesDemoMode>(
    () => ({
      showCreateModal: focus === "add-voice" || focus === "clone",
      createMode: focus === "clone" ? "clone" : focus === "add-voice" ? "form" : "form",
      myVoicesData: HELP_DEMO_MY_VOICES_LIST,
      customVoicesData: [],
      prebuiltVoicesData: [],
    }),
    [focus]
  );

  return (
    <div style={{ height: "100%", borderRadius: 34, overflow: "hidden", background: colors.panel, boxShadow: shadow, border: `1px solid ${colors.border}` }}>
      <div style={{ height: 54, display: "flex", alignItems: "center", gap: 10, padding: "0 20px", borderBottom: `1px solid ${colors.border}`, background: "#fff" }}>
        <span style={{ width: 14, height: 14, borderRadius: 999, background: colors.red }} />
        <span style={{ width: 14, height: 14, borderRadius: 999, background: colors.amber }} />
        <span style={{ width: 14, height: 14, borderRadius: 999, background: colors.green }} />
        <div style={{ marginLeft: 18, borderRadius: 999, background: colors.panelSoft, color: colors.muted, padding: "8px 18px", fontSize: 16, fontWeight: 700 }}>
          app.blog2video.com/my-voices
        </div>
      </div>
      <div style={{ position: "relative", height: "calc(100% - 54px)", minHeight: 660, background: colors.background, padding: 32, overflow: "auto", pointerEvents: "none" }}>
        <MyVoices demoMode={demoMode} />
      </div>
    </div>
  );
}

const HELP_DEMO_TEMPLATES: TemplateMeta[] = [
  {
    id: "spotlight",
    name: "Spotlight",
    description: "Editorial focus with a single hero subject.",
    styles: ["explainer", "promotional"],
    preview_colors: { accent: "#7C3AED", bg: "#0F172A", text: "#F8FAFC" },
  },
  {
    id: "nightfall",
    name: "Nightfall",
    description: "Dark cinematic blog explainer style.",
    styles: ["storytelling"],
    preview_colors: { accent: "#A855F7", bg: "#0B1120", text: "#FFFFFF" },
  },
  {
    id: "gridcraft",
    name: "Gridcraft",
    description: "Crisp grid layout for product walkthroughs.",
    styles: ["explainer"],
    preview_colors: { accent: "#2563EB", bg: "#F8FAFC", text: "#0F172A" },
  },
  {
    id: "default",
    name: "Geometric Explainer",
    description: "Default geometric explainer template.",
    styles: ["explainer", "storytelling"],
    preview_colors: { accent: "#7C3AED", bg: "#FFFFFF", text: "#111827" },
  },
];

const HELP_DEMO_CUSTOM_TEMPLATES: CustomTemplateItem[] = [];
const HELP_DEMO_MY_VOICES: SavedVoiceFromAPI[] = [];
const HELP_DEMO_VOICE_PREVIEWS: Record<string, VoicePreview> = {};

function fakeTemplatePreview({
  templateId,
  thumbnail,
}: {
  templateId: string;
  selected: boolean;
  thumbnail: boolean;
}) {
  return <HelpFakeTemplatePreview templateId={templateId} thumbnail={thumbnail} />;
}

function buildCreateProjectDemoMode(focus: string): BlogUrlFormDemoMode {
  const step: 1 | 2 | 3 = focus === "template" ? 2 : focus === "voice" || focus === "generate" ? 3 : 1;
  return {
    step,
    url: "https://yourblog.com/how-ai-search-works",
    name: "AI Search Explainer",
    videoLength: "medium",
    template: "spotlight",
    videoStyle: "promotional",
    voiceGender: "female",
    voiceAccent: "american",
    templatesData: HELP_DEMO_TEMPLATES,
    customTemplatesData: HELP_DEMO_CUSTOM_TEMPLATES,
    myVoicesData: HELP_DEMO_MY_VOICES,
    voicePreviewsData: HELP_DEMO_VOICE_PREVIEWS,
    templatePreviewOverride: fakeTemplatePreview,
  };
}

function CreateProjectHelpStage({ focus }: { focus: string }) {
  const demoMode = useMemo(() => buildCreateProjectDemoMode(focus), [focus]);
  return (
    <div style={{ height: "100%", borderRadius: 34, overflow: "hidden", background: colors.panel, boxShadow: shadow, border: `1px solid ${colors.border}` }}>
      <div style={{ height: 54, display: "flex", alignItems: "center", gap: 10, padding: "0 20px", borderBottom: `1px solid ${colors.border}`, background: "#fff" }}>
        <span style={{ width: 14, height: 14, borderRadius: 999, background: colors.red }} />
        <span style={{ width: 14, height: 14, borderRadius: 999, background: colors.amber }} />
        <span style={{ width: 14, height: 14, borderRadius: 999, background: colors.green }} />
        <div style={{ marginLeft: 18, borderRadius: 999, background: colors.panelSoft, color: colors.muted, padding: "8px 18px", fontSize: 16, fontWeight: 700 }}>
          app.blog2video.com/dashboard
        </div>
      </div>
      <div
        style={{
          position: "relative",
          height: "calc(100% - 54px)",
          minHeight: 660,
          background: "linear-gradient(135deg, #f8fafc 0%, #f5f3ff 46%, #eef2ff 100%)",
          padding: 28,
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, opacity: 0.42 }}>
          <div>
            <p style={eyebrowStyle}>Dashboard</p>
            <h3 style={screenTitleStyle}>Projects</h3>
          </div>
          <Button active={focus === "new"}>+ New</Button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18, opacity: 0.28 }}>
          {["Recent project", "Templates", "Voices"].map((label) => (
            <Card key={label} style={{ minHeight: 150 }}>
              <p style={labelStyle}>{label}</p>
              <div style={{ marginTop: 18, height: 18, width: "72%", borderRadius: 999, background: "#e5e7eb" }} />
              <div style={{ marginTop: 10, height: 14, width: "48%", borderRadius: 999, background: "#ede9fe" }} />
            </Card>
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(15, 23, 42, 0.24)",
            backdropFilter: "blur(8px)",
            padding: 22,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: "min(620px, 92%)",
              background: "rgba(255, 255, 255, 0.94)",
              border: `1px solid ${colors.border}`,
              borderRadius: 24,
              boxShadow: shadow,
              padding: 28,
              maxHeight: "92%",
              overflow: "auto",
              transform: "scale(1.05)",
              transformOrigin: "top center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <h2 style={{ ...modalTitleStyle, fontSize: 24 }}>New Project</h2>
              <span style={{ color: colors.muted, fontSize: 22, fontWeight: 700 }}>x</span>
            </div>
            <BlogUrlForm
              onSubmit={async () => undefined}
              asModal={false}
              demoMode={demoMode}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductScreen({ flowKey, focus }: { flowKey: HelpFlowKey; focus: string }) {
  if (flowKey === "create-project") {
    return <CreateProjectHelpStage focus={focus} />;
  }

  if (flowKey === "edit-scene") {
    return <ProjectScenesHelpStage focus={focus} />;
  }

  if (flowKey === "change-voiceover") {
    if (focus === "my-voices" || focus === "add-voice" || focus === "clone") {
      return <MyVoicesDashboardStage focus={focus} />;
    }
    const seDemoMode: SceneEditModalDemoMode = {
      editMode: "ai",
      regenerateVoiceover: focus === "regenerate",
    };
    return (
      <HelpVideoStage>
        <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 600 }}>
          <SceneEditModal
            open
            onClose={() => undefined}
            scene={DEMO_SCENE}
            project={DEMO_PROJECT}
            imageItems={[]}
            availableImageItems={[]}
            onSaved={() => undefined}
            demoMode={seDemoMode}
          />
        </div>
      </HelpVideoStage>
    );
  }

  if (flowKey === "custom-template") {
    const ctStep: 1 | 2 = focus === "extract" || focus === "craft" || focus === "library" ? 1 : 2;
    const ctDemoMode: CustomTemplateCreatorDemoMode = {
      step: ctStep,
      url: ctStep === 1 ? "https://yourbrand.com" : undefined,
      templateName: "Your Brand Template",
      sourceUrl: "https://yourbrand.com",
      accentColor: "#7C3AED",
    };
    return (
      <HelpVideoStage>
        <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 600 }}>
          <CustomTemplateCreator
            onCreated={() => undefined}
            onCancel={() => undefined}
            demoMode={ctDemoMode}
          />
        </div>
      </HelpVideoStage>
    );
  }

  return <ChangeTemplateScreen focus={focus} />;
}

function HelpDemoComposition({ flowKey }: { flowKey: HelpFlowKey }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const flow = HELP_FLOWS[flowKey];
  const framesPerScene = fps * 4;
  const sceneIndex = Math.min(Math.floor(frame / framesPerScene), flow.scenes.length - 1);
  const scene = flow.scenes[sceneIndex];
  const localFrame = frame - sceneIndex * framesPerScene;
  const entrance = spring({ frame: localFrame, fps, config: { damping: 18, stiffness: 140 } });
  const progress = interpolate(localFrame, [0, framesPerScene - 8], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: colors.background, padding: 44, fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ display: "grid", gridTemplateRows: "auto 1fr", gap: 28, height: "100%" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={eyebrowStyle}>{flow.productArea}</p>
            <h2 style={{ margin: "6px 0 0", color: colors.text, fontSize: 48, fontWeight: 950, letterSpacing: -1 }}>
              {flow.title}
            </h2>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {flow.scenes.map((step, index) => (
              <div key={step.label} style={{ width: 90, height: 8, borderRadius: 999, background: index < sceneIndex ? colors.purple : "#e9d5ff", overflow: "hidden" }}>
                {index === sceneIndex && <div style={{ width: `${progress * 100}%`, height: "100%", background: colors.purple }} />}
              </div>
            ))}
          </div>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 440px", gap: 28, minHeight: 0 }}>
          <div style={{ position: "relative", transform: `translateY(${interpolate(entrance, [0, 1], [16, 0])}px)`, opacity: entrance }}>
            <ProductScreen flowKey={flowKey} focus={scene.focus} />
          </div>
          <aside style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <Card active style={{ boxShadow: shadow }}>
              <p style={{ ...eyebrowStyle, marginBottom: 12 }}>{flow.subtitle}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                <div style={{ width: 54, height: 54, borderRadius: 18, background: colors.purple, color: "#fff", display: "grid", placeItems: "center", fontSize: 22, fontWeight: 950 }}>
                  {sceneIndex + 1}
                </div>
                <div>
                  <p style={{ margin: 0, color: colors.purpleDark, fontSize: 22, fontWeight: 950 }}>{scene.label}</p>
                  <h3 style={{ margin: "2px 0 0", color: colors.text, fontSize: 34, lineHeight: 1.05 }}>{scene.title}</h3>
                </div>
              </div>
              <p style={{ margin: 0, color: colors.softText, fontSize: 24, lineHeight: 1.35, fontWeight: 650 }}>
                {scene.note}
              </p>
            </Card>
            <Card style={{ background: "#fff" }}>
              <p style={eyebrowStyle}>How to follow along</p>
              <p style={{ margin: 0, color: colors.softText, fontSize: 22, lineHeight: 1.38 }}>
                Watch the highlighted control, then repeat the same action in Blog2Video. The purple outline marks the exact UI area for this step.
              </p>
            </Card>
          </aside>
        </div>
      </div>
    </AbsoluteFill>
  );
}

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: colors.purple,
  letterSpacing: 2.4,
  textTransform: "uppercase",
  fontSize: 16,
  fontWeight: 950,
};

const labelStyle: CSSProperties = {
  margin: 0,
  color: colors.muted,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  fontSize: 14,
  fontWeight: 900,
};

const screenTitleStyle: CSSProperties = {
  margin: "4px 0 0",
  color: colors.text,
  fontSize: 36,
  fontWeight: 950,
  letterSpacing: -0.4,
};

const modalTitleStyle: CSSProperties = {
  margin: "4px 0 0",
  color: colors.text,
  fontSize: 30,
  fontWeight: 950,
  letterSpacing: -0.2,
};

const smallTextStyle: CSSProperties = {
  margin: "6px 0 0",
  color: colors.muted,
  fontSize: 17,
  lineHeight: 1.35,
  fontWeight: 650,
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
    <div className="my-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
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
          <div className="flex h-full w-full items-center justify-center bg-white text-sm text-gray-500">
            Loading help explainer...
          </div>
        )}
      </div>
    </div>
  );
}
