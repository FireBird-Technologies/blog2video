import { useMemo } from "react";

// ─── colors ──────────────────────────────────────────────────────────────────
const UP = "#4A9EFF";
const DOWN = "#ef4444";
const AMBER = "#f5a623";
const BG = "#0a0a0a";
const MUTED = "#555";
const BORDER = "#1e1e1e";

// ─── types ───────────────────────────────────────────────────────────────────
export interface OHLCVTable {
  headers: string[];
  rows: string[][];
}

interface Props {
  value: OHLCVTable | null | undefined;
  onChange: (next: OHLCVTable) => void;
}

interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  isUp: boolean;
}

const DEFAULT_HEADERS = ["Date", "Open", "High", "Low", "Close", "Volume"];

// ─── helpers ─────────────────────────────────────────────────────────────────
function parseNum(s: string): number {
  return parseFloat(String(s ?? "").replace(/[$,\s]/g, "")) || 0;
}

function findCol(headers: string[], name: string): number {
  const n = name.toLowerCase();
  const exact = headers.findIndex((h) => h.toLowerCase() === n);
  if (exact >= 0) return exact;
  return headers.findIndex((h) => h.toLowerCase().includes(n));
}

function parseCandles(table: OHLCVTable): Candle[] {
  const h = table.headers;
  const dI = Math.max(0, findCol(h, "date"));
  const oI = findCol(h, "open") >= 0 ? findCol(h, "open") : 1;
  const hI = findCol(h, "high") >= 0 ? findCol(h, "high") : 2;
  const lI = findCol(h, "low") >= 0 ? findCol(h, "low") : 3;
  const cI = findCol(h, "close") >= 0 ? findCol(h, "close") : 4;
  return table.rows
    .map((r) => {
      const o = parseNum(r[oI]);
      const hi = parseNum(r[hI]);
      const lo = parseNum(r[lI]);
      const c = parseNum(r[cI]);
      return { date: r[dI] ?? "", open: o, high: hi, low: lo, close: c, isUp: c >= o };
    })
    .filter((d) => d.high > 0 && d.low > 0);
}

// ─── mini SVG candlestick chart ───────────────────────────────────────────────
function CandlePreview({ candles }: { candles: Candle[] }) {
  const W = 440, H = 112;
  const PL = 5, PR = 44, PT = 8, PB = 22;
  const cW = W - PL - PR;
  const cH = H - PT - PB;

  if (candles.length < 2) {
    return (
      <div
        style={{
          background: BG,
          height: H,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 6,
          border: `1px solid ${BORDER}`,
        }}
      >
        <span style={{ color: MUTED, fontSize: 11, fontFamily: "monospace" }}>
          {candles.length === 0 ? "No OHLCV data — add rows below" : "Need ≥ 2 rows to render"}
        </span>
      </div>
    );
  }

  const pMax = Math.max(...candles.map((d) => d.high));
  const pMin = Math.min(...candles.map((d) => d.low));
  const pRange = pMax - pMin || 1;
  const N = candles.length;
  const slotW = cW / N;
  const bodyW = Math.max(1.5, slotW * 0.68);
  const bOff = (slotW - bodyW) / 2;

  const toY = (v: number) => PT + cH - ((v - pMin) / pRange) * cH;
  const slotX = (i: number) => PL + i * slotW;
  const mid = (i: number) => slotX(i) + slotW / 2;

  const yTicks = [pMax, (pMax + pMin) / 2, pMin];
  const labelEvery = Math.max(1, Math.floor(N / 6));

  // Determine if prices look like big numbers (e.g. S&P) or small
  const fmt = (p: number) =>
    p >= 1000 ? p.toFixed(0) : p < 1 ? p.toPrecision(3) : p.toFixed(2);

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      style={{ background: BG, borderRadius: 6, display: "block", border: `1px solid ${BORDER}` }}
    >
      {/* Subtle horizontal gridlines */}
      {yTicks.map((p, i) => (
        <g key={i}>
          <line x1={PL} x2={W - PR} y1={toY(p)} y2={toY(p)} stroke="#1c1c1c" strokeWidth={0.7} />
          <text x={W - PR + 5} y={toY(p) + 3.5} fontSize={8} fill={MUTED} fontFamily="monospace">
            {fmt(p)}
          </text>
        </g>
      ))}

      {/* Candlesticks */}
      {candles.map((d, i) => {
        const color = d.isUp ? UP : DOWN;
        const bodyTop = Math.min(toY(d.open), toY(d.close));
        const bodyH = Math.max(1, Math.abs(toY(d.open) - toY(d.close)));
        return (
          <g key={i}>
            <line x1={mid(i)} y1={toY(d.high)} x2={mid(i)} y2={toY(d.low)} stroke={color} strokeWidth={0.75} />
            <rect x={slotX(i) + bOff} y={bodyTop} width={bodyW} height={bodyH} fill={color} />
          </g>
        );
      })}

      {/* X axis baseline */}
      <line x1={PL} x2={W - PR} y1={H - PB} y2={H - PB} stroke="#292929" strokeWidth={0.6} />

      {/* X date labels */}
      {candles.map((d, i) =>
        i % labelEvery === 0 ? (
          <text
            key={i}
            x={mid(i)}
            y={H - PB + 12}
            fontSize={8}
            fill={AMBER}
            fontFamily="monospace"
            textAnchor="middle"
          >
            {d.date.length > 8 ? d.date.slice(-7) : d.date}
          </text>
        ) : null,
      )}

      {/* Candle count badge */}
      <text x={PL + 5} y={PT + 11} fontSize={8} fill={AMBER} fontFamily="monospace" opacity={0.6}>
        {N} candles
      </text>

      {/* Up/down legend */}
      <rect x={W - PR - 48} y={PT + 2} width={6} height={6} fill={UP} rx={1} />
      <text x={W - PR - 40} y={PT + 9} fontSize={7.5} fill={MUTED} fontFamily="monospace">
        bullish
      </text>
      <rect x={W - PR - 48} y={PT + 12} width={6} height={6} fill={DOWN} rx={1} />
      <text x={W - PR - 40} y={PT + 19} fontSize={7.5} fill={MUTED} fontFamily="monospace">
        bearish
      </text>
    </svg>
  );
}

