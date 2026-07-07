import type { FaqItem } from "./seoTypes";

export interface PricingPlan {
  id: string;
  name: string;
  tagline: string;
  monthlyPrice: number | null;
  annualMonthlyPrice: number | null;
  annualTotalPrice: number | null;
  videoLimit: number | null;
  videoLimitLabel: string;
  featuresIncluded: string[];
  featuresExcluded: string[];
  notes: string[];
}

export interface PricingPage {
  path: string;
  title: string;
  description: string;
  primaryKeyword: string;
  keywordVariant: string;
  relatedPaths: string[];
  plans: PricingPlan[];
  faq: FaqItem[];
}
