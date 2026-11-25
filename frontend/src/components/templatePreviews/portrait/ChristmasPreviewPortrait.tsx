import { ChristmasPreviewPlayer } from "../ChristmasPreview";

export default function ChristmasPreviewPortrait({
  thumbnailMode = false,
}: { thumbnailMode?: boolean } = {}) {
  return <ChristmasPreviewPlayer thumbnailMode={thumbnailMode} orientation="portrait" />;
}
