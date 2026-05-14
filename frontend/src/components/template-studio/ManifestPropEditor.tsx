import { useState } from "react";
import ReactDOM from "react-dom";
import type { LayoutPropField, LayoutPropSchema } from "../../api/client";

interface ManifestPropEditorProps {
  schema?: LayoutPropSchema;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

function asString(input: unknown): string {
  if (input == null) return "";
  return String(input);
}

function asNumber(input: unknown, fallback = 0): number {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asAspectObject(input: unknown, fallback: { portrait: number; landscape: number }) {
  if (!input || typeof input !== "object") return fallback;
  const value = input as Record<string, unknown>;
  return {
    portrait: asNumber(value.portrait, fallback.portrait),
    landscape: asNumber(value.landscape, fallback.landscape),
  };
}

function asChartTable(input: unknown): { headers: string[]; rows: string[][] } {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const tbl = input as Record<string, unknown>;
    const headers = Array.isArray(tbl.headers) ? (tbl.headers as unknown[]).map((h) => asString(h)) : ["Label", "Value"];
    const rows = Array.isArray(tbl.rows)
      ? (tbl.rows as unknown[]).map((r) =>
          Array.isArray(r) ? (r as unknown[]).map((c) => asString(c)) : [asString(r), ""]
        )
      : [["", ""]];
    return { headers, rows };
  }
  return { headers: ["Label", "Value"], rows: [["", ""]] };
}

function asStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((item) => asString(item));
}

function asObjectArray(input: unknown): Record<string, string>[] {
  if (!Array.isArray(input)) return [];
  return input.map((item) => {
    if (!item || typeof item !== "object") return {};
    return Object.entries(item as Record<string, unknown>).reduce<Record<string, string>>((acc, [k, v]) => {
      acc[k] = asString(v);
      return acc;
    }, {});
  });
}

function updateKey(
  current: Record<string, unknown>,
  key: string,
  nextValue: unknown,
  onChange: (next: Record<string, unknown>) => void
) {
  onChange({ ...current, [key]: nextValue });
}

function FieldHeader({ label }: { label: string }) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
      {label}
    </label>
  );
}

const TICKER_MAX_COLS = 6;
const TICKER_MAX_ROWS = 20;

function parseTickerTable(raw: unknown): { headers: string[]; rows: string[][] } {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const t = raw as Record<string, unknown>;
    const headers = Array.isArray(t.headers)
      ? (t.headers as unknown[]).map(asString).slice(0, TICKER_MAX_COLS)
      : ["Label", "Value"];
    const rows = Array.isArray(t.rows)
      ? (t.rows as unknown[]).map((r) =>
          Array.isArray(r)
            ? (r as unknown[]).slice(0, TICKER_MAX_COLS).map(asString)
            : [""]
        ).slice(0, TICKER_MAX_ROWS)
      : [[""]];
    return { headers, rows };
  }
  return { headers: ["Label", "Value"], rows: [[""]] };
}

