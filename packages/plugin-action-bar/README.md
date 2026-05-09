# @playerstack/plugin-action-bar

A dismissible banner overlay that appears mid-playback (or immediately) with optional title, custom HTML, and a CTA button. Lighter-weight cousin of `cta-end` — the action bar shows DURING video, not after it. Part of [Playerstack](https://github.com/jurczykpawel/playerstack).

Included in the standalone [`playerstack`](https://www.npmjs.com/package/playerstack) bundle.

## Install

```sh
npm install @playerstack/core @playerstack/plugin-action-bar
```

## Use

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
| `button`   | `{ label, url, utm? }`? | Optional anchor button with UTM appendage                              |
| `position` | `"top" \| "bottom"`?    | Default `"bottom"`. `"top"` puts the bar at the top of the player      |

## Events

| Name                 | Payload          | When                           |
| -------------------- | ---------------- | ------------------------------ |
| `action-bar:click`   | `{ label, url }` | User clicks the CTA button     |
| `action-bar:dismiss` | `undefined`      | User clicks the × close button |

## License

MIT.
