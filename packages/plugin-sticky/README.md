# @playerstack/plugin-sticky

Pin the player to the corner of the viewport when the user scrolls past it while it's playing. Includes a close button. Part of [Playerstack](https://github.com/jurczykpawel/playerstack).

Included in the standalone [`playerstack`](https://www.npmjs.com/package/playerstack) bundle.

## Install

```sh
npm install @playerstack/core @playerstack/plugin-sticky
```

## Use

```html
<player-stack
  src="https://example.com/v.mp4"
  data-config='{ "sticky": { "enabled": true } }'
>
</player-stack>
```

## Config

`config.sticky`:

| Field       | Type    | Default | Description                                                                 |
| ----------- | ------- | ------- | --------------------------------------------------------------------------- |
| `enabled`   | boolean | `false` | Plugin is a no-op unless `true`                                             |
| `threshold` | number? | `0.1`   | IntersectionObserver threshold — how much of the player must remain in view |

## How it works

When the player leaves the viewport AND `mediaPlayer.paused` is false, the plugin adds the `playerstack-sticky` class to the container. CSS pins it to the bottom-right corner with a small shadow. A close button is injected that disconnects the observer and removes the sticky state.

## Styling

Override the default position via CSS:

```css
.playerstack-sticky {
  bottom: 24px !important;
  left: 24px !important;
  right: auto !important;
  width: 320px;
}
```

## Events

None.

## License

MIT.
