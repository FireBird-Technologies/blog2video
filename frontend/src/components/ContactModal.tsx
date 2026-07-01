import { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { sendEnterpriseContact } from "../api/client";
import { useErrorModal, getErrorMessage } from "../contexts/ErrorModalContext";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Modal heading. Defaults to the enterprise-contact copy. */
  title?: string;
  /** Sub-line shown under the heading. */
  description?: string;
  /** Placeholder for the free-text message field. */
  messagePlaceholder?: string;
  /** When true, the forwarded email is styled as a designer-template request. */
  isDesignerRequest?: boolean;
}

const DEFAULT_TITLE = "Enterprise contact";
const DEFAULT_DESCRIPTION =
  "Tell us a bit about your team and how you'd like to use Blog2Video. We'll follow up by email.";
const DEFAULT_MESSAGE_PLACEHOLDER =
  "Share a bit about your use case, team size, and what you need.";

/**
 * Enterprise / general contact form rendered as a modal. Extracted from the
 * Contact page so it can also be opened from the landing carousel CTA. Copy is
 * overridable so the same form can request a designer template, etc.
 */
export default function ContactModal({
  open,
  onClose,
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  messagePlaceholder = DEFAULT_MESSAGE_PLACEHOLDER,
  isDesignerRequest = false,
}: Props) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [contactDetails, setContactDetails] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const { showError } = useErrorModal();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(null);
    try {
      await sendEnterpriseContact({ name, company, contact_details: contactDetails, message, is_designer_request: isDesignerRequest });
      setSuccess("Thank you for the feedback, we'll get back soon.");
      setName("");
      setCompany("");
      setContactDetails("");
      setMessage("");
    } catch (err: any) {
      console.error("Enterprise contact failed", err);
      showError(
        getErrorMessage(err, "Something went wrong. Please try again or email us directly.")
      );
    } finally {
      setLoading(false);
    }
  };

  // After a successful send, briefly show success state then close the modal.
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => {
      onClose();
      setSuccess(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [success, onClose]);

  if (!open) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {success ? (
          <div className="py-6 text-center space-y-3">
            <div className="w-10 h-10 mx-auto rounded-full bg-green-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-900">
              Thank you for the feedback
            </h3>
            <p className="text-xs text-gray-500">
              Thank you, you&apos;ll hear back from us within 1-2 business days.
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-4">
              {description}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Company
                </label>
                <input
                  type="text"
                  required
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Acme Inc."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Contact details
                </label>
                <input
                  type="text"
                  required
                  value={contactDetails}
                  onChange={(e) => setContactDetails(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Email address so we can reach you"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Message
                </label>
                <textarea
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  placeholder={messagePlaceholder}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-60"
                >
                  {loading ? "Sending..." : "Send message"}
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
