# 05 — Custom plugin (chapter markers)

A complete custom plugin: reads chapter timestamps from `config.chapters`, renders a clickable list, syncs the active chapter with playback time.

This pattern is the canonical way to extend Playerstack — plugins read their slice of `ctx.config`, mutate the DOM, listen to events, and clean up in `destroy`.

## Run

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Plugin anatomy

```js
const states = new WeakMap(); // per-context state, multi-instance safe

const chaptersPlugin = {
  name: "chapters", // unique within the Playerstack instance

  init(ctx) {
    const chapters = ctx.config.chapters; // read your config slice
    if (!chapters?.points?.length) return; // no-op if not configured

    // Build UI, attach to DOM
    const list = document.getElementById("chapters");
    // ...

    // Listen to native media events on the underlying <media-player>
    const onTimeUpdate = () => {
      /* update active chapter */
    };
    ctx.mediaPlayer.addEventListener("timeupdate", onTimeUpdate);

    // Store anything destroy needs to clean up
    states.set(ctx, { onTimeUpdate });
  },

  destroy(ctx) {
    const state = states.get(ctx);
    if (state)
      ctx.mediaPlayer.removeEventListener("timeupdate", state.onTimeUpdate);
    states.delete(ctx);
  },
};

Playerstack.use(chaptersPlugin);
```

## Best practices for plugin authoring

1. **Pure logic in a separate file**: extract config validation, format helpers, etc. into a non-DOM file with its own tests
2. **`WeakMap<PlayerstackContext, ...>` for state**: never use module-level mutable state, breaks with multiple players
3. **Add listeners in `init`, remove in `destroy`**: track every listener you add
4. **Read config defensively**: `ctx.config.chapters?.points?.length` — config might not include your slice
5. **Don't throw in `init` for "no-op" cases**: just return early if your plugin isn't configured
6. **Document your config slice**: extend `PlayerstackConfig` interface in your plugin's types if publishing

## Alternative: TypeScript scoped package

If you want to publish your plugin (`@your-org/playerstack-plugin-chapters`):

```ts
import type { PlayerstackPlugin, PlayerstackContext } from "@playerstack/core";

export interface ChaptersConfig {
  points: Array<{ time: number; label: string }>;
  containerSelector?: string;
}

const states = new WeakMap<PlayerstackContext, ChaptersState>();

export const chaptersPlugin: PlayerstackPlugin = {
  name: "chapters",
  init(ctx) {
    const cfg = (ctx.config as { chapters?: ChaptersConfig }).chapters;
    if (!cfg?.points?.length) return;
    // ...
  },
  destroy(ctx) {
    states.get(ctx)?.cleanup();
    states.delete(ctx);
  },
};
```

Follow the layout of `packages/plugin-cta-end/` for reference.
