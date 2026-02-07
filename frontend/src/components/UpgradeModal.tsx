import { useState } from "react";
import { createCheckoutSession } from "../api/client";
import { useAuth } from "../hooks/useAuth";

interface Props {
  open: boolean;
  onClose: () => void;
  feature: string; // e.g. "AI Chat Editor", "Remotion Studio"
}

export default function UpgradeModal({ open, onClose, feature }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleUpgrade = async () => {
    if (!user) {
      // Not logged in — send to pricing page
      window.location.href = "/pricing";
      return;
    }
    setLoading(true);
    try {
      const res = await createCheckoutSession();
      window.location.href = res.data.checkout_url;
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 animate-in fade-in zoom-in">
        {/* close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* content */}
        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-purple-50 flex items-center justify-center">
            <svg className="w-7 h-7 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Upgrade to Pro
          </h3>

          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            <span className="font-medium text-gray-700">{feature}</span> is a Pro feature.
            Upgrade to unlock it along with 100 videos/month, full Remotion Studio access, and AI chat editing.
          </p>

          <div className="glass-card p-4 mb-6 text-left">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-sm font-medium text-gray-900">Pro plan</span>
              <span className="text-lg font-bold text-gray-900">$50<span className="text-xs font-normal text-gray-400">/month</span></span>
            </div>
            <p className="text-[11px] text-gray-400 mb-3">or $40/mo billed annually (save 20%)</p>
            <ul className="space-y-2">
              {[
                "100 videos per month",
                "AI chat editor",
                "Full Remotion Studio access",
                "Priority support",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs text-gray-600">
                  <svg className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full py-3 px-4 rounded-lg text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors disabled:opacity-60"
          >
            {loading ? "Redirecting to checkout..." : "Upgrade now"}
          </button>

          <button
            onClick={onClose}
            className="mt-3 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
