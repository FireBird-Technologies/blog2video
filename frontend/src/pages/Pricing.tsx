import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CredentialResponse } from "@react-oauth/google";
import { googleLogin, createCheckoutSession, createPerVideoCheckout } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { useErrorModal, getErrorMessage } from "../contexts/ErrorModalContext";
import GoogleAuthButton from "../components/public/GoogleAuthButton";
import AccountDeletedModal from "../components/AccountDeletedModal";
import PublicHeader from "../components/public/PublicHeader";
import PublicFooter from "../components/public/PublicFooter";
import Seo from "../components/seo/Seo";
import { pricingSchema } from "../seo/schema";
// import DiscountCodeBadge from "../components/DiscountCodeBadge";

export default function Pricing() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const { showError } = useErrorModal();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">(
    "monthly"
  );
  const [accountDeletedOpen, setAccountDeletedOpen] = useState(false);
  const [pendingCredential, setPendingCredential] = useState<string | null>(null);
  const [reactivating, setReactivating] = useState(false);

  const handleGoogleSuccess = async (response: CredentialResponse) => {
    if (!response.credential) return;
    try {
      const res = await googleLogin(response.credential);
      login(res.data.access_token, res.data.user);
      navigate("/dashboard");
    } catch (err: any) {
      if (err?.response?.status === 403 && err?.response?.data?.detail === "account_deleted") {
        setPendingCredential(response.credential);
        setAccountDeletedOpen(true);
      } else {
        showError(getErrorMessage(err, "Authentication failed. Please try again."));
      }
    }
  };

  const handleReactivate = async () => {
    if (!pendingCredential) return;
    setReactivating(true);
    try {
      const res = await googleLogin(pendingCredential, true);
      login(res.data.access_token, res.data.user);
      setAccountDeletedOpen(false);
      setPendingCredential(null);
      navigate("/dashboard");
    } catch (err: any) {
      showError(getErrorMessage(err, "Failed to reactivate account."));
    } finally {
      setReactivating(false);
    }
  };

  const [perVideoLoading, setPerVideoLoading] = useState(false);

  const handleUpgrade = async () => {
    if (!user) return;
    setCheckoutLoading(true);
    try {
      const res = await createCheckoutSession({ plan: "pro", billing_cycle: billingCycle });
      window.location.href = res.data.checkout_url;
    } catch (err: any) {
      console.error("Pro checkout error:", err);
      showError(getErrorMessage(err, "Checkout failed. Please try again."));
      setCheckoutLoading(false);
    }
  };

  const [standardCheckoutLoading, setStandardCheckoutLoading] = useState(false);
  const handleStandardUpgrade = async () => {
    if (!user) return;
    setStandardCheckoutLoading(true);
    try {
      const res = await createCheckoutSession({ plan: "standard", billing_cycle: billingCycle });
      window.location.href = res.data.checkout_url;
    } catch (err: any) {
      console.error("Standard checkout error:", err);
      showError(getErrorMessage(err, "Checkout failed. Please try again."));
      setStandardCheckoutLoading(false);
    }
  };

  const handlePerVideo = async () => {
    if (!user) return;
    setPerVideoLoading(true);
    try {
      const res = await createPerVideoCheckout();
      if (res.data.checkout_url) {
        window.location.href = res.data.checkout_url;
      }
    } catch (err: any) {
      console.error("Per-video checkout error:", err);
      showError(getErrorMessage(err, "Checkout failed. Please try again."));
      setPerVideoLoading(false);
    }
  };

  const isPro = user?.plan === "pro";
  const isStandard = user?.plan === "standard";
  const isPaid = isPro || isStandard;

  const monthlyPrice = 50;
  const annualMonthlyPrice = 40;
  const annualTotalPrice = annualMonthlyPrice * 12;
  const isAnnual = billingCycle === "annual";

  return (
    <div className="min-h-screen bg-white">
      <Seo
        title="Pricing"
        description="Blog2Video pricing for free, pay-as-you-go, Standard, Pro, and custom team plans."
        path="/pricing"
        schema={pricingSchema()}
      />
      <PublicHeader />

      {/* Pricing header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-purple-500/[0.03] rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-6 text-center">
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
      
      {/* <div className="flex justify-center">
        <DiscountCodeBadge className="md:hidden" />
      </div> */}

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
      <div className="max-w-[1600px] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 max-w-[1600px] mx-auto">
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
                "First video free",
                "AI script generation",
                "ElevenLabs voiceover",
                "Remotion video preview",
                "Render & download MP4",
                "Custom video templates",
              ].map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2.5 text-sm text-gray-600"
                >
                  <CheckIcon />
                  {f}
                </li>
              ))}
              {["Unlimited AI edit & image generation", "Premium voiceover + cloning"].map((f) => (
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
                {user.plan === "free" ? "Current plan" : "Downgrade not available"}
              </button>
            ) : (
              <div className="flex justify-center">
                <GoogleAuthButton
                  onSuccess={handleGoogleSuccess}
                  onError={() => showError("Google sign-in failed")}
                  text="signup_with"
                  width="190"
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
              <span className="text-4xl font-bold text-gray-900">$3</span>
              <span className="text-sm text-gray-400 ml-1">/video</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {[
                "No subscription required",
                "AI script generation",
                "ElevenLabs voiceover",
                "Remotion video preview",
                "Render & download MP4",
                "Unlimited AI edit & image generation",
                "Custom video templates",
                "Premium voiceover + cloning",
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
            </ul>
            {user ? (
              <button
                onClick={handlePerVideo}
                disabled={perVideoLoading || isPaid}
                className="w-full py-2.5 px-4 rounded-lg text-sm font-medium bg-gray-900 hover:bg-gray-800 text-white transition-colors disabled:opacity-60"
              >
                {perVideoLoading ? "Redirecting…" : "Buy a video"}
              </button>
            ) : (
              <div className="flex justify-center">
                <GoogleAuthButton
                  onSuccess={handleGoogleSuccess}
                  onError={() => showError("Google sign-in failed")}
                  text="continue_with"
                  width="190"
                />
              </div>
            )}
          </div>

          {/* Standard */}
          <div className="glass-card p-7 flex flex-col">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Standard
              </h3>
              <p className="text-sm text-gray-400">
                All features, 30 videos/month
              </p>
            </div>
            <div className="mb-6">
              {isAnnual ? (
                <>
                  <span className="text-4xl font-bold text-gray-900">$20</span>
                  <span className="text-sm text-gray-400 ml-1">/month</span>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-sm text-gray-400 line-through">$25/mo</span>
                    <span className="text-xs font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                      Save 20%
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">$240 billed annually</p>
                </>
              ) : (
                <>
                  <span className="text-4xl font-bold text-gray-900">$25</span>
                  <span className="text-sm text-gray-400 ml-1">/month</span>
                  <p className="text-xs text-gray-400 mt-1">or $20/mo billed annually</p>
                </>
              )}
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {[
                "30 videos per month",
                "AI script generation",
                "ElevenLabs voiceover",
                "Remotion video preview",
                "Render & download MP4",
                "Unlimited AI edit & image generation",
                "Custom video templates",
                "Premium voiceover + cloning",
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
              isStandard ? (
                <button
                  disabled
                  className="w-full py-2.5 px-4 rounded-lg text-sm font-medium bg-gray-100 text-gray-400 cursor-not-allowed"
                >
                  Current plan
                </button>
              ) : isPro ? (
                <button
                  disabled
                  className="w-full py-2.5 px-4 rounded-lg text-sm font-medium bg-gray-100 text-gray-400 cursor-not-allowed"
                >
                  You're on Pro
                </button>
              ) : (
                <button
                  onClick={handleStandardUpgrade}
                  disabled={standardCheckoutLoading}
                  className="w-full py-2.5 px-4 rounded-lg text-sm font-medium bg-gray-900 hover:bg-gray-800 text-white transition-colors disabled:opacity-60"
                >
                  {standardCheckoutLoading
                    ? "Redirecting to checkout..."
                    : "Upgrade to Standard"}
                </button>
              )
            ) : (
              <div className="flex justify-center">
                <GoogleAuthButton
                  onSuccess={handleGoogleSuccess}
                  onError={() => showError("Google sign-in failed")}
                  text="continue_with"
                  width="190"
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
                "Unlimited AI edit & image generation",
                "Custom video templates",
                "Premium voiceover + cloning",
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
                <GoogleAuthButton
                  onSuccess={handleGoogleSuccess}
                  onError={() => showError("Google sign-in failed")}
                  text="continue_with"
                  width="190"
                />
              </div>
            )}
          </div>

          {/* Customized Subscription */}
          <div className="glass-card p-7 flex flex-col border-2 border-purple-300">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Customized
              </h3>
              <p className="text-sm text-gray-400">Enterprise & teams</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold text-gray-900">Custom</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {[
                "Custom video limits",
                "AI script generation",
                "ElevenLabs voiceover",
                "Remotion video preview",
                "Render & download MP4",
                "Unlimited AI edit & image generation",
                "Custom video templates",
                "Premium voiceover + cloning",
                "Custom integrations",
                "Dedicated support",
                "SSO & enterprise security",
                "On-prem deployment available",
                "Custom pricing",
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
            <button
              onClick={() => navigate("/contact")}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors"
            >
              Contact Sales
            </button>
          </div>
        </div>

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
      <div className="max-w-6xl mx-auto px-6 pb-20">
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
                <th className="py-4 px-6 font-medium text-gray-600 text-center">
                  Standard
                </th>
                <th className="py-4 px-6 font-medium text-purple-600 text-center">
                  Pro
                </th>
                <th className="py-4 px-6 font-medium text-purple-600 text-center">
                  Customized
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                { feature: "Price", free: "$0", perVideo: "$3/video", standard: isAnnual ? "$20/mo" : "$25/mo", pro: isAnnual ? "$40/mo" : "$50/mo", customized: "Custom" },
                { feature: "Videos", free: "First video free", perVideo: "Unlimited", standard: "30/month", pro: "100/month", customized: "Custom" },
                { feature: "AI script generation", free: true, perVideo: true, standard: true, pro: true, customized: true },
                { feature: "ElevenLabs voiceover", free: true, perVideo: true, standard: true, pro: true, customized: true },
                { feature: "Voice selection (4 options)", free: true, perVideo: true, standard: true, pro: true, customized: true },
                { feature: "Video preview", free: true, perVideo: true, standard: true, pro: true, customized: true },
                { feature: "Render & download MP4", free: true, perVideo: true, standard: true, pro: true, customized: true },
                { feature: "Unlimited AI edit & image generation", free: false, perVideo: true, standard: true, pro: true, customized: true },
                { feature: "Custom video templates", free: true, perVideo: true, standard: true, pro: true, customized: true },
                { feature: "Premium voiceover + cloning", free: false, perVideo: true, standard: true, pro: true, customized: true },
                { feature: "Priority support", free: false, perVideo: false, standard: true, pro: true, customized: true },
                { feature: "On-prem deployment", free: false, perVideo: false, standard: false, pro: false, customized: true },
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
                    {typeof row.standard === "boolean" ? (
                      row.standard ? (
                        <GreenCheck />
                      ) : (
                        <GrayX />
                      )
                    ) : (
                      <span className="text-gray-700">{row.standard}</span>
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
                  <td className="py-3.5 px-6 text-center">
                    {typeof row.customized === "boolean" ? (
                      row.customized ? (
                        <GreenCheck />
                      ) : (
                        <GrayX />
                      )
                    ) : (
                      <span className="font-medium text-purple-600">
                        {row.customized}
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
      <div className="max-w-4xl mx-auto px-6 pb-20">
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
              a: "Per-video is pay-as-you-go at $5 each \u2014 great if you only make a few. Pro at $50/month gives you 100 videos plus unlimited AI edit & image generation. If you make 10+ videos/month, Pro is the clear winner.",
            },
            {
              q: "How does annual billing work?",
              a: "Choose annual billing and pay $480/year ($40/month) instead of $600/year \u2014 that's a 20% discount. You get all the same Pro features.",
            },
            {
              q: "Can I edit the video after generation?",
              a: "Free and per-video users can preview and download. Pro and Standard users get unlimited AI edit & image generation.",
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

      <PublicFooter />

      <AccountDeletedModal
        open={accountDeletedOpen}
        onClose={() => { setAccountDeletedOpen(false); setPendingCredential(null); }}
        onReactivate={handleReactivate}
        reactivating={reactivating}
      />
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
