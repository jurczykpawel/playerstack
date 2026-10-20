# @playerstack/plugin-controls-policy

Theme color, opacity, and selective control hiding for [Playerstack](https://github.com/jurczykpawel/playerstack). Injects a single scoped `<style>` block into `<media-player>`.

Included in the standalone [`playerstack`](https://playerstack.techskills.academy/playerstack.min.js) bundle.

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
import { controlsPolicyPlugin } from "@playerstack/plugin-controls-policy";

Playerstack.use(controlsPolicyPlugin).define();
```

```html
<player-stack
  src="https://youtu.be/dQw4w9WgXcQ"
  data-config='{"controls":{"show":["play","progress","time"],"accent":"#008aff","bgOpacity":0.6}}'
>
</player-stack>
```

## Config

`config.controls`:

| Field       | Type                                                                        | Default       | Description                                                                                           |
| ----------- | --------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------- |
| `show`      | `("play" \| "progress" \| "time" \| "volume" \| "fullscreen" \| "speed")[]` | (all visible) | If set, ONLY listed controls are visible. Anything else gets `display: none`                          |
| `accent`    | `string` (CSS color)                                                        | none          | Sets `--ps-accent` CSS variable. Validated against injection (`#hex`, named colors, `rgb()`, `hsl()`) |
| `bgOpacity` | `number` `[0..1]`                                                           | none          | Sets `--ps-bg-opacity` CSS variable. Clamped to `[0..1]`                                              |

Unknown control names in `show` are silently ignored.

## Events

None. The plugin only injects CSS.

## Multi-instance safety

Each `<player-stack>` gets its own scoped `<style>` block. You can put dozens of players on one page with different themes — they don't collide.

## License

Apache-2.0.
