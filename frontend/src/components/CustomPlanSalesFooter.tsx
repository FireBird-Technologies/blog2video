import { Link } from "react-router-dom";

interface Props {
  className?: string;
}

export default function CustomPlanSalesFooter({ className = "" }: Props) {
  return (
    <div
      className={`rounded-2xl border border-gray-200 bg-white px-5 py-4 sm:px-6 sm:py-5 shadow-sm ${className}`.trim()}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm sm:text-base font-semibold text-gray-900">
            Need a custom plan?
          </p>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Enterprise volume, custom limits, and team pricing — we&apos;ll tailor a plan for you.
          </p>
        </div>
        <Link
          to="/contact"
          className="shrink-0 inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors shadow-[0_4px_14px_-4px_rgba(124,58,237,0.55)]"
        >
          Talk to sales
        </Link>
      </div>
    </div>
  );
}
