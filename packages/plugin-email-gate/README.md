# @playerstack/plugin-email-gate

Lead capture with **secure-by-default** verification. Pauses the video, shows an email form, forwards the lead to your server only after an [Altcha](https://altcha.org) proof-of-work challenge is solved AND a single-use server-issued nonce is consumed. Without server-side verification configured, the plugin runs in event-bus-only "open mode" and never POSTs anywhere.

Part of [Playerstack](https://github.com/jurczykpawel/playerstack). Included in the standalone [`playerstack`](https://www.npmjs.com/package/playerstack) bundle.

## Install

```sh
npm install @playerstack/core @playerstack/plugin-email-gate
```

## Use — open mode (event bus only, no network)

```html
<player-stack
  src="https://files.example.com/lesson.mp4"
  data-config='{
    "emailGate": {
      "enabled": true,
      "at": "before",
      "title": "Drop your email to watch the full lesson",
      "buttonLabel": "Unlock video →"
    }
  }'
></player-stack>
```

The form pauses the video and emits `email-gate:submit` on the event bus. Nothing is POSTed anywhere — your code listens via a custom plugin if needed.

## Use — hardened mode (recommended for any public deployment)

```html
<player-stack
  src="https://files.example.com/lesson.mp4"
  data-config='{
    "emailGate": {
      "enabled": true,
      "at": "before",
      "webhookUrl":   "https://your-api.com/api/leads",
      "challengeUrl": "https://your-api.com/api/leads/challenge"
    }
  }'
></player-stack>
```

When `webhookUrl` is set, **`challengeUrl` is required** — the plugin refuses to render otherwise (logs a console error). This prevents accidentally exposing an unauthenticated lead-capture endpoint.

## Config

| Field          | Type                 | Default                    | Description                                                                       |
| -------------- | -------------------- | -------------------------- | --------------------------------------------------------------------------------- |
| `enabled`      | `boolean`            | `false`                    | Plugin is a no-op unless `true`                                                   |
| `at`           | `"before" \| number` | `"before"`                 | Show on init, or after N seconds of playback                                      |
| `atPercent`    | `number`             | —                          | Alternative trigger at N% of duration                                             |
| `webhookUrl`   | `string`             | —                          | Where to POST `LeadsSubmission`. **Requires `challengeUrl`.**                     |
| `challengeUrl` | `string`             | —                          | Where to GET `LeadsChallenge`. Server issues Altcha challenge + single-use nonce. |
| `title`        | `string`             | `"Watch the rest"`         | Heading text                                                                      |
| `buttonLabel`  | `string`             | `"Continue watching →"`    | Submit button label                                                               |
| `storageKey`   | `string`             | `"playerstack:email-gate"` | localStorage key prefix                                                           |

## Server protocol (TypeScript types exported)

```ts
import type {
  LeadsChallenge,
  LeadsSubmission,
} from "@playerstack/plugin-email-gate";
```

`GET <challengeUrl>` returns:

```ts
interface LeadsChallenge {
  altcha: {
    algorithm: "SHA-256";
    challenge: string;
    salt: string;
    signature: string;
    maxnumber?: number;
  };
  nonce: string; // single-use, MUST be tracked server-side with TTL
}
```

`POST <webhookUrl>` accepts:

```ts
interface LeadsSubmission {
  email: string;
  src: string;
  nonce: string; // echo from challenge — server marks consumed on first valid submit
  altcha: { algorithm; challenge; number; salt; signature }; // pass to verifySolution()
}
```

## Server implementation (Next.js example)

```ts
// app/api/leads/challenge/route.ts
import { createChallenge } from "altcha-lib";
import { randomUUID } from "node:crypto";
import { redis } from "@/lib/redis";

const NONCE_TTL_SECONDS = 300;

export async function GET() {
  const altcha = await createChallenge({
    hmacKey: process.env.ALTCHA_HMAC_KEY!,
    expires: new Date(Date.now() + NONCE_TTL_SECONDS * 1000),
  });
  const nonce = randomUUID();
  await redis.set(`leads:nonce:${nonce}`, "1", { EX: NONCE_TTL_SECONDS });
  return Response.json({ altcha, nonce });
}
```

```ts
// app/api/leads/route.ts
import { verifySolution } from "altcha-lib";
import { redis } from "@/lib/redis";
import { ratelimit } from "@/lib/ratelimit";

export async function POST(req: Request) {
  if (!isAllowedOrigin(req.headers.get("origin"))) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const rl = await ratelimit.limit(`leads:${ip}`);
  if (!rl.success) return Response.json({ error: "too many" }, { status: 429 });

  const { email, src, nonce, altcha } = await req.json();

  // Single-use nonce — atomic check-and-delete
  const consumed = await redis.del(`leads:nonce:${nonce}`);
  if (consumed !== 1) return Response.json({ error: "nonce" }, { status: 400 });

  const valid = await verifySolution(altcha, process.env.ALTCHA_HMAC_KEY!);
  if (!valid) return Response.json({ error: "altcha" }, { status: 400 });

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return Response.json({ error: "email" }, { status: 400 });
  }

  await saveLead({ email, src });
  return Response.json({ ok: true });
}
```

## What this protocol stops

| Attack                              | Mitigation                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| Bot floods endpoint with fake leads | Altcha PoW (1–2 s CPU per submit) + rate limit per IP                                      |
| Replay attack                       | Single-use `nonce` (Redis `DEL` returns 0 on second use)                                   |
| CSRF from another domain            | Origin allowlist + HMAC-signed altcha tied to your server secret                           |
| Stolen `webhookUrl` from DevTools   | URL alone is useless — needs valid Altcha + unused nonce, both server-issued               |
| Headless browser farm               | Each submit still costs CPU; combined with rate limit makes large-scale spam uneconomical  |
| Honeypot bypass                     | Off-screen `name="website"` input — bots fill all fields, plugin silently drops the submit |

## Built-in client-side protections

- **Honeypot field** — invisible `name="website"` input. Filled = silent drop, no event, no fetch.
- **`localStorage` memo** — successful submission stores a timestamp keyed on `src`. Same browser doesn't see the gate twice.
- **Refuse-on-misconfig** — `webhookUrl` without `challengeUrl` logs an error and renders nothing.

## Events

| Name                | Payload             | When                                                                                |
| ------------------- | ------------------- | ----------------------------------------------------------------------------------- |
| `email-gate:submit` | `{ email: string }` | Server accepted the submission (or open-mode form was filled, honeypot not tripped) |

## License

MIT.
