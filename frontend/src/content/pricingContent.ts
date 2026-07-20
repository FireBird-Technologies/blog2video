import {
  CASUAL_PRICE_CENTS,
  PACK_PRICE_CENTS,
  BULK_PRICE_CENTS,
  CASUAL_ZONE_END,
  PACK_ZONE_END,
  BULK_TIER_START_QTY,
} from "../lib/perVideoPricing";
import type { FaqItem } from "./seoTypes";
import type { PricingPage, PricingPlan } from "./pricingTypes";

// ── Subscription prices ───────────────────────────────────────────────────────
export const STANDARD_MONTHLY_PRICE = 34.99;
export const STANDARD_ANNUAL_MONTHLY_PRICE = 27.99;
export const STANDARD_ANNUAL_TOTAL_PRICE = 335.88; // $27.99 × 12

export const PRO_MONTHLY_PRICE = 59.99;
export const PRO_ANNUAL_MONTHLY_PRICE = 47.99;
export const PRO_ANNUAL_TOTAL_PRICE = 575.88; // $47.99 × 12

// Per-video cost per unit at Pro scale (for callout copy)
export const PRO_COST_PER_VIDEO_MONTHLY = (PRO_MONTHLY_PRICE / 100).toFixed(2);
export const PRO_COST_PER_VIDEO_ANNUAL  = (PRO_ANNUAL_MONTHLY_PRICE / 100).toFixed(2);

// ── Custom-template counts per plan ──────────────────────────────────────────
export const FREE_CUSTOM_TEMPLATE_COUNT = 1;
export const STANDARD_CUSTOM_TEMPLATE_COUNT = 5;
export const PRO_CUSTOM_TEMPLATE_COUNT = 20;

// AI-assisted edits granted per purchased video. These accumulate into a single
// per-user pool usable across ALL of the user's videos/projects (buy 4 → 80 shared
// credits), not a per-video cap. Keep in sync with the backend AI_EDIT_CREDITS_PER_VIDEO.
export const AI_EDITS_PER_VIDEO = 20;

// ── Per-video tiers (re-exported for convenience) ────────────────────────────
export const PER_VIDEO_CASUAL_PRICE  = CASUAL_PRICE_CENTS / 100;   // 4.00
export const PER_VIDEO_PACK_PRICE    = PACK_PRICE_CENTS / 100;     // 3.00
export const PER_VIDEO_BULK_PRICE    = BULK_PRICE_CENTS / 100;     // 2.80
export const PER_VIDEO_CASUAL_MAX    = CASUAL_ZONE_END;             // 9
export const PER_VIDEO_PACK_MAX      = PACK_ZONE_END;              // 30
export const PER_VIDEO_BULK_MIN      = BULK_TIER_START_QTY;        // 31

// ── Shared feature lists ─────────────────────────────────────────────────────
// Shared across paid plans, minus the custom-template bullet — that count
// differs per plan (Standard ≠ Pro), so each plan adds its own line below.
export const COMMON_PAID_FEATURES = [
  "AI script generation",
  "ElevenLabs voiceover",
  "Render & download MP4",
  "Unlimited AI edit & image generation",
  "Premium voiceover + cloning",
] as const;

// Per-video buyers get the same features as subscribers EXCEPT AI edits are a
// fixed per-video pool (20/video), not unlimited.
export const PER_VIDEO_FEATURES = [
  "AI script generation",
  "ElevenLabs voiceover",
  "Render & download MP4",
  `${AI_EDITS_PER_VIDEO} AI edits per video, usable across all videos`,
] as const;

export const FREE_FEATURES_INCLUDED = [
  "2 videos free",
  "AI script generation",
  "ElevenLabs voiceover",
  "Remotion video preview",
  "Render & download MP4",
  `${FREE_CUSTOM_TEMPLATE_COUNT} custom video template`,
] as const;

export const FREE_FEATURES_EXCLUDED = [
  "Unlimited AI edit & image generation",
  "Premium voiceover + cloning",
] as const;

export const SUBSCRIPTION_FEATURES = [
  "Remotion video preview",
  "Priority support",
  ...COMMON_PAID_FEATURES,
] as const;

