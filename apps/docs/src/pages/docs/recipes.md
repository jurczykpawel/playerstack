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
      navigator.sendBeacon(
        "/api/track",
        JSON.stringify({
          event: "cta_click",
          label,
          url,
          productId: ctx.container.dataset.productId,
        }),
      );
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
    states.set(ctx, {/* ... */});
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
// cms-provider.ts — the first import of your entry file
import type { ConfigProvider, PlayerstackConfig } from "@playerstack/core";
import { setConfigProviderForElement } from "@playerstack/core/element";

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

`<player-stack>` calls `cmsProvider.load(element)` on connect, then mounts with the returned config. `@playerstack/core` defines `<player-stack>` as soon as it is imported (plugins import it too), and players already on the page start with the provider installed at that moment. Install the provider from `@playerstack/core/element` in a module that is the first import of your entry file. The hosted `playerstack.min.js` always uses the default provider; a custom provider needs a custom build (see `examples/12-sellf-integration`).

## Shrink the bundle

To select which plugins are registered, build a custom bundle from the scoped source packages (not yet published to npm):

```ts
import { Playerstack } from "@playerstack/core";
import { sourcesPlugin } from "@playerstack/plugin-sources";
// no controls-policy, no autopreview, no cta-end, etc.

Playerstack.use(sourcesPlugin).define();
```

Measure your custom build: removing a plugin does not remove media-element dependencies imported by the core. For a true minimum, you can skip `media-chrome` entirely and use the inner media element with the browser's default controls (`controls` attribute) — but that's a bigger refactor.

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

Listen to events on the underlying media element (`<video>`, `<youtube-video>`, `<vimeo-video>`, or `<hls-video>`) directly:

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

Every Mux media-element wraps a real `<video>` (or iframe for YT/Vimeo) and dispatches the standard HTML5 media events: `play`, `pause`, `ended`, `timeupdate`, `canplay`, `loadeddata`, `volumechange`, `ratechange`, `durationchange`, `seeked`. See [MDN's HTMLMediaElement events list](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement#events) for the full set.
