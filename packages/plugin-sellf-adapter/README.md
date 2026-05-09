# @playerstack/plugin-sellf-adapter

Load Playerstack config from a [Sellf](https://sellf.app) product endpoint. Part of [Playerstack](https://github.com/jurczykpawel/playerstack).

This package is **not** included in the standalone `playerstack` bundle — install it explicitly when you want Sellf-driven embeds.

## Install

```sh
npm install @playerstack/core @playerstack/plugin-sellf-adapter
```

## Use

```ts
import { createSellfConfigProvider } from "@playerstack/plugin-sellf-adapter";
import { setConfigProviderForElement } from "@playerstack/core";

const provider = createSellfConfigProvider({
  baseUrl: "https://sellf.app",
  fetchOptions: { credentials: "include" }, // optional
});

setConfigProviderForElement(provider);

// Then on your page:
```

```html
<player-stack data-sellf-product="abc123"></player-stack>
```

When the element connects, the provider fetches `https://sellf.app/api/products/abc123/playerstack` and uses the JSON response as the player config.

## Config merge order

Inline attributes always override fetched config. Useful for per-page CTAs:

```html
<player-stack data-sellf-product="abc123" title="Override the title from Sellf"></player-stack>
```

This loads everything from Sellf, but `title` is taken from the attribute.

## Endpoint contract

The Sellf endpoint must return a JSON object that conforms to `PlayerstackConfig`:

```json
{
  "src": "https://files.example.com/lesson-1.mp4",
  "poster": "https://cdn.example.com/poster.webp",
  "title": "Lesson 1",
  "controls": { "accent": "#008aff" },
  "ctaEnd": { "enabled": true, "button": { "label": "Next lesson", "url": "..." } }
}
```

`src` is required. Anything else is optional.

## Errors

- HTTP non-200 → throws with status and URL
- Missing `data-sellf-product` AND no `src` attribute → throws
- Response missing `src` → throws

## License

MIT.
