import "vidstack/player";
import "vidstack/player/layouts/default";
import "vidstack/player/ui";

import { createEventBus, type EventBus } from "./events";
import { createInlineConfigProvider, type ConfigProvider, type PlayerstackConfig } from "./config";
import { createPluginRegistry, type PlayerstackPlugin } from "./plugins";

const OBSERVED_ATTRS = ["src", "poster", "title"] as const;

let registeredPlugins: readonly PlayerstackPlugin[] = [];
let configProvider: ConfigProvider = createInlineConfigProvider();

export function setPluginsForElement(plugins: readonly PlayerstackPlugin[]): void {
  registeredPlugins = plugins;
}

export function setConfigProviderForElement(provider: ConfigProvider): void {
  configProvider = provider;
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

    const player = this.buildMediaPlayer(config);
    this.appendChild(player);
    this.mediaPlayer = player;

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
        mediaPlayer: player,
        config,
      });
    } catch (err) {
      console.error("[playerstack] plugin init failed:", err);
    }

    this.destroyRegistry = () => registry.destroy();
  }

  private buildMediaPlayer(config: PlayerstackConfig): HTMLElement {
    const player = document.createElement("media-player");
    player.setAttribute("src", config.src);
    if (config.poster) player.setAttribute("poster", config.poster);
    if (config.title) player.setAttribute("title", config.title);
    player.setAttribute("crossorigin", "");
    player.setAttribute("playsinline", "");
    player.style.width = "100%";
    player.style.aspectRatio = "16 / 9";

    const provider = document.createElement("media-provider");
    const layout = document.createElement("media-video-layout");

    player.appendChild(provider);
    player.appendChild(layout);

    return player;
  }
}

export function definePlayerstackElement(): void {
  if (customElements.get("player-stack")) return;
  customElements.define("player-stack", PlayerstackElement);
}