export const ENTERPRISE_FEATURES = [
  "Custom video limits",
  ...COMMON_PAID_FEATURES,
  "Custom video templates",
  "Remotion video preview",
  "Priority support",
  "Custom integrations",
  "Dedicated support",
  "SSO & enterprise security",
  "On-prem deployment available",
  "Custom pricing",
] as const;

// ── Plans ────────────────────────────────────────────────────────────────────
export const pricingPlans: PricingPlan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Try it out",
    monthlyPrice: 0,
    annualMonthlyPrice: null,
    annualTotalPrice: null,
    videoLimit: 2,
    videoLimitLabel: "2 videos free (lifetime)",
    featuresIncluded: [...FREE_FEATURES_INCLUDED],
    featuresExcluded: [...FREE_FEATURES_EXCLUDED],
    notes: ["No credit card required"],
  },
  {
    id: "per_video",
    name: "Pay Per Video",
    tagline: "No subscription required",
    monthlyPrice: null,
    annualMonthlyPrice: null,
    annualTotalPrice: null,
    videoLimit: null,
    videoLimitLabel: "Buy as many as you need",
    featuresIncluded: ["No subscription needed", ...PER_VIDEO_FEATURES],
    featuresExcluded: [
      "Unlimited AI edit & image generation",
      "Custom video templates",
      "Premium voiceover + cloning",
    ],
    notes: [
      `1–${PER_VIDEO_CASUAL_MAX} videos: $${PER_VIDEO_CASUAL_PRICE.toFixed(2)}/video`,
      `${PER_VIDEO_CASUAL_MAX + 1}–${PER_VIDEO_PACK_MAX} videos: $${PER_VIDEO_PACK_PRICE.toFixed(2)}/video (pack tier)`,
      `${PER_VIDEO_BULK_MIN}+ videos: $${PER_VIDEO_BULK_PRICE.toFixed(2)}/video (bulk tier)`,
      "In-app upgrade modal shows $5 for premium access on 2 videos",
      "Upgrade plan modal shows $3/video starting price",
    ],
  },
  {
    id: "standard",
    name: "Standard",
    tagline: "All features, 30 videos/month",
    monthlyPrice: STANDARD_MONTHLY_PRICE,
    annualMonthlyPrice: STANDARD_ANNUAL_MONTHLY_PRICE,
    annualTotalPrice: STANDARD_ANNUAL_TOTAL_PRICE,
    videoLimit: 30,
    videoLimitLabel: "30 videos per month",
    featuresIncluded: [
      "30 videos per month",
      `${STANDARD_CUSTOM_TEMPLATE_COUNT} custom video templates`,
      ...SUBSCRIPTION_FEATURES,
    ],
    featuresExcluded: [],
    notes: [
      `$${STANDARD_MONTHLY_PRICE}/mo monthly or $${STANDARD_ANNUAL_MONTHLY_PRICE}/mo billed annually ($${STANDARD_ANNUAL_TOTAL_PRICE}/year, save 20%)`,
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "For serious content creators — Best value",
    monthlyPrice: PRO_MONTHLY_PRICE,
    annualMonthlyPrice: PRO_ANNUAL_MONTHLY_PRICE,
    annualTotalPrice: PRO_ANNUAL_TOTAL_PRICE,
    videoLimit: 100,
    videoLimitLabel: "100 videos per month",
    featuresIncluded: [
      "100 videos per month",
      `${PRO_CUSTOM_TEMPLATE_COUNT} custom video templates`,
      ...SUBSCRIPTION_FEATURES,
    ],
    featuresExcluded: [],
    notes: [
      `$${PRO_MONTHLY_PRICE}/mo monthly or $${PRO_ANNUAL_MONTHLY_PRICE}/mo billed annually ($${PRO_ANNUAL_TOTAL_PRICE}/year, save 20%)`,
      `$${PRO_COST_PER_VIDEO_MONTHLY}/video (monthly) or $${PRO_COST_PER_VIDEO_ANNUAL}/video (annual) — 10x cheaper than pay-per-video at scale`,
    ],
  },
  {
    id: "enterprise",
    name: "Customized",
    tagline: "Enterprise & teams",
    monthlyPrice: null,
    annualMonthlyPrice: null,
    annualTotalPrice: null,
    videoLimit: null,
    videoLimitLabel: "Custom video limits",
    featuresIncluded: [...ENTERPRISE_FEATURES],
    featuresExcluded: [],
    notes: ["Contact sales at /contact"],
  },
];

