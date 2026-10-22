import React from "react";
import { AbsoluteFill, Composition, registerRoot, staticFile } from "remotion";
import { SceneTransition } from "../../frontend/src/components/remotion/starlit/components/SceneTransition";
import { CosmicHero } from "../../frontend/src/components/remotion/starlit/layouts/CosmicHero";
import { TextNarration } from "../../frontend/src/components/remotion/starlit/layouts/TextNarration";
import { SplitImage } from "../../frontend/src/components/remotion/starlit/layouts/SplitImage";
import { StatCallout } from "../../frontend/src/components/remotion/starlit/layouts/StatCallout";
import { RingedPlanet } from "../../frontend/src/components/remotion/starlit/layouts/RingedPlanet";
import { RocketLaunch } from "../../frontend/src/components/remotion/starlit/layouts/RocketLaunch";
import { QuoteCard } from "../../frontend/src/components/remotion/starlit/layouts/QuoteCard";
import { GalaxyDeepDive } from "../../frontend/src/components/remotion/starlit/layouts/GalaxyDeepDive";
import { EndingSocials } from "../../frontend/src/components/remotion/starlit/layouts/EndingSocials";
import { DataVisualisation } from "./templates/starlit/layouts/DataVisualisation";
import { TickerTable } from "./templates/starlit/layouts/TickerTable";

const shared = {
  accentColor: "#217cff",
  bgColor: "#000000",
  textColor: "#ffffff",
  aspectRatio: "landscape",
  sceneDurationInFrames: 180,
} as const;

const portraitShared = {
  ...shared,
  aspectRatio: "portrait",
} as const;

const NarrativeDebug: React.FC = () => (
  <AbsoluteFill>
    <TextNarration {...shared} title="Ideas become constellations" narration="A useful story does more than collect isolated facts. It connects the strongest evidence, preserves the details that explain why each signal matters, and gives the audience enough context to recognize the pattern for themselves. As the scattered points come together, the argument becomes clearer, calmer, and far easier to remember." eyebrow="Field notes" />
    <SceneTransition layout="text_narration" accentColor={shared.accentColor} bgColor={shared.bgColor} />
  </AbsoluteFill>
);

const NarrativePortraitDebug: React.FC = () => (
  <AbsoluteFill>
    <TextNarration {...portraitShared} title="Ideas become constellations" narration="A useful story does more than collect isolated facts. It connects the strongest evidence, preserves the details that explain why each signal matters, and gives the audience enough context to recognize the pattern for themselves. As the scattered points come together, the argument becomes clearer, calmer, and far easier to remember." eyebrow="Field notes" />
    <SceneTransition layout="text_narration" accentColor={portraitShared.accentColor} bgColor={portraitShared.bgColor} />
  </AbsoluteFill>
);

const HeroDebug: React.FC = () => (
  <AbsoluteFill>
    <CosmicHero {...shared} title="Research at the speed of thought" narration="A calmer way to move from scattered signals to a clear point of view." eyebrow="Starlit" />
    <SceneTransition layout="cosmic_hero" accentColor={shared.accentColor} bgColor={shared.bgColor} />
  </AbsoluteFill>
);

const HeroPortraitDebug: React.FC = () => (
  <AbsoluteFill>
    <CosmicHero {...portraitShared} title="Research at the speed of thought" narration="A calmer way to move from scattered signals to a clear point of view." eyebrow="Starlit" />
    <SceneTransition layout="cosmic_hero" accentColor={portraitShared.accentColor} bgColor={portraitShared.bgColor} />
  </AbsoluteFill>
);

const StatPortraitDebug: React.FC = () => (
  <AbsoluteFill>
    <StatCallout {...portraitShared} title="Signal retention" narration="The signal remains stable." statValue="87" statSuffix="%" descriptor="of the signal survives across the full observation window" />
  </AbsoluteFill>
);

