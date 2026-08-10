import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DocumentInput, { type DocumentPayload } from "./DocumentInput";
import { GateHint, useSignupGate } from "./SignupGate";
import { EmptyState, PrimaryButton, SecondaryButton, StatTile, ToolShell } from "./shared";
import {
  countWords,
  formatDuration,
  NARRATION_WPM,
  secondsForWords,
  splitToWordLimit,
} from "../../lib/docAnalysis";

/**
 * PDF → audio.
 *
 * The free shell reads the document aloud with the browser's own speech
 * synthesiser. That is a real, working answer to "read my PDF to me" — it plays
 * immediately, costs nothing, and needs no account — while being obviously
 * distinct from what we sell: the browser voice is robotic and, by design of the
 * Web Speech API, cannot be captured to a file.
 *
 * So the gate is not artificial. Downloading an MP3, choosing a studio voice,
 * and putting that narration over visuals genuinely require our backend.
 */

interface VoiceOption {
  name: string;
  lang: string;
}

const RATES = [
  { label: "0.9×", value: 0.9 },
  { label: "1×", value: 1 },
  { label: "1.25×", value: 1.25 },
  { label: "1.5×", value: 1.5 },
];

export default function PdfToAudio() {
  const [doc, setDoc] = useState<DocumentPayload>({ text: "", fileName: null, pageCount: 0 });
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voiceName, setVoiceName] = useState("");
  const [rate, setRate] = useState(1);
  const [speaking, setSpeaking] = useState(false);
  const [chunkIndex, setChunkIndex] = useState(0);
  const [unsupported, setUnsupported] = useState(false);
  const chunkRef = useRef(0);

  const { requireAuth, gateModal } = useSignupGate({
    eyebrow: "Free PDF tool",
    headline: "Download studio narration — or the whole video",
    blurb:
      "Browser voices can play but can't be saved. A free account gives you real narrator voices, an MP3 you can keep, and the option to put it over your figures.",
    bullets: [
      "40+ natural narrator voices, 30+ languages",
      "Download the audio, or the finished MP4",
      "Free account, no card required",
    ],
  });

  // The voice list populates asynchronously in most browsers, so one read on
  // mount is not enough — the change event is the only reliable trigger.
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setUnsupported(true);
      return;
    }
    const load = () => {
      const available = window.speechSynthesis
        .getVoices()
        .filter((voice) => voice.lang.startsWith("en"))
        .map((voice) => ({ name: voice.name, lang: voice.lang }));
      setVoices(available);
      setVoiceName((current) => current || available[0]?.name || "");
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      window.speechSynthesis.cancel();
    };
  }, []);

  // Long utterances are cut off by several engines, so the text is spoken in
  // chunks and advanced manually rather than queued in one go.
  const chunks = useMemo(
    () => (doc.text.trim() ? splitToWordLimit(doc.text, 60) : []),
    [doc.text]
  );

  const stop = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
    setChunkIndex(0);
    chunkRef.current = 0;
  }, []);

  useEffect(() => stop, [stop]);
  useEffect(() => {
    stop();
  }, [doc.text, stop]);

  const speakFrom = useCallback(
    (start: number) => {
      if (!("speechSynthesis" in window) || start >= chunks.length) {
        setSpeaking(false);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(chunks[start]);
      const match = window.speechSynthesis.getVoices().find((voice) => voice.name === voiceName);
      if (match) utterance.voice = match;
      utterance.rate = rate;
      utterance.onend = () => {
        const next = chunkRef.current + 1;
        chunkRef.current = next;
        setChunkIndex(next);
        if (next < chunks.length) speakFrom(next);
        else setSpeaking(false);
      };
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
    },
    [chunks, rate, voiceName]
  );

  const play = () => {
    if (!chunks.length) return;
    window.speechSynthesis.cancel();
    chunkRef.current = 0;
    setChunkIndex(0);
    setSpeaking(true);
    speakFrom(0);
  };

  const words = countWords(doc.text);
  const seconds = secondsForWords(words) / rate;
  const progress = chunks.length ? Math.round((chunkIndex / chunks.length) * 100) : 0;

  return (
    <ToolShell>
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <DocumentInput onDocument={setDoc} label="PDF or text" />

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="pdf-to-audio-voice"
                className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-gray-400"
              >
                Preview voice
              </label>
              <select
                id="pdf-to-audio-voice"
                value={voiceName}
                onChange={(event) => setVoiceName(event.target.value)}
                disabled={!voices.length}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500/40 disabled:text-gray-400"
              >
                {voices.length ? (
                  voices.map((voice) => (
                    <option key={voice.name} value={voice.name}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))
                ) : (
                  <option>No browser voices found</option>
                )}
              </select>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-400">
                Speed
              </p>
              <div className="flex gap-1.5">
                {RATES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRate(option.value)}
                    className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition ${
                      rate === option.value
                        ? "border-purple-200 bg-purple-50 text-purple-700"
                        : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-gray-400">
            These are the voices already installed on your device. They play instantly and sound
            like it — the studio voices behind the button on the right are a different thing
            entirely.
          </p>
        </div>

        <div>
          {!doc.text.trim() ? (
            <EmptyState>
              Drop a PDF and press play. It reads aloud in your browser — nothing uploaded, no
              account, no waiting on a queue.
            </EmptyState>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <StatTile label="Words" value={words.toLocaleString()} />
                <StatTile label="Listen time" value={formatDuration(seconds)} sub={`${NARRATION_WPM} wpm × ${rate}`} />
                <StatTile label="Segments" value={String(chunks.length)} />
              </div>

              {unsupported ? (
                <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-700">
                  This browser has no speech synthesiser, so the free preview can't play here. The
                  word and runtime numbers above are still accurate.
                </p>
              ) : (
                <>
                  <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50/70 p-5">
                    <div className="flex items-center gap-3">
                      {speaking ? (
                        <SecondaryButton onClick={stop}>■ Stop</SecondaryButton>
                      ) : (
                        <SecondaryButton onClick={play} disabled={!chunks.length}>
                          ▶ Play in browser
                        </SecondaryButton>
                      )}
                      <span className="text-xs tabular-nums text-gray-500">
                        {speaking ? `Segment ${chunkIndex + 1} of ${chunks.length}` : "Free preview"}
                      </span>
                    </div>
                    <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-purple-500 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {chunks.length > 0 ? (
                    <div className="mt-4 max-h-48 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4">
                      <p className="text-sm leading-relaxed text-gray-600">
                        {chunks[Math.min(chunkIndex, chunks.length - 1)]}
                      </p>
                    </div>
                  ) : null}
                </>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                <PrimaryButton onClick={requireAuth}>Get studio narration + video →</PrimaryButton>
              </div>
              <GateHint>
                Browser speech can be played but not saved — that's a limit of the Web Speech API,
                not a paywall. For an MP3 or a video, the audio has to be rendered on our side.
              </GateHint>
            </>
          )}
        </div>
      </div>
      {gateModal}
    </ToolShell>
  );
}
