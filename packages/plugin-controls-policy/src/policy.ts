export const ALL_CONTROLS = ["play", "progress", "time", "volume", "fullscreen", "speed"] as const;

export type ControlName = (typeof ALL_CONTROLS)[number];

export interface ControlsPolicyConfig {
  show?: readonly ControlName[];
  accent?: string;
  bgOpacity?: number;
}

const HIDE_TARGETS: Record<ControlName, string> = {
  // Media Chrome tag names. Each control lists every tag (current name plus
  // older aliases that some Media Chrome versions still ship), so a single
  // policy rule covers every variant.
  play: "media-play-button",
  progress: "media-time-range, media-time-slider, media-progress-bar",
  time: "media-time-display, media-time, media-duration-display",
  volume: "media-volume-range, media-volume-slider, media-mute-button",
  fullscreen: "media-fullscreen-button",
  speed: "media-playback-rate-button, media-playback-rate-menu, media-menu-button",
};

const COLOR_SAFE = /^#[0-9a-fA-F]{3,8}$|^[a-zA-Z]+$|^rgba?\([^)]+\)$|^hsla?\([^)]+\)$/;

export interface PolicyResult {
  /** CSS custom properties to set inline on the <media-player> element. */
  vars: Record<string, string>;
  /** CSS rules to inject into the document so hidden controls disappear. */
  hideCss: string;
}

/**
 * Pure function: turn a ControlsPolicyConfig into the data the plugin needs.
 *
 * Why split: setting CSS variables via `:host` inside a light-DOM <style> child
 * of <media-player> doesn't work (host selector requires a shadow root). Variables
 * have to be set inline on the element. Hide rules can stay as document-level CSS.
 */
export function buildPolicy(config: ControlsPolicyConfig): PolicyResult {
  const vars: Record<string, string> = {};

  if (config.accent !== undefined && COLOR_SAFE.test(config.accent.trim())) {
    const color = config.accent.trim();
    vars["--ps-accent"] = color;
    vars["--media-brand"] = color;
    vars["--video-brand"] = color;
  }
  if (config.bgOpacity !== undefined && Number.isFinite(config.bgOpacity)) {
    const clamped = Math.max(0, Math.min(1, config.bgOpacity));
    vars["--ps-bg-opacity"] = String(clamped);
  }

  let hideCss = "";
  if (config.show !== undefined) {
    const showSet = new Set<string>(config.show);
    const hiddenSelectors: string[] = [];
    for (const name of ALL_CONTROLS) {
      if (showSet.has(name)) continue;
      hiddenSelectors.push(HIDE_TARGETS[name]);
    }
    if (hiddenSelectors.length > 0) {
      hideCss = `${hiddenSelectors.join(",\n")} {\n  display: none;\n}`;
    }
  }

  return { vars, hideCss };
}
