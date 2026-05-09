import type { ConfigProvider, PlayerstackConfig } from "@playerstack/core";

export interface SellfAdapterOptions {
  baseUrl: string;
  fetchOptions?: RequestInit;
}

export function createSellfConfigProvider(opts: SellfAdapterOptions): ConfigProvider {
  return {
    name: "sellf",
    async load(element: HTMLElement): Promise<PlayerstackConfig> {
      const productId = element.getAttribute("data-sellf-product");
      const inline = readInlineAttrs(element);

      if (!productId) {
        if (!inline.src) {
          throw new Error('[playerstack:sellf] no data-sellf-product and no src attribute');
        }
        return inline as PlayerstackConfig;
      }

      const url = `${opts.baseUrl.replace(/\/$/, "")}/api/products/${encodeURIComponent(productId)}/playerstack`;
      const response = await fetch(url, opts.fetchOptions);
      if (!response.ok) {
        throw new Error(`[playerstack:sellf] HTTP ${response.status} from ${url}`);
      }

      const remote = (await response.json()) as Record<string, unknown>;
      const merged: Record<string, unknown> = { ...remote, ...inline };

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
