import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { Player } from "@remotion/player";
import {
  applyTemplateAiPreview,
  discardTemplateAiPreview,
  getTemplates,
  startTemplateAiPreview,
  startTemplateAiPreviewFile,
  saveTemplateSourceDefaults,
  switchTemplateAiPreviewVersion,
  type LayoutPropField,
  type LayoutPropSchema,
  type TemplateMeta,
  type StartTemplateAiPreviewResponse,
  getTemplateAiVersions,
  type ListTemplateAiVersionsResponse,
  rebuildTemplateLayout,
  rebuildTemplateLayoutFile,
  createTemplateLayout,
  createTemplateLayoutFile,
  renderTemplateLayout,
  type PropDef,
  SUPPORTED_PROP_TYPES,
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

const TYPOGRAPHY_FIELDS: LayoutPropField[] = [
  { key: "titleFontSize", label: "Title Font Size", type: "number", responsive: true, min: 20, max: 180, step: 1 },
  { key: "descriptionFontSize", label: "Description Font Size", type: "number", responsive: true, min: 12, max: 100, step: 1 },
];

const TYPOGRAPHY_DEFAULTS: Record<string, ResponsiveValue> = {
  titleFontSize: { portrait: 56, landscape: 76 },
  descriptionFontSize: { portrait: 24, landscape: 34 },
};

const NEWSCAST_TYPOGRAPHY_DEFAULTS_BY_LAYOUT: Record<string, { titleFontSize: ResponsiveValue; descriptionFontSize: ResponsiveValue }> = {
  opening: { titleFontSize: { portrait: 94, landscape: 72 }, descriptionFontSize: { portrait: 23, landscape: 18 } },
  anchor_narrative: { titleFontSize: { portrait: 39, landscape: 30 }, descriptionFontSize: { portrait: 20, landscape: 16 } },
  live_metrics_board: { titleFontSize: { portrait: 23, landscape: 18 }, descriptionFontSize: { portrait: 18, landscape: 14 } },
  briefing_code_panel: { titleFontSize: { portrait: 23, landscape: 18 }, descriptionFontSize: { portrait: 18, landscape: 14 } },
  headline_insight: { titleFontSize: { portrait: 75, landscape: 58 }, descriptionFontSize: { portrait: 17, landscape: 13 } },
  story_stack: { titleFontSize: { portrait: 31, landscape: 24 }, descriptionFontSize: { portrait: 18, landscape: 14 } },
  side_by_side_brief: { titleFontSize: { portrait: 34, landscape: 26 }, descriptionFontSize: { portrait: 18, landscape: 14 } },
  segment_break: { titleFontSize: { portrait: 47, landscape: 36 }, descriptionFontSize: { portrait: 18, landscape: 14 } },
  field_image_focus: { titleFontSize: { portrait: 34, landscape: 26 }, descriptionFontSize: { portrait: 19, landscape: 15 } },
  data_visualization: { titleFontSize: { portrait: 29, landscape: 22 }, descriptionFontSize: { portrait: 17, landscape: 13 } },
  ending_socials: { titleFontSize: { portrait: 52, landscape: 40 }, descriptionFontSize: { portrait: 20, landscape: 16 } },
};

function withTypographyControls(
  schema: LayoutPropSchema,
  options?: { defaultTypography?: { titleFontSize: ResponsiveValue; descriptionFontSize: ResponsiveValue } },
): LayoutPropSchema {
  const fields = Array.isArray(schema.fields) ? schema.fields : [];
  const hasTitleField = fields.some((field) => field.key === "titleFontSize" && field.responsive);
  const hasDescriptionField = fields.some((field) => field.key === "descriptionFontSize" && field.responsive);
  if (hasTitleField && hasDescriptionField) return schema;

  const defaultTypography = options?.defaultTypography ?? {
    titleFontSize: TYPOGRAPHY_DEFAULTS.titleFontSize,
    descriptionFontSize: TYPOGRAPHY_DEFAULTS.descriptionFontSize,
  };
  const defaults = { ...(schema.defaults ?? {}) } as Record<string, unknown>;
  if (!isResponsiveValue(defaults.titleFontSize)) defaults.titleFontSize = defaultTypography.titleFontSize;
  if (!isResponsiveValue(defaults.descriptionFontSize)) defaults.descriptionFontSize = defaultTypography.descriptionFontSize;

  return {
    ...schema,
    defaults,
    fields: [
      ...(hasTitleField ? [] : [TYPOGRAPHY_FIELDS[0]]),
      ...(hasDescriptionField ? [] : [TYPOGRAPHY_FIELDS[1]]),
      ...fields,
    ],
  };
}

function getSchema(
  template: TemplateMeta | null,
  layoutId: string | null
): LayoutPropSchema | undefined {
  if (!template || !layoutId) return undefined;
  const explicit = template.layout_prop_schema?.[layoutId];
  const newscastTypographyDefaults =
    normalizeTemplateId(template.id) === "newscast" && layoutId
      ? NEWSCAST_TYPOGRAPHY_DEFAULTS_BY_LAYOUT[layoutId]
      : undefined;
  if (explicit) {
    return normalizeTemplateId(template.id) === "newscast"
      ? withTypographyControls(explicit, { defaultTypography: newscastTypographyDefaults })
      : explicit;
  }

  const fallbackSchema: LayoutPropSchema = {
    label: humanize(layoutId),
    defaults: TYPOGRAPHY_DEFAULTS,
    fields: TYPOGRAPHY_FIELDS,
  };
  return normalizeTemplateId(template.id) === "newscast"
    ? withTypographyControls(fallbackSchema, { defaultTypography: newscastTypographyDefaults })
    : fallbackSchema;
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
const IconImage   = ({ size }: { size?: number } = {}) => <Svg d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14l3.5-3.5 3 3 4-4 3.5 3.5z" size={size} />;
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

// ─── Image attach row (for AI layout editing) ──────────────────────────────────
function ImageAttachRow({
  image,
  onImageChange,
  label = "Reference image",
}: {
  image: File | null;
  onImageChange: (img: File | null) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!image) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    onImageChange(file);
    e.target.value = "";
  };
  return (
    <div style={{ marginBottom: "10px" }}>
      <FieldLabel>{label}</FieldLabel>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFile}
        style={{ display: "none" }}
      />
      {image ? (
        <div style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: "8px", background: T.surfaceAlt, borderRadius: "8px",
          border: `1px solid ${T.border}`,
        }}>
          <img
            src={previewUrl || ""}
            alt="Reference"
            style={{ width: 48, height: 48, objectFit: "cover", borderRadius: "6px" }}
          />
          <span style={{ fontSize: "11px", color: T.textSub, fontFamily: FONT, flex: 1 }}>Attached</span>
          <button
            type="button"
            onClick={() => onImageChange(null)}
            style={{
              padding: "4px 8px", fontSize: "11px", fontFamily: FONT,
              background: "transparent", border: `1px solid ${T.border}`,
              borderRadius: "6px", color: T.textSub, cursor: "pointer",
            }}
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "8px 12px", fontSize: "11px", fontFamily: FONT,
            background: T.surfaceAlt, border: `1px dashed ${T.border}`,
            borderRadius: "8px", color: T.textSub, cursor: "pointer",
          }}
        >
          <IconImage size={14} />
          Attach image (optional)
        </button>
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

