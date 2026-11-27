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
| `offset`    | number? | `16`             | Distance in CSS pixels from both edges of the chosen corner                             |

## Behavior

- Sticks ONLY when the player has left the viewport AND `mediaPlayer.paused` is false
- Returns to inline when scrolled back into view
- Close button disconnects the observer permanently (no further sticky for this page load)

## Size

The pinned player is `min(360px, 40vw)` wide, which is 156 px on a 390 px screen. Overlays (CTA, email gate, action bar) stay inside the pinned box and become hard to use at that size; widen it with `.playerstack-sticky { width: ... }`, and use `!important` if the host page sets an inline width on `<player-stack>`.

## Styling

The plugin injects a default stylesheet (`#playerstack-sticky-styles`) once per page. Pick a corner with `position` and `offset`, or override the placement via CSS:

```css
.playerstack-sticky {
  bottom: 24px !important;
  left: 24px !important;
  right: auto !important;
  width: 320px;
}
```

## Use case

Blog posts where the video is at the top — visitors keep watching while they read. Industry standard for content-heavy sites.

## Events

None.
