import { TEMPLATE_DESCRIPTIONS } from "./templatePreviewRegistry";

const FAKE_TEMPLATE_PALETTES: Record<string, { from: string; via: string; to: string; accent: string }> = {
  spotlight: { from: "#0F172A", via: "#312E81", to: "#7C3AED", accent: "#A78BFA" },
  nightfall: { from: "#0B1120", via: "#1E1B4B", to: "#A855F7", accent: "#C4B5FD" },
  gridcraft: { from: "#0EA5E9", via: "#2563EB", to: "#1E1B4B", accent: "#7DD3FC" },
  newscast: { from: "#7C3AED", via: "#1E1B4B", to: "#0F172A", accent: "#FDE68A" },
  newspaper: { from: "#F8FAFC", via: "#E2E8F0", to: "#94A3B8", accent: "#1E293B" },
  default: { from: "#7C3AED", via: "#A855F7", to: "#F472B6", accent: "#FDE68A" },
};

interface Props {
  templateId: string;
  /** Compact rendering for grid thumbnails — smaller paragraphs and tag. */
  thumbnail?: boolean;
}

/**
 * Static gradient placeholder used in help videos in place of real Remotion template previews.
 * Mirrors the layout of the live previews (eyebrow, headline, supporting bars) without rendering
 * any actual template code.
 */
export default function HelpFakeTemplatePreview({ templateId, thumbnail = false }: Props) {
  const palette = FAKE_TEMPLATE_PALETTES[templateId] ?? FAKE_TEMPLATE_PALETTES.default;
  const labelText = thumbnail ? "Sample" : (TEMPLATE_DESCRIPTIONS[templateId]?.title ?? "Sample template");

  return (
    <div
      style={{
        width: "100%",
        aspectRatio: "16 / 9",
        background: `linear-gradient(135deg, ${palette.from} 0%, ${palette.via} 55%, ${palette.to} 100%)`,
        color: "#fff",
        padding: thumbnail ? 8 : 18,
        display: "grid",
        alignContent: "center",
        gap: thumbnail ? 4 : 10,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <span
        style={{
          height: thumbnail ? 4 : 8,
          width: "30%",
          borderRadius: 999,
          background: palette.accent,
          opacity: 0.95,
        }}
      />
      <span
        style={{
          height: thumbnail ? 10 : 22,
          width: "78%",
          borderRadius: thumbnail ? 4 : 8,
          background: "rgba(255,255,255,0.92)",
        }}
      />
      <span
        style={{
          height: thumbnail ? 6 : 12,
          width: "55%",
          borderRadius: thumbnail ? 3 : 6,
          background: "rgba(255,255,255,0.55)",
        }}
      />
      {!thumbnail ? (
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <span style={{ height: 8, flex: 1, borderRadius: 999, background: "rgba(255,255,255,0.45)" }} />
          <span style={{ height: 8, flex: 1, borderRadius: 999, background: "rgba(255,255,255,0.25)" }} />
          <span style={{ height: 8, flex: 1, borderRadius: 999, background: "rgba(255,255,255,0.15)" }} />
        </div>
      ) : null}
      <span
        aria-hidden
        style={{
          position: "absolute",
          right: thumbnail ? 6 : 14,
          bottom: thumbnail ? 4 : 12,
          fontSize: thumbnail ? 8 : 12,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          fontWeight: 800,
          color: "rgba(255,255,255,0.78)",
        }}
      >
        {labelText}
      </span>
    </div>
  );
}
