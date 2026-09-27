declare const wp: {
  element: {
    createElement: (...args: unknown[]) => unknown;
    Fragment: unknown;
    createRoot: (node: Element) => { render: (element: unknown) => void };
    useLayoutEffect: (effect: () => void | (() => void), dependencies: unknown[]) => void;
    useState: <T>(initial: T) => [T, (value: T) => void];
  };
};

declare global {
  interface Window {
    B2VAdmin: {
      projectId: number;
      projectName: string;
      hasEmbed: boolean;
      hasProject: boolean;
      lastStatus: string;
      videoUrl: string;
      logoUrl: string;
      appUrl: string;
    };
    B2VInitAdmin?: () => boolean;
    B2VGenerate?: () => void;
    B2VSetActiveProject?: (projectId: number, projectName: string) => void;
    B2VResolveFailed?: () => void;
  }
}

const config = window.B2VAdmin;
const activeProjectId = Number(config.projectId) > 0 ? Number(config.projectId) : 0;
const activeProjectName = activeProjectId > 0 && config.projectName
  ? config.projectName
  : "No project selected";
const purpleButton = "b2v-primary";
const secondaryButton = "b2v-secondary";

function Chevron() {
  return <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 8 4 4 4-4" /></svg>;
}

function CloseButton(props: Record<string, boolean>) {
  return <button type="button" className="b2v-icon-close grid h-10 w-10 place-items-center rounded-full border-0 bg-slate-100 text-2xl leading-none text-slate-500 transition hover:bg-brand-50 hover:text-brand-700" aria-label="Close" {...props}>×</button>;
}

