import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { onRenderData, sendPrompt, openLink } from "./bridge";
import "./styles.css";

// 8 pure-React preview components — reused directly from the frontend.
// Each is a self-contained inline-style React component, no external CSS.
import DefaultPreview from "@previews/DefaultPreview";
import NightfallPreview from "@previews/NightfallPreview";
import GridcraftPreview from "@previews/GridcraftPreview";
import SpotlightPreview from "@previews/SpotlightPreview";
import WhiteboardPreview from "@previews/WhiteboardPreview";
import NewsPaperPreview from "@previews/NewsPaperPreview";
import MatrixPreview from "@previews/MatrixPreview";
import BloombergPreview from "@previews/BloombergPreview";

// id (from /api/templates) → component. Templates not in this map render a
// CSS-only fallback card (NewscastPreview, MosaicPreview, BlackswanPreview,
// ChroniclePreview all depend on @remotion/player which we don't bundle).
const PREVIEWS: Record<string, React.ComponentType<{ thumbnailMode?: boolean }>> = {
  default: DefaultPreview,
  nightfall: NightfallPreview,
  gridcraft: GridcraftPreview,
  spotlight: SpotlightPreview,
  whiteboard: WhiteboardPreview,
  newspaper: NewsPaperPreview,
  matrix: MatrixPreview,
  bloomberg: BloombergPreview,
};

type PreviewColors = {
  accent?: string;
  bg?: string;
  text?: string;
};

type Template = {
  id: string;
  name?: string;
  description?: string;
  genres?: string[];
  marketing_url?: string;
  preview_colors?: PreviewColors;
};

/** Stylized fallback for templates whose live preview component requires
 * Remotion (newscast, mosaic, blackswan, chronicle). Renders a colored
 * gradient based on the template's accent + bg colors with the id on top. */
function FallbackPreview({ template }: { template: Template }) {
  const c = template.preview_colors ?? {};
  const accent = c.accent ?? "#7c3aed";
  const bg = c.bg ?? "#0f0f12";
  const text = c.text ?? "#ffffff";
  return (
    <div
      className="preview-fallback"
      style={{
        background: `linear-gradient(135deg, ${bg} 0%, ${accent} 100%)`,
        color: text,
      }}
    >
      {template.id}
    </div>
  );
}

function Card({ template }: { template: Template }) {
  const Preview = PREVIEWS[template.id];

  const handleUse = () => {
    sendPrompt(`Use the ${template.id} template for the next Blog2Video project.`);
  };
  const handleDetails = () => {
    if (template.marketing_url) openLink(template.marketing_url);
  };

  return (
    <div className="card">
      <div className="preview">
        {Preview ? <Preview thumbnailMode /> : <FallbackPreview template={template} />}
      </div>
      <div className="meta">
        <h3>{template.id}</h3>
        <p className="name">{template.name ?? template.id}</p>
        <p className="desc">{template.description ?? ""}</p>
        <div className="actions">
          <button onClick={handleUse}>Use this →</button>
          {template.marketing_url && (
            <button className="ghost" onClick={handleDetails}>
              Details ↗
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [templates, setTemplates] = useState<Template[] | null>(null);

  useEffect(() => {
    onRenderData((data) => {
      const t = (data as { templates?: Template[] }).templates;
      setTemplates(Array.isArray(t) ? t : []);
    });
  }, []);

  if (templates === null) {
    return <div className="loading">Loading templates…</div>;
  }
  if (templates.length === 0) {
    return <div className="loading">No templates available.</div>;
  }
  return (
    <div className="grid">
      {templates.map((t) => (
        <Card key={t.id} template={t} />
      ))}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