const layouts = [
  ["Split", "split_image", SplitImage, {heading: "A softer reveal", body: "The haze clears without a hard circular wipe.", imageUrl: staticFile("assets/earth-blue-marble.jpg")}],
  ["Stat", "stat_callout", StatCallout, {statValue: "87%", descriptor: "of the signal survives"}],
  ["Ringed", "ringed_planet", RingedPlanet, {heading: "A world in motion", body: "Solid form, persistent atmosphere, and restrained orbital energy."}],
  ["RingedPhoto", "ringed_planet", RingedPlanet, {heading: "Earth from a new orbit", body: "A familiar world becomes the focal point of a much larger story.", imageUrl: staticFile("assets/earth-blue-marble.jpg"), imageCaption: "Earth · Blue Marble"}],
  // Deliberately pass a legacy imageUrl: Rocket Launch is image-free and must ignore it.
  ["Rocket", "rocket_launch", RocketLaunch, {heading: "The signal holds", body: "Bright stars and a living vortex remain after the reveal.", imageUrl: staticFile("assets/earth-blue-marble.jpg")}],
  ["Quote", "quote_card", QuoteCard, {quote: "Clarity arrives when the noise falls away.", attribution: "Starlit"}],
  ["Galaxy", "galaxy_deep_dive", GalaxyDeepDive, {heading: "Deep research", nodes: [{label: "Signals", children: ["Sources", "Patterns"]}, {label: "Context", children: ["History", "Impact"]}, {label: "Insight", children: ["Meaning", "Next step"]}]}],
  ["Data", "data_visualisation", DataVisualisation, {title: "Signals across the cosmos", narration: "The observed data reveals a clear pattern across the measured period.", eyebrow: "Data overview", chartSummary: "Readings accelerate after the second observation window.", xAxisLabel: "Observation period", yAxisLabel: "Signal strength", chartType: "line", chartTable: {headers: ["Orbit", "Signal", "Baseline"], rows: [["Q1", "42", "35"], ["Q2", "57", "41"], ["Q3", "68", "49"], ["Q4", "81", "58"]]}}],
  ["Table", "ticker_table", TickerTable, {title: "Telemetry at a glance", narration: "The key readings are shown together for direct comparison.", tickerHighlightCol: 2, tickerTable: {headers: ["Object", "Distance", "Change"], rows: [["Kepler-22b", "620 ly", "+4.2%"], ["TRAPPIST-1e", "40 ly", "+1.8%"], ["Proxima b", "4.2 ly", "-0.7%"]]}}],
  ["Ending", "ending_socials", EndingSocials, {
    brandName: "Starlit",
    tagline: "Turn every idea into a story worth watching.",
    ctaButtonText: "Explore more",
    websiteLink: "yourwebsite.com",
    showWebsiteButton: true,
    socials: [
      {platform: "instagram", enabled: "true", label: "Instagram"},
      {platform: "youtube", enabled: "true", label: "YouTube"},
      {platform: "linkedin", enabled: "true", label: "LinkedIn"},
      {platform: "tiktok", enabled: "true", label: "TikTok"},
    ],
  }],
] as const;

const DebugLayout: React.FC<{index: number}> = ({index}) => {
  const [, layout, Component, extra] = layouts[index];
  return <AbsoluteFill><Component {...shared} title="Starlit" narration="A calm cinematic scene." {...extra as any} /><SceneTransition layout={layout} accentColor={shared.accentColor} bgColor={shared.bgColor} textColor={shared.textColor} chartTable={(extra as any).chartTable} chartType={(extra as any).chartType} tickerTable={(extra as any).tickerTable} /></AbsoluteFill>;
};

const DebugPortraitLayout: React.FC<{index: number}> = ({index}) => {
  const [, layout, Component, extra] = layouts[index];
  return <AbsoluteFill><Component {...portraitShared} title="Starlit" narration="A calm cinematic scene." {...extra as any} /><SceneTransition layout={layout} accentColor={portraitShared.accentColor} bgColor={portraitShared.bgColor} textColor={portraitShared.textColor} chartTable={(extra as any).chartTable} chartType={(extra as any).chartType} tickerTable={(extra as any).tickerTable} /></AbsoluteFill>;
};

