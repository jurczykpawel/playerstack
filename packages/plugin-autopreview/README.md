# @playerstack/plugin-autopreview

Muted autoplay when the player enters the viewport, pause when it leaves. Respects `prefers-reduced-motion`. Part of [Playerstack](https://github.com/jurczykpawel/playerstack).

Included in the standalone [`playerstack`](https://www.npmjs.com/package/playerstack) bundle.

## Install

```sh
npm install @playerstack/core @playerstack/plugin-autopreview
```

## Use

```ts
import { Playerstack } from "@playerstack/core";
import { autopreviewPlugin } from "@playerstack/plugin-autopreview";

Playerstack.use(autopreviewPlugin).define();
```

```html
<player-stack
  src="https://example.com/preview.mp4"
  data-config='{"preview":{"enabled":true,"threshold":0.6}}'
>
</player-stack>
```

## Config

`config.preview`:

| Field                  | Type              | Default    | Description                                                       |
| ---------------------- | ----------------- | ---------- | ----------------------------------------------------------------- |
| `enabled`              | `boolean`         | `false`    | Plugin is a no-op unless `true`                                   |
| `threshold`            | `number` `[0..1]` | `0.5`      | How much of the player must be in view before play is triggered   |
| `loopUntilInteraction` | `boolean`         | (reserved) | Reserved for future use; current build always loops while in view |

## Behavior

- When at least `threshold` of the player is visible, sets `mediaPlayer.muted = true` and calls `play()`.
- When the player leaves the viewport, calls `pause()`.
- If the user has `prefers-reduced-motion: reduce`, the plugin **does nothing** — no observer, no autoplay.

## Events

None.

## License

Apache-2.0.
