import { useEffect, useRef, useState } from "react";
import { compilePreviewComponent } from "../../utils/compileComponent";
import type { CustomTemplateTheme } from "../../api/client";
import ThemedPlaceholder from "./ThemedPlaceholder";

interface CraftedTemplatePreviewProps {
  /** Stable identifier for module caching across re-mounts. */
  templateId: string;
  /**
   * When set (e.g. current user id), compiled preview modules are cached under
   * this scope so another account in the same browser tab cannot reuse the
   * previous user's compiled preview.
   */
  compileCacheScope?: string;
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
  /**
   * Force a zero-cost static render: skip compiling and mounting the live
   * preview component, showing a themed name placeholder instead. Set on mobile
   * for non-selected grid tiles so the step-2 grid never mounts many live
   * Remotion Players at once (iOS Safari OOMs and reloads the tab otherwise).
   */
  staticThumb?: boolean;
  /** Theme used for the {@link staticThumb} placeholder colours. */
  theme?: CustomTemplateTheme;
}

// Compiled-preview cache survives unmount/remount within the session.
const moduleCache = new Map<string, React.ComponentType<{ thumbnailMode?: boolean }>>();
const inFlight = new Map<string, Promise<React.ComponentType<{ thumbnailMode?: boolean }> | null>>();

function moduleKey(scope: string | undefined, templateId: string) {
  return scope ? `${scope}:${templateId}` : templateId;
}

async function getOrCompile(
  cacheKey: string,
  templateId: string,
  source: string,
): Promise<React.ComponentType<{ thumbnailMode?: boolean }> | null> {
  const cached = moduleCache.get(cacheKey);
  if (cached) return cached;
  const pending = inFlight.get(cacheKey);
  if (pending) return pending;
  const task = compilePreviewComponent(source).then((res) => {
    if (res.success) {
      moduleCache.set(cacheKey, res.component);
      return res.component;
    }
    console.warn(`[crafted-preview] compile failed for ${templateId}:`, res.error);
    return null;
  }).finally(() => {
    inFlight.delete(cacheKey);
  });
  inFlight.set(cacheKey, task);
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
  compileCacheScope,
  previewSource,
  previewImageUrl,
  name,
  thumbnailMode = false,
  showLoaderOnEmptyOrError = false,
  staticThumb = false,
  theme,
}: CraftedTemplatePreviewProps) {
  const cacheKey = moduleKey(compileCacheScope, templateId);
  const [Component, setComponent] = useState<React.ComponentType<{ thumbnailMode?: boolean }> | null>(
    () => (staticThumb ? null : moduleCache.get(cacheKey) ?? null),
  );
  const [compileFailed, setCompileFailed] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    // Static mode: never compile or mount the live preview — hold zero Players.
    if (staticThumb) {
      setComponent(null);
      setCompileFailed(false);
      return () => {
        cancelledRef.current = true;
      };
    }
    if (!previewSource) {
      setComponent(null);
      setCompileFailed(false);
      return () => {
        cancelledRef.current = true;
      };
    }
    const existing = moduleCache.get(cacheKey);
    if (existing) {
      setComponent(() => existing);
      setCompileFailed(false);
      return () => {
        cancelledRef.current = true;
      };
    }
    void getOrCompile(cacheKey, templateId, previewSource).then((c) => {
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
  }, [cacheKey, templateId, previewSource, staticThumb]);

  if (staticThumb) {
    return <ThemedPlaceholder name={name} theme={theme} />;
  }

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
