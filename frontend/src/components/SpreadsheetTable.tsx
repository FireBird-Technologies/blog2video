import { useRef, useState, useEffect } from "react";

export interface SheetData {
  headers: string[];
  rows: string[][];
}

interface Cell { r: number; c: number; }
interface Sel  { r0: number; c0: number; r1: number; c1: number; }

interface Props {
  data: SheetData;
  onChange: (next: SheetData) => void;
  maxRows: number;
  maxCols: number;
  onBulkPaste?: (startRow: number, startCol: number, text: string) => void;
  onHeaderPaste?: (startCol: number, text: string) => void;
}

function norm(a: Cell, b: Cell): Sel {
  return { r0: Math.min(a.r, b.r), r1: Math.max(a.r, b.r), c0: Math.min(a.c, b.c), c1: Math.max(a.c, b.c) };
}
function inSel(r: number, c: number, s: Sel) {
  return r >= s.r0 && r <= s.r1 && c >= s.c0 && c <= s.c1;
}
function parseTSV(text: string): string[][] {
  // handles TSV, CSV, markdown pipe tables
  const stripped = text.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
  if (!stripped) return [];
  const lines = stripped.split("\n");
  const hasTabs = stripped.includes("\t");
  if (hasTabs) return lines.map((l) => l.split("\t"));
  // CSV with quoted-field support
  return lines.map((line) =>
    (line.match(/("([^"]|"")*"|[^,]*)(,|$)/g) ?? [])
      .filter((_, i, a) => i < a.length - 1 || a[i] !== "")
      .map((tok) => tok.replace(/,$/, "").trim().replace(/^"(.*)"$/, "$1").replace(/""/g, '"'))
  );
}

export function SpreadsheetTable({ data, onChange, maxRows, maxCols, onBulkPaste, onHeaderPaste }: Props) {
  const colCount = data.headers.length;

  // ── selection (anchor + focus define rectangle) ───────────────────────────
  const [anchor, setAnchor] = useState<Cell | null>(null);
  const [focus,  setFocus]  = useState<Cell | null>(null);
  const sel: Sel | null = anchor && focus ? norm(anchor, focus) : null;

  // ── edit mode ─────────────────────────────────────────────────────────────
  const [editCell, setEditCell] = useState<Cell | null>(null);

  // ── copy marching-ants source ─────────────────────────────────────────────
  const [copySel, setCopySel] = useState<Sel | null>(null);

  // ── mouse-drag state ──────────────────────────────────────────────────────
  const cellDragging  = useRef(false);
  const gutterDragging = useRef(false);

  // ── row reorder drag ──────────────────────────────────────────────────────
  const reorderDrag = useRef<number | null>(null);
  const [reorderOver, setReorderOver] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRefs    = useRef<Map<string, HTMLInputElement>>(new Map());
  const key = (r: number, c: number) => `${r}:${c}`;

  // ── helpers ───────────────────────────────────────────────────────────────
  const clampR = (r: number) => Math.max(0, Math.min(data.rows.length - 1, r));
  const clampC = (c: number) => Math.max(0, Math.min(colCount - 1, c));

  const setCell = (r: number, c: number, val: string) => {
    const rows = data.rows.map((row, ri) => {
      if (ri !== r) return row;
      const next = [...row];
      while (next.length < colCount) next.push("");
      next[c] = val;
      return next;
    });
    onChange({ ...data, rows });
  };

  const focus2input = (r: number, c: number) =>
    setTimeout(() => { const el = inputRefs.current.get(key(r, c)); el?.focus(); el?.select(); }, 0);

  // ── global mouseup (end drags) ────────────────────────────────────────────
  useEffect(() => {
    const up = () => { cellDragging.current = false; gutterDragging.current = false; };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  // ── click outside → deselect ──────────────────────────────────────────────
  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setAnchor(null); setFocus(null); setEditCell(null); setCopySel(null);
      }
    };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, []);

  // ── keyboard handler ──────────────────────────────────────────────────────
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (editCell) return; // let the input handle keys while editing
    const mod = e.ctrlKey || e.metaKey;

    // ── Ctrl+C / Cmd+C  → copy selected cells to clipboard as TSV ────────
    if (mod && e.key === "c" && sel) {
      e.preventDefault();
      const lines: string[] = [];
      for (let r = sel.r0; r <= sel.r1; r++) {
        const cells: string[] = [];
        for (let c = sel.c0; c <= sel.c1; c++) cells.push(data.rows[r]?.[c] ?? "");
        lines.push(cells.join("\t"));
      }
      navigator.clipboard.writeText(lines.join("\n")).catch(() => {});
      setCopySel({ ...sel });
      return;
    }

    // ── Ctrl+V / Cmd+V  → paste from clipboard ────────────────────────────
    if (mod && e.key === "v" && anchor) {
      // Let the onPaste event handle it (browser fires it after keydown)
      return;
    }

    // ── Ctrl+A → select all ───────────────────────────────────────────────
    if (mod && e.key === "a") {
      e.preventDefault();
      setAnchor({ r: 0, c: 0 });
      setFocus({ r: data.rows.length - 1, c: colCount - 1 });
      return;
    }

    if (!sel && !anchor) return;

    // ── Delete / Backspace ────────────────────────────────────────────────
    if ((e.key === "Delete" || e.key === "Backspace") && sel) {
      e.preventDefault();
      const isFullRows = sel.c0 === 0 && sel.c1 === colCount - 1;
      if (isFullRows) {
        const rows = data.rows.filter((_, i) => i < sel.r0 || i > sel.r1);
        onChange({ ...data, rows: rows.length ? rows : [Array(colCount).fill("")] });
        setAnchor(null); setFocus(null);
      } else {
        const rows = data.rows.map((row, ri) => {
          if (ri < sel.r0 || ri > sel.r1) return row;
          return row.map((v, ci) => inSel(ri, ci, sel) ? "" : v);
        });
        onChange({ ...data, rows });
      }
      setCopySel(null);
      return;
    }

    // ── Escape ────────────────────────────────────────────────────────────
    if (e.key === "Escape") { setCopySel(null); return; }

    // ── Arrow keys ────────────────────────────────────────────────────────
    if (!anchor) return;
    const arrowMap: Record<string, Cell> = {
      ArrowUp:    { r: clampR(anchor.r - 1), c: anchor.c },
      ArrowDown:  { r: clampR(anchor.r + 1), c: anchor.c },
      ArrowLeft:  { r: anchor.r, c: clampC(anchor.c - 1) },
      ArrowRight: { r: anchor.r, c: clampC(anchor.c + 1) },
    };
    if (arrowMap[e.key]) {
      e.preventDefault();
      const next = arrowMap[e.key];
      if (e.shiftKey) { setFocus(next); }
      else            { setAnchor(next); setFocus(next); }
      return;
    }

    // ── Tab ───────────────────────────────────────────────────────────────
    if (e.key === "Tab") {
      e.preventDefault();
      const next: Cell = e.shiftKey
        ? { r: anchor.r, c: clampC(anchor.c - 1) }
        : { r: anchor.r, c: clampC(anchor.c + 1) };
      setAnchor(next); setFocus(next);
      return;
    }

    // ── Enter → edit ──────────────────────────────────────────────────────
    if (e.key === "Enter") {
      setEditCell(anchor);
      focus2input(anchor.r, anchor.c);
      return;
    }

    // ── Printable key → start typing (replaces cell content) ─────────────
    if (e.key.length === 1 && !mod) {
      setCell(anchor.r, anchor.c, e.key);
      setEditCell(anchor);
      setTimeout(() => {
        const el = inputRefs.current.get(key(anchor.r, anchor.c));
        if (el) { el.focus(); el.setSelectionRange(1, 1); }
      }, 0);
    }
  };

  // ── paste event (Ctrl+V fires this) ──────────────────────────────────────
  const onPaste = (e: React.ClipboardEvent) => {
    if (editCell) return;
    if (!anchor) return;
    e.preventDefault();
    const text = e.clipboardData.getData("text");
    if (!text) return;
    const matrix = parseTSV(text);
    if (matrix.length === 0) return;
    if (matrix.length === 1 && matrix[0].length === 1 && !text.includes("\t") && !text.includes("\n")) {
      // single cell paste
      setCell(anchor.r, anchor.c, text.trim());
      return;
    }
    // multi-cell: either use the parent handler or do it inline
    if (onBulkPaste) { onBulkPaste(anchor.r, anchor.c, text); return; }
    // inline fallback
    const rows = data.rows.map((row, ri) => [...row]);
    while (rows.length < colCount) rows.push(Array(colCount).fill(""));
    for (let dr = 0; dr < matrix.length; dr++) {
      const tr = anchor.r + dr;
      if (tr >= maxRows) break;
      while (rows.length <= tr) rows.push(Array(colCount).fill(""));
      for (let dc = 0; dc < matrix[dr].length; dc++) {
        const tc = anchor.c + dc;
        if (tc >= colCount) break;
        while (rows[tr].length <= tc) rows[tr].push("");
        rows[tr][tc] = matrix[dr][dc];
      }
    }
    onChange({ ...data, rows: rows.slice(0, maxRows) });
  };

  // ── cell mouse events ─────────────────────────────────────────────────────
  const onCellMouseDown = (r: number, c: number, e: React.MouseEvent) => {
    if (editCell?.r === r && editCell?.c === c) return; // already editing
    e.preventDefault();
    setEditCell(null);
    cellDragging.current = true;
    if (e.shiftKey && anchor) {
      setFocus({ r, c });
    } else {
      setAnchor({ r, c }); setFocus({ r, c });
    }
    containerRef.current?.focus();
  };
  const onCellEnter = (r: number, c: number) => {
    if (cellDragging.current) setFocus({ r, c });
  };
  const onCellDblClick = (r: number, c: number) => {
    setEditCell({ r, c });
    focus2input(r, c);
  };

  // ── gutter (row number) mouse events ─────────────────────────────────────
  const onGutterMouseDown = (ri: number, e: React.MouseEvent) => {
    e.preventDefault();
    setEditCell(null);
    gutterDragging.current = true;
    if (e.shiftKey && anchor) {
      setAnchor({ r: anchor.r, c: 0 });
      setFocus({ r: ri, c: colCount - 1 });
    } else {
      setAnchor({ r: ri, c: 0 });
      setFocus({ r: ri, c: colCount - 1 });
    }
    setTimeout(() => containerRef.current?.focus(), 0);
  };
  const onGutterEnter = (ri: number) => {
    if (!gutterDragging.current) return;
    setAnchor(a => a ? { r: a.r, c: 0 } : { r: ri, c: 0 });
    setFocus({ r: ri, c: colCount - 1 });
  };

  // ── row reorder ───────────────────────────────────────────────────────────
  const onReorderDragStart = (ri: number) => { reorderDrag.current = ri; };
  const onReorderDragEnd   = () => {
    if (reorderDrag.current !== null && reorderOver !== null && reorderDrag.current !== reorderOver) {
      const rows = [...data.rows];
      const [moved] = rows.splice(reorderDrag.current, 1);
      rows.splice(reorderOver, 0, moved);
      onChange({ ...data, rows });
      setAnchor(null); setFocus(null);
    }
    reorderDrag.current = null; setReorderOver(null);
  };

  // ── derived flags ─────────────────────────────────────────────────────────
  const isFullRowSel = sel ? sel.c0 === 0 && sel.c1 === colCount - 1 : false;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="outline-none"
      style={{ userSelect: "none" }}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
    >

      {/* ── action bar ─────────────────────────────────────────────────── */}
      <div className="mb-1.5 flex items-center gap-2 min-h-[22px] px-0.5">
        {sel ? (
          <>
            <span className="text-[10px] text-purple-600 font-medium">
              {sel.r1 - sel.r0 + 1} × {sel.c1 - sel.c0 + 1} selected
            </span>
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={async () => {
                const lines: string[] = [];
                for (let r = sel.r0; r <= sel.r1; r++) {
                  const cells: string[] = [];
                  for (let c = sel.c0; c <= sel.c1; c++) cells.push(data.rows[r]?.[c] ?? "");
                  lines.push(cells.join("\t"));
                }
                await navigator.clipboard.writeText(lines.join("\n")).catch(() => {});
                setCopySel({ ...sel });
              }}
              className="text-[10px] px-2 py-0.5 rounded border border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100 font-medium"
            >
              Copy
            </button>
            {isFullRowSel ? (
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => {
                  const rows = data.rows.filter((_, i) => i < sel.r0 || i > sel.r1);
                  onChange({ ...data, rows: rows.length ? rows : [Array(colCount).fill("")] });
                  setAnchor(null); setFocus(null);
                }}
                className="text-[10px] px-2 py-0.5 rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 font-medium"
              >
                Delete {sel.r1 - sel.r0 + 1} row{sel.r1 - sel.r0 + 1 > 1 ? "s" : ""}
              </button>
            ) : (
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => {
                  const rows = data.rows.map((row, ri) =>
                    ri < sel.r0 || ri > sel.r1 ? row : row.map((v, ci) => inSel(ri, ci, sel) ? "" : v)
                  );
                  onChange({ ...data, rows });
                }}
                className="text-[10px] px-2 py-0.5 rounded border border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100 font-medium"
              >
                Clear
              </button>
            )}
            {copySel && (
              <span className="text-[10px] text-purple-600 font-medium ml-1">✓ Copied — Ctrl+V to paste</span>
            )}
          </>
        ) : (
          <span className="text-[10px] text-gray-400">Click a cell · drag to select · Ctrl+C to copy · Ctrl+V to paste</span>
        )}
      </div>

      {/* ── table ──────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 overflow-auto bg-white">
        <table
          className="border-collapse text-[11px] select-none"
          style={{ minWidth: colCount * 110, width: "100%" }}
          onMouseLeave={() => { cellDragging.current = false; }}
        >
          <thead>
            <tr>
              {/* corner */}
              <th className="sticky top-0 left-0 z-30 w-8 min-w-[32px] bg-purple-600 border-b border-r border-purple-500" />
              {/* drag handle col */}
              <th className="sticky top-0 z-20 w-5 min-w-[20px] bg-purple-600 border-b border-r border-purple-500" />
              {data.headers.map((h, ci) => (
                <th key={ci} className="sticky top-0 z-20 bg-purple-600 border-b border-r border-purple-500 p-0 min-w-[96px]">
                  <div className="px-3 py-2 text-left">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3 h-3 flex-shrink-0 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <input
                        type="text"
                        value={h}
                        placeholder={`Col ${ci + 1}`}
                        onChange={(e) => { const hs = [...data.headers]; hs[ci] = e.target.value; onChange({ ...data, headers: hs }); }}
                        onPaste={(e) => {
                          const text = e.clipboardData.getData("text");
                          if ((text.includes("\t") || text.includes("\n")) && onHeaderPaste) {
                            e.preventDefault(); onHeaderPaste(ci, text);
                          }
                        }}
                        onFocus={() => { setAnchor(null); setFocus(null); setEditCell(null); }}
                        className="flex-1 text-[11px] font-semibold text-white bg-transparent placeholder-purple-300 focus:outline-none min-w-0"
                      />
                    </div>
                    <div className="text-[9px] font-normal text-purple-200 mt-0.5">col {ci + 1}</div>
                  </div>
                </th>
              ))}
              <th className="sticky top-0 z-20 w-7 bg-purple-600 border-b border-purple-500" />
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, ri) => {
              const rowFullySel  = sel ? inSel(ri, 0, sel) && sel.c0 === 0 && sel.c1 === colCount - 1 : false;
              const isDragTarget = reorderOver === ri && reorderDrag.current !== ri;
              return (
                <tr key={ri} className={`group ${isDragTarget ? "border-t-2 border-purple-600" : ""}`}>

                  {/* ── row-number gutter — always purple-600 with checkmark, matches screenshot ── */}
                  <td
                    className={`w-8 border-b border-r text-center text-[10px] font-medium cursor-pointer select-none sticky left-0 z-10 transition-colors
                      ${rowFullySel ? "bg-purple-700 text-white border-purple-500" : "bg-purple-600 text-white border-purple-500 hover:bg-purple-700"}`}
                    onMouseDown={(e) => onGutterMouseDown(ri, e)}
                    onMouseEnter={() => onGutterEnter(ri)}
                  >
                    <svg className="w-3 h-3 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </td>

                  {/* ── drag-reorder handle ── */}
                  <td
                    className="w-5 border-b border-r border-gray-100 bg-white cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity text-center"
                    draggable
                    onDragStart={() => onReorderDragStart(ri)}
                    onDragEnter={() => setReorderOver(ri)}
                    onDragOver={(e) => e.preventDefault()}
                    onDragEnd={onReorderDragEnd}
                  >
                    <svg className="w-3 h-3 text-gray-400 mx-auto pointer-events-none" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 6a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm8-16a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4z" />
                    </svg>
                  </td>

                  {/* ── data cells ── */}
                  {data.headers.map((_, ci) => {
                    const isSel      = sel ? inSel(ri, ci, sel) : false;
                    const isAnch     = anchor?.r === ri && anchor?.c === ci;
                    const isEdit     = editCell?.r === ri && editCell?.c === ci;
                    const isCopied   = copySel ? inSel(ri, ci, copySel) : false;
                    const topEdge    = sel && ri === sel.r0 && ci >= sel.c0 && ci <= sel.c1;
                    const leftEdge   = sel && ci === sel.c0 && ri >= sel.r0 && ri <= sel.r1;
                    const rightEdge  = sel && ci === sel.c1 && ri >= sel.r0 && ri <= sel.r1;
                    const bottomEdge = sel && ri === sel.r1 && ci >= sel.c0 && ci <= sel.c1;

                    return (
                      <td
                        key={ci}
                        className={`relative border-b border-r border-gray-100 p-0
                          ${isEdit ? "bg-white" : isCopied ? "bg-green-50" : isSel ? "bg-blue-50" : "bg-white"}
                          ${isAnch && !isEdit ? "ring-2 ring-inset ring-blue-400" : ""}
                        `}
                        style={{
                          borderTop:    topEdge    ? "2px solid #60a5fa" : undefined,
                          borderLeft:   leftEdge   ? "2px solid #60a5fa" : undefined,
                          borderRight:  rightEdge  ? "2px solid #60a5fa" : undefined,
                          borderBottom: bottomEdge ? "2px solid #60a5fa" : undefined,
                          outline: isCopied && !isEdit ? "1px dashed #16a34a" : undefined,
                          outlineOffset: "-1px",
                        }}
                        onMouseDown={(e) => onCellMouseDown(ri, ci, e)}
                        onMouseEnter={() => onCellEnter(ri, ci)}
                        onDoubleClick={() => onCellDblClick(ri, ci)}
                      >
                        {isEdit ? (
                          <input
                            ref={(el) => { if (el) inputRefs.current.set(key(ri, ci), el); else inputRefs.current.delete(key(ri, ci)); }}
                            type="text"
                            value={row[ci] ?? ""}
                            onChange={(e) => setCell(ri, ci, e.target.value)}
                            onBlur={() => { setEditCell(null); containerRef.current?.focus(); }}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") { e.stopPropagation(); setEditCell(null); setTimeout(() => containerRef.current?.focus(), 0); }
                              if (e.key === "Enter")  { e.preventDefault(); setEditCell(null); const nr = clampR(ri + 1); setAnchor({ r: nr, c: ci }); setFocus({ r: nr, c: ci }); setTimeout(() => containerRef.current?.focus(), 0); }
                              if (e.key === "Tab")    { e.preventDefault(); setEditCell(null); const nc = clampC(ci + (e.shiftKey ? -1 : 1)); setAnchor({ r: ri, c: nc }); setFocus({ r: ri, c: nc }); setTimeout(() => containerRef.current?.focus(), 0); }
                            }}
                            onPaste={(e) => {
                              const text = e.clipboardData.getData("text");
                              if ((text.includes("\t") || text.includes("\n")) && onBulkPaste) {
                                e.preventDefault(); onBulkPaste(ri, ci, text);
                              }
                            }}
                            className={`w-full px-3 py-1.5 text-[11px] text-gray-800 bg-white focus:outline-none border-0 ${ci === 0 ? "" : "text-right tabular-nums"}`}
                            style={{ minWidth: 80 }}
                            autoFocus
                          />
                        ) : (
                          <div
                            className={`px-3 py-1.5 text-[11px] min-h-[32px] truncate ${isSel ? "text-gray-900 font-medium" : "text-gray-700"} ${ci === 0 ? "" : "text-right tabular-nums"}`}
                            style={{ minWidth: 80 }}
                          >
                            {row[ci] ?? ""}
                          </div>
                        )}
                      </td>
                    );
                  })}

                  {/* ── row ✕ ── */}
                  <td className="w-7 border-b border-gray-100 bg-white text-center">
                    <button
                      type="button"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => {
                        const rows = data.rows.filter((_, i) => i !== ri);
                        onChange({ ...data, rows: rows.length ? rows : [Array(colCount).fill("")] });
                        setAnchor(null); setFocus(null);
                      }}
                      className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-gray-300 hover:text-red-400 hover:bg-red-50 mx-auto transition-all"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}

            {/* ── add row ── */}
            {data.rows.length < maxRows && (
              <tr>
                <td colSpan={colCount + 3} className="border-t border-gray-100">
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => onChange({ ...data, rows: [...data.rows, Array(colCount).fill("")] })}
                    className="w-full py-1.5 text-[11px] text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors text-center"
                  >
                    + Add row
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
