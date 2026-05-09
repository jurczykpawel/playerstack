# @playerstack/core

The engine wrapper and plugin runtime for [Playerstack](https://github.com/jurczykpawel/playerstack). Wraps [Vidstack](https://vidstack.io) and exposes the `<player-stack>` custom element plus a small plugin API.

Most users want the standalone bundle [`playerstack`](https://www.npmjs.com/package/playerstack), not this package. Use `@playerstack/core` directly when you want to **pick which plugins to ship** for a smaller bundle, or to write your own plugins.

## Install

```sh
npm install @playerstack/core
# or
bun add @playerstack/core
```

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

| Method | Returns | Description |
|---|---|---|
| `use(plugin)` | `Playerstack` (chainable) | Register a plugin. Throws on duplicate `name` |
| `plugins()` | `readonly PlayerstackPlugin[]` | Snapshot of registered plugins |
| `define()` | `void` | Register `<player-stack>` custom element. Idempotent |

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
  events: EventBus;        // typed pub/sub
  container: HTMLElement;  // <player-stack> itself
  mediaPlayer: HTMLElement; // Vidstack <media-player>
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

Default is `createInlineConfigProvider()` which reads `src`, `poster`, `title` attributes plus `data-config` JSON. Replace via `setConfigProviderForElement(provider)` (advanced).

### `PlayerstackConfig`

```ts
interface PlayerstackConfig {
  src: string;        // required
  poster?: string;
  title?: string;
  [key: string]: unknown; // plugin-specific slices
}
```

## License

MIT. Engine: [Vidstack](https://vidstack.io) (also MIT).
