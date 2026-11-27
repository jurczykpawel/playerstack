---
layout: ../../../layouts/Docs.astro
title: sticky — Playerstack
description: Pin the player to the corner of the viewport when the user scrolls past it.
---

# sticky

> Package: `@playerstack/plugin-sticky` ([source](https://github.com/jurczykpawel/playerstack/tree/main/packages/plugin-sticky)), not published to npm yet

When the user scrolls past the player while it's playing, the plugin pins it to a corner of the viewport (bottom-right by default). A close button lets the user dismiss the sticky state.

## Quickstart

```html
<player-stack
  src="https://example.com/v.mp4"
  data-config='{ "sticky": { "enabled": true } }'
>
</player-stack>
```

## Config

`config.sticky`:

| Field       | Type    | Default          | Description                                                                             |
| ----------- | ------- | ---------------- | --------------------------------------------------------------------------------------- |
| `enabled`   | boolean | `false`          | Plugin is a no-op unless `true`                                                         |
| `threshold` | number? | `0.15`           | IntersectionObserver threshold — how much of the player must remain in view             |
| `position`  | string? | `"bottom-right"` | `"bottom-right"`, `"bottom-left"`, `"top-right"` or `"top-left"` corner of the viewport |
| `offset`    | number? | `16`             | Distance from the corner edges in px; on narrow screens, the bottom gap (default 8)     |

## Behavior

- Sticks ONLY when the player has left the viewport AND `mediaPlayer.paused` is false
- Returns to inline when scrolled back into view
- Close button disconnects the observer permanently (no further sticky for this page load)
- Never pins a fullscreen player: entering fullscreen unpins it; after exit it pins again if still out of view and playing

## Size

| Viewport          | Pinned player                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| 600 px and wider  | `min(360px, 40vw)` wide, 16:9, in the configured corner                                                  |
| Narrower (phones) | Full width at the bottom with 8 px gaps plus `env(safe-area-inset-*)`, 16:9 (374×210 on a 390 px screen) |

On a narrow screen `position` does not apply and `offset` sets only the gap under the player (for example to clear a bottom navigation bar). Safe-area insets are non-zero only when the page uses `viewport-fit=cover`.

While a CTA card, e-mail form or intro card is open, the pinned player grows to `min(60dvh, 420px)` so its buttons are visible without scrolling; it shrinks back when the overlay closes. Longer texts, or very short screens, scroll inside the overlay. The close button (44 px) stays clickable above every overlay, and the plugin never scrolls the page.

The pinned player is never wider than the screen, even with an inline width on `<player-stack>`. To change its width, use `!important` and a selector stronger than the plugin's own:

```css
player-stack.playerstack-sticky.playerstack-sticky {
  width: 320px !important;
}
```

On a narrow screen add `left: auto !important` if the player should no longer span the screen.

## Styling

The plugin injects a default stylesheet (`#playerstack-sticky-styles`) once per page. Pick a corner with `position` and `offset`, or override the placement via CSS:

```css
@media (min-width: 600px) {
  .playerstack-sticky {
    bottom: 24px !important;
    left: 24px !important;
    right: auto !important;
  }
}
```

## Use case

Blog posts where the video is at the top — visitors keep watching while they read. Industry standard for content-heavy sites.

## Events

None.
