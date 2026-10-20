# playerstack

Embeddable video player. Drop one `<script>` tag, embed YouTube, Vimeo, MP4, or HLS with branding and CTAs. **Apache-2.0.**

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

The standalone `playerstack.min.js`, built from this repository and measured on 2026-10-20:

| Compression         |   Bytes | KiB (1,024 bytes) |
| ------------------- | ------: | ----------------: |
| None                | 183,830 |             179.5 |
| gzip (Bun zlib, 9)  |  47,287 |              46.2 |
| Brotli (quality 11) |  40,051 |              39.1 |

This is all a page with only MP4 players downloads. YouTube, HLS, Vimeo, Wistia and Twitch load on first use from `playerstack-<provider>.js` files in the same directory as `playerstack.min.js`; when self-hosting, copy all `playerstack*.js` files together. Per-source totals (gzip): YouTube 50.5 KiB, HLS 209.0 KiB, Vimeo 61.6 KiB, Wistia 49.3 KiB, Twitch 49.3 KiB — run `bun scripts/measure-bundle.ts` after a build. Bun 1.4.3 zlib was used; Node's zlib gives about 0.4% fewer gzip bytes.

This measures the standalone build in this repository, not every possible local build. The standalone includes the media-chrome controls the player creates and 15 plugins. Build from scoped source packages to choose your own plugins, then measure that output.

## Provider files and compatibility

`playerstack-youtube.js`, `playerstack-hls.js`, `playerstack-vimeo.js`, `playerstack-wistia.js` and `playerstack-twitch.js` keep the same names in every release; `playerstack.min.js` requests them with `?v=<content hash>`. The CDN may serve a cached `playerstack.min.js` for up to a year, and that old script will load the provider files of the latest release. Rules for future changes:

- A provider file only registers its custom element (`youtube-video`, `hls-video`, `vimeo-video`, `wistia-video`, `twitch-video`) from the upstream media-element package. It must not bundle Playerstack code or depend on internal APIs of a particular core version; `build.ts` fails if it does.
- The contract between core and providers is the tag name plus the standard media element API (attributes, `HTMLMediaElement` properties and events). Never rename or remove tags or files; add a new tag and file instead. `build.ts` fails if one of the five files is not produced.

If a provider file cannot be loaded (network error, blocked by CSP, missing file), the player stays empty, the error is logged as `[playerstack] could not load <tag>: …`, and the `<player-stack>` element dispatches a bubbling `playerstack:error` DOM event with `detail: { reason: "provider-load", tag, error }`. Another player of the same type added later retries the download.

```js
document.addEventListener("playerstack:error", (e) => {
  console.warn("player failed:", e.detail.reason, e.detail.tag);
});
```

## Custom config

Full config schema is documented in the [main README](https://github.com/jurczykpawel/playerstack#readme) and on [playerstack.techskills.academy/docs](https://playerstack.techskills.academy/docs).

## License

Apache-2.0. Built on Mux's [media-chrome](https://github.com/muxinc/media-chrome) and [media-elements](https://github.com/muxinc/media-elements) (all MIT).
