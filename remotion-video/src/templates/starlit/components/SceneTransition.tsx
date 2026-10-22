import React, {useId} from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import {
  orientChartInputsForType,
  resolveChartInputs,
  selectChartType,
  type ChartTableShape,
} from "../../_shared/chartData";
import {SpaceBackdrop} from "./SpaceBackdrop";
import { mixTheme, parseThemeColor, withOpacity } from "./themeColor";

type SceneTransitionProps = {
  layout: string;
  accentColor?: string;
  bgColor?: string;
  textColor?: string;
  fontFamily?: string;
  chartTable?: ChartTableShape;
  chartType?: "auto" | "line" | "bar" | "histogram";
  tickerTable?: {headers?: string[]; rows?: string[][]};
};
const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const smooth = Easing.bezier(0.22, 0.72, 0.2, 1);

const starlitRand = (seed: number, salt: number) => {
  const value = Math.sin(seed * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
};

/** Mix two theme colours in hex; if either is not a colour we can read, hand back `fallback` (default: `from`). */
const mixHex = (from: string, to: string, amount: number, fallback: string = from) => {
  const a = parseThemeColor(from);
  const b = parseThemeColor(to);
  if (!a || !b) return fallback;
  const channel = (index: number) => Math.round(a[index] + (b[index] - a[index]) * amount)
    .toString(16)
    .padStart(2, "0");
  return `#${channel(0)}${channel(1)}${channel(2)}`;
};

const coverStyle: React.CSSProperties = {
  pointerEvents: "none",
};

const svgStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
};

export const STARLIT_TRANSITION_FRAMES = 24;
const STARLIT_STARRY_TRANSITION_FRAMES = 42;
const STARLIT_QUOTE_REVEAL_FRAMES = 72;
const STARLIT_HERO_REVEAL_FRAMES = 54;
const STARLIT_NARRATIVE_REVEAL_FRAMES = 66;
const STARLIT_SPLIT_REVEAL_FRAMES = 78;
const STARLIT_CLOUD_REVEAL_FRAMES = 66;
const STARLIT_METEOR_REVEAL_FRAMES = 72;
const STARLIT_ENDING_REVEAL_FRAMES = 42;