function PropDefRow({
  prop,
  onChange,
  onRemove,
}: {
  prop: PropDef;
  onChange: (p: PropDef) => void;
  onRemove: () => void;
}) {
  return (
    <div
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: "8px",
        padding: "10px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        background: T.surfaceAlt,
        position: "relative",
      }}
    >
      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        style={{
          position: "absolute",
          top: "-15px",
          right: "-12px",
          padding: "4px 7px",
          border: "none",
          borderRadius: "6px",
          background: "#fee2e2",
          color: "#dc2626",
          fontSize: "11px",
          cursor: "pointer",
        }}
      >
        ✕
      </button>

      {/* Name */}
      <input
        className="studio-input"
        placeholder="prop_name"
        value={prop.name}
        onChange={(e) =>
          onChange({
            ...prop,
            name: e.target.value.replace(/[^a-zA-Z0-9_]/g, ""),
          })
        }
        style={{ ...inputBase, padding: "6px 8px", fontSize: "12px" }}
      />

      {/* Type */}
      <select
        className="studio-input"
        value={prop.type}
        onChange={(e) => onChange({ ...prop, type: e.target.value })}
        style={{ ...inputBase, padding: "6px 8px", fontSize: "12px" }}
      >
        {SUPPORTED_PROP_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      {/* Description */}
      <input
        className="studio-input"
        placeholder="Description (optional)"
        value={prop.description}
        onChange={(e) => onChange({ ...prop, description: e.target.value })}
        style={{ ...inputBase, padding: "6px 8px", fontSize: "11px" }}
      />

      {/* Default value */}
      {prop.type === "boolean" ? (
        <select
          className="studio-input"
          value={
            prop.default === "true" ||
            prop.default === "1" ||
            prop.default === "yes"
              ? "true"
              : "false"
          }
          onChange={(e) => onChange({ ...prop, default: e.target.value })}
          style={{ ...inputBase, padding: "6px 8px", fontSize: "11px" }}
        >
          <option value="false">false</option>
          <option value="true">true</option>
        </select>
      ) : prop.type === "number" ? (
        <input
          type="number"
          className="studio-input"
          placeholder="Default (optional)"
          value={prop.default ?? ""}
          onChange={(e) =>
            onChange({ ...prop, default: e.target.value || undefined })
          }
          style={{ ...inputBase, padding: "6px 8px", fontSize: "11px" }}
        />
      ) : prop.type === "string_array" ? (
        <input
          className="studio-input"
          placeholder="Comma-separated, e.g. 1,2,3"
          value={prop.default ?? ""}
          onChange={(e) =>
            onChange({ ...prop, default: e.target.value || undefined })
          }
          style={{ ...inputBase, padding: "6px 8px", fontSize: "11px" }}
        />
      ) : prop.type === "object_array" ? (
        <input
          className="studio-input"
          placeholder="Jan:100, Feb:200 or JSON"
          value={prop.default ?? ""}
          onChange={(e) =>
            onChange({ ...prop, default: e.target.value || undefined })
          }
          style={{ ...inputBase, padding: "6px 8px", fontSize: "11px" }}
        />
      ) : prop.type === "color" ? (
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            type="color"
            value={
              prop.default && /^#[0-9A-Fa-f]{6}$/.test(prop.default)
                ? prop.default
                : "#9333ea"
            }
            onChange={(e) => onChange({ ...prop, default: e.target.value })}
            style={{
              width: 36,
              height: 28,
              padding: 2,
              border: `1px solid ${T.border}`,
              borderRadius: 6,
              cursor: "pointer",
            }}
          />
          <input
            className="studio-input"
            placeholder="#hex or color name"
            value={prop.default ?? ""}
            onChange={(e) =>
              onChange({ ...prop, default: e.target.value || undefined })
            }
            style={{ ...inputBase, flex: 1, padding: "6px 8px", fontSize: "11px" }}
          />
        </div>
      ) : (
        <input
          className="studio-input"
          placeholder="Default (optional)"
          value={prop.default ?? ""}
          onChange={(e) =>
            onChange({ ...prop, default: e.target.value || undefined })
          }
          style={{ ...inputBase, padding: "6px 8px", fontSize: "11px" }}
        />
      )}
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
  const [aiLayoutImage, setAiLayoutImage]     = useState<File | null>(null);
  const [aiLoading, setAiLoading]             = useState(false);
  const [aiApplying, setAiApplying]           = useState(false);
  const [aiDiscarding, setAiDiscarding]       = useState(false);
  const [aiError, setAiError]                 = useState("");
  const [aiStatus, setAiStatus]               = useState("");
  const [aiPreviewSessionId, setAiPreviewSessionId] = useState("");
  const [aiPreviewVersions, setAiPreviewVersions]   = useState<string[]>([]);
  const [aiPreviewVersion, setAiPreviewVersion]     = useState<string | null>(null);
  const [aiSwitchingVersion, setAiSwitchingVersion] = useState(false);
  const previewSelectionRef = useRef("");
  const [viewSource, setViewSource] = useState<"frontend" | "remotion">("frontend");
  const [layoutRendering, setLayoutRendering] = useState(false);
  const [layoutRenderError, setLayoutRenderError] = useState<string>("");

  // ── Rebuild mode state ──────────────────────────────────────────────────────
  const [aiMode, setAiMode]             = useState<"code-only" | "rebuild">("code-only");
  const [rebuildProps, setRebuildProps] = useState<PropDef[]>([]);
  const [rebuildLoading, setRebuildLoading] = useState(false);
  const [rebuildError, setRebuildError]     = useState("");
  const [rebuildStatus, setRebuildStatus]   = useState("");

  // ── New layout tab state ────────────────────────────────────────────────────
  const [rightTab, setRightTab]           = useState<"edit" | "new-layout">("edit");
  const [newLayoutId, setNewLayoutId]     = useState("");
  const [newBaseLayoutId, setNewBaseLayoutId] = useState("");
  const [newLayoutDesc, setNewLayoutDesc] = useState("");
  const [newLayoutImage, setNewLayoutImage] = useState<File | null>(null);
  const [newLayoutProps, setNewLayoutProps] = useState<PropDef[]>([]);
  const [newLayoutLoading, setNewLayoutLoading] = useState(false);
  const [newLayoutError, setNewLayoutError]     = useState("");
  const [newLayoutStatus, setNewLayoutStatus]   = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const response = await getTemplates();
        if (!mounted) return;
        const items = response.data;
        setTemplates(items);
        // Prefer Nightfall as the default template when available.
        const preferred =
          items.find((tpl) => normalizeTemplateId(tpl.id) === "nightfall") ||
          items[0];
        if (preferred) {
          const templateId  = normalizeTemplateId(preferred.id);
          const firstLayout = preferred.hero_layout || preferred.valid_layouts?.[0] || Object.keys(preferred.layout_prop_schema ?? {})[0] || "";
          setSelectedTemplateId(templateId);
          setSelectedLayout(firstLayout);
          setAccentColor(preferred.preview_colors?.accent || "#9333ea");
          setBgColor(preferred.preview_colors?.bg         || "#ffffff");
          setTextColor(preferred.preview_colors?.text     || "#111827");
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

  const config = useMemo(
    () => getTemplateConfig(selectedTemplateId || "default", viewSource),
    [selectedTemplateId, viewSource],
  );
  const Composition = config.component as unknown as ComponentType<Record<string, unknown>>;
  const isPortrait  = aspectRatio === "portrait";
  const layoutSupportsImage = useMemo(() => {
    if (!selectedTemplate || !selectedLayout) return false;
    const noImage = selectedTemplate.layouts_without_image ?? [];
    return !noImage.includes(selectedLayout);
  }, [selectedTemplate, selectedLayout]);

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

  const inputProps = useMemo(() => {
    const effectiveImageUrl =
      layoutSupportsImage && fetchedImageUrl && !imageFetching ? fetchedImageUrl : undefined;
    return {
      scenes: [{
        id: 1,
        order: 1,
        title,
        narration,
        layout: selectedLayout || config.heroLayout,
        layoutProps: resolvedLayoutProps,
        durationSeconds,
        imageUrl: effectiveImageUrl,
        voiceoverUrl: undefined,
      }],
      accentColor,
      bgColor,
      textColor,
      logo: null,
      logoPosition: "bottom_right",
      logoOpacity: 0.9,
      logoSize: 100,
      aspectRatio,
    };
  }, [
    title,
    narration,
    selectedLayout,
    config.heroLayout,
    resolvedLayoutProps,
    durationSeconds,
    layoutSupportsImage,
    fetchedImageUrl,
    imageFetching,
    accentColor,
    bgColor,
    textColor,
    aspectRatio,
  ]);

  const layouts          = selectedTemplate?.valid_layouts || Object.keys(selectedTemplate?.layout_prop_schema ?? {});
  const [studioResolution, setStudioResolution] = useState<"1080p" | "720p">(
    () => (selectedTemplateId === "whiteboard" || selectedTemplateId === "newscast" ||selectedTemplateId === "newspaper" ? "720p" : "1080p"),
  );

  // Default resolution per template: Stickman/Whiteboard/Newspaper => 720p, others => 1080p
  useEffect(() => {
    if (!selectedTemplateId) return;
    if (selectedTemplateId === "whiteboard" || selectedTemplateId === "newscast" || selectedTemplateId === "newspaper") {
      setStudioResolution("720p");
    } else {
      setStudioResolution("1080p");
    }
  }, [selectedTemplateId]);
  const baseWidth = studioResolution === "720p" ? 1280 : 1920;
  const baseHeight = studioResolution === "720p" ? 720 : 1080;
  const canvasW          = isPortrait ? baseHeight : baseWidth;
  const canvasH          = isPortrait ? baseWidth : baseHeight;
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
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : "Failed to save source defaults.";
      setSaveMessage(String(msg || "Failed to save source defaults."));
    } finally {
      setSavingSource(false);
    }
  };

  const handleGenerateAiEdit = async () => {
    if (!selectedTemplateId || !selectedLayout) return;
    if (!aiInstruction.trim()) { setAiError("Add an instruction first."); setAiStatus(""); return; }
    try {
      setAiLoading(true); setAiError(""); setAiStatus("");
      const result = aiLayoutImage
        ? await startTemplateAiPreviewFile({
            template_id: selectedTemplateId,
            layout_id: selectedLayout,
            instruction: aiInstruction.trim(),
            image: aiLayoutImage,
          })
        : await startTemplateAiPreview({
            template_id: selectedTemplateId,
            layout_id: selectedLayout,
            instruction: aiInstruction.trim(),
          });
      const data = result.data as StartTemplateAiPreviewResponse;
      setAiPreviewSessionId(data.session_id);
      const versions = data.versions && data.versions.length ? data.versions : ["original", "v1"];
      setAiPreviewVersions(versions);
      setAiPreviewVersion(data.active_version_id ?? versions[versions.length - 1] ?? null);
      setAiStatus("Preview is using AI-generated code. Switch versions to compare, then apply or discard.");
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
      setAiPreviewVersions([]);
      setAiPreviewVersion(null);
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail : "Failed to apply.";
      setAiError(String(msg || "Failed to apply.")); setAiStatus("");
    } finally { setAiApplying(false); }
  };

  const handleSwitchAiPreviewVersion = async (version: string) => {
    if (!aiPreviewSessionId || aiSwitchingVersion) return;
    if (aiPreviewVersion === version) return;
    try {
      setAiSwitchingVersion(true); setAiError("");
      await switchTemplateAiPreviewVersion({ session_id: aiPreviewSessionId, version });
      setAiPreviewVersion(version);
      setAiStatus(`Showing ${version} version. Preview will update.`);
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail : "Failed to switch.";
      setAiError(String(msg || "Failed to switch version."));
    } finally { setAiSwitchingVersion(false); }
  };

  const handleDiscardAiEdit = async () => {
    if (!aiPreviewSessionId) return;
    try {
      setAiDiscarding(true); setAiError(""); setAiStatus("");
      await discardTemplateAiPreview({ session_id: aiPreviewSessionId });
      setAiPreviewSessionId("");
      setAiPreviewVersions([]);
      setAiPreviewVersion(null);
      setAiStatus("Discarded AI preview. Original files restored.");
      // Refresh templates (discard may have removed a created layout)
      const refreshed = await getTemplates();
      setTemplates(refreshed.data);
      // If current layout was removed from selected template, pick another
      const tpl = refreshed.data.find((t) => normalizeTemplateId(t.id) === selectedTemplateId);
      const layoutIds = new Set(tpl?.valid_layouts ?? []);
      if (selectedLayout && !layoutIds.has(selectedLayout)) {
        setSelectedLayout(tpl?.valid_layouts?.[0] ?? refreshed.data[0]?.valid_layouts?.[0] ?? "");
      }
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail : "Failed to discard.";
      setAiError(String(msg || "Failed to discard.")); setAiStatus("");
    } finally { setAiDiscarding(false); }
  };

  // ── Rebuild handler ────────────────────────────────────────────────────────
  const handleRebuildLayout = async () => {
    if (!selectedTemplateId || !selectedLayout || !aiInstruction.trim()) {
      setRebuildError("Select a layout and provide an instruction.");
      return;
    }
    try {
      setRebuildLoading(true); setRebuildError(""); setRebuildStatus("");
      const result = aiLayoutImage
        ? await rebuildTemplateLayoutFile({
            template_id: selectedTemplateId,
            layout_id: selectedLayout,
            instruction: aiInstruction.trim(),
            extra_props: rebuildProps,
            image: aiLayoutImage,
          })
        : await rebuildTemplateLayout({
            template_id: selectedTemplateId,
            layout_id: selectedLayout,
            instruction: aiInstruction.trim(),
            extra_props: rebuildProps,
          });
      const data = result.data;
      setAiPreviewSessionId(data.session_id);
      setAiPreviewVersions(data.versions ?? ["original", "v1"]);
      setAiPreviewVersion(data.active_version_id ?? "v1");
      setAiStatus("Rebuild complete. Switch versions to compare, then apply or discard.");
      setRebuildStatus(`Rebuilt ${data.layout_id}. Updated: ${data.updated_files?.join(", ") ?? ""}`);
      const refreshed = await getTemplates();
      setTemplates(refreshed.data);
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : "Rebuild failed.";
      setRebuildError(String(msg || "Rebuild failed."));
    } finally { setRebuildLoading(false); }
  };

  // ── New layout handler ─────────────────────────────────────────────────────
  const handleCreateLayout = async () => {
    if (!selectedTemplateId || !newLayoutId.trim() || !newBaseLayoutId || !newLayoutDesc.trim()) {
      setNewLayoutError("Fill in all required fields.");
      return;
    }
    try {
      setNewLayoutLoading(true); setNewLayoutError(""); setNewLayoutStatus("");
      const result = newLayoutImage
        ? await createTemplateLayoutFile({
            template_id: selectedTemplateId,
            base_layout_id: newBaseLayoutId,
            new_layout_id: newLayoutId.trim(),
            layout_description: newLayoutDesc.trim(),
            props: newLayoutProps,
            image: newLayoutImage,
          })
        : await createTemplateLayout({
            template_id: selectedTemplateId,
            base_layout_id: newBaseLayoutId,
            new_layout_id: newLayoutId.trim(),
            layout_description: newLayoutDesc.trim(),
            props: newLayoutProps,
          });
      const data = result.data;
      setAiPreviewSessionId(data.session_id);
      setAiPreviewVersions(data.versions ?? ["v1"]);
      setAiPreviewVersion(data.active_version_id ?? "v1");
      setAiStatus("New layout created. Apply to keep or discard to revert.");
      setNewLayoutStatus(`Created '${data.new_layout_id}'. Files: ${data.created_files?.join(", ") ?? ""}`);
      const refreshed = await getTemplates();
      setTemplates(refreshed.data);
      setSelectedLayout(data.new_layout_id);
      setRightTab("edit");
      setNewLayoutId(""); setNewLayoutDesc(""); setNewLayoutImage(null); setNewLayoutProps([]);
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : "Create failed.";
      setNewLayoutError(String(msg || "Create failed."));
    } finally { setNewLayoutLoading(false); }
  };

  const handleRenderSingleLayout = async () => {
    if (!selectedTemplateId || !selectedLayout) return;
    try {
      setLayoutRendering(true);
      setLayoutRenderError("");
      const res = await renderTemplateLayout({
        template_id: selectedTemplateId,
        layout_id: selectedLayout,
        aspect_ratio: aspectRatio,
        duration_seconds: durationSeconds,
        layout_props: resolvedLayoutProps,
        resolution: studioResolution,
      });
      const blob = res.data as unknown as Blob;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedTemplateId}_${selectedLayout}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setLayoutRenderError("Failed to render layout. Please try again.");
    } finally {
      setLayoutRendering(false);
    }
  };

  // Restore existing AI versions for the selected template/layout on change or refresh.
  useEffect(() => {
    if (!selectedTemplateId || !selectedLayout) {
      setAiPreviewSessionId("");
      setAiPreviewVersions([]);
      setAiPreviewVersion(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await getTemplateAiVersions({
          template_id: selectedTemplateId,
          layout_id: selectedLayout,
        });
        if (cancelled) return;
        const data = res.data as ListTemplateAiVersionsResponse;
        if (!data.ok || !data.versions.length || !data.session_id) {
          setAiPreviewSessionId("");
          setAiPreviewVersions([]);
          setAiPreviewVersion(null);
          return;
        }
        setAiPreviewSessionId(data.session_id);
        setAiPreviewVersions(data.versions);
        setAiPreviewVersion(
          data.active_version_id ?? data.versions[data.versions.length - 1] ?? null,
        );
      } catch {
        if (cancelled) return;
        // On failure, just leave AI preview state untouched for this selection.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedTemplateId, selectedLayout]);

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
                    <button
                      type="button"
                      onClick={handleRenderSingleLayout}
                      disabled={!selectedTemplateId || !selectedLayout || layoutRendering}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        marginLeft: "8px",
                        padding: "4px 9px",
                        borderRadius: "999px",
                        border: `1px solid ${T.border}`,
                        background: T.surfaceAlt,
                        color: T.textSub,
                        fontSize: "11px",
                        fontWeight: 500,
                        fontFamily: FONT,
                        cursor: layoutRendering ? "default" : "pointer",
                        opacity: layoutRendering ? 0.7 : 1,
                      }}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      <span>{layoutRendering ? "Rendering…" : "Render"}</span>
                    </button>
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
                  {selectedLayout && (
                    <p
                      style={{
                        marginTop: "6px",
                        fontSize: "10px",
                        color: layoutSupportsImage ? T.textSub : T.textMuted,
                        fontFamily: FONT,
                      }}
                    >
                      {layoutSupportsImage
                        ? "This layout supports images. Use the Edit Modal to add an image and make it appear in the layout."
                        : "This layout does not render scene images."}
                    </p>
                  )}
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
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "9px 14px",
                        borderBottom: `1px solid ${T.border}`,
                        background: T.surfaceAlt,
                      }}
                    >
                      {/* Left: traffic dots + Edit + Toggle */}
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ display: "flex", gap: "5px" }}>
                          {["#ff5f56", "#ffbd2e", "#27c93f"].map((c, i) => (
                            <div
                              key={i}
                              style={{
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                background: c,
                                opacity: 0.6,
                              }}
                            />
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

                        {/* Toggle moved here */}
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "2px",
                            borderRadius: "10px",
                            background: T.surfaceAlt,
                            border: `1px solid ${T.border}`,
                            gap: "2px",
                          }}
                        >
                          {(
                            [
                              { id: "frontend", label: "Frontend file" },
                              { id: "remotion", label: "Remotion build" },
                            ] as const
                          ).map((opt) => {
                            const active = viewSource === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() =>
                                  setViewSource(
                                    opt.id === "frontend" ? "frontend" : "remotion",
                                  )
                                }
                                style={{
                                  border: "none",
                                  borderRadius: "9px",
                                  padding: "4px 8px",
                                  fontSize: "10px",
                                  fontWeight: active ? 600 : 500,
                                  fontFamily: FONT,
                                  cursor: "pointer",
                                  background: active ? T.accent : "transparent",
                                  color: active ? "#ffffff" : T.textSub,
                                  transition: "background 0.15s, color 0.15s",
                                }}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Center: resolution + canvas pill (styled like toggle) */}
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "2px 8px 2px 4px",
                          borderRadius: "10px",
                          background: T.surfaceAlt,
                          gap: "6px",
                        }}
                      >
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "2px",
                            borderRadius: "10px",
                            background: T.surfaceAlt,
                            border: `1px solid ${T.border}`,
                            gap: "2px",
                          }}
                        >
                          {(["720p", "1080p"] as const).map((res) => {
                            const active = res === studioResolution;
                            return (
                              <button
                                key={res}
                                type="button"
                                onClick={() => setStudioResolution(res)}
                                style={{
                                  border: "none",
                                  borderRadius: "9px",
                                  padding: "4px 8px",
                                  fontSize: "10px",
                                  fontWeight: active ? 600 : 500,
                                  fontFamily: FONT,
                                  cursor: "pointer",
                                  background: active ? T.accent : "transparent",
                                  color: active ? "#ffffff" : T.textSub,
                                  transition: "background 0.15s, color 0.15s",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {res}
                              </button>
                            );
                          })}
                        </div>
                        <span
                          style={{
                            fontSize: "10px",
                            color: T.textMuted,
                            fontFamily: FONT,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {canvasW} × {canvasH} · {durationInFrames}f · 30fps
                        </span>
                      </div>

                      {/* Right: Rendering badge */}
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <div
                          style={{
                            width: "5px",
                            height: "5px",
                            borderRadius: "50%",
                            background: T.green,
                          }}
                        />
                        <span
                          style={{
                            fontSize: "10px",
                            color: T.green,
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            fontFamily: FONT,
                          }}
                        >
                          RENDERING
                        </span>
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
                      maxHeight: isPortrait ? "420px" : "540px",
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
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", alignItems: "stretch" }}>
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

              {/* ══ RIGHT: AI panel (tabbed) ══ */}
              <aside className="glass-card" style={{ padding: "0", overflowY: "auto", maxHeight: "calc(100vh - 80px)", display: "flex", flexDirection: "column" }}>

                {/* Tab bar */}
                <div style={{
                  display: "flex", borderBottom: `1px solid ${T.border}`,
                  background: T.surfaceAlt, borderRadius: "12px 12px 0 0", flexShrink: 0,
                }}>
                  {(["edit", "new-layout"] as const).map((tab) => {
                    const label = tab === "edit" ? "Edit" : "New Layout";
                    const isActive = rightTab === tab;
                    return (
                      <button
                        key={tab} type="button"
                        onClick={() => setRightTab(tab)}
                        style={{
                          flex: 1, padding: "10px 8px", border: "none",
                          borderBottom: isActive ? `2px solid ${T.accent}` : "2px solid transparent",
                          background: "transparent",
                          fontSize: "11px", fontWeight: isActive ? 700 : 500, fontFamily: FONT,
                          color: isActive ? T.accent : T.textSub,
                          cursor: "pointer", transition: "all 0.13s",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* ── Tab: AI Edit ── */}
                {rightTab === "edit" && (
                <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>

                  {/* Mode toggle — matches BlogUrlForm tab style */}
                  <div>
                    <FieldLabel>Mode</FieldLabel>
                    <div className="flex gap-1 p-1 bg-gray-100/60 rounded-xl w-fit mt-1">
                      {(["code-only", "rebuild"] as const).map((m) => {
                        const label = m === "code-only" ? "Edit Layout" : "Rebuild layout";
                        const isActive = aiMode === m;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => { setAiMode(m); setRebuildError(""); setRebuildStatus(""); }}
                            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              isActive ? "bg-white text-purple-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <FieldLabel>Instruction</FieldLabel>
                    <textarea
                      className="studio-input"
                      placeholder={aiMode === "code-only"
                        ? "Describe the edit — e.g. 'move the title higher, make the subtitle lighter.'"
                        : "Describe the rebuild — e.g. 'Add a progress bar and highlight color support.'"}
                      value={aiInstruction}
                      onChange={(e) => setAiInstruction(e.target.value)}
                      rows={aiMode === "rebuild" ? 6 : 9}
                      style={{ ...inputBase, resize: "vertical" as const, lineHeight: "1.6", background: T.surfaceAlt }}
                    />
                  </div>

                  <ImageAttachRow
                    image={aiLayoutImage}
                    onImageChange={setAiLayoutImage}
                    label="Reference image (optional)"
                  />

                  {/* Rebuild: extra props editor */}
                  {aiMode === "rebuild" && (
                    <div>
                      <FieldLabel>Extra props to add</FieldLabel>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                        {rebuildProps.map((p, i) => (
                          <PropDefRow
                            key={i} prop={p}
                            onChange={(updated) => setRebuildProps((prev) => prev.map((x, j) => j === i ? updated : x))}
                            onRemove={() => setRebuildProps((prev) => prev.filter((_, j) => j !== i))}
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => setRebuildProps((prev) => [...prev, { name: "", type: "string", description: "" }])}
                          style={{
                            padding: "6px 10px", border: `1px dashed ${T.border}`, borderRadius: "8px",
                            background: "transparent", color: T.textSub, fontSize: "11px", fontFamily: FONT,
                            cursor: "pointer",
                          }}
                        >
                          + Add prop
                        </button>
                      </div>
                    </div>
                  )}

                  {aiMode === "code-only" ? (
                    <button type="button" className="btn-primary"
                      disabled={aiLoading || aiApplying || aiDiscarding || !aiInstruction.trim()}
                      onClick={handleGenerateAiEdit}
                    >
                      <IconWand />
                      {aiLoading ? "Generating preview…" : "Generate"}
                    </button>
                  ) : (
                    <button type="button" className="btn-primary"
                      disabled={rebuildLoading || !aiInstruction.trim()}
                      onClick={handleRebuildLayout}
                    >
                      <IconWand />
                      {rebuildLoading ? "Rebuilding…" : "Rebuild layout"}
                    </button>
                  )}

                  {aiMode === "rebuild" && rebuildError && (
                    <div style={{
                      padding: "8px 10px", borderRadius: "6px",
                      background: "#fee2e2", border: "1px solid #fecaca",
                      fontSize: "11px", fontFamily: FONT, color: "#dc2626",
                    }}>
                      {rebuildError}
                    </div>
                  )}

                  {aiPreviewSessionId && (
                    <>
                      <div>
                        <FieldLabel>Compare versions</FieldLabel>
                        <div style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "4px",
                          marginTop: "4px",
                          background: T.surfaceAlt, border: `1px solid ${T.border}`,
                          borderRadius: "8px", padding: "2px",
                        }}>
                          {aiPreviewVersions.map((ver) => {
                            const isActive = aiPreviewVersion === ver;
                            const label =
                              ver === "original"
                                ? "Original"
                                : ver.startsWith("v")
                                  ? `Version ${ver.slice(1)}`
                                  : ver;
                            return (
                              <button
                                key={ver}
                                type="button"
                                disabled={aiSwitchingVersion || aiApplying || aiDiscarding}
                                onClick={() => handleSwitchAiPreviewVersion(ver)}
                                style={{
                                  flex: "0 0 auto",
                                  padding: "6px 10px",
                                  border: "none",
                                  borderRadius: "6px",
                                  fontSize: "11px", fontWeight: 500, fontFamily: FONT,
                                  cursor: aiSwitchingVersion || aiApplying || aiDiscarding ? "not-allowed" : "pointer",
                                  background: isActive ? T.accent : "transparent",
                                  color: isActive ? "#fff" : T.textSub,
                                  opacity: aiSwitchingVersion || aiApplying || aiDiscarding ? 0.6 : 1,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
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

                  {aiError && (
                    <div style={{
                      padding: "8px 10px", borderRadius: "6px",
                      background: "#fee2e2", border: "1px solid #fecaca",
                      fontSize: "11px", fontFamily: FONT, color: "#dc2626",
                    }}>
                      {aiError}
                    </div>
                  )}
                </div>
                )}

                {/* ── Tab: New Layout ── */}
                {rightTab === "new-layout" && (
                <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>

                  <div className="left-section">
                    <StudioDropdown
                      sectionLabel="Base layout"
                      value={newBaseLayoutId}
                      onChange={setNewBaseLayoutId}
                      options={[{ value: "", label: "— select —" }, ...layoutOptions]}
                    />
                    <p style={{ margin: "6px 0 0", fontSize: "10px", color: T.textMuted, fontFamily: FONT, lineHeight: "1.5" }}>
                      Style reference for the new layout. The generated component will match this layout&apos;s visuals and animations.
                    </p>
                  </div>

                  <div>
                    <FieldLabel>New layout ID (snake_case)</FieldLabel>
                    <input
                      className="studio-input"
                      placeholder="e.g. breaking_news"
                      value={newLayoutId}
                      onChange={(e) => setNewLayoutId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                      style={{ ...inputBase, background: T.surfaceAlt }}
                    />
                  </div>

                  <div>
                    <FieldLabel>Layout description</FieldLabel>
                    <textarea
                      className="studio-input"
                      placeholder="Describe the visual style and purpose of this layout…"
                      value={newLayoutDesc}
                      onChange={(e) => setNewLayoutDesc(e.target.value)}
                      rows={4}
                      style={{ ...inputBase, resize: "vertical" as const, lineHeight: "1.6", background: T.surfaceAlt }}
                    />
                  </div>

                  <ImageAttachRow
                    image={newLayoutImage}
                    onImageChange={setNewLayoutImage}
                    label="Reference image (optional)"
                  />

                  <div>
                    <FieldLabel>Props</FieldLabel>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                      {newLayoutProps.map((p, i) => (
                        <PropDefRow
                          key={i} prop={p}
                          onChange={(updated) => setNewLayoutProps((prev) => prev.map((x, j) => j === i ? updated : x))}
                          onRemove={() => setNewLayoutProps((prev) => prev.filter((_, j) => j !== i))}
                        />
                      ))}
                      <button
                        type="button"
                        onClick={() => setNewLayoutProps((prev) => [...prev, { name: "", type: "string", description: "" }])}
                        style={{
                          padding: "6px 10px", border: `1px dashed ${T.border}`, borderRadius: "8px",
                          background: "transparent", color: T.textSub, fontSize: "11px", fontFamily: FONT,
                          cursor: "pointer",
                        }}
                      >
                        + Add prop
                      </button>
                    </div>
                  </div>

                  <button
                    type="button" className="btn-primary"
                    disabled={newLayoutLoading || !newLayoutId.trim() || !newBaseLayoutId || !newLayoutDesc.trim()}
                    onClick={handleCreateLayout}
                  >
                    <IconWand />
                    {newLayoutLoading ? "Creating…" : "Create layout"}
                  </button>

                  {newLayoutError && (
                    <div style={{
                      padding: "8px 10px", borderRadius: "6px",
                      background: "#fee2e2", border: "1px solid #fecaca",
                      fontSize: "11px", fontFamily: FONT, color: "#dc2626",
                    }}>
                      {newLayoutError}
                    </div>
                  )}
                </div>
                )}

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
