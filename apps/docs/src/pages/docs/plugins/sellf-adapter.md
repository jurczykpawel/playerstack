---
layout: ../../../layouts/Docs.astro
title: sellf-adapter — Playerstack
description: Load Playerstack config from a Sellf product endpoint.
---

# sellf-adapter

> Package: `@playerstack/plugin-sellf-adapter` ([source](https://github.com/jurczykpawel/playerstack/tree/main/packages/plugin-sellf-adapter)), not published to npm yet

Replaces the default `InlineConfigProvider` with one that fetches config from a [Sellf](https://sellf.app) product endpoint. Designed for course creators who want their video metadata, CTAs, and gating to live in Sellf and propagate to every embed.

> **Not bundled by default.** This package is opt-in — install separately.

## Quickstart

```ts
// sellf-provider.ts — the first import of your entry file
import { createSellfConfigProvider } from "@playerstack/plugin-sellf-adapter";
import { setConfigProviderForElement } from "@playerstack/core/element";

const provider = createSellfConfigProvider({
  baseUrl: "https://sellf.app",
  fetchOptions: { credentials: "include" }, // optional, e.g. for auth
});

setConfigProviderForElement(provider);
```

```ts
// main.ts
import "./sellf-provider"; // must stay the first import
import { Playerstack } from "@playerstack/core";
// …register plugins and call Playerstack.define()
```

`@playerstack/core` defines `<player-stack>` as soon as it is imported (plugins import it too), and players already on the page start with the provider installed at that moment. Install the provider from `@playerstack/core/element` in a module that is the first import of your entry file. The hosted `playerstack.min.js` always uses the default provider; a custom provider needs a custom build (see `examples/12-sellf-integration`).

```html
<player-stack data-sellf-product="abc123"></player-stack>
```

When the element connects, the provider fetches:

```
https://sellf.app/api/products/abc123/playerstack
```

…and uses the JSON response as the player config.

## Endpoint contract

The Sellf endpoint must return a JSON object that conforms to `PlayerstackConfig`:

```json
{
  "src": "https://files.example.com/lesson-1.mp4",
  "poster": "https://cdn.example.com/poster.webp",
  "title": "Lesson 1",
  "controls": { "accent": "#008aff" },
  "ctaEnd": {
    "enabled": true,
    "button": { "label": "Next lesson", "url": "https://example.com/lesson-2" }
  }
}
```

`src` is required. Anything else is optional.

## Inline overrides

Inline attributes always win on merge. Useful for per-page CTAs without changing Sellf:

```html
<player-stack
  data-sellf-product="abc123"
  title="Override the title from Sellf"
></player-stack>
```

This loads everything from Sellf, but `title` is taken from the attribute.

## Trusted origins

`trustedOrigins?: string[]` lets the API supply `emailGate.webhookUrl`, `emailGate.challengeUrl`, and `analytics.endpoint` while keeping all other normalization rules. The list is copied and validated when the provider is created, even with `trustRemote: true`. Invalid options throw immediately.

```ts
createSellfConfigProvider({
  baseUrl: "https://sellf.app",
  trustedOrigins: ["https://sellf.app", "https://leads.example.com:8443"],
});
```

Each entry must be a full HTTP(S) origin with an optional trailing slash, without a path, query, fragment, credentials, or wildcard. Origins are normalized using `new URL(value).origin`, including hostname case and default ports. Scheme and non-default port must match exactly. HTTP is accepted only when explicitly listed, for local development or an intentionally HTTP integration; prefer HTTPS in production. `baseUrl` does not implicitly trust an origin.

Remote endpoints must be absolute HTTP(S) URLs without credentials, with an origin in that list. Accepted endpoints are stored as normalized absolute URLs, retaining their paths and queries. Other endpoints are omitted. An absent or empty list keeps the default behavior. Integrator `endpoints` always override remote endpoints, including those from a listed origin. Media/image URLs, CTA and watermark links, privacy/consent links, and preview settings retain their existing normalization rules.

A trusted `analytics.endpoint` from the API selects the `beacon` provider when no provider is explicitly configured; integrators should configure the provider and endpoint themselves.

`trustRemote` is **deprecated**, retained only for tests and internal dashboards. Prefer `trustedOrigins`. For compatibility, `trustRemote: true` still passes the entire response through unchanged, including when `trustedOrigins` is present; it does not apply the list to remote endpoints. Integrator `endpoints` still win.

## Remote email-gate fields

With the default `trustRemote: false`, unknown fields and values of the wrong type are dropped. Invalid values are omitted rather than truncated. Nested objects are copied. Text is rendered literally by email-gate.

| Field                                | Accepted remote values                                                                                                                                                                                                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`, `dismissible`, `remember` | Booleans only.                                                                                                                                                                                                                                                         |
| `at`                                 | `"before"`, `"after"`, or finite non-negative seconds.                                                                                                                                                                                                                 |
| `atPercent`                          | Finite number from 0 to 100.                                                                                                                                                                                                                                           |
| `product`                            | String trimmed to 1–100 characters.                                                                                                                                                                                                                                    |
| `marketingConsent`                   | Requires nonblank `text` (up to 500 characters) and `version` (up to 64); optional boolean `required`, `linkText` (up to 200), and `href` (up to 2048). Other keys are dropped. Wording and version retain whitespace. Invalid required fields omit the entire object. |
| `privacy`                            | Requires nonblank `text` (up to 500); optional `linkText` (up to 200) and `href` (up to 2048). Other keys are dropped.                                                                                                                                                 |
| `messages`                           | Strings up to 500 characters, only for `title`, `emailLabel`, `placeholder`, `submit`, `verifying`, `solving`, `submitting`, `success`, `invalidEmail`, `rejected`, `rateLimit`, `networkError`, `dismiss`, `consentRequired`.                                         |
| `altchaFormat`                       | `"object"` or `"base64"`.                                                                                                                                                                                                                                              |
| `rememberDays`                       | Finite non-negative number; fractional days are supported.                                                                                                                                                                                                             |
| `title`, `buttonLabel`               | Legacy string overrides, up to 500 characters.                                                                                                                                                                                                                         |
| `storageKey`                         | String up to 200 characters.                                                                                                                                                                                                                                           |

Links use the same HTTP(S) protocol check as email-gate, resolving relative URLs against `document.baseURI`. Both `href` and `linkText` are needed to render a link. The product and consent limits come from email-gate; the remaining text/URL limits are adapter limits for remote configuration. Empty strings are allowed for the other message keys; blank `title`, `emailLabel`, `submit`, and `dismiss` values fall back to plugin defaults. Lengths use JavaScript string length.

`webhookUrl` and `challengeUrl` from the API are omitted unless their origins are listed in `trustedOrigins`. Alternatively, supply them through `SellfAdapterOptions.endpoints.emailGate` as `webhook` and `challenge`. Without configured endpoints the gate runs in open mode and emits an event without a network submission.

Example response from `GET /api/products/guide/playerstack`:

```json
{
  "src": "https://files.example.com/guide.mp4",
  "emailGate": {
    "enabled": true,
    "at": "after",
    "product": "guide",
    "altchaFormat": "base64",
    "remember": false,
    "marketingConsent": {
      "text": "Send me updates about new materials.",
      "version": "2026-10",
      "required": true
    },
    "messages": { "success": "Check your email to confirm." }
  }
}
```

The integrator supplies the endpoints separately:

```ts
createSellfConfigProvider({
  baseUrl: "https://sellf.example",
  endpoints: {
    emailGate: {
      webhook: "https://sellf.example/api/leads/submit",
      challenge: "https://sellf.example/api/leads/challenge",
    },
  },
});
```

## Errors

- Invalid `trustedOrigins` → throws during provider creation
- HTTP non-200 → throws with status and URL
- Missing `data-sellf-product` AND no `src` attribute → throws
- Response missing `src` → throws

## Status

This is a **proof of concept** in v0.1.0 — full integration into the standalone bundle (replacing the default config provider via Playerstack API) is on the post-MVP roadmap. Today, you wire it up manually via `setConfigProviderForElement`.
