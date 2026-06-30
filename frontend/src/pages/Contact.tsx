import { useState } from "react";
import { ChatBubbleLeftIcon } from "@heroicons/react/24/solid";
import PublicHeader from "../components/public/PublicHeader";
import PublicFooter from "../components/public/PublicFooter";
import ContactModal from "../components/ContactModal";
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

      <PublicFooter />
    </div>
  );
}

