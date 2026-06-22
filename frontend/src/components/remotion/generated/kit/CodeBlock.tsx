/**
 * Custom-template craft kit — CodeBlock.
 *
 * A themed, SAFE code panel for the "code" content archetype. Renders ONLY the
 * lines passed in `lines` (from props.codeLines) — it never invents sample code,
 * and there is no place for `process.env` / `eval` / other forbidden APIs to leak
 * in, which is exactly the failure mode hand-rolled code scenes hit. Lines reveal
 * line-by-line with a mono font, accent gutter, and a small window chrome.
 */

import React from "react";
import { useCurrentFrame } from "remotion";
import { useKit } from "./context";
import { withAlpha } from "./theme";
import { staggerEntrance } from "./motion";

export interface CodeBlockProps {
  /** The code lines to display — pass props.codeLines. Empty → renders nothing. */
  lines?: string[];
  /** Optional language label shown in the window chrome (e.g. props.codeLanguage). */
  language?: string;
  start?: number;
  maxLines?: number;
  style?: React.CSSProperties;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  lines,
  language,
  start = 6,
  maxLines = 12,
  style,
}) => {
  const frame = useCurrentFrame();
  const { palette, isPortrait } = useKit();
  const rows = (lines ?? []).filter((l) => typeof l === "string").slice(0, maxLines);
  if (!rows.length) return null;

  const mono =
    "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";
  const fontSize = isPortrait ? 22 : 24;

  return (
    <div
      style={{
        background: palette.isDark ? withAlpha("#000000", 0.35) : withAlpha("#0B0B0F", 0.92),
        border: `1px solid ${withAlpha(palette.accent, 0.35)}`,
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
        maxWidth: isPortrait ? "92%" : 1100,
        width: "100%",
        ...style,
      }}
    >
      {/* window chrome */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 16px",
          background: withAlpha("#FFFFFF", 0.04),
          borderBottom: `1px solid ${withAlpha("#FFFFFF", 0.08)}`,
        }}
      >
        {["#FF5F56", "#FFBD2E", "#27C93F"].map((dot) => (
          <span key={dot} style={{ width: 11, height: 11, borderRadius: "50%", background: dot }} />
        ))}
        {language && (
          <span
            style={{
              marginLeft: 8,
              fontFamily: mono,
              fontSize: 14,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: withAlpha("#FFFFFF", 0.5),
            }}
          >
            {language}
          </span>
        )}
      </div>
      {/* lines */}
      <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column" }}>
        {rows.map((line, i) => {
          const enter = staggerEntrance(frame, i, { start, stagger: 4 });
          return (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 18,
                opacity: enter.opacity,
                transform: enter.transform,
                fontFamily: mono,
                fontSize,
                lineHeight: 1.65,
                whiteSpace: "pre",
              }}
            >
              <span style={{ color: withAlpha("#FFFFFF", 0.28), userSelect: "none", minWidth: 22, textAlign: "right" }}>
                {i + 1}
              </span>
              <span style={{ color: withAlpha("#FFFFFF", 0.92) }}>{line}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
