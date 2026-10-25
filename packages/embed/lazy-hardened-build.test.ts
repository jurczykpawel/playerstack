import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

it("ships hardened separately and keeps the open email configuration within 50 KiB", () => {
  execFileSync("bun", ["build.ts"], { cwd: import.meta.dirname, stdio: "pipe" });
  const dist = join(import.meta.dirname, "dist");
  const hardened = "playerstack-email-gate-hardened.js";
  expect(existsSync(join(dist, hardened))).toBe(true);
  const sources = (file: string) =>
    JSON.parse(readFileSync(join(dist, `${file}.map`), "utf8")).sources as string[];
  expect(
    sources("playerstack-plugin-email-gate.js").some((source) => source.includes("altcha-lib")),
  ).toBe(false);
  expect(sources(hardened).some((source) => source.includes("altcha-lib"))).toBe(true);
  const files = [
    "playerstack.min.js",
    "playerstack-plugin-controls-policy.js",
    "playerstack-plugin-cta-end.js",
    "playerstack-plugin-branded-thumb.js",
    "playerstack-plugin-email-gate.js",
  ];
  const sizes: number[] = JSON.parse(
    execFileSync(
      "bun",
      [
        "-e",
        `import {gzipSync} from "node:zlib"; import {readFileSync} from "node:fs"; console.log(JSON.stringify(${JSON.stringify(files.map((file) => join(dist, file)))}.map((file) => gzipSync(readFileSync(file), {level: 9}).length)));`,
      ],
      { encoding: "utf8" },
    ),
  );
  expect(sizes.reduce((sum, size) => sum + size, 0)).toBeLessThanOrEqual(50 * 1024);
  // Baseline 97790f0, Bun 1.4.4, independently compressed gzip level 9.
  expect(sizes.slice(0, -1).reduce((sum, size) => sum + size, 0)).toBeLessThanOrEqual(47414);
  const fields = "playerstack-email-gate-fields.js";
  expect(sources(fields).some((source) => source.includes("altcha-lib"))).toBe(false);
  expect(
    sources("playerstack-plugin-email-gate.js").some((source) =>
      source.endsWith("optional-fields.ts"),
    ),
  ).toBe(false);
  const plugin = readFileSync(join(dist, "playerstack-plugin-email-gate.js"), "utf8");
  expect(plugin).toMatch(/playerstack-email-gate-hardened\.js\?v=[a-f0-9]{8}/);
  expect(
    readFileSync(join(import.meta.dirname, "../../scripts/copy-standalone.sh"), "utf8"),
  ).toContain(hardened);
}, 30000);
