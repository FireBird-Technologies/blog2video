import type { CustomTemplateTheme } from "../../api/client";

/**
 * Static, zero-cost stand-in for a crafted/custom template thumbnail: the
 * template name in small text using the template's own theme colours (text on
 * background) instead of mounting a live Remotion `<Player>`.
 *
 * Used on mobile in the step-2 grid so non-selected crafted/custom tiles hold no
 * Player — a grid of live Players exhausts iOS Safari's per-tab memory and
 * reloads/crashes the tab. Crafted/custom templates ship no usable static
 * preview image, so the themed name card is the fallback (the selected tile
 * still plays live).
 */
export default function ThemedPlaceholder({
  name,
  theme,
}: {
  name?: string;
  theme?: CustomTemplateTheme;
}) {
  const bg = theme?.colors?.bg ?? "#0B0E11";
  const text = theme?.colors?.text ?? "#F4F6F8";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        aspectRatio: "16/9",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: bg,
        color: text,
        padding: 8,
        textAlign: "center",
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          lineHeight: 1.3,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {name || "Template"}
      </span>
    </div>
  );
}
