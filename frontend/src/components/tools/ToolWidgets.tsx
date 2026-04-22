import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { DirectoryPricingModel } from "../../content/seoTypes";
import {
  getSubstackDirectoryNichePath,
  getSubstackDirectoryPricingPath,
  getSubstackPublicationPath,
  pricingLabels,
  substackNiches,
  substackPublications,
} from "../../content/substackDirectory";

type ToolWidgetProps = {
  slug: string;
};

type FieldProps = {
  label: string;
  hint?: string;
  children: React.ReactNode;
};

function Field({ label, hint, children }: FieldProps) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-gray-900">{label}</span>
        {hint ? <span className="text-xs text-gray-400">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}

function inputClassName() {
  return "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm transition focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200";
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-600">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-gray-900">{value}</p>
      {helper ? <p className="mt-2 text-sm leading-relaxed text-gray-500">{helper}</p> : null}
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyPrecise(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value < 100 ? 2 : 0,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function CopyButton({
  value,
  label = "Copy",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard?.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:text-gray-900"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function MediumCalculator() {
  const [views, setViews] = useState(50000);
  const [memberRate, setMemberRate] = useState(28);
  const [avgReadMinutes, setAvgReadMinutes] = useState(4.2);
  const [completionRate, setCompletionRate] = useState(68);
  const [topicMultiplier, setTopicMultiplier] = useState(1);
  const [geoMultiplier, setGeoMultiplier] = useState(1);

  const result = useMemo(() => {
    const memberReads = views * (memberRate / 100);
    const engagedMinutes = memberReads * avgReadMinutes * (completionRate / 100);
    const contextMultiplier = topicMultiplier * geoMultiplier;
    const low = engagedMinutes * 0.028 * contextMultiplier;
    const base = engagedMinutes * 0.041 * contextMultiplier;
    const high = engagedMinutes * 0.056 * contextMultiplier;
    return {
      memberReads,
      engagedMinutes,
      low,
      base,
      high,
      yearly: base * 12,
    };
  }, [avgReadMinutes, completionRate, geoMultiplier, memberRate, topicMultiplier, views]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="rounded-3xl border border-gray-200 bg-gray-50/70 p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Monthly views" hint="All reads">
            <input
              type="number"
              className={inputClassName()}
              value={views}
              min={0}
              onChange={(event) => setViews(Number(event.target.value) || 0)}
            />
          </Field>
          <Field label="Member read rate" hint="% of views from paying members">
            <input
              type="number"
              className={inputClassName()}
              value={memberRate}
              min={0}
              max={100}
              onChange={(event) => setMemberRate(clamp(Number(event.target.value) || 0, 0, 100))}
            />
          </Field>
          <Field label="Average read minutes" hint="Per member read">
            <input
              type="number"
              step="0.1"
              className={inputClassName()}
              value={avgReadMinutes}
              min={0}
              onChange={(event) => setAvgReadMinutes(Number(event.target.value) || 0)}
            />
          </Field>
          <Field label="Completion rate" hint="How much gets read">
            <input
              type="number"
              className={inputClassName()}
              value={completionRate}
              min={0}
              max={100}
              onChange={(event) =>
                setCompletionRate(clamp(Number(event.target.value) || 0, 0, 100))
              }
            />
          </Field>
          <Field label="Topic mix" hint="Editorial yield multiplier">
            <select
              className={inputClassName()}
              value={topicMultiplier}
              onChange={(event) => setTopicMultiplier(Number(event.target.value))}
            >
              <option value={0.9}>General-interest</option>
              <option value={1}>Balanced</option>
              <option value={1.08}>Tech / product</option>
              <option value={1.15}>Finance / business</option>
              <option value={1.04}>Culture / commentary</option>
            </select>
          </Field>
          <Field label="Audience geography" hint="Approximate monetization fit">
            <select
              className={inputClassName()}
              value={geoMultiplier}
              onChange={(event) => setGeoMultiplier(Number(event.target.value))}
            >
              <option value={0.9}>Mostly global mixed traffic</option>
              <option value={1}>Balanced</option>
              <option value={1.08}>Mostly US / UK / Canada</option>
              <option value={1.12}>Premium English-speaking audience</option>
            </select>
          </Field>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <MetricCard
            label="Base monthly estimate"
            value={formatCurrency(result.base)}
            helper="Mid-case payout estimate based on the assumptions on the left."
          />
          <MetricCard
            label="Base yearly estimate"
            value={formatCurrency(result.yearly)}
            helper="Simply the base monthly estimate multiplied by twelve."
          />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            label="Low"
            value={formatCurrency(result.low)}
            helper="Conservative payout range."
          />
          <MetricCard
            label="Base"
            value={formatCurrency(result.base)}
            helper="Planning midpoint."
          />
          <MetricCard
            label="High"
            value={formatCurrency(result.high)}
            helper="Optimistic engagement yield."
          />
        </div>
        <div className="rounded-2xl border border-purple-100 bg-purple-50/70 p-5">
          <p className="text-sm font-semibold text-gray-900">Sensitivity breakdown</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                Member reads
              </p>
              <p className="mt-2 text-xl font-semibold text-gray-900">
                {formatNumber(result.memberReads)}
              </p>
            </div>
            <div className="rounded-xl bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                Engaged minutes
              </p>
              <p className="mt-2 text-xl font-semibold text-gray-900">
                {formatNumber(result.engagedMinutes)}
              </p>
            </div>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-gray-600">
            <li>Raising member-read share usually moves the estimate faster than raising raw views alone.</li>
            <li>Longer articles only help if completion remains healthy.</li>
            <li>Topic and audience quality act like multipliers on top of engagement, not replacements for it.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function SubstackRevenueCalculator() {
  const [freeSubscribers, setFreeSubscribers] = useState(12000);
  const [conversionRate, setConversionRate] = useState(4.5);
  const [monthlyPrice, setMonthlyPrice] = useState(10);
  const [annualDiscount, setAnnualDiscount] = useState(20);
  const [annualShare, setAnnualShare] = useState(35);
  const [monthlyChurn, setMonthlyChurn] = useState(3.2);
  const [monthlyNewFree, setMonthlyNewFree] = useState(500);

  const result = useMemo(() => {
    const paidSubscribers = freeSubscribers * (conversionRate / 100);
    const annualSubscribers = paidSubscribers * (annualShare / 100);
    const monthlySubscribers = paidSubscribers - annualSubscribers;
    const annualPrice = monthlyPrice * 12 * (1 - annualDiscount / 100);
    const mrr = monthlySubscribers * monthlyPrice + annualSubscribers * (annualPrice / 12);
    const arr = mrr * 12;
    const churnedPerMonth = paidSubscribers * (monthlyChurn / 100);
    const newPaidPerMonth = monthlyNewFree * (conversionRate / 100);
    const netNewPaid = newPaidPerMonth - churnedPerMonth;
    const twelveMonthPaid = Math.max(paidSubscribers + netNewPaid * 12, 0);
    const projectedMrr = Math.max(
      (twelveMonthPaid * (1 - annualShare / 100)) * monthlyPrice +
        (twelveMonthPaid * (annualShare / 100)) * (annualPrice / 12),
      0
    );
    const conservativeMrr = Math.max(
      (freeSubscribers * ((conversionRate * 0.75) / 100)) * monthlyPrice * 0.88,
      0
    );
    const optimisticMrr = Math.max(
      (freeSubscribers * ((conversionRate * 1.2) / 100)) * monthlyPrice * 1.05,
      0
    );

    return {
      paidSubscribers,
      mrr,
      arr,
      churnedPerMonth,
      newPaidPerMonth,
      netNewPaid,
      twelveMonthPaid,
      projectedMrr,
      conservativeMrr,
      optimisticMrr,
    };
  }, [
    annualDiscount,
    annualShare,
    conversionRate,
    freeSubscribers,
    monthlyChurn,
    monthlyNewFree,
    monthlyPrice,
  ]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="rounded-3xl border border-gray-200 bg-gray-50/70 p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Free subscribers">
            <input
              type="number"
              className={inputClassName()}
              value={freeSubscribers}
              min={0}
              onChange={(event) => setFreeSubscribers(Number(event.target.value) || 0)}
            />
          </Field>
          <Field label="Free to paid conversion" hint="% of free list">
            <input
              type="number"
              step="0.1"
              className={inputClassName()}
              value={conversionRate}
              min={0}
              max={100}
              onChange={(event) =>
                setConversionRate(clamp(Number(event.target.value) || 0, 0, 100))
              }
            />
          </Field>
          <Field label="Monthly price">
            <input
              type="number"
              step="0.5"
              className={inputClassName()}
              value={monthlyPrice}
              min={0}
              onChange={(event) => setMonthlyPrice(Number(event.target.value) || 0)}
            />
          </Field>
          <Field label="Annual discount" hint="% off monthly x12">
            <input
              type="number"
              className={inputClassName()}
              value={annualDiscount}
              min={0}
              max={100}
              onChange={(event) =>
                setAnnualDiscount(clamp(Number(event.target.value) || 0, 0, 100))
              }
            />
          </Field>
          <Field label="Annual plan share" hint="% of paid readers">
            <input
              type="number"
              className={inputClassName()}
              value={annualShare}
              min={0}
              max={100}
              onChange={(event) => setAnnualShare(clamp(Number(event.target.value) || 0, 0, 100))}
            />
          </Field>
          <Field label="Monthly churn" hint="% of paid readers lost">
            <input
              type="number"
              step="0.1"
              className={inputClassName()}
              value={monthlyChurn}
              min={0}
              max={100}
              onChange={(event) =>
                setMonthlyChurn(clamp(Number(event.target.value) || 0, 0, 100))
              }
            />
          </Field>
          <Field label="New free subscribers per month" hint="For growth projection">
            <input
              type="number"
              className={inputClassName()}
              value={monthlyNewFree}
              min={0}
              onChange={(event) => setMonthlyNewFree(Number(event.target.value) || 0)}
            />
          </Field>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <MetricCard
            label="Current MRR"
            value={formatCurrencyPrecise(result.mrr)}
            helper={`${formatNumber(result.paidSubscribers)} estimated paid subscribers today.`}
          />
          <MetricCard
            label="Current ARR"
            value={formatCurrency(result.arr)}
            helper="ARR is calculated from the blended monthly run rate."
          />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            label="Conservative"
            value={formatCurrency(result.conservativeMrr)}
            helper="Lower conversion outcome."
          />
          <MetricCard
            label="12-month MRR"
            value={formatCurrency(result.projectedMrr)}
            helper="Assumes current churn and list growth persist."
          />
          <MetricCard
            label="Optimistic"
            value={formatCurrency(result.optimisticMrr)}
            helper="Higher conversion outcome."
          />
        </div>
        <div className="rounded-2xl border border-purple-100 bg-purple-50/70 p-5">
          <p className="text-sm font-semibold text-gray-900">Forecast context</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                New paid / month
              </p>
              <p className="mt-2 text-xl font-semibold text-gray-900">
                {formatNumber(result.newPaidPerMonth)}
              </p>
            </div>
            <div className="rounded-xl bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                Churned / month
              </p>
              <p className="mt-2 text-xl font-semibold text-gray-900">
                {formatNumber(result.churnedPerMonth)}
              </p>
            </div>
            <div className="rounded-xl bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                12-mo paid base
              </p>
              <p className="mt-2 text-xl font-semibold text-gray-900">
                {formatNumber(result.twelveMonthPaid)}
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-gray-600">
            Conversion makes the business possible, but churn decides whether the business compounds.
            If the list is growing but paid churn stays high, ARR usually disappoints relative to top-of-funnel size.
          </p>
        </div>
      </div>
    </div>
  );
}

const SAMPLE_MARKDOWN = `---
title: Shipping without the content bottleneck
---

# Shipping without the content bottleneck

## Why this matters
- Reuse what already works
- Publish faster

> Note: most teams already have enough source material.

### Example
\`\`\`ts
export function ship() {
  return "more output";
}
\`\`\`

[Open the product](https://blog2video.app)
`;

function titleCaseHeading(line: string) {
  const body = line.replace(/^#+\s*/, "");
  const title = body
    .split(" ")
    .map((word) => (word.length > 3 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
  return `${line.match(/^#+/)?.[0] || ""} ${title}`.trim();
}

function formatMarkdownForTarget(input: string, target: "medium" | "substack") {
  const changes: string[] = [];
  let output = input.replace(/\r\n/g, "\n");

  if (/^---[\s\S]*?---\n?/m.test(output)) {
    output = output.replace(/^---[\s\S]*?---\n?/m, "");
    changes.push("Removed YAML frontmatter.");
  }

  const beforeHeadings = output;
  output = output
    .split("\n")
    .map((line) => {
      if (line.startsWith("#")) {
        return target === "medium" ? titleCaseHeading(line) : line.trim();
      }
      return line;
    })
    .join("\n");
  if (beforeHeadings !== output) changes.push("Normalized heading formatting.");

  const beforeCheckboxes = output;
  output = output.replace(/^- \[(x| )\] /gim, "- ");
  if (beforeCheckboxes !== output) changes.push("Converted task list items into plain bullets.");

  const beforeQuotes = output;
  output = output.replace(/^> Note:\s*(.+)$/gim, target === "medium" ? "**Note:** $1" : "> $1");
  if (beforeQuotes !== output) changes.push("Cleaned quote-note formatting.");

  const beforeSpacing = output;
  output = output.replace(/\n{3,}/g, "\n\n").trim();
  if (beforeSpacing !== output) changes.push("Collapsed extra blank lines.");

  if (target === "medium") {
    const beforeLinks = output;
    output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
    if (beforeLinks !== output) changes.push("Expanded Markdown links for easier Medium pasting.");
  }

  if (target === "substack") {
    const beforeSubstackSpacing = output;
    output = output.replace(/^##\s+/gm, "\n## ").replace(/^###\s+/gm, "\n### ");
    if (beforeSubstackSpacing !== output) {
      changes.push("Added newsletter-friendly spacing around section headers.");
    }
  }

  if (!changes.length) changes.push("No structural changes were needed.");

  return { output: output.trim(), changes };
}

function MarkdownFormatter() {
  const [input, setInput] = useState(SAMPLE_MARKDOWN);
  const [activeTarget, setActiveTarget] = useState<"medium" | "substack">("medium");

  const medium = useMemo(() => formatMarkdownForTarget(input, "medium"), [input]);
  const substack = useMemo(() => formatMarkdownForTarget(input, "substack"), [input]);
  const active = activeTarget === "medium" ? medium : substack;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-3xl border border-gray-200 bg-gray-50/70 p-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Markdown input</p>
            <button
              type="button"
              onClick={() => setInput(SAMPLE_MARKDOWN)}
              className="text-sm font-medium text-purple-700 hover:text-purple-800"
            >
              Reset sample
            </button>
          </div>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="min-h-[420px] w-full rounded-2xl border border-gray-200 bg-white p-4 font-mono text-sm leading-6 text-gray-700 shadow-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
          />
        </div>
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-full border border-gray-200 bg-gray-50 p-1">
              {(["medium", "substack"] as const).map((target) => (
                <button
                  key={target}
                  type="button"
                  onClick={() => setActiveTarget(target)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    activeTarget === target
                      ? "bg-purple-600 text-white"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  {target === "medium" ? "Medium output" : "Substack output"}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <CopyButton value={active.output} label="Copy output" />
              <button
                type="button"
                onClick={() => downloadText(`${activeTarget}-formatted.txt`, active.output)}
                className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:text-gray-900"
              >
                Download
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <textarea
              readOnly
              value={active.output}
              className="min-h-[340px] w-full rounded-2xl border border-gray-200 bg-gray-50 p-4 font-mono text-sm leading-6 text-gray-700"
            />
            <div className="rounded-2xl border border-purple-100 bg-purple-50/60 p-5">
              <p className="text-sm font-semibold text-gray-900">What changed</p>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-gray-600">
                {active.changes.map((change) => (
                  <li key={change} className="flex gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-purple-500" />
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type HeadlineMode = "blog" | "medium" | "substack" | "youtube";

function analyzeHeadline(headline: string, mode: HeadlineMode) {
  const trimmed = headline.trim();
  const words = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
  const length = words.length;
  const hasNumber = /\d/.test(trimmed);
  const hasAudience = /\b(for|to|with|without|founders|creators|teams|marketers|engineers)\b/i.test(
    trimmed
  );
  const hasSpecificNoun = /\b(calculator|guide|template|strategy|playbook|directory|generator|workflow|analysis)\b/i.test(
    trimmed
  );
  const hasStrongVerb = /\b(turn|grow|build|fix|launch|find|score|increase|reduce|ship|design)\b/i.test(
    trimmed
  );
  const hasCuriosity = /\bwhy|how|what|best|mistake|secret|truth|future\b/i.test(trimmed);

  let score = 0;
  const breakdown = [
    {
      label: "Length",
      max: 18,
      score:
        mode === "youtube"
          ? length >= 5 && length <= 10
            ? 18
            : 10
          : length >= 6 && length <= 14
            ? 18
            : 10,
    },
    { label: "Specificity", max: 18, score: hasSpecificNoun ? 18 : 10 },
    { label: "Clarity", max: 18, score: hasStrongVerb ? 18 : 11 },
    { label: "Audience fit", max: 16, score: hasAudience ? 16 : 9 },
    { label: "Curiosity / hook", max: 16, score: hasCuriosity || hasNumber ? 16 : 10 },
    { label: "Platform fit", max: 14, score: mode === "youtube" && hasNumber ? 14 : 12 },
  ];
  score = breakdown.reduce((total, item) => total + item.score, 0);

  const suggestions: string[] = [];
  if (!trimmed) suggestions.push("Start with a concrete promise before scoring the headline.");
  if (length < 6) suggestions.push("Add a little more specificity so the headline promises something clearer.");
  if (length > 14) suggestions.push("Trim filler words so the core idea lands faster.");
  if (!hasSpecificNoun) suggestions.push("Name the asset or outcome: guide, calculator, workflow, strategy, or template.");
  if (!hasAudience) suggestions.push("Add the audience or context so the reader knows this is for them.");
  if (!hasNumber && mode === "youtube") suggestions.push("YouTube titles often benefit from a number or sharper hook.");
  if (!hasStrongVerb) suggestions.push("Use a stronger verb like build, fix, grow, turn, or launch.");

  const variants = [
    `${mode === "youtube" ? "How to " : ""}${trimmed || "Turn one idea into a stronger headline"}`,
    hasAudience
      ? trimmed.replace(/\bfor\b/i, "for high-intent")
      : `${trimmed || "Build a headline"} for creators who want more clicks`,
    hasNumber ? trimmed : `5 ways to ${trimmed.toLowerCase() || "write a headline people open"}`,
  ].slice(0, 3);

  return { score: clamp(score, 0, 100), breakdown, suggestions, variants };
}

function HeadlineAnalyzer() {
  const [headline, setHeadline] = useState("Turn your written voice into video");
  const [mode, setMode] = useState<HeadlineMode>("blog");
  const result = useMemo(() => analyzeHeadline(headline, mode), [headline, mode]);

  return (
    <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-3xl border border-gray-200 bg-gray-50/70 p-6">
        <Field label="Headline">
          <textarea
            value={headline}
            onChange={(event) => setHeadline(event.target.value)}
            className="min-h-[140px] w-full rounded-2xl border border-gray-200 bg-white p-4 text-lg leading-7 text-gray-700 shadow-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
          />
        </Field>
        <div className="mt-5">
          <Field label="Publishing mode">
            <div className="grid gap-3 sm:grid-cols-2">
              {(["blog", "medium", "substack", "youtube"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setMode(option)}
                  className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                    mode === option
                      ? "border-purple-200 bg-purple-50 text-purple-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900"
                  }`}
                >
                  {option === "youtube" ? "YouTube title" : option.charAt(0).toUpperCase() + option.slice(1)}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </div>

      <div className="space-y-4">
        <MetricCard
          label="Headline score"
          value={`${result.score}/100`}
          helper="The score is rules-based, transparent, and designed for iteration instead of vanity."
        />
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-900">Score breakdown</p>
          <div className="mt-4 space-y-4">
            {result.breakdown.map((item) => (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between text-sm text-gray-600">
                  <span>{item.label}</span>
                  <span>{item.score}/{item.max}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-violet-500"
                    style={{ width: `${(item.score / item.max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-purple-100 bg-purple-50/60 p-5">
            <p className="text-sm font-semibold text-gray-900">Rewrite suggestions</p>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-gray-600">
              {result.suggestions.map((suggestion) => (
                <li key={suggestion} className="flex gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-purple-500" />
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-sm font-semibold text-gray-900">Variant prompts</p>
            <div className="mt-4 space-y-3">
              {result.variants.map((variant) => (
                <div key={variant} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <p className="text-sm leading-relaxed text-gray-700">{variant}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type QuoteTemplate = "editorial" | "signal" | "midnight";
type QuoteRatio = "landscape" | "square" | "portrait";

const quoteRatioSizes: Record<QuoteRatio, { width: number; height: number; label: string }> = {
  landscape: { width: 1400, height: 788, label: "X / LinkedIn landscape" },
  square: { width: 1200, height: 1200, label: "Square" },
  portrait: { width: 1080, height: 1350, label: "Portrait" },
};

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });
  if (current) lines.push(current);
  return lines;
}

function QuoteCardGenerator() {
  const [quote, setQuote] = useState(
    "Every strong content system starts by reusing the source material you already earned."
  );
  const [author, setAuthor] = useState("Blog2Video");
  const [source, setSource] = useState("Content systems note");
  const [accent, setAccent] = useState("#7c3aed");
  const [template, setTemplate] = useState<QuoteTemplate>("editorial");
  const [ratio, setRatio] = useState<QuoteRatio>("landscape");

  const previewClasses =
    template === "editorial"
      ? "bg-white text-gray-900 border-gray-200"
      : template === "signal"
        ? "bg-purple-50 text-gray-900 border-purple-100"
        : "bg-gray-950 text-white border-gray-800";

  const exportCard = () => {
    const { width, height } = quoteRatioSizes[ratio];
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = template === "midnight" ? "#09090b" : template === "signal" ? "#f5f3ff" : "#ffffff";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, width, 26);
    ctx.fillRect(0, height - 26, width, 26);

    const padding = Math.round(width * 0.08);
    ctx.fillStyle = template === "midnight" ? "#ffffff" : "#111827";
    ctx.font = `${Math.round(width * 0.045)}px Inter, Arial, sans-serif`;
    ctx.textBaseline = "top";
    const quoteLines = wrapText(ctx, `“${quote}”`, width - padding * 2);
    let y = padding + 50;
    quoteLines.forEach((line) => {
      ctx.fillText(line, padding, y);
      y += Math.round(width * 0.06);
    });

    ctx.fillStyle = accent;
    ctx.font = `${Math.round(width * 0.02)}px Inter, Arial, sans-serif`;
    ctx.fillText(author, padding, height - padding - 70);
    ctx.fillStyle = template === "midnight" ? "#d4d4d8" : "#6b7280";
    ctx.fillText(source, padding, height - padding - 30);

    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = `quote-card-${ratio}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-3xl border border-gray-200 bg-gray-50/70 p-6">
        <div className="space-y-5">
          <Field label="Quote">
            <textarea
              value={quote}
              onChange={(event) => setQuote(event.target.value)}
              className="min-h-[160px] w-full rounded-2xl border border-gray-200 bg-white p-4 text-lg leading-7 text-gray-700 shadow-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
          </Field>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Attribution">
              <input
                type="text"
                className={inputClassName()}
                value={author}
                onChange={(event) => setAuthor(event.target.value)}
              />
            </Field>
            <Field label="Source / role">
              <input
                type="text"
                className={inputClassName()}
                value={source}
                onChange={(event) => setSource(event.target.value)}
              />
            </Field>
            <Field label="Template">
              <select
                className={inputClassName()}
                value={template}
                onChange={(event) => setTemplate(event.target.value as QuoteTemplate)}
              >
                <option value="editorial">Editorial</option>
                <option value="signal">Signal</option>
                <option value="midnight">Midnight</option>
              </select>
            </Field>
            <Field label="Aspect ratio">
              <select
                className={inputClassName()}
                value={ratio}
                onChange={(event) => setRatio(event.target.value as QuoteRatio)}
              >
                {Object.entries(quoteRatioSizes).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Accent color">
              <input
                type="color"
                className="h-12 w-full rounded-xl border border-gray-200 bg-white px-2 py-2"
                value={accent}
                onChange={(event) => setAccent(event.target.value)}
              />
            </Field>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className={`rounded-[28px] border p-8 shadow-sm ${previewClasses}`}>
          <div className="mb-10 h-2 w-28 rounded-full" style={{ backgroundColor: accent }} />
          <p className="text-3xl font-semibold leading-tight">
            “{quote || "Add a quote to generate a card preview."}”
          </p>
          <div className="mt-12 space-y-2">
            <p className="text-base font-semibold" style={{ color: accent }}>
              {author || "Attribution"}
            </p>
            <p className={template === "midnight" ? "text-sm text-gray-300" : "text-sm text-gray-500"}>
              {source || "Source"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={exportCard}
            className="rounded-full bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-700"
          >
            Export PNG
          </button>
          <CopyButton value={`"${quote}" — ${author}`} label="Copy quote" />
        </div>
      </div>
    </div>
  );
}

function SubstackDirectoryExplorer() {
  const [query, setQuery] = useState("");
  const [pricing, setPricing] = useState<DirectoryPricingModel | "all">("all");

  const nicheMatches = useMemo(() => {
    return substackNiches
      .filter((niche) => {
        const matchesQuery = !query
          ? true
          : `${niche.name} ${niche.description} ${niche.angle}`.toLowerCase().includes(query.toLowerCase());
        if (!matchesQuery) return false;
        if (pricing === "all") return true;
        return niche.publicationSlugs.some((slug) => {
          const publication = substackPublications.find((entry) => entry.slug === slug);
          return publication?.pricingModel === pricing;
        });
      })
      .slice(0, 12);
  }, [pricing, query]);

  const publicationMatches = useMemo(() => {
    return substackPublications
      .filter((publication) => {
        const matchesQuery = !query
          ? true
          : `${publication.name} ${publication.tagline} ${publication.topics.join(" ")}`.toLowerCase().includes(query.toLowerCase());
        const matchesPricing = pricing === "all" ? true : publication.pricingModel === pricing;
        return matchesQuery && matchesPricing;
      })
      .slice(0, 8);
  }, [pricing, query]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-3xl border border-gray-200 bg-gray-50/70 p-6 md:grid-cols-[1fr_auto] md:items-end">
        <Field label="Search niches or publications">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="AI, politics, growth, creators..."
            className={inputClassName()}
          />
        </Field>
        <Field label="Pricing model">
          <select
            className={inputClassName()}
            value={pricing}
            onChange={(event) => setPricing(event.target.value as DirectoryPricingModel | "all")}
          >
            <option value="all">All pricing models</option>
            <option value="free">Free</option>
            <option value="paid">Paid</option>
            <option value="freemium">Freemium</option>
          </select>
        </Field>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900">Niche pages</h3>
            <Link to={getSubstackDirectoryNichePath("ai")} className="text-sm font-medium text-purple-700 hover:text-purple-800">
              Explore a sample niche
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {nicheMatches.map((niche) => (
              <div
                key={niche.slug}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <Link to={getSubstackDirectoryNichePath(niche.slug)} className="block">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-600">{niche.name}</p>
                  <h4 className="mt-2 text-lg font-semibold text-gray-900">{niche.title}</h4>
                  <p className="mt-3 text-sm leading-relaxed text-gray-600">{niche.description}</p>
                </Link>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(["free", "paid", "freemium"] as DirectoryPricingModel[]).map((mode) => (
                    <Link
                      key={mode}
                      to={getSubstackDirectoryPricingPath(niche.slug, mode)}
                      className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-500 hover:border-gray-300 hover:text-gray-900"
                    >
                      {pricingLabels[mode]}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-4 text-xl font-semibold text-gray-900">Publication profiles</h3>
          <div className="space-y-4">
            {publicationMatches.map((publication) => (
              <Link
                key={publication.slug}
                to={getSubstackPublicationPath(publication.slug)}
                className="block rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">{publication.name}</h4>
                    <p className="mt-1 text-sm text-gray-500">{publication.tagline}</p>
                  </div>
                  <span className="rounded-full border border-purple-100 bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">
                    {pricingLabels[publication.pricingModel]}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">{publication.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ToolWidget({ slug }: ToolWidgetProps) {
  switch (slug) {
    case "medium-partner-program-earnings-calculator":
      return <MediumCalculator />;
    case "substack-revenue-calculator":
      return <SubstackRevenueCalculator />;
    case "markdown-to-medium-substack-formatter":
      return <MarkdownFormatter />;
    case "headline-analyzer":
      return <HeadlineAnalyzer />;
    case "quote-card-generator":
      return <QuoteCardGenerator />;
    case "substack-directory":
      return <SubstackDirectoryExplorer />;
    default:
      return null;
  }
}
