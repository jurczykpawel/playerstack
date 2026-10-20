---
layout: ../../../layouts/Docs.astro
title: sellf-adapter — Playerstack
description: Load Playerstack config from a Sellf product endpoint.
---

# sellf-adapter

> npm: [`@playerstack/plugin-sellf-adapter`](https://www.npmjs.com/package/@playerstack/plugin-sellf-adapter)

Replaces the default `InlineConfigProvider` with one that fetches config from a [Sellf](https://sellf.app) product endpoint. Designed for course creators who want their video metadata, CTAs, and gating to live in Sellf and propagate to every embed.

> **Not bundled by default.** This package is opt-in — install separately.

## Quickstart

```ts
// sellf-provider.ts — the first import of your entry file
import { createSellfConfigProvider } from "@playerstack/plugin-sellf-adapter";
import { setConfigProviderForElement } from "@playerstack/core/element";

const provider = createSellfConfigProvider({
  baseUrl: "https://sellf.app",
  fetchOptions: { credentials: "include" }, // optional, e.g. for auth
});

setConfigProviderForElement(provider);
```

```ts
// main.ts
import "./sellf-provider"; // must stay the first import
import { Playerstack } from "@playerstack/core";
// …register plugins and call Playerstack.define()
```

`@playerstack/core` defines `<player-stack>` as soon as it is imported (plugins import it too), and players already on the page start with the provider installed at that moment. Install the provider from `@playerstack/core/element` in a module that is the first import of your entry file. The hosted `playerstack.min.js` always uses the default provider; a custom provider needs a custom build (see `examples/12-sellf-integration`).

```html
<player-stack data-sellf-product="abc123"></player-stack>
```

When the element connects, the provider fetches:

```
https://sellf.app/api/products/abc123/playerstack
```

…and uses the JSON response as the player config.

## Endpoint contract

The Sellf endpoint must return a JSON object that conforms to `PlayerstackConfig`:

```json
{
  "src": "https://files.example.com/lesson-1.mp4",
  "poster": "https://cdn.example.com/poster.webp",
  "title": "Lesson 1",
  "controls": { "accent": "#008aff" },
  "ctaEnd": {
    "enabled": true,
    "button": { "label": "Next lesson", "url": "https://example.com/lesson-2" }
  }
}
```

`src` is required. Anything else is optional.

## Inline overrides

Inline attributes always win on merge. Useful for per-page CTAs without changing Sellf:

```html
<player-stack
  data-sellf-product="abc123"
  title="Override the title from Sellf"
></player-stack>
```

This loads everything from Sellf, but `title` is taken from the attribute.

## Errors

- HTTP non-200 → throws with status and URL
- Missing `data-sellf-product` AND no `src` attribute → throws
- Response missing `src` → throws

## Status

This is a **proof of concept** in v0.1.0 — full integration into the standalone bundle (replacing the default config provider via Playerstack API) is on the post-MVP roadmap. Today, you wire it up manually via `setConfigProviderForElement`.
