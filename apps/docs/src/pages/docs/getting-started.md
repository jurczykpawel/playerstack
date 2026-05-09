---
layout: ../../layouts/Docs.astro
title: Getting started — Playerstack
description: How to install and embed Playerstack on any HTML page.
---

# Getting started

Two ways to use Playerstack: drop the standalone bundle on a page (easy), or compose it from scoped packages (smaller bundle, more control).

## Option 1: standalone bundle (recommended)

One script tag, all 13 plugins included.

```html
<!doctype html>
<html>
  <head>
    <script
      src="https://cdn.jsdelivr.net/npm/playerstack@0.1.0/dist/playerstack.min.js"
      defer
    ></script>
  </head>
  <body>
    <player-stack src="https://youtu.be/dQw4w9WgXcQ"></player-stack>
  </body>
</html>
```

The `<player-stack>` custom element registers itself, the `sources` plugin validates the URL, and the core element picks the right inner media element (native `<video>` for MP4/WebM, `<youtube-video>`, `<vimeo-video>`, or `<hls-video>`) and mounts a default `<media-controller>` UI. You can configure plugins via `data-config` JSON or shorthand attributes.

## Option 2: scoped packages

Use this when you want a smaller bundle by including only the plugins you need.

```sh
npm install @playerstack/core @playerstack/plugin-sources @playerstack/plugin-cta-end
```

```ts
import { Playerstack } from "@playerstack/core";
import { sourcesPlugin } from "@playerstack/plugin-sources";
import { ctaEndPlugin } from "@playerstack/plugin-cta-end";

Playerstack.use(sourcesPlugin).use(ctaEndPlugin).define();
```

Now `<player-stack>` is registered with just two plugins instead of all 13.

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
