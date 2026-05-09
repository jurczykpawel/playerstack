export interface PlayerstackConfig {
  src: string;
  poster?: string;
  title?: string;
  [key: string]: unknown;
}

export interface ConfigProvider {
  readonly name: string;
  load(element: HTMLElement): Promise<PlayerstackConfig>;
}

export function createInlineConfigProvider(): ConfigProvider {
  return {
    name: "inline",
    async load(element: HTMLElement): Promise<PlayerstackConfig> {
      const fromAttrs = readAttributes(element);
      const fromJson = readDataConfigJson(element);
      const merged = { ...fromAttrs, ...fromJson };

      if (typeof merged.src !== "string" || merged.src.length === 0) {
        throw new Error(
          '[playerstack] missing required "src" — set <player-stack src="..."> or include "src" in data-config',
        );
      }

      return merged as PlayerstackConfig;
    },
  };
}

function readAttributes(element: HTMLElement): Partial<PlayerstackConfig> {
  const result: Partial<PlayerstackConfig> = {};
  const src = element.getAttribute("src");
  const poster = element.getAttribute("poster");
  const title = element.getAttribute("title");
  if (src !== null) result.src = src;
  if (poster !== null) result.poster = poster;
  if (title !== null) result.title = title;
  return result;
}

function readDataConfigJson(element: HTMLElement): Partial<PlayerstackConfig> {
  const raw = element.getAttribute("data-config");
  if (raw === null || raw.trim() === "") return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`[playerstack] failed to parse data-config JSON: ${(err as Error).message}`);
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("[playerstack] data-config must be a JSON object");
  }

  return parsed as Partial<PlayerstackConfig>;
}