// ─── main component ───────────────────────────────────────────────────────────
export function OHLCVTableEditor({ value, onChange }: Props) {
  const table: OHLCVTable = useMemo(() => {
    if (value && Array.isArray(value.headers) && value.headers.length >= 3 && Array.isArray(value.rows)) {
      return value;
    }
    return { headers: DEFAULT_HEADERS, rows: [] };
  }, [value]);

  const candles = useMemo(() => parseCandles(table), [table]);

  const colCount = table.headers.length;

  const updateCell = (rowIdx: number, colIdx: number, val: string) => {
    const rows = table.rows.map((r, i) => {
      if (i !== rowIdx) return r;
      const next = [...r];
      while (next.length < colCount) next.push("");
      next[colIdx] = val;
      return next;
    });
    onChange({ ...table, rows });
  };

  const deleteRow = (rowIdx: number) => {
    onChange({ ...table, rows: table.rows.filter((_, i) => i !== rowIdx) });
  };

  const addRow = () => {
    onChange({ ...table, rows: [...table.rows, Array.from({ length: colCount }, () => "")] });
  };

  return (
    <div className="space-y-2">
      {/* Mini chart preview */}
      <CandlePreview candles={candles} />

      {/* Row count + header hint */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-400 font-mono tracking-wide">
          {table.rows.length} row{table.rows.length !== 1 ? "s" : ""} · {table.headers.join(" | ")}
        </span>
        {candles.length > 0 && (
          <span className="text-[10px] text-gray-400 font-mono">
            {candles.filter((c) => c.isUp).length}↑&nbsp;{candles.filter((c) => !c.isUp).length}↓
          </span>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
        {/* Sticky header */}
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] font-mono border-collapse" style={{ minWidth: 420 }}>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="w-6 px-1 py-2 text-center text-[10px] text-gray-400 font-normal">#</th>
                {table.headers.map((h, i) => (
                  <th
                    key={i}
                    className="px-2 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                    style={{ minWidth: i === 0 ? 72 : 56 }}
                  >
                    {h}
                  </th>
                ))}
                <th className="w-7" />
              </tr>
            </thead>
            <tbody>
              {table.rows.length === 0 && (
                <tr>
                  <td colSpan={colCount + 2} className="px-3 py-4 text-center text-xs text-gray-400 italic">
                    No rows yet — click "Add row" below.
                  </td>
                </tr>
              )}
              {table.rows.map((row, rowIdx) => {
                const o = parseNum(row[findCol(table.headers, "open") >= 0 ? findCol(table.headers, "open") : 1]);
                const c = parseNum(row[findCol(table.headers, "close") >= 0 ? findCol(table.headers, "close") : 4]);
                const isUp = c > 0 && c >= o;
                const isDown = c > 0 && c < o;
                return (
                  <tr key={rowIdx} className="border-b border-gray-100 last:border-0 group hover:bg-gray-50/60">
                    <td className="w-6 px-1 text-center text-[10px] text-gray-300 tabular-nums">
                      {rowIdx + 1}
                    </td>
                    {table.headers.map((_, colIdx) => (
                      <td key={colIdx} className="px-0 py-0">
                        <input
                          type="text"
                          value={row[colIdx] ?? ""}
                          onChange={(e) => updateCell(rowIdx, colIdx, e.target.value)}
                          className={`w-full px-2 py-1.5 text-[11px] font-mono bg-transparent border-0 focus:outline-none focus:bg-blue-50 focus:ring-0 text-gray-700 ${
                            colIdx === 0 ? "" : "text-right tabular-nums"
                          } ${
                            colIdx === (findCol(table.headers, "close") >= 0 ? findCol(table.headers, "close") : 4)
                              ? isUp
                                ? "text-blue-500"
                                : isDown
                                  ? "text-red-500"
                                  : ""
                              : ""
                          }`}
                          style={{ minWidth: 0 }}
                        />
                      </td>
                    ))}
                    <td className="w-7 px-1 text-center">
                      <button
                        type="button"
                        onClick={() => deleteRow(rowIdx)}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all p-0.5 rounded"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Add row */}
        <div className="border-t border-gray-100 bg-gray-50/40">
          <button
            type="button"
            onClick={addRow}
            className="w-full py-2 text-[11px] font-medium text-gray-400 hover:text-purple-600 transition-colors flex items-center justify-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add row
          </button>
        </div>
      </div>
    </div>
  );
}
