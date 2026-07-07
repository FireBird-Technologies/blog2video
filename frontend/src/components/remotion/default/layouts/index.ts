import { HeroImage } from "./HeroImage";
import { TextNarration } from "./TextNarration";
import { CodeBlock } from "./CodeBlock";
import { BulletList } from "./BulletList";
import { FlowDiagram } from "./FlowDiagram";
import { Comparison } from "./Comparison";
import { Metric } from "./Metric";
import { QuoteCallout } from "./QuoteCallout";
import { ImageCaption } from "./ImageCaption";
import { Timeline } from "./Timeline";
<<<<<<< HEAD
import { DataVisualization } from "./DataVisualization";
=======
import { DefaultDataChart } from "./DefaultDataChart";
import { DefaultTable } from "./DefaultTable";
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
import { EndingSocials } from "./EndingSocials";
import type { LayoutType, SceneLayoutProps } from "../types";

export type { LayoutType, SceneLayoutProps };

export const LAYOUT_REGISTRY: Record<LayoutType, React.FC<SceneLayoutProps>> = {
  hero_image: HeroImage,
  text_narration: TextNarration,
  code_block: CodeBlock,
  bullet_list: BulletList,
  flow_diagram: FlowDiagram,
  comparison: Comparison,
  metric: Metric,
  quote_callout: QuoteCallout,
  image_caption: ImageCaption,
  timeline: Timeline,
<<<<<<< HEAD
  data_visualization: DataVisualization,
=======
  default_data_visualization: DefaultDataChart,
  default_ticker: DefaultTable,
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
  ending_socials: EndingSocials,
};
