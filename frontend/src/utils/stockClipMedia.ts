/** True when the adjust-modal preview should use clip playback + trim UI. */
export function isStockClipAdjustSource(opts: {
  assignedVideoFilename?: string | null;
  assetType?: string | null;
  src?: string | null;
}): boolean {
  if (opts.assignedVideoFilename) return true;
  if (opts.assetType === "video") return true;
  const src = opts.src ?? "";
  if (!src) return false;
  return /\.mp4(\?|$)/i.test(src) || /\/videos\//i.test(src);
}
