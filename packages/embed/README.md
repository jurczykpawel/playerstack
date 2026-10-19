# playerstack

Embeddable video player. Drop one `<script>` tag, embed YouTube, Vimeo, MP4, or HLS with branding and CTAs. **MIT.**

This is the standalone bundle for `<script src=...>` use. For composable usage (pick which plugins to ship), use the scoped packages directly: `@playerstack/core` + the individual `@playerstack/plugin-*` source packages. These packages are not published to npm yet; build them from this repository.

## Quickstart

```html
<script
  src="https://playerstack.techskills.academy/playerstack.min.js"
  defer
></script>

<player-stack
  src="https://youtu.be/dQw4w9WgXcQ"
  data-config='{"controls":{"accent":"#008aff"}}'
>
</player-stack>
```

## What's bundled

This bundle pre-registers 15 of the 17 first-party plugins:

- `@playerstack/plugin-sources` — YouTube, Vimeo, MP4, HLS, WebM, DASH auto-detect
- `@playerstack/plugin-controls-policy` — theme + show/hide controls
- `@playerstack/plugin-autopreview` — muted autoplay in viewport
- `@playerstack/plugin-branded-thumb` — custom poster + click-to-load
- `@playerstack/plugin-cta-end` — overlay HTML at end of video
- `@playerstack/plugin-chapters` — clickable timecoded navigation
- `@playerstack/plugin-action-bar` — mid-video dismissible CTA banner
- `@playerstack/plugin-email-gate` — pause-and-collect lead capture
- `@playerstack/plugin-saved-position` — resume watching
- `@playerstack/plugin-sticky` — corner-pin on scroll
- `@playerstack/plugin-analytics` — beacon / gtag forwarder
- `@playerstack/plugin-yt-subscribe` — subscribe-on-YouTube bar
- `@playerstack/plugin-watermark` — corner-pinned logo/text overlay
- `@playerstack/plugin-custom-css` — arbitrary scoped CSS injection
- `@playerstack/plugin-intro-card` — pre-roll splash with title, subtitle, badge and CTA

`focus-mode` and `sellf-adapter` are **not** bundled; include their source packages in a custom build if you need them.

## Bundle size

The hosted `playerstack.min.js`, measured on 2026-10-19:

| Compression | Bytes | KiB (1,024 bytes) |
| --- | ---: | ---: |
| None | 839,898 | 820.2 |
| gzip (Node zlib defaults) | 244,671 | 238.9 |
| Brotli (quality 11) | 198,723 | 194.1 |

This measures the script served by the documentation site, not every possible local build. The standalone includes media elements and 15 plugins. Build from scoped source packages to choose your own plugins, then measure that output.

## Custom config

Full config schema is documented in the [main README](https://github.com/jurczykpawel/playerstack#readme) and on [playerstack.techskills.academy/docs](https://playerstack.techskills.academy/docs).

## License

MIT. Built on Mux's [media-chrome](https://github.com/muxinc/media-chrome) and [media-elements](https://github.com/muxinc/media-elements) (all MIT).
