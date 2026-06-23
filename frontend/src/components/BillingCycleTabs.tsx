import type { BillingCycle } from "../api/billing";

interface Props {
  active: BillingCycle;
  onChange: (next: BillingCycle) => void;
}

const TABS: { id: BillingCycle; label: string }[] = [
  { id: "monthly", label: "Monthly" },
  { id: "annual", label: "Annual" },
  { id: "lifetime", label: "Lifetime" },
];

/**
 * Pill-style Monthly / Annual / Lifetime selector for the pricing & subscription
 * pages. Mirrors the styling of the project-page tab strip (ProjectTabs) but is
 * typed to BillingCycle rather than ProjectTabId.
 */
export default function BillingCycleTabs({ active, onChange }: Props) {
  return (
    <div className="flex gap-1 p-1 bg-gray-100/60 rounded-xl w-fit">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`px-3 sm:px-4 py-1.5 text-xs font-medium rounded-lg transition-all text-center ${
            active === tab.id
              ? "bg-white text-gray-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
