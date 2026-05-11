# @playerstack/plugin-custom-css

Inject arbitrary CSS scoped to a single `<player-stack>` instance. The escape hatch for any styling that `controls-policy` (theme color, show/hide controls) doesn't cover. Part of [Playerstack](https://github.com/jurczykpawel/playerstack).

The standalone [`playerstack`](https://www.npmjs.com/package/playerstack) bundle includes this plugin by default — install this package directly only if you're using `@playerstack/core` and composing your own bundle.

## Install

```sh
npm install @playerstack/core @playerstack/plugin-custom-css
```

## Use

```ts
import { Playerstack } from "@playerstack/core";
import { customCssPlugin } from "@playerstack/plugin-custom-css";

Playerstack.use(customCssPlugin).define();
```

```html
<player-stack
  src="https://youtu.be/dQw4w9WgXcQ"
  data-config='{
    "customCss": {
      "enabled": true,
      "css": "& video { filter: contrast(1.1) saturate(1.05); } & media-controller { --media-control-bar-display: flex; }"
    }
  }'
></player-stack>
```

## Config

`config.customCss`:

| Field     | Type      | Default | Description                                                                                           |
| --------- | --------- | ------- | ----------------------------------------------------------------------------------------------------- |
| `enabled` | `boolean` | `false` | Plugin is a no-op unless `true`                                                                       |
| `css`     | `string`  | —       | Raw CSS, automatically scoped to this player instance via CSS Nesting. Use `&` to target descendants. |

## How scoping works

Your CSS is automatically wrapped in `player-stack[data-ps-id="<unique-id>"] { ... }` and injected as a `<style>` element in `<head>` tagged `data-playerstack="custom-css"`. Each `<player-stack>` on the page gets its own scope so styles don't leak between instances.

Because the wrapper uses native CSS Nesting (baseline since 2023, ~95% browser coverage in 2026), inside your CSS you can:

```css
/* style the player root itself */
border-radius: 16px;
box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);

/* descend with & */
& video {
  filter: grayscale(1);
}

& media-control-bar {
  background: rgba(0, 0, 0, 0.8);
}

/* at-rules nest naturally */
@media (min-width: 800px) {
  & .playerstack-watermark {
    width: 120px;
  }
}
```

## Security

Each input string is rejected (the plugin renders nothing) when it contains:

- `</style>` — would escape the injected `<style>` block
- `@import` — pulls remote stylesheets, exfiltration / supply-chain risk
- `expression(` — legacy IE; harmless today but signals tampering intent
- `javascript:` — XSS via `url(javascript:…)` in legacy contexts

This plugin is meant for trusted CSS provided by the embedder (config provider, brand settings). Don't pipe arbitrary user input into it without your own validation on top.

## Coordinating with `controls-policy`

`controls-policy` already manages a `data-ps-id` attribute on the inner media element to scope its hide rules. `custom-css` reuses the same id — no conflict. If neither plugin is active and you want to write CSS, set `data-ps-id` yourself before `custom-css` initializes.

## License

MIT.
