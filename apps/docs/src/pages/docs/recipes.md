---
layout: ../../layouts/Docs.astro
title: Recipes — Playerstack
description: Copy-paste patterns for common Playerstack tasks.
---

# Recipes

## Write a custom plugin

Track CTA clicks to your analytics endpoint:

```ts
import { Playerstack } from "@playerstack/core";
import type { PlayerstackPlugin } from "@playerstack/core";

const analyticsPlugin: PlayerstackPlugin = {
  name: "analytics",
  init(ctx) {
    ctx.events.on("cta:click", ({ label, url }) => {
      navigator.sendBeacon("/api/track", JSON.stringify({
        event: "cta_click",
        label,
        url,
        productId: ctx.container.dataset.productId,
      }));
    });
  },
};

Playerstack.use(analyticsPlugin).define();
```

The plugin doesn't render anything — it only listens to the event bus. Other plugins emit events; you wire them to your backend.

## Per-element state with WeakMap

If your plugin holds state per `<player-stack>`, use `WeakMap<PlayerstackContext, ...>`:

```ts
const states = new WeakMap<PlayerstackContext, MyState>();

const myPlugin: PlayerstackPlugin = {
  name: "my-plugin",
  init(ctx) {
    states.set(ctx, { /* ... */ });
  },
  destroy(ctx) {
    states.get(ctx)?.cleanup();
    states.delete(ctx);
  },
};
```

This is what every first-party plugin does. Without it, putting two players on one page corrupts state.

## Custom config provider

When you want config to come from somewhere other than inline attributes — a CMS, a CDN, your own API:

```ts
import type { ConfigProvider, PlayerstackConfig } from "@playerstack/core";
import { setConfigProviderForElement } from "@playerstack/core";

const cmsProvider: ConfigProvider = {
  name: "cms",
  async load(element) {
    const slug = element.dataset.cmsSlug;
    if (!slug) throw new Error("no data-cms-slug");
    const response = await fetch(`/api/videos/${slug}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as PlayerstackConfig;
  },
};

setConfigProviderForElement(cmsProvider);
```

```html
<player-stack data-cms-slug="my-lesson"></player-stack>
```

`<player-stack>` calls `cmsProvider.load(element)` on connect, then mounts with the returned config.

## Shrink the bundle

If 127 KB gzipped is too much, ship only the plugins you use:

```ts
import { Playerstack } from "@playerstack/core";
import { sourcesPlugin } from "@playerstack/plugin-sources";
// no controls-policy, no autopreview, no cta-end, etc.

Playerstack.use(sourcesPlugin).define();
```

Vidstack still dominates the bundle, but each plugin you skip saves a few KB. For a true minimum, you can also avoid Vidstack's default UI and use plain `<video>` — but that's a bigger refactor.

## Dynamic config

You can mount and re-mount a `<player-stack>` with different config:

```ts
const el = document.querySelector("player-stack");
el?.remove();
const fresh = document.createElement("player-stack");
fresh.setAttribute("src", newSrc);
fresh.setAttribute("data-config", JSON.stringify(newConfig));
document.body.appendChild(fresh);
```

`disconnectedCallback` runs `destroy(ctx)` on every plugin, then a fresh `connectedCallback` runs `init(ctx)` on the new element. State is fully isolated.

## Hook into the lifecycle

Listen to events on the underlying `<media-player>` directly:

```ts
const myPlugin: PlayerstackPlugin = {
  name: "tracker",
  init(ctx) {
    const handler = () => console.log("video ended");
    ctx.mediaPlayer.addEventListener("ended", handler);
    // store handler ref so destroy can remove it
    states.set(ctx, { handler });
  },
  destroy(ctx) {
    const state = states.get(ctx);
    if (state) ctx.mediaPlayer.removeEventListener("ended", state.handler);
    states.delete(ctx);
  },
};
```

Vidstack dispatches the standard HTML5 media events plus a few of its own. See the [Vidstack docs](https://vidstack.io/docs) for the full list.
