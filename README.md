# Playerstack

Embeddable video player for any HTML page. OSS first (MIT), plugin-first architecture, modern Web Components.

> **Status:** MVP in progress. Not yet released.

## What it is

A drop-in video player you embed with one `<script>` tag. Works with YouTube, Vimeo, MP4, and HLS without per-source configuration. Brand it, add CTAs at the end, gate emails — all via plugins.

Inspired by [Presto Player](https://prestoplayer.com) but framework-agnostic and not tied to WordPress.

## Quickstart (when v0.1.0 ships)

```html
<script src="https://cdn.jsdelivr.net/npm/playerstack@0.1.0/dist/playerstack.min.js" defer></script>

<player-stack
  src="https://youtu.be/dQw4w9WgXcQ"
  data-config='{"controls":{"accent":"#008aff"},"ctaEnd":{"button":{"label":"Buy now","url":"https://example.com"}}}'>
</player-stack>
```

## Repo layout

```
packages/
  core/                  @playerstack/core — engine wrapper + plugin runtime
  plugins/sources/       @playerstack/plugin-sources — YT/Vimeo/MP4/HLS resolver
  plugins/controls-policy
  plugins/autopreview
  plugins/branded-thumb
  plugins/cta-end
  embed/                 playerstack — standalone UMD bundle for <script>

apps/
  playground/            local dev demo
  docs/                  Astro docs site (post-MVP)
```

## Engine

Wraps [Vidstack](https://vidstack.io) (MIT) as the underlying media engine. We don't fork — we wrap.

## License

- Core + MVP plugins: MIT
- Premium plugins (post-MVP): proprietary, sold separately

## Design doc

See `vault/brands/techskills-academy/products/_db-products/playerstack.md` in the workspace.
