---
layout: ../../../layouts/Docs.astro
title: Plugins — Playerstack
description: Overview of the 17 first-party plugins shipped with Playerstack.
---

# Plugin overview

Every Playerstack feature beyond "play a video" is a plugin. There are 17 first-party plugins in the source. The standalone bundle pre-registers 15 of them; `focus-mode` and `sellf-adapter` require a custom build.

## Marketing

| Plugin                                       | What it does                                                      |
| -------------------------------------------- | ----------------------------------------------------------------- |
| [intro-card](/docs/plugins/intro-card)       | Pre-roll splash with title, subtitle, badge, CTA, big play button |
| [branded-thumb](/docs/plugins/branded-thumb) | Custom poster + click-to-load (LCP + GDPR)                        |
| [cta-end](/docs/plugins/cta-end)             | Overlay HTML at end of video, button with UTM, replay             |
| [action-bar](/docs/plugins/action-bar)       | Mid-video dismissible banner with CTA                             |
| [email-gate](/docs/plugins/email-gate)       | Lead capture: pause and require email to keep watching            |
| [yt-subscribe](/docs/plugins/yt-subscribe)   | Subscribe-on-YouTube bar below the player                         |
| [autopreview](/docs/plugins/autopreview)     | Muted autoplay when in viewport                                   |

## E-Learning

| Plugin                                         | What it does                                |
| ---------------------------------------------- | ------------------------------------------- |
| [chapters](/docs/plugins/chapters)             | Clickable chapter list, syncs with playback |
| [saved-position](/docs/plugins/saved-position) | Resume watching where the visitor left off  |
| [focus-mode](/docs/plugins/focus-mode)         | Auto-pause when the tab loses focus         |

## Performance & UX

| Plugin                                           | What it does                                         |
| ------------------------------------------------ | ---------------------------------------------------- |
| [sources](/docs/plugins/sources)                 | Auto-detects YT/Vimeo/MP4/HLS/WebM/DASH from one URL |
| [controls-policy](/docs/plugins/controls-policy) | Theme color, show/hide controls                      |
| [sticky](/docs/plugins/sticky)                   | Pin to viewport corner when scrolled past            |

## Branding

| Plugin                                 | What it does                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------- |
| [watermark](/docs/plugins/watermark)   | Corner-pinned logo or text overlay, optional click-through                    |
| [custom-css](/docs/plugins/custom-css) | Inject arbitrary scoped CSS — escape hatch for anything controls-policy lacks |

## Analytics & Integrations

| Plugin                                       | What it does                                       |
| -------------------------------------------- | -------------------------------------------------- |
| [analytics](/docs/plugins/analytics)         | Forward events to a beacon endpoint or `gtag`      |
| [sellf-adapter](/docs/plugins/sellf-adapter) | Load config from a Sellf product endpoint (opt-in) |

## Plugin lifecycle

Each plugin is an object with `name`, `init(ctx)`, and an optional `destroy(ctx)`.

When `<player-stack>` connects to the DOM:

1. The current `ConfigProvider` loads config from the element (default: inline attributes + `data-config`)
2. `<media-player>` is mounted with the config
3. `init(ctx)` runs on each registered plugin **in registration order**
4. `init` is awaited — async plugins block later plugins (rare, but supported)

When the element disconnects:

1. `destroy(ctx)` runs on each plugin **in reverse order**
2. Errors in destroy are caught and logged so all plugins get cleaned up

See [Core API](/docs/api) for the full interface.

## Multi-instance safety

Every first-party plugin uses a `WeakMap<PlayerstackContext, ...>` for per-element state. You can put dozens of `<player-stack>` elements on one page with different configs — they don't collide.

When you write your own plugin (see [Recipes](/docs/recipes)), use the same pattern.
