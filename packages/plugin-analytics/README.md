# @playerstack/plugin-analytics

Forward Playerstack events (and native HTML5 media events) to your analytics endpoint. Supports `navigator.sendBeacon` to a custom URL or `window.gtag` for Google Analytics. Part of [Playerstack](https://github.com/jurczykpawel/playerstack).

Included in the standalone [`playerstack`](https://www.npmjs.com/package/playerstack) bundle.

## Install

```sh
npm install @playerstack/core @playerstack/plugin-analytics
```

## Use

```html
<!-- POST events to your own endpoint -->
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

<!-- Or send to gtag (Google Analytics 4) -->
<player-stack
  src="https://example.com/lesson.mp4"
  data-config='{
    "analytics": { "enabled": true, "provider": "gtag" }
  }'
>
</player-stack>
```

## Config

`config.analytics`:

| Field                | Type                       | Default                                                   | Description                                           |
| -------------------- | -------------------------- | --------------------------------------------------------- | ----------------------------------------------------- |
| `enabled`            | boolean                    | `false`                                                   | Plugin is a no-op unless `true`                       |
| `provider`           | `"beacon" \| "gtag"`       | `"beacon"` if endpoint set, else `"gtag"`                 | Where to send events                                  |
| `endpoint`           | string?                    | none                                                      | Required when `provider="beacon"` — sendBeacon target |
| `customProps`        | `Record<string, unknown>?` | `{}`                                                      | Merged into every event payload                       |
| `forwardBusEvents`   | string[]?                  | `["thumb:click","cta:click","cta:replay","chapter:jump"]` | Which Playerstack event-bus events to forward         |
| `forwardMediaEvents` | string[]?                  | `["play","pause","ended"]`                                | Which native `<media-player>` events to forward       |

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

## License

MIT.
