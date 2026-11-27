# @playerstack/plugin-watermark

Corner-pinned logo or text overlay for [Playerstack](https://github.com/jurczykpawel/playerstack). Useful for branding, attribution, or "©" notices.

The standalone [`playerstack`](https://playerstack.techskills.academy/playerstack.min.js) bundle includes this plugin by default — use this package directly only if you're using `@playerstack/core` and composing your own bundle.

## Install

This plugin is included in the standalone script, so there is nothing to install:

```html
<script
  src="https://playerstack.techskills.academy/playerstack.min.js"
  defer
></script>
```

The `@playerstack/*` packages are not published to npm yet; to compose your own bundle, build it from this repository.

## Use

```ts
import { Playerstack } from "@playerstack/core";
import { watermarkPlugin } from "@playerstack/plugin-watermark";

Playerstack.use(watermarkPlugin).define();
```

```html
<player-stack
  src="https://youtu.be/dQw4w9WgXcQ"
  data-config='{"watermark":{"enabled":true,"src":"https://example.com/logo.png","position":"top-right","width":80,"opacity":0.7}}'
></player-stack>
```

## Config

`config.watermark`:

| Field      | Type                                                           | Default          | Description                                                                   |
| ---------- | -------------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------- |
| `enabled`  | `boolean`                                                      | `false`          | Plugin is a no-op unless `true`                                               |
| `src`      | `string`                                                       | —                | Image URL. Mutually exclusive with `text`                                     |
| `text`     | `string`                                                       | —                | Plain-text overlay (e.g. `© ACME 2026`). Mutually exclusive with `src`        |
| `href`     | `string`                                                       | —                | Optional click-through URL. Must be `http(s)`; other schemes silently ignored |
| `position` | `"top-left" \| "top-right" \| "bottom-left" \| "bottom-right"` | `"bottom-right"` | Corner placement                                                              |
| `opacity`  | `number`                                                       | `0.7`            | 0–1; out-of-range clamped, invalid falls back to default                      |
| `margin`   | `number`                                                       | `16`             | Distance from corner in px; see bottom corners below                          |
| `width`    | `number`                                                       | `80`             | Image width in px (only when `src` is set)                                    |

## Behavior

- Image mode (`src`): a styled `<img>` with `loading="lazy"` and `decoding="async"`
- Text mode (`text`): a small pill with semi-transparent background and white text
- When `href` is set, the overlay is wrapped in `<a target="_blank" rel="noopener noreferrer">`
- Only a linked watermark (`href`) takes pointer events; without a link, clicks pass through to the player
- Bottom corners stay above the control bar: the distance from the bottom edge is the larger of `margin` and `--ps-control-bar-clearance` (default `48px`). Override it on `player-stack`, for example `player-stack { --ps-control-bar-clearance: 0px; }` when the control bar is hidden, or raise it for a taller custom bar
- Visible in fullscreen, because the whole `<player-stack>` goes fullscreen (not in the native iPhone video fullscreen, see [Fullscreen](https://playerstack.techskills.academy/docs/api#fullscreen))

## Security

`href` is validated as `http:` or `https:`. Anything else (`javascript:`, `data:`, `file:`, etc.) is silently dropped — the overlay still renders, just without the link wrapper.

## License

Apache-2.0.
