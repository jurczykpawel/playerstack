import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

it("ships hardened separately and keeps the open email configuration within its measured budget", () => {
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
  // 2026-11-26, media-chrome 4.19.5: 51,872 B with email-gate, 48,088 B without it
  // (Bun 1.4.5, each file compressed separately, gzip level 9). See AGENTS.md rule 4.
  // 2026-11-27, config.hls (+16 B, same method): 51,887 B / 48,103 B; the second limit is
  // rounded up to the next 100 B.
  // 2026-11-27, lazy switch for the cta-end modes behind at/atPercent/frequency (+131 B:
  // cta-end +144, main -3, email-gate -10; Bun 1.4.5, same method): 52,026 B / 48,252 B,
  // limits rounded up to the next 100 B.
  // 2026-11-28, config.hls limited to number/boolean options (+42 B in playerstack.min.js,
  // Bun 1.4.5, same method): 52,067 B / 48,293 B, limits unchanged.
  // 2026-11-28, native HLS on Apple WebKit without hls.js (+71 B in playerstack.min.js,
  // Bun 1.4.5, same method; saves 166,349 B gzip per Safari/iOS HLS page): 52,138 B /
  // 48,364 B, limits rounded up to the next 100 B.
  // 2026-11-28, canonical Wistia URLs (#36, +36 B in playerstack.min.js): 52,174 B / 48,400 B.
  // 2026-11-28, data-provider-base for renamed/inlined copies (+40 B in playerstack.min.js,
  // Bun 1.4.5, same method): 52,214 B / 48,440 B, limits rounded up to the next 100 B.
  expect(sizes.reduce((sum, size) => sum + size, 0)).toBeLessThanOrEqual(52300);
  expect(sizes.slice(0, -1).reduce((sum, size) => sum + size, 0)).toBeLessThanOrEqual(48500);
  // The card modes behind ctaEnd.at/atPercent/frequency ship separately.
  const timed = "playerstack-cta-end-timed.js";
  expect(sources(timed).some((source) => source.endsWith("timed.ts"))).toBe(true);
  expect(
    sources("playerstack-plugin-cta-end.js").some((source) => source.endsWith("src/timed.ts")),
  ).toBe(false);
  expect(readFileSync(join(dist, "playerstack-plugin-cta-end.js"), "utf8")).toMatch(
    /playerstack-cta-end-timed\.js\?v=[a-f0-9]{8}/,
  );
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
