# AGENTS.md — Playerstack

Embeddable video player. OSS-first (Apache-2.0). Bun monorepo. Plugin-first architecture built on Mux media-chrome + media-elements.

## Stack

| Layer              | Choice                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Runtime            | Bun 1.4+ (CI 1.4.3, same as `packageManager`; `bun.lock` v2)                                                           |
| Workspaces         | Bun native (`apps/*`, `packages/*`)                                                                                    |
| Language           | TypeScript (strict, ES2020 target)                                                                                     |
| Engine             | Mux `media-chrome` + `youtube-video-element` / `vimeo-video-element` / `hls-video-element` (all MIT, wrapper not fork) |
| Embed              | Web Component `<player-stack>` + fallback `<div data-playerstack>`                                                     |
| Bundler            | esbuild → UMD + ESM                                                                                                    |
| Tests unit         | Vitest + happy-dom (strict TDD)                                                                                        |
| Tests E2E          | Playwright (Day 14)                                                                                                    |
| Docs (post-MVP)    | Astro on `playerstack.techskills.academy`                                                                              |
| Backend (post-MVP) | Hono + CF Workers + D1 + R2                                                                                            |

## Rules

1. **Strict TDD from Day 3-4 onwards.** Test-first, red → green → refactor, including DOM via happy-dom or Vitest browser mode. No production code in `packages/*/src/` lands without a preceding failing test. Day 1-2 (monorepo + engine wrapper) is the only exception — smoke-tested via Playwright manually.
2. **Core knows nothing about Sellf, SaaS, analytics, or lead capture.** All of that lives in plugins or pluggable Config Providers added at runtime.
3. **Plugin interface is stable.** Once `init(ctx)` and the event names are defined (Day 3-4), they are not changed without bumping a major version.
4. **The standalone UMD has an aspirational 50 KiB gzip budget, met for MP4 without plugin configuration (40.6 KiB on 2026-10-20, Bun zlib level 9), MP4 with controls/CTA/branded-thumb/custom-css (46.1 KiB), and YouTube without plugins (44.9 KiB); HLS (203.5 KiB) and Vimeo (56.0 KiB) exceed it.** On 2026-10-25 at `d1c216b`, the standalone MP4 configuration with controls-policy/CTA/branded-thumb measured 45.9 KiB gzip; adding email-gate measured 50.1 KiB (51,260 B), exceeding the aspirational budget by 60 B (Bun 1.4.4, zlib gzip level 9, KiB = 1024 B, sum of individually compressed downloaded JS files, excluding maps/notices/HTTP/media). After shared controller-lock, lifecycle, consent, and overlay-scroll integration the same configurations measured 46.3 KiB (47,414 B) and 51.1 KiB (52,331 B, 1,131 B above budget), with the same date/runtime/compression method. After the U25 lazy email split on 2026-10-25, the same MP4 controls/CTA/branded-thumb configuration measured 47,413 B (46.302 KiB), or 51,181 B (49.981 KiB) with basic open email-gate. Optional privacy/consent/product fields add 1,027 B; hardened submission adds 1,189 B. With both additions the total is 53,397 B (52.146 KiB), above budget. Artifacts: `packages/embed/dist/playerstack*.js`, Bun 1.4.4 zlib gzip level 9, each downloaded JS compressed separately; maps/notices/HTTP/media excluded. After W5 trigger/download recovery fixes on 2026-10-25, these totals are 47,412 B (46.301 KiB) without email-gate and 51,195 B (49.995 KiB) for basic open or hardened before submission. Optional fields bring init to 52,222 B (50.998 KiB); hardened submission adds 1,189 B, for 53,411 B (52.159 KiB) with all options. Measure and document the artifact, date, compression settings, and units. Code-split per plugin when dist grows. On 2026-11-26 the root `overrides` pinning the June 2026 bundle were removed; media-chrome 4.19.5 added 677 B to `playerstack.min.js`. The MP4 controls/CTA/branded-thumb/basic email-gate configuration now measures 51,872 B (48,088 B without email-gate), so `lazy-hardened-build.test.ts` enforces 51,900 B / 48,100 B instead of 50 KiB. Accepted because media-chrome 4.19.4+ renders error-dialog attribute values as text (HTML-injection hardening), and even the 4.19.4 minimum in `packages/core` exceeds 50 KiB. Same method: Bun 1.4.5, zlib gzip level 9, each JS file compressed separately. hls.js stays on the 1.6 line (root override `~1.6.19`, patch releases update automatically) because 1.7.4 adds 24,380 B gzip to `playerstack-hls.js`; moving to 1.7 is a separate decision when a security fix or feature requires it. On 2026-11-27 `config.hls` (hls.js options handed to `<hls-video>` by core) added 16 B to `playerstack.min.js`; the same configurations measure 51,887 B / 48,103 B (Bun 1.4.5, zlib gzip level 9, each JS file compressed separately), so the limits are 51,900 B / 48,200 B. The same day, making `<player-stack>` the fullscreen target added 8 B to `playerstack.min.js`; the same configurations measure 51,896 B / 48,112 B (same method). The same day, the on-demand switch for the `ctaEnd.at` / `atPercent` / `frequency` modes added 131 B in total (`playerstack-plugin-cta-end.js` 2,771 to 2,915 B, `playerstack.min.js` 42,447 to 42,444 B, `playerstack-plugin-email-gate.js` 3,784 to 3,774 B); the same configurations measure 52,026 B / 48,252 B (Bun 1.4.5, zlib gzip level 9, each JS file compressed separately), so the limits are 52,100 B / 48,300 B. The modes themselves ship in `playerstack-cta-end-timed.js` (908 B), downloaded only when used. On 2026-11-28 limiting `config.hls` to number and boolean options added 42 B to `playerstack.min.js` (42,443 to 42,485 B); the same configurations measure 52,067 B / 48,293 B (Bun 1.4.5, zlib gzip level 9, each JS file compressed separately), within the unchanged limits. The same day, playing HLS in a native `<video>` on Apple WebKit (Safari, every iOS browser) when `config.hls` is unset added 71 B to `playerstack.min.js` (42,485 to 42,556 B); the same configurations measure 52,138 B / 48,364 B (Bun 1.4.5, zlib gzip level 9, each JS file compressed separately), so the limits are 52,200 B / 48,400 B. Accepted because those browsers no longer download `playerstack-hls.js`: an HLS page in WebKit 27.2 fetched 208,653 B of gzip JS before and 42,304 B after (166,349 B less; Node zlib level 9). The same day, canonical Wistia URLs (#36) added 36 B to `playerstack.min.js` (42,556 to 42,592 B; 52,174 B / 48,400 B, within the limits), and `data-provider-base` (manual directory for provider and plugin files of a renamed, inlined or module copy) added 40 B (42,592 to 42,632 B); the same configurations measure 52,214 B / 48,440 B (same method), so the limits are 52,300 B / 48,500 B. The same day, building the controller and the branded-thumb overlay before the provider file arrives under `brandedThumb.clickToLoad` added 66 B to `playerstack.min.js` (42,632 to 42,698 B); the same configurations measure 52,280 B / 48,506 B (same method), so the limits are 52,300 B / 48,600 B. Accepted because the thumbnail appears after a median 27 ms instead of 1,559 ms when the HLS provider takes 1.5 s (Chromium, 5 runs). The same day, dropping `data-*` attributes and `playerstack*` class names from overlay HTML left `playerstack-plugin-cta-end.js` at 2,915 B and added 1 B to `playerstack.min.js` through the chunk hash; the same configurations measure 52,283 B / 48,510 B (same method), within the limits. The same day, making click-to-load wait for a click when branded-thumb cannot load, rebuilding the player when `src` changes before that click, and reading `data-provider-base` only from the executing script (other JavaScript `<script>` elements only for inlined or module copies) added 132 B to `playerstack.min.js` (42,701 to 42,833 B); the same configurations measure 52,388 B / 48,615 B (Bun 1.4.5, zlib gzip level 9, each JS file compressed separately), so the limits are 52,400 B / 48,700 B.
5. **No GPL code in core.** Presto Player code is GPL v3 — read it for ideas, don't copy verbatim. Our engine (Mux media-chrome + media-elements) is MIT.
6. **Apache-2.0 for core + MVP plugins.** Premium plugins (post-MVP) live in `@playerstack-pro/*` (proprietary, separate repo).
7. **No emoji in code.** Per workspace rules.
8. **Polish for business docs, English for code/technical docs.**

## Naming

- npm scope: `@playerstack/*` for monorepo packages (`@playerstack/core`, `@playerstack/plugin-cta-end`, …)
- npm standalone: `playerstack` — UMD bundle published from `packages/embed/`
- Custom element: `<player-stack>` (kebab-case, two words for valid Web Component name)
- Premium (future): `@playerstack-pro/*` (separate repo, not OSS)

## MVP scope (5 plugins)

1. `@playerstack/plugin-sources` — auto-detect YT/Vimeo/MP4/HLS
2. `@playerstack/plugin-controls-policy` — show/hide controls + theme via CSS vars
3. `@playerstack/plugin-autopreview` — Intersection Observer muted autoplay
4. `@playerstack/plugin-branded-thumb` — custom poster + click-to-load (LCP+GDPR)
5. `@playerstack/plugin-cta-end` — overlay HTML at `ended` event

## Workspace map

```
packages/
  core/        @playerstack/core
  plugins/*/   @playerstack/plugin-*
  embed/       playerstack (UMD bundle)
apps/
  playground/  local dev demo (vite or bun --hot)
  docs/        Astro docs (post-MVP, Day 11-12)
tests/
  e2e/         Playwright (Day 14)
```

## Sellf integration (post-MVP, Day 13)

`packages/plugins/sellf-adapter` reads config from existing Sellf product endpoint and feeds it to Playerstack. Sellf keeps its current React player (`projects/sellf/admin-panel/src/components/player/*`, 788 lines) until full migration. Source URL parsers from `projects/sellf/admin-panel/src/lib/videoUtils.ts` (394 lines) get ported to `packages/plugins/sources` as the default implementation.

## Domain & hosting

- Production domain: `playerstack.techskills.academy` (Cloudflare DNS, A record on `sellf.app` zone)
- Standalone script: `https://playerstack.techskills.academy/playerstack.min.js` (hosted with the docs; npm packages are not published yet)
- Docs: Cloudflare Pages or mikrus + Caddy (TBD Day 11-12)

## Don't

- Don't add abstractions or features beyond MVP scope without a design doc update.
- Don't pull in React/Vue/Svelte into `@playerstack/core` or `packages/embed`. Embed must be framework-free.
- `.github/workflows/ci.yml` deploys Cloudflare Pages project `playerstack` after every push to `main`, publishing both docs and the hosted `playerstack.min.js`. The deploy job publishes only the current tip of `main`: re-running an older run deploys nothing, so roll back with a revert commit (or in the Cloudflare dashboard). If the tip's run fails, nothing is deployed until it passes. Manual deployment is exceptional and must include `--commit-hash`. Releases are tagged manually until v1.0.

## Playback preferences

Core accepts `preload` (`none`, `metadata`, `auto`) from attributes or JSON, with JSON taking precedence. During asynchronous initialization, changes to observed attributes (`src`, `poster`, `title`, `preload`) override JSON values; removing `src` keeps the configured source, while invalid `preload` values are ignored. It sets loading and preview attributes before connecting the media. `none` disables automatic preview, and reduced motion prevents preview autoplay from the first connection. Branded thumbnails expose one named native button; keep their wrapper out of the tab order. The thumbnail is the only Tab stop among controls it covers; visible action-bar controls and linked watermarks remain keyboard accessible. Keyboard activation moves focus to play, falling back to the controller when play cannot receive focus; mouse activation leaves focus to the browser.

After changing these paths, build the standalone script and run `bunx playwright test -c playwright.preferences.config.ts` to check MP4 requests and real keyboard playback in Chromium and WebKit. The tests intercept all network requests locally and use the repository demo video. Public ready/media/tracks APIs are not implemented; plugins can use `ctx.mediaPlayer`.

Overlay plugins use core `activateOverlay(container, overlay, priority = 3, focusFromBody = false)` after mounting and release before removal/destroy. Match priority to CSS z-index (CTA/intro 3, higher gates 4). It preserves prior inert/aria-hidden state across nested layers and newly mounted siblings. Do not implement independent inert toggles for new overlay plugins. Keyboard overlay regression: `bunx playwright test -c playwright.overlays.config.ts` (Chromium/WebKit, 390/1440), after building standalone.
Chapter markers and menu regression: `bunx playwright test -c playwright.chapters.config.ts` (Chromium/WebKit, 390/1440), after building standalone. Markers write to media-chrome's `media-time-range` (`mediaChaptersCues`) and its `media-preview-chapter-display`, so run it after a media-chrome update.
Sellf email-gate regression: `bunx playwright test -c playwright.sellf.config.ts` (Chromium/WebKit), after building standalone.

On 2026-10-25, the U25 standalone build with MP4 + CTA + branded thumbnail measured 45,879 bytes (44.8 KiB) gzip versus 45,000 bytes (43.9 KiB) at c67eb4d. Measured each downloaded JS artifact separately using Bun 1.4.4 zlib gzip level 9; maps, notices, headers and media excluded.

On 2026-10-28 (`preview.src`), MP4 + controls + CTA + branded thumbnail measured 47,413 B gzip (47,414 B at c765c73); adding `preview.src` loads the autopreview chunk, for 48,608 B (autopreview 1,195 B vs 579 B). The preview clip is media and excluded. Same method: Bun 1.4.4 zlib gzip level 9, each downloaded JS compressed separately.
