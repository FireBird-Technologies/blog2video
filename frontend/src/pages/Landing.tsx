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
    <div className="min-h-screen bg-gray-950">
      {/* ── Nav ─────────────────────────────────────────── */}
      <nav className="border-b border-gray-800/50">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              B2V
            </div>
            <span className="text-xl font-bold text-white">Blog2Video</span>
          </div>
          <a
            href="#pricing"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Pricing
          </a>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-6 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-8">
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
            AI-Powered Video Generation
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white leading-tight tracking-tight mb-6">
            Turn any blog post
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
              into a video
            </span>
          </h1>

          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed">
            Paste a URL. Get a fully scripted, narrated explainer video --
            powered by AI script generation, programmable Remotion visuals, and
            ElevenLabs voiceover. No video editing skills needed.
          </p>

          {/* Google Sign In */}
          <div className="flex flex-col items-center gap-4">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setAuthError("Google sign-in failed")}
              size="large"
              shape="pill"
              text="continue_with"
              theme="filled_black"
              width="300"
            />
            {authError && (
              <p className="text-red-400 text-sm">{authError}</p>
            )}
            <p className="text-sm text-gray-600">
              First video free. No credit card required.
            </p>
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────── */}
      <section className="py-20 border-t border-gray-800/50">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-white text-center mb-4">
            How it works
          </h2>
          <p className="text-gray-400 text-center mb-16 max-w-2xl mx-auto">
            Three steps from blog post to polished explainer video
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Paste your blog URL",
                desc: "We scrape the text and images from any blog post automatically.",
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                ),
              },
              {
                step: "2",
                title: "AI generates the video",
                desc: "Our DSPy agent creates a script, Remotion scenes, and ElevenLabs voiceover.",
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                ),
              },
              {
                step: "3",
                title: "Edit and export",
                desc: "Tweak with the AI chatbot or open Remotion Studio for full control, then render.",
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                ),
              },
            ].map((item) => (
              <div
                key={item.step}
                className="bg-gray-900/50 border border-gray-800/50 rounded-2xl p-8 text-center hover:border-gray-700/50 transition-all"
              >
                <div className="w-14 h-14 mx-auto mb-5 bg-blue-600/10 border border-blue-500/20 rounded-xl flex items-center justify-center text-blue-400">
                  {item.icon}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Benefits ────────────────────────────────────── */}
      <section className="py-20 border-t border-gray-800/50">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-white text-center mb-4">
            Why Blog2Video?
          </h2>
          <p className="text-gray-400 text-center mb-16 max-w-2xl mx-auto">
            Not another AI video generator. Built specifically for turning
            written content into structured explainer videos.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                title: "Longer videos at lower cost",
                desc: "Programmable Remotion scenes mean you're not paying per-second of GPU render time. Generate 10+ minute explainer videos at a fraction of what Sora or Runway would cost.",
                accent: "from-blue-500 to-cyan-500",
              },
              {
                title: "Purpose-built for technical blogs",
                desc: "The AI understands code snippets, technical diagrams, and structured arguments. It creates narration that actually explains concepts rather than just reading text aloud.",
                accent: "from-purple-500 to-pink-500",
              },
              {
                title: "Full creative control via Remotion Studio",
                desc: "Unlike black-box video models, every frame is a React component. Export the project and customize animations, colors, timing -- anything you want in code.",
                accent: "from-amber-500 to-orange-500",
              },
              {
                title: "Ideal for technical professionals",
                desc: "You write technical, scientific, or professional blogs but want video content for YouTube, courses, or social media. We bridge that gap without requiring video editing expertise.",
                accent: "from-green-500 to-emerald-500",
              },
            ].map((benefit) => (
              <div
                key={benefit.title}
                className="bg-gray-900/50 border border-gray-800/50 rounded-2xl p-8 hover:border-gray-700/50 transition-all group"
              >
                <div
                  className={`w-10 h-1 rounded-full bg-gradient-to-r ${benefit.accent} mb-5 group-hover:w-16 transition-all`}
                />
                <h3 className="text-xl font-semibold text-white mb-3">
                  {benefit.title}
                </h3>
                <p className="text-gray-400 leading-relaxed text-sm">
                  {benefit.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────── */}
      <section id="pricing" className="py-20 border-t border-gray-800/50">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-white text-center mb-4">
            Simple pricing
          </h2>
          <p className="text-gray-400 text-center mb-16">
            Start free. Upgrade when you need more.
          </p>

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Free tier */}
            <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl p-8">
              <h3 className="text-lg font-semibold text-white mb-1">Free</h3>
              <p className="text-gray-500 text-sm mb-6">Try it out</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-white">$0</span>
              </div>
              <ul className="space-y-3 mb-8 text-sm text-gray-300">
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
                  theme="filled_black"
                  width="260"
                />
              </div>
            </div>

            {/* Pro tier */}
            <div className="bg-gray-900/50 border-2 border-blue-500/30 rounded-2xl p-8 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-full">
                  Most popular
                </span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">Pro</h3>
              <p className="text-gray-500 text-sm mb-6">
                For content creators
              </p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-white">$20</span>
                <span className="text-gray-400 text-sm">/month</span>
              </div>
              <ul className="space-y-3 mb-8 text-sm text-gray-300">
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
                  AI chat editor with reflexion
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
                  theme="filled_black"
                  width="260"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────── */}
      <section className="py-20 border-t border-gray-800/50">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to turn your blog into video?
          </h2>
          <p className="text-gray-400 mb-8">
            Sign up with Google and create your first video in minutes.
            No credit card required.
          </p>
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setAuthError("Google sign-in failed")}
              size="large"
              shape="pill"
              text="continue_with"
              theme="filled_black"
              width="300"
            />
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="border-t border-gray-800/50 py-10">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white text-xs font-bold">
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
      className="w-4 h-4 text-blue-400 flex-shrink-0"
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
