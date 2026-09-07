/**
 * Force scene props into the shapes GeneratedSceneProps declares.
 *
 * WHY THIS EXISTS
 * ---------------
 * Generated scene code reads its props exactly as types.ts declares them:
 * `quoteAuthor` is a string, `bullets` is string[]. When the DATA is a
 * different shape, correct code crashes:
 *
 *     quoteAuthor: {name, role}      -> (author || 'Y').trim() is not a function
 *     bullets: [{lead, detail}]      -> Objects are not valid as a React child
 *
 * Both took down an entire template preview through the error boundary, because
 * one bad field kills the whole component tree, not just the element reading it.
 *
 * The generator is fixed at the source (_coerce_sample_field in
 * code_generator.py) so new templates cannot store these shapes. This is the
 * second line of defence, for the rows ALREADY in the database and for content
 * arriving from anywhere else — an imported template, a hand-edited scene, a
 * future generator regression. Sanitising on read repairs all of them with no
 * migration.
 *
 * Salvage where intent is obvious, drop where it is not. A dropped field means
 * the scene renders without that element, which is always better than a scene
 * that does not render at all.
 */

const str = (v: unknown): string | undefined => {
  if (typeof v === "string") return v.trim() || undefined;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (v && typeof v === "object") {
    // {name, role} / {label, ...}: take the likeliest human label.
    for (const k of ["name", "label", "text", "value", "title", "lead"]) {
      const got = (v as Record<string, unknown>)[k];
      if (typeof got === "string" && got.trim()) return got.trim();
    }
  }
  return undefined;
};

const stringList = (v: unknown): string[] | undefined => {
  if (!Array.isArray(v)) return undefined;
  const out: string[] = [];
  for (const item of v) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const lead = str(item);
      const rec = item as Record<string, unknown>;
      const detail = rec.detail ?? rec.description;
      if (lead && typeof detail === "string" && detail.trim()) {
        out.push(`${lead} — ${detail.trim()}`);
        continue;
      }
      if (lead) out.push(lead);
      continue;
    }
    const got = str(item);
    if (got) out.push(got);
  }
  return out.length ? out : undefined;
};

/**
 * Make a plain string survive being read as if it were an object.
 *
 * `bullets`, `steps` and `codeLines` are declared `string[]`, but a real
 * generated scene mapped props.steps and rendered `{step.description}` — which
 * is `undefined` on a string, so every row drew blank. The contract now says
 * items are plain strings and a validator gate rejects the field read, but
 * templates ALREADY GENERATED carry the wrong code and cannot be repaired
 * without regenerating them.
 *
 * A String object carries the text (it renders and concatenates exactly like a
 * primitive) while also answering `.label`, `.description`, `.value` and the
 * other field names such a scene reaches for. So the correct scenes are
 * unaffected and the incorrect ones start rendering their text instead of
 * nothing.
 *
 * Read-time repair, the same argument this file's header already makes: it
 * fixes every stored row at once, with no migration.
 */
const FIELD_ALIASES = [
  "label",
  "description",
  "value",
  "title",
  "text",
  "sub",
  "detail",
] as const;

const fieldAccessibleString = (v: string): string => {
  const boxed = new String(v) as unknown as Record<string, unknown>;
  for (const key of FIELD_ALIASES) {
    if (!(key in boxed)) boxed[key] = v;
  }
  return boxed as unknown as string;
};

/**
 * `stringList`, but each entry also answers the field names a scene may
 * mistakenly read off it. See fieldAccessibleString.
 */
const fieldAccessibleStringList = (v: unknown): string[] | undefined => {
  const out = stringList(v);
  return out ? out.map(fieldAccessibleString) : undefined;
};

/** [{label, description}] / [{value, label, suffix}] — objects the scene indexes
 *  into by field, so entries must be objects with string values. */
const objectList = (v: unknown): Record<string, string>[] | undefined => {
  if (!Array.isArray(v)) return undefined;
  const out: Record<string, string>[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      // A bare string where an object is expected: promote it to a label so the
      // row still renders rather than dropping the whole list.
      const got = str(item);
      if (got) out.push({ label: got, description: "" });
      continue;
    }
    const rec = item as Record<string, unknown>;
    const entry: Record<string, string> = {};
    for (const field of ["value", "label", "suffix", "description"]) {
      const got = rec[field];
      if (typeof got === "string" && got.trim()) entry[field] = got.trim();
      else if (typeof got === "number" && Number.isFinite(got)) entry[field] = String(got);
    }
    if (Object.keys(entry).length) out.push(entry);
  }
  return out.length ? out : undefined;
};

const pair = (v: unknown): { label: string; description: string } | undefined => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const rec = v as Record<string, unknown>;
  const label = str(rec.label ?? rec.title);
  if (!label) return undefined;
  const description = str(rec.description ?? rec.detail ?? rec.text);
  return { label, description: description ?? "" };
};

/**
 * The string[] props whose entries are boxed so a field read still resolves.
 * Listed separately because the change-detection below cannot see the boxing.
 */
const FIELD_ACCESSIBLE_KEYS = new Set(["bullets", "steps", "codeLines"]);

/** Field name -> the coercion its declared type requires. */
const COERCIONS: Record<string, (v: unknown) => unknown> = {
  sceneTitle: str,
  displayText: str,
  narrationText: str,
  quote: str,
  quoteAuthor: str,
  codeLanguage: str,
  chartSummary: str,
  chartType: str,
  bullets: fieldAccessibleStringList,
  steps: fieldAccessibleStringList,
  codeLines: fieldAccessibleStringList,
  metrics: objectList,
  timelineItems: objectList,
  comparisonLeft: pair,
  comparisonRight: pair,
};

/**
 * Return a copy of `props` with every structured-content field forced into its
 * declared shape. Fields that cannot be salvaged are removed entirely, so a
 * scene sees `undefined` — which every generated scene already handles, since
 * these props are all optional.
 *
 * Untouched fields (brandColors, fonts, sizes, urls…) pass through by reference.
 */
export function sanitizeSceneProps<T extends object>(props: T): T {
  let changed = false;
  const src = props as unknown as Record<string, unknown>;
  const draft: Record<string, unknown> = {};

  for (const [key, coerce] of Object.entries(COERCIONS)) {
    if (!(key in src)) continue;
    const raw = src[key];
    if (raw === undefined || raw === null) continue;
    const next = coerce(raw);
    // Already the right shape: coercion is a no-op, so avoid a pointless copy
    // (these run on every frame of every scene).
    if (next === raw) continue;
    if (typeof raw === "string" && next === raw) continue;
    // NOT for the field-accessible lists. A boxed String serialises EXACTLY
    // like the primitive it wraps, so this guard would judge the repair a no-op
    // and skip it — leaving the scene reading `.description` on a raw string
    // again. The boxing is the whole point of those coercions, and it is
    // invisible to JSON, so they are compared by identity above only.
    if (!FIELD_ACCESSIBLE_KEYS.has(key) && JSON.stringify(next) === JSON.stringify(raw)) {
      continue;
    }
    draft[key] = next;
    changed = true;
  }

  if (!changed) return props;
  const result: Record<string, unknown> = { ...src, ...draft };
  for (const [k, v] of Object.entries(draft)) {
    if (v === undefined) delete result[k];
  }
  return result as T;
}
