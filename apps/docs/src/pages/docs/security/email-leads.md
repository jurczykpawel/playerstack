---
layout: ../../../layouts/Docs.astro
title: Email lead capture security — Playerstack
description: Server contract for email-gate lead capture, challenge formats, nonce lifetime, product binding, and response handling.
---

# Email lead capture security

The [`email-gate`](/docs/plugins/email-gate) plugin requires both `webhookUrl` and `challengeUrl` for network submissions. With neither URL it runs in open mode and emits an event only. This page describes the same endpoint contract as the [plugin README](https://github.com/jurczykpawel/playerstack/tree/main/packages/plugin-email-gate); the backend belongs to the integrating application.

## Challenge and submission

Every attempt starts with `GET <challengeUrl>`, without credentials (cookies) and `Accept: application/json`. When configured, `product` is added as a query parameter; existing query parameters remain. The server validates it against the brand's allowlist and stores it with the nonce. Product identifiers contain 1–100 characters. When product is omitted, bind the nonce to that absence as well.

Both GET and POST use `credentials: "omit"`. For cross-origin requests, return `Access-Control-Allow-Origin` with the exact embedding origin and allow the required methods and headers in preflight responses. `Access-Control-Allow-Credentials` is not required.

Return a wrapped challenge, with `nonce` at the top level:

```json
{
  "altcha": {
    "algorithm": "SHA-256",
    "challenge": "challenge-digest",
    "salt": "server-salt",
    "signature": "server-signature",
    "maxnumber": 100000
  },
  "nonce": "server-issued-one-time-value"
}
```

`algorithm` supports `SHA-1`, `SHA-256`, or `SHA-512`; `maxnumber` is optional. A flat challenge or missing nonce is not accepted. Store an expiry with each nonce and align it with challenge expiry. The duration is a backend policy (Mailstack: approximately ten minutes), not a lifetime supplied by the browser.

The browser solves the challenge and sends `POST <webhookUrl>`, without credentials (cookies) and `Content-Type: application/json`:

```json
{
  "email": "viewer@example.com",
  "src": "https://files.example.com/demo.mp4",
  "product": "Selfware",
  "nonce": "server-issued-one-time-value",
  "altcha": {
    "algorithm": "SHA-256",
    "challenge": "challenge-digest",
    "number": 7,
    "salt": "server-salt",
    "signature": "server-signature"
  }
}
```

`product` is optional and independent of `src`. The default `altchaFormat: "object"` sends the object above. With `altchaFormat: "base64"`, `altcha` is a string: standard base64 of the UTF-8 JSON for that same object. Configure the backend to accept the chosen format. Example values above describe the shape, not a valid solution.

## Required server ordering

1. Read the bounded request body to identify the nonce. For a request with a usable nonce, **atomically consume it at the beginning of POST handling, before validation or any error response**. Consumption returns the stored product and expiry and removes the nonce in the same operation. A malformed body without an identifiable nonce cannot consume a record.
2. Reject a missing, already-consumed, or expired record. Expiry must be enforced by the consuming operation even if physical storage cleanup is delayed.
3. Validate the origin, apply the rate limit, and validate the payload, including email and `src`. Validate `product` against both the brand allowlist and the nonce-bound value, including presence/absence.
4. Verify the ALTCHA solution and signature with the server secret and check its expiry. Decode base64 as UTF-8 JSON first when that format is selected.
5. Save or forward the accepted lead and return a 2xx response.

The first POST consumes the nonce **regardless of outcome**: invalid email, product, ALTCHA, origin, rate limit, and downstream 4xx/5xx errors all require a new challenge and nonce. Do not validate and then consume, and do not restore a consumed nonce after failure. A client retry always starts with a new GET; the plugin never automatically repeats a POST.

## Atomic storage boundary

Use a storage operation that returns and deletes a record atomically, scoped to the integrating brand. For example, an atomic Redis `GETDEL` can return a serialized `{ product, expiresAt }` record; a transactional database operation or a Durable Object can provide the same boundary. Check expiry from the returned record before accepting it.

**Cloudflare KV `get` followed by `delete` does not meet this contract.** Separate reads and deletes must not be used as the nonce-consumption implementation. Use a transactional store or serialize consumption in a Durable Object instead. The pseudocode below makes the application-owned storage boundary explicit; it is not a complete server implementation:

```ts
async function submitLead(
  request: Request,
  services: LeadServices,
): Promise<Response> {
  const payload = await services.readBoundedJson(request);
  const record = await services.nonces.consume(payload?.nonce);
  // consume returns and removes one record atomically; it never restores it.
  if (!record || record.expiresAt <= Date.now()) {
    return Response.json({ error: "nonce" }, { status: 400 });
  }
  if (!services.allowedOrigin(request)) {
    return Response.json({ error: "origin" }, { status: 403 });
  }
  if (!(await services.withinRateLimit(request))) {
    return Response.json({ error: "limit" }, { status: 429 });
  }
  if (!services.validPayload(payload, record.product)) {
    return Response.json({ error: "payload" }, { status: 400 });
  }
  if (!(await services.validSolution(payload.altcha))) {
    return Response.json({ error: "altcha" }, { status: 400 });
  }
  await services.saveLead(payload);
  return new Response(null, { status: 204 });
}
```

`consume` must handle absent/invalid nonce values as a missing record. `validPayload` checks the product allowlist and exact stored binding as well as the remaining fields. Exceptions after consumption return an error without making the nonce usable again. Apply origin checks and rate limits to challenge issuance too. Keep secrets exclusively on the server.

## Responses and retry

| Response                                                           | Client behavior                                                                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Any POST 2xx                                                       | Emit submit, save memo when enabled, close the form, announce success. No response body required. |
| 429                                                                | Show `messages.rateLimit`; re-enable submit.                                                      |
| Other 4xx                                                          | Show `messages.rejected`; re-enable submit.                                                       |
| 5xx, transport or JSON error, malformed challenge, failed solution | Show `messages.networkError`; re-enable submit.                                                   |

Every failure leaves the form available for another attempt with a fresh challenge and nonce. Closing or destroying a form stops later client success and further POSTs; an already-sent POST may still be processed by the backend. Define backend deduplication independently of nonce lifetime.

For a contact form after playback, use `at: "after"`, provide privacy text/link and the product identifier, and choose `remember: false` or an explicit `rememberDays` retention period. These settings do not replace the application's privacy notice or server-side retention policy.

## Marketing consent and integrator settings

The optional `marketingConsent` checkbox is unchecked and not required by default. When absent from configuration, POST omits `marketingConsent`, `consentVersion`, and `consentText`. When configured but unchecked it sends only `marketingConsent: false`. When checked it sends `marketingConsent: true` and the configured version and exact label text (without its link). These fields do not change the challenge or nonce contract. Open mode emits the same fields on the event bus without making a POST.

After atomically consuming the nonce, validate the consent boolean and, when true, the version (1–64 characters) and text (1–500 characters). Only true may authorize a list signup. Record time on the server. Verify the version against your own configured wording and retain its canonical text; client `consentText` is supplemental input. A list-only Sellf form uses `marketingConsent.required: true`; the browser blocks unchecked submission before networking, shows `messages.consentRequired`, and focuses the invalid checkbox. The server must enforce its own required-consent policy too.

Allow the host page's origin explicitly (Sellf: seller domains), otherwise return 403. `product` is the backend slug or UUID (1–100 characters), checked against the allowlist and nonce binding. `src` is only recording/context data, never authorization, product selection, or a redirect target.

Set `messages.success` for the backend's flow, for example “Sprawdź pocztę…” when email confirmation is required. All 2xx responses succeed regardless of body: empty, non-JSON, or `{ "status": "check_email" }`. PlayerStack does not parse the success body, and the message must not imply that access is already granted when confirmation is pending.
