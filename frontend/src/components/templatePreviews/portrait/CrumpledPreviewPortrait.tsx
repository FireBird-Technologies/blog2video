import { CrumpledPreviewPlayer } from "../CrumpledPreview";

export default function CrumpledPreviewPortrait({
  thumbnailMode = false,
}: { thumbnailMode?: boolean } = {}) {
  return <CrumpledPreviewPlayer thumbnailMode={thumbnailMode} orientation="portrait" />;
}
