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
| `watchTime`          | boolean?                   | `false`                                                   | Send `watch_progress` (see below)               |
| `watchTimeInterval`  | number?                    | off                                                       | Also send it every N seconds (minimum 5)        |

## Beacon payload shape

```json
{
  "event": "cta:click",
  "src": "https://example.com/lesson.mp4",
  "data": { "label": "Buy", "url": "...", "courseId": "abc-123" },
  "ts": 1762800000000
}
```

## Watch time (`watch_progress`)

Set `"watchTime": true` to learn how far viewers get and how long they watch.

```json
{
  "analytics": {
    "enabled": true,
    "endpoint": "https://api.example.com/track",
    "watchTime": true
  }
}
```

The event is sent only when something new was played since the previous one:

- on `pause` and `ended`,
- when the page becomes hidden (`visibilitychange`) and on `pagehide`, which covers closing the tab,
- when the source changes and when the player is removed,
- every `watchTimeInterval` seconds, only if you set it.

Periodic sending is off by default: the triggers above already deliver the data in a few requests. Turn it on (for example `30`) if you also need data from sessions that end in a browser crash or a killed mobile app, or a live view.

Beacon payload:

```json
{
  "event": "watch_progress",
  "src": "https://example.com/lesson.mp4",
  "data": {
    "maxPosition": 312.4,
    "previousMaxPosition": 95,
    "watchedSeconds": 268.1,
    "watchedDelta": 188.1,
    "duration": 600,
    "percent": 52,
    "courseId": "abc-123"
  },
  "ts": 1762800000000
}
```

| Field                 | Meaning                                                                              |
| --------------------- | ------------------------------------------------------------------------------------ |
| `maxPosition`         | Furthest position (s) reached by playing. Seeking alone does not move it             |
| `previousMaxPosition` | `maxPosition` of the previous event of this playback, `0` in the first one           |
| `watchedSeconds`      | Media seconds played so far. Skipped parts are excluded, rewatched parts count again |
| `watchedDelta`        | Media seconds played since the previous event                                        |
| `duration`            | Video length (s)                                                                     |
| `percent`             | `maxPosition` as a whole percent of `duration`, rounded down                         |

Seconds are rounded to 0.1. At 2x speed, 60 s of video counts as 60 s. A playback starts when the player loads a source and ends when the page or source goes away. Nothing is sent for live streams (no finite duration). The muted in-player preview (`preview` without `preview.src`) is not counted until the viewer unmutes. Delivery is best effort, as with any beacon.

The player sends no IP address field and no viewer or session identifier (your server sees the IP of the request, as with any request). To tell viewers apart, add your own value in `customProps`.

### Building reports without an identifier

Aggregate by `src` and add up events:

- **Total watch time:** sum of `watchedDelta`.
- **Playbacks:** number of events with `previousMaxPosition` equal to `0`.
- **Retention curve:** for each second `t`, count events where `previousMaxPosition < t <= maxPosition`, then divide by the number of playbacks. This is the share of playbacks that reached `t`.

The curve shows the furthest point reached: a viewer who skips ahead and keeps watching counts as having reached the earlier seconds too. A position restored by `savedPosition` behaves the same way. If your `customProps` carry an ID unique to each page view, you can instead keep the largest `maxPosition` and `watchedSeconds` per ID and `src`.

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
