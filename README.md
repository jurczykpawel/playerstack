# Playerstack

[![CI](https://github.com/jurczykpawel/playerstack/actions/workflows/ci.yml/badge.svg)](https://github.com/jurczykpawel/playerstack/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-237%20unit%20%2B%204%20e2e-brightgreen.svg)](#testing)

Embeddable video player for any HTML page. One script tag. YouTube, Vimeo, MP4, HLS. Brand it, add CTAs, gate emails — all via plugins. **MIT.**

> **Status:** v0.1.0 (initial release, 2026-05-09)

## Quickstart

```html
<script
  src="https://cdn.jsdelivr.net/npm/playerstack@0.1.0/dist/playerstack.min.js"
  defer
></script>

<player-stack
  src="https://youtu.be/dQw4w9WgXcQ"
  data-config='{"controls":{"accent":"#008aff"},"ctaEnd":{"enabled":true,"button":{"label":"Buy now","url":"https://example.com"}}}'
>
</player-stack>
```

That's it. The custom element registers itself, parses the URL, mounts the right Mux media element underneath (`<video>` for MP4/WebM, `<youtube-video>`, `<vimeo-video>`, or `<hls-video>`) inside `<media-controller>`, and applies the plugins from `data-config`.

## Why

Plyr and the Mux media-elements are great engines for developers — no marketing layer.
Presto Player has the marketing layer — only for WordPress.
**Playerstack** is the modern, framework-agnostic combination of both.

## Plugins (all MIT)

**Marketing**

| Plugin                              | What it does                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| `@playerstack/plugin-intro-card`    | Pre-roll marketing splash: title, subtitle, badge, CTA, big play button         |
| `@playerstack/plugin-branded-thumb` | Custom poster + click-to-load (LCP + GDPR — no third-party cookies until click) |
| `@playerstack/plugin-cta-end`       | Overlay HTML at end of video, button with UTM, replay                           |
| `@playerstack/plugin-action-bar`    | Mid-video dismissible banner with CTA button                                    |
| `@playerstack/plugin-email-gate`    | Lead capture: pause and require email before continuing                         |
| `@playerstack/plugin-yt-subscribe`  | Subscribe-on-YouTube bar below the player                                       |
| `@playerstack/plugin-autopreview`   | Muted autoplay in viewport, respects `prefers-reduced-motion`                   |

**E-Learning**

| Plugin                               | What it does                                    |
| ------------------------------------ | ----------------------------------------------- |
| `@playerstack/plugin-chapters`       | Clickable chapter list, syncs with playback     |
| `@playerstack/plugin-saved-position` | Resume watching from where the visitor left off |
| `@playerstack/plugin-focus-mode`     | Auto-pause when the tab loses focus             |

**Performance & UX**

| Plugin                                | What it does                                                    |
| ------------------------------------- | --------------------------------------------------------------- |
| `@playerstack/plugin-sources`         | Auto-detects YouTube/Vimeo/MP4/HLS/WebM/DASH from one `src` URL |
| `@playerstack/plugin-controls-policy` | Theme color, show/hide controls via whitelist                   |
| `@playerstack/plugin-sticky`          | Pin to viewport corner when scrolled past during playback       |

**Branding**

| Plugin                           | What it does                                                                  |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `@playerstack/plugin-watermark`  | Corner-pinned logo or text overlay with optional click-through                |
| `@playerstack/plugin-custom-css` | Inject arbitrary scoped CSS — escape hatch for anything controls-policy lacks |

**Analytics & Integrations**

| Plugin                              | What it does                                                       |
| ----------------------------------- | ------------------------------------------------------------------ |
| `@playerstack/plugin-analytics`     | Forward events to a beacon endpoint or `gtag` (Google Analytics 4) |
| `@playerstack/plugin-sellf-adapter` | Fetch config from a Sellf product endpoint (opt-in)                |

The standalone `playerstack` bundle pre-registers all 16 marketing/e-learning/performance/branding/analytics plugins. Use scoped packages directly for a custom bundle.

## Repo layout

```
packages/
  core/                       @playerstack/core
  plugin-sources/             @playerstack/plugin-sources
  plugin-controls-policy/     @playerstack/plugin-controls-policy
  plugin-autopreview/         @playerstack/plugin-autopreview
  plugin-branded-thumb/       @playerstack/plugin-branded-thumb
  plugin-cta-end/             @playerstack/plugin-cta-end
  plugin-action-bar/          @playerstack/plugin-action-bar
  plugin-email-gate/          @playerstack/plugin-email-gate
  plugin-chapters/            @playerstack/plugin-chapters
  plugin-saved-position/      @playerstack/plugin-saved-position
  plugin-sticky/              @playerstack/plugin-sticky
  plugin-focus-mode/          @playerstack/plugin-focus-mode
  plugin-analytics/           @playerstack/plugin-analytics
  plugin-yt-subscribe/        @playerstack/plugin-yt-subscribe
  plugin-watermark/           @playerstack/plugin-watermark
  plugin-custom-css/          @playerstack/plugin-custom-css
  plugin-intro-card/          @playerstack/plugin-intro-card
  plugin-sellf-adapter/       @playerstack/plugin-sellf-adapter
  embed/                      playerstack (standalone UMD bundle)
apps/
  playground/                 local Vite dev demo (Playwright e2e target)
  docs/                       Astro site (playerstack.sellf.app)
```

## Custom plugins

```ts
import { Playerstack } from "@playerstack/core";
import type { PlayerstackPlugin } from "@playerstack/core";

const myPlugin: PlayerstackPlugin = {
  name: "track-impression",
  init(ctx) {
    ctx.events.on("cta:click", () => fetch("/api/track", { method: "POST" }));
  },
};

Playerstack.use(myPlugin).define();
```

`init(ctx)` receives an event bus, the underlying media-player, the container element, and the resolved config. `destroy(ctx)` cleans up. See `packages/core/src/plugins.ts` for the full contract.

## Custom config sources

Implement `ConfigProvider` to load player config from anywhere:

```ts
import { createSellfConfigProvider } from "@playerstack/plugin-sellf-adapter";

const sellf = createSellfConfigProvider({ baseUrl: "https://sellf.app" });
// later: pass `sellf` to your custom Playerstack bootstrap
```

## Develop

```bash
bun install
bun run --filter playerstack-playground dev   # local demo
bun run test                                  # all packages
bun run --filter playerstack build            # standalone UMD bundle
```

## Engine

Built on the Mux media ecosystem (all MIT, all wrapped, never forked):

- [`media-chrome`](https://github.com/muxinc/media-chrome) — modular UI web components (`<media-controller>`, `<media-play-button>`, …)
- [`youtube-video-element`](https://github.com/muxinc/youtube-video-element) — YouTube wrapper that matches the native `<video>` API
- [`vimeo-video-element`](https://github.com/muxinc/media-elements/tree/main/packages/vimeo-video-element) — same idea for Vimeo
- [`hls-video-element`](https://github.com/muxinc/media-elements/tree/main/packages/hls-video-element) — HLS via hls.js, same API

Each wrapper exposes a real `<video>` (or iframe for YT/Vimeo), so browser autoplay policy, standard HTML5 events (`play`, `pause`, `ended`, `timeupdate`, `canplay`), and DOM attributes work out of the box. Plugins talk to the inner element via the same API regardless of source.

## License

- Core + 16 MVP plugins: **MIT**
- Premium plugins (post-MVP): `@playerstack-pro/*`, proprietary
- Site / docs: MIT

## Bundle size

The standalone `playerstack.min.js` ships every Mux media-element (native + YouTube + Vimeo + HLS) plus all 13 plugins, so a single `<script>` tag covers every source type. Lazy-loading the wrapper elements per source type (so MP4-only pages skip YouTube/Vimeo/HLS) is on the post-v0.2 roadmap. If size matters more than convenience, install the scoped `@playerstack/*` packages and bundle only what you need.

## Acknowledgements

Inspired by [Presto Player](https://prestoplayer.com) (the WordPress plugin we wanted, but framework-free). Built on Mux's [media-chrome](https://github.com/muxinc/media-chrome) and [media-elements](https://github.com/muxinc/media-elements). Thanks to all three projects.
