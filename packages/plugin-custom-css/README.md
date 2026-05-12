# @playerstack/plugin-custom-css

Two-tier styling for `<player-stack>`:

1. **`tokens`** — validated CSS custom properties (`--ps-*`) applied as inline style. The right surface for theming driven by a CMS, a SaaS dashboard, or any config string you didn't author yourself.
2. **`trustedCss`** — raw CSS, auto-scoped to the player instance. Requires an explicit `acknowledgeTrusted: true`, and is intended for stylesheets you author in your own codebase.

Part of [Playerstack](https://github.com/jurczykpawel/playerstack). The standalone [`playerstack`](https://www.npmjs.com/package/playerstack) bundle includes this plugin by default — install this package directly only if you're using `@playerstack/core` and composing your own bundle.

## Install

```sh
npm install @playerstack/core @playerstack/plugin-custom-css
```

## Use — theming via tokens

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
      "tokens": {
        "--ps-accent": "#008aff",
        "--ps-radius": "12px"
      }
    }
  }'
></player-stack>
```

Tokens are applied as inline `style="--ps-…: …"` properties on the `<player-stack>` element and cascade into Mux media-chrome. Token names must match `--ps-*`. Values are passed through `validateTokenValue` — entries that don't pass are silently dropped, so this surface is safe to wire to a CMS, shortcode attribute, or any other untrusted string.

## Use — trusted raw CSS

```html
<player-stack
  src="https://example.com/v.mp4"
  data-config='{
    "customCss": {
      "enabled": true,
      "trustedCss": "& video { filter: contrast(1.1); } & media-control-bar { background: rgba(0,0,0,0.6); }",
      "acknowledgeTrusted": true
    }
  }'
></player-stack>
```

Raw CSS is auto-scoped to this player instance via CSS Nesting. Use `&` to target descendants. Without `acknowledgeTrusted: true` the raw CSS is dropped and a console warning is logged.

Don't assemble `trustedCss` from CMS values, end-user input, or third-party API responses — wire those through `tokens` instead.

## Config

`config.customCss`:

| Field                | Type                     | Default | Description                                                                                                                        |
| -------------------- | ------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`            | `boolean`                | `false` | Plugin is a no-op unless `true`                                                                                                    |
| `tokens`             | `Record<string, string>` | `{}`    | CSS custom properties. Keys must be `--ps-*`. Values are validated; entries that don't pass are silently dropped.                  |
| `trustedCss`         | `string`                 | —       | Raw CSS, scoped to this player instance via CSS Nesting. Requires `acknowledgeTrusted: true`.                                      |
| `acknowledgeTrusted` | `boolean`                | `false` | Required to apply `trustedCss`. The verbose name is intentional.                                                                   |
| `css`                | `string`                 | —       | _Deprecated._ Same shape as `trustedCss` but logs a warning. Still gated on `acknowledgeTrusted: true`. Removed in a future major. |

## How scoping works

`trustedCss` is wrapped in `player-stack:has([data-ps-id="<unique-id>"]) { ... }` and injected as a `<style data-playerstack="custom-css">` in `<head>`. Each `<player-stack>` on the page gets its own scope so styles don't leak between instances.

Because the wrapper uses native CSS Nesting (baseline since 2023, ~95% browser coverage), inside your CSS you can:

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

## Coordinating with `controls-policy`

`controls-policy` already manages a `data-ps-id` attribute on the inner media element to scope its hide rules. `custom-css` reuses the same id — no conflict. If neither plugin is active and you want to write CSS, set `data-ps-id` yourself before `custom-css` initializes.

## License

MIT.