// Data trace: the real first series is acquired in the exact final plot position, so the
// temporary trace can disappear without breaking spatial continuity.
export const DATA_TRACE_FRAMES = 30;
export const DATA_TRACE_CONTENT_DELAY = 0;
export const DataTraceTransition: React.FC<{
  accentColor?: string;
  bgColor?: string;
  textColor?: string;
  chartTable?: ChartTableShape;
  chartType?: "auto" | "line" | "bar" | "histogram";
}> = ({
  accentColor = "#217cff",
  bgColor = "#000000",
  textColor = "#ffffff",
  chartTable,
  chartType,
}) => {
  const thTxt = textColor; const thBg = bgColor; const thAcc = accentColor; const thPale = mixTheme(thAcc, thTxt, .78); const thMid = mixTheme(thAcc, thTxt, .42);
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const id = `data-trace-${useId().replace(/:/g, "")}`;
  const portrait = height > width;
  const unit = Math.min(width, height) / 1080;
  const inputs = React.useMemo(() => resolveChartInputs(chartTable), [chartTable]);
  const kind = React.useMemo(() => selectChartType(chartType, inputs), [chartType, inputs]);
  const data = React.useMemo(() => orientChartInputsForType(inputs, kind), [inputs, kind]);
  const fallbackValues = [18, 33, 27, 52, 46, 71];
  const plottedValues = kind === "line"
    ? (data.lineSeries[0]?.values ?? fallbackValues)
    : (kind === "histogram" ? data.histogramRows : data.barRows).map((row) => row.value);
  const primaryValues = plottedValues.length >= 2 ? plottedValues : fallbackValues;
  const rangeValues = kind === "line"
    ? data.lineSeries.flatMap((series) => series.values).filter(Number.isFinite)
    : primaryValues.filter(Number.isFinite);
  const minRaw = rangeValues.length ? Math.min(...rangeValues) : 0;
  const maxRaw = rangeValues.length ? Math.max(...rangeValues) : 1;
  const min = minRaw > 0 ? 0 : minRaw;
  const max = maxRaw === min ? min + 1 : maxRaw;
  const range = max - min || 1;
  const outerX = width * (portrait ? .07 : .065);
  const outerTop = height * (portrait ? .075 : .08);
  const outerBottom = height * (portrait ? .105 : .08);
  const contentW = width - outerX * 2;
  const contentH = height - outerTop - outerBottom;
  const contentGap = portrait ? 38 : 64;
  const copyW = portrait ? contentW : contentW * .31;
  const copyH = portrait ? Math.min(430, contentH * .27) : contentH;
  const chartW = portrait ? contentW : contentW - copyW - contentGap;
  const chartH = portrait ? contentH - copyH - contentGap : contentH;
  const chartLeft = portrait ? outerX : outerX + copyW + contentGap;
  const chartTop = portrait ? outerTop + copyH + contentGap : outerTop;
  const plot = {
    x: chartLeft + (portrait ? 118 : 104),
    y: chartTop + (portrait ? 72 : 78),
    w: chartW - (portrait ? 172 : 158),
    h: chartH - (portrait ? 190 : 180),
  };
  const pointX = (index: number) => plot.x + (primaryValues.length <= 1 ? plot.w / 2 : (index / (primaryValues.length - 1)) * plot.w);
  const pointY = (value: number) => plot.y + plot.h - ((value - min) / range) * plot.h;
  const points = primaryValues.map((value, index) => ({x: pointX(index), y: pointY(Number.isFinite(value) ? value : min)}));
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  if (frame > DATA_TRACE_FRAMES) return null;
  const t = interpolate(frame, [0, DATA_TRACE_FRAMES], [0, 1], clamp);
  const axisDraw = interpolate(t, [.02, .28], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const traceDraw = interpolate(t, [.14, .68], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const overlayOut = interpolate(t, [.70, 1], [1, 0], {...clamp, easing: Easing.inOut(Easing.sin)});
  const veil = interpolate(t, [0, .20, .76, 1], [1, .96, .12, 0], {...clamp, easing: smooth});
  const scanX = plot.x + plot.w * traceDraw;
  return <AbsoluteFill style={{pointerEvents: "none", overflow: "hidden", zIndex: 20}}>
    <svg viewBox={`0 0 ${width} ${height}`} style={svgStyle}>
      <defs>
        <filter id={`${id}-glow`} x="-160%" y="-160%" width="420%" height="420%"><feGaussianBlur stdDeviation={3.2 * unit} result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <linearGradient id={`${id}-scan`} x1="0" x2="1"><stop offset="0%" stopColor={accentColor} stopOpacity="0" /><stop offset="48%" stopColor={accentColor} stopOpacity=".18" /><stop offset="100%" stopColor={textColor} stopOpacity=".9" /></linearGradient>
      </defs>
      <rect width={width} height={height} fill={bgColor} opacity={veil} />
      <g opacity={overlayOut}>
        <line x1={plot.x} x2={plot.x} y1={plot.y + plot.h * (1 - axisDraw)} y2={plot.y + plot.h} stroke={accentColor} strokeWidth={Math.max(.8, unit)} opacity=".46" />
        <line x1={plot.x} x2={plot.x + plot.w * axisDraw} y1={plot.y + plot.h} y2={plot.y + plot.h} stroke={accentColor} strokeWidth={Math.max(.8, unit)} opacity=".46" />
        {kind === "line" ? <path d={path} pathLength="1" fill="none" stroke={accentColor} strokeWidth={Math.max(1.6, unit * 2.1)} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${traceDraw} 1`} filter={`url(#${id}-glow)`} /> : points.map((point, index) => {
          const barW = Math.max(5, plot.w / Math.max(1, points.length) * .42);
          const barIn = interpolate(traceDraw, [index / points.length, Math.min(1, (index + 1.5) / points.length)], [0, 1], clamp);
          const barH = (plot.y + plot.h - point.y) * barIn;
          return <rect key={index} x={point.x - barW / 2} y={plot.y + plot.h - barH} width={barW} height={barH} rx={Math.max(1, unit * 2)} fill={accentColor} fillOpacity=".12" stroke={accentColor} strokeWidth={Math.max(.8, unit)} />;
        })}
        {points.map((point, index) => {
          const threshold = points.length <= 1 ? 0 : index / (points.length - 1);
          const acquired = interpolate(traceDraw, [Math.max(0, threshold - .035), Math.min(1, threshold + .045)], [0, 1], clamp);
          const pulse = Math.max(0, 1 - Math.abs(traceDraw - threshold) / .12);
          return <g key={index} opacity={acquired}>
            <circle cx={point.x} cy={point.y} r={(8 + pulse * 18) * unit} fill={accentColor} opacity={.08 + pulse * .16} filter={`url(#${id}-glow)`} />
            <circle cx={point.x} cy={point.y} r={Math.max(2.5, unit * 4)} fill={textColor} stroke={accentColor} strokeWidth={Math.max(1, unit * 1.4)} filter={`url(#${id}-glow)`} />
          </g>;
        })}
        <line x1={scanX} x2={scanX} y1={plot.y - height * .025} y2={plot.y + plot.h + height * .025} stroke={textColor} strokeWidth={Math.max(.8, unit)} strokeDasharray={`${Math.max(2, unit * 3)} ${Math.max(6, unit * 9)}`} opacity={traceDraw < 1 ? .62 : 0} filter={`url(#${id}-glow)`} />
        <line x1={Math.max(plot.x, scanX - plot.w * .13)} x2={scanX} y1={plot.y + plot.h + height * .035} y2={plot.y + plot.h + height * .035} stroke={`url(#${id}-scan)`} strokeWidth={Math.max(1, unit * 1.4)} opacity={traceDraw < 1 ? .8 : 0} />
      </g>
    </svg>
  </AbsoluteFill>;
};

// Nebula core: from black, a column of blue gas fades up around a glowing white-blue core while
// small stars drift and twinkle, then the nebula pushes in and dissolves into the scene.
// Self-contained and unwired: mount it from any layout that should enter through deep space.
export const NEBULA_CORE_FRAMES = 96;
export const NEBULA_CORE_CONTENT_DELAY = 50;
export const NebulaCoreTransition: React.FC<{
  accentColor?: string; bgColor?: string; textColor?: string;
  /** Stay for the whole scene as a still backdrop at `floor` opacity (mounted behind the scene's text). */
  persist?: boolean; floor?: number;
}> = ({
  accentColor = "#217cff",
  bgColor = "#000000",
  textColor = "#ffffff",
  persist = false,
  floor = .3,
}) => {
  const thTxt = textColor; const thBg = bgColor; const thAcc = accentColor; const thPale = mixTheme(thAcc, thTxt, .78); const thMid = mixTheme(thAcc, thTxt, .42);
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const id = `nebcore-${useId().replace(/:/g, "")}`;
  const unit = Math.min(width, height) / 1080;
  const rgb = (hex: string) => (parseThemeColor(hex) ?? [128, 128, 128]).map((v) => v / 255);
  // Deep-space drift: crisp stars of every size, layered nebula wisps, a few glowing stars, and a slow
  // forward camera move in which the near layers travel faster than the far ones (parallax).
  const deep = rgb(mixHex(bgColor, accentColor, .5));
  const wispC = rgb(mixHex(accentColor, thTxt, .22));
  const knotC = rgb(mixHex(accentColor, thTxt, .5));
  const pale = mixHex(accentColor, thTxt, .82, thPale);
  const mid = mixHex(accentColor, thTxt, .45);
  const layerStars = React.useMemo(() => {
    const make = (count: number, salt: number, sizes: number[]) => {
      const classes: string[][] = sizes.map(() => []);
      for (let i = 0; i < count; i++) {
        const x = starlitRand(i + salt, 1) * width;
        const y = starlitRand(i + salt, 2) * height;
        const k = starlitRand(i + salt, 3);
        const c = Math.min(sizes.length - 1, Math.floor(Math.pow(k, 1.6) * sizes.length));
        classes[c].push(`M${x.toFixed(1)} ${y.toFixed(1)}h.01`);
      }
      return classes.map((c) => c.join(""));
    };
    return [
      {paths: make(6500, 7100, [1, 1.5]), widths: [1, 1.5], rate: .12, opacity: .8},
      {paths: make(2600, 7400, [1.6, 2.4, 3.4]), widths: [1.6, 2.4, 3.4], rate: .38, opacity: .92},
      {paths: make(400, 7700, [3, 4.6, 6.4]), widths: [3, 4.6, 6.4], rate: .95, opacity: 1},
    ];
  }, [width, height]);
  const glows = [
    {x: .62, y: .78, r: .085, rate: .7}, {x: .27, y: .3, r: .06, rate: .5}, {x: .8, y: .2, r: .07, rate: .6}, {x: .44, y: .62, r: .045, rate: .8},
  ];
  if (!persist && frame > NEBULA_CORE_FRAMES) return null;
  const seconds = frame / 30;
  const fadeIn = persist ? 1 : interpolate(frame, [0, 22], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
  // The nebula glides forward the whole time and fades into the scene, which eases in behind it.
  const dolly = persist ? 0 : Easing.inOut(Easing.quad)(interpolate(frame, [0, NEBULA_CORE_FRAMES], [0, 1], clamp));
  const fadeOut = persist ? floor : interpolate(frame, [34, NEBULA_CORE_FRAMES - 2], [1, 0], {...clamp, easing: Easing.inOut(Easing.sin)});
  const cx = width / 2;
  const cy = height / 2;
  const scaleAbout = (rate: number) => `translate(${cx} ${cy}) scale(${1 + rate * dolly * 2.2}) translate(${-cx} ${-cy})`;
  const drift = persist ? 0 : Math.sin(seconds * .5) * 6 * unit;
  const field = (name: string, freq: string, seed: number, color: number[], lo: number, hi: number, max: number, blur: number, filament = false) => (
    <filter id={`${id}-${name}`} x="0" y="0" width={width} height={height} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency={freq} numOctaves="5" seed={seed} result="n" />
      <feColorMatrix in="n" type="matrix" values={`0 0 0 0 ${color[0]}  0 0 0 0 ${color[1]}  0 0 0 0 ${color[2]}  1 0 0 0 0`} />
      <feComponentTransfer><feFuncA type="table" tableValues={Array.from({length: 40}, (_, i) => { const k = Math.max(0, Math.min(1, (i / 39 - lo) / (hi - lo))); const v = i / 39; return (filament ? Math.exp(-(((v - lo) / hi) ** 2)) * max : k * k * (3 - 2 * k) * max).toFixed(3); }).join(" ")} /></feComponentTransfer>
      <feGaussianBlur stdDeviation={blur * unit} />
    </filter>
  );
  return <AbsoluteFill style={{pointerEvents: "none", overflow: "hidden", zIndex: persist ? 0 : 20, opacity: fadeOut}}>
    <svg viewBox={`0 0 ${width} ${height}`} style={svgStyle}>
      <defs>
        {field("haze", ".0016 .0020", 14, deep, .34, .8, .32, 28)}
        {field("knot", ".0026 .0030", 52, wispC, .56, .88, .4, 17)}
        {field("wisp", ".0058 .0066", 33, knotC, .5, .82, .28, 3.2)}
        {field("wispb", ".0115 .0125", 91, knotC, .55, .88, .2, 1.8)}
        <radialGradient id={`${id}-glow`}>
          <stop offset="0%" stopColor={pale} stopOpacity=".9" /><stop offset="16%" stopColor={mid} stopOpacity=".7" />
          <stop offset="46%" stopColor={accentColor} stopOpacity=".26" /><stop offset="100%" stopColor={accentColor} stopOpacity="0" />
        </radialGradient>
      </defs>
      {persist ? null : <rect width={width} height={height} fill={bgColor} />}
      <g opacity={fadeIn}>
        <g transform={scaleAbout(.2)}>
          <rect x={drift} width={width} height={height} filter={`url(#${id}-haze)`} />
          <rect x={-drift} width={width} height={height} filter={`url(#${id}-knot)`} />
          <rect x={drift * .5} width={width} height={height} filter={`url(#${id}-wisp)`} />
          <rect x={-drift * .7} width={width} height={height} filter={`url(#${id}-wispb)`} />
        </g>
        {layerStars.map((layer, li) => (
          <g key={li} transform={scaleAbout(layer.rate)}>
            {layer.paths.map((d, i) => <path key={i} d={d} stroke={li === 2 && i === 2 ? pale : textColor} strokeWidth={layer.widths[i] * unit} strokeLinecap="round" opacity={layer.opacity * (.62 + .38 * (i + 1) / layer.paths.length) * (li === 2 ? .85 + .15 * Math.sin(seconds * 1.4 + i) : 1)} />)}
          </g>
        ))}
        {glows.map((g, i) => (
          <g key={i} transform={scaleAbout(g.rate)}>
            <circle cx={width * g.x} cy={height * g.y} r={Math.min(width, height) * g.r * (1 + .05 * Math.sin(seconds * 1.1 + i))} fill={`url(#${id}-glow)`} />
          </g>
        ))}
      </g>
    </svg>
  </AbsoluteFill>;
};

// A loose constellation resolves into the real table geometry. Every star has a final grid
// coordinate, so the connecting paths become the table's row/column guides instead of handing
// off to an unrelated transition graphic.
export const CONSTELLATION_TABLE_FRAMES = 66;
export const CONSTELLATION_TABLE_CONTENT_DELAY = 24;
export const ConstellationTableTransition: React.FC<{
  accentColor?: string;
  bgColor?: string;
  textColor?: string;
  fontFamily?: string;
  tickerTable?: {headers?: string[]; rows?: string[][]};
}> = ({
  accentColor = "#217cff",
  bgColor = "#000000",
  textColor = "#ffffff",
  fontFamily = '"Space Grotesk", "Inter", system-ui, sans-serif',
  tickerTable,
}) => {
  const thTxt = textColor; const thBg = bgColor; const thAcc = accentColor; const thPale = mixTheme(thAcc, thTxt, .78); const thMid = mixTheme(thAcc, thTxt, .42);
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const id = `constellation-table-${useId().replace(/:/g, "")}`;
  const portrait = height > width;
  const unit = Math.min(width, height) / 1080;

  const seconds = frame / 30;
  const constellationIn = interpolate(frame, [0, 12], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const connectionDraw = interpolate(frame, [5, 24], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const settle = interpolate(frame, [18, 52], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  const coverOpacity = interpolate(frame, [0, 22, 52, CONSTELLATION_TABLE_FRAMES - 1], [1, .96, .12, 0], {...clamp, easing: Easing.inOut(Easing.sin)});
  const graphicsOut = interpolate(frame, [50, CONSTELLATION_TABLE_FRAMES - 1], [1, 0], {...clamp, easing: Easing.inOut(Easing.sin)});
  const gridDraw = interpolate(frame, [26, 54], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const pale = mixHex(accentColor, thTxt, .82, thPale);
  const mid = mixHex(accentColor, thTxt, .42);

  const visibleRows = (tickerTable?.rows ?? []).slice(0, 20).map((row) => row.slice(0, 6));
  const rowCount = Math.max(1, visibleRows.length);
  const tableLeft = width * (portrait ? .05 : .09);
  const tableWidth = width * (portrait ? .9 : .82);
  const headerHeight = portrait ? 66 : 52;
  const idealRowHeight = portrait
    ? (rowCount <= 4 ? 130 : rowCount <= 7 ? 100 : 78)
    : (rowCount <= 4 ? 92 : rowCount <= 7 ? 70 : 54);
  const tableHeight = Math.min(
    height * (portrait ? .62 : .64),
    headerHeight + rowCount * idealRowHeight,
  );
  const titleSize = portrait ? 76 : 72;
  const titleBlock = titleSize * 1.04 + (portrait ? 36 : 30);
  const contentTop = height * .08 + (height * .84 - titleBlock - tableHeight) / 2;
  const tableTop = contentTop + titleBlock;
  const bodyRowHeight = (tableHeight - headerHeight) / rowCount;
  const tableRight = tableLeft + tableWidth;
  const rowEdges = [tableTop, tableTop + headerHeight, ...Array.from(
    {length: rowCount},
    (_, index) => tableTop + headerHeight + bodyRowHeight * (index + 1),
  )];
  const borderAnchors = [
    {x: 1.2, y: 6.5, size: 3.2}, {x: 8, y: 0, size: 1.8},
    {x: 22, y: 0, size: 2.4}, {x: 39, y: 0, size: 1.5},
    {x: 56, y: 0, size: 2.1}, {x: 73, y: 0, size: 1.6},
    {x: 91, y: 0, size: 2.5}, {x: 98.8, y: 7.5, size: 3},
    {x: 100, y: 28, size: 1.7}, {x: 100, y: 52, size: 2.2},
    {x: 100, y: 76, size: 1.6}, {x: 98.7, y: 92, size: 3},
    {x: 86, y: 100, size: 1.8}, {x: 68, y: 100, size: 2.4},
    {x: 50, y: 100, size: 1.5}, {x: 31, y: 100, size: 2},
    {x: 12, y: 100, size: 1.7}, {x: 1.3, y: 92, size: 2.8},
    {x: 0, y: 66, size: 1.8}, {x: 0, y: 35, size: 2.1},
  ];

  const constellation = React.useMemo(() => {
    const centres = portrait
      ? [{x: .2, y: .25}, {x: .72, y: .23}, {x: .24, y: .7}, {x: .76, y: .68}]
      : [{x: .17, y: .28}, {x: .78, y: .25}, {x: .23, y: .73}, {x: .8, y: .7}];
    const offsets = [
      {x: -.09, y: .02}, {x: -.035, y: -.08}, {x: .03, y: -.015},
      {x: .09, y: -.075}, {x: .07, y: .07},
    ];
    return borderAnchors.map((anchor, index) => {
      const group = index % centres.length;
      const local = Math.floor(index / centres.length);
      const centre = centres[group];
      const offset = offsets[local];
      return {
        group,
        targetX: tableLeft + tableWidth * anchor.x / 100,
        targetY: tableTop + tableHeight * anchor.y / 100,
        sourceX: width * (centre.x + offset.x + (starlitRand(index + 10420, 1) - .5) * .018),
        sourceY: height * (centre.y + offset.y + (starlitRand(index + 10420, 2) - .5) * .018),
        size: anchor.size * unit,
        phase: starlitRand(index + 10420, 4) * Math.PI * 2,
        drift: .55 + starlitRand(index + 10420, 5) * .9,
        bright: index % 4 === 0 || anchor.size >= 2.8,
      };
    });
  }, [height, portrait, tableHeight, tableLeft, tableTop, tableWidth, unit, width]);
  const pointAt = (index: number) => {
    const point = constellation[index];
    const freeDrift = 1 - settle;
    return {
      ...point,
      x: interpolate(settle, [0, 1], [point.sourceX, point.targetX])
        + Math.sin(seconds * point.drift + point.phase) * 5.5 * unit * freeDrift,
      y: interpolate(settle, [0, 1], [point.sourceY, point.targetY])
        + Math.cos(seconds * point.drift * .72 + point.phase) * 3.5 * unit * freeDrift,
    };
  };
  const stars = React.useMemo(() => Array.from({length: 220}, (_, index) => ({
    x: starlitRand(index + 8300, 1) * width,
    y: starlitRand(index + 8300, 2) * height,
    r: (.45 + starlitRand(index + 8300, 3) * 1.45) * unit,
    opacity: .2 + starlitRand(index + 8300, 4) * .65,
  })), [height, unit, width]);
  const labelOpacity = interpolate(settle, [0, .34, .72], [.68, .68, 0], clamp);
  const constellationOpacity = interpolate(settle, [.58, 1], [1, .26], clamp);
  const constellationLinesOut = interpolate(settle, [0, .34], [1, 0], clamp);

  return <AbsoluteFill style={{pointerEvents: "none", overflow: "hidden", zIndex: 20}}>
    <svg viewBox={`0 0 ${width} ${height}`} style={svgStyle}>
      <defs>
        <radialGradient id={`${id}-field`} cx="50%" cy={portrait ? "42%" : "47%"} r="70%">
          <stop offset="0" stopColor={mixHex(bgColor, accentColor, .2)} />
          <stop offset="52%" stopColor={mixHex(bgColor, accentColor, .07, mixTheme(thBg,thAcc,.1))} />
          <stop offset="100%" stopColor={bgColor} />
        </radialGradient>
        <radialGradient id={`${id}-core`}>
          <stop offset="0" stopColor={textColor} stopOpacity="1" />
          <stop offset="18%" stopColor={pale} stopOpacity=".95" />
          <stop offset="56%" stopColor={accentColor} stopOpacity=".28" />
          <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-glow`} x="-250%" y="-250%" width="600%" height="600%">
          <feGaussianBlur stdDeviation={5 * unit} result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect width={width} height={height} fill={`url(#${id}-field)`} opacity={coverOpacity} />
      <g opacity={coverOpacity * constellationIn}>
        {stars.map((star, index) => <circle key={index} cx={star.x} cy={star.y} r={star.r} fill={index % 7 === 0 ? accentColor : textColor} opacity={star.opacity * (.72 + .28 * Math.sin(seconds * 1.8 + index))} />)}
      </g>

      <g opacity={graphicsOut * constellationIn}>
        <text x={width * .5} y={height * .145} fill={textColor} opacity={labelOpacity} fontFamily={fontFamily} fontSize={Math.max(12, 17 * unit)} letterSpacing={7 * unit} textAnchor="middle">CONSTELLATIONS ALIGNING / {String(constellation.length).padStart(2, "0")} STARS</text>

        {Array.from({length: 4}, (_, group) => {
          const indices = constellation.map((point, index) => point.group === group ? index : -1).filter((index) => index >= 0);
          return <g key={group} opacity={constellationLinesOut}>
            {indices.slice(0, -1).map((index, localIndex) => {
              const a = pointAt(index);
              const b = pointAt(indices[localIndex + 1]);
              return <line key={index} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={group % 2 === 0 ? accentColor : pale} strokeWidth={Math.max(.65, unit * .82)} pathLength="1" strokeDasharray={`${connectionDraw} 1`} opacity={.42} />;
            })}
            {indices.length > 4 ? (() => {
              const a = pointAt(indices[1]);
              const b = pointAt(indices[4]);
              return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={mid} strokeWidth={Math.max(.55, unit * .7)} pathLength="1" strokeDasharray={`${connectionDraw} 1`} opacity={.3} />;
            })() : null}
          </g>;
        })}

        {constellation.map((point, index) => {
          const current = pointAt(index);
          const twinkle = .72 + .28 * Math.sin(seconds * (2.1 + point.drift) + point.phase);
          const glowRadius = current.size * (point.bright ? 5.5 : 3.2);
          const ray = current.size * interpolate(settle, [0, 1], [4.4, 2.2], clamp);
          return <g key={index} opacity={constellationOpacity}>
            {point.bright ? <circle cx={current.x} cy={current.y} r={glowRadius} fill={accentColor} opacity={.11 * twinkle} filter={`url(#${id}-glow)`} /> : null}
            {point.bright ? <>
              <line x1={current.x - ray} x2={current.x + ray} y1={current.y} y2={current.y} stroke={pale} strokeWidth={Math.max(.45, unit * .62)} opacity={twinkle * .58} />
              <line x1={current.x} x2={current.x} y1={current.y - ray * 1.55} y2={current.y + ray * 1.55} stroke={pale} strokeWidth={Math.max(.45, unit * .62)} opacity={twinkle * .58} />
            </> : null}
            <circle cx={current.x} cy={current.y} r={current.size * interpolate(settle, [0, 1], [1, .62], clamp)} fill={point.bright ? textColor : index % 5 === 0 ? accentColor : pale} opacity={twinkle} />
          </g>;
        })}

        <rect x={tableLeft} y={tableTop} width={tableWidth} height={tableHeight} rx={(portrait ? 24 : 18) * unit} fill="none" stroke={accentColor} strokeWidth={1.15 * unit} pathLength="1" strokeDasharray={`${gridDraw} 1`} opacity={settle * .8} filter={`url(#${id}-glow)`} />
        {rowEdges.slice(1, -1).map((y, index) => <line key={index} x1={tableLeft} x2={tableRight} y1={y} y2={y} stroke={textColor} strokeWidth={.7 * unit} pathLength="1" strokeDasharray={`${gridDraw} 1`} opacity={settle * (index === 0 ? .34 : .18)} />)}
      </g>
    </svg>
  </AbsoluteFill>;
};

// Star-field arrival: the scene starts as a dense field of fine stars on black. The stars drift outward
// in depth layers, as if the camera is easing forward, while the black thins and the scene rises out of
// the field; the stars then carry on behind it and hand over to the scene's own sky.
// Colours follow the scene's accent.
export const STAR_ARRIVAL_FRAMES = 100;
export const STAR_ARRIVAL_CONTENT_DELAY = 24;
export const StarArrivalTransition: React.FC<{accentColor?: string; bgColor?: string; textColor?: string}> = ({
  accentColor = "#217cff",
  bgColor = "#000000",
  textColor = "#ffffff",
}) => {
  const thTxt = textColor; const thBg = bgColor; const thAcc = accentColor; const thPale = mixTheme(thAcc, thTxt, .78); const thMid = mixTheme(thAcc, thTxt, .42);
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const id = `stararrival-${useId().replace(/:/g, "")}`;
  const unit = Math.min(width, height) / 1080;
  const pale = mixHex(accentColor, thTxt, .82, thPale);
  const mid = mixHex(accentColor, thTxt, .45);
  const layers = React.useMemo(() => {
    const make = (count: number, salt: number, sizes: number[]) => {
      const classes: string[][] = sizes.map(() => []);
      for (let i = 0; i < count; i++) {
        const x = starlitRand(i + salt, 1) * width;
        const y = starlitRand(i + salt, 2) * height;
        const k = starlitRand(i + salt, 3);
        const c = Math.min(sizes.length - 1, Math.floor(Math.pow(k, 1.6) * sizes.length));
        classes[c].push(`M${x.toFixed(1)} ${y.toFixed(1)}h.01`);
      }
      return classes.map((c) => c.join(""));
    };
    return [
      {paths: make(6000, 9100, [1, 1.5]), widths: [1, 1.5], rate: .14, opacity: .8},
      {paths: make(2400, 9400, [1.6, 2.4, 3.4]), widths: [1.6, 2.4, 3.4], rate: .5, opacity: .92},
      {paths: make(380, 9700, [3, 4.6, 6.4]), widths: [3, 4.6, 6.4], rate: 1.3, opacity: 1},
    ];
  }, [width, height]);
  const glows = [{x: .72, y: .3, r: .05, rate: .9}, {x: .24, y: .62, r: .04, rate: .7}, {x: .55, y: .16, r: .035, rate: 1.1}];
  if (frame > STAR_ARRIVAL_FRAMES) return null;
  const seconds = frame / 30;
  const starsIn = interpolate(frame, [0, 12], [0, 1], clamp);
  const dolly = Easing.inOut(Easing.quad)(interpolate(frame, [0, STAR_ARRIVAL_FRAMES], [0, 1], clamp));
  const coverOut = interpolate(frame, [22, 74], [1, 0], {...clamp, easing: Easing.inOut(Easing.sin)});
  const starsOut = interpolate(frame, [54, STAR_ARRIVAL_FRAMES - 2], [1, 0], {...clamp, easing: Easing.inOut(Easing.sin)});
  const cx = width / 2;
  const cy = height / 2;
  const scaleAbout = (rate: number) => `translate(${cx} ${cy}) scale(${1 + rate * dolly * 1.9}) translate(${-cx} ${-cy})`;
  return <AbsoluteFill style={{pointerEvents: "none", overflow: "hidden", zIndex: 20}}>
    <svg viewBox={`0 0 ${width} ${height}`} style={svgStyle}>
      <defs>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0%" stopColor={pale} stopOpacity=".85" /><stop offset="18%" stopColor={mid} stopOpacity=".6" />
          <stop offset="50%" stopColor={accentColor} stopOpacity=".2" /><stop offset="100%" stopColor={accentColor} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={width} height={height} fill={bgColor} opacity={coverOut} />
      <g opacity={starsIn * starsOut}>
        {layers.map((layer, li) => (
          <g key={li} transform={scaleAbout(layer.rate)}>
            {layer.paths.map((d, i) => <path key={i} d={d} stroke={li === 2 && i === 2 ? pale : textColor} strokeWidth={layer.widths[i] * unit} strokeLinecap="round" opacity={layer.opacity * (.62 + .38 * (i + 1) / layer.paths.length) * (li === 2 ? .85 + .15 * Math.sin(seconds * 1.4 + i) : 1)} />)}
          </g>
        ))}
        {glows.map((g, i) => (
          <g key={i} transform={scaleAbout(g.rate)}>
            <circle cx={width * g.x} cy={height * g.y} r={Math.min(width, height) * g.r * (1 + .05 * Math.sin(seconds * 1.1 + i))} fill={`url(#${id}-glow)`} />
          </g>
        ))}
      </g>
    </svg>
  </AbsoluteFill>;
};

// Grid build: the black screen is drafted into a table. A faint grid draws across the frame, the
// column and row lines that belong to the real table brighten, then the table's outline snaps on and
// traces round while the loose grid falls away. The real table (header, then each row) slides in
// over the lines it will sit on. Vector-sharp throughout: no haze, noise or particles.
export const GRID_BUILD_FRAMES = 84;
export const GRID_BUILD_CONTENT_DELAY = 30;
export const GridBuildTransition: React.FC<{
  accentColor?: string;
  bgColor?: string;
  textColor?: string;
  tickerTable?: {headers?: string[]; rows?: string[][]};
}> = ({
  accentColor = "#217cff",
  bgColor = "#000000",
  textColor = "#ffffff",
  tickerTable,
}) => {
  const thTxt = textColor; const thBg = bgColor; const thAcc = accentColor; const thPale = mixTheme(thAcc, thTxt, .78); const thMid = mixTheme(thAcc, thTxt, .42);
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const portrait = height > width;
  const unit = Math.min(width, height) / 1080;
  const rows = (tickerTable?.rows ?? []).slice(0, 20).map((row) => row.slice(0, 6));
  const headers = (tickerTable?.headers ?? []).slice(0, 6);
  if (frame > GRID_BUILD_FRAMES || (rows.length === 0 && headers.length === 0)) return null;
  const colCount = Math.max(1, headers.length, ...rows.map((row) => row.length));
  const rowCount = Math.max(1, rows.length);

  // Same geometry as the real table (see TickerTable): so the drafted lines are its own lines.
  const tableLeft = width * (portrait ? .05 : .09);
  const tableWidth = width * (portrait ? .9 : .82);
  const headerHeight = portrait ? 66 : 52;
  const idealRowHeight = portrait
    ? (rowCount <= 4 ? 130 : rowCount <= 7 ? 100 : 78)
    : (rowCount <= 4 ? 92 : rowCount <= 7 ? 70 : 54);
  const tableHeight = Math.min(height * (portrait ? .62 : .64), headerHeight + rowCount * idealRowHeight);
  const titleSize = portrait ? 76 : 72;
  const titleBlock = titleSize * 1.04 + (portrait ? 36 : 30);
  const tableTop = height * .08 + (height * .84 - titleBlock - tableHeight) / 2 + titleBlock;
  const tableRight = tableLeft + tableWidth;
  const tableBottom = tableTop + tableHeight;
  const bodyRow = (tableHeight - headerHeight) / rowCount;
  const weights = colCount === 3 ? [portrait ? 1.25 : 1.35, 1, 1] : Array.from({length: colCount}, (_, i) => (i === 0 && colCount > 3 ? 1.6 : 1));
  const wSum = weights.reduce((a, b) => a + b, 0);
  const colX: number[] = [];
  weights.reduce((acc, w) => { colX.push(tableLeft + (acc / wSum) * tableWidth); return acc + w; }, 0);
  colX.shift(); // inner column dividers only
  const rowY = [tableTop + headerHeight, ...Array.from({length: rowCount - 1}, (_, i) => tableTop + headerHeight + bodyRow * (i + 1))];
  const radius = portrait ? 24 : 18;

  const cover = interpolate(frame, [4, 46], [1, 0], {...clamp, easing: Easing.inOut(Easing.sin)});
  const ease = Easing.out(Easing.cubic);
  const looseDraw = interpolate(frame, [0, 26], [0, 1], {...clamp, easing: ease});
  const looseOut = interpolate(frame, [34, 60], [1, 0], clamp);
  const tableLines = interpolate(frame, [8, 34], [0, 1], {...clamp, easing: ease});
  const tableLinesOut = interpolate(frame, [52, 78], [1, 0], clamp);
  const outline = interpolate(frame, [28, 58], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const outlineOut = interpolate(frame, [62, GRID_BUILD_FRAMES], [1, 0], clamp);
  const pale = mixHex(accentColor, thTxt, .8, thPale);

  // loose full-frame grid
  const step = 120 * unit;
  const looseV = Array.from({length: Math.ceil(width / step) + 1}, (_, i) => i * step);
  const looseH = Array.from({length: Math.ceil(height / step) + 1}, (_, i) => i * step);
  // leading point travelling round the outline (straight-edge approximation)
  const perim = 2 * (tableWidth + tableHeight);
  const d = outline * perim;
  const lead = d <= tableWidth ? {x: tableLeft + d, y: tableTop}
    : d <= tableWidth + tableHeight ? {x: tableRight, y: tableTop + (d - tableWidth)}
    : d <= 2 * tableWidth + tableHeight ? {x: tableRight - (d - tableWidth - tableHeight), y: tableBottom}
    : {x: tableLeft, y: tableBottom - (d - 2 * tableWidth - tableHeight)};
  // Constellation: loose stars joined by thin lines drift in from the sky and converge onto the table's
  // outline, so the connecting lines become its border; stars also light up at every line crossing.
  const ringStars = React.useMemo(() => {
    const N = 22;
    const cxm = width / 2, cym = height / 2;
    const rim = (u: number) => {
      const dd = (((u % 1) + 1) % 1) * 2 * (tableWidth + tableHeight);
      if (dd <= tableWidth) return {x: tableLeft + dd, y: tableTop};
      if (dd <= tableWidth + tableHeight) return {x: tableRight, y: tableTop + (dd - tableWidth)};
      if (dd <= 2 * tableWidth + tableHeight) return {x: tableRight - (dd - tableWidth - tableHeight), y: tableBottom};
      return {x: tableLeft, y: tableBottom - (dd - 2 * tableWidth - tableHeight)};
    };
    const tg = Array.from({length: N}, (_, i) => rim(i / N));
    const ang = (q: {x: number; y: number}) => Math.atan2(q.y - cym, q.x - cxm);
    const sources = Array.from({length: N}, (_, i) => {
      const a = starlitRand(i + 7771, 1) * Math.PI * 2;
      const r = .34 + starlitRand(i + 7771, 2) * .2;
      return {x: cxm + Math.cos(a) * width * r * 1.05, y: cym + Math.sin(a) * height * r * 1.05, size: 1.6 + starlitRand(i + 7771, 3) * 1.6, phase: starlitRand(i + 7771, 4) * 6};
    });
    const bySrc = [...sources].sort((a, b) => ang(a) - ang(b));
    const byTg = [...tg].sort((a, b) => ang(a) - ang(b));
    return bySrc.map((src, i) => ({...src, tx: byTg[i].x, ty: byTg[i].y}));
  }, [width, height, tableLeft, tableTop, tableWidth, tableHeight, tableRight, tableBottom]);
  const conv = interpolate(frame, [22, 58], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const starsIn = interpolate(frame, [2, 14], [0, 1], clamp);
  const ringLineDraw = interpolate(frame, [6, 26], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const ringOut = interpolate(frame, [58, 76], [1, 0], clamp);
  const pos = ringStars.map((st) => ({x: st.x + (st.tx - st.x) * conv, y: st.y + (st.ty - st.y) * conv, size: st.size, phase: st.phase}));
  const xs = [tableLeft, ...colX, tableRight];
  const ys = [tableTop, ...rowY, tableBottom];
  const seconds = frame / 30;
  const line = (k: string, x1: number, y1: number, x2: number, y2: number, draw: number, opacity: number, w: number, color: string) => (
    <line key={k} x1={x1} y1={y1} x2={x1 + (x2 - x1) * draw} y2={y1 + (y2 - y1) * draw} stroke={color} strokeWidth={w} opacity={opacity} strokeLinecap="round" />
  );
  return <AbsoluteFill style={{pointerEvents: "none", overflow: "hidden", zIndex: 20}}>
    <svg viewBox={`0 0 ${width} ${height}`} style={svgStyle}>
      <rect width={width} height={height} fill={bgColor} opacity={cover} />
      {/* faint loose grid, drawn out from the table's corner */}
      <g opacity={looseOut}>
        {looseV.map((x, i) => line(`lv${i}`, x, 0, x, height, interpolate(looseDraw, [Math.min(.6, Math.abs(x - tableLeft) / width * .6), 1], [0, 1], clamp), .16, Math.max(1, unit), accentColor))}
        {looseH.map((y, i) => line(`lh${i}`, 0, y, width, y, interpolate(looseDraw, [Math.min(.6, Math.abs(y - tableTop) / height * .6), 1], [0, 1], clamp), .16, Math.max(1, unit), accentColor))}
      </g>
      {/* the table's own column and row lines */}
      <g opacity={tableLinesOut}>
        {colX.map((x, i) => line(`cv${i}`, x, tableTop, x, tableBottom, tableLines, .55, Math.max(1.2, 1.4 * unit), accentColor))}
        {line("hd", tableLeft, tableTop + headerHeight, tableRight, tableTop + headerHeight, tableLines, .7, Math.max(1.2, 1.4 * unit), accentColor)}
        {rowY.slice(1).map((y, i) => line(`rh${i}`, tableLeft, y, tableRight, y, interpolate(tableLines, [Math.min(.55, (i + 1) / rowCount * .5), 1], [0, 1], clamp), .4, Math.max(1, unit), accentColor))}
      </g>
      {/* constellation: loose stars joined by thin lines converge onto the outline */}
      <g opacity={ringOut}>
        {pos.map((a, i) => {
          const b = pos[(i + 1) % pos.length];
          const dr = interpolate(ringLineDraw, [i / pos.length * .5, i / pos.length * .5 + .5], [0, 1], clamp);
          return <line key={`rl${i}`} x1={a.x} y1={a.y} x2={a.x + (b.x - a.x) * dr} y2={a.y + (b.y - a.y) * dr} stroke={accentColor} strokeWidth={Math.max(1, 1.1 * unit)} opacity=".6" strokeLinecap="round" />;
        })}
        {pos.map((a, i) => {
          const tw = .75 + .25 * Math.sin(seconds * 2.2 + a.phase);
          return <g key={`rs${i}`} opacity={starsIn * tw}>
            <circle cx={a.x} cy={a.y} r={Math.max(7, 9 * unit) * (.6 + a.size * .25)} fill={accentColor} opacity=".22" />
            <circle cx={a.x} cy={a.y} r={Math.max(1.6, a.size * unit * 1.5)} fill={pale} />
          </g>;
        })}
      </g>
      {/* stars light up where the table's lines cross */}
      <g opacity={tableLinesOut}>
        {ys.flatMap((y, yi) => xs.map((x, xi) => {
          const delay = 6 + (x - tableLeft) / tableWidth * 16 + (y - tableTop) / tableHeight * 10;
          const pop = interpolate(frame, [delay, delay + 9], [0, 1], {...clamp, easing: Easing.out(Easing.back(2))});
          const corner = (xi === 0 || xi === xs.length - 1) && (yi === 0 || yi === ys.length - 1);
          const tw = .8 + .2 * Math.sin(seconds * 2 + xi * 1.3 + yi * .9);
          return <g key={`ix${xi}-${yi}`} opacity={pop * tw} transform={`translate(${x} ${y}) scale(${pop})`}>
            <circle r={Math.max(6, 8 * unit) * (corner ? 1.5 : 1)} fill={accentColor} opacity=".24" />
            <circle r={Math.max(1.6, (corner ? 3.6 : 2.4) * unit)} fill={pale} />
          </g>;
        }))}
      </g>
      {/* outline traces round the table, leading point bright */}
      <g opacity={outlineOut}>
        <rect x={tableLeft} y={tableTop} width={tableWidth} height={tableHeight} rx={radius} fill="none" stroke={accentColor} strokeWidth={Math.max(1.6, 1.8 * unit)} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - outline} />
        {outline > 0 && outline < 1 ? <>
          <circle cx={lead.x} cy={lead.y} r={Math.max(7, 9 * unit)} fill={accentColor} opacity=".32" />
          <circle cx={lead.x} cy={lead.y} r={Math.max(2.5, 3.2 * unit)} fill={pale} />
        </> : null}
      </g>
    </svg>
  </AbsoluteFill>;
};

export const SceneTransition: React.FC<SceneTransitionProps> = ({
  layout,
  accentColor = "#217cff",
  bgColor = "#000000",
  textColor = "#ffffff",
  fontFamily,
  chartTable,
  chartType,
  tickerTable,
}) => {
  const thTxt = textColor; const thBg = bgColor; const thAcc = accentColor; const thPale = mixTheme(thAcc, thTxt, .78); const thMid = mixTheme(thAcc, thTxt, .42);
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const isMeteorReveal = layout === "stat_callout";
  const isConstellationTable = layout === "ticker_table";
  const isExtendedTransition = ["stat_callout", "split_image", "ringed_planet", "rocket_launch", "quote_card", "galaxy_deep_dive"].includes(layout);
  const activeTransitionFrames = isConstellationTable
    ? GRID_BUILD_FRAMES
    : layout === "quote_card"
    ? STARLIT_QUOTE_REVEAL_FRAMES
    : layout === "cosmic_hero"
    ? STAR_ARRIVAL_FRAMES
    : layout === "text_narration"
    ? STARLIT_NARRATIVE_REVEAL_FRAMES
    : layout === "split_image"
    ? NEBULA_CORE_FRAMES
    : layout === "ending_socials"
    ? STARLIT_ENDING_REVEAL_FRAMES
    : isMeteorReveal
      ? STARLIT_METEOR_REVEAL_FRAMES
      : isExtendedTransition
        ? STARLIT_STARRY_TRANSITION_FRAMES
        : STARLIT_TRANSITION_FRAMES;
  const reveal = interpolate(frame, [0, 22], [0, 1], {
    ...clamp,
    easing: smooth,
  });
  const fadeStartFrame = layout === "cosmic_hero" || layout === "text_narration"
    ? 30
    : layout === "ending_socials"
      ? 25
    : isMeteorReveal
      ? 46
      : isExtendedTransition
        ? 25
        : 12;
  const fade = interpolate(frame, [fadeStartFrame, activeTransitionFrames], [1, 0], clamp);
  const cx = width / 2;
  const cy = height / 2;
  const diagonal = Math.hypot(width, height);

  // GalaxyDeepDive performs its own Notestack-style camera warp and grows its
  // hierarchy branch by branch. A supernova overlay obscures that effect.
  if (layout === "galaxy_deep_dive") return null;

  // DataVisualisation owns its entrance so its real points assemble and its
  // real series draw exactly once, without a second overlay animation.
  if (layout === "data_visualisation") return null;

  if (frame > activeTransitionFrames) return null;

  // The hero scene opens with no transition.
  if (layout === "cosmic_hero") return null;

  if (layout === "cosmic_hero_legacy") {
    const portrait = height > width;
    const t = interpolate(frame, [0, STARLIT_HERO_REVEAL_FRAMES], [0, 1], clamp);
    const open = smooth(interpolate(t, [.06, .88], [0, 1], clamp));
    const planetX = width / 2;
    const targetRimY = portrait ? height * .89 - width * .64 : height * 1.68 - width * .61;
    const visibleDepth = Math.max(1, height - targetRimY);
    const planetR = ((width / 2) ** 2 + visibleDepth ** 2) / (2 * visibleDepth);
    const planetY = targetRimY + planetR;
    const aperture = diagonal * .74 * open;
    const ringOpacity = Math.sin(Math.min(1, t) * Math.PI) * .72;
    const rimY = planetY - planetR;

    return (
      <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={svgStyle}>
          <defs>
            <mask id="starlit-hero-centred-reveal">
              <rect width={width} height={height} fill="#fff" />
              <circle cx={planetX} cy={rimY} r={aperture} fill="#000" />
            </mask>
          </defs>
          <rect width={width} height={height} fill={bgColor} mask="url(#starlit-hero-centred-reveal)" opacity={fade} />
          <circle cx={planetX} cy={rimY} r={Math.max(2, aperture)} fill="none" stroke={accentColor} strokeWidth={Math.max(1, Math.min(width, height) * .0014)} opacity={ringOpacity} />
          <circle cx={planetX} cy={rimY} r={Math.max(1.5, Math.min(width, height) * .0022)} fill={textColor} opacity={ringOpacity} />
        </svg>
      </AbsoluteFill>
    );
  }

  if (layout === "text_narration") {
    const t = interpolate(frame, [0, STARLIT_NARRATIVE_REVEAL_FRAMES], [0, 1], clamp);
    const travel = Easing.in(Easing.cubic)(interpolate(t, [.04, .88], [0, 1], clamp));
    const coverOpacity = interpolate(t, [0, .14, .72, 1], [1, 1, .32, 0], clamp);
    const trailOpacity = interpolate(t, [0, .16, .66, 1], [0, .35, 1, 0], clamp);
    const focusX = width * .5;
    const focusY = height * .5;
    const stars = Array.from({length: height > width ? 150 : 210}, (_, index) => {
      const angle = starlitRand(index + 1781, 1) * Math.PI * 2;
      const depth = .2 + starlitRand(index + 1781, 2) * .8;
      const startRadius = Math.pow(starlitRand(index + 1781, 3), .72) * diagonal * .46;
      const radius = startRadius * (1 + travel * (1.4 + depth * 3.6));
      const length = Math.min(width, height) * (.012 + depth * .085) * travel;
      const x = focusX + Math.cos(angle) * radius;
      const y = focusY + Math.sin(angle) * radius;
      const x1 = x - Math.cos(angle) * length;
      const y1 = y - Math.sin(angle) * length;
      return {x, y, x1, y1, depth, blue: index % 7 === 0};
    });
    const shock = interpolate(t, [.18, .72], [0, diagonal * .58], {...clamp, easing: Easing.out(Easing.cubic)});
    const shockOpacity = interpolate(t, [.16, .38, .78], [0, .75, 0], clamp);

    return (
      <AbsoluteFill style={{pointerEvents: "none", overflow: "hidden"}}>
        <svg viewBox={`0 0 ${width} ${height}`} style={svgStyle}>
          <rect width={width} height={height} fill={bgColor} opacity={coverOpacity} />
          <g opacity={trailOpacity}>
            {stars.map((star, index) => (
              <line key={index} x1={star.x1} y1={star.y1} x2={star.x} y2={star.y} stroke={star.blue ? accentColor : textColor} strokeWidth={.55 + star.depth * 1.5} strokeLinecap="round" opacity={.28 + star.depth * .72} />
            ))}
            <circle cx={focusX} cy={focusY} r={shock} fill="none" stroke={accentColor} strokeWidth={Math.max(1, Math.min(width, height) * .0016)} opacity={shockOpacity} />
            <circle cx={focusX} cy={focusY} r={Math.max(1.5, Math.min(width, height) * .0024)} fill={textColor} opacity={shockOpacity} />
          </g>
        </svg>
      </AbsoluteFill>
    );
  }

  if (layout === "split_image") {
    return <NebulaCoreTransition accentColor={accentColor} bgColor={bgColor} textColor={textColor} />;
    const t = interpolate(frame, [0, STARLIT_SPLIT_REVEAL_FRAMES], [0, 1], clamp);
    const portrait = height > width;
    const focusX = width * (portrait ? .5 : .70);
    const focusY = height * (portrait ? .64 : .5);
    const open = Easing.inOut(Easing.cubic)(interpolate(t, [.08, .96], [0, 1], clamp));
    const radius = Math.max(1, diagonal * 2.2 * open);
    const energy = Math.pow(Math.sin(t * Math.PI), 1.4);
    const travel = Easing.in(Easing.cubic)(t);
    return <AbsoluteFill style={{pointerEvents: "none", overflow: "hidden"}}>
      <svg viewBox={`0 0 ${width} ${height}`} style={svgStyle}>
        <defs>
          <radialGradient id="split-cosmic-opening" gradientUnits="userSpaceOnUse" cx={focusX} cy={focusY} r={radius}>
            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
            <stop offset="48%" stopColor="#fff" stopOpacity="0" />
            <stop offset="76%" stopColor="#fff" stopOpacity=".6" />
            <stop offset="100%" stopColor="#fff" />
          </radialGradient>
          <mask id="split-cosmic-mask" style={{maskType: "alpha"}}>
            <rect width={width} height={height} fill="url(#split-cosmic-opening)" />
          </mask>
          <radialGradient id="split-cosmic-light">
            <stop offset="0%" stopColor={textColor} stopOpacity=".65" />
            <stop offset="12%" stopColor={accentColor} stopOpacity=".38" />
            <stop offset="48%" stopColor={accentColor} stopOpacity=".09" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={width} height={height} fill={bgColor} mask="url(#split-cosmic-mask)" />
        <ellipse cx={focusX} cy={focusY} rx={width * (.12 + open * .28)} ry={height * (.08 + open * .26)} fill="url(#split-cosmic-light)" opacity={energy * .65} />
        {Array.from({length: portrait ? 115 : 160}, (_, index) => {
          const angle = starlitRand(index + 7311, 1) * Math.PI * 2;
          const depth = .18 + starlitRand(index + 7311, 2) * .82;
          const initial = Math.pow(starlitRand(index + 7311, 3), .8) * diagonal * .42;
          const distance = initial + travel * diagonal * (.25 + depth * .65);
          const length = Math.min(width, height) * (.004 + depth * .045) * energy;
          const x = focusX + Math.cos(angle) * distance;
          const y = focusY + Math.sin(angle) * distance;
          const opacity = energy * (.22 + depth * .58);
          const color = index % 5 === 0 ? accentColor : textColor;
          return <g key={index} opacity={opacity}>
            <line x1={x - Math.cos(angle) * length} y1={y - Math.sin(angle) * length} x2={x} y2={y} stroke={color} strokeWidth={.5 + depth * 1.1} strokeLinecap="round" />
            {index % 9 === 0 ? <>
              <circle cx={x} cy={y} r={2 + depth * 5} fill={accentColor} opacity=".12" />
              <circle cx={x} cy={y} r={.8 + depth} fill={textColor} />
            </> : null}
          </g>;
        })}
        {/* Fine luminous filaments provide structure without a hard iris ring. */}
        {Array.from({length: 5}, (_, index) => {
          const y = focusY + (index - 2) * height * .035;
          return <path key={index} d={`M ${focusX - width * .28} ${y + height * .12} Q ${focusX} ${y - height * .1} ${focusX + width * .35} ${y}`}
            fill="none" stroke={accentColor} strokeWidth={.6 + index * .12} opacity={energy * .09} />;
        })}
      </svg>
    </AbsoluteFill>;
  }

  if (layout === "stat_callout") {
    // One meteor cuts open the dark veil. Its widening trail is the reveal,
    // so the motion resolves directly into the real scene instead of becoming
    // a separate graphic interstitial.
    const flight = interpolate(frame, [6, 64], [0, 1], {
      ...clamp,
      easing: Easing.inOut(Easing.quad),
    });
    const startX = -width * .10;
    const startY = -height * .14;
    const endX = width * 1.24;
    const endY = height * 1.28;
    const travelX = endX - startX;
    const travelY = endY - startY;
    const travelLength = Math.hypot(travelX, travelY) || 1;
    const directionX = travelX / travelLength;
    const directionY = travelY / travelLength;
    const perpendicularX = -directionY;
    const perpendicularY = directionX;
    const headX = interpolate(flight, [0, 1], [startX, endX]);
    const headY = interpolate(flight, [0, 1], [startY, endY]);
    const revealSpread = interpolate(flight, [0, .60, 1], [3, height * .12, diagonal * 1.02], {
      ...clamp,
      easing: smooth,
    });
    const revealPoints = [
      `${startX + perpendicularX * revealSpread},${startY + perpendicularY * revealSpread}`,
      `${startX - perpendicularX * revealSpread},${startY - perpendicularY * revealSpread}`,
      `${headX - perpendicularX * revealSpread},${headY - perpendicularY * revealSpread}`,
      `${headX + perpendicularX * revealSpread},${headY + perpendicularY * revealSpread}`,
    ].join(" ");
    const tail = Math.min(width, height) * .34;
    const tailStartX = headX - directionX * tail;
    const tailStartY = headY - directionY * tail;
    const tailHalfWidth = Math.max(5, height * .011);
    const heroTail = `M ${headX} ${headY} L ${tailStartX + perpendicularX * tailHalfWidth} ${tailStartY + perpendicularY * tailHalfWidth} Q ${tailStartX - directionX * tail * .12} ${tailStartY - directionY * tail * .12} ${tailStartX - perpendicularX * tailHalfWidth} ${tailStartY - perpendicularY * tailHalfWidth} Z`;
    const flare = interpolate(frame, [4, 15, 58, STARLIT_METEOR_REVEAL_FRAMES], [0, 1, .88, 0], clamp);
    return (
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={svgStyle}>
          <defs>
            <mask id="starlit-meteor-reveal">
              <rect width={width} height={height} fill="#fff" />
              <polygon points={revealPoints} fill="#000" filter="url(#starlit-reveal-feather)" />
            </mask>
            <filter id="starlit-reveal-feather" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation={Math.max(12, height * .018)} />
            </filter>
            <filter id="starlit-meteor-glow" x="-180%" y="-180%" width="460%" height="460%">
              <feGaussianBlur stdDeviation="7" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <linearGradient id="starlit-hero-tail" gradientUnits="userSpaceOnUse" x1={tailStartX} y1={tailStartY} x2={headX} y2={headY}>
              <stop offset="0%" stopColor={accentColor} stopOpacity="0" />
              <stop offset="46%" stopColor={accentColor} stopOpacity=".16" />
              <stop offset="78%" stopColor={mixHex(accentColor, textColor, .65, textColor)} stopOpacity=".52" />
              <stop offset="100%" stopColor={textColor} stopOpacity=".96" />
            </linearGradient>
          </defs>
          <rect width={width} height={height} fill={bgColor} mask="url(#starlit-meteor-reveal)" opacity={fade} />
          <path d={heroTail} fill="url(#starlit-hero-tail)" opacity={flare * .82} filter="url(#starlit-meteor-glow)" />
          <path d={`M ${headX} ${headY} L ${tailStartX + perpendicularX * 1.4} ${tailStartY + perpendicularY * 1.4} L ${tailStartX - perpendicularX * 1.4} ${tailStartY - perpendicularY * 1.4} Z`} fill="url(#starlit-hero-tail)" opacity={flare * .92} />
          <circle cx={headX} cy={headY} r={Math.max(12, height * .022)} fill={accentColor} opacity={flare * .16} filter="url(#starlit-meteor-glow)" />
          <path d={`M ${headX} ${headY - height * .008} L ${headX + height * .0045} ${headY} L ${headX} ${headY + height * .008} L ${headX - height * .0045} ${headY} Z`} fill={thTxt} opacity={flare} filter="url(#starlit-meteor-glow)" />
          <circle cx={headX} cy={headY} r={Math.max(1.8, height * .0027)} fill={thTxt} opacity={flare} />
          <line x1={headX - height * .026} y1={headY} x2={headX + height * .026} y2={headY} stroke={thTxt} strokeWidth=".8" opacity={flare * .55} />
          <line x1={headX} y1={headY - height * .026} x2={headX} y2={headY + height * .026} stroke={thTxt} strokeWidth=".8" opacity={flare * .55} />
        </svg>
      </AbsoluteFill>
    );
  }

  if (layout === "ringed_planet") {
    const t = interpolate(frame, [0, STARLIT_STARRY_TRANSITION_FRAMES], [0, 1], clamp);
    const sweep = smooth(t);
    const topX = interpolate(sweep, [0, 1], [-width * .2, width * 1.2]);
    const bottomX = topX - width * .17;
    const lineOpacity = Math.sin(t * Math.PI);
    const orbitDraw = interpolate(t, [.05, .7], [0, 1], clamp);
    const orbX = topX - (topX - bottomX) * .52;
    const orbY = height * .52;
    return (
      <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={svgStyle}>
          <polygon points={`${topX},0 ${width},0 ${width},${height} ${bottomX},${height}`} fill={bgColor} />
          <ellipse cx={width * .7} cy={height * .56} rx={width * .38} ry={height * .18} fill="none" stroke={accentColor} strokeWidth="1.4" pathLength="1" strokeDasharray={`${orbitDraw} 1`} opacity={.72 * (1 - t)} transform={`rotate(-14 ${width * .7} ${height * .56})`} />
          <line x1={topX} y1="0" x2={bottomX} y2={height} stroke={accentColor} strokeWidth="13" opacity={lineOpacity * .16} />
          <line x1={topX} y1="0" x2={bottomX} y2={height} stroke={textColor} strokeWidth="1.5" opacity={lineOpacity} />
          <g transform={`translate(${orbX} ${orbY})`} opacity={lineOpacity}>
            <line x1={-height * .045} x2={height * .045} stroke={accentColor} strokeWidth="2" />
            <line y1={-height * .045} y2={height * .045} stroke={accentColor} strokeWidth="2" />
            <circle r={Math.max(3, height * .006)} fill={textColor} stroke={accentColor} strokeWidth="2" />
          </g>
        </svg>
      </AbsoluteFill>
    );
  }

  if (layout === "rocket_launch") {
    const t = interpolate(frame, [0, STARLIT_STARRY_TRANSITION_FRAMES], [0, 1], clamp);
    const vortexX = width * .5;
    const vortexY = height * .5;
    const aperture = interpolate(t, [.08, .96], [0, diagonal * .82], { ...clamp, easing: smooth });
    // Plain black iris that opens onto the spinning galaxy; the ring "web"
    // that used to sit on top of it is gone.
    return (
      <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={svgStyle}>
          <defs>
            <mask id="vortex-aperture"><rect width={width} height={height} fill="#fff" /><circle cx={vortexX} cy={vortexY} r={aperture} fill="#000" /></mask>
          </defs>
          <rect width={width} height={height} fill={bgColor} mask="url(#vortex-aperture)" opacity={fade} />
        </svg>
      </AbsoluteFill>
    );
  }

  if (layout === "quote_card") {
    const t = interpolate(frame, [0, STARLIT_QUOTE_REVEAL_FRAMES], [0, 1], clamp);
    const columns = 36;
    const rows = 22;
    const cellWidth = width / columns;
    const cellHeight = height / rows;
    const veil = interpolate(t, [0, .12, .60], [1, 1, 0], { ...clamp, easing: smooth });
    return (
      <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
        <AbsoluteFill style={{ background: bgColor, opacity: veil }} />
        {Array.from({ length: columns * rows }, (_, index) => {
          const column = index % columns;
          const row = Math.floor(index / columns);
          const delay = .04 + starlitRand(index + 401, 1) * .34;
          const local = Math.max(0, Math.min(1, (t - delay) / Math.max(.01, 1 - delay)));
          const driftX = (starlitRand(index + 401, 2) - .5) * cellWidth * 4.4 * local;
          const driftY = (-.75 - starlitRand(index + 401, 3) * 2.8) * cellHeight * local;
          const sparkle = Math.pow(Math.sin(local * Math.PI), .68) * interpolate(t, [.76, 1], [1, 0], clamp);
          const moteSize = Math.max(.8, height * (.0007 + starlitRand(index + 401, 7) * .0022));
          const color = index % 8 === 0 ? accentColor : textColor;
          return <div key={index} style={{ position: "absolute", left: column * cellWidth + cellWidth * (.18 + starlitRand(index + 401, 5) * .64), top: row * cellHeight + cellHeight * (.18 + starlitRand(index + 401, 6) * .64), width: moteSize, height: moteSize, borderRadius: "50%", background: color, opacity: sparkle, transform: `translate(${driftX}px, ${driftY}px) scale(${.35 + Math.sin(local * Math.PI) * 1.35})`, boxShadow: `0 0 ${moteSize * (index % 13 === 0 ? 7 : 4)}px ${color}` }} />;
        })}
      </AbsoluteFill>
    );
  }

  if (layout === "galaxy_deep_dive") {
    const t = interpolate(frame, [0, STARLIT_STARRY_TRANSITION_FRAMES], [0, 1], clamp);
    const burst = interpolate(t, [.08, .72], [0, 1], { ...clamp, easing: smooth });
    const aperture = interpolate(t, [.20, .88], [0, diagonal * .72], { ...clamp, easing: smooth });
    const core = interpolate(t, [0, .22, .52, .84], [0, 1, .82, 0], clamp);
    const shock = interpolate(t, [.18, .92], [0, diagonal * .47], { ...clamp, easing: Easing.out(Easing.cubic) });
    return (
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={svgStyle}>
          <defs>
            <mask id="supernova-reveal"><rect width={width} height={height} fill="#fff" /><circle cx={cx} cy={cy} r={aperture} fill="#000" /></mask>
            <filter id="supernova-glow" x="-160%" y="-160%" width="420%" height="420%"><feGaussianBlur stdDeviation="10" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <radialGradient id="supernova-core" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor={textColor} stopOpacity="1" /><stop offset="16%" stopColor={mixHex(accentColor, textColor, .8, textColor)} stopOpacity=".95" /><stop offset="42%" stopColor={accentColor} stopOpacity=".48" /><stop offset="100%" stopColor={accentColor} stopOpacity="0" /></radialGradient>
          </defs>
          <rect width={width} height={height} fill={bgColor} mask="url(#supernova-reveal)" opacity={fade} />
          {Array.from({ length: 104 }, (_, index) => {
            const angle = index * 2.39996 + starlitRand(index + 701, 1) * .18;
            const distance = burst * diagonal * (.12 + starlitRand(index + 701, 2) * .34);
            const length = Math.min(width, height) * (.012 + starlitRand(index + 701, 3) * .065) * burst;
            const startR = Math.max(3, distance - length);
            const opacity = core * (.28 + starlitRand(index + 701, 4) * .72);
            return <g key={index} opacity={opacity}>
              <line x1={cx + Math.cos(angle) * startR} y1={cy + Math.sin(angle) * startR} x2={cx + Math.cos(angle) * distance} y2={cy + Math.sin(angle) * distance} stroke={index % 8 === 0 ? accentColor : thTxt} strokeWidth={index % 11 === 0 ? 2.1 : .8} strokeLinecap="round" filter={index % 11 === 0 ? "url(#supernova-glow)" : undefined} />
              {index % 9 === 0 ? <circle cx={cx + Math.cos(angle) * distance} cy={cy + Math.sin(angle) * distance} r="2.2" fill={thTxt} filter="url(#supernova-glow)" /> : null}
            </g>;
          })}
          <circle cx={cx} cy={cy} r={Math.max(4, height * (.025 + core * .12))} fill="url(#supernova-core)" opacity={core} filter="url(#supernova-glow)" />
          <circle cx={cx} cy={cy} r={shock} fill="none" stroke={accentColor} strokeWidth={Math.max(1, 5 * (1 - t))} opacity={core * .7} filter="url(#supernova-glow)" />
          <circle cx={cx} cy={cy} r={shock * .96} fill="none" stroke={thTxt} strokeWidth=".75" opacity={core * .48} />
        </svg>
      </AbsoluteFill>
    );
  }

  // The ending scene (eclipse) owns its own entrance: no overlay thread or constellation line.
  if (layout === "ending_socials") return null;

  if (layout === "ending_socials_legacy") {
    const portrait = height > width;
    const t = interpolate(frame, [0, STARLIT_ENDING_REVEAL_FRAMES], [0, 1], clamp);
    const focusY = height * (portrait ? .22 : .24);
    const veilOpacity = interpolate(t, [0, .10, .72, 1], [1, .94, .18, 0], { ...clamp, easing: smooth });
    const trace = interpolate(t, [.08, .56], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
    const traceOpacity = interpolate(t, [.04, .18, .68, .94], [0, .38, .22, 0], clamp);
    const seamOpacity = interpolate(t, [0, .12, .58, .90], [0, .28, .12, 0], clamp);
    const starPoints = portrait
      ? [[.12, .25], [.30, .19], [.50, .23], [.69, .17], [.88, .22]]
      : [[.14, .28], [.31, .21], [.49, .25], [.68, .19], [.86, .24]];
    const path = starPoints.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x * width} ${y * height}`).join(" ");
    return (
      <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={svgStyle}>
          <defs>
            <filter id="starlit-ending-thread-glow" x="-80%" y="-140%" width="260%" height="380%">
              <feGaussianBlur stdDeviation={Math.max(2, Math.min(width, height) * .0032)} result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <linearGradient id="starlit-ending-seam" x1="0" x2="1">
              <stop offset="0%" stopColor={accentColor} stopOpacity="0" />
              <stop offset="24%" stopColor={accentColor} stopOpacity=".20" />
              <stop offset="50%" stopColor={textColor} stopOpacity=".68" />
              <stop offset="76%" stopColor={accentColor} stopOpacity=".20" />
              <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect width={width} height={height} fill={bgColor} opacity={veilOpacity} />
          <rect
            x={width * .08}
            y={focusY - Math.max(.5, Math.min(width, height) * .0005)}
            width={width * .84}
            height={Math.max(1, Math.min(width, height) * .001)}
            fill="url(#starlit-ending-seam)"
            opacity={seamOpacity}
            filter="url(#starlit-ending-thread-glow)"
          />
          <path
            d={path}
            pathLength="1"
            fill="none"
            stroke={accentColor}
            strokeWidth={Math.max(.65, Math.min(width, height) * .00075)}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${trace} 1`}
            opacity={traceOpacity}
          />
          {starPoints.map(([x, y], index) => {
            const starIn = interpolate(trace, [index * .14, Math.min(1, index * .14 + .24)], [0, 1], clamp);
            const radius = Math.max(1.2, Math.min(width, height) * (index === 2 ? .0024 : .00155));
            return (
              <g key={index} opacity={traceOpacity * starIn} filter="url(#starlit-ending-thread-glow)">
                <circle cx={x * width} cy={y * height} r={radius * 3.8} fill={accentColor} opacity=".12" />
                <circle cx={x * width} cy={y * height} r={radius} fill={index === 2 ? textColor : accentColor} />
              </g>
            );
          })}
        </svg>
      </AbsoluteFill>
    );
  }

  if (isConstellationTable) return <GridBuildTransition accentColor={accentColor} bgColor={bgColor} textColor={textColor} tickerTable={tickerTable} />;
  return <AbsoluteFill style={{ ...coverStyle, background: bgColor, opacity: fade }} />;
};
