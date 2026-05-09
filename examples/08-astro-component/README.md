# 08 — Astro component

A reusable `.astro` component for static sites and content-driven Astro projects.

## Files

- `PlayerStack.astro` — the component
- `usage.astro` — example page

## Why Astro is a good fit

Astro ships zero JavaScript by default. The `<player-stack>` custom element is just HTML in the static output. Playerstack's bundle loads asynchronously (`defer`) and hydrates the element on the client.

Result: the page is fully rendered (incl. SEO content around the player) before any JS runs. The player itself is interactive after the bundle loads.

## Usage

```astro
---
import PlayerStack from "./PlayerStack.astro";
---

<PlayerStack
  src="https://youtu.be/dQw4w9WgXcQ"
  title="Welcome video"
  config={{
    brandedThumb: { enabled: true, clickToLoad: true },
    ctaEnd: { enabled: true, title: "Continue?" },
  }}
/>
```

## Multiple players on one page

The component re-injects the script tag and CSS link on every render, but the browser deduplicates. If you have many players on a page and want to be tidy, hoist the `<script>` and `<link>` tags into your layout component.

## Static output

```html
<!-- After astro build, your page contains: -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/.../theme.css" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/.../layouts/video.css" />
<script
  src="https://cdn.jsdelivr.net/npm/playerstack@0.1.0/dist/playerstack.min.js"
  defer
></script>
<player-stack
  src="https://youtu.be/..."
  data-config='{"controls":...}'
></player-stack>
```

Pure HTML. CDN-hosted assets. No bundler involved for the player itself.
