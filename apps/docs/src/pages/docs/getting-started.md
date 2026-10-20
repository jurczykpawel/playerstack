---
layout: ../../layouts/Docs.astro
title: Getting started — Playerstack
description: How to install and embed Playerstack on any HTML page.
---

# Getting started

Two ways to use Playerstack: drop the standalone bundle on a page (easy), or compose it from scoped packages (smaller bundle, more control).

## Option 1: standalone bundle (recommended)

One script tag, 15 of the 17 first-party plugins included. `focus-mode` and `sellf-adapter` require a custom build from source.

```html
<!doctype html>
<html>
  <head>
    <script
      src="https://playerstack.techskills.academy/playerstack.min.js"
      defer
    ></script>
  </head>
  <body>
    <player-stack src="https://youtu.be/dQw4w9WgXcQ"></player-stack>
  </body>
</html>
```

The `<player-stack>` custom element registers itself, the `sources` plugin validates the URL, and the core element picks the right inner media element (native `<video>` for MP4/WebM, `<youtube-video>`, `<vimeo-video>`, or `<hls-video>`) and mounts a default `<media-controller>` UI. You can configure plugins via `data-config` JSON or shorthand attributes.

The bundle above is served free from this site's Cloudflare Pages CDN.

### Self-host the bundle

Prefer to serve it from your own domain (no third-party request)? Download
[`playerstack.min.js`](https://playerstack.techskills.academy/playerstack.min.js)
together with the provider files it loads on demand for YouTube, HLS, Vimeo, Wistia and Twitch
([`playerstack-youtube.js`](https://playerstack.techskills.academy/playerstack-youtube.js),
[`playerstack-hls.js`](https://playerstack.techskills.academy/playerstack-hls.js),
[`playerstack-vimeo.js`](https://playerstack.techskills.academy/playerstack-vimeo.js),
[`playerstack-wistia.js`](https://playerstack.techskills.academy/playerstack-wistia.js),
[`playerstack-twitch.js`](https://playerstack.techskills.academy/playerstack-twitch.js)),
all 14 conditional plugin files (`playerstack-plugin-controls-policy.js`,
`playerstack-plugin-autopreview.js`, `playerstack-plugin-branded-thumb.js`,
`playerstack-plugin-email-gate.js`, `playerstack-plugin-saved-position.js`,
`playerstack-plugin-action-bar.js`, `playerstack-plugin-chapters.js`,
`playerstack-plugin-cta-end.js`, `playerstack-plugin-sticky.js`,
`playerstack-plugin-yt-subscribe.js`, `playerstack-plugin-analytics.js`,
`playerstack-plugin-watermark.js`, `playerstack-plugin-custom-css.js`,
`playerstack-plugin-intro-card.js`), and each script's adjacent `*.LEGAL.txt` notice,
all from the same release. For a local build, run `bun install --frozen-lockfile`,
`bun run --filter playerstack build` and `bash scripts/copy-standalone.sh <target-dir>`.
The copy command requires all 20 scripts and 20 notices before replacing any files.
Keep the complete set in one directory, and point the script tag at your own path:

```html
<script src="/js/playerstack.min.js" defer></script>
```

It is Apache-2.0 licensed, so you can host and redistribute it freely. Keep a copy of the [LICENSE](https://github.com/jurczykpawel/playerstack/blob/main/LICENSE) and [NOTICE](https://github.com/jurczykpawel/playerstack/blob/main/NOTICE) files with it, next to the `*.LEGAL.txt` notices of the third-party code bundled in each script.

With a Content Security Policy, allow the directory that serves the script (for example
`script-src https://playerstack.techskills.academy/`), not only the full path of
`playerstack.min.js`: provider and enabled-plugin files load from the same directory. A policy with
`require-trusted-types-for 'script'` blocks them. In both cases MP4 still plays; YouTube, HLS,
Vimeo, Wistia and Twitch players stay empty and the element dispatches a `playerstack:error` event.
A plugin download blocked by CSP emits the same DOM event with `reason: "plugin-load"`
and the plugin name, and skips that plugin while playback continues. Plugin downloads time
out after 15 seconds. A poster plugin failure falls back to the normal playback controls.

## Option 2: scoped packages

Use this when you want a smaller bundle by including only the plugins you need.

> The `@playerstack/*` packages are not published to npm yet. Until they are,
> use the standalone bundle above, or build from source (`bun run --filter playerstack build`).
> The code below is for a custom bundle built from the repository.

```ts
import { Playerstack } from "@playerstack/core";
import { sourcesPlugin } from "@playerstack/plugin-sources";
import { ctaEndPlugin } from "@playerstack/plugin-cta-end";

Playerstack.use(sourcesPlugin).use(ctaEndPlugin).define();
```

Now `<player-stack>` is registered with just two plugins instead of the 15 in the standalone bundle.

## Configuring a player

Two equivalent ways:

```html
<!-- Shorthand attributes -->
<player-stack
  src="https://youtu.be/dQw4w9WgXcQ"
  poster="https://example.com/poster.webp"
  title="Demo"
>
</player-stack>

<!-- JSON config -->
<player-stack
  src="https://youtu.be/dQw4w9WgXcQ"
  data-config='{"poster":"https://example.com/poster.webp","title":"Demo"}'
>
</player-stack>
```

When both are present, `data-config` wins. Use shorthand for simple cases, JSON for plugin-specific options like `controls`, `preview`, `brandedThumb`, `ctaEnd`.

## Next steps

- [Plugin overview](/docs/plugins) — what each plugin does
- [Core API](/docs/api) — writing your own plugin or config provider
- [Recipes](/docs/recipes) — copy-paste patterns
