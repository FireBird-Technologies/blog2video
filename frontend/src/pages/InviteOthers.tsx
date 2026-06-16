import { useNavigate } from "react-router-dom";
import ReferralPanel from "../components/ReferralPanel";
import SurveyForm from "../components/SurveyForm";

export default function InviteOthers() {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div>
        <button
          onClick={() => navigate("/dashboard")}
          className="text-xs text-gray-400 hover:text-gray-900 transition-colors mb-4 flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </button>
        <h1 className="text-2xl font-semibold text-gray-900">Survey & Referrals</h1>
        <p className="text-sm text-gray-400 mt-1">
          Share your feedback and invite friends to earn discounts and bonus videos.
        </p>
      </div>

      <SurveyForm />

      <ReferralPanel />
    </div>
  );
}
