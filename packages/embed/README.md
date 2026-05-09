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

This bundle pre-registers all 5 MVP plugins:

- [`@playerstack/plugin-sources`](https://www.npmjs.com/package/@playerstack/plugin-sources) — YouTube, Vimeo, MP4, HLS, WebM, DASH auto-detect
- [`@playerstack/plugin-controls-policy`](https://www.npmjs.com/package/@playerstack/plugin-controls-policy) — theme + show/hide controls
- [`@playerstack/plugin-autopreview`](https://www.npmjs.com/package/@playerstack/plugin-autopreview) — muted autoplay in viewport
- [`@playerstack/plugin-branded-thumb`](https://www.npmjs.com/package/@playerstack/plugin-branded-thumb) — custom poster + click-to-load
- [`@playerstack/plugin-cta-end`](https://www.npmjs.com/package/@playerstack/plugin-cta-end) — overlay HTML at end of video

The Sellf adapter is **not** bundled — install it separately if you need it.

## Bundle size

| File                      | Size    | Gzipped |
| ------------------------- | ------- | ------- |
| `dist/playerstack.min.js` | 411 KB  | 127 KB  |
| `dist/playerstack.esm.js` | (debug) | —       |
| `dist/playerstack.cjs`    | (debug) | —       |

Vidstack is the dominant cost. Slimming to <50 KB via lazy plugins and Vidstack treeshaking is on the post-v0.1 roadmap. If 127 KB is a deal-breaker, use the scoped packages and ship only what you need.

## Custom config

Full config schema is documented in the [main README](https://github.com/jurczykpawel/playerstack#readme) and on [playerstack.sellf.app/docs](https://playerstack.sellf.app/docs).

## License

MIT. Built on [Vidstack](https://vidstack.io) (also MIT).
