# @playerstack/core

The engine wrapper and plugin runtime for [Playerstack](https://github.com/jurczykpawel/playerstack). Wraps Mux's [media-chrome](https://github.com/muxinc/media-chrome) plus the matching `<youtube-video>` / `<vimeo-video>` / `<hls-video>` elements, and exposes the `<player-stack>` custom element plus a small plugin API.

Most users want the standalone bundle [`playerstack`](https://playerstack.techskills.academy/playerstack.min.js), not this package. Use `@playerstack/core` directly when you want to **pick which plugins to ship** for a smaller bundle, or to write your own plugins.

## Install

The scoped packages are not published to npm yet. Most pages should embed the hosted standalone script:

```html
<script
  src="https://playerstack.techskills.academy/playerstack.min.js"
  defer
></script>
```

To pick plugins or write your own, work from this repository (`bun install`) and build a custom bundle.

## Use

```ts
import { Playerstack } from "@playerstack/core";
import { sourcesPlugin } from "@playerstack/plugin-sources";

Playerstack.use(sourcesPlugin).define();
```

```html
<player-stack src="https://youtu.be/dQw4w9WgXcQ"></player-stack>
```

## API

### `Playerstack`

Singleton with three methods:

| Method        | Returns                        | Description                                          |
| ------------- | ------------------------------ | ---------------------------------------------------- |
| `use(plugin)` | `Playerstack` (chainable)      | Register a plugin. Throws on duplicate `name`        |
| `plugins()`   | `readonly PlayerstackPlugin[]` | Snapshot of registered plugins                       |
| `define()`    | `void`                         | Register `<player-stack>` custom element. Idempotent |

### `PlayerstackPlugin`

```ts
interface PlayerstackPlugin {
  readonly name: string;
  init(ctx: PlayerstackContext): void | Promise<void>;
  destroy?(ctx: PlayerstackContext): void;
}
```

`init()` runs when the element connects to the DOM, after config has been loaded. `destroy()` runs on disconnect. Both receive the same `ctx`.

### `PlayerstackContext`

```ts
interface PlayerstackContext {
  events: EventBus; // typed pub/sub
  container: HTMLElement; // <player-stack> itself
  mediaPlayer: HTMLElement; // inner media element: <video>, <youtube-video>, <vimeo-video>, or <hls-video>
  config: PlayerstackConfig;
}
```

### `EventBus`

```ts
const unsubscribe = ctx.events.on("cta:click", (payload) => { ... });
ctx.events.emit("custom:event", { foo: "bar" });
ctx.events.off("cta:click", handler); // returns boolean
```

Handlers that throw don't stop later handlers — errors are logged.

### `ConfigProvider`

```ts
interface ConfigProvider {
  readonly name: string;
  load(element: HTMLElement): Promise<PlayerstackConfig>;
}
```

Default is `createInlineConfigProvider()` which reads `src`, `poster`, `title` attributes plus `data-config` JSON. Replace via `setConfigProviderForElement(provider)` from `@playerstack/core/element` (advanced). `@playerstack/core` defines `<player-stack>` as soon as it is imported (plugins import it too), and players already on the page start with the provider installed at that moment. Install the provider from `@playerstack/core/element` in a module that is the first import of your entry file. The hosted `playerstack.min.js` always uses the default provider; a custom provider needs a custom build (see `examples/12-sellf-integration`).

### `PlayerstackConfig`

```ts
interface PlayerstackConfig {
  src: string; // required
  poster?: string;
  title?: string;
  [key: string]: unknown; // plugin-specific slices
}
```

## License

Apache-2.0. Engine: Mux [media-chrome](https://github.com/muxinc/media-chrome) + [media-elements](https://github.com/muxinc/media-elements) (all MIT).
