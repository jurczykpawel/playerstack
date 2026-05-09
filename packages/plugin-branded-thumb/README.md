# @playerstack/plugin-branded-thumb

Custom poster overlay with an accessible play button. Optional `clickToLoad` mode defers the underlying iframe load until the user clicks, eliminating third-party cookies (LCP + GDPR). Part of [Playerstack](https://github.com/jurczykpawel/playerstack).

Included in the standalone [`playerstack`](https://www.npmjs.com/package/playerstack) bundle.

## Install

```sh
npm install @playerstack/core @playerstack/plugin-branded-thumb
```

## Use

```ts
import { Playerstack } from "@playerstack/core";
import { brandedThumbPlugin } from "@playerstack/plugin-branded-thumb";

Playerstack.use(brandedThumbPlugin).define();
```

```html
<player-stack
  src="https://youtu.be/dQw4w9WgXcQ"
  poster="https://cdn.example.com/poster.webp"
  data-config='{"brandedThumb":{"enabled":true,"clickToLoad":true,"playButtonStyle":"box"}}'
>
</player-stack>
```

## Config

`config.brandedThumb`:

| Field             | Type                             | Default    | Description                                                                                                           |
| ----------------- | -------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------- |
| `enabled`         | `boolean`                        | `false`    | Plugin is a no-op unless `true`                                                                                       |
| `playButtonStyle` | `"minimal" \| "box" \| "circle"` | `"circle"` | Visual style of the play button (CSS hook via `data-style`)                                                           |
| `clickToLoad`     | `boolean`                        | `false`    | If `true`, removes `src` from `mediaPlayer` until user clicks. Vidstack/YouTube/Vimeo iframe is NOT loaded until then |

## Why clickToLoad

YouTube and Vimeo iframes fetch tracking cookies as soon as they load — even before the user plays anything. With `clickToLoad: true`, the iframe is never created until the user actually engages, which:

- Eliminates third-party cookies (no GDPR consent prompt needed for the embed itself)
- Improves Largest Contentful Paint dramatically (~200 KB of YouTube JS deferred)
- Keeps your privacy story clean

## Events

| Name          | Payload     | When                    |
| ------------- | ----------- | ----------------------- |
| `thumb:click` | `undefined` | User clicks the overlay |

## License

MIT.
