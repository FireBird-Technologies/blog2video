import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import type { CredentialResponse } from "@react-oauth/google";
import { useAuth } from "../../hooks/useAuth";
import { googleLogin } from "../../api/client";
import GoogleAuthButton from "../public/GoogleAuthButton";

/** Where a document continues — Step 1 of the create flow with the upload tab open. */
const UPLOAD_STEP_PATH = "/dashboard?mode=upload";

const MAX_UPLOAD_FILES = 5;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".pptx", ".md", ".markdown", ".txt", ".vtt"];

/** Mirrors BlogUrlForm's formatter so the file rows read identically. */
function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function hasAllowedExtension(name: string) {
  const lower = name.toLowerCase();
  return ALLOWED_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

export default function PdfToVideoConverter() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const docInputRef = useRef<HTMLInputElement | null>(null);

  const [mode, setMode] = useState<"url" | "upload">("upload");
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [docError, setDocError] = useState("");
  /** Set by Continue — the sign-up prompt is a response to that click, not to picking a file. */
  const [signUpRequested, setSignUpRequested] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState("");

  const goToUpload = () => navigate(UPLOAD_STEP_PATH);

  const addDocFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const incoming = Array.from(list);

    const rejected = incoming.find((file) => !hasAllowedExtension(file.name));
    if (rejected) {
      setDocError("Unsupported file type. Use PDF, Word, PowerPoint, Markdown, Text, or VTT.");
      return;
    }
    const tooLarge = incoming.find((file) => file.size > MAX_FILE_BYTES);
    if (tooLarge) {
      setDocError(`${tooLarge.name} is larger than 5 MB.`);
      return;
    }

    const combined = [...docFiles, ...incoming].slice(0, MAX_UPLOAD_FILES);
    setDocError(
      docFiles.length + incoming.length > MAX_UPLOAD_FILES
        ? `Only the first ${MAX_UPLOAD_FILES} files are kept.`
        : ""
    );
    setDocFiles(combined);
  };

  const addPastedTextAsTxtFile = (text: string) => {
    const file = new File([text], `pasted-${Date.now()}.txt`, { type: "text/plain" });
    addDocFiles({ 0: file, length: 1, item: () => file } as unknown as FileList);
  };

  const removeDocFile = (index: number) => {
    setDocFiles((files) => files.filter((_, i) => i !== index));
    setDocError("");
  };

  const canContinue = mode === "upload" ? docFiles.length > 0 : url.trim().length > 0;

  const handleContinue = () => {
    if (!canContinue) return;
    if (user) {
      goToUpload();
      return;
    }
    setSignUpRequested(true);
  };

  const closeSignUp = () => {
    if (signingIn) return;
    setSignUpRequested(false);
    setSignInError("");
  };

  // While the popup is open: close on Escape and lock background scroll.
  useEffect(() => {
    if (!signUpRequested || user) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSignUp();
    };
    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signUpRequested, user, signingIn]);

  const handleGoogleSuccess = async (response: CredentialResponse) => {
    if (!response.credential) return;
    setSigningIn(true);
    setSignInError("");
    try {
      const res = await googleLogin(
        response.credential,
        false,
        localStorage.getItem("b2v_ref_code")
      );
      localStorage.removeItem("b2v_ref_code");
      login(res.data.access_token, res.data.user, { createdNewUser: res.data.created_new_user, metaEventId: res.data.meta_event_id });
      goToUpload();
    } catch {
      setSignInError("Sign-up failed. Please try again.");
      setSigningIn(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="glass-card p-7">
        <div className="flex flex-col space-y-5">
          {/* Mode tabs — selected tab purple */}
          <div className="flex gap-1 p-1 bg-gray-100/60 rounded-xl w-fit">
            {(["url", "upload"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  mode === m
                    ? "bg-white text-purple-600 shadow-sm"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {m === "url" ? "Link" : "Upload"}
              </button>
            ))}
          </div>

          {/* Blog URL */}
          {mode === "url" && (
            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                Blog URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/your-article"
                className="w-full px-4 py-2.5 bg-white/80 border border-gray-200/60 rounded-xl text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-transparent transition-all"
              />
            </div>
          )}

          {/* Document upload */}
          {mode === "upload" && (
            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                Documents{" "}
                <span className="text-gray-300 font-normal">(max 5 files, 5 MB each)</span>
              </label>
              <div
                role="button"
                tabIndex={0}
                aria-label="Upload documents or paste text"
                className="relative border-2 border-dashed border-gray-200/80 rounded-xl p-6 text-center hover:border-purple-400/60 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                onClick={() => docInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    docInputRef.current?.click();
                  }
                }}
                onPaste={(e) => {
                  e.stopPropagation();
                  const cd = e.clipboardData;
                  if (cd.files && cd.files.length > 0) {
                    e.preventDefault();
                    addDocFiles(cd.files);
                    return;
                  }
                  const text = cd.getData("text/plain");
                  const trimmed = text?.trim() ?? "";
                  if (trimmed) {
                    e.preventDefault();
                    addPastedTextAsTxtFile(trimmed);
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add("border-purple-400/60", "bg-purple-50/30");
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("border-purple-400/60", "bg-purple-50/30");
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("border-purple-400/60", "bg-purple-50/30");
                  addDocFiles(e.dataTransfer.files);
                }}
              >
                <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm text-gray-500">
                  Drop files here or <span className="text-purple-600 font-medium">paste text (Ctrl+V)</span>
                </p>
                <p className="text-[10px] text-gray-300 mt-1">PDF, Word, PowerPoint, Markdown, Text, VTT — or paste plain text as a .txt file</p>
                <input
                  ref={docInputRef}
                  type="file"
                  accept=".pdf,.docx,.pptx,.md,.markdown,.txt,.vtt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/markdown,text/x-markdown,text/vtt"
                  multiple
                  className="hidden"
                  onChange={(e) => { addDocFiles(e.target.files); e.target.value = ""; }}
                />
              </div>
              {docError && <p className="mt-2 text-[11px] text-red-500">{docError}</p>}
              {docFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {docFiles.map((file, i) => (
                    <div key={`${file.name}-${i}`} className="flex items-center gap-3 px-4 py-3 bg-gray-50/80 rounded-xl border border-gray-200/60">
                      <svg
                        className={`w-6 h-6 flex-shrink-0 ${file.name.endsWith(".pdf") ? "text-red-400" : file.name.endsWith(".docx") ? "text-blue-400" : "text-orange-400"}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                      </svg>
                      <span className="flex-1 text-sm text-gray-700 truncate font-medium">{file.name}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">{formatFileSize(file.size)}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeDocFile(i); }}
                        className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200/60 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Project name */}
          <div>
            <label className="block text-[11px] font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
              Project Name <span className="text-gray-300 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={mode === "url" ? "Auto-generated from URL" : "Auto-generated from file name"}
              className="w-full px-4 py-2.5 bg-white/80 border border-gray-200/60 rounded-xl text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-transparent transition-all"
            />
          </div>

          <button
            type="button"
            onClick={handleContinue}
            disabled={!canContinue}
            className="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-100 disabled:text-gray-400 text-white text-sm font-medium rounded-xl transition-colors"
          >
            Continue
          </button>
        </div>
      </div>

      {/* Sign-up popup — triggered by Continue. */}
      {signUpRequested &&
        !user &&
        ReactDOM.createPortal(
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={closeSignUp}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Create a free account to continue"
              className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white p-8 text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={closeSignUp}
                aria-label="Close"
                className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-100 bg-purple-50">
                <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>

              <h2 className="mt-5 text-xl font-semibold text-gray-900">
                Create a free account to continue
              </h2>
              <p className="mx-auto mt-2.5 text-sm leading-relaxed text-gray-500">
                Sign up with Google — no credit card required. You land straight on the upload
                step, where you can select your file and generate the video.
              </p>

              <div className="mt-6 flex justify-center">
                {signingIn ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <svg className="h-4 w-4 animate-spin text-purple-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Setting up your account…
                  </div>
                ) : (
                  <GoogleAuthButton
                    onSuccess={handleGoogleSuccess}
                    onError={() => setSignInError("Sign-up failed. Please try again.")}
                    text="signup_with"
                    width="320"
                  />
                )}
              </div>

              {signInError ? <p className="mt-3 text-xs text-red-500">{signInError}</p> : null}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
