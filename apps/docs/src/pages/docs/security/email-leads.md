---
layout: ../../../layouts/Docs.astro
title: Email lead capture security — Playerstack
description: Server protocol for secure email-gate lead capture — Altcha proof-of-work + single-use nonce + rate limit + origin check. Examples for Next.js, Hono, and Cloudflare Workers.
---

# Email lead capture security

The [`email-gate`](/docs/plugins/email-gate) plugin is **secure-by-default**: setting `webhookUrl` without `challengeUrl` makes the plugin refuse to render. This page documents the protocol and shows server implementations for the three runtimes Playerstack users actually deploy on: Next.js, Hono, and Cloudflare Workers.

## Threat model

What the protocol stops:

| Attack                                    | How it's blocked                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| Bot flooding the endpoint with fake leads | Altcha proof-of-work (1–2 s CPU per submit) + rate limit per IP                            |
| Replay attack with captured payload       | Single-use `nonce` — Redis `DEL` returns 0 on second use                                   |
| CSRF from another origin                  | Origin allowlist + HMAC-signed Altcha challenge tied to your server secret                 |
| Stolen `webhookUrl` from DevTools         | URL alone is useless — needs a valid, unused, non-expired Altcha challenge + nonce         |
| Headless browser farm                     | Each submit still costs CPU; combined with rate limit makes large-scale spam uneconomical  |
| Honeypot bypass                           | Off-screen `name="website"` input — bots fill all fields, plugin drops the submit silently |

## Protocol

```
Browser                         Your server
   │                                  │
   │  GET <challengeUrl>              │
   │ ───────────────────────────────► │
   │                                  │ 1. createChallenge(hmacKey, expires)
   │                                  │ 2. randomUUID() → store nonce in Redis (TTL 5 min)
   │                                  │
   │ ◄─────────────────────────────── │  { altcha: {...}, nonce: "uuid" }
   │                                  │
   │  solveChallenge(...)             │
   │  (1–2 s CPU)                     │
   │                                  │
   │  POST <webhookUrl>               │
   │  { email, src, nonce, altcha }   │
   │ ───────────────────────────────► │
   │                                  │ 1. Origin allowlist
   │                                  │ 2. Rate limit per IP
   │                                  │ 3. Redis DEL nonce → must return 1
   │                                  │ 4. verifySolution(altcha, hmacKey)
   │                                  │ 5. Email format
   │                                  │ 6. Save lead, forward to Listmonk/etc
   │                                  │
   │ ◄─────────────────────────────── │  { ok: true }
   │                                  │
```

## TypeScript types

```ts
import type {
  LeadsChallenge,
  LeadsSubmission,
} from "@playerstack/plugin-email-gate";
```

```ts
interface LeadsChallenge {
  altcha: {
    algorithm: "SHA-1" | "SHA-256" | "SHA-512";
    challenge: string;
    salt: string;
    signature: string;
    maxnumber?: number;
  };
  nonce: string; // single-use, MUST track server-side with TTL
}

interface LeadsSubmission {
  email: string;
  src: string;
  nonce: string; // echo from challenge
  altcha: { algorithm; challenge; number; salt; signature };
}
```

## Implementation: Next.js (App Router)

`app/api/leads/challenge/route.ts`:

```ts
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

`app/api/leads/route.ts`:

```ts
import { verifySolution } from "altcha-lib";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { redis } from "@/lib/redis";

const ALLOWED_ORIGINS = new Set([
  "https://your-domain.com",
  "https://app.your-domain.com",
]);
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "1 h"),
});

export async function POST(req: Request) {
  // 1. Origin allowlist
  const origin = req.headers.get("origin");
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  // 2. Rate limit per IP
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success } = await ratelimit.limit(`leads:${ip}`);
  if (!success) return Response.json({ error: "too many" }, { status: 429 });

  const { email, src, nonce, altcha } = await req.json();
  if (!email || !src || !nonce || !altcha) {
    return Response.json({ error: "malformed" }, { status: 400 });
  }

  // 3. Single-use nonce — atomic check-and-delete
  const consumed = await redis.del(`leads:nonce:${nonce}`);
  if (consumed !== 1) return Response.json({ error: "nonce" }, { status: 400 });

  // 4. Altcha PoW + HMAC signature
  const valid = await verifySolution(altcha, process.env.ALTCHA_HMAC_KEY!);
  if (!valid) return Response.json({ error: "altcha" }, { status: 400 });

  // 5. Email format
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return Response.json({ error: "email" }, { status: 400 });
  }

  // 6. Save + forward
  await saveLead({ email, src });
  // void forwardToListmonk({ email });
  return Response.json({ ok: true });
}
```

## Implementation: Hono (Bun / Node / Edge)

```ts
import { Hono } from "hono";
import { createChallenge, verifySolution } from "altcha-lib";
import { randomUUID } from "node:crypto";

