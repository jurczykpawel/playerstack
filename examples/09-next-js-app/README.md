# 09 — Next.js App Router

Next.js 13+ App Router pattern with `dynamic()` to skip SSR entirely.

## Files

- `PlayerStack.tsx` — client component (`"use client"`)
- `page.tsx` — server component using `dynamic({ ssr: false })`

## Why `ssr: false`

Custom elements (`<player-stack>`) need `customElements.define()` to run before they hydrate. That's a browser-only API. If you SSR the element, you either:

- Get a hydration mismatch warning (React renders empty, then the element appears)
- Need to manually inject a "loading" placeholder

`dynamic({ ssr: false })` skips both — Next.js renders the placeholder during SSR (your `loading` component) and swaps it for the real player on the client. Cleaner.

## Drop-in for any Next.js app

```tsx
// app/some-page/page.tsx
import dynamic from "next/dynamic";

const PlayerStack = dynamic(
  () => import("@/components/PlayerStack").then((m) => m.PlayerStack),
  {
    ssr: false,
    loading: () => <div className="aspect-video bg-black animate-pulse" />,
  },
);

export default function Page() {
  return <PlayerStack src="https://youtu.be/..." />;
}
```

## Pages Router (Next.js 12-)

For the legacy Pages Router, use the same `dynamic()` pattern. The `"use client"` directive does nothing in Pages Router (it's App Router only) but doesn't hurt.

## Self-hosting the bundle

If you want to avoid the CDN dependency, download `playerstack.min.js` and the provider files next to it (`playerstack-hls.js`, `playerstack-vimeo.js`, `playerstack-wistia.js`, `playerstack-twitch.js`; see [Self-host the bundle](https://playerstack.techskills.academy/docs/getting-started/#self-host-the-bundle)) into your app's `public/js/` directory. Keep them in one directory, then point `PLAYERSTACK_URL` in `PlayerStack.tsx` at your copy:

```ts
const PLAYERSTACK_URL = "/js/playerstack.min.js";
```

The `@playerstack/*` and `playerstack` npm packages are not published yet, so there is nothing to install with a package manager.
