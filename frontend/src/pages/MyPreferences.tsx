import { useState, useEffect, useRef } from "react";
import {
  getMyPreferences,
  createPreference,
  updatePreference,
  deletePreference,
  type PreferenceFromAPI,
} from "../api/client";
import ReactDOM from "react-dom";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";
import { useErrorModal } from "../contexts/ErrorModalContext";

const ACCEPTED_EXT = [".txt", ".md", ".markdown"];
const MAX_BYTES = 25 * 1024; // 25 KB — matches backend cap

function isAcceptedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return ACCEPTED_EXT.some((ext) => name.endsWith(ext));
}

export default function MyPreferences() {
  const { showError } = useErrorModal();
  const [prefs, setPrefs] = useState<PreferenceFromAPI[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [styleName, setStyleName] = useState("");
  const [guideText, setGuideText] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PreferenceFromAPI | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Edit modal state
  const [editTarget, setEditTarget] = useState<PreferenceFromAPI | null>(null);
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const openEdit = (pref: PreferenceFromAPI) => {
    setEditTarget(pref);
    setEditName(pref.style_name);
    setEditContent(pref.content ?? "");
  };

  const handleUpdate = async () => {
    if (!editTarget) return;
    const name = editName.trim();
    const text = editContent.trim();
    if (!name) {
      showError("Give this preference a style name.");
      return;
    }
    if (!text) {
      showError("The Script can't be empty.");
      return;
    }
    if (new Blob([editContent]).size > MAX_BYTES) {
      showError(`Script must be under ${MAX_BYTES / 1024} KB.`);
      return;
    }
    setEditSaving(true);
    try {
      const res = await updatePreference(editTarget.id, {
        style_name: name,
        content: editContent,
      });
      setPrefs((prev) => prev.map((p) => (p.id === res.data.id ? res.data : p)));
      setEditTarget(null);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Could not save changes. Please try again.";
      showError(detail);
    } finally {
      setEditSaving(false);
    }
  };

  useEffect(() => {
    let active = true;
    getMyPreferences()
      .then((res) => {
        if (active) setPrefs(res.data);
      })
      .catch(() => {
        if (active) showError("Could not load your preferences. Please refresh.");
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const pickFile = (f: File | null) => {
    if (!f) return;
    if (!isAcceptedFile(f)) {
      showError("Please upload a .txt or .md file.");
      return;
    }
    if (f.size > MAX_BYTES) {
      showError(`File must be under ${MAX_BYTES / 1024} KB.`);
      return;
    }
    // Load the file's text into the editable textarea so upload and typing share
    // a single source of truth (the user can tweak it before saving).
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setGuideText(text);
    };
    reader.onerror = () => showError("Could not read that file.");
    reader.readAsText(f);
    if (!styleName.trim()) {
      // Prefill the style name from the filename (without extension).
      const base = f.name.replace(/\.[^.]+$/, "").trim();
      if (base) setStyleName(base);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async () => {
    const name = styleName.trim();
    if (!name) {
      showError("Give this preference a style name.");
      return;
    }
    const text = guideText.trim();
    if (!text) {
      showError("Type your script/description or upload a .txt/.md file.");
      return;
    }
    if (new Blob([guideText]).size > MAX_BYTES) {
      showError(`Script must be under ${MAX_BYTES / 1024} KB.`);
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("style_name", name);
      formData.append("content", guideText);
      const res = await createPreference(formData);
      setPrefs((prev) => [res.data, ...prev]);
      setStyleName("");
      setGuideText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Could not save preference. Please try again.";
      showError(detail);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (pref: PreferenceFromAPI) => {
    await deletePreference(pref.id);
    setPrefs((prev) => prev.filter((p) => p.id !== pref.id));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Style Preferences</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          Write or upload a description/script describing how you want your videos written —
          tone, structure, phrasing, dos and don'ts. Save it under a style name, then pick it in
          the style row when creating a video to steer the generated script.
        </p>
      </div>

      {/* Upload form */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Style name</label>
          <input
            type="text"
            value={styleName}
            onChange={(e) => setStyleName(e.target.value)}
            maxLength={255}
            placeholder="e.g. Brand Voice, Punchy Promo, Deep Explainer"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Description</label>
          <div className="flex flex-col gap-3 sm:flex-row">
            {/* 70% — typing box */}
            <textarea
              value={guideText}
              onChange={(e) => setGuideText(e.target.value)}
              placeholder="Type your style script/description here — tone, structure, phrasing, dos and don'ts…"
              rows={4}
              className="w-full sm:basis-[70%] resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />

            {/* 30% — file upload */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                pickFile(e.dataTransfer.files?.[0] ?? null);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-3 py-3 text-center transition-colors sm:basis-[30%] ${
                dragOver
                  ? "border-purple-400 bg-purple-50"
                  : "border-gray-300 hover:border-gray-400"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.markdown,text/plain,text/markdown"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
              <span className="text-sm text-gray-600">
                Drop a <span className="font-medium">.txt</span> or{" "}
                <span className="font-medium">.md</span> file, or click to browse
              </span>
              <span className="mt-1 text-xs text-gray-400">
                Loads into the box · Max {MAX_BYTES / 1024} KB
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-purple-700 disabled:pointer-events-none disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save preference"}
          </button>
        </div>
      </div>

      {/* Saved list (shown below the form) */}
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">
          Saved preferences
        </h3>

        {!loaded && (
          <div
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-white/70 px-4 py-8"
            role="status"
            aria-live="polite"
          >
            <span
              className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-purple-200 border-t-purple-500"
              aria-hidden
            />
            <p className="text-xs text-gray-500">Loading your preferences…</p>
          </div>
        )}

        {loaded && prefs.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white/70 px-4 py-8 text-center">
            <p className="text-xs text-gray-500">No preference created yet.</p>
          </div>
        )}

        {loaded && prefs.length > 0 && (
          <ul className="space-y-2">
            {prefs.map((pref) => (
              <li
                key={pref.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{pref.style_name}</p>
                  <p className="truncate text-xs text-gray-400">
                    {(pref.content ?? "").replace(/\s+/g, " ").trim() || "—"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(pref)}
                    title="Edit"
                    aria-label="Edit preference"
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(pref)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDeleteModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete preference?"
        subtitle={deleteTarget?.style_name}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (deleteTarget) await handleDelete(deleteTarget);
        }}
      />

      {/* Edit modal */}
      {editTarget !== null &&
        ReactDOM.createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={editSaving ? undefined : () => setEditTarget(null)}
              aria-hidden
            />
            <div
              className="relative mx-4 flex w-full max-w-2xl flex-col rounded-xl border border-gray-200 bg-white p-6 shadow-2xl"
              role="dialog"
              aria-modal="true"
            >
              <h3 className="mb-4 text-base font-semibold text-gray-900">Edit preference</h3>

              <label className="mb-1.5 block text-xs font-medium text-gray-600">Style name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={255}
                className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />

              <label className="mb-1.5 block text-xs font-medium text-gray-600">Description</label>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={12}
                className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />

              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  disabled={editSaving}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-900 disabled:pointer-events-none disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdate}
                  disabled={editSaving}
                  className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-purple-700 disabled:pointer-events-none disabled:opacity-60"
                >
                  {editSaving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
