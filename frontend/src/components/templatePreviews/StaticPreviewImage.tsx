import { useState } from "react";
import type { CustomTemplateTheme } from "../../api/client";
import ThemedPlaceholder from "./ThemedPlaceholder";

/**
 * Static template thumbnail: renders `src` as an `<img>`, falling back to a
 * themed name placeholder when there is no src OR the image fails to load.
 *
 * The fallback-on-error matters because the backend always emits a
 * `preview_image_url` for crafted templates (defaulting to `assets/preview.jpg`)
 * even when the bundle ships no such file — so the URL can 404. Without the
 * `onError` swap the broken `<img>` shows its alt text on a blank card instead of
 * the intended themed placeholder.
 *
 * Used on mobile (`staticThumb`) so template previews hold zero Remotion Players.
 */
export default function StaticPreviewImage({
  src,
  name,
  theme,
}: {
  src?: string | null;
  name?: string;
  theme?: CustomTemplateTheme;
}) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <img
        src={src}
        alt={`${name || "Template"} preview`}
        style={{ width: "100%", height: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    );
  }
  return <ThemedPlaceholder name={name} theme={theme} />;
}
