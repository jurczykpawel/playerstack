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

| Field                  | Type            | Default | Description                                                 |
| ---------------------- | --------------- | ------- | ----------------------------------------------------------- |
| `enabled`              | boolean         | `false` | Plugin is a no-op unless `true`                             |
| `threshold`            | number `[0..1]` | `0.5`   | How much of the player must be in view before play triggers |
| `loopUntilInteraction` | boolean         | `true`  | Loop the preview; `false` plays it once                     |
| `src`                  | string          | —       | Separate light preview clip shown under the play button     |
| `type`                 | string          | —       | MIME type of `src`; skipped if the browser cannot play it   |

## Light preview clip

Set `preview.src` to a short, small clip (for example 3 s, 320 px, no audio, ~15-30 KB). It plays muted in a loop under the thumbnail's play button while the player is in view and pauses out of view. The click (mouse, Enter or Space) removes the preview and starts the full video from 0:00 with sound and controls. Before the click only the preview file is downloaded.

`preview.src` requires `brandedThumb` with `enabled: true` and `clickToLoad: true`; without it the full source would load early, and the plugin logs a console warning.

```html
<player-stack
  src="https://example.com/full-video.mp4"
  data-config='{
    "poster": "https://example.com/poster.jpg",
    "preview": { "enabled": true, "src": "https://example.com/preview-3s.mp4", "type": "video/mp4" },
    "brandedThumb": { "enabled": true, "clickToLoad": true, "playLabel": "Watch the video" }
  }'
>
</player-stack>
```

The play button stays the only Tab stop in the player. With `prefers-reduced-motion: reduce` or `preload: "none"` no preview is created or downloaded and the thumbnail shows the static poster.

## Accessibility

If the user has `prefers-reduced-motion: reduce`, the plugin **does nothing** — no IntersectionObserver is created at all. This respects users who get nauseated by motion.

## Events

None.

## Tips

- Pair with `branded-thumb` + `clickToLoad` if you're using YouTube — autoplaying YouTube embeds is rate-limited and often blocked
- Use a short looping MP4 (5-15 seconds) for the smoothest experience
- Mute is always on for the preview; with `preview.src` the click always starts the full video unmuted from 0:00, also for a viewer whose earlier mute media-chrome remembers (independent of `unmuteOnPlay` and `restartOnPlay`)
- Email gate works with the light preview: `at: "before"` stays on top of the thumbnail; `at: "after"` appears after the full video ends
