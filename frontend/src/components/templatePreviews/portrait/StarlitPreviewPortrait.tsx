import { StarlitPreviewPlayer } from "../StarlitPreview";

export default function StarlitPreviewPortrait({
  thumbnailMode = false,
}: { thumbnailMode?: boolean } = {}) {
  return (
    <StarlitPreviewPlayer
      thumbnailMode={thumbnailMode}
      orientation="portrait"
    />
  );
}
