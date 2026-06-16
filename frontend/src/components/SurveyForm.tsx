import { useState, useEffect } from "react";
import { submitSurvey, getPublicConfig } from "../api/client";
import { useAuth } from "../hooks/useAuth";

export default function SurveyForm() {
  const { user, refreshUser } = useAuth();
  const [rating, setRating] = useState("");
  const [useCase, setUseCase] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [desiredFeature, setDesiredFeature] = useState("");
  const [heardFrom, setHeardFrom] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitted = user?.survey_submitted ?? false;

  // For users who already submitted in a past session, fetch the shared promo code to display.
  useEffect(() => {
    if (submitted && !promoCode) {
      getPublicConfig()
        .then((res) => setPromoCode(res.data.survey_promo_code || null))
        .catch(() => {
          /* non-critical */
        });
    }
  }, [submitted, promoCode]);

  const canSubmit =
    !!heardFrom.trim() && !!targetAudience.trim() && !!useCase.trim();

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError("Please fill in the required fields.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await submitSurvey({
        rating: rating.trim() || undefined,
        use_case: useCase.trim() || undefined,
        target_audience: targetAudience.trim() || undefined,
        desired_feature: desiredFeature.trim() || undefined,
        heard_from: heardFrom.trim() || undefined,
      });
      setPromoCode(res.data.promo_code);
      await refreshUser();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to submit. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = () => {
    if (!promoCode) return;
    navigator.clipboard.writeText(promoCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (submitted) {
    return (
      <section className="glass-card p-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-1">
          Quick Survey
        </h2>
        <p className="text-xs text-gray-400 mt-1.5 mb-3">
          Thank you for submitting the survey. Use this code to avail{" "}
          <span className="font-semibold text-purple-600">20% off</span> on subscription — apply it at
          checkout.
        </p>
        {promoCode ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm font-semibold bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-purple-700 tracking-wide">
              {promoCode}
            </code>
            <button
              onClick={handleCopy}
              className="shrink-0 text-xs font-medium px-3 py-2 rounded-lg border border-purple-200 text-purple-600 hover:bg-purple-50 transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-400">Your promo code is being prepared…</p>
        )}
      </section>
    );
  }

  return (
    <section className="glass-card p-6">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-1">
        Quick Survey
      </h2>
      <p className="text-xs text-gray-400 mb-5">
        Submit the survey to avail {" "}
        <span className="font-semibold text-purple-600">20% discount</span> on your
        subscription to any plan.
      </p>

      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5">
            Where did you first hear about us? <span className="text-red-400">*</span>
          </p>
          <input
            type="text"
            value={heardFrom}
            onChange={(e) => setHeardFrom(e.target.value)}
            className="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
          />
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5">
            What platforms and audience are you looking to target? <span className="text-red-400">*</span>
          </p>
          <textarea
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            rows={3}
            className="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-400 resize-none"
          />
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5">
            What problem or use case are you looking to solve using Blog2Video? Does it do a good
            job at solving them? <span className="text-red-400">*</span>
          </p>
          <textarea
            value={useCase}
            onChange={(e) => setUseCase(e.target.value)}
            rows={3}
            className="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-400 resize-none"
          />
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5">
            What feature or improvement will enhance the app's experience most in your opinion?
          </p>
          <textarea
            value={desiredFeature}
            onChange={(e) => setDesiredFeature(e.target.value)}
            rows={3}
            className="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-400 resize-none"
          />
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5">
            How would you rate the experience overall from 1-5 (5 highest)?
          </p>
          <input
            type="text"
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            className="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
          />
        </div>
      </div>

      <div className="mt-4">
        <button
          onClick={handleSubmit}
          disabled={submitting || !canSubmit}
          className="text-xs font-semibold px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "Submitting…" : "Submit"}
        </button>
        {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
      </div>
    </section>
  );
}
