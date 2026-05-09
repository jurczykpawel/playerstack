# playerstack

Embeddable video player. Drop one `<script>` tag, embed YouTube, Vimeo, MP4, or HLS with branding and CTAs. **MIT.**

This is the standalone bundle for `<script src=...>` use. For composable usage (pick which plugins to ship), use the scoped packages directly: [`@playerstack/core`](https://www.npmjs.com/package/@playerstack/core) + the individual `@playerstack/plugin-*` packages.

## Quickstart

```html
<script
  src="https://cdn.jsdelivr.net/npm/playerstack@0.1.0/dist/playerstack.min.js"
  defer
></script>

<player-stack
  src="https://youtu.be/dQw4w9WgXcQ"
  data-config='{"controls":{"accent":"#008aff"}}'
>
</player-stack>
```

## What's bundled

This bundle pre-registers all 13 plugins:

- [`@playerstack/plugin-sources`](https://www.npmjs.com/package/@playerstack/plugin-sources) — YouTube, Vimeo, MP4, HLS, WebM, DASH auto-detect
- [`@playerstack/plugin-controls-policy`](https://www.npmjs.com/package/@playerstack/plugin-controls-policy) — theme + show/hide controls
- [`@playerstack/plugin-autopreview`](https://www.npmjs.com/package/@playerstack/plugin-autopreview) — muted autoplay in viewport
- [`@playerstack/plugin-branded-thumb`](https://www.npmjs.com/package/@playerstack/plugin-branded-thumb) — custom poster + click-to-load
- [`@playerstack/plugin-cta-end`](https://www.npmjs.com/package/@playerstack/plugin-cta-end) — overlay HTML at end of video
- [`@playerstack/plugin-chapters`](https://www.npmjs.com/package/@playerstack/plugin-chapters) — clickable timecoded navigation
- [`@playerstack/plugin-action-bar`](https://www.npmjs.com/package/@playerstack/plugin-action-bar) — mid-video dismissible CTA banner
- [`@playerstack/plugin-email-gate`](https://www.npmjs.com/package/@playerstack/plugin-email-gate) — pause-and-collect lead capture
- [`@playerstack/plugin-saved-position`](https://www.npmjs.com/package/@playerstack/plugin-saved-position) — resume watching
- [`@playerstack/plugin-sticky`](https://www.npmjs.com/package/@playerstack/plugin-sticky) — corner-pin on scroll
- [`@playerstack/plugin-focus-mode`](https://www.npmjs.com/package/@playerstack/plugin-focus-mode) — auto-pause on tab blur
- [`@playerstack/plugin-analytics`](https://www.npmjs.com/package/@playerstack/plugin-analytics) — beacon / gtag forwarder
- [`@playerstack/plugin-yt-subscribe`](https://www.npmjs.com/package/@playerstack/plugin-yt-subscribe) — subscribe-on-YouTube bar

The Sellf adapter is **not** bundled — install it separately if you need it.

## Bundle size

| File                      | Size   | Gzipped  |
| ------------------------- | ------ | -------- |
| `dist/playerstack.min.js` | 787 KB | 231.6 KB |

The bundle ships every Mux media-element (native `<video>`, `<youtube-video>`, `<vimeo-video>`, `<hls-video>`) so a single `<script>` tag covers every source type. Lazy-loading wrappers per source type (so MP4-only pages skip YouTube/Vimeo/HLS) is on the post-v0.2 roadmap. If size matters more than convenience, use the scoped `@playerstack/*` packages and bundle only what you need.

## Custom config

Full config schema is documented in the [main README](https://github.com/jurczykpawel/playerstack#readme) and on [playerstack.sellf.app/docs](https://playerstack.sellf.app/docs).

## License

MIT. Built on Mux's [media-chrome](https://github.com/muxinc/media-chrome) and [media-elements](https://github.com/muxinc/media-elements) (all MIT).
