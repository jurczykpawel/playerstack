import { build } from "esbuild";
import { gzipSync } from "zlib";
import { readFileSync, statSync, mkdirSync } from "fs";
import { join, dirname } from "path";

const root = dirname(new URL(import.meta.url).pathname);
const outdir = join(root, "dist");
mkdirSync(outdir, { recursive: true });

const common = {
  bundle: true,
  entryPoints: [join(root, "src/index.ts")],
  target: "es2020",
  sourcemap: true,
  legalComments: "linked",
} as const;

await build({
  ...common,
  format: "esm",
  outfile: join(outdir, "playerstack.esm.js"),
});

await build({
  ...common,
  format: "cjs",
  outfile: join(outdir, "playerstack.cjs"),
});

await build({
  ...common,
  format: "iife",
  globalName: "Playerstack",
  outfile: join(outdir, "playerstack.min.js"),
  minify: true,
});

const minPath = join(outdir, "playerstack.min.js");
const raw = readFileSync(minPath);
const gz = gzipSync(raw);
const sizeKb = (raw.length / 1024).toFixed(1);
const gzKb = (gz.length / 1024).toFixed(1);

console.log(`[playerstack] build OK`);
console.log(`  ${minPath}`);
console.log(`  raw:    ${sizeKb} KB`);
console.log(`  gzip:   ${gzKb} KB`);

const TARGET_KB = 50;
if (gz.length / 1024 > TARGET_KB) {
  console.warn(`  warning: gzip size ${gzKb} KB exceeds ${TARGET_KB} KB target`);
}

void statSync;
