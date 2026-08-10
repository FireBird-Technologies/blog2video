import { useState, useRef } from "react";
import VoiceItem, { formatVoiceSubtitle } from "./VoiceItem";

const FEATURED_VOICES = [
  {
    id: "21m00Tcm4TlvDq8ikWAM",
    name: "Rachel",
    gender: "Female",
    accent: "American",
    description: "Calm and professional",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/21m00Tcm4TlvDq8ikWAM/b4928a68-c03b-411f-8533-3d5c299fd451.mp3",
  },
  {
    id: "onwK4e9ZLuTAKqWW03F9",
    name: "Daniel",
    gender: "Male",
    accent: "British",
    description: "Steady broadcaster",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/onwK4e9ZLuTAKqWW03F9/7eee0236-1a72-4b86-b303-5dcadc007ba9.mp3",
  },
];

const MORE_FREE_VOICES = [
  {
    id: "Xb7hH8MSUJpSbSDYk0k2",
    name: "Alice",
    gender: "Female",
    accent: "British",
    description: "Clear and engaging",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/Xb7hH8MSUJpSbSDYk0k2/d10f7534-11f6-41fe-a012-2de1e482d336.mp3",
  },
  {
    id: "pqHfZKP75CvOlQylNhV4",
    name: "Bill",
    gender: "Male",
    accent: "American",
    description: "Wise and balanced",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/pqHfZKP75CvOlQylNhV4/d782b3ff-84ba-4029-848c-acf01285524d.mp3",
  },
];

type CustomMode = "clone" | "form" | "prompt";

