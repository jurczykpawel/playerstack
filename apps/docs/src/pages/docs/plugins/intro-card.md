---
layout: ../../../layouts/Docs.astro
title: intro-card — Playerstack
description: Marketing splash overlay shown before the video plays — title, subtitle, badge, optional CTA, custom HTML, and a big play button.
---

# intro-card

> Package: `@playerstack/plugin-intro-card` ([source](https://github.com/jurczykpawel/playerstack/tree/main/packages/plugin-intro-card)), not published to npm yet

Pre-roll splash overlay with marketing content — title, subtitle, badge, optional CTA, custom HTML, and a big branded play button. Different scope from [`branded-thumb`](/docs/plugins/branded-thumb): branded-thumb is "custom poster + click-to-load", intro-card is "billboard before play".

## Quickstart

```html
<player-stack
  src="https://example.com/v.mp4"
  data-config='{
    "controls": { "accent": "#a855f7" },
    "introCard": {
      "enabled": true,
      "badge": "FREE PREVIEW",
      "title": "Lesson 1: Kick-off",
      "subtitle": "5 minutes — what you will learn",
      "cta": { "label": "Buy the course", "url": "https://example.com/course" }
    }
  }'
></player-stack>
```

## Config

`config.introCard`:

| Field         | Type                                   | Default        | Description                                                                    |
| ------------- | -------------------------------------- | -------------- | ------------------------------------------------------------------------------ |
| `enabled`     | `boolean`                              | `false`        | Plugin is a no-op unless `true`                                                |
| `badge`       | `string`                               | —              | Small uppercase pill above the title                                           |
| `title`       | `string`                               | —              | Heading                                                                        |
| `subtitle`    | `string`                               | —              | Supporting line                                                                |
| `html`        | `string`                               | —              | HTML filtered through core sanitizeHtml between subtitle and play button       |
| `cta`         | `{ label, url, utm? }`                 | —              | Optional click-through link separate from the play button                      |
| `image`       | `string`                               | —              | Background image URL                                                           |
| `position`    | `"fullscreen" \| "bottom" \| "center"` | `"fullscreen"` | Layout: cover the whole player, sit at the bottom, or float as a centered card |
| `theme`       | `"dark" \| "light" \| "transparent"`   | `"dark"`       | Background style                                                               |
| `dismissible` | `boolean`                              | `false`        | Show a close button so the user can skip the card without playing              |

## Behavior

- Play button uses `var(--ps-accent)` from `controls-policy` automatically
- Click play → `play()` + remove overlay + emit `intro-card:play-click`
- Click CTA → emit `intro-card:cta-click` (overlay stays, user leaves via new tab)
- Click close → emit `intro-card:dismiss`, remove overlay, no play

## Events

| Name                    | Payload                            | When                 |
| ----------------------- | ---------------------------------- | -------------------- |
| `intro-card:play-click` | `undefined`                        | Play button clicked  |
| `intro-card:cta-click`  | `{ label?: string; url?: string }` | CTA link clicked     |
| `intro-card:dismiss`    | `undefined`                        | Close button clicked |

## HTML rendering rules

`html` passes through core's [sanitizeHtml](https://github.com/jurczykpawel/playerstack/blob/main/packages/core/src/safe-html.ts) before the resulting fragment is assigned to `innerHTML`.

- Allowed elements: `a`, `b`, `br`, `code`, `em`, `h3`–`h6`, `i`, `li`, `ol`, `p`, `small`, `span`, `strong`, `sub`, `sup`, `u`, and `ul`.
- Allowed attributes on those elements: `class`, `data-*`, `aria-*`, and `role`; anchors may also have `href`. Event attributes (`on*`), `style`, `id`, and other attributes are removed.
- Anchor `href` must parse as an absolute HTTP(S) URL. Other values, including relative URLs and fragments, lose `href`. Anchors with an accepted `href` get `target="_blank"` and `rel="noopener noreferrer"`.
- The walk removes comments. When it encounters a disallowed element, `script`, `style`, `iframe`, `noscript`, `object`, and `embed` are removed with their contents; other disallowed elements are replaced by a plain text node containing their `textContent`.

This is a browser DOM-based rendering allowlist; without `document`, the helper returns an empty string. URL host policy and server-side validation remain the integrator's responsibility.

`cta.url` is checked separately with `isSafeHttpUrl` from the same source file: only absolute HTTP(S) URLs render the CTA anchor. Valid CTAs open in a new tab with `rel="noopener noreferrer"`.

## Use cases

- **Lead magnet preview** — "WATCH THE INTRO" + CTA "Get the full course"
- **Course module gate** — title, summary, and play button
- **Brand splash** — logo + tagline + image background, dismissible

## Scrolling content

Intro cards in fullscreen, center, and bottom positions are bounded by the player height and scroll inside their own overlay when content is too tall. Content stays centered when it fits and begins at the top when it overflows. Keyboard focus and pointer/touch scrolling do not move the player content.
