# @playerstack/plugin-saved-position

Resume watching where the visitor left off. Stores `currentTime` in `localStorage` (debounced) and restores it on `loaded-metadata`. Clears storage on `ended`. Part of [Playerstack](https://github.com/jurczykpawel/playerstack).

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

Apache-2.0.
