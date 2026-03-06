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

function getSchema(template: TemplateMeta | null, layoutId: string | null): LayoutPropSchema | undefined {
  if (!template || !layoutId) return undefined;
  const explicit = template.layout_prop_schema?.[layoutId];
  if (explicit) return explicit;

  const responsiveFields: LayoutPropField[] = [
    {
      key: "titleFontSize",
      label: "Title Font Size",
      type: "number",
      responsive: true,
      min: 20,
      max: 180,
      step: 1,
    },
    {
      key: "descriptionFontSize",
      label: "Description Font Size",
      type: "number",
      responsive: true,
      min: 12,
      max: 100,
      step: 1,
    },
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

// ─── Icons ───────────────────────────────────────────────────────────────────

const Icon = ({ d, size = 14 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const IconGrid    = () => <Icon d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />;
const IconLayout  = () => <Icon d="M3 3h18v18H3zM3 9h18M9 21V9" />;
const IconType    = () => <Icon d="M4 7V4h16v3M9 20h6M12 4v16" />;
const IconLink    = () => <Icon d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />;
const IconDroplet = () => <Icon d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />;
const IconReset   = () => <Icon d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5" />;
const IconSliders = () => <Icon d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />;
const IconWand    = () => <Icon d="M15 4V2M15 6v2M21 10h-2M7 10H5M18.3 6.7l-1.4-1.4M11.1 13.9l-7 7 1.4 1.4 7-7M11.7 6.7l1.4-1.4M18.9 13.9l1.4 1.4" />;
const IconSave    = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/>
    <polyline points="7 3 7 8 15 8"/>
  </svg>
);

// ─── Design Tokens ────────────────────────────────────────────────────────────

const T = {
  bg:           "#ffffff",
  surface:      "#ffffff",
  surfaceAlt:   "#f7f7fb",
  surfaceHover: "#f0f0f8",
  border:       "#e6e6f0",
  borderStrong: "#d0d0e4",
  accent:       "#4f46e5",
  accentLight:  "#eef2ff",
  accentMid:    "#818cf8",
  accentDark:   "#3730a3",
  text:         "#0f0f1a",
  textSub:      "#5c5c78",
  textMuted:    "#9898b8",
  green:        "#16a34a",
  greenBg:      "#f0fdf4",
  greenBorder:  "#bbf7d0",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function PanelSection({
  icon, label, children, last = false,
}: {
  icon: React.ReactNode; label: string; children: React.ReactNode; last?: boolean;
}) {
  return (
    <div style={{
      paddingBottom: last ? 0 : "18px",
      marginBottom:  last ? 0 : "18px",
      borderBottom:  last ? "none" : `1px solid ${T.border}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "12px" }}>
        <span style={{ color: T.accentMid }}>{icon}</span>
        <span style={{
          fontSize: "10px", fontWeight: 700, letterSpacing: "0.13em",
          textTransform: "uppercase" as const, color: T.textSub,
          fontFamily: "'Geist Mono', 'DM Mono', monospace",
        }}>
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: string }) {
  return (
    <label style={{
      display: "block", fontSize: "10.5px", fontWeight: 600,
      color: T.textSub, marginBottom: "5px",
      fontFamily: "'Geist Mono', 'DM Mono', monospace",
      letterSpacing: "0.04em",
    }}>
      {children}
    </label>
  );
}

const inputBase: React.CSSProperties = {
  width: "100%", padding: "8px 11px",
  background: T.surfaceAlt,
  border: `1px solid ${T.border}`,
  borderRadius: "8px", color: T.text,
  fontSize: "13px", fontFamily: "'Geist Mono', 'DM Mono', monospace",
  outline: "none", boxSizing: "border-box",
  transition: "border-color 0.15s, box-shadow 0.15s",
};

function StudioSelect({ value, onChange, children }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="studio-input"
      style={{
        ...inputBase,
        appearance: "none" as const,
        cursor: "pointer",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235c5c78' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 10px center",
        paddingRight: "30px",
      }}
    >
      {children}
    </select>
  );
}

function StudioInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <input
      type="text" value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="studio-input"
      style={{ ...inputBase }}
    />
  );
}

function StudioTextarea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
      className="studio-input"
      style={{ ...inputBase, resize: "vertical" as const, lineHeight: "1.6" }}
    />
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function TemplateStudio() {
  const [templates, setTemplates]               = useState<TemplateMeta[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedLayout, setSelectedLayout]     = useState<string>("");
  const [title, setTitle]                       = useState<string>("Hello World!");
  const [narration, setNarration]               = useState<string>("Edit props live and preview exactly how this layout renders.");
  const [aspectRatio, setAspectRatio]           = useState<AspectRatio>("landscape");
  const [durationSeconds, setDurationSeconds]   = useState<number>(5);
  const [imageUrl, setImageUrl]                 = useState<string>("");
  const [accentColor, setAccentColor]           = useState<string>("#4f46e5");
  const [bgColor, setBgColor]                   = useState<string>("#ffffff");
  const [textColor, setTextColor]               = useState<string>("#0f0f1a");
  const [layoutProps, setLayoutProps]           = useState<Record<string, unknown>>({});
  const [savingSource, setSavingSource]         = useState(false);
  const [saveMessage, setSaveMessage]           = useState<string>("");
  const [fetchedImageUrl, setFetchedImageUrl]   = useState<string>("");
  const [imageFetching, setImageFetching]       = useState(false);
  const [imageError, setImageError]             = useState<string>("");
  const [aiInstruction, setAiInstruction]       = useState("");
  const [aiLoading, setAiLoading]               = useState(false);
  const [aiApplying, setAiApplying]             = useState(false);
  const [aiDiscarding, setAiDiscarding]         = useState(false);
  const [aiError, setAiError]                   = useState("");
  const [aiStatus, setAiStatus]                 = useState("");
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
          setAccentColor(first.preview_colors?.accent || "#4f46e5");
          setBgColor(first.preview_colors?.bg         || "#ffffff");
          setTextColor(first.preview_colors?.text     || "#0f0f1a");
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
    if (sd.title)           setTitle(sd.title);
    if (sd.narration !== undefined) setNarration(sd.narration);
    if (sd.durationSeconds) setDurationSeconds(sd.durationSeconds);
  }, [schema]);

  const config      = useMemo(() => getTemplateConfig(selectedTemplateId || "default"), [selectedTemplateId]);
  const Composition = config.component as unknown as ComponentType<Record<string, unknown>>;
  const isPortrait  = aspectRatio === "portrait";

  // Fetch image URL and convert to base64 to avoid CORS issues in the player
  useEffect(() => {
    const url = imageUrl.trim();
    if (!url) {
      setFetchedImageUrl("");
      setImageError("");
      return;
    }
    let cancelled = false;
    setImageFetching(true);
    setImageError("");
    setFetchedImageUrl("");
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onload = () => {
          if (!cancelled) {
            setFetchedImageUrl(reader.result as string);
            setImageFetching(false);
          }
        };
        reader.onerror = () => {
          if (!cancelled) {
            setImageError("Failed to read image.");
            setImageFetching(false);
          }
        };
        reader.readAsDataURL(blob);
      } catch (e: unknown) {
        if (!cancelled) {
          setImageError(e instanceof Error ? e.message : "Failed to fetch image.");
          setImageFetching(false);
        }
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
        if (isResponsiveValue(raw)) {
          next[field.key] = isPortrait ? raw.portrait : raw.landscape;
        }
      }
    });
    return next;
  }, [schema, layoutProps, isPortrait]);

  const inputProps = useMemo(() => ({
    scenes: [{
      id: 1, order: 1, title, narration,
      layout: selectedLayout || config.heroLayout,
      layoutProps: resolvedLayoutProps, durationSeconds,
      imageUrl: fetchedImageUrl || (imageFetching ? undefined : "https://placehold.co/1920x1080/eef2ff/818cf8?text=No+Image"),
      voiceoverUrl: undefined,
    }],
    accentColor, bgColor, textColor,
    logo: null, logoPosition: "bottom_right",
    logoOpacity: 0.9, logoSize: 100, aspectRatio,
  }), [title, narration, selectedLayout, config.heroLayout, resolvedLayoutProps, durationSeconds,
      fetchedImageUrl, accentColor, bgColor, textColor, aspectRatio]);

  const layouts          = selectedTemplate?.valid_layouts || Object.keys(selectedTemplate?.layout_prop_schema ?? {});
  const canvasW          = isPortrait ? 1080 : 1920;
  const canvasH          = isPortrait ? 1920 : 1080;
  const durationInFrames = Math.max(30, Math.round(durationSeconds * 30));
  const sliderPct        = Math.round(((durationSeconds - 2) / 10) * 100);

  const handleSaveSource = async () => {
    if (!selectedTemplateId || !selectedLayout) return;
    const titleValue = layoutProps.titleFontSize;
    const descValue  = layoutProps.descriptionFontSize;
    if (!isResponsiveValue(titleValue) && !isResponsiveValue(descValue)) {
      setSaveMessage("No responsive font-size values to save for this layout.");
      return;
    }
    try {
      setSavingSource(true);
      setSaveMessage("");
      const result = await saveTemplateSourceDefaults({
        template_id: selectedTemplateId,
        layout_id:   selectedLayout,
        ...(isResponsiveValue(titleValue) ? { title_font_size: titleValue }      : {}),
        ...(isResponsiveValue(descValue)  ? { description_font_size: descValue } : {}),
      });
      const updatedFiles = result.data.updated_files?.length
        ? result.data.updated_files.join(", ")
        : result.data.updated_file;
      const metaNote = result.data.updated_meta_file
        ? ` Meta updated: ${result.data.updated_meta_file}.`
        : "";
      setSaveMessage(`Saved to source: ${updatedFiles}.${metaNote}`);

      // Keep Studio schema state in sync so Reset uses freshly saved defaults immediately.
      setTemplates((prev) =>
        prev.map((tpl) => {
          if (normalizeTemplateId(tpl.id) !== selectedTemplateId) return tpl;
          const schema = tpl.layout_prop_schema ?? {};
          const currentLayoutSchema = schema[selectedLayout];
          if (!currentLayoutSchema) return tpl;
          const defaults = { ...(currentLayoutSchema.defaults ?? {}) };
          if (isResponsiveValue(titleValue)) defaults.titleFontSize = titleValue;
          if (isResponsiveValue(descValue)) defaults.descriptionFontSize = descValue;
          return {
            ...tpl,
            layout_prop_schema: {
              ...schema,
              [selectedLayout]: {
                ...currentLayoutSchema,
                defaults,
              },
            },
          };
        })
      );
    } catch {
      setSaveMessage("Failed to save source code defaults.");
    } finally {
      setSavingSource(false);
    }
  };

  const handleGenerateAiEdit = async () => {
    if (!selectedTemplateId || !selectedLayout) return;
    if (!aiInstruction.trim()) {
      setAiError("Add an instruction for Gemini first.");
      setAiStatus("");
      return;
    }
    try {
      setAiLoading(true);
      setAiError("");
      setAiStatus("");
      const result = await startTemplateAiPreview({
        template_id: selectedTemplateId,
        layout_id: selectedLayout,
        instruction: aiInstruction.trim(),
      });
      setAiPreviewSessionId(result.data.session_id);
      setAiStatus("Preview is now using AI-generated code. Review the scene and apply or discard.");
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : "Failed to start AI preview.";
      setAiError(String(msg || "Failed to start AI preview."));
      setAiStatus("");
    } finally {
      setAiLoading(false);
    }
  };

  const handleApplyAiEdit = async () => {
    if (!aiPreviewSessionId) return;
    try {
      setAiApplying(true);
      setAiError("");
      setAiStatus("");
      const result = await applyTemplateAiPreview({
        session_id: aiPreviewSessionId,
      });
      const updated = result.data.updated_files.join(", ");
      setAiStatus(`Applied AI edit to: ${updated}`);
      setAiPreviewSessionId("");
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : "Failed to apply AI preview.";
      setAiError(String(msg || "Failed to apply AI edit."));
      setAiStatus("");
    } finally {
      setAiApplying(false);
    }
  };

  const handleDiscardAiEdit = async () => {
    if (!aiPreviewSessionId) return;
    try {
      setAiDiscarding(true);
      setAiError("");
      setAiStatus("");
      await discardTemplateAiPreview({ session_id: aiPreviewSessionId });
      setAiPreviewSessionId("");
      setAiStatus("Discarded AI preview and restored original component files.");
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : "Failed to discard AI preview.";
      setAiError(String(msg || "Failed to discard AI preview."));
      setAiStatus("");
    } finally {
      setAiDiscarding(false);
    }
  };

  useEffect(() => {
    return () => {
      if (!aiPreviewSessionId) return;
      void discardTemplateAiPreview({ session_id: aiPreviewSessionId }).catch(() => undefined);
    };
  }, [aiPreviewSessionId]);

  useEffect(() => {
    const key = `${selectedTemplateId}::${selectedLayout}`;
    if (!previewSelectionRef.current) {
      previewSelectionRef.current = key;
      return;
    }
    if (previewSelectionRef.current !== key && aiPreviewSessionId) {
      const sessionId = aiPreviewSessionId;
      setAiPreviewSessionId("");
      setAiStatus("Selection changed. Previous AI preview was discarded and originals were restored.");
      void discardTemplateAiPreview({ session_id: sessionId }).catch(() => undefined);
    }
    previewSelectionRef.current = key;
  }, [selectedTemplateId, selectedLayout, aiPreviewSessionId]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist+Mono:wght@400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .studio-root {
          font-family: 'Geist Mono', 'DM Mono', monospace;
          background: ${T.bg};
          color: ${T.text};
          height: 100vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        /* Input focus ring */
        .studio-input:focus {
          border-color: ${T.accent} !important;
          box-shadow: 0 0 0 3px ${T.accentLight} !important;
          background: #fff !important;
          outline: none;
        }

        /* Layout chips */
        .layout-chip {
          padding: 4px 12px;
          border-radius: 100px;
          border: 1.5px solid ${T.border};
          background: ${T.surfaceAlt};
          color: ${T.textSub};
          font-size: 11px;
          cursor: pointer;
          font-family: 'Geist Mono', monospace;
          letter-spacing: 0.03em;
          transition: all 0.13s ease;
          white-space: nowrap;
        }
        .layout-chip:hover  { border-color: ${T.accentMid}; color: ${T.accent}; background: ${T.accentLight}; }
        .layout-chip.active { border-color: ${T.accent};    background: ${T.accentLight}; color: ${T.accent}; font-weight: 600; }

        /* Aspect buttons */
        .aspect-btn {
          flex: 1;
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          padding: 10px 8px;
          border-radius: 10px;
          border: 1.5px solid ${T.border};
          background: ${T.surfaceAlt};
          color: ${T.textSub};
          font-size: 11px; font-family: 'Geist Mono', monospace;
          cursor: pointer;
          transition: all 0.13s ease;
          letter-spacing: 0.04em;
        }
        .aspect-btn:hover  { border-color: ${T.accentMid}; color: ${T.accent}; }
        .aspect-btn.active { border-color: ${T.accent}; background: ${T.accentLight}; color: ${T.accent}; font-weight: 600; }

        /* Reset button */
        .reset-btn {
          width: 100%; padding: 9px 14px;
          display: flex; align-items: center; justify-content: center; gap: 7px;
          border-radius: 8px;
          border: 1.5px solid ${T.border};
          background: ${T.surfaceAlt};
          color: ${T.textSub};
          font-size: 11px; font-family: 'Geist Mono', monospace;
          letter-spacing: 0.08em;
          cursor: pointer;
          transition: all 0.13s ease;
        }
        .reset-btn:hover { border-color: ${T.accent}; color: ${T.accent}; background: ${T.accentLight}; }

        /* Range slider */
        input[type="range"].studio-range {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 3px;
          border-radius: 3px; outline: none; cursor: pointer;
          background: linear-gradient(
            to right,
            ${T.accent} 0%, ${T.accent} ${sliderPct}%,
            ${T.border}  ${sliderPct}%, ${T.border}  100%
          );
        }
        input[type="range"].studio-range::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 16px; height: 16px;
          border-radius: 50%;
          background: #fff;
          border: 2px solid ${T.accent};
          box-shadow: 0 1px 4px rgba(79,70,229,0.22), 0 0 0 3px ${T.accentLight};
          cursor: pointer;
          transition: box-shadow 0.13s;
        }
        input[type="range"].studio-range::-webkit-slider-thumb:hover {
          box-shadow: 0 1px 6px rgba(79,70,229,0.35), 0 0 0 5px ${T.accentLight};
        }

        /* Color picker */
        input[type="color"].color-swatch {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 100%;
          border: none; padding: 0; cursor: pointer;
        }
        input[type="color"].color-swatch::-webkit-color-swatch-wrapper { padding: 0; }
        input[type="color"].color-swatch::-webkit-color-swatch          { border: none; border-radius: 7px; }

        /* Scrollbar */
        ::-webkit-scrollbar       { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.borderStrong}; border-radius: 4px; }

        @keyframes spin     { to { transform: rotate(360deg); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

        .studio-grid { animation: fadeInUp 0.3s ease both; }

        /* Panel card */
        .panel {
          background: ${T.surface};
          border: 1px solid ${T.border};
          border-radius: 14px;
        }
      `}</style>

      <div className="studio-root">

        {/* ── Top Bar ── */}
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 24px", height: "52px",
          borderBottom: `1px solid ${T.border}`,
          background: T.bg,
          flexShrink: 0,
          zIndex: 50,
        }}>
          {/* Wordmark */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
              <span style={{
                fontFamily: "'Instrument Serif', serif",
                fontSize: "17px",
                color: T.text,
                letterSpacing: "0.01em",
              }}>
                Template Studio
              </span>
            </div>

            {selectedTemplate && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "1px", height: "16px", background: T.border }} />
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  padding: "3px 10px", borderRadius: "100px",
                  background: T.surfaceAlt, border: `1px solid ${T.border}`,
                  fontSize: "11px", color: T.textSub, fontFamily: "Geist Mono, monospace",
                }}>
                  {selectedTemplate.name}
                  {selectedLayout && (
                    <>
                      <span style={{ color: T.border, fontSize: "10px" }}>·</span>
                      <span style={{ color: T.accent, fontWeight: 600 }}>{humanize(selectedLayout)}</span>
                    </>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Status pills */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "11px", color: T.textMuted, fontFamily: "Geist Mono, monospace" }}>
              {isPortrait ? "9:16" : "16:9"} · {durationSeconds}s
            </span>
            <div style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "4px 11px", borderRadius: "100px",
              background: T.greenBg, border: `1px solid ${T.greenBorder}`,
            }}>
              <div style={{
                width: "6px", height: "6px", borderRadius: "50%",
                background: T.green, boxShadow: `0 0 0 2px #dcfce7`,
              }} />
              <span style={{
                fontSize: "10px", color: T.green,
                fontWeight: 700, letterSpacing: "0.1em",
                fontFamily: "Geist Mono, monospace",
              }}>
                LIVE
              </span>
            </div>
          </div>
        </header>

        {/* ── Main Content ──
            flex: 1 + overflow: hidden keeps this from growing beyond the viewport.
            The side panels scroll internally; the center panel never scrolls.
        */}
        <main style={{ padding: "16px 20px 28px", background: T.bg, flex: 1, minHeight: 0, overflow: "hidden" }}>

          {/* Loading */}
          {loading && (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", height: "300px", gap: "14px",
            }}>
              <div style={{
                width: "30px", height: "30px",
                border: `2px solid ${T.border}`,
                borderTopColor: T.accent,
                borderRadius: "50%",
                animation: "spin 0.7s linear infinite",
              }} />
              <span style={{
                fontSize: "11px", color: T.textMuted,
                letterSpacing: "0.13em", fontFamily: "Geist Mono, monospace",
              }}>
                LOADING TEMPLATES
              </span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              padding: "14px 18px", borderRadius: "10px",
              background: "#fef2f2", border: "1px solid #fecaca",
              color: "#dc2626", fontSize: "13px",
              fontFamily: "Geist Mono, monospace",
            }}>
              {error}
            </div>
          )}

          {/* Studio grid */}
          {!loading && !error && selectedTemplate && (
            <div
              className="studio-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "272px 1fr 284px",
                gap: "14px",
                alignItems: "start",
                // Fill full remaining height so side panels can scroll within it
                height: "100%",
              }}
            >

              {/* ══ LEFT: Controls — scrolls internally ══ */}
              <aside className="panel" style={{
                padding: "18px",
                overflowY: "auto",
                maxHeight: "calc(100vh - 84px)",
              }}>

                {/* Template */}
                <PanelSection icon={<IconGrid />} label="Template">
                  <StudioSelect
                    value={selectedTemplateId}
                    onChange={(nextId) => {
                      const next = templates.find((t) => normalizeTemplateId(t.id) === nextId) || null;
                      setSelectedTemplateId(nextId);
                      if (next) {
                        const nl = next.hero_layout || next.valid_layouts?.[0] || Object.keys(next.layout_prop_schema ?? {})[0] || "";
                        setSelectedLayout(nl);
                        setAccentColor(next.preview_colors?.accent || accentColor);
                        setBgColor(next.preview_colors?.bg         || bgColor);
                        setTextColor(next.preview_colors?.text     || textColor);
                      }
                    }}
                  >
                    {templates.map((tpl) => {
                      const id = normalizeTemplateId(tpl.id);
                      return <option key={id} value={id}>{tpl.name}</option>;
                    })}
                  </StudioSelect>
                </PanelSection>

                {/* Layout chips */}
                <PanelSection icon={<IconLayout />} label="Layout">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                    {layouts.map((layoutId) => {
                      const label = selectedTemplate.layout_prop_schema?.[layoutId]?.label || humanize(layoutId);
                      return (
                        <button
                          key={layoutId} type="button"
                          className={`layout-chip${selectedLayout === layoutId ? " active" : ""}`}
                          onClick={() => setSelectedLayout(layoutId)}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </PanelSection>

                {/* Content */}
                <PanelSection icon={<IconType />} label="Content">
                  <FieldLabel>Title</FieldLabel>
                  <div style={{ marginBottom: "12px" }}>
                    <StudioInput value={title} onChange={setTitle} />
                  </div>
                  <FieldLabel>Narration</FieldLabel>
                  <StudioTextarea value={narration} onChange={setNarration} />
                </PanelSection>

                {/* Media */}
                <PanelSection icon={<IconLink />} label="Media">
                  <FieldLabel>Image URL</FieldLabel>
                  <StudioInput value={imageUrl} onChange={setImageUrl} placeholder="https://..." />
                  {imageFetching && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "7px" }}>
                      <div style={{
                        width: "10px", height: "10px", borderRadius: "50%",
                        border: `1.5px solid ${T.border}`, borderTopColor: T.accent,
                        animation: "spin 0.7s linear infinite", flexShrink: 0,
                      }} />
                      <span style={{ fontSize: "10px", color: T.textMuted, fontFamily: "Geist Mono, monospace" }}>
                        Fetching image…
                      </span>
                    </div>
                  )}
                  {!imageFetching && imageUrl.trim() && (
                    <div style={{
                      marginTop: "8px", borderRadius: "7px", overflow: "hidden",
                      border: `1px solid ${imageError ? "#fecaca" : T.border}`,
                      background: T.surfaceAlt,
                      minHeight: "80px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      position: "relative",
                    }}>
                      {fetchedImageUrl ? (
                        <img
                          src={fetchedImageUrl}
                          alt="preview"
                          style={{ width: "100%", display: "block", maxHeight: "120px", objectFit: "cover" }}
                        />
                      ) : (
                        <div style={{
                          display: "flex", flexDirection: "column", alignItems: "center",
                          gap: "5px", padding: "14px",
                        }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={imageError ? "#dc2626" : T.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                          </svg>
                          <span style={{
                            fontSize: "10px", color: imageError ? "#dc2626" : T.textMuted,
                            fontFamily: "Geist Mono, monospace", textAlign: "center",
                          }}>
                            {imageError || "No image"}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </PanelSection>

                {/* Format */}
                <PanelSection icon={<IconLayout />} label="Format">
                  <FieldLabel>Aspect Ratio</FieldLabel>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                    {(["landscape", "portrait"] as AspectRatio[]).map((ar) => (
                      <button
                        key={ar} type="button"
                        className={`aspect-btn${aspectRatio === ar ? " active" : ""}`}
                        onClick={() => setAspectRatio(ar)}
                      >
                        <div style={{
                          width:  ar === "landscape" ? "24px" : "14px",
                          height: ar === "landscape" ? "14px" : "24px",
                          borderRadius: "3px",
                          border: `2px solid ${aspectRatio === ar ? T.accent : T.borderStrong}`,
                          background: aspectRatio === ar ? T.accentLight : "transparent",
                          transition: "all 0.13s",
                        }} />
                        {ar === "landscape" ? "16:9" : "9:16"}
                      </button>
                    ))}
                  </div>

                  <FieldLabel>Duration</FieldLabel>
                  <input
                    type="range" min={2} max={12} step={1}
                    value={durationSeconds}
                    onChange={(e) => setDurationSeconds(Number(e.target.value))}
                    className="studio-range"
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}>
                    <span style={{ fontSize: "10px", color: T.textMuted, fontFamily: "Geist Mono, monospace" }}>2s</span>
                    <span style={{
                      fontSize: "12px", color: T.accent, fontWeight: 600,
                      fontFamily: "Geist Mono, monospace",
                      background: T.accentLight,
                      padding: "1px 9px", borderRadius: "100px",
                      border: `1px solid ${T.accentMid}44`,
                    }}>
                      {durationSeconds}s
                    </span>
                    <span style={{ fontSize: "10px", color: T.textMuted, fontFamily: "Geist Mono, monospace" }}>12s</span>
                  </div>
                </PanelSection>

                {/* Colors */}
                <PanelSection icon={<IconDroplet />} label="Colors" last>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                    {[
                      { label: "Accent", value: accentColor, set: setAccentColor },
                      { label: "BG",     value: bgColor,     set: setBgColor     },
                      { label: "Text",   value: textColor,   set: setTextColor   },
                    ].map(({ label, value, set }) => (
                      <div key={label}>
                        <FieldLabel>{label}</FieldLabel>
                        <div style={{
                          width: "100%", height: "36px",
                          borderRadius: "8px", overflow: "hidden",
                          border: `1.5px solid ${T.border}`,
                          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                        }}>
                          <input
                            type="color" value={value}
                            onChange={(e) => set(e.target.value)}
                            className="color-swatch"
                          />
                        </div>
                        <div style={{
                          fontSize: "9px", color: T.textMuted,
                          textAlign: "center", marginTop: "4px",
                          fontFamily: "Geist Mono, monospace", letterSpacing: "0.04em",
                        }}>
                          {value.toUpperCase()}
                        </div>
                      </div>
                    ))}
                  </div>
                </PanelSection>
              </aside>

              {/* ══ CENTER: Preview ══ */}
              <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

                <div className="panel" style={{
                  overflow: "hidden",
                  boxShadow: `0 1px 2px rgba(0,0,0,0.04), 0 4px 20px rgba(79,70,229,0.06)`,
                }}>
                  {/* Chrome bar */}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 16px",
                    borderBottom: `1px solid ${T.border}`,
                    background: T.surfaceAlt,
                  }}>
                    {/* Traffic dots */}
                    <div style={{ display: "flex", gap: "6px" }}>
                      {["#ff5f56", "#ffbd2e", "#27c93f"].map((c, i) => (
                        <div key={i} style={{
                          width: "9px", height: "9px", borderRadius: "50%",
                          background: c, opacity: 0.65,
                        }} />
                      ))}
                    </div>

                    {/* URL pill */}
                    <div style={{
                      display: "flex", alignItems: "center", gap: "7px",
                      padding: "4px 12px", borderRadius: "6px",
                      background: T.bg, border: `1px solid ${T.border}`,
                    }}>
                      <div style={{
                        width: "5px", height: "5px", borderRadius: "50%",
                        background: T.accent, opacity: 0.5,
                      }} />
                      <span style={{
                        fontSize: "10px", color: T.textMuted,
                        fontFamily: "Geist Mono, monospace", letterSpacing: "0.05em",
                      }}>
                        {canvasW} × {canvasH} · {durationInFrames}f · 30fps
                      </span>
                    </div>

                    {/* Live badge */}
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <div style={{
                        width: "5px", height: "5px", borderRadius: "50%",
                        background: T.green, boxShadow: `0 0 0 2px ${T.greenBg}`,
                      }} />
                      <span style={{
                        fontSize: "10px", color: T.green, fontWeight: 700,
                        fontFamily: "Geist Mono, monospace", letterSpacing: "0.1em",
                      }}>
                        RENDERING
                      </span>
                    </div>
                  </div>

                  {/* Player */}
                  <div style={{
                    padding: "28px 24px",
                    background: `radial-gradient(ellipse at 50% -10%, ${T.accentLight} 0%, ${T.surfaceAlt} 55%, ${T.bg} 100%)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <div style={{
                      width: "100%",
                      aspectRatio: isPortrait ? "9/16" : "16/9",
                      maxHeight: isPortrait ? "calc(100vh - 180px)" : "580px",
                      borderRadius: "10px",
                      overflow: "hidden",
                      boxShadow: `
                        0 0 0 1px ${T.border},
                        0 4px 16px rgba(79,70,229,0.08),
                        0 20px 60px rgba(0,0,0,0.1)
                      `,
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
                    { label: "TEMPLATE", value: selectedTemplate?.name || "—" },
                    { label: "LAYOUT",   value: humanize(selectedLayout) || "—" },
                    { label: "DURATION", value: `${durationSeconds}s · ${durationInFrames}f` },
                    { label: "CANVAS",   value: `${canvasW}×${canvasH}` },
                  ].map(({ label, value }) => (
                    <div key={label} style={{
                      background: T.surfaceAlt, border: `1px solid ${T.border}`,
                      borderRadius: "10px", padding: "10px 14px",
                    }}>
                      <div style={{
                        fontSize: "9px", color: T.textMuted, letterSpacing: "0.13em",
                        fontFamily: "Geist Mono, monospace", marginBottom: "4px",
                      }}>
                        {label}
                      </div>
                      <div style={{
                        fontSize: "12px", color: T.accent, fontWeight: 600,
                        fontFamily: "Geist Mono, monospace",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* ══ RIGHT: Layout Props — scrolls internally ══ */}
              <aside className="panel" style={{
                padding: "18px",
                overflowY: "auto",
                maxHeight: "calc(100vh - 84px)",
              }}>

                <PanelSection icon={<IconSliders />} label="Layout Props">
                  <ManifestPropEditor schema={schema} value={layoutProps} onChange={setLayoutProps} />
                </PanelSection>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <button
                    type="button"
                    className="reset-btn"
                    onClick={() => {
                      const defaults = (schema?.defaults ?? {}) as Record<string, unknown>;
                      setLayoutProps(defaults);
                      const sd = schema?.scene_defaults;
                      if (sd?.title)                  setTitle(sd.title);
                      if (sd?.narration !== undefined) setNarration(sd.narration);
                    }}
                  >
                    <IconReset />
                    Reset to Defaults
                  </button>

                  <button
                    type="button"
                    className="reset-btn"
                    disabled={savingSource}
                    onClick={handleSaveSource}
                    style={{
                      background: T.accent,
                      borderColor: T.accent,
                      color: "#fff",
                      opacity: savingSource ? 0.65 : 1,
                    }}
                  >
                    <IconSave />
                    {savingSource ? "Saving…" : "Save Font Defaults"}
                  </button>

                  <div style={{
                    padding: "11px 13px", borderRadius: "9px",
                    background: T.accentLight, border: `1px solid ${T.accentMid}2a`,
                    display: "flex", gap: "9px", alignItems: "flex-start",
                  }}>
                    <div style={{
                      width: "3px", height: "3px", borderRadius: "50%",
                      background: T.accentMid, marginTop: "6px", flexShrink: 0,
                    }} />
                    <p style={{
                      fontSize: "10.5px", color: T.textSub,
                      fontFamily: "Geist Mono, monospace",
                      lineHeight: "1.6", margin: 0,
                      wordBreak: "break-all",
                    }}>
                      {saveMessage || "Use responsive Portrait/Landscape font sizes, then save them into layout source code."}
                    </p>
                  </div>
                </div>

                <PanelSection icon={<IconWand />} label="AI Edit (Gemini)">
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <textarea
                      className="studio-input"
                      placeholder="Describe the edit, e.g. 'move title higher, make subtitle lighter, and reduce box border thickness.'"
                      value={aiInstruction}
                      onChange={(e) => setAiInstruction(e.target.value)}
                      rows={4}
                      style={{
                        width: "100%",
                        border: `1px solid ${T.border}`,
                        background: "#fff",
                        borderRadius: "10px",
                        padding: "10px 12px",
                        fontSize: "12px",
                        color: T.text,
                        fontFamily: "Geist Mono, monospace",
                        resize: "vertical",
                        lineHeight: "1.5",
                      }}
                    />
                    <button
                      type="button"
                      className="reset-btn"
                      disabled={aiLoading || aiApplying || aiDiscarding || !aiInstruction.trim()}
                      onClick={handleGenerateAiEdit}
                      style={{
                        background: T.accent,
                        borderColor: T.accent,
                        color: "#fff",
                        opacity: aiLoading || aiApplying || aiDiscarding || !aiInstruction.trim() ? 0.65 : 1,
                      }}
                    >
                      <IconWand />
                      {aiLoading ? "Generating Preview…" : "Generate AI Preview"}
                    </button>

                    {aiPreviewSessionId && (
                      <>
                        <label style={{ fontSize: "10px", color: T.accent, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                          Preview Session
                        </label>
                        <div style={{
                          border: `1px solid ${T.border}`,
                          background: T.surfaceAlt,
                          borderRadius: "10px",
                          padding: "9px 10px",
                          fontSize: "10px",
                          color: T.textSub,
                          fontFamily: "Geist Mono, monospace",
                          wordBreak: "break-all",
                        }}>
                          {aiPreviewSessionId}
                        </div>
                        <button
                          type="button"
                          className="reset-btn"
                          disabled={aiApplying || aiDiscarding}
                          onClick={handleApplyAiEdit}
                          style={{
                            background: "#111827",
                            borderColor: "#111827",
                            color: "#fff",
                            opacity: aiApplying || aiDiscarding ? 0.7 : 1,
                          }}
                        >
                          <IconSave />
                          {aiApplying ? "Applying…" : "Apply Preview to Files"}
                        </button>
                        <button
                          type="button"
                          className="reset-btn"
                          disabled={aiDiscarding || aiApplying}
                          onClick={handleDiscardAiEdit}
                          style={{
                            background: "#fff",
                            borderColor: T.border,
                            color: T.textSub,
                            opacity: aiDiscarding || aiApplying ? 0.7 : 1,
                          }}
                        >
                          <IconReset />
                          {aiDiscarding ? "Discarding…" : "Discard Preview"}
                        </button>
                      </>
                    )}

                    <p style={{
                      margin: 0,
                      fontSize: "10.5px",
                      color: aiError ? "#7f1d1d" : aiStatus ? "#14532d" : T.textSub,
                      background: aiError ? "#fee2e2" : aiStatus ? "#dcfce7" : T.surfaceAlt,
                      border: `1px solid ${aiError ? "#fecaca" : aiStatus ? "#bbf7d0" : T.border}`,
                      borderRadius: "9px",
                      padding: "9px 10px",
                      lineHeight: "1.5",
                      wordBreak: "break-word",
                    }}>
                      {aiError || aiStatus || "Generate preview, inspect result in the scene, then apply or discard."}
                    </p>
                  </div>
                </PanelSection>
              </aside>

            </div>
          )}
        </main>
      </div>
    </>
  );
}