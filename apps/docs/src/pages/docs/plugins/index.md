---
layout: ../../../layouts/Docs.astro
title: Plugins — Playerstack
description: Overview of the 6 first-party plugins shipped with Playerstack.
---

# Plugin overview

Every Playerstack feature beyond "play a video" is a plugin. The standalone bundle pre-registers five of them; the sixth (`sellf-adapter`) is opt-in.

| Plugin                                           | Bundled | What it does                                |
| ------------------------------------------------ | ------- | ------------------------------------------- |
| [sources](/docs/plugins/sources)                 | yes     | YouTube/Vimeo/MP4/HLS/WebM/DASH auto-detect |
| [controls-policy](/docs/plugins/controls-policy) | yes     | Theme color, show/hide controls             |
| [autopreview](/docs/plugins/autopreview)         | yes     | Muted autoplay in viewport                  |
| [branded-thumb](/docs/plugins/branded-thumb)     | yes     | Custom poster + click-to-load (LCP + GDPR)  |
| [cta-end](/docs/plugins/cta-end)                 | yes     | Overlay HTML at end of video                |
| [sellf-adapter](/docs/plugins/sellf-adapter)     | no      | Load config from a Sellf product endpoint   |

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
