import { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  listCustomTemplates,
  deleteCustomTemplate,
  regenerateTemplateCode,
  generateTemplateCode,
  type CustomTemplateItem,
} from "../api/client";
import { sendCustomTemplateRequest } from "../api/enterprise";
import { preloadBabel } from "../utils/compileComponent";
import CustomTemplateCreator from "../components/CustomTemplateCreator";
import CustomTemplateEditor from "../components/CustomTemplateEditor";
import CustomPreview from "../components/templatePreviews/CustomPreview";
import { VIDEO_STYLE_OPTIONS, normalizeVideoStyle, type VideoStyleId } from "../constants/videoStyles";

const STYLE_LABELS = Object.fromEntries(VIDEO_STYLE_OPTIONS.map((s) => [s.id, s.label])) as Record<string, string>;

// ─── Request Form Modal ───────────────────────────────────────
interface RequestModalProps {
  description: string;
  companyInformation: string;
  altContact: string;
  loading: boolean;
  success: boolean;
  error: string | null;
  onDescriptionChange: (v: string) => void;
  onCompanyInformationChange: (v: string) => void;
  onAltContactChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

function CustomTemplateRequestModal({
  description,
  companyInformation,
  altContact,
  loading,
  success,
  error,
  onDescriptionChange,
  onCompanyInformationChange,
  onAltContactChange,
  onSubmit,
  onClose,
}: RequestModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        {success ? (
          <div className="flex flex-col items-center py-8 text-center gap-4">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
              <svg
                className="w-7 h-7 text-green-600"
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
            </div>

            <h3 className="text-lg font-semibold text-gray-900">
              Request Successfully Sent
            </h3>

            <p className="text-sm text-gray-500 max-w-sm">
              Our design team will review your request and reach out with next
              steps shortly. We’re excited to bring your vision to life.
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Get Expert Help Creating Your Template
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Share your ideas and preferences, and our experts will understand your brand and craft a custom template tailored just for you.
                </p>
              </div>

              <button
                onClick={onClose}
                className="ml-4 shrink-0 text-gray-400 hover:text-gray-600 transition"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={onSubmit} className="space-y-5">

              {/* Contact */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alternate Contact{" "}
                  <span className="text-gray-400 font-normal">
                    (optional)
                  </span>
                </label>

                <input
                  type="text"
                  maxLength={300}
                  value={altContact}
                  onChange={(e) =>
                    onAltContactChange(e.target.value)
                  }
                  placeholder="Alternate email etc"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>


              {/* Company Info */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company / Brand Information{" "}
                  <span className="text-gray-400 font-normal">
                    (optional)
                  </span>
                </label>

                <textarea
                  rows={3}
                  maxLength={2000}
                  value={companyInformation}
                  onChange={(e) =>
                    onCompanyInformationChange(e.target.value)
                  }
                  placeholder="Provide context about your company"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
                />

                <p className="text-xs text-gray-400 mt-1 text-right">
                  {companyInformation.length}/2000
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Vision / Requirements{" "}
                  <span className="text-red-400">*</span>
                </label>

                <textarea
                  required
                  rows={5}
                  maxLength={3000}
                  value={description}
                  onChange={(e) =>
                    onDescriptionChange(e.target.value)
                  }
                  placeholder="Describe your ideal template..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
                />

                <p className="text-xs text-gray-400 mt-1 text-right">
                  {description.length}/3000
                </p>
              </div>

              {/* Error */}
              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading || !description.trim()}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {loading && (
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      />
                    </svg>
                  )}

                  {loading ? "Submitting Request…" : "Submit Request"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function CustomTemplates() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<CustomTemplateItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showCreator, setShowCreator] = useState(false);
  const [creatorKey, setCreatorKey] = useState(0);
  const [creatorInitialVideoStyle, setCreatorInitialVideoStyle] = useState<VideoStyleId | undefined>(undefined);
  const [editTarget, setEditTarget] = useState<CustomTemplateItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomTemplateItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteImpactCount, setDeleteImpactCount] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestDescription, setRequestDescription] = useState("");
  const [requestCompanyInformation, setRequestCompanyInformation] = useState("");
  const [requestAltContact, setRequestAltContact] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadTemplates();
    preloadBabel();
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  // BlogUrlForm navigates with ?tab=templates&openCustomCreator=1&videoStyle=…
  useEffect(() => {
    if (searchParams.get("openCustomCreator") !== "1") return;
    const style = normalizeVideoStyle(searchParams.get("videoStyle"));
    setCreatorInitialVideoStyle(style);
    setCreatorKey((k) => k + 1);
    setShowCreator(true);
    const next = new URLSearchParams(searchParams);
    next.delete("openCustomCreator");
    next.delete("videoStyle");
    const qs = next.toString();
    navigate(qs ? `/dashboard?${qs}` : "/dashboard", { replace: true });
  }, [searchParams, navigate]);

  const loadTemplates = async () => {
    try {
      const res = await listCustomTemplates();
      setTemplates(res.data);
      startPollingIfNeeded(res.data);
    } catch (err) {
      console.error("Failed to load custom templates:", err);
    } finally {
      setLoaded(true);
    }
  };

  // Merge only pending/failed templates from server — leaves completed ones untouched to avoid resetting preview
  const mergePendingTemplates = (fresh: CustomTemplateItem[]) => {
    setTemplates((prev) => prev.map((t) => {
      if (t.intro_code) return t; // already complete — don't replace
      const updated = fresh.find((f) => f.id === t.id);
      return updated ?? t;
    }));
  };

  const startPollingIfNeeded = (data: CustomTemplateItem[]) => {
    const anyPending = data.some((t: CustomTemplateItem) => !t.intro_code && !t.generation_failed);
    if (anyPending && !pollingRef.current) {
      pollingRef.current = setInterval(async () => {
        try {
          const r = await listCustomTemplates();
          mergePendingTemplates(r.data);
          const stillPending = r.data.some((t: CustomTemplateItem) => !t.intro_code && !t.generation_failed);
          if (!stillPending) {
            clearInterval(pollingRef.current!);
            pollingRef.current = null;
          }
        } catch { /* ignore */ }
      }, 4000);
    } else if (!anyPending && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const handleCreated = (tpl: CustomTemplateItem) => {
    setTemplates((prev) => [tpl, ...prev]);
    setShowCreator(false);
    setCreatorInitialVideoStyle(undefined);
    startPollingIfNeeded([tpl]);
  };

  const handleSaved = (tpl: CustomTemplateItem) => {
    setTemplates((prev) => prev.map((t) => (t.id === tpl.id ? tpl : t)));
    setEditTarget(null);
  };

  const handleRegenerate = async (tpl: CustomTemplateItem) => {
    setRegeneratingId(tpl.id);
    try {
      if (!tpl.intro_code) {
        // First-time generation (failed previously) — fire and poll
        await generateTemplateCode(tpl.id);
        setTimeout(() => loadTemplates(), 5000);
      } else {
        const res = await regenerateTemplateCode(tpl.id);
        setTemplates((prev) => prev.map((t) => (t.id === tpl.id ? res.data : t)));
        setTimeout(() => loadTemplates(), 5000);
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 429) {
        setRateLimitError(typeof detail === "string" ? detail : "Daily AI generation limit reached. Try again tomorrow.");
      } else {
        console.error("Failed to regenerate template code:", err);
      }
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteCustomTemplate(deleteTarget.id, deleteImpactCount != null);
      setTemplates((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
      setDeleteImpactCount(null);
    } catch (err) {
      const detail = (err as {
        response?: { data?: { detail?: string | { code?: string; message?: string; project_count?: number } } };
      })?.response?.data?.detail;
      if (
        detail &&
        typeof detail === "object" &&
        detail.code === "template_in_use"
      ) {
        setDeleteImpactCount(typeof detail.project_count === "number" ? detail.project_count : 0);
        setDeleteError(detail.message || null);
      } else {
        console.error("Failed to delete template:", err);
        setDeleteError(
          typeof detail === "string"
            ? detail
            : "Failed to delete template. Please try again."
        );
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestDescription.trim()) return;
    setRequestLoading(true);
    setRequestError(null);
    try {
      await sendCustomTemplateRequest({
        description: requestDescription.trim(),
        alternate_contact: requestAltContact.trim() || undefined,
        company_information: requestCompanyInformation.trim() || undefined,
      });
      setRequestSuccess(true);
      setTimeout(() => {
        setShowRequestForm(false);
        setRequestSuccess(false);
        setRequestDescription("");
        setRequestCompanyInformation("");
        setRequestAltContact("");
      }, 3000);
    } catch {
      setRequestError("Failed to send request. Please try again.");
    } finally {
      setRequestLoading(false);
    }
  };

  const openRequestForm = () => {
    setRequestSuccess(false);
    setRequestError(null);
    setShowRequestForm(true);
  };

  // ─── Empty state ──────────────────────────────────────────
  if (loaded && templates.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 mb-4 bg-purple-100 rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No custom templates yet</h3>
          <p className="text-sm text-gray-400 mb-6 max-w-sm">
            Create your first custom template by providing a website URL. We'll extract
            colors, fonts, and style to build a video template that matches your brand.
          </p>
          <button
            onClick={() => {
              setCreatorInitialVideoStyle(undefined);
              setCreatorKey((k) => k + 1);
              setShowCreator(true);
            }}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            + Create Custom Template
          </button>
          <button
            onClick={openRequestForm}
            className="mt-3 text-sm text-purple-500 hover:text-purple-700 transition-colors underline underline-offset-2"
          >
           Get The Experts Help →
          </button>
        </div>

        {showRequestForm && ReactDOM.createPortal(
          <CustomTemplateRequestModal
            description={requestDescription}
            companyInformation={requestCompanyInformation}
            altContact={requestAltContact}
            loading={requestLoading}
            success={requestSuccess}
            error={requestError}
            onDescriptionChange={setRequestDescription}
            onCompanyInformationChange={setRequestCompanyInformation}
            onAltContactChange={setRequestAltContact}
            onSubmit={handleRequestSubmit}
            onClose={() => { setShowRequestForm(false); setRequestSuccess(false); setRequestError(null); }}
          />,
          document.body
        )}

        {showCreator && (
          <CustomTemplateCreator
            key={creatorKey}
            initialVideoStyle={creatorInitialVideoStyle}
            onCreated={handleCreated}
            onCancel={() => {
              setShowCreator(false);
              setCreatorInitialVideoStyle(undefined);
            }}
          />
        )}
      </>
    );
  }

  // ─── Template grid ────────────────────────────────────────
  return (
    <>
      <div className="space-y-6">
        {/* Rate limit banner */}
        {rateLimitError && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            <span>{rateLimitError}</span>
            <button onClick={() => setRateLimitError(null)} className="shrink-0 text-amber-500 hover:text-amber-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Custom Templates
            <span className="text-sm font-normal text-gray-400 ml-2">({templates.length})</span>
          </h2>
          <div className="flex items-center gap-4">
            {/* Primary Action */}
            <button
              onClick={() => {
                setCreatorInitialVideoStyle(undefined);
                setCreatorKey((k) => k + 1);
                setShowCreator(true);
              }}
              className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white text-sm font-semibold rounded-xl shadow-sm transition-all duration-200"
            >
              Create New +
            </button>

            {/* Secondary Action */}
            <button
              onClick={openRequestForm}
              className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white text-sm font-semibold rounded-xl shadow-sm transition-all duration-200"
            >
              Get Expert Template
            </button>
          </div>
        </div>

        {/* Grid */}
        {!loaded ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass-card p-4 animate-pulse">
                <div className="w-full aspect-video bg-gray-200 rounded-lg mb-3" />
                <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((tpl) => (
              <div key={tpl.id} className="glass-card overflow-hidden group">
                {/* Template preview */}
                <div className="relative overflow-hidden rounded-t-xl min-h-[120px] aspect-video">
                  {tpl.intro_code ? (
                    <CustomPreview
                      theme={tpl.theme}
                      name={tpl.name}
                      introCode={tpl.intro_code || undefined}
                      outroCode={tpl.outro_code || undefined}
                      contentCodes={tpl.content_codes || undefined}
                      contentArchetypeIds={tpl.content_archetype_ids || undefined}
                      previewImageUrl={tpl.preview_image_url}
                      logoUrls={tpl.logo_urls}
                      ogImage={tpl.og_image}
                    />
                  ) : (
                    <div
                      className="w-full h-full flex flex-col items-center justify-center gap-3"
                      style={{ background: tpl.theme.colors.bg, aspectRatio: "16/9" }}
                    >
                      {tpl.generation_failed && regeneratingId !== tpl.id ? (
                        <>
                          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: tpl.theme.colors.muted }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                          </svg>
                          <span className="text-xs font-medium" style={{ color: tpl.theme.colors.muted }}>
                            Generation failed
                          </span>
                        </>
                      ) : (
                        <>
                          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${tpl.theme.colors.accent}40`, borderTopColor: "transparent" }} />
                          <span className="text-xs font-medium" style={{ color: tpl.theme.colors.muted }}>
                            Generating...
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-4">
                  {/* Name */}
                  <h3 className="text-sm font-semibold text-gray-900 truncate mb-1">
                    {tpl.name}
                  </h3>

                  {/* Style pills */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    <span className="shrink-0 px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 text-[10px] font-medium">
                      {STYLE_LABELS[tpl.supported_video_style] ?? tpl.supported_video_style}
                    </span>
                    <span className="shrink-0 px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 text-[10px] font-medium">
                      {tpl.theme.colors.bg2 ? "Gradient" : "Solid"}
                    </span>
                    {tpl.theme.patterns && [
                      `${tpl.theme.patterns.cards?.corners || "rounded"} cards`,
                      `${tpl.theme.patterns.spacing?.density || "balanced"} spacing`,
                      `${tpl.theme.patterns.images?.treatment || "rounded"} images`,
                      tpl.theme.patterns.layout?.direction || "centered",
                    ].map((tag) => (
                      <span key={tag} className="shrink-0 px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 text-[10px] font-medium capitalize">
                        {tag}
                      </span>
                    ))}
                    {/* theme.style text — commented out */}
                    {/* <span className="text-[10px] text-gray-400 truncate">{tpl.theme.style}</span> */}
                  </div>

                  {/* Actions */}
                  {!tpl.intro_code ? (
                    tpl.generation_failed ? (
                      regeneratingId === tpl.id ? (
                        <div className="flex items-center gap-2 text-xs text-purple-500">
                          <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                          Retrying...
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRegenerate(tpl)}
                            className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
                          >
                            Retry generation
                          </button>
                          <button
                            onClick={() => {
                              setDeleteTarget(tpl);
                              setDeleteImpactCount(null);
                              setDeleteError(null);
                            }}
                            className="flex-1 px-3 py-1.5 text-xs font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      )
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                        Generating template...
                      </div>
                    )
                  ) : regeneratingId === tpl.id ? (
                    <div className="flex items-center gap-2 text-xs text-purple-500">
                      <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                      Regenerating...
                    </div>
                  ) : (
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleRegenerate(tpl)}
                        className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
                        title="Generate a completely new design for this brand"
                      >
                        Regenerate
                      </button>
                      <button
                        onClick={() => setEditTarget(tpl)}
                        className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setDeleteTarget(tpl);
                          setDeleteImpactCount(null);
                          setDeleteError(null);
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Request form modal */}
      {showRequestForm && ReactDOM.createPortal(
        <CustomTemplateRequestModal
          description={requestDescription}
          companyInformation={requestCompanyInformation}
          altContact={requestAltContact}
          loading={requestLoading}
          success={requestSuccess}
          error={requestError}
          onDescriptionChange={setRequestDescription}
          onCompanyInformationChange={setRequestCompanyInformation}
          onAltContactChange={setRequestAltContact}
          onSubmit={handleRequestSubmit}
          onClose={() => { setShowRequestForm(false); setRequestSuccess(false); setRequestError(null); }}
        />,
        document.body
      )}

      {/* Creator modal */}
      {showCreator && (
        <CustomTemplateCreator
          key={creatorKey}
          initialVideoStyle={creatorInitialVideoStyle}
          onCreated={handleCreated}
          onCancel={() => {
            setShowCreator(false);
            setCreatorInitialVideoStyle(undefined);
          }}
        />
      )}

      {/* Editor modal */}
      {editTarget && (
        <CustomTemplateEditor
          template={editTarget}
          onSaved={handleSaved}
          onCancel={() => setEditTarget(null)}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && ReactDOM.createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setDeleteTarget(null);
              setDeleteImpactCount(null);
              setDeleteError(null);
            }}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Template</h3>
            <p className="text-sm text-gray-500 mb-5">
              {deleteImpactCount == null ? (
                <>
                  Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This action cannot be undone.
                </>
              ) : (
                <>
                  <strong>{deleteTarget.name}</strong> is currently used by {deleteImpactCount} project{deleteImpactCount === 1 ? "" : "s"}.
                  Deleting it will keep previews visible, but those projects will be blocked from future render and re-render actions.
                </>
              )}
            </p>
            {deleteError && (
              <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {deleteError}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteImpactCount(null);
                  setDeleteError(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-200 text-white text-sm font-medium rounded-xl transition-colors"
              >
                {deleting ? "Deleting..." : deleteImpactCount == null ? "Delete" : "Delete Anyway"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
