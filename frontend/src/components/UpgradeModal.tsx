import { useState } from "react";
import ReactDOM from "react-dom";
import { createCheckoutSession, createPerVideoCheckout } from "../api/client";
import { useAuth } from "../hooks/useAuth";

interface Props {
  open: boolean;
  onClose: () => void;
  feature: string; // e.g. "AI Chat Editor", "Remotion Studio"
  projectId?: number; // If provided, show per-video option
  onPurchased?: () => void; // Called after returning from checkout
}

export default function UpgradeModal({
  open,
  onClose,
  feature,
  projectId,
  onPurchased,
}: Props) {
  const { user } = useAuth();
  const [loadingPro, setLoadingPro] = useState(false);
  const [loadingVideo, setLoadingVideo] = useState(false);

  if (!open) return null;

  const handleUpgradePro = async () => {
    if (!user) {
      window.location.href = "/pricing";
      return;
    }
    setLoadingPro(true);
    try {
      const res = await createCheckoutSession();
      window.location.href = res.data.checkout_url;
    } catch {
      setLoadingPro(false);
    }
  };

  const handleBuyVideo = async () => {
    if (!user) {
      window.location.href = "/pricing";
      return;
    }
    if (!projectId) {
      window.location.href = "/pricing";
      return;
    }
    setLoadingVideo(true);
    try {
      const res = await createPerVideoCheckout(projectId);
      window.location.href = res.data.checkout_url;
    } catch {
      setLoadingVideo(false);
    }
  };

  const anyLoading = loadingPro || loadingVideo;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-8 animate-in fade-in zoom-in">
        {/* close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* content */}
        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-purple-50 flex items-center justify-center">
            <svg
              className="w-7 h-7 text-purple-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>

          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Unlock {feature}
          </h3>

          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            Choose how you want to unlock{" "}
            <span className="font-medium text-gray-700">{feature}</span>.
          </p>

          {/* Two-option layout */}
          <div className="grid gap-3 mb-6 grid-cols-2">
            {/* Per-video option */}
            <div className="glass-card p-4 text-left border border-gray-200 hover:border-purple-200 transition-colors rounded-xl">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Premium access
                  </span>
                  <span className="text-lg font-bold text-gray-900">
                    $5
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mb-3 leading-relaxed">
                  Get premium access for this video and the next.
                  One-time payment — no subscription needed.
                </p>
                <ul className="space-y-1.5 mb-4">
                  {[
                    "Remotion Studio access",
                    "AI chat editor",
                    "Download project files",
                    "No subscription needed",
                  ].map((f) => (
                    <li
                      key={f}
                      className="flex items-center gap-1.5 text-[11px] text-gray-600"
                    >
                      <svg
                        className="w-3 h-3 text-purple-500 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={handleBuyVideo}
                  disabled={anyLoading}
                  className="w-full py-2 px-3 rounded-lg text-xs font-medium bg-gray-900 hover:bg-gray-800 text-white transition-colors disabled:opacity-60"
                >
                  {loadingVideo ? "Redirecting..." : "Get premium access — $5"}
                </button>
              </div>

            {/* Pro subscription option */}
            <div className="glass-card p-4 text-left border-2 border-purple-200 rounded-xl relative">
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                <span className="px-2.5 py-0.5 bg-purple-600 text-white text-[9px] font-semibold rounded-full">
                  Best value
                </span>
              </div>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pro plan
                </span>
                <div className="text-right">
                  <span className="text-lg font-bold text-gray-900">$50</span>
                  <span className="text-[10px] text-gray-400">/mo</span>
                </div>
              </div>
              <p className="text-[11px] text-gray-400 mb-3 leading-relaxed">
                100 videos/month. All features. $40/mo if billed annually.
              </p>
              <ul className="space-y-1.5 mb-4">
                {[
                  "100 videos per month",
                  "AI chat editor",
                  "Remotion Studio on all videos",
                  "Priority support",
                ].map((f) => (
                  <li
                    key={f}
                    className="flex items-center gap-1.5 text-[11px] text-gray-600"
                  >
                    <svg
                      className="w-3 h-3 text-purple-500 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={handleUpgradePro}
                disabled={anyLoading}
                className="w-full py-2 px-3 rounded-lg text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors disabled:opacity-60"
              >
                {loadingPro ? "Redirecting..." : "Upgrade to Pro"}
              </button>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
