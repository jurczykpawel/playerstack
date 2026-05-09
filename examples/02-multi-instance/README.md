# 02 — Multi-instance

Three `<player-stack>` elements on one page, each with different config.

## Run

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Why this matters

A common bug in plugin systems: module-level state collides when you have N instances. Playerstack avoids this with a `WeakMap<PlayerstackContext, ...>` pattern in every plugin — see `packages/plugin-controls-policy/src/index.ts`.

## What you get

- Player 1 — blue accent, play + progress only
- Player 2 — red accent, full default controls
- Player 3 — MP4 with end-of-video CTA + replay

The `<style data-playerstack="controls-policy">` block in each `<media-player>` is scoped to that element only. No leak between players.

## Verify isolation in DevTools

```js
document
  .querySelectorAll("media-player")
  .forEach((p, i) =>
    console.log(
      `player ${i}:`,
      p.querySelector("style[data-playerstack]")?.textContent,
    ),
  );
```

Each player's style block has different content based on its `data-config`.
