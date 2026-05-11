---
layout: ../../../layouts/Docs.astro
title: intro-card — Playerstack
description: Marketing splash overlay shown before the video plays — title, subtitle, badge, optional CTA, custom HTML, and a big play button.
---

# intro-card

> npm: [`@playerstack/plugin-intro-card`](https://www.npmjs.com/package/@playerstack/plugin-intro-card)

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
| `html`        | `string`                               | —              | Arbitrary trusted HTML between subtitle and play button                        |
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

## Security

`html` and `cta.url` are inserted as-is — treat them as trusted strings from your config provider. `cta.url` must be `http(s)`; other schemes silently drop the link wrapper. CTA always opens in a new tab with `rel="noopener noreferrer"`.

## Use cases

- **Lead magnet preview** — "WATCH THE INTRO" + CTA "Get the full course"
- **Course module gate** — title, summary, and play button
- **Brand splash** — logo + tagline + image background, dismissible
