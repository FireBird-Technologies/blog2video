import React from "react";
import { ECONOMIST_COLORS } from "../constants";
import { ECONOMIST_SANS_FONT } from "../../../../fonts/economist-defaults";

/** A thin editorial rule. */
export const HairlineRule: React.FC<{
  color?: string;
  thickness?: number;
  style?: React.CSSProperties;
}> = ({ color = ECONOMIST_COLORS.rule, thickness = 1, style }) => (
  <div style={{ height: thickness, background: color, width: "100%", ...style }} />
);

/**
 * SectionKicker — the standard Economist article header: a small red square +
 * an uppercase sans kicker. Optionally followed by a hairline rule beneath.
 */
export const SectionKicker: React.FC<{
  label: string;
  accentColor?: string;
  color?: string;
  fontSize?: number;
  withRule?: boolean;
  ruleColor?: string;
  style?: React.CSSProperties;
}> = ({
  label,
  accentColor = ECONOMIST_COLORS.accent,
  color = ECONOMIST_COLORS.muted,
  fontSize = 16,
  withRule = false,
  ruleColor = ECONOMIST_COLORS.rule,
  style,
}) => (
  <div style={style}>
    <div style={{ display: "flex", alignItems: "center", gap: fontSize * 0.55 }}>
      <span
        style={{
          display: "inline-block",
          width: fontSize * 0.62,
          height: fontSize * 0.62,
          background: accentColor,
        }}
      />
      <span
        style={{
          fontFamily: ECONOMIST_SANS_FONT,
          fontWeight: 700,
          fontSize,
          letterSpacing: fontSize * 0.12,
          textTransform: "uppercase",
          color,
        }}
      >
        {label}
      </span>
    </div>
    {withRule && (
      <div style={{ height: 1, background: ruleColor, width: "100%", marginTop: fontSize * 0.5 }} />
    )}
  </div>
);

/** A short, thick accent rule used as a red "tab" or emphasis underline. */
export const AccentTab: React.FC<{
  color?: string;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
}> = ({ color = ECONOMIST_COLORS.accent, width = 56, height = 6, style }) => (
  <div style={{ width, height, background: color, ...style }} />
);
