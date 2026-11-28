// Include components created internally by the controller as well as our control bar.
import "media-chrome/dist/media-controller.js";
import "media-chrome/dist/media-keyboard-shortcuts-dialog.js";
import "media-chrome/dist/media-control-bar.js";
import "media-chrome/dist/media-play-button.js";
import "media-chrome/dist/media-mute-button.js";
import "media-chrome/dist/media-time-display.js";
import "media-chrome/dist/media-time-range.js";
import "media-chrome/dist/media-fullscreen-button.js";
// Native <video> needs no provider; every other media element loads on first
// use through ensureMediaElement().

import { createEventBus, type EventBus } from "./events";
import { createInlineConfigProvider, type ConfigProvider, type PlayerstackConfig } from "./config";
import { createPluginRegistry, type PlayerstackPlugin } from "./plugins";
import { isSafeHttpUrl } from "./safe-html";
import { ensureMediaElement, type MediaElementTag } from "./providers";

const OBSERVED_ATTRS = ["src", "poster", "title", "preload"] as const;

export type { MediaElementTag } from "./providers";

let registeredPlugins: readonly PlayerstackPlugin[] = [];
let configProvider: ConfigProvider = createInlineConfigProvider();

export function setPluginsForElement(plugins: readonly PlayerstackPlugin[]): void {
  registeredPlugins = plugins;
}

export function setConfigProviderForElement(provider: ConfigProvider): void {
  configProvider = provider;
}

/**
 * Heuristic source-type detection from `config.src`. Safari and iOS play HLS
 * natively, so native `<video>` there skips downloading hls.js unless
 * `config.hls` asks for hls.js options. Chrome also reports native HLS but
 * keeps hls.js (vendor check).
 */
