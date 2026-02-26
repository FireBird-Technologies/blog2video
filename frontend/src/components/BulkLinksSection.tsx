import React from "react";

type BulkRow = { url: string };
type AspectRatio = "landscape" | "portrait";

interface BulkLinksSectionProps {
  rows: BulkRow[];
  maxBulkLinks: number;
  aspectRatios: AspectRatio[];
  onChangeUrl: (index: number, value: string) => void;
  onChangeAspectRatio: (index: number, value: AspectRatio) => void;
  onAddRow: () => void;
  onRemoveRow: (index: number) => void;
}

export const BulkLinksSection: React.FC<BulkLinksSectionProps> = ({
  rows,
  maxBulkLinks,
  aspectRatios,
  onChangeUrl,
  onChangeAspectRatio,
  onAddRow,
  onRemoveRow,
}) => {
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
        Links{" "}
        <span className="text-gray-300 font-normal">
          (max {maxBulkLinks})
        </span>
      </label>

      <div className="space-y-2">
        {rows.map((row, i) => {
          const ar = aspectRatios[i] ?? "landscape";

          return (
            <div key={i} className="flex items-center gap-2">

              {/* URL Input */}
              <input
                type="url"
                value={row.url}
                onChange={(e) => onChangeUrl(i, e.target.value)}
                placeholder={`URL ${i + 1}`}
                className="flex-1 max-w-[75%] min-w-0 px-3 py-2 bg-white/80 border border-gray-200/60 rounded-lg text-sm placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
              />

              {/* Format Toggle */}
              <div className="flex items-center">
                <div className="flex gap-1 p-1 bg-gray-100/60 rounded-xl">

                  {/* Landscape */}
                  <button
                    type="button"
                    title="Landscape"
                    onClick={() => onChangeAspectRatio(i, "landscape")}
                    className={`px-3 py-1.5 rounded-lg flex items-center transition-all ${
                      ar === "landscape"
                        ? "bg-white text-purple-600 shadow-sm"
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <rect x="3" y="4" width="18" height="12" rx="2" />
                      <path d="M8 20h8M12 16v4" strokeLinecap="round" />
                    </svg>
                  </button>

                  {/* Portrait */}
                  <button
                    type="button"
                    title="Portrait"
                    onClick={() => onChangeAspectRatio(i, "portrait")}
                    className={`px-3 py-1.5 rounded-lg flex items-center transition-all ${
                      ar === "portrait"
                        ? "bg-white text-purple-600 shadow-sm"
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <rect x="7" y="2" width="10" height="20" rx="2" />
                      <circle cx="12" cy="18" r="1" />
                    </svg>
                  </button>

                </div>
              </div>

              {/* Remove Button */}
              <button
                type="button"
                onClick={() => onRemoveRow(i)}
                disabled={rows.length <= 1}
                className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                title="Remove row"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 
                       21H7.862a2 2 0 01-1.995-1.858L5 
                       7m5 4v6m4-6v6m1-10V4a1 1 0 
                       00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {rows.length < maxBulkLinks && (
        <button
          type="button"
          onClick={onAddRow}
          className="mt-2 text-xs font-medium text-purple-600 hover:text-purple-700 flex items-center gap-1"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add link
        </button>
      )}
    </div>
  );
};