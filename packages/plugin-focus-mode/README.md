# @playerstack/plugin-focus-mode

Auto-pause the video when the user switches tabs or minimizes the window. Optionally resume when the tab becomes visible again. Part of [Playerstack](https://github.com/jurczykpawel/playerstack).

Included in the standalone [`playerstack`](https://www.npmjs.com/package/playerstack) bundle.

## Install

```sh
npm install @playerstack/core @playerstack/plugin-focus-mode
```

## Use

```html
<player-stack
  src="https://example.com/lesson.mp4"
  data-config='{ "focusMode": { "enabled": true, "resumeOnVisible": true } }'
>
</player-stack>
```

## Config

`config.focusMode`:

| Field             | Type     | Default | Description                                                              |
| ----------------- | -------- | ------- | ------------------------------------------------------------------------ |
| `enabled`         | boolean  | `false` | Plugin is a no-op unless `true`                                          |
| `resumeOnVisible` | boolean? | `false` | Resume play when the tab becomes visible (only if it was playing before) |

## Events

| Name                 | Payload     | When                           |
| -------------------- | ----------- | ------------------------------ |
| `focus-mode:hidden`  | `undefined` | Document becomes hidden        |
| `focus-mode:visible` | `undefined` | Document becomes visible again |

## Use case

E-learning platforms — keeps students from playing the video in a background tab to fake "completion."

## License

MIT.
