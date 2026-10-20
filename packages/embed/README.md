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

The standalone script pre-registers 15 of the 17 first-party plugins. Only `sources` is included in the main script; the other 14 load when their configuration activates them:

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
| None                | 165,200 |             161.3 |
| gzip (Bun zlib, 9)  |  41,579 |              40.6 |
| Brotli (quality 11) |  35,022 |              34.2 |

This is the complete Playerstack JS download for an MP4 page without plugin configuration. With CTA and branded thumbnail it is 43.7 KiB gzip / 36.8 KiB Brotli; with controls and custom CSS as well it is 46.1 / 38.9 KiB. Without configured plugins, provider totals are YouTube 44.9 / 38.0 KiB, HLS 203.5 / 168.0 KiB, Vimeo 56.0 / 47.9 KiB, Wistia 43.8 / 37.0 KiB and Twitch 43.7 / 36.9 KiB.

Run `bun scripts/measure-bundle.ts` or `node scripts/measure-bundle.ts` after building. Totals sum each independently compressed JS file using gzip level 9 and Brotli quality 11, excluding maps, notices, HTTP headers and media. Bun 1.4.3 zlib was used above; Node produces slightly different gzip bytes. The main script retains media-chrome controls and keyboard help. ESM/CJS builds keep their existing eager plugin imports.

## Conditional plugins and self-hosting

Keep the main script, the five `playerstack-<provider>.js` files and all 14 `playerstack-plugin-<name>.js` files in one directory, each with its adjacent `*.LEGAL.txt` notice, from the same release. Run `bash scripts/copy-standalone.sh <target-dir>` to copy and check the complete set of 20 scripts and 20 notices. Copy `LICENSE` and `NOTICE` as well.

| File suffix (`playerstack-plugin-<name>.js`) | Configuration that loads it      |
| -------------------------------------------- | -------------------------------- |
| controls-policy                              | `controls` is present and truthy |
| autopreview                                  | `preview.enabled`                |
| branded-thumb                                | `brandedThumb.enabled`           |
| email-gate                                   | `emailGate.enabled`              |
| saved-position                               | `savedPosition.enabled`          |
| action-bar                                   | `actionBar.enabled`              |
| chapters                                     | nonempty `chapters.points`       |
| cta-end                                      | `ctaEnd.enabled`                 |
| sticky                                       | `sticky.enabled`                 |
| yt-subscribe                                 | `ytSubscribe.enabled`            |
| analytics                                    | `analytics.enabled`              |
| watermark                                    | `watermark.enabled`              |
| custom-css                                   | `customCss.enabled`              |
| intro-card                                   | `introCard.enabled`              |

Enabled modules download concurrently before `sources.init` sets the media URL. Their `init(ctx)` calls then run in the existing registration order with the same context and event bus. Every player on a page shares one download per module. The plugin files bundle only their implementation and needed helpers, never another media-chrome engine.

A network, CSP, missing-file or 15-second download timeout dispatches a bubbling `playerstack:error` DOM event with `detail: { reason: "plugin-load", plugin: "cta-end", error }`. The failed plugin is skipped for that player; playback and other plugins continue, and a later player retries. If branded-thumb cannot load, click-to-load falls back to normal media controls. A failed email-gate download also leaves playback available; client-side gates do not enforce access to the media URL. Errors thrown by a plugin's own `init` retain their existing behavior.

Plugin filenames remain stable and requests use `?v=<content hash>`. Cached main scripts can therefore load newer plugin files: keep filenames, names, `init(ctx)`, destroy and event contracts compatible across releases. The internal module registry keys each implementation by its full versioned URL. Self-host all files together and allow their directory in CSP `script-src`.

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

## Third-party notices

Every JavaScript build output has an adjacent `*.LEGAL.txt` file containing full dependency license texts and any upstream NOTICE files. Keep these notices with the scripts when redistributing. The build derives dependencies from esbuild output metadata and fails if a bundled package lacks a license text or a reviewed fallback. Chunks containing only project code include the project license and NOTICE. The copy step requires all 20 standalone scripts and all 20 notices before replacing any target files. HLS includes hls.js (Apache-2.0); the wrappers and media-chrome declare MIT. See [license source notes](licenses/README.md).

## Custom config

Full config schema is documented in the [main README](https://github.com/jurczykpawel/playerstack#readme) and on [playerstack.techskills.academy/docs](https://playerstack.techskills.academy/docs).

## License

Apache-2.0. Built on Mux's [media-chrome](https://github.com/muxinc/media-chrome) and [media-elements](https://github.com/muxinc/media-elements) (all MIT).
