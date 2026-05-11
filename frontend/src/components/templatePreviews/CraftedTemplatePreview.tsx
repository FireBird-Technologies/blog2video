import { useEffect, useRef, useState } from "react";
import { compilePreviewComponent } from "../../utils/compileComponent";

interface CraftedTemplatePreviewProps {
  /** Stable identifier for module caching across re-mounts. */
  templateId: string;
  /**
   * Source code of the crafted template's marquee preview file
   * (frontend/<TemplateName>Preview.tsx). When null/empty, falls back
   * to previewImageUrl, then to the placeholder.
   */
  previewSource?: string | null;
  /** Static thumbnail fallback when no preview source is bundled. */
  previewImageUrl?: string | null;
  /** Display name for alt text + placeholder copy. */
  name?: string;
  thumbnailMode?: boolean;
  /** Show a spinner while compiling (use for the large featured card). */
  showLoaderOnEmptyOrError?: boolean;
}

// Compiled-preview cache survives unmount/remount within the session.
const moduleCache = new Map<string, React.ComponentType<{ thumbnailMode?: boolean }>>();
const inFlight = new Map<string, Promise<React.ComponentType<{ thumbnailMode?: boolean }> | null>>();

async function getOrCompile(
  templateId: string,
  source: string,
): Promise<React.ComponentType<{ thumbnailMode?: boolean }> | null> {
  const cached = moduleCache.get(templateId);
  if (cached) return cached;
  const pending = inFlight.get(templateId);
  if (pending) return pending;
  const task = compilePreviewComponent(source).then((res) => {
    if (res.success) {
      moduleCache.set(templateId, res.component);
      return res.component;
    }
    console.warn(`[crafted-preview] compile failed for ${templateId}:`, res.error);
    return null;
  }).finally(() => {
    inFlight.delete(templateId);
  });
  inFlight.set(templateId, task);
  return task;
}

function PlaceholderTile({ name, showLoader }: { name?: string; showLoader: boolean }) {
  return (
    <div
      style={{
        width: "100%",
        aspectRatio: "16/9",
        background: "#f3f4f6",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#9ca3af",
        fontSize: 12,
      }}
    >
      {showLoader ? (
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            border: "2px solid rgba(217,119,6,0.25)",
            borderTopColor: "#d97706",
            animation: "spin 0.9s linear infinite",
          }}
        />
      ) : (
        <span>{name || "Preview"}</span>
      )}
    </div>
  );
}

export default function CraftedTemplatePreview({
  templateId,
  previewSource,
  previewImageUrl,
  name,
  thumbnailMode = false,
  showLoaderOnEmptyOrError = false,
}: CraftedTemplatePreviewProps) {
  const [Component, setComponent] = useState<React.ComponentType<{ thumbnailMode?: boolean }> | null>(
    () => moduleCache.get(templateId) ?? null,
  );
  const [compileFailed, setCompileFailed] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    if (!previewSource) {
      setComponent(null);
      setCompileFailed(false);
      return () => {
        cancelledRef.current = true;
      };
    }
    const existing = moduleCache.get(templateId);
    if (existing) {
      setComponent(() => existing);
      setCompileFailed(false);
      return () => {
        cancelledRef.current = true;
      };
    }
    void getOrCompile(templateId, previewSource).then((c) => {
      if (cancelledRef.current) return;
      if (c) {
        setComponent(() => c);
        setCompileFailed(false);
      } else {
        setComponent(null);
        setCompileFailed(true);
      }
    });
    return () => {
      cancelledRef.current = true;
    };
  }, [templateId, previewSource]);

  if (Component) {
    return <Component thumbnailMode={thumbnailMode} />;
  }

  if (!compileFailed && previewSource && showLoaderOnEmptyOrError) {
    return <PlaceholderTile name={name} showLoader={true} />;
  }

  if (previewImageUrl) {
    return (
      <img
        src={previewImageUrl}
        alt={`${name || "Template"} preview`}
        style={{
          width: "100%",
          aspectRatio: "16/9",
          objectFit: "cover",
          display: "block",
        }}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return <PlaceholderTile name={name} showLoader={showLoaderOnEmptyOrError && !!previewSource} />;
}
