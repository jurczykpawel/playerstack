---
layout: ../../../layouts/Docs.astro
title: controls-policy — Playerstack
description: Theme color, opacity, and selective control hiding.
---

# controls-policy

> npm: [`@playerstack/plugin-controls-policy`](https://www.npmjs.com/package/@playerstack/plugin-controls-policy)

Brand the player with a theme color, hide controls you don't want, all via a single CSS injection.

## Quickstart

```html
<player-stack
  src="https://youtu.be/dQw4w9WgXcQ"
  data-config='{"controls":{"show":["play","progress","time"],"accent":"#008aff","bgOpacity":0.6}}'
>
</player-stack>
```

This shows ONLY play, progress, and time controls. Volume, fullscreen, and speed are hidden via `display: none`. The `--ps-accent` CSS variable is set to your color.

## Config

`config.controls`:

| Field       | Type                                                                        | Default       | Description                                                                                          |
| ----------- | --------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------- |
| `show`      | `("play" \| "progress" \| "time" \| "volume" \| "fullscreen" \| "speed")[]` | (all visible) | If set, only listed controls are visible                                                             |
| `accent`    | string (CSS color)                                                          | none          | Sets `--ps-accent` CSS var. Validated against injection: `#hex`, named colors, `rgb()`, `hsl()` only |
| `bgOpacity` | number `[0..1]`                                                             | none          | Sets `--ps-bg-opacity` CSS var. Clamped to `[0..1]`                                                  |

Unknown control names in `show` are silently ignored — safer than throwing on a typo.

## How it works

The plugin generates a single `<style data-playerstack="controls-policy">` block and injects it into `<media-player>`. The block contains:

- `:host { --ps-accent: ...; --ps-bg-opacity: ...; }` if those are set
- `media-volume-slider, media-fullscreen-button, ... { display: none; }` for hidden controls

It's deterministic, scoped, and safe to inject multiple times — the plugin replaces (not duplicates) on repeat init.

## Multi-instance

Each `<player-stack>` gets its own scoped style block. You can put dozens of players on one page with different themes — they don't collide.

## Events

None. The plugin only injects CSS.
