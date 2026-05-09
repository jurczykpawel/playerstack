export const ALL_CONTROLS = ["play", "progress", "time", "volume", "fullscreen", "speed"] as const;

export type ControlName = (typeof ALL_CONTROLS)[number];

export interface ControlsPolicyConfig {
  show?: readonly ControlName[];
  accent?: string;
  bgOpacity?: number;
}

const HIDE_TARGETS: Record<ControlName, string> = {
  play: "media-play-button",
  progress: "media-time-slider, media-progress-bar",
  time: "media-time, media-time-display",
  volume: "media-volume-slider, media-mute-button",
  fullscreen: "media-fullscreen-button",
  speed: "media-playback-rate-menu, media-menu-button",
};

const COLOR_SAFE = /^#[0-9a-fA-F]{3,8}$|^[a-zA-Z]+$|^rgba?\([^)]+\)$|^hsla?\([^)]+\)$/;

export function buildPolicyCss(config: ControlsPolicyConfig): string {
  const lines: string[] = [];

  const vars: string[] = [];
  if (config.accent !== undefined && COLOR_SAFE.test(config.accent.trim())) {
    vars.push(`--ps-accent: ${config.accent.trim()};`);
  }
  if (config.bgOpacity !== undefined && Number.isFinite(config.bgOpacity)) {
    const clamped = Math.max(0, Math.min(1, config.bgOpacity));
    vars.push(`--ps-bg-opacity: ${clamped};`);
  }
  if (vars.length > 0) {
    lines.push(`:host {`, ...vars.map((v) => `  ${v}`), `}`);
  }

  if (config.show !== undefined) {
    const showSet = new Set<string>(config.show);
    const hiddenSelectors: string[] = [];
    for (const name of ALL_CONTROLS) {
      if (showSet.has(name)) continue;
      hiddenSelectors.push(HIDE_TARGETS[name]);
    }
    if (hiddenSelectors.length > 0) {
      lines.push(`${hiddenSelectors.join(",\n")} {`, `  display: none;`, `}`);
    }
  }

  return lines.join("\n");
}
