# Changelog

All notable changes to Playerstack will be documented in this file.

## Unreleased

### Added

- Load email-gate optional fields and hardened submission code as separate versioned standalone modules; open forms never download the ALTCHA solver.

- Demonstrate uninterrupted after-video email collection on the landing page with a typed configuration example.

- Configurable marketing consent in email forms, with unchecked-by-default selection, wording/version payloads, and an optional required signup mode with translated validation.

- Email-gate after-video forms (`at: "after"`), optional privacy text/link and product identifier, dismissal, translated messages, and configurable memo retention.
- Email-gate supports object or base64 ALTCHA submissions with a fresh challenge and nonce per attempt; the README specifies the endpoint contract and response handling.

### Fixed

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
