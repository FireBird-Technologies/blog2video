/**
 * Compute a human-readable, minimal diff between an edit's old and new values.
 *
 * For JSON fields (e.g. a scene's `remotion_code` descriptor) this walks both
 * objects and returns only the leaf paths whose value changed — so the history
 * shows "title.fontSize: 24 → 32" instead of the entire JSON blob. For plain
 * scalar fields it returns a single change with an empty path.
 */

export interface LeafChange {
  /** Dotted path to the changed leaf (empty for a scalar field). */
  path: string;
  old: string;
  new: string;
}

type Json = unknown;

function tryParse(s: string | null): { ok: boolean; value: Json } {
  if (s == null) return { ok: false, value: null };
  const t = s.trim();
  if (!(t.startsWith("{") || t.startsWith("["))) return { ok: false, value: null };
  try {
    return { ok: true, value: JSON.parse(t) };
  } catch {
    return { ok: false, value: null };
  }
}

function scalarStr(v: Json): string {
  if (v == null) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function walk(oldV: Json, newV: Json, path: string, out: LeafChange[]): void {
  // Same reference/value → no change.
  if (oldV === newV) return;

  const bothObjects =
    oldV != null && newV != null && typeof oldV === "object" && typeof newV === "object" &&
    Array.isArray(oldV) === Array.isArray(newV);

  if (bothObjects) {
    const oldObj = oldV as Record<string, Json>;
    const newObj = newV as Record<string, Json>;
    const keys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
    for (const k of keys) {
      const childPath = path ? `${path}.${k}` : k;
      walk(oldObj[k], newObj[k], childPath, out);
    }
    return;
  }

  // Leaf (or type changed) — record if the stringified values differ.
  const o = scalarStr(oldV);
  const n = scalarStr(newV);
  if (o !== n) out.push({ path, old: o, new: n });
}

/**
 * Diff a field's old/new string values. Returns the minimal set of changed leaves.
 * A single non-JSON field yields one entry with `path === ""`.
 */
export function diffFieldValue(oldStr: string | null, newStr: string | null): LeafChange[] {
  const a = tryParse(oldStr);
  const b = tryParse(newStr);
  if (a.ok && b.ok) {
    const out: LeafChange[] = [];
    walk(a.value, b.value, "", out);
    // If the JSON changed but no leaf diff was found (rare — e.g. key reordering),
    // fall back to whole-value so the change is never silently empty.
    if (out.length === 0) {
      return [{ path: "", old: oldStr ?? "—", new: newStr ?? "—" }];
    }
    return out;
  }
  return [{ path: "", old: oldStr ?? "—", new: newStr ?? "—" }];
}
