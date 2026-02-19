import { useState, useEffect } from "react";
import { sendEnterpriseContact } from "../api/client";
import { useAuth } from "../hooks/useAuth";
const ChatBubbleLeftIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.178 7.152.52 1.978.29 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.68-3.348 3.97a48.901 48.901 0 01-3.476.383.39.39 0 00-.297.17l-2.755 4.133a.75.75 0 01-1.248 0l-2.755-4.133a.39.39 0 00-.297-.17 48.9 48.9 0 01-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97z" clipRule="evenodd" />
  </svg>
);


export default function Contact() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [contactDetails, setContactDetails] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(null);
    setError(null);
    try {
      await sendEnterpriseContact({ name, company, contact_details: contactDetails, message });
      setSuccess("Thank you for the feedback, we'll get back soon.");
      setName("");
      setCompany("");
      setContactDetails("");
      setMessage("");
    } catch (err: any) {
      console.error("Enterprise contact failed", err);
      setError(
        err?.response?.data?.detail ||
          "Something went wrong. Please try again or email us directly."
      );
    } finally {
      setLoading(false);
    }
  };

  // After a successful send, briefly show success state then close the modal
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => {
      setOpen(false);
      setSuccess(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [success]);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Nav — match Pricing page for logged-out visitors */}
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

      <div className="max-w-4xl mx-auto px-6 py-16">
        <header className="mb-10">
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">
            Contact
          </h1>
          <p className="text-sm text-gray-500 max-w-xl">
            Have questions, feedback, or want to talk about using Blog2Video
            for your team? Reach out any time.
          </p>
        </header>

        <section className="glass-card p-6 mb-10">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Enterprise & teams
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Looking for a deeper integration or custom deployment?
              </p>
            </div>
            <button
              onClick={() => setOpen(true)}
              className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors flex items-center gap-2"
            >
              <ChatBubbleLeftIcon className="w-5 h-5" />
              Talk to us
            </button>

          </div>
          <ul className="mt-4 space-y-2 text-sm text-gray-600 list-disc list-inside">
            <li>API for your custom needs</li>
            <li>Custom video tooling & workflows</li>
            <li>On-prem / self-hosted deployments</li>
            <li>Advanced support & SLAs</li>
            <li>SSO and enterprise security</li>
          </ul>
        </section>


        <section className="glass-card p-6 mb-10">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            General contact
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            For support, product questions, or anything else, you can also reach us on Email
            at:
          </p>
          <div className="space-y-1 text-sm text-gray-700">
            <p>
              Email:{" "}
              <a
                href="mailto:blog2video@fbt"
                className="text-purple-600 hover:text-purple-700 underline"
              >
                blog2video@firebird-technologies.com
              </a>
            </p>
          </div>
        </section>


      </div>

      {/* Enterprise contact modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Enterprise contact
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="w-4 h-4"
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
            </div>

            {success ? (
              <div className="py-6 text-center space-y-3">
                <div className="w-10 h-10 mx-auto rounded-full bg-green-50 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-green-600"
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
                </div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Thank you for the feedback
                </h3>
                <p className="text-xs text-gray-500">
                  We&apos;ll get back to you soon.
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-500 mb-4">
                  Tell us a bit about your team and how you&apos;d like to use
                  Blog2Video. We&apos;ll follow up by email.
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
                      placeholder="Share a bit about your use case, team size, and what you need."
                    />
                  </div>

                  {error && (
                    <p className="text-xs text-red-500">
                      {error}
                    </p>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
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
        </div>
      )}
    </div>
  );
}

