import { expect, it, vi } from "vitest";
import { createModuleLoader } from "./module-imports";

it("loads a versioned sibling only on demand, shares pending work and reuses success", async () => {
  const module = {} as typeof import("../../plugin-email-gate/src/hardened");
  const importer = vi.fn().mockResolvedValue(module);
  const load = createModuleLoader(
    "https://cdn.example/assets/playerstack-plugin-email-gate.js?v=old",
    "playerstack-email-gate-hardened.js?v=12345678",
    importer,
  );
  expect(importer).not.toHaveBeenCalled();
  const a = load();
  const b = load();
  expect(await a).toBe(module);
  expect(await b).toBe(module);
  expect(await load()).toBe(module);
  expect(importer).toHaveBeenCalledOnce();
  expect(importer).toHaveBeenCalledWith(
    "https://cdn.example/assets/playerstack-email-gate-hardened.js?v=12345678",
  );
});
it("retries a failed module download with a fresh URL to bypass the browser module failure cache", async () => {
  const module = {} as typeof import("../../plugin-email-gate/src/hardened");
  const importer = vi.fn().mockRejectedValueOnce(new Error("404")).mockResolvedValueOnce(module);
  const load = createModuleLoader(
    "https://cdn.example/playerstack-plugin-email-gate.js",
    "playerstack-email-gate-hardened.js?v=12345678",
    importer,
  );
  await expect(load()).rejects.toThrow("404");
  expect(await load()).toBe(module);
  expect(importer.mock.calls.map(([url]) => url)).toEqual([
    "https://cdn.example/playerstack-email-gate-hardened.js?v=12345678",
    "https://cdn.example/playerstack-email-gate-hardened.js?v=12345678&retry=1",
  ]);
});
