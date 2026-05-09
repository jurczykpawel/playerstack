---
layout: ../../layouts/Docs.astro
title: Core API — Playerstack
description: Reference for Playerstack singleton, plugin contract, event bus, and config provider.
---

# Core API

Everything in [`@playerstack/core`](https://www.npmjs.com/package/@playerstack/core).

## Playerstack singleton

The entry point. Register plugins, then call `define()` to register the custom element.

```ts
import { Playerstack } from "@playerstack/core";

Playerstack.use(somePlugin).use(anotherPlugin).define();
```

| Method        | Returns                        | Description                                          |
| ------------- | ------------------------------ | ---------------------------------------------------- |
| `use(plugin)` | `Playerstack` (chainable)      | Register a plugin. Throws on duplicate `name`        |
| `plugins()`   | `readonly PlayerstackPlugin[]` | Snapshot of registered plugins (read-only)           |
| `define()`    | `void`                         | Register `<player-stack>` custom element. Idempotent |

## PlayerstackPlugin

The interface every plugin implements:

```ts
interface PlayerstackPlugin {
  readonly name: string;
  init(ctx: PlayerstackContext): void | Promise<void>;
  destroy?(ctx: PlayerstackContext): void;
}
```

- `name` is unique within a Playerstack instance — duplicates throw
- `init` runs after the config has loaded and `<media-player>` is mounted, in registration order
- `init` is awaited — async plugins block later plugins (rare, but supported)
- `destroy` runs on element disconnect, in **reverse** registration order
- Errors in `destroy` are caught and logged — every plugin gets cleaned up even if one throws

## PlayerstackContext

What `init` and `destroy` receive:

```ts
interface PlayerstackContext {
  events: EventBus; // typed pub/sub
  container: HTMLElement; // the <player-stack> itself
  mediaPlayer: HTMLElement; // the inner <media-player>
  config: PlayerstackConfig;
}
```

Plugins read their slice of `config` and mutate `mediaPlayer` and `container` as needed. Use `events` to communicate with other plugins or your application.

## EventBus

Strongly typed pub/sub.

```ts
const bus = createEventBus<{ "cta:click": { label: string; url: string } }>();

const unsubscribe = bus.on("cta:click", ({ label, url }) => {
  console.log(label, url);
});

bus.emit("cta:click", { label: "Buy", url: "..." });
unsubscribe();
// or:
const removed = bus.off("cta:click", handler); // returns boolean
```

| Method                | Returns                   |
| --------------------- | ------------------------- |
| `on(name, handler)`   | unsubscribe function      |
| `off(name, handler)`  | boolean (was it removed?) |
| `emit(name, payload)` | void                      |

Handlers that throw don't stop later handlers — errors are logged.

## ConfigProvider

How config gets loaded for a `<player-stack>` element.

```ts
interface ConfigProvider {
  readonly name: string;
  load(element: HTMLElement): Promise<PlayerstackConfig>;
}
```

The default is `createInlineConfigProvider()`, which reads `src`, `poster`, `title` attributes plus the `data-config` JSON attribute. JSON wins on merge.

Replace the default via:

```ts
import { setConfigProviderForElement } from "@playerstack/core";
setConfigProviderForElement(myProvider);
```

See [sellf-adapter](/docs/plugins/sellf-adapter) for an example.

## PlayerstackConfig

```ts
interface PlayerstackConfig {
  src: string; // required
  poster?: string;
  title?: string;
  [key: string]: unknown; // plugin-specific slices
}
```

Plugin-specific slices live alongside the core fields:

- `controls` — for `controls-policy`
- `preview` — for `autopreview`
- `brandedThumb` — for `branded-thumb`
- `ctaEnd` — for `cta-end`

See each plugin's docs for its slice schema.

## PluginRegistry

Lower-level — you usually don't need this directly. The Playerstack singleton uses it internally. Exposed in case you're writing tooling.

```ts
import { createPluginRegistry } from "@playerstack/core";

const reg = createPluginRegistry();
reg.register(plugin);
await reg.init(ctx);
// ...
reg.destroy();
```

`reg.init(ctx)` throws if called twice without `destroy()` in between.
