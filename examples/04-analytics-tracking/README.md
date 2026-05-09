# 04 — Analytics tracking

Custom plugin that listens to event bus events from `branded-thumb` and `cta-end`, then logs them. In production you'd `navigator.sendBeacon()` to your analytics endpoint.

## Run

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Pattern

```js
const analyticsPlugin = {
  name: "demo-analytics",
  init(ctx) {
    ctx.events.on("thumb:click", () => {
      /* track */
    });
    ctx.events.on("cta:click", ({ label, url }) => {
      /* track */
    });
    ctx.events.on("cta:replay", () => {
      /* track */
    });
  },
};

Playerstack.use(analyticsPlugin);
```

The plugin runs **after** the standalone bundle has registered the 5 MVP plugins, so the event bus already has emitters attached.

## Production version

Replace the `append()` calls with real beacons:

```js
ctx.events.on("cta:click", ({ label, url }) => {
  navigator.sendBeacon(
    "/api/track",
    JSON.stringify({
      event: "cta_click",
      label,
      url,
      productId: ctx.container.dataset.productId,
      sessionId: getSessionId(),
      ts: Date.now(),
    }),
  );
});
```

`sendBeacon` is fire-and-forget; it works even if the user closes the tab right after clicking.

## Available events

| Event         | Payload          | When                                    |
| ------------- | ---------------- | --------------------------------------- |
| `thumb:click` | `undefined`      | User clicks the branded-thumb overlay   |
| `cta:click`   | `{ label, url }` | User clicks the end-of-video CTA button |
| `cta:replay`  | `undefined`      | User clicks the replay button           |

You can also listen to native HTML5 media events directly via `ctx.mediaPlayer.addEventListener("ended", ...)` etc. — see `examples/05-custom-plugin` for chapter markers using that approach.
