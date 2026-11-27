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

## Time window

`hideAt` (seconds) or `hideAtPercent` ends the window opened by `showAt` / `atPercent`. With either of them the bar follows the playback position both ways: it is visible from the start point up to the hide point, and returns after seeking back into the window. A bar closed by the viewer stays closed. Without them the bar stays once shown.

```json
{
  "actionBar": {
    "enabled": true,
    "variant": "badge",
    "position": "top-left",
    "showAt": 190,
    "hideAt": 240,
    "button": {
      "label": "-20% until Friday",
      "url": "https://example.com/offer"
    }
  }
}
```

`variant: "badge"` renders the same content as a compact box in a corner instead of a full-width bar.

## Config

`config.actionBar`:

| Field           | Type                    | Description                                                                                                                |
| --------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `enabled`       | boolean                 | Plugin is a no-op unless `true`                                                                                            |
| `showAt`        | `"start" \| number`     | `"start"` (default without `atPercent`) shows on init; a number is seconds                                                 |
| `atPercent`     | number?                 | Show from this percent (0-100) of the duration                                                                             |
| `hideAt`        | number?                 | Hide from this second on                                                                                                   |
| `hideAtPercent` | number?                 | Hide from this percent of the duration on                                                                                  |
| `variant`       | `"bar" \| "badge"`?     | Default `"bar"`                                                                                                            |
| `title`         | string?                 | Heading text                                                                                                               |
| `html`          | string?                 | Custom HTML, filtered through core `sanitizeHtml`                                                                          |
| `button`        | `{ label, url, utm? }`? | Optional anchor button with UTM appendage                                                                                  |
| `position`      | string?                 | Bar: `"bottom"` (default) or `"top"`. Badge: also `"top-left"`, `"top-right"` (default), `"bottom-left"`, `"bottom-right"` |

## Events

| Name                 | Payload          | When                                           |
| -------------------- | ---------------- | ---------------------------------------------- |
| `action-bar:show`    | `undefined`      | The bar appears for the first time             |
| `action-bar:click`   | `{ label, url }` | User clicks the CTA button                     |
| `action-bar:dismiss` | `undefined`      | User clicks the × close button (skips the bar) |

To count them with [analytics](/docs/plugins/analytics), list them in `analytics.forwardBusEvents` (the list replaces the default one). In a custom build register analytics before action-bar so it also hears a bar shown at start.

## vs cta-end

| Use                         | Plugin                                 |
| --------------------------- | -------------------------------------- |
| Show CTA AT END of video    | [cta-end](/docs/plugins/cta-end)       |
| Pause for a CTA with skip   | [cta-end](/docs/plugins/cta-end)       |
| Show CTA DURING video       | action-bar                             |
| Show CTA at START as a gate | [email-gate](/docs/plugins/email-gate) |
