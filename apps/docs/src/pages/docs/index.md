---
layout: ../../layouts/Docs.astro
title: Docs — Playerstack
description: Documentation for Playerstack — embeddable video player with branding, CTAs, and click-to-load.
---

# Documentation

Playerstack is an embeddable video player you drop onto any HTML page with one `<script>` tag. It's a thin layer on top of Mux's [media-chrome](https://github.com/muxinc/media-chrome) and [media-elements](https://github.com/muxinc/media-elements) that adds the marketing features you actually need: branded thumbnails, click-to-load, end-of-video CTAs, autopreview, theming.

## Where to start

- **[Getting started](/docs/getting-started)** — install, embed your first player, configure plugins
- **[Plugin overview](/docs/plugins)** — what each plugin does, how to enable it, what to configure
- **[Core API](/docs/api)** — `Playerstack`, `EventBus`, `PlayerstackPlugin`, `ConfigProvider`
- **[Recipes](/docs/recipes)** — common patterns: custom plugin, custom config provider, analytics integration

## At a glance

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

That snippet uses three plugins (`sources` for URL detection, `controls-policy` for theme color, `cta-end` for the button at the end). You don't have to wire them up — the standalone bundle pre-registers 15 plugins.

## Try it

The [live playground](/playground) lets you tweak config and copy the embed snippet.
