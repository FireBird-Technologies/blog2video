<<<<<<< HEAD
import { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { sendEnterpriseContact } from "../api/client";
import { useErrorModal, getErrorMessage } from "../contexts/ErrorModalContext";
import { ChatBubbleLeftIcon } from "@heroicons/react/24/solid";
import PublicHeader from "../components/public/PublicHeader";
import PublicFooter from "../components/public/PublicFooter";
=======
import { useState } from "react";
import { ChatBubbleLeftIcon } from "@heroicons/react/24/solid";
import PublicHeader from "../components/public/PublicHeader";
import PublicFooter from "../components/public/PublicFooter";
import ContactModal from "../components/ContactModal";
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
import Seo from "../components/seo/Seo";
import { contactSchema } from "../seo/schema";


export default function Contact() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Seo
        title="Contact"
        description="Talk to Blog2Video about support, enterprise use cases, custom deployments, and team workflows."
        path="/contact"
        schema={contactSchema()}
      />
      <PublicHeader />

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
                href="mailto:arslan@firebird-technologies.com"
                className="text-purple-600 hover:text-purple-700 underline"
              >
                arslan@firebird-technologies.com
              </a>
            </p>
          </div>
        </section>


      </div>

      <ContactModal open={open} onClose={() => setOpen(false)} />

<<<<<<< HEAD
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
        </div>,
        document.body
      )}

=======
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
      <PublicFooter />
    </div>
  );
}