const longTitle = "A deliberately long editorial headline that must remain fully visible inside the Starlit frame at every supported aspect ratio";
const longBody = "This deliberately extended passage exercises the real rendered-glyph measurement path with enough words to wrap across many lines. It should preserve the full message, remain readable, and shrink only as much as necessary to stay inside the layout's reserved copy area without colliding with adjacent artwork, controls, or the edge of the video canvas.";
const fitLayouts = [
  [CosmicHero, {title: longTitle, narration: longBody}],
  [TextNarration, {title: longTitle, heading: longTitle, narration: longBody, body: longBody}],
  [SplitImage, {title: longTitle, heading: longTitle, narration: longBody, body: longBody}],
  [StatCallout, {title: longTitle, statValue: "1234567890.42%", descriptor: longBody}],
  [RingedPlanet, {title: longTitle, heading: longTitle, narration: longBody, body: longBody}],
  [RocketLaunch, {title: longTitle, heading: longTitle, narration: longBody, body: longBody}],
  [QuoteCard, {title: longTitle, quote: `${longBody} ${longBody}`, attribution: "An intentionally long attribution used to verify width fitting"}],
  [GalaxyDeepDive, {title: longTitle, heading: longTitle, nodes: [{label: "A very long primary research signal label", value: longBody, children: [{label: "A detailed supporting signal label", text: longBody}, {label: "Another unusually long supporting label", text: longBody}]}]}],
  [DataVisualisation, {title: longTitle, narration: longBody, chartSummary: longBody, xAxisLabel: "An extended observation period", yAxisLabel: "An extended signal strength measure", chartType: "line", chartTable: {headers: ["Observation window", "Primary signal", "Comparative baseline"], rows: [["First extended period", "42", "35"], ["Second extended period", "57", "41"], ["Third extended period", "68", "49"]]}}],
  [TickerTable, {title: longTitle, tickerTable: {headers: ["An unusually descriptive object name", "Extended measurement", "Comparative change"], rows: [["Kepler designation with a very long qualifier", "1234567890.42 light years", "+123456.78%"], ["TRAPPIST observation with extended label", "987654321.09 light years", "-98765.43%"]]}}],
  [EndingSocials, {title: longTitle, brandName: "An Extended Starlit Brand Name", tagline: longTitle, websiteLink: "an-extremely-long-domain-name-for-starlit-research.example.com/path", ctaButtonText: "Explore the complete research archive", showWebsiteButton: true, socialHandles: ["@a_very_long_social_handle_for_testing", "@another_extended_social_destination"]}],
  [TextNarration, {title: longTitle, heading: longTitle, narration: longBody, body: longBody, imageUrl: staticFile("assets/earth-blue-marble.jpg")}],
  [QuoteCard, {title: longTitle, quote: `${longBody} ${longBody}`, attribution: "An intentionally long attribution used to verify width fitting", imageUrl: staticFile("assets/earth-blue-marble.jpg")}],
  [RingedPlanet, {title: longTitle, heading: longTitle, narration: longBody, body: longBody, imageUrl: staticFile("assets/earth-blue-marble.jpg"), imageCaption: "An intentionally long image caption that must stay on the attached plaque"}],
  [GalaxyDeepDive, {title: "A focused topic", heading: "A focused topic", nodes: [
    {label: "Primary research signal", children: [
      {label: "First supporting signal", text: "A complete supporting sentence remains visible within the eighty character contract."},
      {label: "Second supporting signal", text: "Another evidence-rich sentence stays readable without leaving its assigned branch."},
      {label: "Third supporting signal", text: "The final child exercises the maximum supported three-branch arrangement."},
    ]},
    {label: "Historical context"}, {label: "Measured impact"}, {label: "Audience response"},
    {label: "Future direction"}, {label: "Source quality"}, {label: "Open questions"}, {label: "Next decision"},
  ]}],
  [DataVisualisation, {title: longTitle, chartSummary: longBody, xAxisLabel: "Twenty measured observation windows", yAxisLabel: "Comparative signal strength", chartType: "bar", chartTable: {headers: ["Observation", "Primary", "Baseline", "Forecast"], rows: Array.from({length: 20}, (_, i) => [`Period ${i + 1}`, String(32 + i * 3), String(28 + i * 2), String(36 + i * 4)])}}],
  [TickerTable, {title: longTitle, tickerHighlightCol: 5, tickerTable: {headers: ["Long row label", "Measure one", "Measure two", "Measure three", "Measure four", "Change"], rows: Array.from({length: 20}, (_, i) => [`Extended observation row ${i + 1}`, `${1000 + i}.42 units`, `${2000 + i}.84 units`, `${3000 + i}.21 units`, `${4000 + i}.63 units`, `${i % 2 ? "-" : "+"}${120 + i}.45%`])}}],
  [EndingSocials, {title: longTitle, brandName: "An exceptionally extended Starlit research brand name used to prove brand fitting", tagline: longTitle, ctas: [
    {websiteLink: "primary-destination.example.com/an-extended-path", ctaButtonText: "Explore the complete archive", showWebsiteButton: true},
    {websiteLink: "secondary-destination.example.com/more", ctaButtonText: "Read more", showWebsiteButton: true},
    {websiteLink: "third-destination.example.com/latest", ctaButtonText: "Latest research", showWebsiteButton: true},
  ], socialHandles: ["@extended_handle_one", "@extended_handle_two", "@extended_handle_three", "@extended_handle_four", "@extended_handle_five", "@extended_handle_six", "@extended_handle_seven"]}],
] as const;