function detectElementTag({ src, hls }: PlayerstackConfig): MediaElementTag {
  if (!src) return "video";
  if (/youtube\.com|youtu\.be|youtube-nocookie\.com/i.test(src)) return "youtube-video";
  if (/vimeo\.com/i.test(src)) return "vimeo-video";
  if (/(?:wistia\.com|wi\.st)\/(?:medias|embed)\//i.test(src)) return "wistia-video";
  if (/(?:^|\/\/)(?:www\.|go\.|player\.)?twitch\.tv\//i.test(src)) return "twitch-video";
  if (/\.m3u8(\?|$)/i.test(src))
    return hls ||
      !/^Apple/.test(navigator.vendor) ||
      !document.createElement("video").canPlayType("application/vnd.apple.mpegurl")
      ? "hls-video"
      : "video";
  return "video";
}

interface PreviewConfig {
  enabled?: boolean;
  loopUntilInteraction?: boolean;
  src?: string;
}

export class PlayerstackElement extends HTMLElement {
  static get observedAttributes(): readonly string[] {
    return OBSERVED_ATTRS;
  }

  private mediaPlayer: HTMLElement | null = null;
  private initializing = false;
  private bootGeneration = 0;
  private events: EventBus | null = null;
  private destroyRegistry: (() => void) | null = null;
  /** Attribute changes made while boot() is still waiting (config, provider). */
  private pendingAttrs = new Map<string, string | null>();
  /** Rebuilds the player; set while click-to-load still waits for the click. */
  private reboot: (() => void) | null = null;

  connectedCallback(): void {
    if (this.mediaPlayer) return;
    void this.boot();
  }

  disconnectedCallback(): void {
    this.bootGeneration++;
    this.initializing = false;
    this.destroyRegistry?.();
    this.mediaPlayer?.parentElement?.remove();
    this.destroyRegistry = null;
    this.mediaPlayer = null;
    this.events = null;
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (!this.mediaPlayer || this.initializing) {
      this.pendingAttrs.set(name, value);
      // Stop pending plugins before they can assign the previous source.
      // boot() restarts with these attributes once the current init settles.
      if (this.initializing) this.destroyRegistry?.();
      return;
    }
    if (name === "preload" && value !== null && !["none", "metadata", "auto"].includes(value))
      return;
    if (value === null) {
      this.mediaPlayer.removeAttribute(name);
      return;
    }
    // Before the click-to-load click a new source must stay behind the thumbnail.
    if (name === "src" && this.reboot && !this.mediaPlayer.hasAttribute("src")) {
      this.pendingAttrs.set(name, value);
      this.reboot();
      return;
    }
    if ((name === "src" || name === "poster") && !isSafeHttpUrl(value)) {
      this.mediaPlayer.removeAttribute(name);
      return;
    }
    this.mediaPlayer.setAttribute(name, value);
  }

  private async boot(restartConfig?: PlayerstackConfig): Promise<void> {
    const generation = ++this.bootGeneration;
    // Attributes present now are read by the config provider below.
    this.pendingAttrs.clear();
    let config: PlayerstackConfig;
    try {
      config = restartConfig ?? (await configProvider.load(this));
    } catch (err) {
      console.error("[playerstack]", (err as Error).message);
      return;
    }

    if (generation !== this.bootGeneration) return;

    // Loading a provider can take seconds; apply attribute changes made in the
    // meantime and pick the provider again if the source type changed. With
    // click-to-load the thumbnail is built first and the provider downloads
    // meantime (media-chrome and the provider elements upgrade in place).
    const deferredSrc = (config as { brandedThumb?: { clickToLoad?: boolean } }).brandedThumb
      ?.clickToLoad;
    let tag = detectElementTag(config);
    let ready: Promise<Error | void>;
    for (;;) {
      ready = ensureMediaElement(tag).catch((err: Error) => err);
      if (deferredSrc) break;
      const err = await ready;
      if (err) return this.providerFailed(tag, err);
      if (generation !== this.bootGeneration) return;
      config = this.applyPendingAttrs(config);
      const next = detectElementTag(config);
      if (next === tag) break;
      tag = next;
    }

    const { controller, mediaEl } = this.buildMediaController(config, tag);
    // Keep the connected DOM available to plugins without painting defaults.
    controller.style.visibility = "hidden";
    this.appendChild(controller);
    this.mediaPlayer = mediaEl;
    this.initializing = true;

    const events = createEventBus();
    this.events = events;

    const registry = createPluginRegistry();
    for (const plugin of registeredPlugins) {
      registry.register(plugin);
    }

    this.destroyRegistry = () => registry.destroy();
    let pluginsOk = true;
    try {
      await registry.init({
        events,
        container: this,
        mediaPlayer: mediaEl,
        config,
      });
    } catch (err) {
      pluginsOk = false;
      console.error("[playerstack] plugin init failed:", err);
    }

    if (generation !== this.bootGeneration) return;
    this.initializing = false;
    const teardown = () => {
      registry.destroy();
      this.destroyRegistry = null;
      controller.remove();
      this.mediaPlayer = null;
      this.events = null;
    };
    const err = await ready;
    if (generation !== this.bootGeneration) return;
    if (err) {
      teardown();
      return this.providerFailed(tag, err);
    }
    const reboot = () => {
      const next = this.applyPendingAttrs(config);
      teardown();
      void this.boot(next);
    };
    if (this.pendingAttrs.size > 0) return reboot();
    this.reboot = deferredSrc ? reboot : null;

    // If plugin init threw, don't write a fallback `src` — the sources
    // plugin owns the resolution decision and we must not override it.
    if (pluginsOk && !deferredSrc && !mediaEl.hasAttribute("src")) {
      mediaEl.setAttribute("src", config.src);
    }
    controller.style.removeProperty("visibility");
  }

  private providerFailed(tag: MediaElementTag, err: Error): void {
    console.error(`[playerstack] could not load <${tag}>:`, err.message);
    this.dispatchEvent(
      new CustomEvent("playerstack:error", {
        bubbles: true,
        detail: { reason: "provider-load", tag, error: err },
      }),
    );
  }

  private applyPendingAttrs(config: PlayerstackConfig): PlayerstackConfig {
    if (this.pendingAttrs.size === 0) return config;
    const next = { ...config };
    for (const [name, value] of this.pendingAttrs) {
      if (name === "preload") {
        if (value === null) delete next.preload;
        else if (value === "none" || value === "metadata" || value === "auto") next.preload = value;
        continue;
      }
      // `src` is required; removing it mid-boot keeps the configured source.
      if (value === null && name !== "src") delete next[name as "poster" | "title"];
      else if (value !== null) next[name as "src" | "poster" | "title"] = value;
    }
    this.pendingAttrs.clear();
    return next;
  }

  private buildMediaController(
    config: PlayerstackConfig,
    tag: MediaElementTag,
  ): {
    controller: HTMLElement;
    mediaEl: HTMLElement;
  } {
    const controller = document.createElement("media-controller");
    controller.style.width = "100%";
    controller.style.height = "100%";
    // Plugin overlays are siblings of the controller: fullscreen the whole player.
    (controller as HTMLElement & { fullscreenElement: Element }).fullscreenElement = this;

    const mediaEl = document.createElement(tag);
    // Must be set before the first source load, when hls.js is constructed.
    // Only number and boolean hls.js options: string and object options can
    // load code (`workerPath` starts a Web Worker), and data-config may come
    // from someone who must not run scripts on the page.
    if (tag === "hls-video" && config.hls) {
      (mediaEl as HTMLElement & { config?: unknown }).config = Object.fromEntries(
        Object.entries(config.hls).filter(([, v]) => typeof v == "boolean" || Number.isFinite(v)),
      );
    }
    mediaEl.slot = "media";
    mediaEl.setAttribute("playsinline", "");
    // Do NOT default `crossorigin` — when set, the browser refuses to load any
    // resource that doesn't reply with `Access-Control-Allow-Origin`. Most public
    // MP4 hosts (W3C, GCS, plain S3, etc.) don't ship CORS, so a default would
    // silently break playback. Opt in via `config.crossorigin` only when you
    // actually need cross-origin <track> captions, Canvas extraction, or Web Audio.
    if (config.crossorigin === "anonymous" || config.crossorigin === "use-credentials") {
      mediaEl.setAttribute("crossorigin", config.crossorigin);
    }
    if (isSafeHttpUrl(config.poster)) mediaEl.setAttribute("poster", config.poster);
    if (config.preload === "none" || config.preload === "metadata" || config.preload === "auto") {
      mediaEl.setAttribute("preload", config.preload);
    }
    if (config.title) mediaEl.setAttribute("title", config.title);
    mediaEl.style.width = "100%";
    mediaEl.style.height = "100%";

    // Twitch embed requires the host page domain in `parent` for CORS.
    // Caller supplies `config.twitch.parent` (single string or array).
    if (tag === "twitch-video") {
      const twitchCfg = (config as { twitch?: { parent?: string | string[] } }).twitch;
      const parents = Array.isArray(twitchCfg?.parent)
        ? twitchCfg.parent
        : twitchCfg?.parent
          ? [twitchCfg.parent]
          : [];
      const safeParents = parents.filter((p) => typeof p === "string" && /^[a-z0-9.-]+$/i.test(p));
      if (safeParents.length > 0) {
        mediaEl.setAttribute("parent", safeParents.join(","));
      }
    }

    // Preview-mode initial attributes — must be set BEFORE the element connects
    // for the browser autoplay policy to honor them.
    // With `preview.src` the autopreview plugin plays a separate light file and
    // the main media stays unmuted and idle until the branded-thumb click.
    const preview = (config as { preview?: PreviewConfig }).preview;
    const reducedMotion =
      typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (preview?.enabled && !preview.src && config.preload !== "none" && !reducedMotion) {
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

const DEFAULT_STYLES =
  "player-stack{display:block;position:relative;width:100%;aspect-ratio:16/9;background:#000;" +
  "overflow:hidden}player-stack media-controller{display:block;width:100%;height:100%;" +
  "--media-primary-color:var(--ps-accent,#008aff)}player-stack video,player-stack youtube-video," +
  "player-stack vimeo-video,player-stack hls-video,player-stack wistia-video," +
  "player-stack twitch-video{width:100%;height:100%;object-fit:contain;background:#000}";

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
