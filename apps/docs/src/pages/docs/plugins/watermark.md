---
layout: ../../../layouts/Docs.astro
title: watermark — Playerstack
description: Corner-pinned logo or text overlay for branding, attribution, or copyright notices.
---

# watermark

> Package: `@playerstack/plugin-watermark` ([source](https://github.com/jurczykpawel/playerstack/tree/main/packages/plugin-watermark)), not published to npm yet

Pin a small image or text snippet to one corner of the player. Useful for brand logos, copyright lines, or attribution. Optional click-through link.

## Quickstart

Image mode:

```html
<player-stack
  src="https://youtu.be/dQw4w9WgXcQ"
  data-config='{
    "watermark": {
      "enabled": true,
      "src": "https://example.com/logo.svg",
      "position": "top-right",
      "width": 80,
      "opacity": 0.7,
      "href": "https://example.com"
    }
  }'
></player-stack>
```

Text mode:

```html
<player-stack
  src="https://example.com/v.mp4"
  data-config='{ "watermark": { "enabled": true, "text": "© ACME 2026", "position": "bottom-left" } }'
></player-stack>
```

## Config

`config.watermark`:

| Field      | Type                                                           | Default          | Description                                                                   |
| ---------- | -------------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------- |
| `enabled`  | `boolean`                                                      | `false`          | Plugin is a no-op unless `true`                                               |
| `src`      | `string`                                                       | —                | Image URL. Mutually exclusive with `text`                                     |
| `text`     | `string`                                                       | —                | Plain-text overlay. Mutually exclusive with `src`                             |
| `href`     | `string`                                                       | —                | Optional click-through URL. Must be `http(s)`; other schemes silently ignored |
| `position` | `"top-left" \| "top-right" \| "bottom-left" \| "bottom-right"` | `"bottom-right"` | Corner placement                                                              |
| `opacity`  | `number`                                                       | `0.7`            | 0–1; out-of-range clamped, invalid falls back to default                      |
| `margin`   | `number`                                                       | `16`             | Distance from corner in px; see bottom corners below                          |
| `width`    | `number`                                                       | `80`             | Image width in px (image mode only)                                           |

## Behavior

- Renders into the wrapper around the inner media element so the watermark sits inside the player frame, not over the page
- Only a linked watermark (`href`) takes pointer events; without a link, clicks pass through to the player
- Bottom corners stay above the control bar: the distance from the bottom edge is the larger of `margin` and `--ps-control-bar-clearance` (default `48px`). Override it on `player-stack`, for example `player-stack { --ps-control-bar-clearance: 0px; }` when the control bar is hidden, or raise it for a taller custom bar
- Visible in fullscreen, because the whole `<player-stack>` goes fullscreen (not in the native iPhone video fullscreen, see [Fullscreen](/docs/api#fullscreen))
- The text mode uses a small semi-transparent pill so it stays readable on bright frames

## Security

Any `href` that isn't `http:` or `https:` is silently dropped — `javascript:`, `data:`, `file:` etc. won't render the link wrapper. The overlay still draws.

## Events

None.
