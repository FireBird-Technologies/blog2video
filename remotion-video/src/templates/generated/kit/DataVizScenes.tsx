/**
 * Custom-template craft kit — dedicated data-viz scenes.
 *
 * Two ready-made, brand-themed scenes that render deterministically from a bound
 * table (NOT from AI-authored code), giving custom templates the same reliable,
 * editable chart + table pair that built-in templates have. GeneratedVideo routes
 * scenes tagged "dataviz_chart" / "dataviz_table" here.
 *
 * Data comes from props.chartTable (bound from Firecrawl-extracted tables and
 * editable via the chart_table spreadsheet in SceneEditModal).
 */

import React from "react";
import { useCurrentFrame } from "remotion";
import type { GeneratedSceneProps } from "../types";
import { SceneFrame } from "./SceneFrame";
import { useKit } from "./context";
import { CustomChart, autoChartSummary } from "./CustomChart";
import { CustomTable } from "./CustomTable";
import { RevealText } from "./text";
import { Decor } from "./Decor";

const frameProps = (props: GeneratedSceneProps) => ({
  brandColors: props.brandColors,
  aspectRatio: props.aspectRatio,
  fonts: { heading: props.headingFont, body: props.bodyFont },
  overrides: { title: props.titleFontSize, body: props.descriptionFontSize },
});

const Title: React.FC<{ text: string }> = ({ text }) => {
  const { palette, type, fonts } = useKit();
  return (
    <RevealText
      text={text}
      mode="word"
      as="div"
      style={{
        fontFamily: fonts.heading,
        fontSize: type.title,
        fontWeight: 800,
        color: palette.text,
        lineHeight: 1.1,
        marginBottom: 8,
      }}
    />
  );
};

const Caption: React.FC<{ text: string; start?: number }> = ({ text, start = 24 }) => {
  const frame = useCurrentFrame();
  const { palette, type, fonts } = useKit();
  if (!text) return null;
  const op = Math.max(0, Math.min(1, (frame - start) / 16));
  return (
    <div
      style={{
        fontFamily: fonts.body,
        fontSize: type.caption,
        color: palette.muted,
        marginTop: 14,
        lineHeight: 1.4,
        opacity: op,
        textAlign: "center",
      }}
    >
      {text}
    </div>
  );
};

/** Chart scene — title + themed CustomChart + auto/explicit summary. */
export const DataChartScene: React.FC<GeneratedSceneProps> = (props) => {
  const title = props.displayText || "By the numbers";
  const summary =
    props.chartSummary || autoChartSummary(props.chartTable, props.chartType);
  return (
    <SceneFrame {...frameProps(props)} eyebrow="Data">
      <DecorBg />
      <Title text={title} />
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <CustomChart chartTable={props.chartTable} chartType={props.chartType} />
      </div>
      <Caption text={summary} />
    </SceneFrame>
  );
};

/** Table scene — title + themed CustomTable + optional footnote. */
export const DataTableScene: React.FC<GeneratedSceneProps> = (props) => {
  const title = props.displayText || "The full picture";
  return (
    <SceneFrame {...frameProps(props)} eyebrow="Breakdown">
      <DecorBg />
      <Title text={title} />
      <div
        style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}
      >
        <CustomTable table={props.chartTable} />
      </div>
      <Caption text={props.chartSummary || ""} />
    </SceneFrame>
  );
};

/** Subtle brand decor behind data-viz scenes (pulled from context palette). */
const DecorBg: React.FC = () => {
  const { palette } = useKit();
  return <Decor system={palette.isDark ? "grid" : "dots"} intensity={0.3} />;
};
