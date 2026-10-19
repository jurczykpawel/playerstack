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

| Compression         |   Bytes | KiB (1,024 bytes) |
| ------------------- | ------: | ----------------: |
| None                | 237,183 |             231.6 |
| gzip (Node zlib, 9) |  59,689 |              58.3 |
| Brotli (quality 11) |  49,911 |              48.7 |

This is all a page with YouTube or MP4 players downloads. HLS, Vimeo, Wistia and Twitch load on first use from `playerstack-<provider>.js` files in the same directory as `playerstack.min.js`; when self-hosting, copy all `playerstack*.js` files together. Per-source totals (gzip): HLS 221.1 KiB, Vimeo 73.7 KiB, Wistia and Twitch 61.4 KiB each — run `bun scripts/measure-bundle.ts` after a build.

This measures the script served by the documentation site, not every possible local build. The standalone includes media-chrome, the YouTube element and 15 plugins. Build from scoped source packages to choose your own plugins, then measure that output.

## Provider files and compatibility

`playerstack-hls.js`, `playerstack-vimeo.js`, `playerstack-wistia.js` and `playerstack-twitch.js` keep the same names in every release; `playerstack.min.js` requests them with `?v=<content hash>`. The CDN may serve a cached `playerstack.min.js` for up to a year, and that old script will load the provider files of the latest release. Rules for future changes:

- A provider file only registers its custom element (`hls-video`, `vimeo-video`, `wistia-video`, `twitch-video`) from the upstream media-element package. It must not bundle Playerstack code or depend on internal APIs of a particular core version; `build.ts` fails if it does.
- The contract between core and providers is the tag name plus the standard media element API (attributes, `HTMLMediaElement` properties and events). Do not rename tags or files; add a new tag and file instead.

## Custom config

Full config schema is documented in the [main README](https://github.com/jurczykpawel/playerstack#readme) and on [playerstack.techskills.academy/docs](https://playerstack.techskills.academy/docs).

## License

MIT. Built on Mux's [media-chrome](https://github.com/muxinc/media-chrome) and [media-elements](https://github.com/muxinc/media-elements) (all MIT).
