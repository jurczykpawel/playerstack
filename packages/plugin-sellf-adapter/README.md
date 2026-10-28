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

The API may **not** set:

- `customCss.trustedCss`, `customCss.css`, `customCss.acknowledgeTrusted` — raw CSS belongs in your codebase
- `actionBar.html`, `ctaEnd.html`, `introCard.html` — raw HTML belongs in your codebase
- `analytics.endpoint` — supplied via `SellfAdapterOptions.endpoints.analytics`
- `emailGate.webhookUrl`, `emailGate.challengeUrl` — supplied via `SellfAdapterOptions.endpoints.emailGate`

If you genuinely want the API to control all of it (private dashboard, fully trusted environment), opt out:

```ts
createSellfConfigProvider({ baseUrl: "...", trustRemote: true });
```

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

Links use the same HTTP(S) protocol check as email-gate, resolving relative URLs against `document.baseURI`. Both `href` and `linkText` are needed to render a link. The product and consent limits come from email-gate; the remaining text/URL limits are adapter limits for remote configuration. Empty message strings are allowed, as in email-gate. Lengths use JavaScript string length.

`webhookUrl` and `challengeUrl` from the API are always omitted under the default allowlist. Supply them through `SellfAdapterOptions.endpoints.emailGate` as `webhook` and `challenge`. Without these options the gate runs in open mode and emits an event without a network submission. `trustRemote: true` explicitly disables normalization; integrator endpoint options still take precedence.

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

- HTTP non-200 → throws with status and URL
- Missing `data-sellf-product` AND no `src` attribute → throws
- Response missing `src` → throws

## License

Apache-2.0.