type FitStressProps = {
  index: number;
  portrait?: boolean;
  titleFontSize?: number;
  descriptionFontSize?: number;
  titleFontSizeIsUserSet?: boolean;
  descriptionFontSizeIsUserSet?: boolean;
};

const FitStressDebug: React.FC<FitStressProps> = ({
  index,
  portrait = false,
  titleFontSize,
  descriptionFontSize,
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
}) => {
  const [Component, extra] = fitLayouts[index];
  const base = portrait ? portraitShared : shared;
  return <AbsoluteFill><Component
    {...base}
    {...extra as any}
    titleFontSize={titleFontSize}
    descriptionFontSize={descriptionFontSize}
    titleFontSizeIsUserSet={titleFontSizeIsUserSet}
    descriptionFontSizeIsUserSet={descriptionFontSizeIsUserSet}
  /></AbsoluteFill>;
};

const EndingPortraitDebug: React.FC = () => {
  const [, layout, Component, extra] = layouts[layouts.length - 1];
  return <AbsoluteFill><Component {...portraitShared} title="Starlit" narration="A calm cinematic scene." {...extra as any} /><SceneTransition layout={layout} accentColor={portraitShared.accentColor} bgColor={portraitShared.bgColor} textColor={portraitShared.textColor} /></AbsoluteFill>;
};

const DebugRoot: React.FC = () => <>
  <Composition id="StarlitNarrativeTransitionDebug" component={NarrativeDebug} durationInFrames={180} fps={30} width={1920} height={1080} />
  <Composition id="StarlitNarrativePortraitTransitionDebug" component={NarrativePortraitDebug} durationInFrames={180} fps={30} width={1080} height={1920} />
  <Composition id="StarlitHeroTransitionDebug" component={HeroDebug} durationInFrames={180} fps={30} width={1920} height={1080} />
  <Composition id="StarlitHeroPortraitTransitionDebug" component={HeroPortraitDebug} durationInFrames={180} fps={30} width={1080} height={1920} />
  <Composition id="StarlitStatPortraitDebug" component={StatPortraitDebug} durationInFrames={180} fps={30} width={1080} height={1920} />
  <Composition id="StarlitEndingPortraitDebug" component={EndingPortraitDebug} durationInFrames={180} fps={30} width={1080} height={1920} />
  <Composition id="StarlitSplitPortraitDebug" component={DebugPortraitLayout} defaultProps={{index: 0}} durationInFrames={180} fps={30} width={1080} height={1920} />
  <Composition id="StarlitFitStressLandscape" component={FitStressDebug} defaultProps={{index: 0, portrait: false}} durationInFrames={180} fps={30} width={1920} height={1080} />
  <Composition id="StarlitFitStressPortrait" component={FitStressDebug} defaultProps={{index: 0, portrait: true}} durationInFrames={180} fps={30} width={1080} height={1920} />
  {layouts.map(([name], index) => <Composition key={name} id={`Starlit${name}Debug`} component={DebugLayout} defaultProps={{index}} durationInFrames={180} fps={30} width={1920} height={1080} />)}
  {layouts.filter(([name]) => name === "Data" || name === "Table" || name === "Galaxy" || name === "RingedPhoto").map(([name]) => {
    const index = layouts.findIndex(([candidate]) => candidate === name);
    return <Composition key={`${name}-portrait`} id={`Starlit${name}PortraitDebug`} component={DebugPortraitLayout} defaultProps={{index}} durationInFrames={180} fps={30} width={1080} height={1920} />;
  })}
</>;

registerRoot(DebugRoot);
