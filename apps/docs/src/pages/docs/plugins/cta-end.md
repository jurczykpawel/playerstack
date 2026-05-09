---
layout: ../../../layouts/Docs.astro
title: cta-end — Playerstack
description: Show a CTA overlay when the video ends.
---

# cta-end

> npm: [`@playerstack/plugin-cta-end`](https://www.npmjs.com/package/@playerstack/plugin-cta-end)

When the video ends, render an overlay with optional title, custom HTML, anchor button (label + URL + UTM), and replay. Hook into the event bus for analytics.

## Quickstart

```html
<player-stack
  src="https://youtu.be/dQw4w9WgXcQ"
  data-config='{
    "ctaEnd": {
      "enabled": true,
      "title": "Want the deep dive?",
      "button": {
        "label": "Get the course",
        "url": "https://example.com/course",
        "utm": "utm_source=playerstack&utm_medium=video"
      },
      "showReplay": true
    }
  }'>
</player-stack>
```

## Config

`config.ctaEnd`:

| Field | Type | Description |
|---|---|---|
| `enabled` | boolean | Plugin is a no-op unless `true` |
| `title` | string? | Heading text inside the overlay |
| `html` | string? | Custom HTML rendered in the overlay (innerHTML — sanitize on your end) |
| `button.label` | string | Visible button text |
| `button.url` | string | Destination URL |
| `button.utm` | string? | Query string appended to URL (e.g. `utm_source=...`) |
| `showReplay` | boolean? | Render a "Replay" button that re-plays the video and dismisses the overlay |

## Events

| Name | Payload | When |
|---|---|---|
| `cta:click` | `{ label: string, url: string }` | User clicks the CTA button |
| `cta:replay` | `undefined` | User clicks the replay button |

```ts
ctx.events.on("cta:click", ({ label, url }) => {
  navigator.sendBeacon("/api/track", JSON.stringify({
    event: "cta_click",
    label,
    url,
  }));
});
```

## Styling

The overlay uses CSS variables you can override:

- `--ps-accent` — button background
- `--ps-bg-opacity` — overlay backdrop opacity

Use [controls-policy](/docs/plugins/controls-policy) to set these per-player, or define them globally in your stylesheet.

## HTML safety

`config.ctaEnd.html` is rendered via `innerHTML`. **Sanitize user-provided content before passing it in.** For server-rendered, trusted content, this is fine. For dynamic user input, use `title` + `button` instead.
