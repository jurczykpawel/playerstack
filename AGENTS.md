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
4. **The standalone UMD has an aspirational 50 KiB gzip budget, met for MP4 without plugin configuration (40.6 KiB on 2026-10-20, Bun zlib level 9), MP4 with controls/CTA/branded-thumb/custom-css (46.1 KiB), and YouTube without plugins (44.9 KiB); HLS (203.5 KiB) and Vimeo (56.0 KiB) exceed it.** Measure and document the artifact, date, compression settings, and units. Code-split per plugin when dist grows.
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
- Don't deploy on push. Releases are tagged manually until v1.0.

## Playback preferences

Core accepts `preload` (`none`, `metadata`, `auto`) from attributes or JSON, with JSON taking precedence. During asynchronous initialization, changes to observed attributes (`src`, `poster`, `title`, `preload`) override JSON values; removing `src` keeps the configured source, while invalid `preload` values are ignored. It sets loading and preview attributes before connecting the media. `none` disables automatic preview, and reduced motion prevents preview autoplay from the first connection. Branded thumbnails expose one named native button; keep their wrapper out of the tab order.

After changing these paths, build the standalone script and run `bunx playwright test -c playwright.preferences.config.ts` to check MP4 requests and real keyboard playback in Chromium and WebKit. The tests intercept all network requests locally and use the repository demo video. Public ready/media/tracks APIs are not implemented; plugins can use `ctx.mediaPlayer`.
