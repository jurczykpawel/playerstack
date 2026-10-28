# @playerstack/plugin-sellf-adapter

Load Playerstack config from a [Sellf](https://sellf.app) product endpoint. Part of [Playerstack](https://github.com/jurczykpawel/playerstack).

This package is **not** included in the standalone `playerstack` bundle — install it explicitly when you want Sellf-driven embeds.

## Install

This plugin is not part of the standalone script. The `@playerstack/*` packages are not published to npm yet, so it needs a custom bundle built from this repository (see [Getting started](https://playerstack.techskills.academy/docs/getting-started/)).

## Use

```ts
// sellf-provider.ts — import it first in your entry file: import "./sellf-provider";
import { createSellfConfigProvider } from "@playerstack/plugin-sellf-adapter";
import { setConfigProviderForElement } from "@playerstack/core/element";

const provider = createSellfConfigProvider({
  baseUrl: "https://sellf.app",
  fetchOptions: { credentials: "include" }, // optional
  // Endpoints supplied by you — always win over anything the API returns.
  endpoints: {
    analytics: "https://sellf.app/track",
    emailGate: {
      webhook: "https://sellf.app/leads/submit",
      challenge: "https://sellf.app/leads/challenge",
    },
  },
});

setConfigProviderForElement(provider);

// Then on your page:
```

`@playerstack/core` defines `<player-stack>` as soon as it is imported (plugins import it too), and players already on the page start with the provider installed at that moment. Install the provider from `@playerstack/core/element` in a module that is the first import of your entry file. The hosted `playerstack.min.js` always uses the default provider; a custom provider needs a custom build (see `examples/12-sellf-integration`).

```html
<player-stack data-sellf-product="abc123"></player-stack>
```

When the element connects, the provider fetches `https://sellf.app/api/products/abc123/playerstack` and uses the JSON response as the player config.

## Config merge order

Inline attributes always override fetched config. Useful for per-page CTAs:

```html
<player-stack
  data-sellf-product="abc123"
  title="Override the title from Sellf"
></player-stack>
```

This loads everything from Sellf, but `title` is taken from the attribute.

## Endpoint contract

The Sellf endpoint must return a JSON object that conforms to `PlayerstackConfig`:

```json
{
  "src": "https://files.example.com/lesson-1.mp4",
  "poster": "https://cdn.example.com/poster.webp",
  "title": "Lesson 1",
  "controls": { "accent": "#008aff" },
  "customCss": {
    "tokens": { "--ps-accent": "#008aff", "--ps-radius": "12px" }
  },
  "ctaEnd": {
    "enabled": true,
    "button": { "label": "Next lesson", "url": "..." }
  }
}
```

`src` is required. Anything else is optional.

## What the API may and may not control

By default the adapter applies an allowlist to the API response and drops any field outside the documented contract before merging. Concretely, the API may set:

- `src`, `poster`, `title`, `crossorigin`
- `controls` (`accent`, `show`, `hide`)
- `customCss.tokens` (validated `--ps-*` CSS custom properties)
- typed plugin configs: `actionBar`, `ctaEnd`, `introCard`, `brandedThumb`, `watermark`, `analytics` (`enabled`/`debug`/`customProps`/`forwardBusEvents`), `emailGate` (validated fields below), `preview`, `autopreview`, `savedPosition`, `focusMode`, `sticky`, `chapters`, `ytSubscribe`, `twitch.parent`

The following fields are omitted by default:

- `customCss.trustedCss`, `customCss.css`, `customCss.acknowledgeTrusted` — raw CSS belongs in your codebase
- `actionBar.html`, `ctaEnd.html`, `introCard.html` — raw HTML belongs in your codebase
- `analytics.endpoint` — requires `trustedOrigins` or `SellfAdapterOptions.endpoints.analytics`
- `emailGate.webhookUrl`, `emailGate.challengeUrl` — require `trustedOrigins` or `SellfAdapterOptions.endpoints.emailGate`

Legacy passthrough for tests and internal dashboards only (`trustRemote` is deprecated; prefer `trustedOrigins`):

```ts
createSellfConfigProvider({ baseUrl: "...", trustRemote: true });
```

## Trusted origins

`trustedOrigins?: string[]` lets the API supply `emailGate.webhookUrl`, `emailGate.challengeUrl`, and `analytics.endpoint` while keeping all other normalization rules. The list is copied and validated when the provider is created, even with `trustRemote: true`. Invalid options throw immediately.

```ts
createSellfConfigProvider({
  baseUrl: "https://sellf.app",
  trustedOrigins: ["https://sellf.app", "https://leads.example.com:8443"],
});
```

Each entry must be a full HTTP(S) origin with an optional trailing slash, without a path, query, fragment, credentials, or wildcard. Origins are normalized using `new URL(value).origin`, including hostname case and default ports. Scheme and non-default port must match exactly. HTTP is accepted only when explicitly listed, for local development or an intentionally HTTP integration; prefer HTTPS in production. `baseUrl` does not implicitly trust an origin.

Remote endpoints must be absolute HTTP(S) URLs without credentials, with an origin in that list. Accepted endpoint strings retain their paths and queries. Other endpoints are omitted. An absent or empty list keeps the default behavior. Integrator `endpoints` always override remote endpoints, including those from a listed origin. Media/image URLs, CTA and watermark links, privacy/consent links, and preview settings retain their existing normalization rules.

`trustRemote` is **deprecated**, retained only for tests and internal dashboards. Prefer `trustedOrigins`. For compatibility, `trustRemote: true` still passes the entire response through unchanged, including when `trustedOrigins` is present; it does not apply the list to remote endpoints. Integrator `endpoints` still win.

## Remote email-gate fields

With the default `trustRemote: false`, unknown fields and values of the wrong type are dropped. Invalid values are omitted rather than truncated. Nested objects are copied. Text is rendered literally by email-gate.

| Field                                | Accepted remote values                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`, `dismissible`, `remember` | Booleans only.                                                                                                                                                                                                                                                                                                                                                                   |
| `at`                                 | `"before"`, `"after"`, or finite non-negative seconds.                                                                                                                                                                                                                                                                                                                           |
| `atPercent`                          | Finite number from 0 to 100.                                                                                                                                                                                                                                                                                                                                                     |
| `product`                            | String trimmed to 1–100 characters.                                                                                                                                                                                                                                                                                                                                              |
| `marketingConsent`                   | Requires nonblank `text` (up to 500 characters) and `version` (up to 64); optional boolean `required`, `linkText` (up to 200), and `href` (up to 2048). Other keys are dropped. Wording and version retain whitespace. Invalid required fields omit the entire object.                                                                                                           |
| `privacy`                            | Requires nonblank `text` (up to 500); optional `linkText` (up to 200) and `href` (up to 2048). Other keys are dropped.                                                                                                                                                                                                                                                           |
| `messages`                           | Strings up to 500 characters, only for `title`, `emailLabel`, `placeholder`, `submit`, `verifying`, `solving`, `submitting`, `success`, `invalidEmail`, `rejected`, `rateLimit`, `networkError`, `dismiss`, `consentRequired`. Blank `title`, `emailLabel`, `submit` and `dismiss` (after trim) are omitted so plugin defaults apply; nonblank values are preserved as supplied. |
| `altchaFormat`                       | `"object"` or `"base64"`.                                                                                                                                                                                                                                                                                                                                                        |
| `rememberDays`                       | Finite non-negative number; fractional days are supported.                                                                                                                                                                                                                                                                                                                       |
| `title`, `buttonLabel`               | Legacy string overrides, up to 500 characters.                                                                                                                                                                                                                                                                                                                                   |
| `storageKey`                         | String up to 200 characters.                                                                                                                                                                                                                                                                                                                                                     |

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

## License

Apache-2.0.
