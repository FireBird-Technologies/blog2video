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

  const exampleVideos: { title: string; url: string; thumbnail?: string }[] = [];

  return (
    <div className="min-h-screen bg-white">
      {/* ─── Nav ─── */}
      <nav className="border-b border-gray-200/50 bg-white/60 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              B2V
            </div>
            <span className="text-xl font-semibold text-gray-900">
              Blog2Video
            </span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#how" className="text-sm text-gray-400 hover:text-gray-900 transition-colors">How it works</a>
            <a href="#features" className="text-sm text-gray-400 hover:text-gray-900 transition-colors">Features</a>
            <a href="/pricing" className="text-sm text-gray-400 hover:text-gray-900 transition-colors">Pricing</a>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-purple-500/[0.03] rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-violet-500/[0.03] rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-6 pt-28 pb-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-50 border border-purple-100 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            <span className="text-xs font-medium text-purple-700">For bloggers, technical writers &amp; educators</span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 leading-[1.1] tracking-tight mb-6">
            Your voice,
            <br />
            <span className="bg-gradient-to-r from-purple-600 to-violet-500 bg-clip-text text-transparent">
              now in video
            </span>
          </h1>

          <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-6 leading-relaxed">
            Turn any blog post or article into a narrated explainer video that
            preserves every detail, code snippet, and diagram. 
            Your readers become viewers — no video editing skills needed.
          </p>

          <p className="text-sm text-gray-400 mb-10 max-w-xl mx-auto">
            Perfect for technical writers who need their content to reach YouTube,
            researchers presenting findings, and teachers turning lessons into visual guides.
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
              First video free — no credit card required
            </p>
          </div>
        </div>
      </section>

      {/* ─── Pain points / value props ─── */}
      <section className="py-20 border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-xs font-medium text-purple-600 text-center mb-4 tracking-widest uppercase">
            The problem
          </p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 text-center mb-4">
            Your writing is great. Video shouldn't be the bottleneck.
          </h2>
          <p className="text-sm text-gray-500 text-center max-w-2xl mx-auto mb-16 leading-relaxed">
            You've spent hours crafting the perfect article. But turning it into video
            means learning editing software, recording yourself, or hiring someone.
            What if your blog could become a video — automatically?
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: "🎙️",
                title: "Exact blog voice",
                desc: "AI reads your article and generates a script that mirrors your writing style — every nuance, every technical term, preserved.",
              },
              {
                icon: "📋",
                title: "Every detail included",
                desc: "Code snippets become animated code blocks. Key points become bullet reveals. Architectures become flow diagrams. Nothing is lost.",
              },
              {
                icon: "🎓",
                title: "Easy to follow",
                desc: "Scene-by-scene narration with professional voiceover makes complex topics as easy to follow as your original blog post.",
              },
            ].map((item) => (
              <div key={item.title} className="glass-card p-8 text-center hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all">
                <div className="text-3xl mb-5">{item.icon}</div>
                <h3 className="text-base font-medium text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 4-Step Process ─── */}
      <section id="how" className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-xs font-medium text-purple-600 text-center mb-4 tracking-widest uppercase">
            4 simple steps
          </p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 text-center mb-16">
            From blog post to video in minutes
          </h2>

          <div className="grid md:grid-cols-4 gap-5">
            {[
              {
                step: "1",
                title: "Paste URL",
                desc: "Drop any blog URL. We extract text, images, code blocks — everything.",
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                ),
              },
              {
                step: "2",
                title: "Pick your voice",
                desc: "Choose male or female narrator, British or American accent. Documentary-quality AI voices.",
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                ),
              },
              {
                step: "3",
                title: "AI generates",
                desc: "Script, scenes, voiceover, and visuals — code blocks, diagrams, bullet animations — all auto-generated.",
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                ),
              },
              {
                step: "4",
                title: "Render & share",
                desc: "Preview instantly, render to MP4, or open Remotion Studio for full creative control.",
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                ),
              },
            ].map((item) => (
              <div key={item.step} className="glass-card p-6 text-center hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center">
                    {item.step}
                  </span>
                </div>
                <div className="w-10 h-10 mx-auto mt-4 mb-4 rounded-lg flex items-center justify-center text-purple-600 bg-purple-50">
                  {item.icon}
                </div>
                <h3 className="text-sm font-medium text-gray-900 mb-1.5">{item.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="py-20 border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-xs font-medium text-purple-600 text-center mb-4 tracking-widest uppercase">
            Features
          </p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 text-center mb-16">
            Everything you need to go from text to video
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                title: "Rich visual scenes — not just text",
                desc: "Code blocks with syntax highlighting, animated bullet lists, flow diagrams, comparison layouts, big-number metrics. Every scene is tailored to its content.",
                tag: null,
              },
              {
                title: "Documentary-quality voiceover",
                desc: "Choose from 4 ElevenLabs voices: male or female, British or American. Natural narration that sounds like a professional documentary orator.",
                tag: null,
              },
              {
                title: "Remotion Studio export",
                desc: "Every frame is a React component. Open the full Remotion Studio to customize animations, timing, colors, and code — total creative control.",
                tag: "Pro",
              },
              {
                title: "AI chat editor",
                desc: "Tell the AI to rewrite a scene, change tone, add detail, or restructure. Your edits are applied instantly without re-generating the entire video.",
                tag: "Pro",
              },
              {
                title: "Hero image & blog assets",
                desc: "The blog's OG image becomes your intro scene. All extracted images are distributed across scenes for maximum visual impact.",
                tag: null,
              },
              {
                title: "Render progress & instant preview",
                desc: "Watch your video come to life with a live Remotion Player preview. Render to MP4 with real-time progress tracking — frame by frame.",
                tag: null,
              },
            ].map((f) => (
              <div key={f.title} className="glass-card p-8 hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <h3 className="text-base font-medium text-gray-900">{f.title}</h3>
                  {f.tag && (
                    <span className="flex-shrink-0 px-2 py-0.5 text-[10px] font-semibold bg-purple-100 text-purple-600 rounded-full">
                      {f.tag}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Who is it for ─── */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-xs font-medium text-purple-600 text-center mb-4 tracking-widest uppercase">
            Built for
          </p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 text-center mb-16">
            Writers, researchers and educators who want to be seen
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: "✍️", title: "Technical bloggers", desc: "Turn dev.to and Medium posts into YouTube-ready explainers" },
              { icon: "🔬", title: "Researchers", desc: "Present papers and findings as accessible video summaries" },
              { icon: "👩‍🏫", title: "Teachers & educators", desc: "Convert lesson plans and course material into visual guides" },
              { icon: "📝", title: "Technical writers", desc: "Repurpose documentation and how-tos as video walkthroughs" },
            ].map((p) => (
              <div key={p.title} className="glass-card p-6 text-center hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all">
                <div className="text-2xl mb-3">{p.icon}</div>
                <h3 className="text-sm font-medium text-gray-900 mb-1">{p.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Examples ─── */}
      <section id="examples" className="py-20 border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-semibold text-gray-900 text-center mb-4">
            See it in action
          </h2>
          <p className="text-sm text-gray-500 text-center mb-16 max-w-lg mx-auto leading-relaxed">
            Example videos generated from real technical blog posts.
          </p>

          {exampleVideos.length === 0 ? (
            <div className="glass-card p-16 text-center">
              <div className="w-14 h-14 mx-auto mb-6 rounded-2xl bg-purple-50 flex items-center justify-center">
                <svg className="w-7 h-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Example videos coming soon</h3>
              <p className="text-sm text-gray-400 max-w-md mx-auto leading-relaxed">
                We're creating sample explainer videos from popular technical blogs. Check back soon.
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {exampleVideos.map((video) => (
                <a key={video.url} href={video.url} target="_blank" rel="noopener noreferrer" className="glass-card overflow-hidden group hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all">
                  <div className="aspect-video bg-gray-100 flex items-center justify-center relative">
                    {video.thumbnail ? (
                      <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                        <svg className="w-6 h-6 text-purple-600 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                      </div>
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="text-sm font-medium text-gray-900 group-hover:text-purple-600 transition-colors">{video.title}</h3>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ─── Pricing preview ─── */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-xs font-medium text-purple-600 mb-4 tracking-widest uppercase">Pricing</p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4">
            Start free. Scale when you're ready.
          </h2>
          <p className="text-sm text-gray-500 mb-10 max-w-lg mx-auto leading-relaxed">
            Your first video is completely free. Upgrade to Pro for 100 videos/month,
            AI chat editing, and full Remotion Studio access.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <div className="glass-card px-8 py-6 text-center min-w-[200px]">
              <p className="text-sm font-medium text-gray-900 mb-1">Free</p>
              <p className="text-3xl font-bold text-gray-900">$0</p>
              <p className="text-xs text-gray-400 mt-1">1 video, forever</p>
            </div>
            <div className="glass-card px-8 py-6 text-center min-w-[200px] ring-1 ring-purple-200 relative">
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                <span className="px-2.5 py-0.5 bg-purple-600 text-white text-[10px] font-medium rounded-full">Popular</span>
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">Pro</p>
              <p className="text-3xl font-bold text-gray-900">$50<span className="text-sm font-normal text-gray-400">/mo</span></p>
              <p className="text-xs text-gray-400 mt-1">100 videos/month</p>
            </div>
          </div>

          <a
            href="/pricing"
            className="inline-flex items-center gap-2 mt-8 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            View full pricing
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </a>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-20 border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4">
            Your next blog post deserves a video
          </h2>
          <p className="text-sm text-gray-500 mb-8 max-w-lg mx-auto">
            Join bloggers, researchers, and educators who are turning their best
            writing into engaging video content — in minutes, not hours.
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

      {/* ─── Footer ─── */}
      <footer className="py-10 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-purple-600 rounded flex items-center justify-center text-white text-[10px] font-bold">B2V</div>
            Blog2Video
          </div>
          <p>Powered by DSPy, Remotion, and ElevenLabs</p>
        </div>
      </footer>
    </div>
  );
}
