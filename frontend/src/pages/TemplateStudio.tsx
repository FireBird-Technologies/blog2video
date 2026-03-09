import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { Player } from "@remotion/player";
import {
  applyTemplateAiPreview,
  discardTemplateAiPreview,
  getTemplates,
  startTemplateAiPreview,
  saveTemplateSourceDefaults,
  type LayoutPropField,
  type LayoutPropSchema,
  type TemplateMeta,
} from "../api/client";
import { getTemplateConfig } from "../components/remotion/templateConfig";
import ManifestPropEditor from "../components/template-studio/ManifestPropEditor";

type AspectRatio = "landscape" | "portrait";
type ResponsiveValue = { portrait: number; landscape: number };

function isResponsiveValue(value: unknown): value is ResponsiveValue {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.portrait === "number" && typeof v.landscape === "number";
}

function normalizeTemplateId(templateId: string): string {
  return (templateId || "").trim().toLowerCase();
}

function humanize(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function getSchema(
  template: TemplateMeta | null,
  layoutId: string | null
): LayoutPropSchema | undefined {
  if (!template || !layoutId) return undefined;
  const explicit = template.layout_prop_schema?.[layoutId];
  if (explicit) return explicit;

  const responsiveFields: LayoutPropField[] = [
    { key: "titleFontSize", label: "Title Font Size", type: "number", responsive: true, min: 20, max: 180, step: 1 },
    { key: "descriptionFontSize", label: "Description Font Size", type: "number", responsive: true, min: 12, max: 100, step: 1 },
  ];

  return {
    label: humanize(layoutId),
    defaults: {
      titleFontSize: { portrait: 56, landscape: 76 },
      descriptionFontSize: { portrait: 24, landscape: 34 },
    },
    fields: responsiveFields,
  };
}

// ─── Design tokens ────────────────────────────────────────────────────────────
// Font stack pulled from the attached layout component (Geist/system ui-sans-serif)
const FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", "Geist", ui-sans-serif, system-ui, sans-serif`;

const T = {
  bg:           "#ffffff",
  surface:      "#ffffff",
  surfaceAlt:   "#f9fafb",
  border:       "#e5e7eb",
  borderStrong: "#d1d5db",
  accent:       "#9333ea",
  accentLight:  "#faf5ff",
  accentMid:    "#c084fc",
  accentDark:   "#7e22ce",
  text:         "#111827",
  textSub:      "#6b7280",
  textMuted:    "#9ca3af",
  green:        "#16a34a",
  greenBg:      "#f0fdf4",
  greenBorder:  "#bbf7d0",
};

// ─── Icons ────────────────────────────────────────────────────────────────────
const Svg = ({ d, size = 14 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const IconGrid    = ({ size }: { size?: number } = {}) => <Svg d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" size={size} />;
const IconLayout  = ({ size }: { size?: number } = {}) => <Svg d="M3 3h18v18H3zM3 9h18M9 21V9" size={size} />;
const IconType    = ({ size }: { size?: number } = {}) => <Svg d="M4 7V4h16v3M9 20h6M12 4v16" size={size} />;
const IconLink    = ({ size }: { size?: number } = {}) => <Svg d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" size={size} />;
const IconDroplet = ({ size }: { size?: number } = {}) => <Svg d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" size={size} />;
const IconReset   = ({ size }: { size?: number } = {}) => <Svg d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5" size={size} />;
const IconSliders = ({ size }: { size?: number } = {}) => <Svg d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" size={size} />;
const IconWand    = ({ size }: { size?: number } = {}) => <Svg d="M15 4V2M15 6v2M21 10h-2M7 10H5M18.3 6.7l-1.4-1.4M11.1 13.9l-7 7 1.4 1.4 7-7M11.7 6.7l1.4-1.4M18.9 13.9l1.4 1.4" size={size} />;
const IconClock   = ({ size }: { size?: number } = {}) => <Svg d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zM12 6v6l4 2" size={size} />;
const IconSave    = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/>
    <polyline points="7 3 7 8 15 8"/>
  </svg>
);
const IconEdit = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const IconX = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconChevronDown = ({ open }: { open: boolean }) => (
  <svg
    width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}
  >
    <path d="M19 9l-7 7-7-7" />
  </svg>
);
const IconChevronCollapse = ({ open }: { open: boolean }) => (
  <svg
    width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
);

// ─── Base input style ─────────────────────────────────────────────────────────
const inputBase: React.CSSProperties = {
  width: "100%", padding: "7px 10px",
  background: T.surfaceAlt, border: `1px solid ${T.border}`,
  borderRadius: "8px", color: T.text,
  fontSize: "13px", fontFamily: FONT,
  outline: "none", boxSizing: "border-box",
  transition: "border-color 0.15s, box-shadow 0.15s",
};

// ─── Primitives ───────────────────────────────────────────────────────────────
function FieldLabel({ children }: { children: string }) {
  return (
    <label style={{ display: "block", fontSize: "11px", fontWeight: 500, color: T.textMuted, marginBottom: "5px", letterSpacing: "0.02em", fontFamily: FONT, textTransform: "uppercase" }}>
      {children}
    </label>
  );
}

function SectionLabel({ icon, children }: { icon: React.ReactNode; children: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
      <span style={{ color: T.accentMid }}>{icon}</span>
      <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: T.textSub, fontFamily: FONT }}>
        {children}
      </span>
    </div>
  );
}

function StudioInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="studio-input" style={inputBase} />;
}

