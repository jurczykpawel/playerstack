export const LAZY_PLUGINS = [
  { name: "controls-policy", exportName: "controlsPolicyPlugin", configKey: "controls" },
  { name: "autopreview", exportName: "autopreviewPlugin", configKey: "preview" },
  { name: "branded-thumb", exportName: "brandedThumbPlugin", configKey: "brandedThumb" },
  { name: "email-gate", exportName: "emailGatePlugin", configKey: "emailGate" },
  { name: "saved-position", exportName: "savedPositionPlugin", configKey: "savedPosition" },
  { name: "action-bar", exportName: "actionBarPlugin", configKey: "actionBar" },
  { name: "chapters", exportName: "chaptersPlugin", configKey: "chapters" },
  { name: "cta-end", exportName: "ctaEndPlugin", configKey: "ctaEnd" },
  { name: "sticky", exportName: "stickyPlugin", configKey: "sticky" },
  { name: "yt-subscribe", exportName: "ytSubscribePlugin", configKey: "ytSubscribe" },
  { name: "analytics", exportName: "analyticsPlugin", configKey: "analytics" },
  { name: "watermark", exportName: "watermarkPlugin", configKey: "watermark" },
  { name: "custom-css", exportName: "customCssPlugin", configKey: "customCss" },
  { name: "intro-card", exportName: "introCardPlugin", configKey: "introCard" },
] as const;

export type LazyPluginName = (typeof LAZY_PLUGINS)[number]["name"];
