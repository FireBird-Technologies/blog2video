import { useEffect, useMemo, useState } from "react";
import PdfToVideoConverter from "./PdfToVideoConverter";
import StockVisualizer from "./StockVisualizer";
import SubstackValuationTool from "./SubstackValuationTool";
import { Link } from "react-router-dom";
import type { CredentialResponse } from "@react-oauth/google";
import { useAuth } from "../../hooks/useAuth";
import { isPaidPlan } from "../../lib/plan";
import GoogleAuthButton from "../public/GoogleAuthButton";
import { googleLogin } from "../../api/client";
import {
  fetchToolQuotas,
  generateBookCover,
  generateThumbnailText,
  generateVideoScript,
  generateYouTubeDescription,
  type ToolKey,
} from "../../api/freeTools";

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

function formatHours(value: number) {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)} hrs`;
}

function ContentRepurposingCalculator() {
  const [monthlyPosts, setMonthlyPosts] = useState(8);
  const [averageWords, setAverageWords] = useState(1400);
  const [reuseRate, setReuseRate] = useState(75);
  const [clipsPerVideo, setClipsPerVideo] = useState(4);
  const [manualHoursPerVideo, setManualHoursPerVideo] = useState(3.5);
  const [automationMinutesPerVideo, setAutomationMinutesPerVideo] = useState(35);

  const result = useMemo(() => {
    const repurposedPosts = monthlyPosts * (reuseRate / 100);
    const longFormVideos = Math.max(Math.round(repurposedPosts), 0);
    const shortClips = longFormVideos * clipsPerVideo;
    const socialPosts = longFormVideos * 3 + shortClips;
    const estimatedVideoMinutes = Math.max((averageWords / 150) * longFormVideos, 0);
    const manualHours = longFormVideos * manualHoursPerVideo;
    const automatedHours = (longFormVideos * automationMinutesPerVideo) / 60;
    const savedHours = Math.max(manualHours - automatedHours, 0);

    return {
      repurposedPosts,
      longFormVideos,
      shortClips,
      socialPosts,
      estimatedVideoMinutes,
      manualHours,
      automatedHours,
      savedHours,
    };
  }, [
    automationMinutesPerVideo,
    averageWords,
    clipsPerVideo,
    manualHoursPerVideo,
    monthlyPosts,
    reuseRate,
  ]);

  const shareableSummary = [
    `Monthly posts: ${formatNumber(monthlyPosts)}`,
    `Repurposed posts: ${formatNumber(result.repurposedPosts)}`,
    `Long-form videos: ${formatNumber(result.longFormVideos)}`,
    `Short clips: ${formatNumber(result.shortClips)}`,
    `Social posts: ${formatNumber(result.socialPosts)}`,
    `Estimated video runtime: ${formatNumber(result.estimatedVideoMinutes)} minutes`,
    `Production hours saved: ${formatHours(result.savedHours)}`,
  ].join("\n");

  return (
    <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="rounded-3xl border border-gray-200 bg-gray-50/70 p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Blog posts per month" hint="New or existing posts">
            <input
              type="number"
              className={inputClassName()}
              value={monthlyPosts}
              min={0}
              onChange={(event) => setMonthlyPosts(Number(event.target.value) || 0)}
            />
          </Field>
          <Field label="Average words per post" hint="Used for runtime">
            <input
              type="number"
              className={inputClassName()}
              value={averageWords}
              min={0}
              onChange={(event) => setAverageWords(Number(event.target.value) || 0)}
            />
          </Field>
          <Field label="Posts worth repurposing" hint="% of monthly output">
            <input
              type="number"
              className={inputClassName()}
              value={reuseRate}
              min={0}
              max={100}
              onChange={(event) => setReuseRate(clamp(Number(event.target.value) || 0, 0, 100))}
            />
          </Field>
          <Field label="Short clips per video" hint="LinkedIn, Shorts, Reels">
            <input
              type="number"
              className={inputClassName()}
              value={clipsPerVideo}
              min={0}
              onChange={(event) => setClipsPerVideo(Number(event.target.value) || 0)}
            />
          </Field>
          <Field label="Manual hours per video" hint="Script, edit, render">
            <input
              type="number"
              step="0.25"
              className={inputClassName()}
              value={manualHoursPerVideo}
              min={0}
              onChange={(event) => setManualHoursPerVideo(Number(event.target.value) || 0)}
            />
          </Field>
          <Field label="Automated minutes per video" hint="Review and polish">
            <input
              type="number"
              className={inputClassName()}
              value={automationMinutesPerVideo}
              min={0}
              onChange={(event) => setAutomationMinutesPerVideo(Number(event.target.value) || 0)}
            />
          </Field>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <MetricCard
            label="Long-form videos"
            value={formatNumber(result.longFormVideos)}
            helper={`${formatNumber(result.repurposedPosts)} posts are eligible after your reuse-rate assumption.`}
          />
          <MetricCard
            label="Short clips"
            value={formatNumber(result.shortClips)}
            helper="Short-form clips that can be extracted from the long-form video set."
          />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            label="Social posts"
            value={formatNumber(result.socialPosts)}
            helper="A simple mix of clips plus supporting text posts."
          />
          <MetricCard
            label="Video runtime"
            value={`${formatNumber(result.estimatedVideoMinutes)} min`}
            helper="Estimated narrated minutes from your average word count."
          />
          <MetricCard
            label="Hours saved"
            value={formatHours(result.savedHours)}
            helper="Manual production time minus automated review time."
          />
        </div>
        <div className="rounded-2xl border border-purple-100 bg-purple-50/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-gray-900">Repurposing plan</p>
            <CopyButton value={shareableSummary} label="Copy summary" />
          </div>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed text-gray-600">
            <li>Prioritize posts that already bring search traffic, demos, or signup intent.</li>
            <li>Use one long-form video as the source for clips, quote cards, and newsletter embeds.</li>
            <li>Build an outreach angle around the calculator result when pitching resource pages.</li>
          </ul>
        </div>
      </div>
    </div>
  );
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

/**
 * Google renders desktop result titles in roughly 20px Arial and truncates the
 * snippet near 600px, so a 58-character title full of wide characters can still
 * get cut off while a 64-character title of narrow ones survives. Character
 * count alone therefore under-reports truncation, and the checker measures real
 * pixel width with canvas instead. The per-character fallback only matters
 * during prerender, where no component actually renders.
 */
const TITLE_FONT = "20px Arial, Helvetica, sans-serif";
const DESCRIPTION_FONT = "14px Arial, Helvetica, sans-serif";
const TITLE_PIXEL_LIMIT = 600;
const TITLE_PIXEL_WARN = 660;
const DESCRIPTION_PIXEL_LIMIT = 920;
const MOBILE_TITLE_WIDTH = 340;
const MOBILE_DESCRIPTION_WIDTH = 340;

let measureCanvas: HTMLCanvasElement | null = null;

function measureTextWidth(text: string, font: string) {
  if (typeof document === "undefined") return Math.round(text.length * 9);
  if (!measureCanvas) measureCanvas = document.createElement("canvas");
  const context = measureCanvas.getContext("2d");
  if (!context) return Math.round(text.length * 9);
  context.font = font;
  return Math.round(context.measureText(text).width);
}

function truncateToPixels(text: string, font: string, maxWidth: number) {
  if (measureTextWidth(text, font) <= maxWidth) return { text, truncated: false };

  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (measureTextWidth(`${text.slice(0, mid)}…`, font) <= maxWidth) low = mid;
    else high = mid - 1;
  }
  return { text: `${text.slice(0, low).trimEnd()}…`, truncated: true };
}

function wrapToLines(text: string, font: string, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || measureTextWidth(candidate, font) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function clampLines(text: string, font: string, maxWidth: number, maxLines: number) {
  const lines = wrapToLines(text, font, maxWidth);
  if (lines.length <= maxLines) return { lines, truncated: false };

  const kept = lines.slice(0, maxLines);
  // Re-truncate the final visible line with the leftover words appended so the
  // ellipsis lands mid-sentence the way Google renders it, not at a word break.
  kept[maxLines - 1] = truncateToPixels(
    [kept[maxLines - 1], ...lines.slice(maxLines)].join(" "),
    font,
    maxWidth
  ).text;
  return { lines: kept, truncated: true };
}

type CheckStatus = "pass" | "warn" | "fail";

type SeoCheck = {
  label: string;
  status: CheckStatus;
  detail: string;
  weight: number;
};

const checkStatusStyles: Record<CheckStatus, { dot: string; text: string; label: string }> = {
  pass: { dot: "bg-emerald-500", text: "text-emerald-700", label: "Good" },
  warn: { dot: "bg-amber-500", text: "text-amber-700", label: "Review" },
  fail: { dot: "bg-rose-500", text: "text-rose-700", label: "Fix" },
};

function analyzeSeoTitle(rawTitle: string, rawDescription: string, rawKeyword: string) {
  const title = rawTitle.trim().replace(/\s+/g, " ");
  const description = rawDescription.trim().replace(/\s+/g, " ");
  const keyword = rawKeyword.trim().toLowerCase();

  const titleChars = title.length;
  const titlePixels = measureTextWidth(title, TITLE_FONT);
  const descriptionChars = description.length;
  const descriptionPixels = measureTextWidth(description, DESCRIPTION_FONT);

  const lowerTitle = title.toLowerCase();
  const keywordIndex = keyword ? lowerTitle.indexOf(keyword) : -1;
  const keywordInTitle = keywordIndex >= 0;
  const keywordInDescription = keyword ? description.toLowerCase().includes(keyword) : false;
  const keywordRepeats = keyword
    ? lowerTitle.split(keyword).length - 1
    : 0;

  const letters = title.replace(/[^a-z]/gi, "");
  const isShouting = letters.length > 6 && letters === letters.toUpperCase();
  const separatorCount = (title.match(/[|\-–—:·»]/g) ?? []).length;

  const checks: SeoCheck[] = [];

  checks.push({
    label: "Character count",
    weight: 18,
    status: !titleChars ? "fail" : titleChars > 70 ? "fail" : titleChars > 60 || titleChars < 30 ? "warn" : "pass",
    detail: !titleChars
      ? "Add a title to score it."
      : titleChars > 70
        ? `${titleChars} characters. Well past the 60-character guideline — Google will almost certainly cut it.`
        : titleChars > 60
          ? `${titleChars} characters. Slightly over the 50–60 sweet spot; check the pixel width below.`
          : titleChars < 30
            ? `${titleChars} characters. There is room left for a qualifier or your brand.`
            : `${titleChars} characters, inside the 50–60 guideline.`,
  });

  checks.push({
    label: "Pixel width",
    weight: 20,
    status: !titleChars
      ? "fail"
      : titlePixels > TITLE_PIXEL_WARN
        ? "fail"
        : titlePixels > TITLE_PIXEL_LIMIT
          ? "warn"
          : "pass",
    detail: !titleChars
      ? "Pixel width is measured once you enter a title."
      : titlePixels > TITLE_PIXEL_LIMIT
        ? `${titlePixels}px against a ~${TITLE_PIXEL_LIMIT}px desktop limit. The preview shows where it gets cut.`
        : `${titlePixels}px, comfortably inside the ~${TITLE_PIXEL_LIMIT}px desktop limit.`,
  });

  checks.push({
    label: "Keyword present",
    weight: 20,
    status: !keyword ? "warn" : keywordInTitle ? "pass" : "fail",
    detail: !keyword
      ? "Add a target keyword to check placement and repetition."
      : keywordInTitle
        ? `"${rawKeyword.trim()}" appears in the title.`
        : `"${rawKeyword.trim()}" is missing from the title.`,
  });

  checks.push({
    label: "Keyword position",
    weight: 14,
    status: !keyword || !keywordInTitle ? "warn" : keywordIndex <= 30 ? "pass" : "warn",
    detail: !keyword
      ? "Front-loading is scored once a keyword is set."
      : !keywordInTitle
        ? "Add the keyword before checking how far forward it sits."
        : keywordIndex <= 30
          ? `Starts at character ${keywordIndex + 1}, early enough to survive truncation.`
          : `Starts at character ${keywordIndex + 1}. Move it nearer the front so it reads before any cut-off.`,
  });

  checks.push({
    label: "Meta description",
    weight: 16,
    status: !descriptionChars
      ? "warn"
      : descriptionPixels > DESCRIPTION_PIXEL_LIMIT || descriptionChars > 165
        ? "warn"
        : descriptionChars < 70
          ? "warn"
          : "pass",
    detail: !descriptionChars
      ? "Optional, but the preview is more useful with a description."
      : descriptionChars > 165
        ? `${descriptionChars} characters (${descriptionPixels}px). Google usually truncates past ~160.`
        : descriptionChars < 70
          ? `${descriptionChars} characters. Short descriptions leave click-through on the table.`
          : `${descriptionChars} characters (${descriptionPixels}px), inside the usual limit.${
              keyword && !keywordInDescription ? " The keyword is not mentioned, though." : ""
            }`,
  });

  checks.push({
    label: "Formatting",
    weight: 12,
    status: isShouting || keywordRepeats > 1 || separatorCount > 2 ? "warn" : "pass",
    detail: isShouting
      ? "All-caps titles read as shouting and are often rewritten by Google."
      : keywordRepeats > 1
        ? `The keyword appears ${keywordRepeats} times. Repetition reads as stuffing.`
        : separatorCount > 2
          ? "Several separators in one title. Two clauses plus a brand is usually the ceiling."
          : "No shouting, stuffing, or separator pile-up.",
  });

  const earned = checks.reduce((total, check) => {
    if (check.status === "pass") return total + check.weight;
    if (check.status === "warn") return total + check.weight * 0.55;
    return total;
  }, 0);
  const possible = checks.reduce((total, check) => total + check.weight, 0);

  const desktopTitle = truncateToPixels(title, TITLE_FONT, TITLE_PIXEL_LIMIT);
  const desktopDescription = clampLines(description, DESCRIPTION_FONT, DESCRIPTION_PIXEL_LIMIT, 2);
  const mobileTitle = clampLines(title, TITLE_FONT, MOBILE_TITLE_WIDTH, 2);
  const mobileDescription = clampLines(description, DESCRIPTION_FONT, MOBILE_DESCRIPTION_WIDTH, 3);

  return {
    score: Math.round(clamp((earned / possible) * 100, 0, 100)),
    checks,
    titleChars,
    titlePixels,
    descriptionChars,
    desktopTitle,
    desktopDescription,
    mobileTitle,
    mobileDescription,
  };
}

function LengthMeter({ value, limit, warnAt }: { value: number; limit: number; warnAt: number }) {
  const ratio = clamp(value / warnAt, 0, 1);
  const tone = value > warnAt ? "bg-rose-500" : value > limit ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="h-2 rounded-full bg-gray-100">
      <div className={`h-2 rounded-full transition-all ${tone}`} style={{ width: `${ratio * 100}%` }} />
    </div>
  );
}

function SeoTitleChecker() {
  const [title, setTitle] = useState("SEO Title Checker: Pixel Width and Google Preview");
  const [description, setDescription] = useState(
    "Check your SEO title for character count, pixel width, and keyword placement, then preview exactly how it will appear in Google results."
  );
  const [keyword, setKeyword] = useState("seo title checker");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  const result = useMemo(
    () => analyzeSeoTitle(title, description, keyword),
    [title, description, keyword]
  );

  const previewTitleLines = device === "desktop" ? [result.desktopTitle.text] : result.mobileTitle.lines;
  const previewDescriptionLines =
    device === "desktop" ? result.desktopDescription.lines : result.mobileDescription.lines;
  const isTruncated =
    device === "desktop" ? result.desktopTitle.truncated : result.mobileTitle.truncated;

  return (
    <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-3xl border border-gray-200 bg-gray-50/70 p-6">
        <Field label="SEO title" hint={`${result.titleChars} chars · ${result.titlePixels}px`}>
          <textarea
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="min-h-[96px] w-full rounded-2xl border border-gray-200 bg-white p-4 text-base leading-6 text-gray-700 shadow-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
          />
        </Field>
        <div className="mt-3">
          <LengthMeter value={result.titlePixels} limit={TITLE_PIXEL_LIMIT} warnAt={TITLE_PIXEL_WARN} />
        </div>

        <div className="mt-5">
          <Field label="Target keyword" hint="Optional">
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              className={inputClassName()}
            />
          </Field>
        </div>

        <div className="mt-5">
          <Field label="Meta description" hint={`${result.descriptionChars} chars`}>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-[110px] w-full rounded-2xl border border-gray-200 bg-white p-4 text-sm leading-6 text-gray-700 shadow-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
          </Field>
        </div>

        <div className="mt-5 flex items-center gap-3">
          {(["desktop", "mobile"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDevice(option)}
              className={`rounded-xl border px-4 py-2 text-sm font-medium capitalize transition ${
                device === option
                  ? "border-purple-200 bg-purple-50 text-purple-700"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <MetricCard
          label="Title score"
          value={`${result.score}/100`}
          helper="Every check below is rules-based, so you can see exactly what moved the number."
        />

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Google preview</p>
            <span className={`text-xs font-medium ${isTruncated ? "text-amber-700" : "text-emerald-700"}`}>
              {isTruncated ? "Truncated" : "Fits"}
            </span>
          </div>
          <div
            className={`mt-4 rounded-xl border border-gray-200 bg-white p-4 ${
              device === "mobile" ? "max-w-[380px]" : ""
            }`}
          >
            <p className="text-xs text-gray-600">blog2video.app › tools › seo-title-checker</p>
            <div className="mt-1">
              {previewTitleLines.map((line, index) => (
                <p key={`${line}-${index}`} className="text-xl leading-7 text-[#1a0dab]">
                  {line}
                </p>
              ))}
            </div>
            <div className="mt-1">
              {previewDescriptionLines.map((line, index) => (
                <p key={`${line}-${index}`} className="text-sm leading-5 text-gray-600">
                  {line}
                </p>
              ))}
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-gray-500">
            Pixel widths are measured in Arial to match how Google renders results. Google may still
            rewrite a title it considers a poor match for the query.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-900">Checks</p>
          <ul className="mt-4 space-y-4">
            {result.checks.map((check) => {
              const style = checkStatusStyles[check.status];
              return (
                <li key={check.label} className="flex gap-3">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{check.label}</span>
                      <span className={`text-xs font-semibold ${style.text}`}>{style.label}</span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-gray-600">{check.detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-2xl border border-purple-100 bg-purple-50/60 p-5">
          <p className="text-sm font-semibold text-gray-900">Copy the tested title</p>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            Paste it straight into your CMS title tag field, not the H1 — they are separate.
          </p>
          <div className="mt-4">
            <CopyButton value={title.trim()} label="Copy title" />
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

// ─── Login gate (hard) ───────────────────────────────────────────────────────
// The tool's SEO content (hero, sections, FAQ) always renders via ToolPage, so
// pages stay crawlable. The interactive widget itself is gated: anonymous
// visitors see a sign-in panel and cannot run the tool until they log in.

function errorDetail(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data
    ?.detail;
  return typeof detail === "string" && detail ? detail : fallback;
}

function ToolGate({
  toolName,
  blurb,
  children,
}: {
  toolName: string;
  blurb: string;
  children: React.ReactNode;
}) {
  const { user, login } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <>{children}</>;

  const handleGoogleSuccess = async (response: CredentialResponse) => {
    if (!response.credential) return;
    setSigningIn(true);
    setError(null);
    try {
      const res = await googleLogin(
        response.credential,
        false,
        localStorage.getItem("b2v_ref_code")
      );
      localStorage.removeItem("b2v_ref_code");
      login(res.data.access_token, res.data.user);
      // login() flips `user`, re-rendering this component to show `children`.
    } catch {
      setError("Sign-in failed. Please try again.");
      setSigningIn(false);
    }
  };

  return (
    <div className="rounded-3xl border border-purple-100 bg-gradient-to-b from-purple-50/70 via-white to-white p-8 text-center sm:p-12">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-100 bg-white">
        <svg
          className="h-6 w-6 text-purple-600"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      </div>
      <h2 className="mt-5 text-2xl font-semibold text-gray-900">
        Sign in to use the {toolName}
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-gray-500">
        {blurb} Create a free Blog2Video account to run it — no credit card required.
      </p>
      <div className="mt-7 flex justify-center">
        {signingIn ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <svg className="h-4 w-4 animate-spin text-purple-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Signing you in…
          </div>
        ) : (
          <GoogleAuthButton
            onSuccess={handleGoogleSuccess}
            onError={() => setError("Sign-in failed. Please try again.")}
            text="continue_with"
            width="320"
          />
        )}
      </div>
      {error ? <p className="mt-3 text-xs text-red-500">{error}</p> : null}
    </div>
  );
}

// ─── Shared generation-quota state + UI ──────────────────────────────────────

/** Tracks a tool's remaining generations. Seeded from the server on mount so the
 *  count and the disabled state are correct before the first generation, then
 *  updated from each generation response. */
function useToolQuota(tool: ToolKey) {
  const [quota, setQuota] = useState<{ used: number; limit: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchToolQuotas()
      .then((res) => {
        const q = res.data?.quotas?.[tool];
        if (!cancelled && q) setQuota({ used: q.used, limit: q.limit });
      })
      // Non-fatal: the generation call still enforces the limit server-side.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [tool]);
  return [quota, setQuota] as const;
}

// ─── Shared generation-quota UI ──────────────────────────────────────────────

/** Remaining-generations line shown under a tool's generate button.
 *  Every plan has a finite allowance: FREE allowances are lifetime, paid ones
 *  refresh each billing period — so the upgrade prompt only shows for FREE. */
function ToolQuotaLine({
  quota,
  noun,
}: {
  quota: { used: number; limit: number } | null;
  noun: string;
}) {
  const { user } = useAuth();
  if (!quota) return null;
  const left = Math.max(quota.limit - quota.used, 0);
  const exhausted = left <= 0;
  const isFree = !isPaidPlan(user?.plan);
  return (
    <p className="mt-3 text-xs font-medium text-gray-500">
      {left} of {quota.limit} {noun} left
      {exhausted && isFree ? (
        <>
          {" · "}
          <Link to="/pricing" className="text-purple-600 hover:text-purple-700">
            Upgrade for more
          </Link>
        </>
      ) : null}
      {exhausted && !isFree ? " · resets at your next renewal" : null}
    </p>
  );
}

// ─── Video Script Generator ──────────────────────────────────────────────────

const SCRIPT_TONES = ["explainer", "promotional", "storytelling", "casual"] as const;
const SCRIPT_LENGTHS = ["short", "medium", "long"] as const;

function VideoScriptGeneratorInner() {
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<(typeof SCRIPT_TONES)[number]>("explainer");
  const [length, setLength] = useState<(typeof SCRIPT_LENGTHS)[number]>("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ title: string; script: string } | null>(null);
  const [quota, setQuota] = useToolQuota("video_script");

  const exhausted = quota != null && quota.used >= quota.limit;
  const canSubmit = topic.trim().length >= 3 && !loading && !exhausted;

  const handleGenerate = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const res = await generateVideoScript(topic.trim(), tone, length);
      setResult({ title: res.data.video_title, script: res.data.script_markdown });
      setQuota({ used: res.data.used, limit: res.data.limit });
    } catch (err) {
      setError(errorDetail(err, "Generation failed. Please try again in a moment."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-3xl border border-gray-200 bg-gray-50/70 p-6">
        <Field label="Topic, blog URL, or notes">
          <textarea
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="e.g. How to turn a blog post into a narrated video — or paste an article URL"
            className="min-h-[140px] w-full rounded-2xl border border-gray-200 bg-white p-4 text-sm leading-6 text-gray-700 shadow-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
          />
        </Field>
        <div className="mt-5">
          <Field label="Tone">
            <div className="grid grid-cols-2 gap-3">
              {SCRIPT_TONES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setTone(option)}
                  className={`rounded-2xl border px-4 py-3 text-sm font-medium capitalize transition ${
                    tone === option
                      ? "border-purple-200 bg-purple-50 text-purple-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <div className="mt-5">
          <Field label="Length">
            <div className="grid grid-cols-3 gap-3">
              {SCRIPT_LENGTHS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setLength(option)}
                  className={`rounded-2xl border px-4 py-3 text-sm font-medium capitalize transition ${
                    length === option
                      ? "border-purple-200 bg-purple-50 text-purple-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canSubmit}
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-purple-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Generating…" : exhausted ? "Generations used up" : "Generate script"}
        </button>
        <ToolQuotaLine quota={quota} noun="scripts" />
        {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
      </div>

      <div className="space-y-4">
        {result ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-600">
                  Suggested title
                </p>
                <h3 className="mt-1 text-lg font-semibold text-gray-900">{result.title}</h3>
              </div>
              <div className="flex flex-shrink-0 gap-2">
                <CopyButton value={`${result.title}\n\n${result.script}`} label="Copy" />
              </div>
            </div>
            <pre className="mt-5 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-xl border border-gray-100 bg-gray-50 p-4 font-sans text-sm leading-6 text-gray-700">
              {result.script}
            </pre>
            <div className="mt-4">
              <Link
                to="/blog-to-video"
                className="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-5 py-2.5 text-sm font-semibold text-purple-700 transition hover:bg-purple-100"
              >
                Turn this script into a video →
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
            <p className="max-w-sm text-sm leading-relaxed text-gray-400">
              Your scene-by-scene script — hook, ordered beats, and a closing call to action —
              will appear here once you generate it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function VideoScriptGeneratorWidget() {
  return (
    <ToolGate
      toolName="Video Script Generator"
      blurb="Turn any topic, blog URL, or notes into a scene-by-scene script with a hook, beats, and a call to action."
    >
      <VideoScriptGeneratorInner />
    </ToolGate>
  );
}

// ─── Thumbnail Text Generator ────────────────────────────────────────────────

function ThumbnailTextGeneratorInner() {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [quota, setQuota] = useToolQuota("thumbnail_text");

  const exhausted = quota != null && quota.used >= quota.limit;
  const canSubmit = topic.trim().length >= 3 && !loading && !exhausted;

  const handleGenerate = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const res = await generateThumbnailText(topic.trim());
      setOptions(res.data.options);
      setQuota({ used: res.data.used, limit: res.data.limit });
    } catch (err) {
      setError(errorDetail(err, "Generation failed. Please try again in a moment."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-3xl border border-gray-200 bg-gray-50/70 p-6">
        <Field label="Video topic or title">
          <textarea
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="e.g. I turned one blog post into 30 days of video content"
            className="min-h-[120px] w-full rounded-2xl border border-gray-200 bg-white p-4 text-sm leading-6 text-gray-700 shadow-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
          />
        </Field>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canSubmit}
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-purple-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Generating…" : exhausted ? "Generations used up" : "Generate thumbnail text"}
        </button>
        <ToolQuotaLine quota={quota} noun="generations" />
        {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
        <p className="mt-4 text-xs leading-relaxed text-gray-400">
          Thumbnail text is the short overlay on the image — not the video title. Keep the winner
          to five words or fewer.
        </p>
      </div>

      <div className="space-y-3">
        {options.length ? (
          options.map((option) => (
            <div
              key={option}
              className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <span className="text-base font-semibold uppercase tracking-tight text-gray-900">
                {option}
              </span>
              <CopyButton value={option} />
            </div>
          ))
        ) : (
          <div className="flex h-full min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
            <p className="max-w-sm text-sm leading-relaxed text-gray-400">
              Up to eight short, high-CTR thumbnail overlays — across curiosity, bold-claim, number,
              and benefit angles — will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ThumbnailTextGeneratorWidget() {
  return (
    <ToolGate
      toolName="Thumbnail Text Generator"
      blurb="Generate short, high-CTR thumbnail overlays for your video across several proven angles."
    >
      <ThumbnailTextGeneratorInner />
    </ToolGate>
  );
}

// ─── YouTube Description Generator ───────────────────────────────────────────

function YouTubeDescriptionGeneratorInner() {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ description: string; tags: string[] } | null>(null);
  const [quota, setQuota] = useToolQuota("youtube_description");

  const exhausted = quota != null && quota.used >= quota.limit;
  const canSubmit = topic.trim().length >= 3 && !loading && !exhausted;

  const handleGenerate = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const res = await generateYouTubeDescription(topic.trim());
      setResult({ description: res.data.description, tags: res.data.tags });
      setQuota({ used: res.data.used, limit: res.data.limit });
    } catch (err) {
      setError(errorDetail(err, "Generation failed. Please try again in a moment."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-3xl border border-gray-200 bg-gray-50/70 p-6">
        <Field label="Video topic, title, or transcript">
          <textarea
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="Paste your video topic, title, or full transcript for the most accurate description"
            className="min-h-[180px] w-full rounded-2xl border border-gray-200 bg-white p-4 text-sm leading-6 text-gray-700 shadow-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
          />
        </Field>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canSubmit}
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-purple-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Generating…" : exhausted ? "Generations used up" : "Generate description"}
        </button>
        <ToolQuotaLine quota={quota} noun="descriptions" />
        {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
      </div>

      <div className="space-y-4">
        {result ? (
          <>
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-600">
                  Description
                </p>
                <CopyButton value={result.description} />
              </div>
              <pre className="mt-4 max-h-[360px] overflow-auto whitespace-pre-wrap rounded-xl border border-gray-100 bg-gray-50 p-4 font-sans text-sm leading-6 text-gray-700">
                {result.description}
              </pre>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-600">
                  Tags
                </p>
                <CopyButton value={result.tags.join(", ")} label="Copy all" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {result.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
            <p className="max-w-sm text-sm leading-relaxed text-gray-400">
              A keyword-front-loaded description and a ready-to-paste set of tags will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function YouTubeDescriptionGeneratorWidget() {
  return (
    <ToolGate
      toolName="YouTube Description Generator"
      blurb="Generate an SEO-optimized YouTube description and a set of relevant tags from your topic or transcript."
    >
      <YouTubeDescriptionGeneratorInner />
    </ToolGate>
  );
}

// ─── Video Length Calculator ─────────────────────────────────────────────────
// Pure client-side arithmetic, but still hard-gated behind login for
// consistency with the other free tools.

const NARRATION_SPEEDS = [
  { key: "slow", label: "Slow", wpm: 120, helper: "Calm, deliberate narration" },
  { key: "normal", label: "Normal", wpm: 140, helper: "Typical explainer pacing" },
  { key: "fast", label: "Fast", wpm: 160, helper: "Energetic, high-tempo edit" },
] as const;

function formatRuntime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function VideoLengthCalculatorInner() {
  const [text, setText] = useState("");

  const wordCount = useMemo(() => {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter(Boolean).length;
  }, [text]);

  return (
    <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-3xl border border-gray-200 bg-gray-50/70 p-6">
        <Field label="Paste your script" hint={`${formatNumber(wordCount)} words`}>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Paste your script here to estimate its spoken runtime…"
            className="min-h-[220px] w-full rounded-2xl border border-gray-200 bg-white p-4 text-sm leading-6 text-gray-700 shadow-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
          />
        </Field>
        <p className="mt-4 text-xs leading-relaxed text-gray-400">
          The estimate counts spoken words only. Pauses, music, transitions, and on-screen beats
          add time on top — leave a buffer when planning to a hard runtime.
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {NARRATION_SPEEDS.map((speed) => (
            <MetricCard
              key={speed.key}
              label={speed.label}
              value={wordCount ? formatRuntime((wordCount / speed.wpm) * 60) : "—"}
              helper={`${speed.helper} · ${speed.wpm} wpm`}
            />
          ))}
        </div>
        <div className="rounded-2xl border border-purple-100 bg-purple-50/60 p-5">
          <p className="text-sm font-semibold text-gray-900">Planning targets</p>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-gray-600">
            <li className="flex gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-purple-500" />
              <span>A 60-second Short fits roughly 130-160 spoken words.</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-purple-500" />
              <span>Trim to length in the script, not in the edit — it is far faster.</span>
            </li>
          </ul>
          <div className="mt-4">
            <Link
              to="/tools/video-script-generator"
              className="inline-flex items-center rounded-full border border-purple-200 bg-white px-5 py-2.5 text-sm font-semibold text-purple-700 transition hover:bg-purple-100"
            >
              Need a script first? Generate one →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function VideoLengthCalculatorWidget() {
  return (
    <ToolGate
      toolName="Video Length Calculator"
      blurb="Estimate your video runtime from a script or word count across slow, normal, and fast narration speeds."
    >
      <VideoLengthCalculatorInner />
    </ToolGate>
  );
}

// ─── Book Cover Generator ────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function BookCoverGeneratorInner() {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<null | "png" | "jpeg" | "pdf">(null);
  const [error, setError] = useState<string | null>(null);
  const [pngDataUrl, setPngDataUrl] = useState<string | null>(null);
  const [quota, setQuota] = useToolQuota("book_cover");

  const wordCount = useMemo(() => {
    const trimmed = description.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter(Boolean).length;
  }, [description]);

  const exhausted =
    quota != null && quota.used >= quota.limit;
  const canSubmit = description.trim().length >= 20 && !loading && !exhausted;

  const handleGenerate = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const res = await generateBookCover(description.trim());
      setPngDataUrl(`data:image/png;base64,${res.data.image_base64}`);
      setQuota({
        used: res.data.covers_used,
        limit: res.data.covers_limit ?? quota?.limit ?? 0,
      });
    } catch (err) {
      setError(errorDetail(err, "Generation failed. Please try again in a moment."));
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: "png" | "jpeg" | "pdf") => {
    if (!pngDataUrl) return;
    setExporting(format);
    try {
      if (format === "png") {
        triggerDownload(pngDataUrl, "book-cover.png");
      } else if (format === "jpeg") {
        const img = await loadImage(pngDataUrl);
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas unavailable");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        triggerDownload(canvas.toDataURL("image/jpeg", 0.92), "book-cover.jpg");
      } else {
        const img = await loadImage(pngDataUrl);
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF({
          orientation: w > h ? "landscape" : "portrait",
          unit: "px",
          format: [w, h],
        });
        pdf.addImage(pngDataUrl, "PNG", 0, 0, w, h);
        pdf.save("book-cover.pdf");
      }
    } catch {
      setError("Export failed. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-3xl border border-gray-200 bg-gray-50/70 p-6">
        <Field label="Describe your book" hint={`${formatNumber(wordCount)} words`}>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe your book in ~200 words — genre, mood, central idea or character, and any imagery you'd like on the cover…"
            className="min-h-[240px] w-full rounded-2xl border border-gray-200 bg-white p-4 text-sm leading-6 text-gray-700 shadow-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
          />
        </Field>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canSubmit}
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-purple-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? "Generating cover…"
            : exhausted
              ? "Covers used up"
              : pngDataUrl
                ? "Regenerate cover"
                : "Generate book cover"}
        </button>
        <ToolQuotaLine
          quota={quota}
          noun="covers"
        />
        {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
        <p className="mt-4 text-xs leading-relaxed text-gray-400">
          Generation can take up to a minute. The cover is a design starting point — replace any AI
          title text with your own typography before publishing. Free accounts include 5 covers.
        </p>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex h-full min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <svg className="h-5 w-5 animate-spin text-purple-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Designing your cover…
            </div>
          </div>
        ) : pngDataUrl ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex justify-center">
              <img
                src={pngDataUrl}
                alt="Generated book cover"
                className="max-h-[520px] w-auto rounded-xl border border-gray-100 shadow-md"
              />
            </div>
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-purple-600">
                Export
              </p>
              <div className="flex flex-wrap gap-2">
                {(["png", "jpeg", "pdf"] as const).map((format) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => handleExport(format)}
                    disabled={exporting !== null}
                    className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {exporting === format ? "Preparing…" : `Download ${format.toUpperCase()}`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
            <p className="max-w-sm text-sm leading-relaxed text-gray-400">
              Your AI-designed book cover will appear here in classic 2:3 portrait proportions, ready
              to export as PNG, JPEG, or a print-ready PDF.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function BookCoverGeneratorWidget() {
  return (
    <ToolGate
      toolName="Book Cover Generator"
      blurb="Describe your book and generate a professional AI cover you can export as PNG, JPEG, or PDF."
    >
      <BookCoverGeneratorInner />
    </ToolGate>
  );
}

export function ToolWidget({ slug }: ToolWidgetProps) {
  switch (slug) {
    case "content-repurposing-calculator":
      return <ContentRepurposingCalculator />;
    case "medium-partner-program-earnings-calculator":
      return <MediumCalculator />;
    case "substack-revenue-calculator":
      return <SubstackRevenueCalculator />;
    case "substack-valuation-calculator":
      return <SubstackValuationTool />;
    case "markdown-to-medium-substack-formatter":
      return <MarkdownFormatter />;
    case "headline-analyzer":
      return <HeadlineAnalyzer />;
    case "seo-title-checker":
      return <SeoTitleChecker />;
    case "quote-card-generator":
      return <QuoteCardGenerator />;
    case "stock-visualizer":
      return <StockVisualizer />;
    case "video-script-generator":
      return <VideoScriptGeneratorWidget />;
    case "thumbnail-text-generator":
      return <ThumbnailTextGeneratorWidget />;
    case "youtube-description-generator":
      return <YouTubeDescriptionGeneratorWidget />;
    case "video-length-calculator":
      return <VideoLengthCalculatorWidget />;
    case "book-cover-generator":
      return <BookCoverGeneratorWidget />;
    case "pdf-to-video-converter":
      return <PdfToVideoConverter />;
    default:
      return null;
  }
}
