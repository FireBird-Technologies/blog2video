declare const wp: {
  element: {
    createElement: (...args: unknown[]) => unknown;
    Fragment: unknown;
    createRoot: (node: Element) => { render: (element: unknown) => void };
    useState: <T>(initial: T) => [T, (value: T) => void];
  };
};

declare global {
  interface Window {
    B2VSettings: {
      connected: boolean;
      pending: boolean;
      approvalUrl: string;
      beginUrl: string;
      adminPostUrl: string;
      createPostUrl: string;
      beginNonce: string;
      disconnectNonce: string;
      notice: string;
      logoUrl: string;
    };
    B2VInitSettings?: () => void;
  }
}

const config = window.B2VSettings;

function HiddenFormFields({ action, nonce }: { action: string; nonce: string }) {
  return <><input type="hidden" name="action" value={action} /><input type="hidden" name="_wpnonce" value={nonce} /></>;
}

function SettingsApp() {
  const [connecting, setConnecting] = wp.element.useState(false);
  const [openingApproval, setOpeningApproval] = wp.element.useState(false);
  const connectionPrimary = "b2v-primary b2v-slim b2v-connection-primary no-underline";

  const beginConnection = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (connecting) return;
    setConnecting(true);
    window.requestAnimationFrame(() => window.location.assign(config.beginUrl));
  };

  const openApproval = (event: { preventDefault: () => void }) => {
    if (openingApproval) {
      event.preventDefault();
      return;
    }
    setOpeningApproval(true);
  };

  return (
    <div className="b2v-react-shell b2v-settings-app mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="b2v-settings-header flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4"><img src={config.logoUrl} alt="Blog2Video" className="h-14 w-14 rounded-2xl shadow-sm" /><div><h1 className="m-0 text-2xl font-semibold tracking-tight text-slate-950">Blog2Video</h1><p className="m-0 mt-1 text-sm text-slate-500">Create, edit and publish narrated videos without leaving WordPress.</p></div></div>
        <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${config.connected ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}><i className={`h-2 w-2 rounded-full ${config.connected ? "bg-emerald-500" : "bg-slate-400"}`} />{config.connected ? "Connected" : "Not connected"}</span>
      </header>

      {config.notice ? <div className="mt-6 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700">{config.notice}</div> : null}

      <main className="b2v-settings-panel mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft">
        <div className="b2v-settings-panel-head border-b border-slate-100 px-6 py-8 sm:px-10 sm:py-10">
          <span className="text-xs font-bold uppercase tracking-[.18em] text-brand-600">WordPress integration</span>
          <h2 className="m-0 mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-slate-950">{config.connected ? "Your site is ready" : config.pending ? "Approve this WordPress site" : "Connect your Blog2Video account"}</h2>
          <p className="m-0 mt-3 max-w-2xl text-base leading-7 text-slate-600">{config.connected ? "Editors can create videos from posts, refine every scene, render, download and embed—all from the WordPress editor." : config.pending ? "Continue to Blog2Video, sign in and approve this site. WordPress will complete the connection automatically." : "Authorize this site once. Your password stays in Blog2Video and WordPress receives revocable access limited to this installation."}</p>
        </div>

        <div className="b2v-settings-panel-body px-6 py-7 sm:px-10">
          {config.connected ? (
            <div className="b2v-connected-actions"><a href={config.createPostUrl} className={`${connectionPrimary} b2v-connection-action`}>Create a post</a><form className="b2v-disconnect-form" method="post" action={config.adminPostUrl}><HiddenFormFields action="b2v_disconnect" nonce={config.disconnectNonce} /><button type="submit" className="b2v-danger b2v-slim b2v-connection-primary b2v-connection-action" aria-label="Disconnect Blog2Video account">Disconnect account</button></form></div>
          ) : config.pending ? (
            <div><div className="b2v-connection-action-wrap"><a href={config.approvalUrl} target="_blank" rel="noopener noreferrer" className={`${connectionPrimary} b2v-connection-action`} aria-busy={openingApproval} aria-disabled={openingApproval} onClick={openApproval}>{openingApproval ? <><i className="b2v-button-spinner" aria-hidden="true" />Opening approval…</> : <>Approve <span aria-hidden="true">↗</span></>}</a></div><p id="b2v-approval-status" className="b2v-approval-status mt-4"><i className="b2v-approval-spinner" aria-hidden="true" /><span>Waiting for approval…</span></p></div>
          ) : (
            <div><ul className="b2v-settings-benefits m-0 grid list-none gap-3 p-0 text-sm text-slate-600 sm:grid-cols-3"><li className="rounded-xl bg-slate-50 p-4">No password stored in WordPress</li><li className="rounded-xl bg-slate-50 p-4">Revocable, site-limited access</li><li className="rounded-xl bg-slate-50 p-4">Existing projects remain available</li></ul><div className="mt-6"><a href={config.beginUrl} className={connectionPrimary} aria-busy={connecting} aria-disabled={connecting} onClick={beginConnection}>{connecting ? <><i className="b2v-button-spinner" aria-hidden="true" />Connecting…</> : <>Connect Blog2Video <span aria-hidden="true">→</span></>}</a></div></div>
          )}
        </div>
      </main>
    </div>
  );
}

const root = document.getElementById("b2v-settings-react-root");
if (root) {
  wp.element.createRoot(root).render(<SettingsApp />);
  window.setTimeout(() => window.B2VInitSettings?.(), 0);
}

export {};
