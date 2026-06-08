import ReactDOM from "react-dom";

interface Props {
  open: boolean;
  onClose: () => void;
  onChooseLink: () => void;
  onChooseDesigner: () => void;
}

export default function GetMoreTemplatesModal({ open, onClose, onChooseLink, onChooseDesigner }: Props) {
  if (!open) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="get-more-templates-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 id="get-more-templates-title" className="text-base font-semibold text-gray-900">
            Get More Templates
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Two option cards */}
        <div className="p-6 grid grid-cols-2 gap-4">
          {/* Create through Link */}
          <button
            type="button"
            onClick={onChooseLink}
            className="group flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-gray-200 hover:border-purple-400 hover:bg-purple-50/40 transition-all text-center"
          >
            <div className="w-12 h-12 rounded-full bg-purple-100 group-hover:bg-purple-200 flex items-center justify-center transition-colors">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-1">Create through Link</p>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Extract your brand colors and fonts from a website URL to generate a custom template.
              </p>
            </div>
          </button>

          {/* Consult a Designer */}
          <button
            type="button"
            onClick={onChooseDesigner}
            className="group flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-gray-200 hover:border-purple-400 hover:bg-purple-50/40 transition-all text-center"
          >
            <div className="w-12 h-12 rounded-full bg-purple-100 group-hover:bg-purple-200 flex items-center justify-center transition-colors">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-1">Consult a Designer</p>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Get your branded templates created by our design team, tailored for professional use.
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
