import { useRef, useState } from "react";

const PREVIEW_MAX_COLS = 100;
const PREVIEW_MAX_ROWS = 20;

export interface ImportPreviewProps {
  matrix: string[][];
  sheetNames?: string[];
  activeSheet?: string;
  onSheetChange?: (name: string) => void;
  maxCols: number;
  maxRows: number;
  isChartTable?: boolean;
  onApply: (result: { headers: string[]; rows: string[][] }) => void;
  onCancel: () => void;
}

export function ImportPreviewSheet({
  matrix,
  sheetNames,
  activeSheet,
  onSheetChange,
  maxCols,
  maxRows,
  isChartTable,
  onApply,
  onCancel,
}: ImportPreviewProps) {
  const [headerRowIndex, setHeaderRowIndex] = useState(0);

  const totalMatrixRows = matrix.length;
  const previewRowCount = Math.min(totalMatrixRows, PREVIEW_MAX_ROWS + 1);
  const totalCols = Math.min(matrix[0]?.length ?? 0, PREVIEW_MAX_COLS);

  const dataRowIndexes = Array.from(
    { length: Math.min(previewRowCount - headerRowIndex - 1, PREVIEW_MAX_ROWS) },
    (_, i) => headerRowIndex + 1 + i,
  );

  const [selCols, setSelCols] = useState<Set<number>>(
    () => new Set(Array.from({ length: Math.min(totalCols, maxCols) }, (_, i) => i))
  );
  const [selRows, setSelRows] = useState<Set<number>>(
    () => new Set(
      Array.from(
        { length: Math.min(dataRowIndexes.length, maxRows) },
        (_, i) => headerRowIndex + 1 + i,
      )
    )
  );

  const colDragRef = useRef<{ adding: boolean } | null>(null);
  const rowDragRef = useRef<{ adding: boolean } | null>(null);

  const colArray = Array.from({ length: totalCols }, (_, i) => i);
  const atColLimit = selCols.size >= maxCols;
  const atRowLimit = selRows.size >= maxRows;
  const selColsSorted = [...selCols].sort((a, b) => a - b);

  const toggleCol = (ci: number) =>
    setSelCols((prev) => {
      const next = new Set(prev);
      if (next.has(ci)) next.delete(ci);
      else if (next.size < maxCols) next.add(ci);
      return next;
    });

  const toggleRow = (matrixRi: number) =>
    setSelRows((prev) => {
      const next = new Set(prev);
      if (next.has(matrixRi)) next.delete(matrixRi);
      else if (next.size < maxRows) next.add(matrixRi);
      return next;
    });

  const changeHeaderRow = (newHeaderIdx: number) => {
    setHeaderRowIndex(newHeaderIdx);
    const newDataRows = Array.from(
      { length: Math.min(previewRowCount - newHeaderIdx - 1, maxRows) },
      (_, i) => newHeaderIdx + 1 + i,
    );
    setSelRows(new Set(newDataRows));
    const newTotalCols = Math.min(matrix[newHeaderIdx]?.length ?? 0, PREVIEW_MAX_COLS);
    setSelCols(new Set(Array.from({ length: Math.min(newTotalCols, maxCols) }, (_, i) => i)));
  };

  const handleApply = () => {
    const sortedRows = [...selRows].sort((a, b) => a - b);
    const headers = selColsSorted.map((ci) => String(matrix[headerRowIndex]?.[ci] ?? `Col ${ci + 1}`));
    const rows = sortedRows.map((matrixRi) => {
      const src = matrix[matrixRi] ?? [];
      return selColsSorted.map((ci) => String(src[ci] ?? ""));
    });
    onApply({ headers, rows });
  };

  const headerRow = matrix[headerRowIndex] ?? [];

  // Chart validation
  const seriesColIdxs = selColsSorted.slice(1);
  const sortedRowIdxs = [...selRows].sort((a, b) => a - b);
  const badSeriesCols = isChartTable ? seriesColIdxs.filter((ci) =>
    sortedRowIdxs.some((matrixRi) => {
      const v = matrix[matrixRi]?.[ci];
      return v !== undefined && v !== "" && isNaN(Number(v));
    })
  ) : [];
  const notEnoughNumericCols = isChartTable && seriesColIdxs.length < 1;
  const blocked = badSeriesCols.length > 0 || notEnoughNumericCols;

  return (
    <div className="flex flex-col gap-0 w-full bg-white">

      {/* ── Sheet tabs — Dashboard tab style ── */}
      {sheetNames && sheetNames.length > 1 && (
        <div className="pb-3">
          <div className="flex flex-wrap gap-1 p-1 bg-gray-100/60 rounded-xl w-full sm:w-fit">
            {sheetNames.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => onSheetChange?.(name)}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  name === activeSheet
                    ? "bg-white text-purple-600 shadow-sm"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 pb-3 flex-wrap">
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${atColLimit ? "bg-purple-50 border-purple-300 text-purple-700" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" /></svg>
          {selCols.size} / {maxCols} cols
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${atRowLimit ? "bg-purple-50 border-purple-300 text-purple-700" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
          {selRows.size} / {maxRows} rows
        </div>
        <div className="w-px h-4 bg-gray-200 mx-0.5" />
        <button type="button" onClick={() => setSelCols(new Set(colArray.slice(0, maxCols)))}
          className="text-[11px] text-purple-600 hover:text-purple-700 font-medium px-2 py-1 rounded hover:bg-purple-50 transition-colors">All cols</button>
        <button type="button" onClick={() => setSelCols(new Set())}
          className="text-[11px] text-gray-400 hover:text-gray-600 font-medium px-2 py-1 rounded hover:bg-gray-50 transition-colors">Clear cols</button>
        <div className="w-px h-4 bg-gray-200 mx-0.5" />
        <button type="button" onClick={() => setSelRows(new Set(dataRowIndexes.slice(0, maxRows)))}
          className="text-[11px] text-purple-600 hover:text-purple-700 font-medium px-2 py-1 rounded hover:bg-purple-50 transition-colors">All rows</button>
        <button type="button" onClick={() => setSelRows(new Set())}
          className="text-[11px] text-gray-400 hover:text-gray-600 font-medium px-2 py-1 rounded hover:bg-gray-50 transition-colors">Clear rows</button>
      </div>

      {/* ── Table ── */}
      <div
        className="rounded-lg border border-gray-200 overflow-auto bg-white"
        style={{ maxHeight: 360 }}
        onMouseLeave={() => { colDragRef.current = null; rowDragRef.current = null; }}
        onMouseUp={() => { colDragRef.current = null; rowDragRef.current = null; }}
      >
        <table className="border-collapse text-[11px] select-none" style={{ minWidth: "max-content" }}>
          <thead>
            <tr>
              {/* Corner — unified gutter */}
              <th className="sticky top-0 left-0 z-30 min-w-[52px] w-[52px] border-b border-r border-purple-500 bg-purple-600">
                <div className="py-1.5 px-1 flex items-center justify-center min-h-[28px]">
                  <span className="text-[8px] font-black tracking-wider uppercase leading-none text-white">HDR</span>
                </div>
              </th>
              {colArray.map((ci) => {
                const sel = selCols.has(ci);
                return (
                  <th
                    key={ci}
                    onMouseDown={(e) => { e.preventDefault(); colDragRef.current = { adding: !sel }; toggleCol(ci); }}
                    onMouseEnter={() => {
                      if (!colDragRef.current) return;
                      setSelCols((prev) => {
                        const next = new Set(prev);
                        if (colDragRef.current!.adding && next.size < maxCols) next.add(ci);
                        else if (!colDragRef.current!.adding) next.delete(ci);
                        return next;
                      });
                    }}
                    className={`sticky top-0 z-20 min-w-[96px] px-3 py-2 font-medium text-left border-b border-r cursor-pointer transition-colors ${
                      sel
                        ? "bg-purple-600 text-white border-purple-500"
                        : atColLimit
                        ? "bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed"
                        : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-purple-50 hover:text-purple-700"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {sel ? (
                        <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <div className={`w-3 h-3 rounded border flex-shrink-0 ${atColLimit ? "border-gray-200 bg-gray-100" : "border-gray-300 bg-white"}`} />
                      )}
                      <span className="truncate max-w-[80px] font-semibold">
                        {String(headerRow[ci] ?? `Col ${ci + 1}`)}
                      </span>
                    </div>
                    <div className={`text-[9px] font-normal mt-0.5 ${sel ? "text-purple-200" : "text-gray-400"}`}>col {ci + 1}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: previewRowCount }, (_, matrixRi) => {
              const isHeaderRow = matrixRi === headerRowIndex;
              if (isHeaderRow) return null; // already shown in <thead>
              const isAboveHeader = matrixRi < headerRowIndex;
              const isDataRow = matrixRi > headerRowIndex;
              const rowSel = isDataRow && selRows.has(matrixRi);

              return (
                <tr
                  key={matrixRi}
                  className={
                    isHeaderRow
                      ? "bg-white border-b border-gray-200"
                      : "bg-white"
                  }
                >
                  {/* ── Unified gutter: row-select + header-set in one cell ── */}
                  <td
                    className={`sticky left-0 z-10 w-[52px] min-w-[52px] border-r border-b font-medium text-[10px] transition-colors relative group/gutter ${
                      rowSel
                        ? "bg-purple-600 text-white border-purple-500 cursor-pointer"
                        : atRowLimit && isDataRow
                        ? "bg-gray-50 text-gray-200 border-gray-200 cursor-not-allowed"
                        : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-purple-50 hover:text-purple-600 cursor-pointer"
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (isDataRow) {
                        rowDragRef.current = { adding: !rowSel };
                        toggleRow(matrixRi);
                      }
                    }}
                    onMouseEnter={() => {
                      if (!rowDragRef.current || !isDataRow) return;
                      setSelRows((prev) => {
                        const next = new Set(prev);
                        if (rowDragRef.current!.adding && next.size < maxRows) next.add(matrixRi);
                        else if (!rowDragRef.current!.adding) next.delete(matrixRi);
                        return next;
                      });
                    }}
                  >
                    <div className="py-1.5 px-1 flex items-center justify-between gap-0.5 min-h-[28px]">
                      <div className="flex flex-col items-center justify-center flex-1">
                        {rowSel ? (
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <span>{matrixRi + 1}</span>
                        )}
                      </div>
                      {/* Bookmark — set this row as header */}
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); changeHeaderRow(matrixRi); }}
                        title="Set as header row"
                        className={`flex-shrink-0 flex items-center justify-center w-4 h-4 rounded transition-colors ${
                          rowSel
                            ? "text-purple-200 hover:text-white"
                            : "text-gray-200 hover:text-purple-500 opacity-0 group-hover/gutter:opacity-100"
                        }`}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                        </svg>
                      </button>
                    </div>
                  </td>

                  {/* Data cells */}
                  {colArray.map((ci) => {
                    const colSel = selCols.has(ci);
                    const both = rowSel && colSel;
                    return (
                      <td
                        key={ci}
                        className={`px-3 py-1.5 border-b border-r border-gray-100 truncate max-w-[120px] transition-colors ${
                          isHeaderRow
                            ? "font-bold text-gray-900 bg-white"
                            : isAboveHeader
                            ? "text-gray-300 bg-white"
                            : both
                            ? "text-gray-900 font-medium bg-white"
                            : colSel
                            ? "text-gray-600 bg-white"
                            : rowSel
                            ? "text-gray-500 bg-white"
                            : "text-gray-400 bg-white"
                        }`}
                        title={String(matrix[matrixRi]?.[ci] ?? "")}
                      >
                        {String(matrix[matrixRi]?.[ci] ?? "")}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Hint ── */}
      <p className="text-[11px] text-gray-400 pt-2">
        Click <strong>row numbers</strong> to select/deselect · hover a row and click the bookmark icon to set it as the <strong>header row</strong> · click <strong>column names</strong> to include/exclude.
      </p>

      {/* ── Chart validation error ── */}
      {isChartTable && blocked && (
        <div className="mt-2 px-3 py-2 rounded-md border border-red-200 bg-red-50 text-[11px] text-red-700 flex items-start gap-2">
          <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <span>
            {notEnoughNumericCols
              ? "Select at least 2 columns — column 1 as the X-axis label, plus 1 or more numeric series columns."
              : (<>
                  <span className="font-semibold">Non-numeric data in series columns: </span>
                  {badSeriesCols.map((ci) => (
                    <span key={ci} className="font-mono bg-red-100 rounded px-1 mr-1">{String(headerRow[ci] ?? `Col ${ci + 1}`)}</span>
                  ))}
                  — columns 2+ must contain numbers so bars/lines can be drawn. Deselect these or choose different columns.
                </>)
            }
          </span>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="flex items-center gap-3 pt-3 flex-wrap">
        {selCols.size > 0 && selRows.size > 0 ? (
          <p className="text-[11px] text-gray-500 flex-1 min-w-0 truncate">
            Importing: <span className="font-medium text-purple-700">
              {selColsSorted.map((ci) => String(headerRow[ci] ?? `Col ${ci + 1}`)).join(", ")}
            </span>
            <span className="text-gray-400"> · {selRows.size} row{selRows.size !== 1 ? "s" : ""}</span>
          </p>
        ) : (
          <p className="text-[11px] text-gray-400 flex-1">Select at least one column and one row to import.</p>
        )}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button type="button" onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            type="button"
            disabled={selCols.size === 0 || selRows.size === 0 || blocked}
            onClick={handleApply}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Import {selRows.size > 0 && selCols.size > 0 ? `${selRows.size} × ${selCols.size}` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
