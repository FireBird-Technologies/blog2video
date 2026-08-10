import { useEffect, useState } from "react";
import DocumentInput, { type DocumentPayload } from "./DocumentInput";
import { RequireLogin } from "./LoginGate";
import { EmptyState, PrimaryButton, SecondaryButton, StatTile, ToolShell } from "./shared";
import { narrateText, toolErrorMessage } from "../../api/pdfTools";
import { countWords, formatDuration, secondsForWords } from "../../lib/docAnalysis";

/**
 * PDF → narrated audio, synthesized server-side.
 *
 * This is a real ElevenLabs synthesis returning an mp3 the user can keep — not
 * the browser's speech API, which can play audio but exposes no way to capture
 * it to a file.
 *
 * One honest constraint drives the UI: the backend caps a single synthesis at
 * 5,000 characters, which is roughly twelve minutes of narration. Longer
 * documents are narrated in sections, and the section picker says so rather
 * than silently truncating.
 */

const MAX_CHARS = 5000;

const VOICES = [
  { id: "female", label: "Female" },
  { id: "male", label: "Male" },
];

/** Split at paragraph boundaries so a section never starts mid-sentence. */
function toSections(text: string): string[] {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const sections: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    // A single paragraph over the cap has to be hard-split; rare, but a 6,000
    // character wall of text must not silently vanish.
    if (paragraph.length > MAX_CHARS) {
      if (current) {
        sections.push(current);
        current = "";
      }
      for (let i = 0; i < paragraph.length; i += MAX_CHARS) {
        sections.push(paragraph.slice(i, i + MAX_CHARS));
      }
      continue;
    }
    if ((current + "\n\n" + paragraph).length > MAX_CHARS) {
      sections.push(current);
      current = paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }
  if (current) sections.push(current);
  return sections.length ? sections : [""];
}

function AudioWidget() {
  const [doc, setDoc] = useState<DocumentPayload | null>(null);
  const [voice, setVoice] = useState("female");
  const [sectionIndex, setSectionIndex] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const sections = doc ? toSections(doc.text) : [];
  const section = sections[sectionIndex] ?? "";

  // Object URLs leak until revoked, and a user auditioning voices will generate
  // several in a row.
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  useEffect(() => {
    setSectionIndex(0);
    setAudioUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }, [doc]);

  const run = async () => {
    if (!section) return;
    setBusy(true);
    setError("");
    try {
      const blob = await narrateText(section, voice);
      setAudioUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(blob);
      });
    } catch (err) {
      setError(await toolErrorMessage(err, "Narration failed. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const words = countWords(section);
  const baseName = (doc?.fileName ?? "narration").replace(/\.[^.]+$/, "");

  return (
    <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
      <div>
        <DocumentInput onDocument={setDoc} disabled={busy} />

        <div className="mt-5">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-400">
            Narrator voice
          </p>
          <div className="flex gap-2">
            {VOICES.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setVoice(option.id)}
                disabled={busy}
                className={`flex-1 rounded-xl border px-4 py-2.5 text-xs font-medium transition disabled:opacity-50 ${
                  voice === option.id
                    ? "border-purple-200 bg-purple-50 text-purple-700"
                    : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {sections.length > 1 ? (
          <div className="mt-5">
            <label
              htmlFor="pdf-audio-section"
              className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-gray-400"
            >
              Section
            </label>
            <select
              id="pdf-audio-section"
              value={sectionIndex}
              onChange={(event) => setSectionIndex(Number(event.target.value))}
              disabled={busy}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500/40 disabled:opacity-50"
            >
              {sections.map((_, index) => (
                <option key={index} value={index}>
                  Section {index + 1} of {sections.length}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs leading-relaxed text-gray-400">
              This document is longer than one synthesis can cover, so it is split into{" "}
              {sections.length} sections at paragraph boundaries. Narrate them one at a time.
            </p>
          </div>
        ) : null}

        <div className="mt-6">
          <PrimaryButton onClick={run} disabled={!section || busy}>
            {busy ? "Synthesising…" : "Narrate this section"}
          </PrimaryButton>
        </div>

        {error ? (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-600">
            {error}
          </p>
        ) : null}
      </div>

      <div>
        {!doc ? (
          <EmptyState>
            Upload a document to have it read aloud in a studio narrator voice, and download the
            mp3.
          </EmptyState>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <StatTile label="This section" value={words.toLocaleString()} sub="words" />
              <StatTile label="Listen time" value={formatDuration(secondsForWords(words))} />
              <StatTile label="Sections" value={String(sections.length)} />
            </div>

            <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50/70 p-5">
              {busy ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-purple-500/30 border-t-purple-500" />
                  Synthesising narration…
                </div>
              ) : audioUrl ? (
                <>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio controls src={audioUrl} className="w-full">
                    Your browser cannot play audio.
                  </audio>
                  <div className="mt-4">
                    <SecondaryButton
                      onClick={() => {
                        const anchor = document.createElement("a");
                        anchor.href = audioUrl;
                        anchor.download = `${baseName}-section-${sectionIndex + 1}.mp3`;
                        document.body.appendChild(anchor);
                        anchor.click();
                        document.body.removeChild(anchor);
                      }}
                    >
                      Download .mp3
                    </SecondaryButton>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500">
                  Press narrate to synthesise this section. It takes a few seconds.
                </p>
              )}
            </div>

            <div className="mt-4 max-h-64 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                What will be read
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
                {section}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function PdfToAudio() {
  return (
    <ToolShell>
      <RequireLogin
        copy={{
          headline: "Sign in to narrate your document",
          blurb:
            "Narration is synthesised in a studio voice on our servers and comes back as an mp3 you can keep. The browser's own speech API can play audio but cannot save it.",
          bullets: [
            "Natural narrator voices, not your device's robot voice",
            "Downloadable mp3, not just playback",
            "Free account, no card required",
          ],
        }}
      >
        <AudioWidget />
      </RequireLogin>
    </ToolShell>
  );
}