// ── FAQ ───────────────────────────────────────────────────────────────────────
export const pricingFaq: FaqItem[] = [
  {
    question: "How long can my videos be?",
    answer:
      "There's no time limit. Videos are as long as the blog post requires — a 3,000-word article might produce a 5–8 minute video.",
  },
  {
    question: "What's the difference between per-video and Pro?",
    answer: `Per-video is pay-as-you-go at $${PER_VIDEO_CASUAL_PRICE.toFixed(2)} each — great if you only make a few. Pro at $${PRO_MONTHLY_PRICE}/month gives you 100 videos plus unlimited AI edit & image generation. If you make 10+ videos/month, Pro is the clear winner.`,
  },
  {
    question: "How does annual billing work?",
    answer: `Choose annual billing and pay $${PRO_ANNUAL_TOTAL_PRICE}/year ($${PRO_ANNUAL_MONTHLY_PRICE}/month) instead of $${PRO_MONTHLY_PRICE * 12}/year — that's a 20% discount. Standard annual is $${STANDARD_ANNUAL_TOTAL_PRICE}/year ($${STANDARD_ANNUAL_MONTHLY_PRICE}/month) instead of $${STANDARD_MONTHLY_PRICE * 12}/year.`,
  },
  {
    question: "Can I edit the video after generation?",
    answer:
      `Free users get 6 AI-assisted edits, shared across all your projects. Regenerating a scene's voiceover costs 3 edits; other edits cost 1. Each video you buy adds ${AI_EDITS_PER_VIDEO} AI edits to the same pool (buy 4 → +80). Pro and Standard subscribers get unlimited AI edit & image generation.`,
  },
  {
    question: "What voices are available?",
    answer:
      "Four documentary-quality ElevenLabs voices: male British, male American, female British, and female American. Premium voiceover + cloning is available on paid plans.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes. Cancel your subscription anytime through the billing portal. You keep access until the end of your billing period.",
  },
  {
    question: "How much does Blog2Video cost?",
    answer: `Free plan: $0 (2 videos). Pay per video: $${PER_VIDEO_CASUAL_PRICE.toFixed(2)}–$${PER_VIDEO_BULK_PRICE.toFixed(2)}/video. Standard: $${STANDARD_MONTHLY_PRICE}/mo (or $${STANDARD_ANNUAL_MONTHLY_PRICE}/mo annually). Pro: $${PRO_MONTHLY_PRICE}/mo (or $${PRO_ANNUAL_MONTHLY_PRICE}/mo annually). Enterprise: custom pricing.`,
  },
  {
    question: "What is included in the free plan?",
    answer: `The free plan includes 2 videos, AI script generation, ElevenLabs voiceover, Remotion video preview, render & download MP4, and custom video templates. Unlimited AI edit & image generation and premium voiceover + cloning require a paid plan.`,
  },
  {
    question: "How do I upgrade my plan?",
    answer:
      "Go to /pricing and click Upgrade to Standard or Upgrade to Pro. You can also upgrade from inside any project by clicking the upgrade prompt. Checkout is handled via Stripe.",
  },
  {
    question: "What is the Enterprise plan?",
    answer:
      "The Customized / Enterprise plan offers custom video limits, all Pro features, custom integrations, dedicated support, SSO & enterprise security, and on-prem deployment. Contact sales at /contact.",
  },
];

// ── Full pricing page definition (used by SEO corpus exporter) ───────────────
export const pricingPage: PricingPage = {
  path: "/pricing",
  title: "Blog2Video Pricing — Free, Pay Per Video, Standard, Pro, Enterprise",
  description:
    "Blog2Video pricing for free, pay-as-you-go, Standard, Pro, and custom team plans.",
  primaryKeyword: "blog2video pricing",
  keywordVariant: "video AI tool pricing plans cost",
  relatedPaths: ["/pricing"],
  plans: pricingPlans,
  faq: pricingFaq,
};
