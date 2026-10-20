---
layout: ../../../layouts/Docs.astro
title: analytics — Playerstack
description: Forward Playerstack and native media events to your analytics endpoint.
---

# analytics

> Package: `@playerstack/plugin-analytics` ([source](https://github.com/jurczykpawel/playerstack/tree/main/packages/plugin-analytics)), not published to npm yet

Forward Playerstack event-bus events (and native HTML5 media events) to your analytics. Two providers built in: `navigator.sendBeacon` to a custom URL, or `window.gtag` for Google Analytics 4.

## Quickstart — beacon to your endpoint

```html
<player-stack
  src="https://example.com/lesson.mp4"
  data-config='{
    "analytics": {
      "enabled": true,
      "endpoint": "https://api.example.com/track",
      "customProps": { "courseId": "abc-123" }
    }
  }'
>
</player-stack>
```

## Quickstart — Google Analytics 4

```html
<!-- Load gtag.js elsewhere on the page first -->
<player-stack
  src="https://example.com/lesson.mp4"
  data-config='{ "analytics": { "enabled": true, "provider": "gtag" } }'
>
</player-stack>
```

## Config

`config.analytics`:

| Field                | Type                       | Default                                                   | Description                                     |
| -------------------- | -------------------------- | --------------------------------------------------------- | ----------------------------------------------- |
| `enabled`            | boolean                    | `false`                                                   | Plugin is a no-op unless `true`                 |
| `provider`           | `"beacon" \| "gtag"`       | `"beacon"` if endpoint set, else `"gtag"`                 | Where to send events                            |
| `endpoint`           | string?                    | none                                                      | Required when `provider="beacon"`               |
| `customProps`        | `Record<string, unknown>?` | `{}`                                                      | Merged into every event payload                 |
| `forwardBusEvents`   | string[]?                  | `["thumb:click","cta:click","cta:replay","chapter:jump"]` | Which event-bus events to forward               |
| `forwardMediaEvents` | string[]?                  | `["play","pause","ended"]`                                | Which native `<media-player>` events to forward |

## Beacon payload shape

```json
{
  "event": "cta:click",
  "src": "https://example.com/lesson.mp4",
  "data": { "label": "Buy", "url": "...", "courseId": "abc-123" },
  "ts": 1762800000000
}
```

## Events

This plugin only consumes events; it doesn't emit any.

## Server-side

Match the beacon endpoint with a tiny ingest handler. For example with Hono:

```ts
app.post("/track", async (c) => {
  const event = await c.req.json();
  await db.insert(playerEvents).values(event);
  return c.text("", 204);
});
```
