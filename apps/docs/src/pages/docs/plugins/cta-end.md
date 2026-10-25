---
layout: ../../../layouts/Docs.astro
title: cta-end — Playerstack
description: Show a CTA overlay when the video ends.
---

# cta-end

> Package: `@playerstack/plugin-cta-end` ([source](https://github.com/jurczykpawel/playerstack/tree/main/packages/plugin-cta-end)), not published to npm yet

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
  }'
>
</player-stack>
```

## Config

`config.ctaEnd`:

| Field          | Type     | Description                                                                |
| -------------- | -------- | -------------------------------------------------------------------------- |
| `enabled`      | boolean  | Plugin is a no-op unless `true`                                            |
| `title`        | string?  | Heading text inside the overlay                                            |
| `html`         | string?  | HTML filtered through core sanitizeHtml before rendering (see rules below) |
| `button.label` | string   | Visible button text                                                        |
| `button.url`   | string   | Destination URL                                                            |
| `button.utm`   | string?  | Query string appended to URL (e.g. `utm_source=...`)                       |
| `showReplay`   | boolean? | Render a "Replay" button that re-plays the video and dismisses the overlay |

## Events

| Name         | Payload                          | When                          |
| ------------ | -------------------------------- | ----------------------------- |
| `cta:click`  | `{ label: string, url: string }` | User clicks the CTA button    |
| `cta:replay` | `undefined`                      | User clicks the replay button |

```ts
ctx.events.on("cta:click", ({ label, url }) => {
  navigator.sendBeacon(
    "/api/track",
    JSON.stringify({
      event: "cta_click",
      label,
      url,
    }),
  );
});
```

## Styling

The overlay uses CSS variables you can override:

- `--ps-accent` — button background
- `--ps-bg-opacity` — overlay backdrop opacity

Use [controls-policy](/docs/plugins/controls-policy) to set these per-player, or define them globally in your stylesheet.

## HTML rendering rules

`html` passes through core's [sanitizeHtml](https://github.com/jurczykpawel/playerstack/blob/main/packages/core/src/safe-html.ts) before the resulting fragment is assigned to `innerHTML`.

- Allowed elements: `a`, `b`, `br`, `code`, `em`, `h3`–`h6`, `i`, `li`, `ol`, `p`, `small`, `span`, `strong`, `sub`, `sup`, `u`, and `ul`.
- Allowed attributes on those elements: `class`, `data-*`, `aria-*`, and `role`; anchors may also have `href`. Event attributes (`on*`), `style`, `id`, and other attributes are removed.
- Anchor `href` must parse as an absolute HTTP(S) URL. Other values, including relative URLs and fragments, lose `href`. Anchors with an accepted `href` get `target="_blank"` and `rel="noopener noreferrer"`.
- The walk removes comments. When it encounters a disallowed element, `script`, `style`, `iframe`, `noscript`, `object`, and `embed` are removed with their contents; other disallowed elements are replaced by a plain text node containing their `textContent`.

This is a browser DOM-based rendering allowlist; without `document`, the helper returns an empty string. URL host policy and server-side validation remain the integrator's responsibility.

## Scrolling content

End cards are bounded by the player height and scroll inside their own overlay when content is too tall. Content stays centered when it fits and begins at the top when it overflows. Keyboard focus and pointer/touch scrolling do not move the player content.
