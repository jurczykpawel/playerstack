# Changelog

All notable changes to Playerstack will be documented in this file.

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

### Plugins (13, all MIT)

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

Analytics & integrations:

- `@playerstack/plugin-analytics` — beacon / `gtag` event forwarder
- `@playerstack/plugin-sellf-adapter` — `createSellfConfigProvider({ baseUrl })` reads config from `/api/products/:id/playerstack` (opt-in, not in standalone bundle)

### Bundle

- Standalone `playerstack` UMD pre-registers all 13 marketing/e-learning/performance/analytics plugins
- 787 KB raw / 231.6 KB gzipped — every Mux media-element bundled so a single `<script>` tag covers every source type
- Lazy-loading the wrapper elements per source type (so MP4-only pages skip YouTube/Vimeo/HLS) is on the post-v0.1 roadmap

### Tests

- 203 unit tests across 15 packages (strict TDD, Vitest + happy-dom)
- 4 Playwright E2E tests targeting `apps/playground`
- All green on CI

### Documentation

- Astro 6 docs site at `playerstack.sellf.app` — landing, full `/docs` (getting-started, API, recipes, per-plugin pages), interactive `/playground` with 17 presets and per-preset "what to look for" tip panels
- robots.txt + llms.txt + sitemap + JSON-LD `SoftwareApplication` schema + OG/Twitter meta

### License

- Core + 14 MVP plugins: **MIT**
- Premium plugins (post-MVP): `@playerstack-pro/*`, proprietary, separate repo
