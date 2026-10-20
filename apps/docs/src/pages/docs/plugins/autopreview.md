---
layout: ../../../layouts/Docs.astro
title: autopreview — Playerstack
description: Muted autoplay when the player enters the viewport.
---

# autopreview

> Package: `@playerstack/plugin-autopreview` ([source](https://github.com/jurczykpawel/playerstack/tree/main/packages/plugin-autopreview)), not published to npm yet

Plays muted when the player scrolls into view, pauses when it scrolls out. Great for blog posts and landing pages where you want video to feel alive without forcing the user to click.

## Quickstart

```html
<player-stack
  src="https://example.com/preview.mp4"
  data-config='{"preview":{"enabled":true,"threshold":0.6}}'
>
</player-stack>
```

## Config

`config.preview`:

| Field                  | Type            | Default    | Description                                                 |
| ---------------------- | --------------- | ---------- | ----------------------------------------------------------- |
| `enabled`              | boolean         | `false`    | Plugin is a no-op unless `true`                             |
| `threshold`            | number `[0..1]` | `0.5`      | How much of the player must be in view before play triggers |
| `loopUntilInteraction` | boolean         | (reserved) | Reserved; current build always loops while in view          |

## Accessibility

If the user has `prefers-reduced-motion: reduce`, the plugin **does nothing** — no IntersectionObserver is created at all. This respects users who get nauseated by motion.

## Events

None.

## Tips

- Pair with `branded-thumb` + `clickToLoad` if you're using YouTube — autoplaying YouTube embeds is rate-limited and often blocked
- Use a short looping MP4 (5-15 seconds) for the smoothest experience
- Mute is always on; the user can unmute via the controls
