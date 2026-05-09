---
layout: ../../../layouts/Docs.astro
title: branded-thumb — Playerstack
description: Custom poster + click-to-load. No third-party cookies until interaction.
---

# branded-thumb

> npm: [`@playerstack/plugin-branded-thumb`](https://www.npmjs.com/package/@playerstack/plugin-branded-thumb)

Renders a custom poster overlay with an accessible play button. Optional `clickToLoad` mode defers the underlying iframe until the user clicks — eliminating third-party cookies and dramatically improving Largest Contentful Paint.

## Quickstart

```html
<player-stack
  src="https://youtu.be/dQw4w9WgXcQ"
  poster="https://cdn.example.com/poster.webp"
  data-config='{"brandedThumb":{"enabled":true,"clickToLoad":true,"playButtonStyle":"box"}}'
>
</player-stack>
```

## Config

`config.brandedThumb`:

| Field             | Type                             | Default    | Description                                                 |
| ----------------- | -------------------------------- | ---------- | ----------------------------------------------------------- |
| `enabled`         | boolean                          | `false`    | Plugin is a no-op unless `true`                             |
| `playButtonStyle` | `"minimal" \| "box" \| "circle"` | `"circle"` | Visual style of the play button (CSS hook via `data-style`) |
| `clickToLoad`     | boolean                          | `false`    | Defer iframe load until click (LCP + GDPR)                  |

## Why clickToLoad

YouTube and Vimeo iframes fetch tracking cookies as soon as they load — even before the user plays anything. With `clickToLoad: true`:

- **No third-party cookies** until the user clicks. You don't need a GDPR consent prompt for the embed itself.
- **Better Largest Contentful Paint** — about 200 KB of YouTube/Vimeo JS is deferred.
- **Cleaner privacy story** — perfect for compliance-focused brands.

The trade-off: the user has to click twice (once to load, once to play). For most use cases that's acceptable.

## How it works

When `clickToLoad: true`:

1. On `init`, the plugin reads `mediaPlayer.getAttribute("src")` and stores it
2. It removes the `src` attribute, so Vidstack doesn't load the iframe
3. It mounts an overlay with the poster and play button
4. On click, it restores the `src` attribute (Vidstack loads), removes the overlay, and emits `thumb:click`

## Events

| Name          | Payload     | When                    |
| ------------- | ----------- | ----------------------- |
| `thumb:click` | `undefined` | User clicks the overlay |

Track it via the event bus:

```ts
ctx.events.on("thumb:click", () => {
  // analytics / consent prompt / etc.
});
```
