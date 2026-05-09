# 10 — Tailwind-styled

Tailwind CSS for the surrounding layout, Playerstack's `controls.accent` for the player itself.

## Run

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Pattern

The player sits inside a Tailwind-styled card:

```html
<div
  class="rounded-2xl shadow-xl shadow-blue-500/10 ring-1 ring-black/5 overflow-hidden bg-black"
>
  <player-stack
    src="..."
    data-config='{"controls":{"accent":"#3b82f6"}}'
  ></player-stack>
</div>
```

## Theming the player

Playerstack exposes two CSS variables you can set with Tailwind's arbitrary values:

```html
<player-stack
  src="..."
  style="--ps-accent: theme(colors.blue.500); --ps-bg-opacity: 0.6;"
></player-stack>
```

Or set them globally:

```css
@layer base {
  player-stack {
    --ps-accent: theme(colors.blue.500);
    --ps-bg-opacity: 0.6;
  }
}
```

## Tailwind v4

If you're on Tailwind v4 with `@theme`:

```css
@theme {
  --color-brand: #3b82f6;
}

player-stack {
  --ps-accent: var(--color-brand);
}
```

This way both your Tailwind utilities (`text-brand`, `bg-brand`) and the player accent stay in sync.
