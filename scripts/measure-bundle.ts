// Per-scenario download size of the standalone script: what a page with one
// player of each source type fetches from playerstack.techskills.academy.
// Usage: bun scripts/measure-bundle.ts [baseline.min.js]
//   baseline: a previous playerstack.min.js, with its provider files alongside it.
import { existsSync, readFileSync, readdirSync } from "fs";
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

const provider = (name: string) => {
  const file = readdirSync(dist).find((f) => new RegExp(`^playerstack-${name}\\.js$`).test(f));
  if (!file) throw new Error(`missing provider file for ${name} in ${dist}`);
  return join(dist, file);
};

const core = join(dist, "playerstack.min.js");
const scenarios: Record<string, string[]> = {
  "core only": [core],
  MP4: [core],
  YouTube: [core, provider("youtube")],
  HLS: [core, provider("hls")],
  Vimeo: [core, provider("vimeo")],
  Wistia: [core, provider("wistia")],
  Twitch: [core, provider("twitch")],
};

const kib = (n: number) => (n / 1024).toFixed(1);
console.log("| scenario | before gzip | before brotli | after raw | after gzip | after brotli |");
console.log("|---|---:|---:|---:|---:|---:|");
for (const [name, files] of Object.entries(scenarios)) {
  const after = sizes(files);
  const oldProvider = baseline && join(dirname(baseline), `playerstack-${name.toLowerCase()}.js`);
  const before = baseline
    ? sizes([baseline, ...(oldProvider && existsSync(oldProvider) ? [oldProvider] : [])])
    : null;
  console.log(
    `| ${name} | ${before ? kib(before.gzip) : "-"} | ${before ? kib(before.brotli) : "-"} | ${kib(after.raw)} | ${kib(after.gzip)} | ${kib(after.brotli)} |`,
  );
}
console.log(
  `\nKiB = 1024 bytes; ${runtime} zlib: gzip level 9, Brotli quality 11 (gzip bytes differ by about 0.4% between runtimes).`,
);
