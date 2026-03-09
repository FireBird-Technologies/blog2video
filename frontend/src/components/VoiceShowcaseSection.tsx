import { useState, useRef, useEffect } from "react";
import VoiceItem, { formatVoiceSubtitle } from "./VoiceItem";

// The 4 free prebuilt voices — URLs sourced directly from the PrebuiltVoice DB table
const FREE_VOICES = [
  {
    id: "21m00Tcm4TlvDq8ikWAM",
    name: "Rachel",
    gender: "Female",
    accent: "American",
    description: "Calm and professional",
    category: "Professional",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/21m00Tcm4TlvDq8ikWAM/b4928a68-c03b-411f-8533-3d5c299fd451.mp3",
  },
  {
    id: "Xb7hH8MSUJpSbSDYk0k2",
    name: "Alice",
    gender: "Female",
    accent: "British",
    description: "Clear and engaging",
    category: "Professional",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/Xb7hH8MSUJpSbSDYk0k2/d10f7534-11f6-41fe-a012-2de1e482d336.mp3",
  },
  {
    id: "onwK4e9ZLuTAKqWW03F9",
    name: "Daniel",
    gender: "Male",
    accent: "British",
    description: "Steady broadcaster",
    category: "Professional",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/onwK4e9ZLuTAKqWW03F9/7eee0236-1a72-4b86-b303-5dcadc007ba9.mp3",
  },
  {
    id: "pqHfZKP75CvOlQylNhV4",
    name: "Bill",
    gender: "Male",
    accent: "American",
    description: "Wise and balanced",
    category: "Warm & calm",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/pqHfZKP75CvOlQylNhV4/d782b3ff-84ba-4029-848c-acf01285524d.mp3",
  },
];

// Sample paid voices per category (representative — not exhaustive)
const PAID_VOICES: Record<string, { id: string; name: string; gender: string; accent: string; description: string; previewUrl: string }[]> = {
  Professional: [
    {
      id: "9BWtsMINqrJLrRacOk9x",
      name: "Aria",
      gender: "Female",
      accent: "American",
      description: "Informative and educational",
      previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/9BWtsMINqrJLrRacOk9x/405766b8-1f4e-4d3c-aba1-6f25333823ec.mp3",
    },
    {
      id: "nPczCjzI2devNBz1zQrb",
      name: "Brian",
      gender: "Male",
      accent: "American",
      description: "Deep and comforting",
      previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/nPczCjzI2devNBz1zQrb/2dd3e72c-4fd3-42f1-93ea-abc5d4e5aa1d.mp3",
    },
  ],
  "Warm & calm": [
    {
      id: "JBFqnCBsd6RMkjVDRZzb",
      name: "George",
      gender: "Male",
      accent: "British",
      description: "Warm storyteller",
      previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/JBFqnCBsd6RMkjVDRZzb/e6206d1a-0721-4787-aafb-06a6e705cac5.mp3",
    },
    {
      id: "SAz9YHcvj6GT2YYXdXww",
      name: "River",
      gender: "Neutral",
      accent: "American",
      description: "Relaxed and informative",
      previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/SAz9YHcvj6GT2YYXdXww/e6c95f0b-2227-491a-b3d7-2249240decb7.mp3",
    },
  ],
  Expressive: [
    {
      id: "FGY2WhTYpPnrIDTdsKH5",
      name: "Laura",
      gender: "Female",
      accent: "American",
      description: "Enthusiastic and lively",
      previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/FGY2WhTYpPnrIDTdsKH5/67341759-ad08-41a5-be6e-de12fe448618.mp3",
    },
    {
      id: "IKne3meq5aSn9XLyUdCD",
      name: "Charlie",
      gender: "Male",
      accent: "Australian",
      description: "Deep, confident, energetic",
      previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/IKne3meq5aSn9XLyUdCD/102de6f2-22ed-43e0-a1f1-111fa75c5481.mp3",
    },
  ],
};

const TABS = ["All", "Professional", "Warm & calm", "Expressive", "Custom voice"] as const;
type Tab = (typeof TABS)[number];

export default function VoiceShowcaseSection() {
  const [tab, setTab] = useState<Tab>("All");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

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

  // Build voice list for current tab
  const visibleVoices = (() => {
    if (tab === "All") return FREE_VOICES;
    if (tab === "Custom voice") return [];
    const free = FREE_VOICES.filter((v) => v.category === tab);
    const paid = (PAID_VOICES[tab] ?? []).map((v) => ({ ...v, category: tab, isPaid: true }));
    return [...free, ...paid];
  })();

  return (
    <div className="reveal">
      <p className="text-xs font-medium text-purple-600 text-center mb-4 tracking-widest uppercase">
        Voices
      </p>
      <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 text-center mb-4">
        Pick a voice — or create your own
      </h2>
      <p className="text-sm text-gray-500 text-center max-w-lg mx-auto mb-6 leading-relaxed">
        Choose from documentary-quality narrators across different styles, design a custom voice from a prompt, or clone your own by uploading a sample.
      </p>

      <div className="glass-card p-6 sm:p-8 rounded-xl hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all max-w-2xl mx-auto">
        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                tab === t ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Voice list */}
        {tab !== "Custom voice" && (
          <div className="flex flex-col gap-3">
            {visibleVoices.map((v) => {
              const isPaid = "isPaid" in v && v.isPaid;
              return (
                <VoiceItem
                  key={v.id}
                  name={v.name}
                  subtitle={formatVoiceSubtitle(v.gender, v.accent, v.description)}
                  hasPreview={true}
                  isPlaying={playingId === v.id}
                  onPlay={() => handlePlay(v.id, v.previewUrl)}
                  badge={
                    isPaid ? (
                      <span className="flex-shrink-0 px-2 py-0.5 text-[10px] font-semibold bg-purple-100 text-purple-600 rounded-full">
                        Premium
                      </span>
                    ) : undefined
                  }
                />
              );
            })}
          </div>
        )}

        {/* Custom voice tab content */}
        {tab === "Custom voice" && (
          <div className="flex flex-col gap-3">
            {/* Design from prompt */}
            <div className="rounded-xl border-2 border-dashed border-purple-200 bg-purple-50/40 p-5">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h6m-6 4h10M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-800">Design from a prompt</span>
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-purple-100 text-purple-600 rounded-full">Pro</span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Describe the voice you want — age, tone, accent, style — and we'll generate it instantly.
                  </p>
                  <p className="text-[11px] text-purple-500 mt-2 font-medium italic">
                    "A calm 40-year-old British man, authoritative but approachable"
                  </p>
                </div>
              </div>
            </div>

            {/* Clone your voice */}
            <div className="rounded-xl border-2 border-dashed border-purple-200 bg-purple-50/40 p-5">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-800">Clone your voice</span>
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-purple-100 text-purple-600 rounded-full">Pro</span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Upload a 1–5 minute audio sample and we'll clone it. Your content, your actual voice.
                  </p>
                </div>
              </div>
            </div>

            {/* Use preset form */}
            <div className="rounded-xl border-2 border-dashed border-purple-200 bg-purple-50/40 p-5">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-800">Build from presets</span>
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-purple-100 text-purple-600 rounded-full">Pro</span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Pick gender, age, accent, speed and persona from dropdowns — we'll generate a matching voice.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center mt-5 leading-relaxed">
          4 prebuilt voices on all plans · Premium library + voice creation on Pro
        </p>
      </div>
    </div>
  );
}
