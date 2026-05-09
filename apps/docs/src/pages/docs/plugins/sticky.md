---
layout: ../../../layouts/Docs.astro
title: sticky — Playerstack
description: Pin the player to the corner of the viewport when the user scrolls past it.
---

# sticky

> npm: [`@playerstack/plugin-sticky`](https://www.npmjs.com/package/@playerstack/plugin-sticky)

When the user scrolls past the player while it's playing, the plugin pins it to the bottom-right corner of the viewport. A close button lets the user dismiss the sticky state.

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

| Field       | Type    | Default | Description                                                                 |
| ----------- | ------- | ------- | --------------------------------------------------------------------------- |
| `enabled`   | boolean | `false` | Plugin is a no-op unless `true`                                             |
| `threshold` | number? | `0.1`   | IntersectionObserver threshold — how much of the player must remain in view |

## Behavior

- Sticks ONLY when the player has left the viewport AND `mediaPlayer.paused` is false
- Returns to inline when scrolled back into view
- Close button disconnects the observer permanently (no further sticky for this page load)

## Styling

The plugin injects a default stylesheet (`#playerstack-sticky-styles`) once per page. Override the position:

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
