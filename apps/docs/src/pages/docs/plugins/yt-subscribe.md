---
layout: ../../../layouts/Docs.astro
title: yt-subscribe — Playerstack
description: Subscribe-on-YouTube bar below the player.
---

# yt-subscribe

> npm: [`@playerstack/plugin-yt-subscribe`](https://www.npmjs.com/package/@playerstack/plugin-yt-subscribe)

Render a "Subscribe on YouTube" bar below the player linking to the channel's subscribe-confirm page (one-click subscribe).

## Quickstart

```html
<!-- By channel UC… ID (preferred — opens subscribe-confirm popup) -->
<player-stack
  src="https://youtu.be/dQw4w9WgXcQ"
  data-config='{
    "ytSubscribe": {
      "enabled": true,
      "channelId": "UCuAXFkgsw1L7xaCfnd5JJOw",
      "label": "Subscribe to Rick Astley"
    }
  }'
>
</player-stack>

<!-- Or by @handle -->
<player-stack
  src="https://youtu.be/dQw4w9WgXcQ"
  data-config='{
    "ytSubscribe": { "enabled": true, "channelHandle": "RickAstleyVEVO" }
  }'
>
</player-stack>
```

## Config

`config.ytSubscribe`:

| Field           | Type    | Description                                                                      |
| --------------- | ------- | -------------------------------------------------------------------------------- |
| `enabled`       | boolean | Plugin is a no-op unless `true`                                                  |
| `channelId`     | string? | YouTube channel `UC…` ID. URL gets `?sub_confirmation=1` for one-click subscribe |
| `channelHandle` | string? | YouTube `@handle` (alternative to channelId)                                     |
| `label`         | string? | Visible button text. Default `"Subscribe on YouTube"`                            |

Either `channelId` OR `channelHandle` is required.

## Why a static link, not the YT JS SDK

Loading the YouTube IFrame JS SDK pulls 200+ KB and drops cookies. A plain link gets the user 95% of the way (clicking opens a confirm dialog) without the bundle and tracking overhead.

## Events

None.
