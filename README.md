# Playerstack

[![CI](https://github.com/jurczykpawel/playerstack/actions/workflows/ci.yml/badge.svg)](https://github.com/jurczykpawel/playerstack/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)
[![Tests](https://img.shields.io/badge/tests-237%20unit%20%2B%204%20e2e-brightgreen.svg)](#testing)

Embeddable video player for any HTML page. One script tag. YouTube, Vimeo, Wistia, Twitch, Bunny Stream, MP4, HLS. Brand it, add CTAs, gate emails — all via plugins. **Apache-2.0.**

> **Status:** v0.1.0 (initial release, 2026-05-09)

## Quickstart

```html
<script
  src="https://playerstack.techskills.academy/playerstack.min.js"
  defer
></script>

<player-stack
  src="https://youtu.be/dQw4w9WgXcQ"
  data-config='{"controls":{"accent":"#008aff"},"ctaEnd":{"enabled":true,"button":{"label":"Buy now","url":"https://example.com"}}}'
>
</player-stack>
```

The script is hosted by the documentation site. To self-host it, copy `playerstack.min.js`, `playerstack-youtube.js`, `playerstack-hls.js`, `playerstack-vimeo.js`, `playerstack-wistia.js`, `playerstack-twitch.js`, all 14 `playerstack-plugin-*.js` files and each file's `*.LEGAL.txt` notice from the same release into one directory on your domain. For a local build, run `bun install --frozen-lockfile` and `bun run --filter playerstack build`; all files are in `packages/embed/dist/`. `bash scripts/copy-standalone.sh <target-dir>` copies and checks this complete set.

That's it. The custom element registers itself, parses the URL, mounts the right Mux media element underneath (`<video>` for MP4/WebM, `<youtube-video>`, `<vimeo-video>`, `<wistia-video>`, `<twitch-video>`, or `<hls-video>`) inside `<media-controller>`, and applies the plugins from `data-config`.

## Why

Plyr and the Mux media-elements are great engines for developers — no marketing layer.
Presto Player has the marketing layer — only for WordPress.
**Playerstack** is the modern, framework-agnostic combination of both.

## Plugins (all Apache-2.0)

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

There are 17 first-party plugins in `packages/plugin-*`. The standalone `playerstack` bundle pre-registers 15 of them; `focus-mode` and `sellf-adapter` require a custom bundle from source. See `packages/embed/src/index.ts` for the registration list.

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
  docs/                       Astro site (playerstack.techskills.academy)
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

Playerstack is designed to embed on third-party pages. Config-driven inputs (HTML snippets, URLs, theming) are validated before they reach the DOM — see each plugin's README for the per-field contract.

## License

- Core + 17 first-party plugins: **Apache-2.0**
- Premium plugins (post-MVP): `@playerstack-pro/*`, proprietary
- Site / docs: Apache-2.0, except the demo video and its poster (CC BY 3.0, see [NOTICE](NOTICE))

## Bundle size

The standalone `playerstack.min.js`, built from this repository and measured on 2026-10-20, is 165,200 bytes raw (161.3 KiB), 41,579 bytes with gzip (40.6 KiB), and 35,022 bytes with Brotli (34.2 KiB). A page with only MP4 players and no plugin configuration downloads only this script. The previous build with all plugin code in the script was 48.3 KiB gzip.

| Page configuration                                   | gzip (KiB) | Brotli (KiB) |
| ---------------------------------------------------- | ---------: | -----------: |
| MP4, no plugin configuration                         |       40.6 |         34.2 |
| MP4, CTA and branded thumbnail                       |       43.7 |         36.8 |
| MP4, controls, CTA, branded thumbnail and custom CSS |       46.1 |         38.9 |
| YouTube, no plugin configuration                     |       44.9 |         38.0 |
| HLS, no plugin configuration                         |      203.5 |        168.0 |
| Vimeo, no plugin configuration                       |       56.0 |         47.9 |

The main script includes media-chrome controls and keyboard help, the sources plugin, and registrations for 14 conditional plugins. Each conditional plugin downloads only when its configuration enables it. Providers also load on first use. Files are fetched from the directory of the main script, with content versions in the query string. Keep all 20 standalone JS files and their 20 adjacent `*.LEGAL.txt` notices together when self-hosting; `bash scripts/copy-standalone.sh <target-dir>` checks and copies the complete release.

Measurements sum each downloaded JS file compressed separately with Bun 1.4.3 zlib, gzip level 9 and Brotli quality 11 (`bun scripts/measure-bundle.ts`). One KiB is 1,024 bytes; maps, notices, HTTP headers and media are excluded. Node's zlib produces slightly different gzip bytes. ESM/CJS builds retain their existing eager plugin imports; the scoped `@playerstack/*` packages are not published to npm yet. Use the hosted script, self-host a build, or build a custom bundle from this repository.

## Acknowledgements

Inspired by [Presto Player](https://prestoplayer.com) (the WordPress plugin we wanted, but framework-free). Built on Mux's [media-chrome](https://github.com/muxinc/media-chrome) and [media-elements](https://github.com/muxinc/media-elements). Thanks to all three projects.
