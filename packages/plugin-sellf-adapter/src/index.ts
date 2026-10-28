import type { ConfigProvider, PlayerstackConfig } from "@playerstack/core";
import { normalizeRemoteConfig } from "./normalize";

export { normalizeRemoteConfig } from "./normalize";

export interface SellfAdapterEndpoints {
  /** Analytics beacon endpoint. Wired into `analytics.endpoint` after normalization. */
  analytics?: string;
  /** Lead-capture endpoints. Wired into `emailGate.webhookUrl` + `challengeUrl`. */
  emailGate?: {
    webhook: string;
    challenge: string;
  };
}

export interface SellfAdapterOptions {
  baseUrl: string;
  fetchOptions?: RequestInit;
  /**
   * Trusted endpoints supplied by the integrator. Always wins over anything
   * the remote API tries to set, so the adapter never POSTs analytics or
   * lead data to a URL it didn't pick.
   */
  endpoints?: SellfAdapterEndpoints;
  /** Exact HTTP(S) origins allowed for remote lead and analytics endpoints. */
  trustedOrigins?: string[];
  /**
   * @deprecated Use trustedOrigins. Retained for tests and internal dashboards.
   * Disable the remote-config allowlist and pass the API response through
   * unchanged. Only use when the API and adapter run inside the same trust
   * boundary (internal dashboard, integration tests). Default: `false`.
   */
  trustRemote?: boolean;
}

export function createSellfConfigProvider(opts: SellfAdapterOptions): ConfigProvider {
  const trustedOrigins = validateTrustedOrigins(opts.trustedOrigins);
  return {
    name: "sellf",
    async load(element: HTMLElement): Promise<PlayerstackConfig> {
      const productId = element.getAttribute("data-sellf-product");
      const inline = readInlineAttrs(element);

      if (!productId) {
        if (!inline.src) {
          throw new Error("[playerstack:sellf] no data-sellf-product and no src attribute");
        }
        return inline as PlayerstackConfig;
      }

      const url = `${opts.baseUrl.replace(/\/$/, "")}/api/products/${encodeURIComponent(productId)}/playerstack`;
      const response = await fetch(url, opts.fetchOptions);
      if (!response.ok) {
        throw new Error(`[playerstack:sellf] HTTP ${response.status} from ${url}`);
      }

      const raw = (await response.json()) as unknown;
      const remote: Partial<PlayerstackConfig> = opts.trustRemote
        ? (raw as Partial<PlayerstackConfig>)
        : normalizeRemoteConfig(raw, trustedOrigins);

      // Adapter-supplied endpoints always win over anything remote sent.
      const withEndpoints = applyEndpoints(remote, opts.endpoints);

      // Inline DOM attributes win over remote — they're authored at integration
      // time, not pulled from the API.
      const merged: Record<string, unknown> = { ...withEndpoints, ...inline };

      if (typeof merged.src !== "string" || merged.src.length === 0) {
        throw new Error('[playerstack:sellf] response is missing required "src"');
      }

      return merged as PlayerstackConfig;
    },
  };
}

function readInlineAttrs(element: HTMLElement): Partial<PlayerstackConfig> {
  const result: Partial<PlayerstackConfig> = {};
  const src = element.getAttribute("src");
  const poster = element.getAttribute("poster");
  const title = element.getAttribute("title");
  if (src !== null) result.src = src;
  if (poster !== null) result.poster = poster;
  if (title !== null) result.title = title;
  return result;
}

function applyEndpoints(
  cfg: Partial<PlayerstackConfig>,
  endpoints: SellfAdapterEndpoints | undefined,
): Partial<PlayerstackConfig> {
  if (!endpoints) return cfg;
  const out: Record<string, unknown> = { ...cfg };

  if (endpoints.analytics) {
    const current =
      typeof out.analytics === "object" && out.analytics !== null && !Array.isArray(out.analytics)
        ? (out.analytics as Record<string, unknown>)
        : {};
    out.analytics = { ...current, endpoint: endpoints.analytics };
  }

  if (endpoints.emailGate) {
    const current =
      typeof out.emailGate === "object" && out.emailGate !== null && !Array.isArray(out.emailGate)
        ? (out.emailGate as Record<string, unknown>)
        : {};
    out.emailGate = {
      ...current,
      webhookUrl: endpoints.emailGate.webhook,
      challengeUrl: endpoints.emailGate.challenge,
    };
  }

  return out as Partial<PlayerstackConfig>;
}

function validateTrustedOrigins(values: string[] | undefined): ReadonlySet<string> {
  const origins = new Set<string>();
  if (values === undefined) return origins;
  if (!Array.isArray(values)) {
    throw new Error("[playerstack:sellf] trustedOrigins must be an array of HTTP(S) origins");
  }
  for (const value of values) {
    try {
      if (typeof value !== "string" || !/^https?:\/\/[^/?#]+\/?$/i.test(value)) throw new Error();
      const url = new URL(value);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        value.includes("@") ||
        url.hostname.includes("*") ||
        url.pathname !== "/" ||
        url.search ||
        url.hash ||
        value.includes("\\") ||
        /\s/.test(value)
      )
        throw new Error();
      origins.add(url.origin);
    } catch {
      throw new Error(
        "[playerstack:sellf] trustedOrigins entries must be exact HTTP(S) origins without paths, queries, fragments, credentials or wildcards",
      );
    }
  }
  return origins;
}
