import { useRef, useState } from "react";
import { convertEbook, type EbookDirection } from "../../api/freeTools";
import { GateHint, useSignupGate } from "./SignupGate";

const MAX_BYTES = 25 * 1024 * 1024;

const DIRECTIONS: Record<
  EbookDirection,
  { tab: string; from: string; to: string; accept: string; ext: string; outExt: string; blurb: string }
> = {
  "pdf-to-epub": {
    tab: "PDF → EPUB",
    from: "PDF",
    to: "EPUB",
    accept: ".pdf,application/pdf",
    ext: ".pdf",
    outExt: ".epub",
    blurb:
      "Reflowable text, real chapters, and a table of contents — readable on Kindle, Kobo, and Apple Books.",
  },
  "epub-to-pdf": {
    tab: "EPUB → PDF",
    from: "EPUB",
    to: "PDF",
    accept: ".epub,application/epub+zip",
    ext: ".epub",
    outExt: ".pdf",
    blurb: "A paginated A4 PDF with selectable text and embedded images, ready to print or share.",
  },
};

const GATE_COPY = {
  eyebrow: "Free converter",
  headline: "Sign in to download your converted file",
  blurb: "PDF and EPUB conversion is free with a Blog2Video account — no credit card required.",
  bullets: [
    "PDF to EPUB and EPUB to PDF, both directions",
    "Files are converted on the fly, not kept",
    "Includes the free video tools",
  ],
};

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function errorFromBlob(err: unknown, fallback: string): Promise<string> {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (data instanceof Blob) {
    try {
      const detail = JSON.parse(await data.text())?.detail;
      if (typeof detail === "string" && detail) return detail;
    } catch {
      /* fall through to the generic message */
    }
  }
  return fallback;
}

export default function EbookConverter({
  defaultDirection = "pdf-to-epub",
}: {
  defaultDirection?: EbookDirection;
}) {
  const [direction, setDirection] = useState<EbookDirection>(defaultDirection);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { isAuthed, requireAuth, gateModal } = useSignupGate(GATE_COPY);
  const cfg = DIRECTIONS[direction];

  const switchDirection = (next: EbookDirection) => {
    setDirection(next);
    setFile(null);
    setError("");
    setDone("");
  };

  const pick = (list: FileList | null) => {
    const picked = list?.[0];
    if (!picked) return;
    setDone("");
    if (!picked.name.toLowerCase().endsWith(cfg.ext)) {
      setFile(null);
      setError(`Please choose a ${cfg.from} file (${cfg.ext}).`);
      return;
    }
    if (picked.size > MAX_BYTES) {
      setFile(null);
      setError(`${picked.name} is larger than 25 MB.`);
      return;
    }
    setError("");
    setFile(picked);
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    setDone("");
    try {
      const res = await convertEbook(direction, file);
      const name = file.name.replace(/\.[^.]+$/, "") + cfg.outExt;
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
      setDone(name);
    } catch (err) {
      setError(await errorFromBlob(err, "Conversion failed. Please try a different file."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="glass-card p-7">
        <div
          role="tablist"
          aria-label="Conversion direction"
          className="flex w-fit gap-1 rounded-xl bg-gray-100/60 p-1"
        >
          {(Object.keys(DIRECTIONS) as EbookDirection[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={direction === key}
              onClick={() => switchDirection(key)}
              className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-all ${
                direction === key
                  ? "bg-white text-purple-600 shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {DIRECTIONS[key].tab}
            </button>
          ))}
        </div>

        <p className="mt-4 text-sm leading-relaxed text-gray-500">{cfg.blurb}</p>

        <div
          role="button"
          tabIndex={0}
          aria-label={`Choose a ${cfg.from} file`}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files);
          }}
          className={`mt-5 cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/40 ${
            dragging
              ? "border-purple-400 bg-purple-50/60"
              : "border-gray-200/80 hover:border-purple-400/60"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={cfg.accept}
            className="hidden"
            onChange={(e) => {
              pick(e.target.files);
              e.target.value = "";
            }}
          />
          {file ? (
            <p className="text-sm font-medium text-gray-800">
              {file.name}{" "}
              <span className="font-normal text-gray-400">· {formatSize(file.size)}</span>
            </p>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-700">
                Drop a {cfg.from} here, or click to browse
              </p>
              <p className="mt-1 text-xs text-gray-400">Up to 25 MB</p>
            </>
          )}
        </div>

        <button
          type="button"
          disabled={!file || busy}
          onClick={() => requireAuth(run)}
          className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-purple-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Converting…" : `Convert to ${cfg.to}`}
        </button>
        <GateHint isAuthed={isAuthed}>
          Free — sign in with a Blog2Video account to download the converted file.
        </GateHint>

        {error ? (
          <p role="alert" className="mt-3 text-sm text-red-500">
            {error}
          </p>
        ) : null}
        {done ? <p className="mt-3 text-sm text-green-600">Done — {done} was downloaded.</p> : null}
      </div>
      {gateModal}
    </div>
  );
}
