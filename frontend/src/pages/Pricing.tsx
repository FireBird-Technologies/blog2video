import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin, CredentialResponse } from "@react-oauth/google";
import { googleLogin, createCheckoutSession } from "../api/client";
import { useAuth } from "../hooks/useAuth";

export default function Pricing() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [authError, setAuthError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">(
    "monthly"
  );

  const handleGoogleSuccess = async (response: CredentialResponse) => {
    if (!response.credential) return;
    setAuthError(null);
    try {
      const res = await googleLogin(response.credential);
      login(res.data.access_token, res.data.user);
      navigate("/dashboard");
    } catch (err: any) {
      setAuthError(
        err?.response?.data?.detail ||
          "Authentication failed. Please try again."
      );
    }
  };

  const handleUpgrade = async () => {
    if (!user) return;
    setCheckoutLoading(true);
    try {
      const res = await createCheckoutSession(billingCycle);
      window.location.href = res.data.checkout_url;
    } catch {
      setCheckoutLoading(false);
    }
  };

  const isPro = user?.plan === "pro";

  const monthlyPrice = 50;
  const annualMonthlyPrice = 40;
  const annualTotalPrice = annualMonthlyPrice * 12;
  const isAnnual = billingCycle === "annual";

  return (
    <div className="min-h-screen bg-white">
      {/* Nav — only shown for logged-out users (logged-in users get AppNavbar) */}
      {!user && (
        <nav className="border-b border-gray-200/50 bg-white/60 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
            <a href="/" className="flex items-center gap-3">
              <div className="w-9 h-9 bg-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                B2V
              </div>
              <span className="text-xl font-semibold text-gray-900">
                Blog2Video
              </span>
            </a>
            <div className="flex items-center gap-6">
              <a
                href="/"
                className="text-sm text-gray-400 hover:text-gray-900 transition-colors"
              >
                Home
              </a>
            </div>
          </div>
        </nav>
      )}

      {/* Pricing header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-purple-500/[0.03] rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-6 pt-20 pb-6 text-center">
          <p className="text-xs font-medium text-purple-600 mb-4 tracking-widest uppercase">
            Pricing
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto leading-relaxed">
            Start free. Pay per video. Or go Pro for unlimited power.
          </p>
        </div>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3 py-6">
        <span
          className={`text-sm font-medium ${
            !isAnnual ? "text-gray-900" : "text-gray-400"
          }`}
        >
          Monthly
        </span>
        <button
          onClick={() =>
            setBillingCycle(isAnnual ? "monthly" : "annual")
          }
          className={`relative w-12 h-6 rounded-full transition-colors ${
            isAnnual ? "bg-purple-600" : "bg-gray-200"
          }`}
        >
          <div
            className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              isAnnual ? "translate-x-6" : "translate-x-0.5"
            }`}
          />
        </button>
        <span
          className={`text-sm font-medium ${
            isAnnual ? "text-gray-900" : "text-gray-400"
          }`}
        >
          Annual
        </span>
        <span className="ml-1 px-2 py-0.5 bg-green-50 text-green-600 text-xs font-medium rounded-full">
          Save 20%
        </span>
      </div>

      {/* Plans */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {/* Free */}
          <div className="glass-card p-7 flex flex-col">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Free
              </h3>
              <p className="text-sm text-gray-400">Try it out</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold text-gray-900">$0</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {[
                "1 video — yours to keep",
                "AI script generation",
                "ElevenLabs voiceover",
                "Remotion video preview",
                "Render & download MP4",
              ].map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2.5 text-sm text-gray-600"
                >
                  <CheckIcon />
                  {f}
                </li>
              ))}
              {["AI chat editor", "Remotion Studio"].map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2.5 text-sm text-gray-300"
                >
                  <XIcon />
                  {f}
                </li>
              ))}
            </ul>
            {user ? (
              <button
                disabled
                className="w-full py-2.5 px-4 rounded-lg text-sm font-medium bg-gray-100 text-gray-400 cursor-not-allowed"
              >
                {isPro ? "Downgrade not available" : "Current plan"}
              </button>
            ) : (
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setAuthError("Google sign-in failed")}
                  size="large"
                  shape="pill"
                  text="signup_with"
                  theme="outline"
                  width="240"
                />
              </div>
            )}
          </div>

          {/* Pay Per Video */}
          <div className="glass-card p-7 flex flex-col">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Per Video
              </h3>
              <p className="text-sm text-gray-400">Pay as you go</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold text-gray-900">$5</span>
              <span className="text-sm text-gray-400 ml-1">/video</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {[
                "No subscription required",
                "AI script generation",
                "ElevenLabs voiceover",
                "Remotion video preview",
                "Render & download MP4",
                "Buy as many as you need",
              ].map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2.5 text-sm text-gray-600"
                >
                  <CheckIcon />
                  {f}
                </li>
              ))}
              {["AI chat editor", "Remotion Studio"].map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2.5 text-sm text-gray-300"
                >
                  <XIcon />
                  {f}
                </li>
              ))}
            </ul>
            {user ? (
              <button
                onClick={handleUpgrade}
                disabled={checkoutLoading || isPro}
                className="w-full py-2.5 px-4 rounded-lg text-sm font-medium bg-gray-900 hover:bg-gray-800 text-white transition-colors disabled:opacity-60"
              >
                Buy a video
              </button>
            ) : (
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setAuthError("Google sign-in failed")}
                  size="large"
                  shape="pill"
                  text="continue_with"
                  theme="outline"
                  width="240"
                />
              </div>
            )}
          </div>

          {/* Pro */}
          <div className="glass-card p-7 flex flex-col ring-2 ring-purple-200 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="px-4 py-1 bg-purple-600 text-white text-xs font-semibold rounded-full">
                Best value
              </span>
            </div>
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Pro
              </h3>
              <p className="text-sm text-gray-400">
                For serious content creators
              </p>
            </div>
            <div className="mb-6">
              {isAnnual ? (
                <>
                  <span className="text-4xl font-bold text-gray-900">
                    ${annualMonthlyPrice}
                  </span>
                  <span className="text-sm text-gray-400 ml-1">/month</span>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-sm text-gray-400 line-through">
                      ${monthlyPrice}/mo
                    </span>
                    <span className="text-xs font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                      Save 20%
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    ${annualTotalPrice} billed annually
                  </p>
                </>
              ) : (
                <>
                  <span className="text-4xl font-bold text-gray-900">
                    ${monthlyPrice}
                  </span>
                  <span className="text-sm text-gray-400 ml-1">/month</span>
                  <p className="text-xs text-gray-400 mt-1">
                    or ${annualMonthlyPrice}/mo billed annually
                  </p>
                </>
              )}
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {[
                "100 videos per month",
                "AI script generation",
                "ElevenLabs voiceover",
                "Remotion video preview",
                "Render & download MP4",
                "AI chat editor — refine scenes",
                "Full Remotion Studio access",
                "Priority support",
              ].map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2.5 text-sm text-gray-600"
                >
                  <CheckIcon />
                  {f}
                </li>
              ))}
            </ul>
            {user ? (
              isPro ? (
                <button
                  disabled
                  className="w-full py-2.5 px-4 rounded-lg text-sm font-medium bg-purple-50 text-purple-400 cursor-not-allowed"
                >
                  Current plan
                </button>
              ) : (
                <button
                  onClick={handleUpgrade}
                  disabled={checkoutLoading}
                  className="w-full py-2.5 px-4 rounded-lg text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors disabled:opacity-60"
                >
                  {checkoutLoading
                    ? "Redirecting to checkout..."
                    : "Upgrade to Pro"}
                </button>
              )
            ) : (
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setAuthError("Google sign-in failed")}
                  size="large"
                  shape="pill"
                  text="continue_with"
                  theme="outline"
                  width="240"
                />
              </div>
            )}
          </div>
        </div>

        {authError && (
          <p className="text-red-500 text-sm text-center mt-6">{authError}</p>
        )}

        {/* Cost breakdown callout */}
        <div className="max-w-md mx-auto mt-8 text-center">
          <p className="text-xs text-gray-400 leading-relaxed">
            Pro works out to just{" "}
            <span className="font-medium text-gray-600">
              ${isAnnual ? "0.40" : "0.50"}
            </span>{" "}
            per video — 10x cheaper than pay-per-video.
          </p>
        </div>
      </div>

      {/* Feature comparison */}
      <div className="max-w-4xl mx-auto px-6 pb-20">
        <h3 className="text-lg font-semibold text-gray-900 text-center mb-8">
          Compare plans
        </h3>
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-4 px-6 font-medium text-gray-500">
                  Feature
                </th>
                <th className="py-4 px-6 font-medium text-gray-500 text-center">
                  Free
                </th>
                <th className="py-4 px-6 font-medium text-gray-500 text-center">
                  Per Video
                </th>
                <th className="py-4 px-6 font-medium text-purple-600 text-center">
                  Pro
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                { feature: "Price", free: "$0", perVideo: "$5/video", pro: isAnnual ? "$40/mo" : "$50/mo" },
                { feature: "Videos", free: "1 total", perVideo: "Unlimited", pro: "100/month" },
                { feature: "AI script generation", free: true, perVideo: true, pro: true },
                { feature: "ElevenLabs voiceover", free: true, perVideo: true, pro: true },
                { feature: "Voice selection (4 options)", free: true, perVideo: true, pro: true },
                { feature: "Video preview", free: true, perVideo: true, pro: true },
                { feature: "Render & download MP4", free: true, perVideo: true, pro: true },
                { feature: "AI chat editor", free: false, perVideo: false, pro: true },
                { feature: "Remotion Studio access", free: false, perVideo: false, pro: true },
                { feature: "Priority support", free: false, perVideo: false, pro: true },
              ].map((row, i) => (
                <tr
                  key={row.feature}
                  className={i % 2 === 0 ? "bg-gray-50/50" : ""}
                >
                  <td className="py-3.5 px-6 text-gray-700">
                    {row.feature}
                  </td>
                  <td className="py-3.5 px-6 text-center">
                    {typeof row.free === "boolean" ? (
                      row.free ? (
                        <GreenCheck />
                      ) : (
                        <GrayX />
                      )
                    ) : (
                      <span className="text-gray-500">{row.free}</span>
                    )}
                  </td>
                  <td className="py-3.5 px-6 text-center">
                    {typeof row.perVideo === "boolean" ? (
                      row.perVideo ? (
                        <GreenCheck />
                      ) : (
                        <GrayX />
                      )
                    ) : (
                      <span className="text-gray-500">{row.perVideo}</span>
                    )}
                  </td>
                  <td className="py-3.5 px-6 text-center">
                    {typeof row.pro === "boolean" ? (
                      row.pro ? (
                        <GreenCheck />
                      ) : (
                        <GrayX />
                      )
                    ) : (
                      <span className="font-medium text-gray-900">
                        {row.pro}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto px-6 pb-20">
        <h3 className="text-lg font-semibold text-gray-900 text-center mb-8">
          Frequently asked questions
        </h3>
        <div className="space-y-4">
          {[
            {
              q: "How long can my videos be?",
              a: "There's no time limit. Videos are as long as the blog post requires \u2014 a 3,000-word article might produce a 5-8 minute video.",
            },
            {
              q: "What's the difference between per-video and Pro?",
              a: "Per-video is pay-as-you-go at $5 each \u2014 great if you only make a few. Pro at $50/month gives you 100 videos plus AI chat editing and Remotion Studio. If you make 10+ videos/month, Pro is the clear winner.",
            },
            {
              q: "How does annual billing work?",
              a: "Choose annual billing and pay $480/year ($40/month) instead of $600/year \u2014 that's a 20% discount. You get all the same Pro features.",
            },
            {
              q: "Can I edit the video after generation?",
              a: "Free and per-video users can preview and download. Pro users get access to the AI chat editor (tell the AI to rewrite scenes) and full Remotion Studio for manual editing.",
            },
            {
              q: "What voices are available?",
              a: "Four documentary-quality ElevenLabs voices: male British, male American, female British, and female American.",
            },
            {
              q: "Can I cancel anytime?",
              a: "Yes. Cancel your Pro subscription anytime through the billing portal. You keep access until the end of your billing period.",
            },
          ].map((faq) => (
            <div key={faq.q} className="glass-card p-6">
              <h4 className="text-sm font-medium text-gray-900 mb-2">
                {faq.q}
              </h4>
              <p className="text-sm text-gray-500 leading-relaxed">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="py-10 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-purple-600 rounded flex items-center justify-center text-white text-[10px] font-bold">
              B2V
            </div>
            Blog2Video
          </div>
          <p>Powered by DSPy, Remotion, and ElevenLabs</p>
        </div>
      </footer>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5"
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
  );
}

function XIcon() {
  return (
    <svg
      className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5"
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
  );
}

function GreenCheck() {
  return (
    <svg
      className="w-4 h-4 text-purple-500 mx-auto"
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
  );
}

function GrayX() {
  return (
    <svg
      className="w-4 h-4 text-gray-300 mx-auto"
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
  );
}
