import { AbsoluteFill } from "remotion";

/** Pure black stage background for the Spotlight template. */
export const SpotlightBackground: React.FC<{ bgColor?: string }> = ({
  bgColor = "#000000",
}) => {
  return <AbsoluteFill style={{ backgroundColor: bgColor }} />;
};
