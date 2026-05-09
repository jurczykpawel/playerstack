# Changelog

All notable changes to Playerstack will be documented in this file.

## v0.1.0 — 2026-05-09

Initial public release. MVP shipped end-to-end in one session.

### Added

- `@playerstack/core` — engine wrapper: `<player-stack>` custom element wrapping
  Vidstack 1.12.13. Public `Playerstack.use(plugin).define()` API. Pluggable
  ConfigProvider abstraction. Typed event bus, plugin registry with sequential
  async init and reverse-order destroy.
- `@playerstack/plugin-sources` — auto-detects YouTube, Vimeo, MP4, HLS, WebM,
  DASH from a single `src` URL. Handles youtu.be, watch?v=, /embed, /shorts, /v,
  m.youtube.com, youtube-nocookie.com, vimeo.com/ID, vimeo.com/ID/HASH,
  player.vimeo.com, plus the Vidstack short forms.
- `@playerstack/plugin-controls-policy` — show/hide controls via whitelist,
  theme via `--ps-accent` and `--ps-bg-opacity` CSS variables. CSS injection
  protection on color values. Per-context style block.
- `@playerstack/plugin-autopreview` — Intersection Observer driven muted
  autoplay when player enters viewport, pause when it leaves. Respects
  `prefers-reduced-motion`.
- `@playerstack/plugin-branded-thumb` — custom poster overlay with accessible
  play button (minimal/box/circle styles). `clickToLoad` defers Vidstack iframe
  loading (LCP + GDPR — no third-party cookies until interaction).
- `@playerstack/plugin-cta-end` — overlay HTML at native `ended` event with
  optional title, custom HTML, anchor button (label + url + utm), replay
  button. Emits `cta:click` and `cta:replay` events.
- `@playerstack/plugin-sellf-adapter` — `createSellfConfigProvider({ baseUrl })`
  fetches config from `/api/products/:id/playerstack` when
  `data-sellf-product` is set on the element. Inline attributes win on merge.
- `playerstack` — standalone UMD bundle pre-registers all 5 MVP plugins so a
  single `<script src=...>` is enough to use the player.
- `apps/playground` — local Vite dev demo with two players (YouTube + MP4).
- `apps/docs` — Astro 6.3.1 site for `playerstack.sellf.app`. Landing,
  interactive `/playground` config editor, `robots.txt` + `llms.txt`,
  sitemap, JSON-LD SoftwareApplication schema, OG/Twitter meta.

### Tested

- Strict TDD from Day 3 onwards. 80+ unit tests across 7 packages.
- Browser smoke test via Playwright: YouTube and MP4 sources both render with
  Vidstack default UI.

### Bundle size

`playerstack.min.js` is 411 KB raw / 127 KB gzipped. Vidstack engine is the
dominant contributor. Optimizing toward the 50 KB target via lazy-loaded
plugins and Vidstack treeshaking is deferred to post-v0.1.

### License

Core and all 6 plugins ship under MIT. Premium plugins (post-MVP) live in a
separate `@playerstack-pro/*` namespace and are proprietary.
