// Usage: bun scripts/measure-bundle.ts [baseline.min.js]
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { gzipSync, brotliCompressSync, constants } from "zlib";

const runtime = typeof Bun === "undefined" ? `Node ${process.version}` : `Bun ${Bun.version}`;
const dist = join(import.meta.dirname, "../packages/embed/dist");
const baseline = process.argv[2];

const sizes = (paths: string[]) =>
  paths
    .map((p) => readFileSync(p))
    .reduce(
      (acc, buf) => ({
        raw: acc.raw + buf.length,
        gzip: acc.gzip + gzipSync(buf, { level: 9 }).length,
        brotli:
          acc.brotli +
          brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
      }),
      { raw: 0, gzip: 0, brotli: 0 },
    );

const scenarios: Record<string, string[]> = {
  "core only": [],
  MP4: [],
  "MP4 + CTA + branded thumb": ["plugin-cta-end", "plugin-branded-thumb"],
  "MP4 + foundation config": [
    "plugin-controls-policy",
    "plugin-cta-end",
    "plugin-branded-thumb",
    "plugin-custom-css",
  ],
  YouTube: ["youtube"],
  HLS: ["hls"],
  Vimeo: ["vimeo"],
  Wistia: ["wistia"],
  Twitch: ["twitch"],
};

const kib = (n: number) => (n / 1024).toFixed(1);
console.log("| scenario | before gzip | before brotli | after raw | after gzip | after brotli |");
console.log("|---|---:|---:|---:|---:|---:|");
for (const [name, chunks] of Object.entries(scenarios)) {
  const files = chunks.map((chunk) => `playerstack-${chunk}.js`);
  const after = sizes([join(dist, "playerstack.min.js"), ...files.map((f) => join(dist, f))]);
  const before = baseline
    ? sizes([baseline, ...files.map((f) => join(dirname(baseline), f)).filter(existsSync)])
    : null;
  console.log(
    `| ${name} | ${before ? kib(before.gzip) : "-"} | ${before ? kib(before.brotli) : "-"} | ${kib(after.raw)} | ${kib(after.gzip)} | ${kib(after.brotli)} |`,
  );
}
console.log(
  `\nKiB = 1024 bytes; ${runtime} zlib: gzip level 9, Brotli quality 11. Totals sum each independently compressed JS file, excluding maps, notices, HTTP headers and media. Baseline includes each sibling chunk when present; older monolithic builds already contain plugin code.`,
);