export default function VoiceShowcaseSection() {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [customMode, setCustomMode] = useState<CustomMode>("clone");
  const [promptText, setPromptText] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function handlePlay(voiceId: string, previewUrl: string) {
    if (playingId === voiceId) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(previewUrl);
    audio.addEventListener("ended", () => setPlayingId(null));
    audio.play().catch(() => setPlayingId(null));
    audioRef.current = audio;
    setPlayingId(voiceId);
  }

  const visibleFreeVoices = showMore
    ? [...FEATURED_VOICES, ...MORE_FREE_VOICES]
    : FEATURED_VOICES;

  return (
    <div className="reveal">
      <p className="text-xs font-medium text-purple-600 text-center mb-4 tracking-widest uppercase">
        Voices
      </p>
      <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 text-center mb-4">
        Pick a voice — or create your own
      </h2>
      <p className="text-sm text-gray-500 text-center max-w-lg mx-auto mb-6 leading-relaxed">
        Choose from documentary-quality narrators, design a custom voice from a prompt, or clone your own by uploading a sample.
      </p>

      <div className="glass-card p-6 sm:p-8 rounded-xl hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all max-w-2xl mx-auto">

        {/* Free voices */}
        <div className="flex flex-col gap-3">
          {visibleFreeVoices.map((v) => (
            <VoiceItem
              key={v.id}
              name={v.name}
              subtitle={formatVoiceSubtitle(v.gender, v.accent, v.description)}
              hasPreview={true}
              isPlaying={playingId === v.id}
              onPlay={() => handlePlay(v.id, v.previewUrl)}
            />
          ))}
        </div>

        {/* Show more / less toggle */}
        <button
          type="button"
          onClick={() => setShowMore((s) => !s)}
          className="mt-3 text-xs text-purple-500 hover:text-purple-700 font-medium flex items-center gap-1 transition-colors"
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform ${showMore ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          {showMore ? "Show fewer voices" : "Show 2 more free voices"}
        </button>

        <div className="my-6 border-t border-gray-100" />

        {/* 100+ premium hint */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50/60 border border-gray-200/80 mb-6">
          <div className="flex -space-x-1.5">
            {["bg-purple-400", "bg-violet-500", "bg-indigo-400", "bg-fuchsia-400"].map((c, i) => (
              <div key={i} className={`w-7 h-7 rounded-full ${c} border-2 border-white flex items-center justify-center`}>
                <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                </svg>
              </div>
            ))}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-800">100+ premium voices on Pro</p>
            <p className="text-xs text-gray-400 mt-0.5">Professional, warm, expressive, multilingual &amp; more</p>
          </div>
        </div>

        <div className="border-t border-gray-100 mb-6" />

        {/* Custom voice section */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base font-semibold text-gray-900">Custom voice</span>
          </div>

          {/* Sample custom voice */}
          <div className="mb-5">
            <p className="text-[11px] text-gray-400 mb-2">Example — what your custom voice looks like</p>
            <VoiceItem
              name="My Narrator"
              subtitle={formatVoiceSubtitle("Male", "British", "Calm & authoritative")}
              hasPreview={true}
              isPlaying={false}
              onPlay={() => {}}
              badge={
                <span className="flex-shrink-0 px-2 py-0.5 text-[10px] font-semibold bg-green-100 text-green-700 rounded-full">
                  Generated
                </span>
              }
            />
          </div>

          {/* 3-tab mode switcher */}
          <div className="flex gap-1 p-1 bg-gray-100/70 rounded-xl mb-4">
            {(["clone", "form", "prompt"] as CustomMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setCustomMode(m)}
                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                  customMode === m
                    ? "bg-white text-gray-800 shadow-sm"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {m === "clone" ? "Clone voice" : m === "form" ? "Build from options" : "Describe in words"}
              </button>
            ))}
          </div>

          {/* Clone your voice */}
          {customMode === "clone" && (
            <div className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-5">
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                Upload a 1–5 minute audio sample and we'll clone it. Your content, your actual voice.
              </p>
              <div className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-8 px-4 bg-white hover:border-purple-400 hover:bg-purple-50/20 transition-colors group cursor-pointer mb-4">
                <div className="w-12 h-12 rounded-full bg-gray-100 group-hover:bg-purple-100 flex items-center justify-center transition-colors">
                  <svg className="w-6 h-6 text-gray-400 group-hover:text-purple-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-700">Drop your audio sample here</p>
                <p className="text-xs text-gray-400">MP3, WAV, M4A · 1–5 minutes</p>
              </div>
              <button type="button" className="w-full py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors">
                Clone voice
              </button>
            </div>
          )}

          {/* Build from options */}
          {customMode === "form" && (
            <div className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-5">
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                Pick gender, age, persona and speed — we'll generate voice previews you can play before saving.
              </p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: "Gender", opts: ["Female", "Male", "Neutral"] },
                  { label: "Age", opts: ["Young", "Middle-aged", "Elderly"] },
                  { label: "Persona", opts: ["Professional", "Friendly", "Calm", "Warm"] },
                  { label: "Speed", opts: ["Slow", "Medium", "Fast"] },
                ].map(({ label, opts }) => (
                  <div key={label}>
                    <label className="block text-[10px] font-medium text-gray-400 mb-1 uppercase tracking-wider">{label}</label>
                    <div className="relative">
                      <select className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 focus:outline-none appearance-none pr-7" defaultValue="">
                        <option value="" disabled>— optional —</option>
                        {opts.map((o) => <option key={o}>{o}</option>)}
                      </select>
                      <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className="w-full py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors">
                Generate previews
              </button>
            </div>
          )}

          {/* Describe in words */}
          {customMode === "prompt" && (
            <div className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-5">
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                Describe the voice you want — age, tone, accent, style — and we'll generate it instantly.
              </p>
              <textarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                rows={4}
                placeholder={`"A calm 40-year-old British man, authoritative but approachable"`}
                className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-lg placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-400/40 text-gray-700 resize-none mb-4"
              />
              <button type="button" className="w-full py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors">
                Generate voice
              </button>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center mt-6 leading-relaxed">
          4 prebuilt voices on all plans · 100+ premium voices + voice creation on Pro
        </p>
      </div>
    </div>
  );
}
