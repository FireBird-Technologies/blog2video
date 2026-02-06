import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin, CredentialResponse } from "@react-oauth/google";
import { googleLogin } from "../api/client";
import { useAuth } from "../hooks/useAuth";

export default function Landing() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [authError, setAuthError] = useState<string | null>(null);

  const handleGoogleSuccess = async (response: CredentialResponse) => {
    if (!response.credential) return;
    setAuthError(null);

    try {
      const res = await googleLogin(response.credential);
      login(res.data.access_token, res.data.user);
      navigate("/dashboard");
    } catch (err: any) {
      setAuthError(
        err?.response?.data?.detail || "Authentication failed. Please try again."
      );
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-200/50 bg-white/60 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              B2V
            </div>
            <span className="text-xl font-semibold text-gray-900">Blog2Video</span>
          </div>
          <a
            href="#pricing"
            className="text-sm text-gray-400 hover:text-gray-900 transition-colors"
          >
            Pricing
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-purple-500/[0.03] rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-violet-500/[0.03] rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-6 pt-28 pb-24 text-center">
          <p className="text-sm font-medium text-purple-600 mb-8 tracking-wide">
            AI-Powered Video Generation
          </p>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 leading-[1.1] tracking-tight mb-6">
            Turn any blog post
            <br />
            <span className="bg-gradient-to-r from-purple-600 to-violet-500 bg-clip-text text-transparent">
              into a video
            </span>
          </h1>

          <p className="text-lg text-gray-500 max-w-xl mx-auto mb-14 leading-relaxed">
            Paste a URL. Get a fully scripted, narrated explainer video
            with AI generation, Remotion visuals, and ElevenLabs voiceover.
          </p>

          <div className="flex flex-col items-center gap-4">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setAuthError("Google sign-in failed")}
              size="large"
              shape="pill"
              text="continue_with"
              theme="outline"
              width="300"
            />
            {authError && (
              <p className="text-red-500 text-sm">{authError}</p>
            )}
            <p className="text-xs text-gray-400">
              First video free. No credit card required.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-semibold text-gray-900 text-center mb-16">
            How it works
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: "1",
                title: "Paste your blog URL",
                desc: "We scrape the text and images from any blog post automatically.",
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                ),
              },
              {
                step: "2",
                title: "AI generates the video",
                desc: "DSPy agent creates a script, Remotion scenes, and ElevenLabs voiceover.",
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                ),
              },
              {
                step: "3",
                title: "Edit and export",
                desc: "Tweak with the AI chatbot or open Remotion Studio for full control.",
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                ),
              },
            ].map((item) => (
              <div
                key={item.step}
                className="glass-card p-8 text-center hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all"
              >
                <div className="w-10 h-10 mx-auto mb-5 rounded-lg flex items-center justify-center text-purple-600 bg-purple-50">
                  {item.icon}
                </div>
                <h3 className="text-base font-medium text-gray-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-semibold text-gray-900 text-center mb-16">
            Why Blog2Video?
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                title: "Longer videos at lower cost",
                desc: "Programmable Remotion scenes mean you're not paying per-second of GPU render time. Generate 10+ minute explainer videos affordably.",
              },
              {
                title: "Purpose-built for technical blogs",
                desc: "The AI understands code snippets, diagrams, and structured arguments. Narration that actually explains concepts.",
              },
              {
                title: "Full creative control via Remotion Studio",
                desc: "Every frame is a React component. Export and customize animations, colors, timing -- anything you want in code.",
              },
              {
                title: "Ideal for technical professionals",
                desc: "Bridge the gap from technical writing to video content for YouTube, courses, or social media.",
              },
            ].map((benefit) => (
              <div
                key={benefit.title}
                className="glass-card p-8 hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all"
              >
                <h3 className="text-base font-medium text-gray-900 mb-2">
                  {benefit.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {benefit.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl font-semibold text-gray-900 text-center mb-4">
            Simple pricing
          </h2>
          <p className="text-gray-500 text-center mb-16 text-sm">
            Start free. Upgrade when you need more.
          </p>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Free tier */}
            <div className="glass-card p-8">
              <h3 className="text-base font-medium text-gray-900 mb-1">Free</h3>
              <p className="text-gray-400 text-sm mb-6">Try it out</p>
              <div className="mb-6">
                <span className="text-4xl font-semibold text-gray-900">$0</span>
              </div>
              <ul className="space-y-3 mb-8 text-sm text-gray-600">
                <li className="flex items-center gap-3">
                  <CheckIcon />1 video
                </li>
                <li className="flex items-center gap-3">
                  <CheckIcon />
                  AI script generation
                </li>
                <li className="flex items-center gap-3">
                  <CheckIcon />
                  ElevenLabs voiceover
                </li>
                <li className="flex items-center gap-3">
                  <CheckIcon />
                  Remotion Studio export
                </li>
              </ul>
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setAuthError("Google sign-in failed")}
                  size="large"
                  shape="pill"
                  text="signup_with"
                  theme="outline"
                  width="260"
                />
              </div>
            </div>

            {/* Pro tier */}
            <div className="glass-card p-8 relative ring-1 ring-purple-200">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="px-3 py-1 bg-purple-600 text-white text-xs font-medium rounded-full">
                  Most popular
                </span>
              </div>
              <h3 className="text-base font-medium text-gray-900 mb-1">Pro</h3>
              <p className="text-gray-400 text-sm mb-6">
                For content creators
              </p>
              <div className="mb-6">
                <span className="text-4xl font-semibold text-gray-900">$20</span>
                <span className="text-gray-400 text-sm">/month</span>
              </div>
              <ul className="space-y-3 mb-8 text-sm text-gray-600">
                <li className="flex items-center gap-3">
                  <CheckIcon />
                  100 videos/month
                </li>
                <li className="flex items-center gap-3">
                  <CheckIcon />
                  AI script generation
                </li>
                <li className="flex items-center gap-3">
                  <CheckIcon />
                  ElevenLabs voiceover
                </li>
                <li className="flex items-center gap-3">
                  <CheckIcon />
                  Remotion Studio export
                </li>
                <li className="flex items-center gap-3">
                  <CheckIcon />
                  AI chat editor
                </li>
                <li className="flex items-center gap-3">
                  <CheckIcon />
                  Priority support
                </li>
              </ul>
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setAuthError("Google sign-in failed")}
                  size="large"
                  shape="pill"
                  text="continue_with"
                  theme="outline"
                  width="260"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Ready to turn your blog into video?
          </h2>
          <p className="text-sm text-gray-500 mb-8">
            Sign up with Google and create your first video in minutes.
          </p>
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setAuthError("Google sign-in failed")}
              size="large"
              shape="pill"
              text="continue_with"
              theme="outline"
              width="300"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10">
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
      className="w-4 h-4 text-purple-500 flex-shrink-0"
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
