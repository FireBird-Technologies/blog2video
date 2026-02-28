import type { SceneLayoutConfig, SceneArrangement, SceneElement } from "../types";

type LooseObject = Record<string, unknown>;

const _asObject = (value: unknown): LooseObject | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as LooseObject)
    : null;

const _firstText = (obj: LooseObject, keys: string[]): string => {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
  }
  return "";
};

export const asText = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value == null) return "";

  if (Array.isArray(value)) {
    return value.map(asText).filter(Boolean).join(", ").trim();
  }

  const obj = _asObject(value);
  if (!obj) return "";

  const primary = _firstText(obj, ["text", "title", "label", "value", "name"]);
  const secondary = _firstText(obj, ["description", "subtitle", "detail"]);
  if (primary && secondary && primary !== secondary) return `${primary} - ${secondary}`;
  if (primary) return primary;
  if (secondary) return secondary;

  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
};

// ─── Config normalizer ──────────────────────────────────────

const VALID_ARRANGEMENTS = new Set<SceneArrangement>([
  "full-center", "split-left", "split-right", "top-bottom",
  "grid-2x2", "grid-3", "asymmetric-left", "asymmetric-right", "stacked",
]);

const FALLBACK_CONFIG: SceneLayoutConfig = {
  arrangement: "full-center",
  elements: [
    { type: "heading", content: {}, emphasis: "primary" },
    { type: "body-text", content: {}, emphasis: "secondary" },
  ],
  decorations: ["accent-bar-bottom"],
};

/**
 * Normalize a raw layout config from the backend,
 * ensuring all required fields exist with sensible defaults.
 */
export const normalizeConfig = (raw: unknown): SceneLayoutConfig => {
  const obj = _asObject(raw);
  if (!obj) return { ...FALLBACK_CONFIG };

  const arrangement = VALID_ARRANGEMENTS.has(obj.arrangement as SceneArrangement)
    ? (obj.arrangement as SceneArrangement)
    : "full-center";

  const elements = Array.isArray(obj.elements)
    ? (obj.elements as SceneElement[]).filter(
        (el) => el && typeof el === "object" && typeof el.type === "string"
      )
    : FALLBACK_CONFIG.elements;

  const decorations = Array.isArray(obj.decorations)
    ? obj.decorations
    : ["none"];

  const background = _asObject(obj.background) ? obj.background : undefined;

  return {
    arrangement,
    elements,
    decorations,
    ...(background ? { background } : {}),
  } as SceneLayoutConfig;
};

// ─── Content Cards normalizer ──────────────────────────────────

export interface NormalizedCard {
  text: string;
  icon?: string;
  imageUrl?: string;
}

const splitSentences = (narration: string): string[] =>
  narration
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);

export const normalizeCards = (
  cards: unknown,
  bullets: unknown,
  narration: string,
): NormalizedCard[] => {
  if (Array.isArray(cards) && cards.length > 0) {
    return cards
      .map((card) => {
        const obj = _asObject(card);
        if (obj) {
          return {
            text: _firstText(obj, ["text", "title", "label", "name"]) || asText(card),
            icon: typeof obj.icon === "string" ? obj.icon : undefined,
            imageUrl: typeof obj.imageUrl === "string" ? obj.imageUrl : undefined,
          };
        }
        const text = asText(card);
        return text ? { text } : null;
      })
      .filter((c): c is NormalizedCard => c !== null);
  }

  if (Array.isArray(bullets) && bullets.length > 0) {
    return bullets.map((b) => ({ text: asText(b) })).filter((c) => c.text);
  }

  return splitSentences(narration).map((s) => ({ text: s }));
};

// ─── Other normalizers (used by element renderers) ──────────

export const normalizeBullets = (bullets: unknown, narration: string): string[] => {
  const source =
    Array.isArray(bullets) && bullets.length > 0 ? bullets : splitSentences(narration);
  return source.map(asText).filter(Boolean);
};

export const normalizeFlowSteps = (steps: unknown, narration: string): string[] => {
  const source =
    Array.isArray(steps) && steps.length > 0 ? steps : splitSentences(narration);

  return source
    .map((step, idx) => {
      const obj = _asObject(step);
      if (obj) {
        const title = _firstText(obj, ["title", "label", "text", "name"]);
        const description = _firstText(obj, ["description", "detail"]);
        if (title && description) return `${title} - ${description}`;
        if (title) return title;
        if (description) return description;
      }
      return asText(step) || `Step ${idx + 1}`;
    })
    .filter(Boolean);
};

export const normalizeCodeLines = (
  codeLines: unknown,
  narration: string,
): string[] => {
  const source =
    Array.isArray(codeLines) && codeLines.length > 0 ? codeLines : narration.split("\n");

  return source
    .map((line) => {
      const obj = _asObject(line);
      if (obj) {
        const parsed = _firstText(obj, ["line", "code", "command", "text", "value"]);
        if (parsed) return parsed;
      }
      return asText(line);
    })
    .filter(Boolean);
};

export interface NormalizedMetric {
  value: string;
  label: string;
  suffix: string;
}

export const normalizeMetrics = (
  metrics: unknown,
  narration: string,
): NormalizedMetric[] => {
  const source = Array.isArray(metrics) ? metrics : [];

  const parsed = source
    .map((metric, idx) => {
      const obj = _asObject(metric);
      if (obj) {
        const value = asText(obj.value);
        const label = _firstText(obj, ["label", "title", "name"]) || `Metric ${idx + 1}`;
        const suffix = asText(obj.suffix);
        if (!value && !label) return null;
        return { value: value || "—", label, suffix };
      }
      const text = asText(metric);
      if (!text) return null;
      return { value: text, label: `Metric ${idx + 1}`, suffix: "" };
    })
    .filter((metric): metric is NormalizedMetric => Boolean(metric));

  if (parsed.length > 0) return parsed;

  return [
    {
      value: "—",
      label: asText(narration).slice(0, 40) || "Metric",
      suffix: "",
    },
  ];
};

export interface NormalizedTimelineItem {
  label: string;
  description: string;
  imageUrl?: string;
}

export const normalizeTimelineItems = (
  timelineItems: unknown,
  narration: string,
): NormalizedTimelineItem[] => {
  if (Array.isArray(timelineItems) && timelineItems.length > 0) {
    return timelineItems
      .map((item, idx) => {
        const obj = _asObject(item);
        if (obj) {
          const label =
            _firstText(obj, ["label", "title", "name"]) || `Step ${idx + 1}`;
          const description =
            _firstText(obj, ["description", "text", "detail"]) || label;
          const imageUrl = typeof obj.imageUrl === "string" ? obj.imageUrl : undefined;
          return { label, description, imageUrl };
        }
        const description = asText(item);
        if (!description) return null;
        return { label: `Step ${idx + 1}`, description };
      })
      .filter(
        (item): item is NormalizedTimelineItem =>
          Boolean(item && (item.label || item.description)),
      );
  }

  return splitSentences(narration).map((sentence, idx) => ({
    label: `Step ${idx + 1}`,
    description: sentence,
  }));
};
