# 06 — React component

A complete React wrapper around `<player-stack>`. Drop both files into any React 18+ project.

## Files

- `PlayerStack.tsx` — the reusable wrapper component
- `Demo.tsx` — example usage

## Why a wrapper

You can use `<player-stack>` directly in JSX, but you need to:

1. Load the Playerstack CDN script once (not on every render)
2. Pass `data-config` as a JSON string (React doesn't auto-stringify)
3. Handle SSR (`document` is undefined on the server)

The wrapper does all three.

## Usage

```tsx
import { PlayerStack } from "./PlayerStack";

<PlayerStack
  src="https://youtu.be/dQw4w9WgXcQ"
  title="Demo"
  config={{
    controls: { accent: "#008aff" },
    ctaEnd: {
      enabled: true,
      button: { label: "Buy now", url: "https://example.com/buy" },
    },
  }}
/>;
```

## SSR-safe

The component renders an empty `<div>` on the server. The Playerstack CDN script and the actual player only load on the client, in `useEffect`. No hydration mismatches.

## React 19 notes

In React 19+, you can also pass custom-element attributes directly via JSX:

```tsx
<player-stack
  src="https://youtu.be/dQw4w9WgXcQ"
  data-config={JSON.stringify({ controls: { accent: "#008aff" } })}
/>
```

But you still need to load the Playerstack bundle once. Use `useEffect` or a layout script tag.

## Next.js

For Next.js, see `examples/09-next-js-app` — same pattern but with `dynamic()` to skip SSR entirely.
