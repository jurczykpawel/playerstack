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

Default is `createInlineConfigProvider()` which reads `src`, `poster`, `title`, `preload` attributes plus `data-config` JSON. Replace via `setConfigProviderForElement(provider)` from `@playerstack/core/element` (advanced). `@playerstack/core` defines `<player-stack>` as soon as it is imported (plugins import it too), and players already on the page start with the provider installed at that moment. Install the provider from `@playerstack/core/element` in a module that is the first import of your entry file. The hosted `playerstack.min.js` always uses the default provider; a custom provider needs a custom build (see `examples/12-sellf-integration`).

### `PlayerstackConfig`

```ts
interface PlayerstackConfig {
  src: string; // required
  poster?: string;
  title?: string;
  preload?: "none" | "metadata" | "auto";
  [key: string]: unknown; // plugin-specific slices
}
```

`preload` is applied before the media element connects or receives its source.
JSON configuration takes precedence over attributes. Omitting it preserves the
browser default. `preload="none"` disables automatic preview; playback remains
available through the player controls. Reduced-motion preferences also suppress
preview from initial connection.

### Overlay layers

`activateOverlay(container, overlay, priority = 3, focusFromBody = false)` returns an
idempotent release function. Append the overlay first; call release **before** removing
it, including in plugin `destroy`. Higher priority wins; equal priorities use activation
order. Keep CSS stacking order consistent with these priorities.

The highest layer makes sibling branches below it `inert` and `aria-hidden="true"`,
including nodes mounted later. Release restores each original attribute value and
supports overlays closing in either order. Existing `inert` (for example a branded
thumbnail's controller lock) is preserved. Layer state belongs to the player container
and is shared by independently loaded plugin bundles.

`holdInert(element)` acquires an independently owned `inert`/`aria-hidden` lock and
returns an idempotent release function. Overlay layers and branded thumbnails use
the same owner count: attributes are restored only after the last owner releases.
Plugins that temporarily cover the same controls should use this helper instead of
setting or removing `inert` directly. Original attributes present before the first
owner are preserved.

Focus moves to the first overlay action only when the player owned focus. Set
`focusFromBody` only after a player interaction to include focus lost to `body`;
an external focused element is always left alone. There is no Tab trap: the page's
controls before and after the player remain reachable. Releasing an overlay that owns
focus restores its previous target or the thumbnail/play/controller fallback.
`focusPlayerControl(container)` explicitly focuses that fallback after replay.

```ts
import { activateOverlay } from "@playerstack/core";
ctx.container.append(overlay);
const release = activateOverlay(ctx.container, overlay, 4);
// In every dismiss/submit/destroy path:
release();
overlay.remove();
```

For an email gate, activate after mounting its form with priority 4 (above CTA/intro
at 3), retain the release callback in its per-context state, and invoke it before every
removal. This adds no lead-capture knowledge to core and changes no plugin hooks/events.

## License

Apache-2.0. Engine: Mux [media-chrome](https://github.com/muxinc/media-chrome) + [media-elements](https://github.com/muxinc/media-elements) (all MIT).
