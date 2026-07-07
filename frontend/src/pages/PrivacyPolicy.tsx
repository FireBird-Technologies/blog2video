import PublicHeader from "../components/public/PublicHeader";
import PublicFooter from "../components/public/PublicFooter";
import Seo from "../components/seo/Seo";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Seo
        title="Privacy Policy"
        description="Learn how Blog2Video collects, uses, and protects your personal information."
        path="/privacy"
      />
      <PublicHeader />

      <div className="max-w-3xl mx-auto px-6 py-16">
        <header className="mb-10">
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-500">Last updated: May 11, 2025</p>
        </header>

        <div className="prose prose-gray max-w-none space-y-8 text-sm text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Introduction</h2>
            <p>
              FireBird Technologies ("we", "us", or "our") operates Blog2Video at{" "}
              <a href="https://blog2video.app" className="text-purple-600 hover:underline">
                blog2video.app
              </a>{" "}
              ("the Service"). This Privacy Policy explains how we collect, use, disclose, and protect your information when you use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Information We Collect</h2>
            <p className="font-medium text-gray-800 mt-2">Account Information</p>
            <p className="mt-1">
              When you create an account, we collect your name, email address, and authentication details (e.g., via Google OAuth).
            </p>
            <p className="font-medium text-gray-800 mt-3">User Content</p>
            <p className="mt-1">
              We collect and process the content you submit to generate videos — including blog posts, article URLs, PDFs, and other written material.
            </p>
            <p className="font-medium text-gray-800 mt-3">Usage Data</p>
            <p className="mt-1">
              We automatically collect information about how you interact with the Service, including pages visited, features used, timestamps, IP address, browser type, and device identifiers.
            </p>
            <p className="font-medium text-gray-800 mt-3">Payment Information</p>
            <p className="mt-1">
              Payment transactions are processed by our third-party payment processor. We do not store full payment card details on our servers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Provide, operate, and improve the Service</li>
              <li>Process transactions and manage your subscription</li>
              <li>Send transactional and service-related communications</li>
              <li>Respond to your support requests and inquiries</li>
              <li>Monitor for abuse and enforce our Terms of Service</li>
              <li>Analyze usage patterns to improve features and performance</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Third-Party Services</h2>
            <p>We use trusted third-party providers to help operate the Service, including:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>Google OAuth</strong> — for account authentication</li>
              <li><strong>Payment processors</strong> — for billing and subscription management</li>
              <li><strong>Cloud infrastructure providers</strong> — for hosting and storage</li>
              <li><strong>Analytics providers</strong> — for usage analysis (e.g., Google Analytics)</li>
            </ul>
            <p className="mt-2">
              These providers only receive information necessary to perform their functions and are bound by their own privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Data Retention</h2>
            <p>
              We retain your account information and User Content for as long as your account is active or as needed to provide the Service. You may request deletion of your account and associated data by contacting us. We may retain certain information as required by law or for legitimate business purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Data Security</h2>
            <p>
              We implement reasonable technical and organisational measures to protect your information against unauthorised access, loss, or disclosure. However, no method of transmission over the internet is completely secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Your Rights</h2>
            <p>Depending on your location, you may have the right to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your personal data</li>
              <li>Object to or restrict certain processing</li>
              <li>Data portability (where applicable)</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, contact us at{" "}
              <a
                href="mailto:arslan@firebird-technologies.com"
                className="text-purple-600 hover:underline"
              >
                arslan@firebird-technologies.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Cookies</h2>
            <p>
              We use cookies and similar tracking technologies to operate the Service, remember your preferences, and analyse usage. You can control cookie behaviour through your browser settings, though disabling certain cookies may affect Service functionality.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Children's Privacy</h2>
            <p>
              The Service is not directed to children under 18. We do not knowingly collect personal information from anyone under 18. If you believe we have inadvertently collected such information, please contact us and we will delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material changes by updating the "Last updated" date above or by emailing your registered address. Your continued use of the Service after changes take effect constitutes your acceptance of the updated Policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">11. Contact Us</h2>
            <p>
              If you have questions or concerns about this Privacy Policy, please contact us at:{" "}
              <a
                href="mailto:arslan@firebird-technologies.com"
                className="text-purple-600 hover:underline"
              >
                arslan@firebird-technologies.com
              </a>
            </p>
          </section>

        </div>
      </div>

      <PublicFooter />
    </div>
  );
}