function ChoiceButton({ id, eyebrow, value, icon }: { id: string; eyebrow: string; value: string; icon: "template" | "voice" }) {
  return (
    <button type="button" id={id} className="b2v-choice-button flex w-full items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50/70 p-3 text-left transition hover:border-brand-300 hover:bg-brand-50">
      {icon === "template" ? (
        <svg className="h-6 w-6 shrink-0 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 4v16M8 10h13" /></svg>
      ) : (
        <svg className="h-6 w-6 shrink-0 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" /></svg>
      )}
      <span className="b2v-choice-copy min-w-0 flex-1"><small className="block text-xs font-medium text-slate-500">{eyebrow}</small><strong id={icon === "template" ? "b2v-selected-template" : "b2v-selected-voice"} className="mt-0.5 block truncate text-sm font-semibold text-slate-900">{value}</strong></span>
      <Chevron />
    </button>
  );
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  const stepLabels = ["Project", "Template", "Voice"];
  return (
    <div className="b2v-step-indicator flex flex-col items-center gap-2 pb-1">
      <div className="flex items-center gap-2">
        {Array.from({ length: total }, (_, i) => i + 1).map(n => (
          <div key={n} className="flex items-center gap-2">
            <div className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold transition-all ${n === current ? "bg-brand-600 text-white" : n < current ? "bg-brand-100 text-brand-600" : "bg-slate-100 text-slate-400"}`}>
              {n < current ? (
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              ) : n}
            </div>
            {n < total && <div className={`h-px w-8 transition-all ${n < current ? "bg-brand-300" : "bg-slate-200"}`} />}
          </div>
        ))}
      </div>
      <span className="text-[11px] font-medium text-slate-400">Step {current} — {stepLabels[current - 1]}</span>
    </div>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: unknown }) {
  return <label className={`b2v-field min-w-0 ${wide ? "b2v-field-wide col-span-2" : ""}`}><span className="b2v-label mb-1.5 block text-xs font-semibold text-slate-700">{label}</span>{children}</label>;
}

function LibraryModal() {
  return (
    <div className="b2v-library-modal b2v-react-shell fixed inset-0 z-[100000]" id="b2v-library-modal" role="dialog" aria-modal="true" aria-labelledby="b2v-library-title" hidden>
      <div className="b2v-library-backdrop absolute inset-0 bg-slate-950/45 backdrop-blur-sm" data-b2v-close-library />
      <div className="b2v-library-dialog b2v-modal-surface absolute inset-x-4 bottom-4 top-4 mx-auto flex max-w-6xl flex-col overflow-hidden">
        <header className="b2v-library-header flex items-start justify-between border-b border-slate-100 px-6 py-5"><div><span className="b2v-library-eyebrow text-xs font-bold uppercase tracking-[.18em] text-brand-600">Blog2Video library</span><h2 id="b2v-library-title" className="mt-1 text-2xl font-semibold text-slate-950" /></div><CloseButton data-b2v-close-library /></header>
        <div className="b2v-library-tools border-b border-slate-100 bg-slate-50/70 px-6 py-4"><input className="b2v-control max-w-md" type="search" id="b2v-library-search" placeholder="Search templates or voices…" /></div>
        <div className="b2v-library-grid grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-6 sm:grid-cols-2 lg:grid-cols-3" id="b2v-library-grid" />
        <div className="b2v-library-empty m-auto text-sm text-slate-500" id="b2v-library-empty" hidden>No matching options found.</div>
      </div>
    </div>
  );
}

function ProjectsModal() {
  return (
    <div className="b2v-project-modal b2v-react-shell fixed inset-0 z-[100000]" id="b2v-project-modal" role="dialog" aria-modal="true" aria-labelledby="b2v-project-modal-title" hidden>
      <div className="b2v-project-backdrop absolute inset-0 bg-slate-950/45 backdrop-blur-sm" data-b2v-close-projects />
      <div className="b2v-project-dialog b2v-modal-surface absolute inset-x-4 bottom-4 top-4 mx-auto flex max-w-6xl flex-col overflow-hidden">
        <header className="b2v-project-header flex items-start justify-between border-b border-slate-100 px-6 py-5"><div><span className="text-xs font-bold uppercase tracking-[.18em] text-brand-600">Your Blog2Video projects</span><h2 id="b2v-project-modal-title" className="mt-1 text-2xl font-semibold text-slate-950">Choose a video</h2><p className="mt-1 text-sm text-slate-500">Switch the project you are editing or use a rendered video in this post.</p></div><CloseButton data-b2v-close-projects /></header>
        <div className="b2v-project-tools flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-6 py-4"><input className="b2v-control max-w-md" type="search" id="b2v-project-search" placeholder="Search projects…" /><button type="button" className="b2v-quiet ml-auto" data-b2v-close-projects>← Back to post</button></div>
        <div className="b2v-project-grid flex flex-1 flex-col gap-3 overflow-y-auto p-6" id="b2v-project-grid" />
        <div className="b2v-project-empty m-auto text-sm text-slate-500" id="b2v-project-empty" hidden>No projects found.</div>
      </div>
    </div>
  );
}

function ConfirmModal() {
  return (
    <div className="b2v-confirm-modal b2v-react-shell fixed inset-0" id="b2v-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="b2v-confirm-title" aria-describedby="b2v-confirm-message" hidden>
      <div className="b2v-confirm-backdrop absolute inset-0 bg-slate-950/45 backdrop-blur-sm" />
      <div className="b2v-confirm-dialog b2v-modal-surface absolute inset-x-4 m-auto max-w-md p-6">
        <div className="flex items-start gap-4"><span className="b2v-confirm-icon grid h-12 w-12 shrink-0 place-items-center rounded-full" aria-hidden="true">!</span><div className="min-w-0 flex-1"><h2 id="b2v-confirm-title" className="m-0 text-xl font-semibold text-slate-950">Confirm action</h2><p id="b2v-confirm-message" className="m-0 mt-2 text-sm leading-5 text-slate-600" /></div></div>
        <div className="mt-6 flex justify-end gap-2"><button type="button" className={secondaryButton} id="b2v-confirm-cancel">Cancel</button><button type="button" className={purpleButton} id="b2v-confirm-proceed">Proceed</button></div>
      </div>
    </div>
  );
}

function OperationToast() {
  return (
    <div className="b2v-operation-toast b2v-react-shell" id="b2v-operation-toast" role="status" aria-live="polite" hidden>
      <span className="b2v-operation-spinner" aria-hidden="true" />
      <div><strong id="b2v-operation-title">Updating video</strong><span id="b2v-operation-message">Your changes are being applied…</span></div>
    </div>
  );
}

const fonts = ["Default", "Inter", "Roboto Slab", "Patrick Hand", "Arimo", "Archivo Black", "Poppins", "Montserrat", "Merriweather", "Playfair Display", "Oswald", "Lora", "Righteous", "IM Fell English", "Pirata One", "Cinzel Decorative", "DM Sans", "Source Sans 3", "Source Serif 4", "Shippori Mincho"];
const fontValue = (font: string) => font === "Default" ? "" : font.toLowerCase().replaceAll(" ", "_");

const contentLanguages: Array<[string, string]> = [
  ["ar", "Arabic"], ["bn", "Bengali"], ["cs", "Czech"], ["da", "Danish"], ["de", "German"],
  ["el", "Greek"], ["en", "English"], ["es", "Spanish"], ["fa", "Persian (Farsi)"], ["fi", "Finnish"],
  ["fr", "French"], ["gu", "Gujarati"], ["he", "Hebrew"], ["hi", "Hindi"], ["hu", "Hungarian"],
  ["id", "Indonesian"], ["it", "Italian"], ["ja", "Japanese"], ["ko", "Korean"], ["ml", "Malayalam"],
  ["mr", "Marathi"], ["nl", "Dutch"], ["no", "Norwegian"], ["pa", "Punjabi"], ["pl", "Polish"],
  ["pt", "Portuguese"], ["ro", "Romanian"], ["ru", "Russian"], ["sv", "Swedish"], ["ta", "Tamil"],
  ["te", "Telugu"], ["th", "Thai"], ["tr", "Turkish"], ["uk", "Ukrainian"], ["ur", "Urdu"],
  ["vi", "Vietnamese"], ["zh-cn", "Chinese (Simplified)"], ["zh-tw", "Chinese (Traditional)"],
];

function SettingsSection({ title, description, children }: { title: string; description: string; children: unknown }) {
  return <section className="b2v-settings-section"><div className="b2v-settings-section-head mb-3"><h3 className="m-0 text-base font-semibold text-slate-950">{title}</h3><p className="m-0 mt-1 text-sm text-slate-500">{description}</p></div><div className="b2v-settings-card b2v-card">{children}</div></section>;
}

function ProjectSettingsModal() {
  return (
    <div className="b2v-editor-modal b2v-react-shell fixed inset-0 z-[100000]" id="b2v-project-settings-modal" role="dialog" aria-modal="true" aria-labelledby="b2v-project-settings-title" hidden>
      <div className="b2v-editor-backdrop absolute inset-0 bg-slate-950/45 backdrop-blur-sm" data-b2v-close-project-settings />
      <div className="b2v-editor-dialog b2v-project-settings-dialog b2v-modal-surface absolute inset-x-4 bottom-4 top-4 mx-auto flex max-w-5xl flex-col overflow-hidden">
        <header className="b2v-editor-header flex items-center justify-between border-b border-slate-100 px-6 py-4"><div className="b2v-editor-brand flex items-center gap-3"><img src={config.logoUrl} alt="" className="h-10 w-10 rounded-xl" /><div><strong id="b2v-project-settings-title" className="block text-base font-semibold text-slate-950">Project settings</strong><span className="text-sm text-slate-500">Logo, colors, font, captions and music</span></div></div><CloseButton data-b2v-close-project-settings /></header>
        <div className="b2v-project-settings-body flex-1 overflow-y-auto bg-slate-50/60 p-6"><div className="b2v-style-loading flex items-center justify-center py-16" id="b2v-style-loading"><span className="h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" aria-hidden="true" /></div><div className="b2v-project-settings-grid grid gap-6 md:grid-cols-2" id="b2v-style-fields" hidden>
          <SettingsSection title="Template" description="Rebuild scene layouts for a new template."><div className="b2v-choice-copy"><small className="text-xs text-slate-500">Current template</small><strong id="b2v-modal-selected-template" className="mt-1 block">Loading…</strong></div><div className="b2v-settings-card-footer mt-4"><button type="button" className={purpleButton} id="b2v-modal-browse-templates">Change template</button></div></SettingsSection>
          <SettingsSection title="Voiceover" description="The narration voice for this project."><div className="b2v-choice-copy"><small className="text-xs text-slate-500">Current voice</small><strong id="b2v-modal-selected-voice" className="mt-1 block">Loading…</strong></div><div className="b2v-settings-card-footer mt-4"><button type="button" className={purpleButton} id="b2v-modal-browse-voices">Change voice</button></div></SettingsSection>
          <SettingsSection title="Logo" description="Add a watermark. PNG, JPEG or WebP, up to 2 MB."><div id="b2v-logo-preview" className="b2v-logo-preview mb-3" hidden><img id="b2v-logo-preview-image" src="" alt="Logo preview" className="max-h-28 max-w-full rounded-xl border border-slate-200 object-contain p-2" /></div><div id="b2v-logo-empty" className="b2v-logo-empty rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No logo uploaded yet.</div><div className="b2v-logo-actions mt-3 flex gap-2"><label className={purpleButton} id="b2v-logo-choose">Upload logo<input type="file" id="b2v-logo-input" accept="image/png,image/jpeg,image/webp" hidden /></label><button type="button" className="b2v-quiet text-red-600" id="b2v-logo-remove" hidden>Remove</button></div><div id="b2v-logo-settings" className="b2v-logo-settings mt-4 grid gap-3" hidden><Field label="Position"><select className="b2v-control" id="b2v-logo-position"><option value="top_left">Top left</option><option value="top_right">Top right</option><option value="bottom_left">Bottom left</option><option value="bottom_right">Bottom right</option></select></Field><Field label="Size"><input className="w-full" type="range" id="b2v-logo-size" min="50" max="200" step="1" defaultValue="100" /></Field><Field label="Opacity"><input className="w-full" type="range" id="b2v-logo-opacity" min="0" max="1" step="0.05" defaultValue="0.9" /></Field></div><p id="b2v-logo-message" className="b2v-logo-message mt-2 text-sm" aria-live="polite" /></SettingsSection>
          <SettingsSection title="Colors & font" description="Theme styling applied across all scenes."><div className="b2v-color-row grid grid-cols-3 gap-2"><Field label="Accent"><input type="color" id="b2v-color-accent" defaultValue="#9333EA" className="h-10 w-full rounded-lg border border-slate-200" /></Field><Field label="Text"><input type="color" id="b2v-color-text" defaultValue="#000000" className="h-10 w-full rounded-lg border border-slate-200" /></Field><Field label="Background"><input type="color" id="b2v-color-bg" defaultValue="#FFFFFF" className="h-10 w-full rounded-lg border border-slate-200" /></Field></div><div className="mt-3"><Field label="Font"><select className="b2v-control" id="b2v-font-family">{fonts.map(font => <option value={fontValue(font)}>{font}</option>)}</select></Field></div><div className="b2v-settings-card-footer mt-4 flex items-center gap-3"><button type="button" className={purpleButton} id="b2v-colors-save">Save style</button><p id="b2v-colors-message" className="b2v-settings-message text-sm" aria-live="polite" /></div></SettingsSection>
          <SettingsSection title="Captions" description="Customize synchronized on-screen captions."><label className="b2v-toggle-row flex items-center gap-2 text-sm font-medium"><input type="checkbox" id="b2v-captions-toggle" /> Show captions</label><div className="mt-3"><Field label="Font"><select className="b2v-control" id="b2v-caption-font">{fonts.slice(1, 13).map(font => <option value={fontValue(font)}>{font}</option>)}</select></Field></div><div className="mt-3"><Field label="Font size"><input className="w-full" type="range" id="b2v-caption-size" min="12" max="64" step="1" defaultValue="36" /></Field></div><div className="mt-3"><Field label="Vertical offset"><input className="w-full" type="range" id="b2v-caption-offset" min="-100" max="100" step="1" defaultValue="0" /></Field></div><div className="b2v-settings-card-footer mt-4 flex items-center gap-3"><button type="button" className={purpleButton} id="b2v-captions-save">Save captions</button><p id="b2v-captions-message" className="b2v-settings-message text-sm" aria-live="polite" /></div></SettingsSection>
          <SettingsSection title="Background music" description="Optional soundtrack under the voiceover."><Field label="Track"><select className="b2v-control" id="b2v-music-track"><option value="">No music</option></select></Field><div className="b2v-music-preview-row mt-3 flex items-center gap-3"><button type="button" className={`${purpleButton} h-10 w-10 p-0`} id="b2v-music-play" disabled aria-label="Preview track">▶</button><div className="b2v-field-grow flex-1"><Field label="Volume"><input className="w-full" type="range" id="b2v-music-volume" min="0" max="1" step="0.05" defaultValue="0.1" /></Field></div></div><div className="b2v-settings-card-footer mt-4 flex items-center gap-3"><button type="button" className={purpleButton} id="b2v-music-save">Save music</button><p id="b2v-music-message" className="b2v-settings-message text-sm" aria-live="polite" /></div></SettingsSection>
        </div></div>
      </div>
    </div>
  );
}

function AdminApp() {
  const [activeProject, setActiveProject] = wp.element.useState({ id: activeProjectId, name: activeProjectName });
  const currentProjectId = activeProject.id;
  const currentProjectName = activeProject.name;
  const hasProject = currentProjectId > 0;
  const [resolveFailed, setResolveFailed] = wp.element.useState(false);
  const isResolvingProject = !hasProject && config.hasEmbed && !resolveFailed;
  const [step, setStep] = wp.element.useState<1 | 2 | 3>(1);
  const [sourceMode, setSourceMode] = wp.element.useState<"post" | "url">("post");
  const [aspectRatio, setAspectRatio] = wp.element.useState<"landscape" | "portrait">("landscape");
  const [voiceTab, setVoiceTab] = wp.element.useState<"voice" | "music">("voice");
  wp.element.useLayoutEffect(() => {
    window.B2VSetActiveProject = (projectId, projectName) => {
      setActiveProject({
        id: Number(projectId) || 0,
        name: projectName || "Selected Blog2Video project",
      });
    };
    window.B2VResolveFailed = () => setResolveFailed(true);
    window.B2VInitAdmin?.();
    return () => { delete window.B2VSetActiveProject; delete window.B2VResolveFailed; };
  }, []);
  const goToStep2 = () => {
    const url = document.getElementById("b2v-source-url") as HTMLInputElement | null;
    if (sourceMode === "url" && (!url?.value || !url.checkValidity())) {
      url?.reportValidity();
      return;
    }
    setStep(2);
  };
  return (
    <div id="b2v-panel" className="b2v-react-shell bg-white">
      <header className="b2v-intro flex items-center gap-3 border-b border-slate-100 px-4 py-5"><img className="b2v-logo h-12 w-12 rounded-2xl object-contain shadow-sm" src={config.logoUrl} alt="Blog2Video" /><div><strong className="block text-base font-semibold text-slate-950">Create your video</strong><span className="mt-0.5 block text-sm leading-5 text-slate-500">Turn this post or any article into a ready-to-share video.</span></div></header>
      <div className="space-y-5 p-4">
        <section id="b2v-project-context" className="b2v-project-context rounded-2xl border border-brand-100 bg-brand-50/60 p-4">{isResolvingProject ? (
          <div className="b2v-project-context-loading flex items-center gap-3 py-1"><span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" aria-hidden="true" /><div><strong className="block text-sm font-semibold text-slate-950">Loading your video project…</strong><span className="mt-0.5 block text-xs leading-5 text-slate-500">This post already has a video embedded. Fetching its project details.</span></div></div>
        ) : (
          <>
            <div className="b2v-project-context-copy"><span className="text-[11px] font-bold uppercase tracking-[.14em] text-brand-600">Active video project</span><strong id="b2v-active-project-name" className="mt-1.5 block text-sm font-semibold text-slate-950">{currentProjectName}</strong><small id="b2v-active-project-id" className="mt-1 block text-xs leading-5 text-slate-500">{currentProjectId ? `Project #${currentProjectId}` : "Choose an existing video or create a new one below."}</small></div>
            <div className={`mt-3 grid gap-2 items-stretch ${hasProject ? "grid-cols-2" : "grid-cols-1"}`}><button type="button" className={`${purpleButton} w-full h-full whitespace-nowrap`} id="b2v-browse-projects">Browse videos</button><button type="button" className={`${purpleButton} w-full h-full whitespace-nowrap`} id="b2v-open-project-settings" hidden={!hasProject}>Project settings</button></div>
          </>
        )}</section>
        {!hasProject && !isResolvingProject && <StepIndicator current={step} total={3} />}
        <section className="b2v-section" id="b2v-source-section" hidden={hasProject || isResolvingProject ? true : step !== 1}>
          <span className="b2v-label mb-2 block text-xs font-semibold uppercase tracking-[.14em] text-slate-500">Content source</span>
          <select data-b2v="source_type" id="b2v-source-type" value={sourceMode} onChange={() => {}} hidden><option value="post">Current post</option><option value="url">Web page URL</option></select>
          <div className="b2v-segmented grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            <button type="button" className={sourceMode === "post" ? "is-selected" : ""} onClick={() => setSourceMode("post")}>Current post</button>
            <button type="button" className={sourceMode === "url" ? "is-selected" : ""} onClick={() => setSourceMode("url")}>Web link</button>
          </div>
          <div id="b2v-source-url-wrap" className="mt-3" hidden={sourceMode !== "url"}><Field label="Blog URL"><input className="b2v-control" type="url" data-b2v="source_url" id="b2v-source-url" placeholder="https://yourblog.com/your-article" required={sourceMode === "url"} /></Field><span className="b2v-help mt-1 block text-xs text-slate-500">Use a public, paywall-free article link.</span></div>
          <span id="b2v-post-source-help" className="b2v-help mt-2 block text-xs leading-5 text-slate-500" hidden={sourceMode !== "post"}>Save the post first so its latest text is used.</span>
          <div className="mt-4">
            <span className="b2v-label mb-2 block text-xs font-semibold uppercase tracking-[.14em] text-slate-500">Video format</span>
            <input type="hidden" data-b2v="aspect_ratio" value={aspectRatio} />
            <div className="b2v-format-options grid grid-cols-2 gap-2">
              <button type="button" className={aspectRatio === "landscape" ? "is-selected" : ""} onClick={() => setAspectRatio("landscape")}><strong>Landscape</strong><small>YouTube · 16:9</small></button>
              <button type="button" className={aspectRatio === "portrait" ? "is-selected" : ""} onClick={() => setAspectRatio("portrait")}><strong>Portrait</strong><small>Reels · 9:16</small></button>
            </div>
          </div>
          <div className="mt-4">
            <Field label="Estimated duration"><select className="b2v-control" data-b2v="video_length"><option value="short">Short (30–60 sec)</option><option value="medium">Medium (1–3 min)</option><option value="detailed">Detailed (3–5 min)</option></select></Field>
            <span className="b2v-help mt-1 block text-xs text-slate-500">Actual length may vary with the source content.</span>
          </div>
          <label className="b2v-option-row mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm"><input type="checkbox" data-b2v="stock_footage_enabled" /> Insert stock footage automatically</label>
          <div className="mt-4">
            <span className="b2v-label mb-1.5 block text-xs font-semibold text-slate-700">Logo (optional · max 2 MB)</span>
            <label className={secondaryButton} id="b2v-wizard-logo-choose">Upload logo<input type="file" id="b2v-wizard-logo-input" accept="image/png,image/jpeg,image/webp" hidden /></label>
            <div id="b2v-wizard-logo-preview" className="mt-2 flex items-center gap-2 text-xs text-slate-600" hidden><span id="b2v-wizard-logo-filename" className="truncate"></span><button type="button" className="b2v-quiet" id="b2v-wizard-logo-remove" aria-label="Remove logo">×</button></div>
            <p id="b2v-wizard-logo-message" className="b2v-help mt-1 text-xs" aria-live="polite"></p>
            <div id="b2v-wizard-logo-settings" className="mt-3 grid grid-cols-2 gap-3" hidden>
              <Field label="Position"><select className="b2v-control" id="b2v-wizard-logo-position"><option value="top_left">Top left</option><option value="top_right">Top right</option><option value="bottom_left">Bottom left</option><option value="bottom_right">Bottom right</option></select></Field>
              <Field label="Opacity"><input className="w-full" type="range" id="b2v-wizard-logo-opacity" min="0" max="1" step="0.05" defaultValue="0.9" /></Field>
            </div>
          </div>
          {!hasProject && <div className="b2v-wizard-nav b2v-wizard-nav-single"><button type="button" className="b2v-wizard-next" onClick={goToStep2}>Continue <span aria-hidden="true">→</span></button></div>}
        </section>
        <section className="b2v-section" id="b2v-settings-grid" hidden={hasProject || isResolvingProject ? true : step !== 2}>
          <div className="b2v-field"><span className="b2v-label mb-2 block text-xs font-semibold uppercase tracking-[.14em] text-slate-500">Selected template</span><select data-b2v="template" id="b2v-template" className="b2v-data-field" tabIndex={-1} aria-hidden="true"><option value="default">Geometric Explainer</option></select><div className="b2v-selected-template-card"><div id="b2v-wizard-template-preview" className="b2v-selected-template-preview" /><div><strong id="b2v-selected-template">Geometric Explainer</strong></div><span className="b2v-selected-check">✓</span></div><button type="button" id="b2v-browse-templates" hidden>Browse templates</button></div>
          <div className="mt-4"><span className="b2v-label mb-2 block text-xs font-semibold uppercase tracking-[.14em] text-slate-500">Templates</span><div id="b2v-wizard-template-loading" className="b2v-inline-loading"><span />Loading templates…</div><div id="b2v-wizard-template-grid" className="b2v-wizard-template-grid" /><p id="b2v-wizard-template-empty" className="b2v-help" hidden>No templates are available.</p></div>
          <div className="mt-4"><span className="b2v-label mb-2 block text-xs font-semibold uppercase tracking-[.14em] text-slate-500">Video style</span><input type="hidden" data-b2v="video_style" id="b2v-video-style" defaultValue="auto" /><div id="b2v-wizard-style-loading" className="b2v-inline-loading"><span />Loading your video styles…</div><div id="b2v-wizard-style-grid" className="b2v-style-pills flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1" hidden /><p id="b2v-wizard-style-empty" className="b2v-help" hidden>No video styles are available.</p></div>
          <div className="mt-4"><span className="b2v-label mb-2 block text-xs font-semibold uppercase tracking-[.14em] text-slate-500">Video colors</span><div id="b2v-wizard-colors-loading" className="b2v-inline-loading"><span />Loading template colors…</div><div id="b2v-wizard-colors" className="b2v-wizard-colors" hidden><label><input type="color" id="b2v-wizard-color-accent" defaultValue="#9333EA" /><span>Accent</span></label><label><input type="color" id="b2v-wizard-color-bg" defaultValue="#FFFFFF" /><span>Background</span></label><label><input type="color" id="b2v-wizard-color-text" defaultValue="#111827" /><span>Text</span></label></div></div>
          {!hasProject && <div className="b2v-wizard-nav b2v-field-wide col-span-2"><button type="button" className="b2v-wizard-back" onClick={() => setStep(1)}><span aria-hidden="true">←</span> Back</button><button type="button" className="b2v-wizard-next" onClick={() => setStep(3)}>Continue <span aria-hidden="true">→</span></button></div>}
        </section>
        <section className="b2v-section" id="b2v-voice-section" hidden={hasProject || isResolvingProject ? true : step !== 3}>
          <div className="b2v-language-note mb-4 rounded-xl border border-brand-100 bg-brand-50/60 p-3 text-xs text-brand-700">Choose the narration language. Keep <strong>Auto</strong> to detect it from the content.</div>
          <Field label="Language"><select className="b2v-control" data-b2v="content_language" id="b2v-content-language"><option value="auto">Auto detect</option>{contentLanguages.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></Field><span className="b2v-help mt-1 block text-xs text-slate-500">Language of the video content</span>
          <input type="hidden" data-b2v="voice_gender" id="b2v-voice-gender" defaultValue="female" /><input type="hidden" data-b2v="voice_accent" id="b2v-voice-accent" defaultValue="american" /><input type="hidden" data-b2v="custom_voice_id" id="b2v-custom-voice-id" defaultValue="" /><button type="button" id="b2v-browse-voices" hidden>Browse voices</button><span id="b2v-selected-voice" hidden>No voice selected</span>
          <label className="b2v-option-row mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm"><input type="checkbox" id="b2v-no-voiceover" /> No voiceover</label>
          <div className="b2v-wizard-tabs mt-4"><button type="button" className={voiceTab === "voice" ? "is-selected" : ""} onClick={() => setVoiceTab("voice")}>Voice</button><button type="button" className={voiceTab === "music" ? "is-selected" : ""} onClick={() => setVoiceTab("music")}>Music</button></div>
          <div className="mt-3" hidden={voiceTab !== "voice"}><span className="b2v-label mb-2 block text-xs font-semibold text-slate-700">Voice preview</span><div id="b2v-wizard-voice-loading" className="b2v-inline-loading"><span />Loading your voices…</div><div id="b2v-wizard-voice-list" className="b2v-wizard-voice-list" /><p id="b2v-wizard-voice-empty" className="b2v-help" hidden>No saved voices are available. Select “No voiceover” or add a voice in Blog2Video.</p></div>
          <div className="mt-3" hidden={voiceTab !== "music"}><Field label="Background music"><select className="b2v-control" data-b2v="bgm_track_id" id="b2v-wizard-music-track"><option value="">No background music</option></select></Field><div className="mt-3"><Field label="Music volume"><input className="w-full" type="range" data-b2v="bgm_volume" id="b2v-wizard-music-volume" min="0" max="1" step="0.05" defaultValue="0.1" /></Field></div></div>
          <input type="hidden" data-b2v="captions_enabled" value="" />
          <div id="b2v-generate-actions" className="b2v-wizard-nav b2v-actions" hidden={hasProject}><button type="button" className="b2v-wizard-back" onClick={() => setStep(2)}><span aria-hidden="true">←</span> Back</button><button type="button" className="b2v-wizard-next" id="b2v-generate" onClick={() => { window.B2VInitAdmin?.(); window.B2VGenerate?.(); }}><span id="b2v-generate-label">Generate video</span></button></div>
        </section>
        <div id="b2v-render-actions" className="b2v-actions flex gap-2" hidden={!hasProject}><button type="button" className={`${purpleButton} flex-1`} id="b2v-embed" disabled>Add video to post</button><button type="button" className={`${purpleButton} flex-1`} id="b2v-render" hidden>Render video</button></div>
        <div id="b2v-status-card" className="b2v-status-card rounded-2xl border border-slate-200 bg-white p-4" aria-live="polite" hidden={!config.lastStatus}><div><strong id="b2v-status" className="text-sm text-slate-900">{config.lastStatus}</strong><div id="b2v-progress" className="b2v-progress mt-3 h-1.5 overflow-hidden rounded-full bg-brand-100" hidden><span className="block h-full bg-brand-600" /></div><div id="b2v-upgrade-slot" className="b2v-upgrade-slot mt-3" hidden><a href={`${config.appUrl}/signin?redirect=%2Fsubscription`} target="_blank" rel="noopener" className={purpleButton} id="b2v-upgrade-link">Upgrade plan</a></div></div></div>
        <button type="button" className={`${secondaryButton} w-full`} id="b2v-download-video" data-video-url={config.videoUrl || ""} hidden={!config.videoUrl}>Download video</button>
        <section id="b2v-refine-card" className="b2v-refine-card b2v-card" hidden={!hasProject}><div><strong className="text-sm font-semibold">Scene-by-scene editing</strong><p className="mt-1 text-xs leading-5 text-slate-500">Edit scenes, narration and the full script in the Blog2Video web app.</p></div><a className={`${purpleButton} mt-3 w-full`} id="b2v-editor" href={`${config.appUrl}/project/${currentProjectId}`} target="_blank" rel="noopener noreferrer">Edit in Blog2Video →</a></section>
      </div>
      <ProjectSettingsModal /><LibraryModal /><ProjectsModal /><ConfirmModal /><OperationToast />
    </div>
  );
}

const root = document.getElementById("b2v-react-root");
if (root) {
  wp.element.createRoot(root).render(<AdminApp />);
  let initAttempts = 0;
  const initializeController = () => {
    initAttempts += 1;
    if (!root.querySelector("#b2v-generate")) {
      if (initAttempts < 120) window.requestAnimationFrame(initializeController);
      return;
    }
    const initialized = window.B2VInitAdmin?.();
    if (initialized === false && initAttempts < 120) {
      window.requestAnimationFrame(initializeController);
    }
  };
  window.requestAnimationFrame(initializeController);
}

export {};
