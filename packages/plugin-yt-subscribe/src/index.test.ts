import { afterEach, describe, expect, it } from "vitest";
import { ytSubscribePlugin } from "./index";
import { createEventBus } from "@playerstack/core";
import type { PlayerstackContext, PlayerstackConfig } from "@playerstack/core";

function makeContext(extra: Partial<PlayerstackConfig> = {}): PlayerstackContext {
  const wrapper = document.createElement("div");
  document.body.appendChild(wrapper);
  const container = document.createElement("div");
  wrapper.appendChild(container);
  const mediaPlayer = document.createElement("media-player");
  container.appendChild(mediaPlayer);
  return {
    events: createEventBus(),
    container,
    mediaPlayer,
    config: { src: "https://youtu.be/dQw4w9WgXcQ", ...extra },
  } as PlayerstackContext;
}

function findBar(ctx: PlayerstackContext): HTMLElement | null {
  return (
    ctx.container.parentElement?.querySelector<HTMLElement>(".playerstack-yt-subscribe") ?? null
  );
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ytSubscribePlugin", () => {
  it("has a stable name", () => {
    expect(ytSubscribePlugin.name).toBe("yt-subscribe");
  });

  it("does nothing when not enabled", async () => {
    const ctx = makeContext();
    await ytSubscribePlugin.init(ctx);
    expect(findBar(ctx)).toBeNull();
  });

  it("mounts the bar AFTER <player-stack> as a sibling, NOT inside the container", async () => {
    // Container has overflow:hidden + aspect-ratio:16/9 default styles, so a
    // bar mounted inside is clipped out of view. Sibling mount keeps it visible
    // below the player.
    const ctx = makeContext({ ytSubscribe: { enabled: true, channelId: "UCABC" } });
    await ytSubscribePlugin.init(ctx);
    expect(ctx.container.querySelector(".playerstack-yt-subscribe")).toBeNull();
    expect(ctx.container.nextElementSibling?.classList.contains("playerstack-yt-subscribe")).toBe(
      true,
    );
  });

  it("renders a subscribe link with channelId in URL", async () => {
    const ctx = makeContext({
      ytSubscribe: { enabled: true, channelId: "UCABCDEFG" },
    });
    await ytSubscribePlugin.init(ctx);
    const link = findBar(ctx)!.querySelector(
      "a.playerstack-yt-subscribe-link",
    ) as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.href).toContain("UCABCDEFG");
    expect(link.href).toContain("youtube.com");
  });

  it("uses channelHandle when provided (URL form @channelHandle)", async () => {
    const ctx = makeContext({
      ytSubscribe: { enabled: true, channelHandle: "RickAstleyVEVO" },
    });
    await ytSubscribePlugin.init(ctx);
    const link = findBar(ctx)!.querySelector(
      "a.playerstack-yt-subscribe-link",
    ) as HTMLAnchorElement;
    expect(link.href).toContain("@RickAstleyVEVO");
  });

  it("opens subscription confirm prompt with sub_confirmation=1 when channelId is set", async () => {
    const ctx = makeContext({
      ytSubscribe: { enabled: true, channelId: "UCABC" },
    });
    await ytSubscribePlugin.init(ctx);
    const link = findBar(ctx)!.querySelector(
      "a.playerstack-yt-subscribe-link",
    ) as HTMLAnchorElement;
    expect(link.href).toContain("sub_confirmation=1");
    expect(link.target).toBe("_blank");
  });

  it("renders a custom label when provided", async () => {
    const ctx = makeContext({
      ytSubscribe: { enabled: true, channelId: "UCABC", label: "Subscribe to my channel" },
    });
    await ytSubscribePlugin.init(ctx);
    const link = findBar(ctx)!.querySelector("a.playerstack-yt-subscribe-link");
    expect(link?.textContent).toContain("Subscribe to my channel");
  });

  it("destroy removes the bar", async () => {
    const ctx = makeContext({
      ytSubscribe: { enabled: true, channelId: "UCABC" },
    });
    await ytSubscribePlugin.init(ctx);
    ytSubscribePlugin.destroy?.(ctx);
    expect(findBar(ctx)).toBeNull();
  });

  it("requires either channelId or channelHandle (no-op without either)", async () => {
    const ctx = makeContext({ ytSubscribe: { enabled: true } });
    await ytSubscribePlugin.init(ctx);
    expect(findBar(ctx)).toBeNull();
  });
});
