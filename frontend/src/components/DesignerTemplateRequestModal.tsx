import { useState } from "react";
import ReactDOM from "react-dom";
import { sendCustomTemplateRequest } from "../api/enterprise";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function DesignerTemplateRequestModal({ open, onClose }: Props) {
  const [description, setDescription] = useState("");
  const [altContact, setAltContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (loading) return;
    onClose();
    setTimeout(() => {
      setDescription("");
      setAltContact("");
      setSuccess(false);
      setError(null);
    }, 200);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await sendCustomTemplateRequest({
        description: description.trim(),
        alternate_contact: altContact.trim() || undefined,
      });
      setSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 3000);
    } catch {
      setError("Failed to send request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} aria-hidden />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        {success ? (
          <div className="flex flex-col items-center py-8 text-center gap-4">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Request Successfully Sent</h3>
            <p className="text-sm text-gray-500 max-w-sm">
              Thank you! Our design team will review your request and reach out with next steps shortly.
              You'll hear back from us within 1–2 business days.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Request a Designer Template</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Tell us what you need and our design team will create a custom Designer Template tailored to your brand.
                </p>
              </div>
              <button onClick={handleClose} className="ml-4 shrink-0 text-gray-400 hover:text-gray-600 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Description <span className="text-red-400">*</span>
                </label>
                <textarea
                  required
                  rows={5}
                  maxLength={3000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your ideal template or give links to references."
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
                />

              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alternate Contact <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  maxLength={300}
                  value={altContact}
                  onChange={(e) => setAltContact(e.target.value)}
                  placeholder="Alternate email, phone, etc."
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !description.trim()}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {loading && (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  )}
                  {loading ? "Submitting…" : "Submit Request"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
