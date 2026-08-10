import { useRef, useState } from "react";
import { deleteAvatarPortrait, uploadAvatarPortrait } from "../api/client";
import AvatarPhotoGuide from "./AvatarPhotoGuide";



/**
 * Upload a presenter photo to use instead of the fixed roster.
 *
 * Deliberately shows the built-in portraits as worked examples rather than only
 * listing rules: "look like these" communicates framing far faster than prose,
 * and those five images are already the exact target framing (they were
 * normalised to a common eye-line and head size).
 */
export default function AvatarPortraitUpload({
  projectId,
  currentUrl,
  disabled = false,
  onChanged,
  onError,
}: {
  projectId: number;
  /** Existing uploaded photo, or null when using the roster. */
  currentUrl?: string | null;
  disabled?: boolean;
  onChanged: () => void | Promise<void>;
  onError: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    // Check client-side too so the user is not made to wait for an 8 MB round
    // trip only to be told no. The server still enforces both.
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      onError("Photo must be a PNG or JPEG image.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      onError("Photo is too large. Maximum size is 8 MB.");
      return;
    }
    setBusy(true);
    try {
      await uploadAvatarPortrait(projectId, file);
      await onChanged();
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Could not upload that photo.";
      onError(detail);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    try {
      await deleteAvatarPortrait(projectId);
      await onChanged();
    } catch {
      onError("Could not remove the photo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
          Your own presenter
        </h3>
        <p className="text-[11px] text-gray-400 leading-relaxed">
          Upload a photo to use instead of the built-in presenters. Once uploaded,
          pick <strong className="text-gray-500">Your photo</strong> as the
          presenter when generating a scene's avatar.
        </p>
      </div>

      <div className="flex items-start gap-4">
        {currentUrl ? (
          <img
            src={currentUrl}
            alt="Your uploaded presenter"
            className="w-20 h-20 rounded-xl object-cover border border-gray-200/60 flex-shrink-0"
          />
        ) : (
          <div className="w-20 h-20 rounded-xl bg-gray-50 border border-dashed border-gray-300 flex items-center justify-center flex-shrink-0">
            <svg
              className="w-6 h-6 text-gray-300"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 0115 0"
              />
            </svg>
          </div>
        )}

        <div className="flex flex-col gap-2 pt-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              void handleFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => inputRef.current?.click()}
              // While busy the button stays PURPLE with a spinner rather than
              // falling back to the grey disabled style: an upload in progress is
              // active work, and greying out reads as "unavailable" or broken. The
              // grey style is kept for the genuinely-disabled case.
              className={`px-3 py-1.5 text-white text-[11px] font-semibold rounded-lg transition-all inline-flex items-center gap-1.5 ${
                busy
                  ? "bg-purple-600 cursor-wait"
                  : "bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400"
              }`}
            >
              {busy && (
                <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              )}
              {busy ? "Uploading…" : currentUrl ? "Replace photo" : "Upload photo"}
            </button>
            {currentUrl && (
              <button
                type="button"
                disabled={disabled || busy}
                onClick={() => void handleRemove()}
                className="px-3 py-1.5 text-[11px] font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200/60 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {busy && (
                  <span className="w-3 h-3 border-2 border-gray-300 border-t-purple-600 rounded-full animate-spin" />
                )}
                Remove
              </button>
            )}
          </div>
          <span className="text-[10px] text-gray-400">
            PNG or JPEG · up to 8 MB
          </span>
        </div>
      </div>

      {/* Requirements + worked examples, always open: uploading IS the point of
          this section, so the guidance is primary content, not a footnote. */}
      <AvatarPhotoGuide variant="expanded" />
    </div>
  );
}
