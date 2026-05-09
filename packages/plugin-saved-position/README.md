# @playerstack/plugin-saved-position

Resume watching where the visitor left off. Stores `currentTime` in `localStorage` (debounced) and restores it on `loaded-metadata`. Clears storage on `ended`. Part of [Playerstack](https://github.com/jurczykpawel/playerstack).

Included in the standalone [`playerstack`](https://www.npmjs.com/package/playerstack) bundle.

## Install

```sh
npm install @playerstack/core @playerstack/plugin-saved-position
```

## Use

```html
<player-stack
  src="https://example.com/lesson.mp4"
  data-config='{ "savedPosition": { "enabled": true } }'
>
</player-stack>
```

## Config

`config.savedPosition`:

| Field          | Type    | Default             | Description                                                              |
| -------------- | ------- | ------------------- | ------------------------------------------------------------------------ |
| `enabled`      | boolean | `false`             | Plugin is a no-op unless `true`                                          |
| `keyPrefix`    | string? | `"playerstack:pos"` | Full key is `${keyPrefix}:${src}`                                        |
| `throttleMs`   | number? | `1000`              | Debounce window for save calls                                           |
| `endTolerance` | number? | `5`                 | Don't restore if saved time is within `endTolerance` seconds of duration |

Storage is keyed by full source URL — same video on different pages resumes from the same point.

## Events

None.

## License

MIT.
