# Playerstack

[![CI](https://github.com/jurczykpawel/playerstack/actions/workflows/ci.yml/badge.svg)](https://github.com/jurczykpawel/playerstack/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![npm](https://img.shields.io/npm/v/playerstack.svg)](https://www.npmjs.com/package/playerstack)
[![Tests](https://img.shields.io/badge/tests-139%20unit%20%2B%204%20e2e-brightgreen.svg)](#testing)

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

That's it. The custom element registers itself, parses the URL, mounts a Vidstack player underneath, and applies the plugins from `data-config`.

## Why

Vidstack and Plyr are great engines for developers — no marketing layer.
Presto Player has the marketing layer — only for WordPress.
**Playerstack** is the modern, framework-agnostic combination of both.

## Plugins (all MIT, all opt-in)

| Plugin                                | What it does                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| `@playerstack/plugin-sources`         | Auto-detects YouTube/Vimeo/MP4/HLS/WebM/DASH from one `src` URL                 |
| `@playerstack/plugin-controls-policy` | Theme color, show/hide controls via whitelist                                   |
| `@playerstack/plugin-autopreview`     | Muted autoplay in viewport, respects `prefers-reduced-motion`                   |
| `@playerstack/plugin-branded-thumb`   | Custom poster + click-to-load (LCP + GDPR — no third-party cookies until click) |
| `@playerstack/plugin-cta-end`         | Overlay HTML at end of video, button with UTM, replay                           |
| `@playerstack/plugin-sellf-adapter`   | Fetch config from a Sellf product endpoint                                      |

The standalone `playerstack` bundle pre-registers all 5 MVP plugins. Use scoped packages directly if you want a smaller, custom bundle.

## Repo layout

```
packages/
  core/                       @playerstack/core
  plugin-sources/             @playerstack/plugin-sources
  plugin-controls-policy/     @playerstack/plugin-controls-policy
  plugin-autopreview/         @playerstack/plugin-autopreview
  plugin-branded-thumb/       @playerstack/plugin-branded-thumb
  plugin-cta-end/             @playerstack/plugin-cta-end
  plugin-sellf-adapter/       @playerstack/plugin-sellf-adapter
  embed/                      playerstack (standalone UMD bundle)
apps/
  playground/                 local Vite dev demo
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

Wraps [Vidstack](https://vidstack.io) (MIT). We don't fork — we wrap. Vidstack ships YouTube, Vimeo, native HTML5, HLS, and DASH out of the box.

## License

- Core + 6 MVP plugins: **MIT**
- Premium plugins (post-MVP): `@playerstack-pro/*`, proprietary
- Site / docs: MIT

## Bundle size

411 KB raw / 127 KB gzipped (v0.1.0). Vidstack is the dominant cost. Slimming towards 50 KB via lazy-loaded plugins and Vidstack treeshaking is on the post-v0.1 roadmap.

## Acknowledgements

Inspired by [Presto Player](https://prestoplayer.com) (the WordPress plugin we wanted, but framework-free). Built on [Vidstack](https://vidstack.io). Thanks to both projects.
