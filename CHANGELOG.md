# Changelog

All notable changes to Playerstack will be documented in this file.

## Unreleased

### Breaking

- `custom-css`: `trustedCss` (and the deprecated `css`) now also needs the site owner's consent, because `data-config` may be written by people who cannot add scripts. **Migration:** add `data-allow-trusted-css` to the PlayerStack `<script>` tag, for example `<script src=".../playerstack.min.js" data-allow-trusted-css defer>`; in your own bundle register `createCustomCssPlugin({ allowTrustedCss: true })`. `acknowledgeTrusted: true` is still required; `tokens` are unchanged. Without consent the CSS is ignored with a console warning.

### Changed

- With `brandedThumb.clickToLoad`, the thumbnail no longer waits for the YouTube, Vimeo, HLS, Wistia or Twitch provider file: it shows at once and the provider downloads in parallel (thumbnail visible after a median 27 ms instead of 1,559 ms with a provider delayed by 1.5 s, Chromium).
- `analytics`: events go to `endpoint` with `fetch` (`credentials: "omit"`, `keepalive`, `no-cors`) instead of `navigator.sendBeacon`, so requests no longer carry cookies, as the docs promised. Endpoints that identified viewers by cookie should send an identifier in `customProps` instead. Firefox before 133 ignores `keepalive`, so the batch sent while leaving the page can be lost there.
- HLS on Safari and iOS (Apple WebKit) plays in a native `<video>` and no longer downloads `playerstack-hls.js` (about 166 KB gzip less per page). Set `config.hls` to keep hls.js there; other browsers are unchanged.
- Self-hosting: unlike v0.1.0, YouTube, HLS, Vimeo, Wistia and Twitch are no longer inside `playerstack.min.js`; they load on first use from sibling files. Copy `playerstack-youtube.js`, `playerstack-hls.js`, `playerstack-vimeo.js`, `playerstack-wistia.js` and `playerstack-twitch.js` (plus the plugin and feature files, see [Self-host the bundle](https://playerstack.techskills.academy/docs/getting-started/#self-host-the-bundle)) next to `playerstack.min.js`, or the player stays empty and emits `playerstack:error` for those sources; `bash scripts/copy-standalone.sh <dir>` copies the complete set.
- The `playerstack` package no longer declares a `browser` entry pointing at the standalone script, so bundlers pick the ESM build, which does not fetch sibling files (the package is not on npm yet).
- `data-config` wins over the `src`, `poster`, `title` and `preload` attributes when the player starts; changing one of those attributes later overrides it (documented, behaviour unchanged).

- `sticky`: below a 600 px viewport the pinned player now spans the screen at the bottom (8 px gaps plus safe-area insets) instead of a `40vw` corner box; `position` does not apply there and `offset` is only the bottom gap. At every width it grows to `min(60dvh, 420px)` while a CTA card, e-mail form or intro card is open.

### Fixed

- Wistia `fast.wistia.com/embed/medias/ID` and `/embed/iframe/ID` URLs now play: the player was handed `medias/ID` as the media id (#36).

- `config.hls` passes only number and boolean options to hls.js; string and object options are ignored. Options such as `abrEwmaDefaultEstimate`, `startLevel`, `capLevelToPlayerSize` and `maxBufferLength` work as before.
- `custom-css`: `trustedCss` that could style elements outside its player is dropped: `&` inside a pseudo-class, a sibling combinator after the player, an unclosed string or comment, and at-rules other than `@media`, `@supports`, `@container`, `@layer` and `@keyframes`.
- `sticky`: the pinned-player styles apply only to the `<player-stack>` element, so overlay HTML that reuses the `playerstack-sticky` class stays inside the player. Specificity is unchanged.
- `sticky`: the close button is 44 px and stays clickable above overlays; top action bars and the intro card close button no longer sit under it; an inline size on `<player-stack>` no longer pushes the pinned player off screen (#24).
- WordPress shortcode example: shortcode attributes can no longer add their own `data-config` keys; `accent` accepts only hex colors.

### Added

- `data-provider-base` on a `<script>` sets the directory of provider, plugin and feature files for a renamed, inlined, combined or `type="module"` copy of `playerstack.min.js` (WordPress cache and optimization plugins).

- `sellf-adapter`: `allowTrustedCss: true` keeps `customCss.trustedCss` from the Sellf response (the page must still allow raw CSS).
- `watermark.moveInterval` moves the watermark to a random spot inside the frame, above the control bar, every given number of seconds (`moveTransition` `smooth` or `jump`; reduced motion always jumps). `watermark.reinsert` puts a removed overlay back. All off by default; the Sellf adapter passes them through.

- `ctaEnd.at` (`"start"` or seconds) and `ctaEnd.atPercent` show the CTA card at the start or during playback: the video pauses and a skip button (`skipLabel`, also `Escape`) resumes it. `ctaEnd.frequency` limits the card to once per playback or per session. These modes download `playerstack-cta-end-timed.js` on demand; self-hosted setups must ship it. New events `cta:show` and `cta:skip`, forwarded by analytics by default.
- `actionBar.hideAt` / `hideAtPercent` give the bar a time window, `actionBar.variant: "badge"` renders it as a corner box, and `action-bar:show` reports its first appearance.
- The Sellf adapter passes the new `ctaEnd` and `actionBar` fields.
- The standalone script now starts analytics before the other plugins, so events reported while they start are counted.

- `analytics.watchTime` sends `watch_progress` (furthest point, seconds really watched, duration, percent) in batches on pause, end, page hide and source change; `watchTimeInterval` adds periodic sending. Off by default.

- `sticky.position` picks the viewport corner of the pinned player (`bottom-right` by default, `bottom-left`, `top-right`, `top-left`) and `sticky.offset` sets its distance from the edges in pixels.

- Chapters: `markers: true` splits the progress bar at chapter starts, names the chapter on hover, on keyboard focus and in the slider's value text, and jumps to the exact start on a click next to a marker. `menu: true` adds a chapters button and menu to the control bar (`menuLabel` names it). Both are off by default.

- `preview.src` (with optional `preview.type`) plays a separate light, muted, looping clip under the branded-thumb play button while the player is in view; the click aborts the preview download and starts the full video from 0:00 with sound and controls. Requires `brandedThumb` `enabled` and `clickToLoad`; reduced motion and `preload: "none"` skip the preview entirely.

- Load email-gate optional fields and hardened submission code as separate versioned standalone modules; open forms never download the ALTCHA solver.

- Demonstrate uninterrupted after-video email collection on the landing page with a typed configuration example.

- Configurable marketing consent in email forms, with unchecked-by-default selection, wording/version payloads, and an optional required signup mode with translated validation.

- Email-gate after-video forms (`at: "after"`), optional privacy text/link and product identifier, dismissal, translated messages, and configurable memo retention.
- Email-gate supports object or base64 ALTCHA submissions with a fresh challenge and nonce per attempt; the README specifies the endpoint contract and response handling.

- `config.hls` passes options to hls.js for HLS sources, for example `abrEwmaDefaultEstimate` to choose the starting quality. Without it the hls.js defaults apply.

### Fixed

- Fullscreen now targets the whole `<player-stack>`, so watermark, action bar, end card, email gate and other overlays stay visible. Page CSS that targeted `media-controller:fullscreen` should target `player-stack:fullscreen`.
- The default watermark no longer blocks the fullscreen button: bottom corners sit above the control bar (`--ps-control-bar-clearance`, default `48px`), and only a linked watermark takes pointer events.
- Sticky unpins a player that enters fullscreen and does not pin it while fullscreen.
- Send email-gate challenge and submission requests without cookies; support CORS endpoints that allow the embedding origin without Allow-Credentials.

- Keep email-gate triggers active while optional fields download; retry failed field downloads and show the configured network error without an incomplete form.
- Shorten the missing `challengeUrl` console diagnostic, including removal of its documentation URL.

- Keep long email forms, end cards, and intro cards in their own scroll areas so all content and actions remain reachable without scrolling the player.

- Keep form focus on an enabled field while a submission is pending so completion can restore it to CTA or player controls.

- Share controller locks between thumbnails and overlays, including either initialization and closing order.
- Stop email form completion and dismissal when an event listener destroys the plugin; ignore pending request results after destruction.
- Keep email forms above other player overlays and restore focus when they close.
- Honor `emailGate.atPercent` without requiring an explicit `at` value.
- Make CTA and intro overlays disable covered controls and restore keyboard focus; replay starts from zero.
- Export shared overlay layer helpers for plugins.

- Keep covered player controls out of the tab order and move focus to play (or the controller when play is hidden) after keyboard activation of a branded thumbnail; mouse activation leaves focus to the browser. Visible controls from other plugins remain in the tab order.

- Forward the `preload` configuration and attribute to the media element before connection; `none` also disables automatic previews.
- Respect reduced motion before setting preview autoplay attributes.
- Give branded thumbnails one named native keyboard button, supporting Enter and Space while keeping the whole thumbnail clickable.

### Bundle size

- On 2026-10-25 at `d1c216b`, the standalone MP4 configuration with controls-policy, CTA and branded thumbnail measured 45.9 KiB gzip; adding email-gate measured 50.1 KiB (51,260 B), 60 B above the aspirational 50 KiB budget. Bun 1.4.4, zlib gzip level 9, KiB = 1024 B; sum of individually compressed downloaded JS files, excluding maps, notices, HTTP and media.

- Shared controller-lock, lifecycle, consent, and overlay-scroll integration brings the same configurations to 46.3 KiB (47,414 B) and 51.1 KiB (52,331 B, 1,131 B above budget), using the same date, runtime and compression method.

### License

- The project license changes from MIT to Apache License 2.0. `LICENSE` is the
  unmodified Apache-2.0 text, `NOTICE` carries the copyright line, and every
  `package.json` declares `Apache-2.0`. v0.1.0 below was released under MIT.

## v0.1.0 — 2026-05-09

Initial release. MIT, plugin-first, framework-agnostic embeddable video player.

### Core

- `@playerstack/core` — `<player-stack>` custom element wrapping Mux's
  [`media-chrome`](https://github.com/muxinc/media-chrome) and the matching
  [`youtube-video-element`](https://github.com/muxinc/youtube-video-element) /
  `vimeo-video-element` / `hls-video-element` (all MIT). Public
  `Playerstack.use(plugin).define()` API. Pluggable `ConfigProvider`
  abstraction. Typed event bus, plugin registry with sequential async init
  and reverse-order destroy.
- The custom element picks the inner media element from the URL
  (MP4/WebM → `<video>`; YouTube → `<youtube-video>`; Vimeo → `<vimeo-video>`;
  HLS → `<hls-video>`) and wraps it in `<media-controller>` with a default
  `<media-control-bar>`. Browser autoplay-muted policy applies to the native
  inner element; plugins talk to it via the standard HTML5 media API
  (`play`, `pause`, `ended`, `timeupdate`, `canplay`).

### Plugins (15, all MIT)

Marketing:

- `@playerstack/plugin-branded-thumb` — custom poster + click-to-load (LCP + GDPR)
- `@playerstack/plugin-cta-end` — overlay HTML at `ended` event with title, button (UTM), replay
- `@playerstack/plugin-action-bar` — mid-video dismissible CTA banner
- `@playerstack/plugin-email-gate` — pause-and-collect lead capture, localStorage memo
- `@playerstack/plugin-yt-subscribe` — subscribe-on-YouTube bar
- `@playerstack/plugin-autopreview` — Intersection Observer driven muted autoplay; respects `prefers-reduced-motion`

E-Learning:

- `@playerstack/plugin-chapters` — clickable timecoded chapter list, syncs with playback
- `@playerstack/plugin-saved-position` — resume watching from last position
- `@playerstack/plugin-focus-mode` — auto-pause on tab blur

Performance & UX:

- `@playerstack/plugin-sources` — auto-detects YouTube, Vimeo, MP4, HLS, WebM, DASH from one `src` URL
- `@playerstack/plugin-controls-policy` — show/hide controls via whitelist; theme via `--ps-accent` / `--ps-bg-opacity` CSS vars; CSS-injection-safe color values
- `@playerstack/plugin-sticky` — corner-pin on scroll while playing

Branding:

- `@playerstack/plugin-watermark` — corner-pinned logo (image) or text overlay with optional click-through; configurable position, opacity, margin, width
- `@playerstack/plugin-custom-css` — inject arbitrary CSS scoped to a single `<player-stack>` instance via native CSS Nesting; Presto Pro feature parity. Sanitizes `</style>`, `@import`, `expression(`, `javascript:`

Analytics & integrations:

- `@playerstack/plugin-analytics` — beacon / `gtag` event forwarder
- `@playerstack/plugin-sellf-adapter` — `createSellfConfigProvider({ baseUrl })` reads config from `/api/products/:id/playerstack` (opt-in, not in standalone bundle)

### Bundle

- Standalone `playerstack` UMD pre-registers all 15 marketing/e-learning/performance/branding/analytics plugins
- 790 KB raw / 232.3 KB gzipped — every Mux media-element bundled so a single `<script>` tag covers every source type
- Lazy-loading the wrapper elements per source type (so MP4-only pages skip YouTube/Vimeo/HLS) is on the post-v0.1 roadmap

### Tests

- 237 unit tests across 17 packages (strict TDD, Vitest + happy-dom)
- 4 Playwright E2E tests targeting `apps/playground`
- All green on CI

### Documentation

- Astro 6 docs site at `playerstack.sellf.app` — landing, full `/docs` (getting-started, API, recipes, per-plugin pages), interactive `/playground` with 19 presets and per-preset "what to look for" tip panels
- robots.txt + llms.txt + sitemap + JSON-LD `SoftwareApplication` schema + OG/Twitter meta

### License

- Core + 16 MVP plugins: **MIT**
- Premium plugins (post-MVP): `@playerstack-pro/*`, proprietary, separate repo