const app = new Hono();
const NONCE_TTL = 300;

app.get("/api/leads/challenge", async (c) => {
  const altcha = await createChallenge({
    hmacKey: c.env.ALTCHA_HMAC_KEY,
    expires: new Date(Date.now() + NONCE_TTL * 1000),
  });
  const nonce = randomUUID();
  await c.env.KV.put(`leads:nonce:${nonce}`, "1", { expirationTtl: NONCE_TTL });
  return c.json({ altcha, nonce });
});

app.post("/api/leads", async (c) => {
  const origin = c.req.header("origin");
  if (origin !== c.env.ALLOWED_ORIGIN)
    return c.json({ error: "forbidden" }, 403);

  const { email, src, nonce, altcha } = await c.req.json();

  const stored = await c.env.KV.get(`leads:nonce:${nonce}`);
  if (!stored) return c.json({ error: "nonce" }, 400);
  await c.env.KV.delete(`leads:nonce:${nonce}`);

  const valid = await verifySolution(altcha, c.env.ALTCHA_HMAC_KEY);
  if (!valid) return c.json({ error: "altcha" }, 400);

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return c.json({ error: "email" }, 400);

  await saveLead(c.env.DB, { email, src });
  return c.json({ ok: true });
});
```

## Implementation: Cloudflare Workers (KV-backed)

```ts
import { createChallenge, verifySolution } from "altcha-lib";

const NONCE_TTL = 300;

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/api/leads/challenge") {
      const altcha = await createChallenge({
        hmacKey: env.ALTCHA_HMAC_KEY,
        expires: new Date(Date.now() + NONCE_TTL * 1000),
      });
      const nonce = crypto.randomUUID();
      await env.NONCE_KV.put(`leads:nonce:${nonce}`, "1", {
        expirationTtl: NONCE_TTL,
      });
      return Response.json({ altcha, nonce });
    }

    if (req.method === "POST" && url.pathname === "/api/leads") {
      if (req.headers.get("origin") !== env.ALLOWED_ORIGIN) {
        return Response.json({ error: "forbidden" }, { status: 403 });
      }
      const { email, src, nonce, altcha } = await req.json();
      const stored = await env.NONCE_KV.get(`leads:nonce:${nonce}`);
      if (!stored) return Response.json({ error: "nonce" }, { status: 400 });
      await env.NONCE_KV.delete(`leads:nonce:${nonce}`);
      const valid = await verifySolution(altcha, env.ALTCHA_HMAC_KEY);
      if (!valid) return Response.json({ error: "altcha" }, { status: 400 });
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return Response.json({ error: "email" }, { status: 400 });
      }
      await env.DB.prepare("INSERT INTO leads (email, src) VALUES (?, ?)")
        .bind(email, src)
        .run();
      return Response.json({ ok: true });
    }

    return new Response("not found", { status: 404 });
  },
};
```

## Operational checklist

- [ ] `ALTCHA_HMAC_KEY` is a strong random secret (min 32 bytes), stored in env, never committed
- [ ] Redis / KV TTL on nonces is ≤ 5 minutes (matches Altcha challenge expiry)
- [ ] Rate limit per IP set to a reasonable threshold (5–10 emails / hour is a sane default)
- [ ] Origin allowlist includes only domains that should display the gate (no wildcards)
- [ ] Email validation includes MX record check if you forward to a paid email service (cheap to add, kills 90% of garbage emails)
- [ ] Disposable email blocklist (npm: `disposable-email-domains`) if leads quality matters
- [ ] Saved leads are deduped on `(email, src)` for the last N days — prevents one user from filling DB by retrying
- [ ] Logs include enough metadata to spot abuse patterns (IP, user-agent, timestamp) but no PII beyond what you need
