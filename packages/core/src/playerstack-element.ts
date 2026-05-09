import "media-chrome";
import "youtube-video-element";
import "vimeo-video-element";
import "hls-video-element";

import { createEventBus, type EventBus } from "./events";
import { createInlineConfigProvider, type ConfigProvider, type PlayerstackConfig } from "./config";
import { createPluginRegistry, type PlayerstackPlugin } from "./plugins";

const OBSERVED_ATTRS = ["src", "poster", "title"] as const;

/** Tag name a plugin can request the inner media element to use. */
export type MediaElementTag = "video" | "youtube-video" | "vimeo-video" | "hls-video";

let registeredPlugins: readonly PlayerstackPlugin[] = [];
let configProvider: ConfigProvider = createInlineConfigProvider();

export function setPluginsForElement(plugins: readonly PlayerstackPlugin[]): void {
  registeredPlugins = plugins;
}

export function setConfigProviderForElement(provider: ConfigProvider): void {
  configProvider = provider;
}

/**
 * Heuristic source-type detection. Plugin-sources can override the choice
 * via `config.__elementTag` (set during its init) before the element is
 * appended; if not, this fallback runs.
 */
function detectElementTag(src: string): MediaElementTag {
  if (!src) return "video";
  if (/youtube\.com|youtu\.be|youtube-nocookie\.com/i.test(src)) return "youtube-video";
  if (/vimeo\.com/i.test(src)) return "vimeo-video";
  if (/\.m3u8(\?|$)/i.test(src)) return "hls-video";
  return "video";
}

export class PlayerstackElement extends HTMLElement {
  static get observedAttributes(): readonly string[] {
    return OBSERVED_ATTRS;
  }

  private mediaPlayer: HTMLElement | null = null;
  private events: EventBus | null = null;
  private destroyRegistry: (() => void) | null = null;

  connectedCallback(): void {
    if (this.mediaPlayer) return;
    void this.boot();
  }

  disconnectedCallback(): void {
    this.destroyRegistry?.();
    this.destroyRegistry = null;
    this.mediaPlayer = null;
    this.events = null;
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (!this.mediaPlayer) return;
    if (value === null) {
      this.mediaPlayer.removeAttribute(name);
    } else {
      this.mediaPlayer.setAttribute(name, value);
    }
  }

  private async boot(): Promise<void> {
    let config: PlayerstackConfig;
    try {
      config = await configProvider.load(this);
    } catch (err) {
      console.error("[playerstack]", (err as Error).message);
      return;
    }

    const { controller, mediaEl } = this.buildMediaController(config);
    this.appendChild(controller);
    this.mediaPlayer = mediaEl;

    const events = createEventBus();
    this.events = events;

    const registry = createPluginRegistry();
    for (const plugin of registeredPlugins) {
      registry.register(plugin);
    }

    try {
      await registry.init({
        events,
        container: this,
        mediaPlayer: mediaEl,
        config,
      });
    } catch (err) {
      console.error("[playerstack] plugin init failed:", err);
    }

    const deferredSrc = (config as { brandedThumb?: { clickToLoad?: boolean } }).brandedThumb
      ?.clickToLoad;
    if (!deferredSrc && !mediaEl.hasAttribute("src")) {
      mediaEl.setAttribute("src", config.src);
    }

    this.destroyRegistry = () => registry.destroy();
  }

  private buildMediaController(config: PlayerstackConfig): {
    controller: HTMLElement;
    mediaEl: HTMLElement;
  } {
    const tag: MediaElementTag = detectElementTag(config.src);

    const controller = document.createElement("media-controller");
    controller.style.width = "100%";
    controller.style.height = "100%";

    const mediaEl = document.createElement(tag);
    mediaEl.slot = "media";
    mediaEl.setAttribute("playsinline", "");
    mediaEl.setAttribute("crossorigin", "");
    if (config.poster) mediaEl.setAttribute("poster", config.poster);
    if (config.title) mediaEl.setAttribute("title", config.title);
    mediaEl.style.width = "100%";
    mediaEl.style.height = "100%";

    // Preview-mode initial attributes — must be set BEFORE the element connects
    // for the browser autoplay policy to honor them.
    const preview = (config as { preview?: { enabled?: boolean; loopUntilInteraction?: boolean } })
      .preview;
    if (preview?.enabled) {
      mediaEl.setAttribute("muted", "");
      mediaEl.setAttribute("autoplay", "");
      if (preview.loopUntilInteraction !== false) {
        mediaEl.setAttribute("loop", "");
      }
    }

    controller.appendChild(mediaEl);
    controller.appendChild(this.buildControlBar());

    return { controller, mediaEl };
  }

  private buildControlBar(): HTMLElement {
    const bar = document.createElement("media-control-bar");
    const buttons = [
      "media-play-button",
      "media-mute-button",
      "media-time-display",
      "media-time-range",
      "media-fullscreen-button",
    ];
    for (const tag of buttons) {
      bar.appendChild(document.createElement(tag));
    }
    return bar;
  }
}

const DEFAULT_STYLES = `
player-stack {
  display: block;
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
  overflow: hidden;
}
player-stack media-controller {
  display: block;
  width: 100%;
  height: 100%;
  --media-primary-color: var(--ps-accent, #008aff);
}
player-stack video,
player-stack youtube-video,
player-stack vimeo-video,
player-stack hls-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}
`;

function injectDefaultStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById("playerstack-defaults")) return;
  const style = document.createElement("style");
  style.id = "playerstack-defaults";
  style.textContent = DEFAULT_STYLES;
  document.head.appendChild(style);
}

export function definePlayerstackElement(): void {
  if (customElements.get("player-stack")) return;
  customElements.define("player-stack", PlayerstackElement);
  injectDefaultStyles();
}