function TickerTableFieldEditor({
  field,
  current,
  onChange,
}: {
  field: LayoutPropField;
  current: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const saved = parseTickerTable(current[field.key]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ headers: string[]; rows: string[][] }>(saved);

  const openModal = () => {
    setDraft(parseTickerTable(current[field.key]));
    setOpen(true);
  };
  const save = () => {
    updateKey(current, field.key, draft, onChange);
    setOpen(false);
  };
  const cancel = () => setOpen(false);

  const setHeaders = (headers: string[]) => setDraft((d) => ({ ...d, headers }));
  const setRows = (rows: string[][]) => setDraft((d) => ({ ...d, rows }));

  const addCol = () => {
    if (draft.headers.length >= TICKER_MAX_COLS) return;
    setDraft({
      headers: [...draft.headers, `Col ${draft.headers.length + 1}`],
      rows: draft.rows.map((r) => [...r, ""]),
    });
  };
  const removeCol = (ci: number) => {
    if (draft.headers.length <= 1) return;
    setDraft({
      headers: draft.headers.filter((_, i) => i !== ci),
      rows: draft.rows.map((r) => r.filter((_, i) => i !== ci)),
    });
  };
  const addRow = () => {
    if (draft.rows.length >= TICKER_MAX_ROWS) return;
    setRows([...draft.rows, Array(draft.headers.length).fill("")]);
  };
  const removeRow = (ri: number) => setRows(draft.rows.filter((_, i) => i !== ri));
  const updateCell = (ri: number, ci: number, val: string) => {
    const next = draft.rows.map((r) => [...r]);
    next[ri][ci] = val;
    setRows(next);
  };
  const updateHeader = (ci: number, val: string) => {
    const next = [...draft.headers];
    next[ci] = val;
    setHeaders(next);
  };

  const rowCount = saved.rows.length;
  const colCount = saved.headers.length;

  const modal = open ? ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={cancel} />
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl flex flex-col" style={{ maxHeight: "88vh" }}>

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Edit ticker table</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Editable headers · max {TICKER_MAX_ROWS} rows · max {TICKER_MAX_COLS} cols</p>
          </div>
          <button type="button" onClick={cancel} className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Table area */}
        <div className="overflow-auto flex-1 p-4">
          <table className="w-full border-separate border-spacing-1 text-xs">
            <thead>
              <tr>
                {draft.headers.map((h, ci) => (
                  <th key={ci} className="align-bottom pb-1">
                    <input
                      type="text"
                      value={h}
                      placeholder={`Col ${ci + 1}`}
                      onChange={(e) => updateHeader(ci, e.target.value)}
                      className="w-full px-2 py-1.5 text-[11px] font-semibold text-gray-700 border border-gray-300 rounded-md bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-400 text-center"
                    />
                  </th>
                ))}
                {/* spacer for row-delete col */}
                <th className="w-6" />
              </tr>
            </thead>
            <tbody>
              {draft.rows.map((row, ri) => (
                <tr key={ri}>
                  {draft.headers.map((_, ci) => (
                    <td key={ci}>
                      <input
                        type="text"
                        value={row[ci] ?? ""}
                        onChange={(e) => updateCell(ri, ci, e.target.value)}
                        className="w-full px-2 py-1.5 text-xs text-gray-700 border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                      />
                    </td>
                  ))}
                  <td className="text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(ri)}
                      title="Remove row"
                      className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-400 hover:bg-red-50"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Row / Col controls + footer */}
        <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2 flex-shrink-0">
          {/* Row controls */}
          <button
            type="button"
            onClick={addRow}
            disabled={draft.rows.length >= TICKER_MAX_ROWS}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 hover:border-green-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Row
          </button>
          <button
            type="button"
            onClick={() => draft.rows.length > 1 && removeRow(draft.rows.length - 1)}
            disabled={draft.rows.length <= 1}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 hover:border-red-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>
            Row
          </button>

          <div className="w-px h-5 bg-gray-200 mx-1" />

          {/* Col controls */}
          <button
            type="button"
            onClick={addCol}
            disabled={draft.headers.length >= TICKER_MAX_COLS}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 hover:border-green-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Col
          </button>
          <button
            type="button"
            onClick={() => removeCol(draft.headers.length - 1)}
            disabled={draft.headers.length <= 1}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 hover:border-red-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>
            Col
          </button>

          <div className="flex-1" />

          <button type="button" onClick={cancel} className="px-4 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button type="button" onClick={save} className="px-4 py-1.5 text-sm font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700">
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="mb-3">
      <FieldHeader label={field.label} />
      <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2">
        <span className="text-xs text-gray-500 flex-1">
          {rowCount} row{rowCount !== 1 ? "s" : ""} × {colCount} col{colCount !== 1 ? "s" : ""}
        </span>
        <button
          type="button"
          onClick={openModal}
          className="px-3 py-1 text-[11px] font-medium rounded border border-gray-200 text-gray-600 hover:text-purple-600 hover:border-purple-400 bg-white"
        >
          Edit table
        </button>
      </div>
      {modal}
    </div>
  );
}

function renderField(
  field: LayoutPropField,
  current: Record<string, unknown>,
  onChange: (next: Record<string, unknown>) => void
) {
  const inputClass =
    "w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500";
  const textareaClass =
    "w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y";

  if (field.type === "string") {
    return (
      <div key={field.key} className="mb-3">
        <FieldHeader label={field.label} />
        <input
          className={inputClass}
          type="text"
          placeholder={field.placeholder}
          value={asString(current[field.key])}
          onChange={(e) => updateKey(current, field.key, e.target.value, onChange)}
        />
      </div>
    );
  }

  if (field.type === "text") {
    return (
      <div key={field.key} className="mb-3">
        <FieldHeader label={field.label} />
        <textarea
          className={textareaClass}
          rows={3}
          placeholder={field.placeholder}
          value={asString(current[field.key])}
          onChange={(e) => updateKey(current, field.key, e.target.value, onChange)}
        />
      </div>
    );
  }

  if (field.type === "number") {
    if (field.responsive) {
      const min = field.min ?? 0;
      const max = field.max ?? 200;
      const step = field.step ?? 1;
      const currentValue = asAspectObject(current[field.key], {
        portrait: min,
        landscape: min,
      });
      return (
        <div key={field.key} className="mb-3">
          <FieldHeader label={field.label} />
          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-600">Portrait</label>
                <span className="text-xs text-purple-700 font-medium">{currentValue.portrait}</span>
              </div>
              <input
                className="w-full"
                type="range"
                min={min}
                max={max}
                step={step}
                value={currentValue.portrait}
                onChange={(e) =>
                  updateKey(
                    current,
                    field.key,
                    { ...currentValue, portrait: Number(e.target.value) },
                    onChange
                  )
                }
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-600">Landscape</label>
                <span className="text-xs text-purple-700 font-medium">{currentValue.landscape}</span>
              </div>
              <input
                className="w-full"
                type="range"
                min={min}
                max={max}
                step={step}
                value={currentValue.landscape}
                onChange={(e) =>
                  updateKey(
                    current,
                    field.key,
                    { ...currentValue, landscape: Number(e.target.value) },
                    onChange
                  )
                }
              />
            </div>
          </div>
        </div>
      );
    }

    const raw = current[field.key];
    const value = asNumber(raw, field.min ?? 0);
    return (
      <div key={field.key} className="mb-3">
        <div className="flex items-center justify-between">
          <FieldHeader label={field.label} />
          <span className="text-xs text-purple-700 font-medium">{value}</span>
        </div>
        <input
          className="w-full"
          type="range"
          min={field.min ?? 0}
          max={field.max ?? 200}
          step={field.step ?? 1}
          value={value}
          onChange={(e) => updateKey(current, field.key, Number(e.target.value), onChange)}
        />
      </div>
    );
  }

  if (field.type === "color") {
    const value = asString(current[field.key]) || "#000000";
    return (
      <div key={field.key} className="mb-3">
        <FieldHeader label={field.label} />
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value}
            onChange={(e) => updateKey(current, field.key, e.target.value, onChange)}
            className="h-10 w-12 border border-gray-300 rounded"
          />
          <input
            className={inputClass}
            type="text"
            value={value}
            onChange={(e) => updateKey(current, field.key, e.target.value, onChange)}
          />
        </div>
      </div>
    );
  }

  if (field.type === "select") {
    const options = field.options ?? [];
    return (
      <div key={field.key} className="mb-3">
        <FieldHeader label={field.label} />
        <select
          className={inputClass}
          value={asString(current[field.key])}
          onChange={(e) => updateKey(current, field.key, e.target.value, onChange)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === "string_array") {
    const items = asStringArray(current[field.key]);
    return (
      <div key={field.key} className="mb-3">
        <FieldHeader label={field.label} />
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={`${field.key}-${index}`} className="flex items-center gap-2">
              <input
                className={inputClass}
                type="text"
                value={item}
                onChange={(e) => {
                  const next = [...items];
                  next[index] = e.target.value;
                  updateKey(current, field.key, next, onChange);
                }}
              />
              <button
                type="button"
                className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-100"
                onClick={() => {
                  const next = items.filter((_, idx) => idx !== index);
                  updateKey(current, field.key, next, onChange);
                }}
              >
                Remove
              </button>
            </div>
          ))}
          {(!field.maxItems || items.length < field.maxItems) && (
            <button
              type="button"
              className="px-3 py-1.5 text-xs rounded border border-gray-300 hover:bg-gray-100"
              onClick={() => updateKey(current, field.key, [...items, ""], onChange)}
            >
              Add item
            </button>
          )}
        </div>
      </div>
    );
  }

  if (field.type === "object_array") {
    const items = asObjectArray(current[field.key]);
    const subFields = field.subFields ?? [];
    return (
      <div key={field.key} className="mb-3">
        <FieldHeader label={field.label} />
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={`${field.key}-${index}`} className="border border-gray-200 rounded-md p-2 space-y-2 bg-gray-50">
              {subFields.map((subField) => (
                <div key={`${field.key}-${index}-${subField.key}`}>
                  <label className="block text-[11px] uppercase tracking-wider text-gray-500 mb-1">{subField.label}</label>
                  <input
                    className={inputClass}
                    type="text"
                    placeholder={subField.placeholder}
                    value={item[subField.key] ?? ""}
                    onChange={(e) => {
                      const next = [...items];
                      next[index] = { ...next[index], [subField.key]: e.target.value };
                      updateKey(current, field.key, next, onChange);
                    }}
                  />
                </div>
              ))}
              <button
                type="button"
                className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-100"
                onClick={() => {
                  const next = items.filter((_, idx) => idx !== index);
                  updateKey(current, field.key, next, onChange);
                }}
              >
                Remove row
              </button>
            </div>
          ))}
          {(!field.maxItems || items.length < field.maxItems) && (
            <button
              type="button"
              className="px-3 py-1.5 text-xs rounded border border-gray-300 hover:bg-gray-100"
              onClick={() => {
                const emptyRow = subFields.reduce<Record<string, string>>((acc, sf) => {
                  acc[sf.key] = "";
                  return acc;
                }, {});
                updateKey(current, field.key, [...items, emptyRow], onChange);
              }}
            >
              Add row
            </button>
          )}
        </div>
      </div>
    );
  }

  if (field.type === "ticker_table") {
    return (
      <TickerTableFieldEditor
        key={field.key}
        field={field}
        current={current}
        onChange={onChange}
      />
    );
  }

  if (field.type === "chart_table") {
    const table = asChartTable(current[field.key]);
    const setTable = (next: { headers: string[]; rows: string[][] }) =>
      updateKey(current, field.key, next, onChange);

    return (
      <div key={field.key} className="mb-3">
        <FieldHeader label={field.label} />
        <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr>
                {table.headers.map((header, ci) => (
                  <th key={`h-${ci}`} className="p-1.5 align-top">
                    <input
                      type="text"
                      value={header}
                      placeholder={ci === 0 ? "Label" : `Series ${ci}`}
                      onChange={(e) => {
                        const headers = [...table.headers];
                        headers[ci] = e.target.value;
                        setTable({ headers, rows: table.rows });
                      }}
                      className="w-full px-2 py-1.5 text-xs text-gray-700 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, ri) => (
                <tr key={`r-${ri}`}>
                  {table.headers.map((_, ci) => (
                    <td key={`c-${ri}-${ci}`} className="p-1.5">
                      <input
                        type="text"
                        value={row[ci] ?? ""}
                        onChange={(e) => {
                          const rows = table.rows.map((r) => [...r]);
                          rows[ri][ci] = e.target.value;
                          setTable({ headers: table.headers, rows });
                        }}
                        className="w-full px-2 py-1.5 text-xs text-gray-700 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTable({ headers: table.headers, rows: [...table.rows, Array.from({ length: table.headers.length }, () => "")] })}
              className="px-2 py-1 text-[11px] font-medium rounded border border-gray-200 text-gray-600 hover:text-purple-600 hover:border-purple-400 bg-white"
            >
              + Row
            </button>
            <button
              type="button"
              onClick={() => {
                const next = [...table.headers, `Series ${table.headers.length}`];
                setTable({ headers: next, rows: table.rows.map((r) => [...r, ""]) });
              }}
              className="px-2 py-1 text-[11px] font-medium rounded border border-gray-200 text-gray-600 hover:text-purple-600 hover:border-purple-400 bg-white"
            >
              + Column
            </button>
            <button
              type="button"
              onClick={() => { if (table.rows.length > 1) setTable({ headers: table.headers, rows: table.rows.slice(0, -1) }); }}
              className="px-2 py-1 text-[11px] font-medium rounded border border-gray-200 text-gray-600 hover:text-red-500 hover:border-red-300 bg-white"
            >
              - Row
            </button>
            <button
              type="button"
              onClick={() => {
                if (table.headers.length <= 2) return;
                setTable({ headers: table.headers.slice(0, -1), rows: table.rows.map((r) => r.slice(0, -1)) });
              }}
              className="px-2 py-1 text-[11px] font-medium rounded border border-gray-200 text-gray-600 hover:text-red-500 hover:border-red-300 bg-white"
            >
              - Column
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default function ManifestPropEditor({ schema, value, onChange }: ManifestPropEditorProps) {
  if (!schema) {
    return <div className="text-sm text-gray-500">No schema found for this layout yet.</div>;
  }

  return <div>{schema.fields.map((field) => renderField(field, value, onChange))}</div>;
}
