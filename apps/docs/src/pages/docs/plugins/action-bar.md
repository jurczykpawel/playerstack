---
layout: ../../../layouts/Docs.astro
title: action-bar — Playerstack
description: Dismissible mid-video banner with optional CTA button.
---

# action-bar

> Package: `@playerstack/plugin-action-bar` ([source](https://github.com/jurczykpawel/playerstack/tree/main/packages/plugin-action-bar)), not published to npm yet

A dismissible banner overlay that appears mid-playback (or immediately) with optional title, custom HTML, and a CTA button. Lighter-weight cousin of `cta-end` — the action bar shows DURING the video, not after.

## Quickstart

```html
<player-stack
  src="https://example.com/v.mp4"
  data-config='{
    "actionBar": {
      "enabled": true,
      "showAt": 30,
      "title": "🎁 Limited offer",
      "button": {
        "label": "Claim 30% off",
        "url": "https://example.com/offer",
        "utm": "utm_source=video&utm_medium=action-bar"
      }
    }
  }'
>
</player-stack>
```

## Config

`config.actionBar`:

| Field      | Type                    | Description                                                            |
| ---------- | ----------------------- | ---------------------------------------------------------------------- |
| `enabled`  | boolean                 | Plugin is a no-op unless `true`                                        |
| `showAt`   | `"start" \| number`     | `"start"` shows on init. Number ≤ 100 = % of duration, > 100 = seconds |
| `title`    | string?                 | Heading text                                                           |
| `html`     | string?                 | Custom inner HTML (innerHTML — sanitize on your end)                   |
| `button`   | `{ label, url, utm? }`? | Optional anchor button                                                 |
| `position` | `"top" \| "bottom"`?    | Default `"bottom"`                                                     |

## Events

| Name                 | Payload          | When                           |
| -------------------- | ---------------- | ------------------------------ |
| `action-bar:click`   | `{ label, url }` | User clicks the CTA button     |
| `action-bar:dismiss` | `undefined`      | User clicks the × close button |

## vs cta-end

| Use                         | Plugin                                 |
| --------------------------- | -------------------------------------- |
| Show CTA AT END of video    | [cta-end](/docs/plugins/cta-end)       |
| Show CTA DURING video       | action-bar                             |
| Show CTA at START as a gate | [email-gate](/docs/plugins/email-gate) |