function StudioTextarea({ value, onChange, rows = 3 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className="studio-input" style={{ ...inputBase, resize: "vertical" as const, lineHeight: "1.6" }} />;
}

// ─── Custom Dropdown — pill + chevron + popover (matches attached layout code) ─
function StudioDropdown({
  value, onChange, options, sectionLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  sectionLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedLabel = options.find((o) => o.value === value)?.label || humanize(value);

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <h4 style={{
        fontSize: "11px", fontWeight: 500, color: T.textMuted,
        textTransform: "uppercase", letterSpacing: "0.06em",
        marginBottom: "6px", fontFamily: FONT,
      }}>
        {sectionLabel}
      </h4>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{
          display: "inline-block", padding: "4px 10px",
          background: T.accentLight, color: T.accent,
          borderRadius: "8px", fontSize: "12px", fontWeight: 500,
          fontFamily: FONT,
          maxWidth: "180px", overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {selectedLabel}
        </span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{
            padding: "4px", background: "transparent", border: "none",
            borderRadius: "6px", cursor: "pointer",
            color: T.textMuted,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "color 0.15s, background 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = T.accent;
            (e.currentTarget as HTMLButtonElement).style.background = T.accentLight;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = T.textMuted;
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
        >
          <IconChevronDown open={open} />
        </button>
      </div>

      {open && (
        <div style={{
          position: "absolute", zIndex: 200, top: "100%", left: 0, marginTop: "6px",
          minWidth: "100%", width: "max-content",
          background: T.bg, border: `1px solid ${T.border}`,
          borderRadius: "10px", boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
          padding: "4px 0", maxHeight: "200px", overflowY: "auto",
        }}>
          {options.map((opt) => {
            const isActive = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                style={{
                  width: "100%", textAlign: "left",
                  padding: "6px 12px", fontSize: "12px",
                  fontFamily: FONT,
                  background: isActive ? T.accentLight : "transparent",
                  color: isActive ? T.accent : T.textSub,
                  fontWeight: isActive ? 600 : 400,
                  border: "none", cursor: "pointer",
                  transition: "background 0.12s, color 0.12s",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = T.accentLight;
                    (e.currentTarget as HTMLButtonElement).style.color = T.accent;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                    (e.currentTarget as HTMLButtonElement).style.color = T.textSub;
                  }
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Collapsible accordion ────────────────────────────────────────────────────
function Collapsible({ label, defaultOpen = false, children }: { label: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: "10px", overflow: "hidden", marginBottom: "8px" }}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 12px", background: open ? T.accentLight : T.surfaceAlt,
        border: "none", cursor: "pointer", transition: "background 0.15s", fontFamily: FONT,
      }}>
        <span style={{ fontSize: "11px", fontWeight: 600, color: open ? T.accent : T.textSub, letterSpacing: "0.03em", fontFamily: FONT }}>
          {label}
        </span>
        <span style={{ color: open ? T.accent : T.textMuted }}><IconChevronCollapse open={open} /></span>
      </button>
      {open && (
        <div style={{ padding: "12px", borderTop: `1px solid ${T.border}`, background: T.surface }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Responsive font-size row ─────────────────────────────────────────────────
function ResponsiveFieldRow({ field, value, aspectRatio, onChange }: {
  field: LayoutPropField; value: unknown;
  aspectRatio: AspectRatio; onChange: (key: string, val: unknown) => void;
}) {
  const rv = isResponsiveValue(value) ? value : { portrait: (value as number) ?? 0, landscape: (value as number) ?? 0 };
  const currentVal = aspectRatio === "portrait" ? rv.portrait : rv.landscape;
  const pct = Math.round(((currentVal - (field.min ?? 0)) / ((field.max ?? 200) - (field.min ?? 0))) * 100);

  const handleChange = (v: number) => {
    onChange(field.key, {
      portrait:  aspectRatio === "portrait"  ? v : rv.portrait,
      landscape: aspectRatio === "landscape" ? v : rv.landscape,
    });
  };

  return (
    <div style={{ marginBottom: "14px" }}>
      <FieldLabel>{field.label}</FieldLabel>
      <input
        type="range" min={field.min ?? 0} max={field.max ?? 200} step={field.step ?? 1}
        value={currentVal} onChange={(e) => handleChange(Number(e.target.value))}
        className="studio-range"
        style={{ width: "100%", marginBottom: "4px", background: `linear-gradient(to right, ${T.accent} 0%, ${T.accent} ${pct}%, ${T.border} ${pct}%, ${T.border} 100%)` }}
      />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: "10px", color: T.textMuted, fontFamily: FONT }}>{field.min ?? 0}</span>
        <span style={{ fontSize: "12px", color: T.accent, fontWeight: 600, background: T.accentLight, padding: "1px 8px", borderRadius: "100px", border: `1px solid ${T.accentMid}44`, fontFamily: FONT }}>
          {currentVal}px
        </span>
        <span style={{ fontSize: "10px", color: T.textMuted, fontFamily: FONT }}>{field.max ?? 200}</span>
      </div>
    </div>
  );
}

// ─── Scene Settings Modal ─────────────────────────────────────────────────────
function SceneSettingsModal({
  open, onClose,
  title, setTitle, narration, setNarration,
  imageUrl, setImageUrl, fetchedImageUrl, imageFetching, imageError,
  accentColor, setAccentColor, bgColor, setBgColor, textColor, setTextColor,
  durationSeconds, setDurationSeconds,
}: {
  open: boolean; onClose: () => void;
  title: string; setTitle: (v: string) => void;
  narration: string; setNarration: (v: string) => void;
  imageUrl: string; setImageUrl: (v: string) => void;
  fetchedImageUrl: string; imageFetching: boolean; imageError: string;
  accentColor: string; setAccentColor: (v: string) => void;
  bgColor: string; setBgColor: (v: string) => void;
  textColor: string; setTextColor: (v: string) => void;
  durationSeconds: number; setDurationSeconds: (v: number) => void;
}) {
  if (!open) return null;

  const sliderPct = Math.round(((durationSeconds - 2) / 10) * 100);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(17,24,39,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(3px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "460px", maxHeight: "88vh",
          background: T.bg, borderRadius: "16px",
          border: `1px solid ${T.border}`,
          boxShadow: "0 24px 64px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)",
          display: "flex", flexDirection: "column", overflow: "hidden",
          fontFamily: FONT,
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: `1px solid ${T.border}`, flexShrink: 0,
        }}>
          <div>
            <h2 style={{ fontSize: "14px", fontWeight: 600, color: T.text, margin: 0, fontFamily: FONT }}>Scene settings</h2>
            <p style={{ fontSize: "11px", color: T.textMuted, margin: "2px 0 0", fontFamily: FONT }}>Content, image, colors &amp; duration</p>
          </div>
          <button type="button" onClick={onClose} style={{
            padding: "6px", borderRadius: "8px",
            border: `1px solid ${T.border}`, background: T.surfaceAlt,
            color: T.textSub, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.15s",
          }}>
            <IconX />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* Content */}
          <div>
            <SectionLabel icon={<IconType size={13} />}>Content</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <FieldLabel>Title</FieldLabel>
                <StudioInput value={title} onChange={setTitle} />
              </div>
              <div>
                <FieldLabel>Narration</FieldLabel>
                <StudioTextarea value={narration} onChange={setNarration} rows={3} />
              </div>
            </div>
          </div>

          {/* Image */}
          <div>
            <SectionLabel icon={<IconLink size={13} />}>Image</SectionLabel>
            <FieldLabel>Image URL</FieldLabel>
            <StudioInput value={imageUrl} onChange={setImageUrl} placeholder="https://…" />
            {imageFetching && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "50%", border: `1.5px solid ${T.border}`, borderTopColor: T.accent, animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
                <span style={{ fontSize: "11px", color: T.textMuted, fontFamily: FONT }}>Fetching image…</span>
              </div>
            )}
            {!imageFetching && imageUrl.trim() && (
              <div style={{ marginTop: "8px", borderRadius: "8px", overflow: "hidden", border: `1px solid ${imageError ? "#fecaca" : T.border}`, background: T.surfaceAlt, minHeight: "72px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {fetchedImageUrl ? (
                  <img src={fetchedImageUrl} alt="preview" style={{ width: "100%", display: "block", maxHeight: "120px", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: "11px", color: imageError ? "#dc2626" : T.textMuted, padding: "14px", fontFamily: FONT }}>{imageError || "No image"}</span>
                )}
              </div>
            )}
          </div>

          {/* Colors */}
          <div>
            <SectionLabel icon={<IconDroplet size={13} />}>Colors</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
              {[
                { label: "Accent", value: accentColor, set: setAccentColor },
                { label: "Background", value: bgColor, set: setBgColor },
                { label: "Text", value: textColor, set: setTextColor },
              ].map(({ label, value, set }) => (
                <div key={label}>
                  <FieldLabel>{label}</FieldLabel>
                  <div style={{ width: "100%", height: "36px", borderRadius: "8px", overflow: "hidden", border: `1.5px solid ${T.border}` }}>
                    <input type="color" value={value} onChange={(e) => set(e.target.value)} className="color-swatch" />
                  </div>
                  <div style={{ fontSize: "9px", color: T.textMuted, textAlign: "center", marginTop: "4px", letterSpacing: "0.04em", fontFamily: FONT }}>
                    {value.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <SectionLabel icon={<IconClock size={13} />}>Duration</SectionLabel>
            <input
              type="range" min={2} max={12} step={1} value={durationSeconds}
              onChange={(e) => setDurationSeconds(Number(e.target.value))}
              className="studio-range"
              style={{ background: `linear-gradient(to right, ${T.accent} 0%, ${T.accent} ${sliderPct}%, ${T.border} ${sliderPct}%, ${T.border} 100%)` }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
              <span style={{ fontSize: "10px", color: T.textMuted, fontFamily: FONT }}>2s</span>
              <span style={{ fontSize: "12px", color: T.accent, fontWeight: 600, background: T.accentLight, padding: "1px 8px", borderRadius: "100px", border: `1px solid ${T.accentMid}44`, fontFamily: FONT }}>
                {durationSeconds}s
              </span>
              <span style={{ fontSize: "10px", color: T.textMuted, fontFamily: FONT }}>12s</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}`, flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} style={{
            padding: "8px 22px", background: T.accent, color: "#fff",
            border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 500,
            cursor: "pointer", transition: "background 0.15s", fontFamily: FONT,
          }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function TemplateStudio() {
  const [templates, setTemplates]             = useState<TemplateMeta[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedLayout, setSelectedLayout]   = useState<string>("");
  const [title, setTitle]                     = useState<string>("Hello World!");
  const [narration, setNarration]             = useState<string>("Edit props live and preview exactly how this layout renders.");
  const [aspectRatio, setAspectRatio]         = useState<AspectRatio>("landscape");
  const [durationSeconds, setDurationSeconds] = useState<number>(5);
  const [imageUrl, setImageUrl]               = useState<string>("");
  const [accentColor, setAccentColor]         = useState<string>("#9333ea");
  const [bgColor, setBgColor]                 = useState<string>("#ffffff");
  const [textColor, setTextColor]             = useState<string>("#111827");
  const [layoutProps, setLayoutProps]         = useState<Record<string, unknown>>({});
  const [savingSource, setSavingSource]       = useState(false);
  const [saveMessage, setSaveMessage]         = useState<string>("");
  const [fetchedImageUrl, setFetchedImageUrl] = useState<string>("");
  const [imageFetching, setImageFetching]     = useState(false);
  const [imageError, setImageError]           = useState<string>("");
  const [sceneModalOpen, setSceneModalOpen]   = useState(false);
  const [aiInstruction, setAiInstruction]     = useState("");
  const [aiLoading, setAiLoading]             = useState(false);
  const [aiApplying, setAiApplying]           = useState(false);
  const [aiDiscarding, setAiDiscarding]       = useState(false);
  const [aiError, setAiError]                 = useState("");
  const [aiStatus, setAiStatus]               = useState("");
  const [aiPreviewSessionId, setAiPreviewSessionId] = useState("");
  const previewSelectionRef = useRef("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const response = await getTemplates();
        if (!mounted) return;
        const items = response.data;
        setTemplates(items);
        const first = items[0];
        if (first) {
          const templateId  = normalizeTemplateId(first.id);
          const firstLayout = first.hero_layout || first.valid_layouts?.[0] || Object.keys(first.layout_prop_schema ?? {})[0] || "";
          setSelectedTemplateId(templateId);
          setSelectedLayout(firstLayout);
          setAccentColor(first.preview_colors?.accent || "#9333ea");
          setBgColor(first.preview_colors?.bg         || "#ffffff");
          setTextColor(first.preview_colors?.text     || "#111827");
        } else {
          setError("No templates were found.");
        }
      } catch {
        if (mounted) setError("Failed to load templates.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const selectedTemplate = useMemo(
    () => templates.find((tpl) => normalizeTemplateId(tpl.id) === selectedTemplateId) || null,
    [templates, selectedTemplateId],
  );

  const schema = useMemo(
    () => getSchema(selectedTemplate, selectedLayout),
    [selectedTemplate, selectedLayout],
  );

  useEffect(() => {
    if (!selectedTemplate) return;
    const available = selectedTemplate.valid_layouts || Object.keys(selectedTemplate.layout_prop_schema ?? {});
    if (!available.length) return;
    if (!available.includes(selectedLayout)) setSelectedLayout(available[0]);
  }, [selectedTemplate, selectedLayout]);

  useEffect(() => {
    if (!schema) return;
    const defaults = (schema.defaults ?? {}) as Record<string, unknown>;
    setLayoutProps(defaults);
    const sd = schema.scene_defaults ?? {};
    if (sd.title)                   setTitle(sd.title);
    if (sd.narration !== undefined) setNarration(sd.narration);
    if (sd.durationSeconds)         setDurationSeconds(sd.durationSeconds);
  }, [schema]);

  const config      = useMemo(() => getTemplateConfig(selectedTemplateId || "default"), [selectedTemplateId]);
  const Composition = config.component as unknown as ComponentType<Record<string, unknown>>;
  const isPortrait  = aspectRatio === "portrait";

  useEffect(() => {
    const url = imageUrl.trim();
    if (!url) { setFetchedImageUrl(""); setImageError(""); return; }
    let cancelled = false;
    setImageFetching(true); setImageError(""); setFetchedImageUrl("");
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onload  = () => { if (!cancelled) { setFetchedImageUrl(reader.result as string); setImageFetching(false); } };
        reader.onerror = () => { if (!cancelled) { setImageError("Failed to read image."); setImageFetching(false); } };
        reader.readAsDataURL(blob);
      } catch (e: unknown) {
        if (!cancelled) { setImageError(e instanceof Error ? e.message : "Failed to fetch."); setImageFetching(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [imageUrl]);

  const resolvedLayoutProps = useMemo(() => {
    if (!schema) return layoutProps;
    const next: Record<string, unknown> = { ...layoutProps };
    schema.fields.forEach((field) => {
      if (field.type === "number" && field.responsive) {
        const raw = layoutProps[field.key];
        if (isResponsiveValue(raw)) next[field.key] = isPortrait ? raw.portrait : raw.landscape;
      }
    });
    return next;
  }, [schema, layoutProps, isPortrait]);

  const inputProps = useMemo(() => ({
    scenes: [{
      id: 1, order: 1, title, narration,
      layout: selectedLayout || config.heroLayout,
      layoutProps: resolvedLayoutProps, durationSeconds,
      imageUrl: fetchedImageUrl || (imageFetching ? undefined : "https://placehold.co/1920x1080/faf5ff/c084fc?text=No+Image"),
      voiceoverUrl: undefined,
    }],
    accentColor, bgColor, textColor,
    logo: null, logoPosition: "bottom_right", logoOpacity: 0.9, logoSize: 100, aspectRatio,
  }), [
    title, narration, selectedLayout, config.heroLayout, resolvedLayoutProps, durationSeconds,
    fetchedImageUrl, imageFetching, accentColor, bgColor, textColor, aspectRatio,
  ]);

  const layouts          = selectedTemplate?.valid_layouts || Object.keys(selectedTemplate?.layout_prop_schema ?? {});
  const canvasW          = isPortrait ? 1080 : 1920;
  const canvasH          = isPortrait ? 1920 : 1080;
  const durationInFrames = Math.max(30, Math.round(durationSeconds * 30));

  const responsiveFields = schema?.fields.filter((f) => f.responsive) ?? [];
  const regularFields    = schema?.fields.filter((f) => !f.responsive) ?? [];

  // Dropdown option arrays
  const templateOptions = templates.map((tpl) => ({
    value: normalizeTemplateId(tpl.id),
    label: tpl.name,
  }));

  const layoutOptions = layouts.map((layoutId) => ({
    value: layoutId,
    label: selectedTemplate?.layout_prop_schema?.[layoutId]?.label || humanize(layoutId),
  }));

  const handleSaveSource = async () => {
    if (!selectedTemplateId || !selectedLayout) return;
    const titleValue = layoutProps.titleFontSize;
    const descValue  = layoutProps.descriptionFontSize;
    if (!isResponsiveValue(titleValue) && !isResponsiveValue(descValue)) {
      setSaveMessage("No responsive font-size values to save for this layout.");
      return;
    }
    try {
      setSavingSource(true); setSaveMessage("");
      const result = await saveTemplateSourceDefaults({
        template_id: selectedTemplateId, layout_id: selectedLayout,
        ...(isResponsiveValue(titleValue) ? { title_font_size: titleValue }      : {}),
        ...(isResponsiveValue(descValue)  ? { description_font_size: descValue } : {}),
      });
      const updatedFiles = result.data.updated_files?.length
        ? result.data.updated_files.join(", ") : result.data.updated_file;
      const metaNote = result.data.updated_meta_file ? ` Meta: ${result.data.updated_meta_file}.` : "";
      setSaveMessage(`Saved: ${updatedFiles}.${metaNote}`);
      setTemplates((prev) => prev.map((tpl) => {
        if (normalizeTemplateId(tpl.id) !== selectedTemplateId) return tpl;
        const s = tpl.layout_prop_schema ?? {};
        const ls = s[selectedLayout];
        if (!ls) return tpl;
        const defaults = { ...(ls.defaults ?? {}) };
        if (isResponsiveValue(titleValue)) defaults.titleFontSize = titleValue;
        if (isResponsiveValue(descValue))  defaults.descriptionFontSize = descValue;
        return { ...tpl, layout_prop_schema: { ...s, [selectedLayout]: { ...ls, defaults } } };
      }));
    } catch {
      setSaveMessage("Failed to save source defaults.");
    } finally {
      setSavingSource(false);
    }
  };

  const handleGenerateAiEdit = async () => {
    if (!selectedTemplateId || !selectedLayout) return;
    if (!aiInstruction.trim()) { setAiError("Add an instruction first."); setAiStatus(""); return; }
    try {
      setAiLoading(true); setAiError(""); setAiStatus("");
      const result = await startTemplateAiPreview({
        template_id: selectedTemplateId, layout_id: selectedLayout, instruction: aiInstruction.trim(),
      });
      setAiPreviewSessionId(result.data.session_id);
      setAiStatus("Preview is using AI-generated code. Review the scene and apply or discard.");
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : "Failed to start AI preview.";
      setAiError(String(msg || "Failed to start AI preview.")); setAiStatus("");
    } finally { setAiLoading(false); }
  };

  const handleApplyAiEdit = async () => {
    if (!aiPreviewSessionId) return;
    try {
      setAiApplying(true); setAiError(""); setAiStatus("");
      const result = await applyTemplateAiPreview({ session_id: aiPreviewSessionId });
      setAiStatus(`Applied to: ${result.data.updated_files.join(", ")}`);
      setAiPreviewSessionId("");
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail : "Failed to apply.";
      setAiError(String(msg || "Failed to apply.")); setAiStatus("");
    } finally { setAiApplying(false); }
  };

  const handleDiscardAiEdit = async () => {
    if (!aiPreviewSessionId) return;
    try {
      setAiDiscarding(true); setAiError(""); setAiStatus("");
      await discardTemplateAiPreview({ session_id: aiPreviewSessionId });
      setAiPreviewSessionId("");
      setAiStatus("Discarded AI preview. Original files restored.");
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail : "Failed to discard.";
      setAiError(String(msg || "Failed to discard.")); setAiStatus("");
    } finally { setAiDiscarding(false); }
  };

  // Cleanup AI preview on unmount
  useEffect(() => {
    return () => {
      if (!aiPreviewSessionId) return;
      void discardTemplateAiPreview({ session_id: aiPreviewSessionId }).catch(() => undefined);
    };
  }, [aiPreviewSessionId]);

  // Discard preview when template/layout selection changes
  useEffect(() => {
    const key = `${selectedTemplateId}::${selectedLayout}`;
    if (!previewSelectionRef.current) { previewSelectionRef.current = key; return; }
    if (previewSelectionRef.current !== key && aiPreviewSessionId) {
      const sid = aiPreviewSessionId;
      setAiPreviewSessionId("");
      setAiStatus("Selection changed. Previous AI preview discarded.");
      void discardTemplateAiPreview({ session_id: sid }).catch(() => undefined);
    }
    previewSelectionRef.current = key;
  }, [selectedTemplateId, selectedLayout, aiPreviewSessionId]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .studio-root {
          font-family: ${FONT};
          background: ${T.surfaceAlt};
          color: ${T.text};
          height: 100vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .studio-input:focus {
          border-color: ${T.accent} !important;
          box-shadow: 0 0 0 3px ${T.accentLight} !important;
          background: #fff !important;
          outline: none;
        }

        input[type="range"].studio-range {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 3px; border-radius: 3px; outline: none; cursor: pointer;
        }
        input[type="range"].studio-range::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 16px; height: 16px; border-radius: 50%;
          background: #fff; border: 2px solid ${T.accent};
          box-shadow: 0 1px 4px rgba(147,51,234,0.22), 0 0 0 3px ${T.accentLight};
          cursor: pointer; transition: box-shadow 0.13s;
        }
        input[type="range"].studio-range::-webkit-slider-thumb:hover {
          box-shadow: 0 1px 6px rgba(147,51,234,0.35), 0 0 0 5px ${T.accentLight};
        }

        input[type="color"].color-swatch {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 100%; border: none; padding: 0; cursor: pointer;
        }
        input[type="color"].color-swatch::-webkit-color-swatch-wrapper { padding: 0; }
        input[type="color"].color-swatch::-webkit-color-swatch { border: none; border-radius: 7px; }

        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.borderStrong}; border-radius: 4px; }

        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .studio-grid { animation: fadeInUp 0.3s ease both; }

        .glass-card {
          background: ${T.bg};
          border: 1px solid ${T.border};
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }

        .btn-primary {
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          padding: 8px 14px; width: 100%;
          background: ${T.accent}; color: #fff;
          border: none; border-radius: 8px;
          font-size: 12px; font-weight: 500; font-family: ${FONT};
          cursor: pointer; transition: background 0.15s;
        }
        .btn-primary:hover:not(:disabled) { background: ${T.accentDark}; }
        .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }

        .btn-ghost {
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          padding: 8px 14px; width: 100%;
          background: transparent; color: ${T.textSub};
          border: 1px solid ${T.border}; border-radius: 8px;
          font-size: 12px; font-weight: 500; font-family: ${FONT};
          cursor: pointer; transition: all 0.15s;
        }
        .btn-ghost:hover:not(:disabled) { border-color: ${T.accent}; color: ${T.accent}; background: ${T.accentLight}; }
        .btn-ghost:disabled { opacity: 0.55; cursor: not-allowed; }

        /* Edit button — matches attached scene edit button style exactly */
        .btn-edit {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 8px;
          background: transparent; color: ${T.textMuted};
          border: none; border-radius: 8px;
          font-size: 12px; font-weight: 500; font-family: ${FONT};
          cursor: pointer; transition: color 0.13s, background 0.13s;
          flex-shrink: 0;
        }
        .btn-edit:hover { color: ${T.accent}; background: ${T.accentLight}; }

        .aspect-btn {
          flex: 1; display: flex; flex-direction: column; align-items: center; gap: 5px;
          padding: 9px 8px; border-radius: 8px;
          border: 1px solid ${T.border}; background: ${T.surfaceAlt};
          color: ${T.textSub}; font-size: 11px; font-family: ${FONT};
          cursor: pointer; transition: all 0.13s ease;
        }
        .aspect-btn:hover  { border-color: ${T.accentMid}; color: ${T.accent}; }
        .aspect-btn.active { border-color: ${T.accent}; background: ${T.accentLight}; color: ${T.accent}; font-weight: 600; }

        .left-section {
          padding-bottom: 14px;
          margin-bottom: 14px;
          border-bottom: 1px solid ${T.border};
        }
        .left-section:last-child {
          padding-bottom: 0;
          margin-bottom: 0;
          border-bottom: none;
        }
      `}</style>

      <div className="studio-root">

        {/* ── Top bar ── */}
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 20px", height: "52px",
          borderBottom: `1px solid ${T.border}`,
          background: T.bg, flexShrink: 0, zIndex: 50,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "15px", fontWeight: 600, color: T.text, fontFamily: FONT }}>Template Studio</span>

            {selectedTemplate && (
              <>
                <div style={{ width: "1px", height: "14px", background: T.border }} />
                <span style={{ fontSize: "13px", fontWeight: 500, color: T.textSub, fontFamily: FONT }}>{selectedTemplate.name}</span>
                {selectedLayout && (
                  <>
                    <span style={{ color: T.border }}>·</span>
                    <span style={{
                      fontSize: "12px", color: T.accent, fontWeight: 500,
                      background: T.accentLight, padding: "1px 8px", borderRadius: "100px",
                      border: `1px solid ${T.accentMid}33`, fontFamily: FONT,
                    }}>
                      {humanize(selectedLayout)}
                    </span>
                  </>
                )}
              </>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "12px", color: T.textMuted, fontFamily: FONT }}>
              {isPortrait ? "9:16" : "16:9"} · {durationSeconds}s
            </span>
            <div style={{
              display: "flex", alignItems: "center", gap: "5px",
              padding: "4px 10px", borderRadius: "100px",
              background: T.greenBg, border: `1px solid ${T.greenBorder}`,
            }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: T.green }} />
              <span style={{ fontSize: "10px", color: T.green, fontWeight: 700, letterSpacing: "0.08em", fontFamily: FONT }}>LIVE</span>
            </div>
          </div>
        </header>

        {/* ── Main ── */}
        <main style={{ padding: "14px 16px 16px", flex: 1, minHeight: 0, overflow: "hidden" }}>

          {loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "300px", gap: "12px" }}>
              <div style={{ width: "28px", height: "28px", border: `2px solid ${T.border}`, borderTopColor: T.accent, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
              <span style={{ fontSize: "12px", color: T.textMuted, fontFamily: FONT }}>Loading templates…</span>
            </div>
          )}

          {error && (
            <div style={{ padding: "12px 16px", borderRadius: "8px", background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: "13px", fontFamily: FONT }}>
              {error}
            </div>
          )}

          {!loading && !error && selectedTemplate && (
            <div
              className="studio-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "264px 1fr 276px",
                gap: "12px",
                height: "100%",
                alignItems: "start",
              }}
            >
              {/* ══ LEFT panel ══ */}
              <aside className="glass-card" style={{ padding: "16px", overflowY: "auto", maxHeight: "calc(100vh - 80px)" }}>

                {/* Template dropdown */}
                <div className="left-section">
                  <StudioDropdown
                    sectionLabel="Template"
                    value={selectedTemplateId}
                    onChange={(nextId) => {
                      const next = templates.find((t) => normalizeTemplateId(t.id) === nextId) || null;
                      setSelectedTemplateId(nextId);
                      if (next) {
                        const nl = next.hero_layout || next.valid_layouts?.[0] || Object.keys(next.layout_prop_schema ?? {})[0] || "";
                        setSelectedLayout(nl);
                        setAccentColor(next.preview_colors?.accent || accentColor);
                        setBgColor(next.preview_colors?.bg || bgColor);
                        setTextColor(next.preview_colors?.text || textColor);
                      }
                    }}
                    options={templateOptions}
                  />
                </div>

                {/* Layout dropdown */}
                <div className="left-section">
                  <StudioDropdown
                    sectionLabel="Layout"
                    value={selectedLayout}
                    onChange={setSelectedLayout}
                    options={layoutOptions}
                  />
                </div>

                {/* Format — aspect ratio only */}
                <div className="left-section">
                  <SectionLabel icon={<IconLayout />}>Format</SectionLabel>
                  <FieldLabel>Aspect ratio</FieldLabel>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {(["landscape", "portrait"] as AspectRatio[]).map((ar) => (
                      <button key={ar} type="button" className={`aspect-btn${aspectRatio === ar ? " active" : ""}`} onClick={() => setAspectRatio(ar)}>
                        <div style={{
                          width: ar === "landscape" ? "22px" : "12px", height: ar === "landscape" ? "12px" : "22px",
                          borderRadius: "2px", border: `2px solid ${aspectRatio === ar ? T.accent : T.borderStrong}`,
                          background: aspectRatio === ar ? T.accentLight : "transparent", transition: "all 0.13s",
                        }} />
                        {ar === "landscape" ? "16:9" : "9:16"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Typography */}
                {responsiveFields.length > 0 && (
                  <div className="left-section">
                    <SectionLabel icon={<IconType />}>Typography</SectionLabel>
                    {responsiveFields.map((field) => (
                      <ResponsiveFieldRow
                        key={field.key}
                        field={field}
                        value={layoutProps[field.key]}
                        aspectRatio={aspectRatio}
                        onChange={(key, val) => setLayoutProps((prev) => ({ ...prev, [key]: val }))}
                      />
                    ))}
                    <div style={{ display: "flex", flexDirection: "column", gap: "7px", marginTop: "4px" }}>
                      <button type="button" className="btn-ghost" onClick={() => {
                        const defaults = (schema?.defaults ?? {}) as Record<string, unknown>;
                        setLayoutProps(defaults);
                        const sd = schema?.scene_defaults;
                        if (sd?.title) setTitle(sd.title);
                        if (sd?.narration !== undefined) setNarration(sd.narration);
                      }}>
                        <IconReset />
                        Reset to defaults
                      </button>
                      <button type="button" className="btn-primary" disabled={savingSource} onClick={handleSaveSource}>
                        <IconSave />
                        {savingSource ? "Saving…" : "Save font defaults"}
                      </button>
                      {saveMessage && (
                        <p style={{ margin: 0, fontSize: "11px", color: T.textSub, background: T.accentLight, border: `1px solid ${T.accentMid}33`, borderRadius: "8px", padding: "8px 10px", lineHeight: "1.5", wordBreak: "break-all", fontFamily: FONT }}>
                          {saveMessage}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Props — closed by default */}
                {(regularFields.length > 0 || (responsiveFields.length === 0 && schema)) && (
                  <div className="left-section">
                    <SectionLabel icon={<IconSliders />}>Props</SectionLabel>
                    <Collapsible label="Layout properties" defaultOpen={false}>
                      {regularFields.length > 0 ? (
                        <ManifestPropEditor
                          schema={{ ...schema!, fields: regularFields }}
                          value={layoutProps}
                          onChange={setLayoutProps}
                        />
                      ) : schema ? (
                        <ManifestPropEditor schema={schema} value={layoutProps} onChange={setLayoutProps} />
                      ) : null}
                    </Collapsible>
                  </div>
                )}
              </aside>

              {/* ══ CENTER: Preview ══ */}
              <section style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div className="glass-card" style={{ overflow: "hidden" }}>

                  {/* Chrome bar */}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "9px 14px", borderBottom: `1px solid ${T.border}`, background: T.surfaceAlt,
                  }}>
                    {/* Left: traffic dots + Edit button matching attached style */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ display: "flex", gap: "5px" }}>
                        {["#ff5f56", "#ffbd2e", "#27c93f"].map((c, i) => (
                          <div key={i} style={{ width: "8px", height: "8px", borderRadius: "50%", background: c, opacity: 0.6 }} />
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setSceneModalOpen(true)}
                        className="btn-edit"
                        title="Edit scene"
                      >
                        <IconEdit />
                        Edit
                      </button>
                    </div>

                    {/* Center: resolution pill */}
                    <div style={{
                      display: "flex", alignItems: "center", gap: "6px",
                      padding: "3px 10px", borderRadius: "6px",
                      background: T.bg, border: `1px solid ${T.border}`,
                    }}>
                      <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: T.accent, opacity: 0.5 }} />
                      <span style={{ fontSize: "10px", color: T.textMuted, fontFamily: FONT }}>
                        {canvasW} × {canvasH} · {durationInFrames}f · 30fps
                      </span>
                    </div>

                    {/* Right: Rendering badge */}
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: T.green }} />
                      <span style={{ fontSize: "10px", color: T.green, fontWeight: 700, letterSpacing: "0.08em", fontFamily: FONT }}>RENDERING</span>
                    </div>
                  </div>

                  {/* Player */}
                  <div style={{
                    padding: "24px 20px",
                    background: `radial-gradient(ellipse at 50% -10%, ${T.accentLight} 0%, ${T.surfaceAlt} 60%, ${T.bg} 100%)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <div style={{
                      width: "100%",
                      aspectRatio: isPortrait ? "9/16" : "16/9",
                      maxHeight: isPortrait ? "calc(100vh - 170px)" : "540px",
                      borderRadius: "8px", overflow: "hidden",
                      boxShadow: `0 0 0 1px ${T.border}, 0 4px 16px rgba(147,51,234,0.07), 0 16px 48px rgba(0,0,0,0.08)`,
                    }}>
                      <Player
                        component={Composition}
                        inputProps={inputProps}
                        durationInFrames={durationInFrames}
                        compositionWidth={canvasW}
                        compositionHeight={canvasH}
                        fps={30}
                        controls
                        style={{ width: "100%", height: "100%" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Stats bar */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
                  {[
                    { label: "Template", value: selectedTemplate?.name || "—" },
                    { label: "Layout",   value: humanize(selectedLayout) || "—" },
                    { label: "Duration", value: `${durationSeconds}s · ${durationInFrames}f` },
                    { label: "Canvas",   value: `${canvasW}×${canvasH}` },
                  ].map(({ label, value }) => (
                    <div key={label} className="glass-card" style={{ padding: "9px 12px" }}>
                      <div style={{ fontSize: "10px", color: T.textMuted, marginBottom: "3px", fontWeight: 500, fontFamily: FONT }}>{label}</div>
                      <div style={{ fontSize: "12px", color: T.accent, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: FONT }}>{value}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* ══ RIGHT: AI Edit ══ */}
              <aside className="glass-card" style={{ padding: "16px", overflowY: "auto", maxHeight: "calc(100vh - 80px)" }}>

                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "14px" }}>
                  <span style={{ color: T.accentMid }}><IconWand /></span>
                  <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: T.textSub, fontFamily: FONT }}>
                    AI Edit
                  </span>
                  <span style={{
                    marginLeft: "auto", fontSize: "9px", padding: "1px 7px",
                    background: T.accentLight, color: T.accent,
                    borderRadius: "100px", border: `1px solid ${T.accentMid}33`,
                    fontWeight: 600, letterSpacing: "0.06em", fontFamily: FONT,
                  }}>
                    GEMINI
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div>
                    <FieldLabel>Instruction</FieldLabel>
                    <textarea
                      className="studio-input"
                      placeholder="Describe the edit — e.g. 'move the title higher, make the subtitle lighter, reduce border thickness.'"
                      value={aiInstruction}
                      onChange={(e) => setAiInstruction(e.target.value)}
                      rows={14}
                      style={{ ...inputBase, resize: "vertical" as const, lineHeight: "1.6", background: T.surfaceAlt }}
                    />
                  </div>

                  <button type="button" className="btn-primary"
                    disabled={aiLoading || aiApplying || aiDiscarding || !aiInstruction.trim()}
                    onClick={handleGenerateAiEdit}
                  >
                    <IconWand />
                    {aiLoading ? "Generating preview…" : "Generate"}
                  </button>

                  {aiPreviewSessionId && (
                    <>
                      <div style={{
                        border: `1px solid ${T.border}`, background: T.surfaceAlt,
                        borderRadius: "8px", padding: "8px 10px",
                        fontSize: "10px", color: T.textSub, wordBreak: "break-all", fontFamily: FONT,
                      }}>
                        <span style={{ color: T.textMuted, fontWeight: 500 }}>Session: </span>
                        {aiPreviewSessionId}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <button
                          type="button"
                          disabled={aiApplying || aiDiscarding}
                          onClick={handleApplyAiEdit}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                            padding: "8px 14px", width: "100%",
                            background: "#111827", color: "#fff",
                            border: "none", borderRadius: "8px",
                            fontSize: "12px", fontWeight: 500, fontFamily: FONT,
                            cursor: aiApplying || aiDiscarding ? "not-allowed" : "pointer",
                            opacity: aiApplying || aiDiscarding ? 0.7 : 1,
                            transition: "opacity 0.15s",
                          }}
                        >
                          <IconSave />
                          {aiApplying ? "Applying…" : "Apply to files"}
                        </button>
                        <button type="button" className="btn-ghost" disabled={aiDiscarding || aiApplying} onClick={handleDiscardAiEdit}>
                          <IconReset />
                          {aiDiscarding ? "Discarding…" : "Discard preview"}
                        </button>
                      </div>
                    </>
                  )}

                  <div style={{
                    padding: "10px 12px", borderRadius: "8px",
                    background: aiError ? "#fee2e2" : aiStatus ? "#dcfce7" : T.surfaceAlt,
                    border: `1px solid ${aiError ? "#fecaca" : aiStatus ? "#bbf7d0" : T.border}`,
                  }}>
                    <p style={{
                      margin: 0, fontSize: "11px", fontFamily: FONT,
                      color: aiError ? "#7f1d1d" : aiStatus ? "#14532d" : T.textMuted,
                      lineHeight: "1.6", wordBreak: "break-word",
                    }}>
                      {aiError || aiStatus || "Generate a preview, inspect the scene, then apply or discard."}
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          )}
        </main>
      </div>

      {/* ── Scene Settings Modal ── */}
      <SceneSettingsModal
        open={sceneModalOpen}
        onClose={() => setSceneModalOpen(false)}
        title={title} setTitle={setTitle}
        narration={narration} setNarration={setNarration}
        imageUrl={imageUrl} setImageUrl={setImageUrl}
        fetchedImageUrl={fetchedImageUrl}
        imageFetching={imageFetching}
        imageError={imageError}
        accentColor={accentColor} setAccentColor={setAccentColor}
        bgColor={bgColor} setBgColor={setBgColor}
        textColor={textColor} setTextColor={setTextColor}
        durationSeconds={durationSeconds} setDurationSeconds={setDurationSeconds}
      />
    </>
  );
}