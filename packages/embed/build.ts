import { build, type Plugin } from "esbuild";
import { gzipSync } from "zlib";
import { createHash } from "crypto";
import { readFileSync, readdirSync, rmSync, mkdirSync } from "fs";
import { join, dirname, basename } from "path";
import { LAZY_MEDIA_ELEMENT_TAGS } from "../core/src/providers";

const root = dirname(new URL(import.meta.url).pathname);
const outdir = join(root, "dist");
const coreDir = join(root, "../core");
rmSync(outdir, { recursive: true, force: true });
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

// Standalone: providers that are not needed for YouTube/MP4 become separate
// IIFE files next to playerstack.min.js. File names stay the same across
// releases, because the CDN may keep an old playerstack.min.js in browser
// caches for a long time and every deploy replaces all files: a hashed name
// would 404 for that cached script after the next release. The manifest adds
// `?v=<content hash>` so a new main script never reuses a stale cached provider.
const PROVIDERS = {
  "hls-video": { name: "hls", pkg: "hls-video-element" },
  "vimeo-video": { name: "vimeo", pkg: "vimeo-video-element" },
  "wistia-video": { name: "wistia", pkg: "wistia-video-element" },
  "twitch-video": { name: "twitch", pkg: "twitch-video-element" },
} as const;

const providerEntries: Plugin = {
  name: "provider-entries",
  setup(b) {
    b.onResolve({ filter: /^provider:/ }, (args) => ({
      path: args.path.slice("provider:".length),
      namespace: "provider",
    }));
    b.onLoad({ filter: /.*/, namespace: "provider" }, (args) => ({
      contents: `import "${args.path}";`,
      resolveDir: coreDir,
    }));
  },
};

const providerResult = await build({
  bundle: true,
  target: "es2020",
  format: "iife",
  minify: true,
  sourcemap: true,
  legalComments: "linked",
  entryPoints: Object.fromEntries(
    Object.values(PROVIDERS).map(({ name, pkg }) => [name, `provider:${pkg}`]),
  ),
  entryNames: "playerstack-[name]",
  outdir,
  metafile: true,
  plugins: [providerEntries],
});

// Contract: a provider file only registers its custom element. It must not
// bundle Playerstack code, because a main script cached for up to a year
// loads whatever provider file the latest release ships.
const ownCode = Object.keys(providerResult.metafile.inputs).filter(
  (input) => !input.includes("node_modules") && !input.startsWith("provider:"),
);
if (ownCode.length > 0) {
  throw new Error(`provider bundles must not include Playerstack code: ${ownCode.join(", ")}`);
}

const providerFiles: Record<string, string> = {};
for (const [file, meta] of Object.entries(providerResult.metafile.outputs)) {
  if (!file.endsWith(".js") || !meta.entryPoint) continue;
  const pkg = meta.entryPoint.replace(/^provider:/, "");
  const tag = Object.entries(PROVIDERS).find(([, p]) => p.pkg === pkg)?.[0];
  if (!tag) continue;
  const version = createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 8);
  providerFiles[tag] = `${basename(file)}?v=${version}`;
}

// A main script cached for up to a year may request any of these files, so
// every release must ship all of them.
const missing = LAZY_MEDIA_ELEMENT_TAGS.filter((tag) => !providerFiles[tag]);
if (missing.length > 0) {
  throw new Error(`provider files missing for: ${missing.join(", ")}`);
}

const standaloneImporter: Plugin = {
  name: "standalone-provider-imports",
  setup(b) {
    b.onResolve({ filter: /\/provider-imports$/ }, () => ({
      path: join(root, "src/standalone-provider-imports.ts"),
    }));
  },
};

await build({
  ...common,
  format: "iife",
  globalName: "Playerstack",
  outfile: join(outdir, "playerstack.min.js"),
  minify: true,
  define: { __PLAYERSTACK_PROVIDER_FILES__: JSON.stringify(providerFiles) },
  plugins: [standaloneImporter],
});

const kb = (n: number) => (n / 1024).toFixed(1);
console.log(`[playerstack] build OK`);
for (const file of readdirSync(outdir).filter(
  (f) => /^playerstack.*\.js$/.test(f) && !f.includes(".esm."),
)) {
  const raw = readFileSync(join(outdir, file));
  console.log(
    `  ${file.padEnd(36)} raw ${kb(raw.length).padStart(6)} KB  gzip ${kb(gzipSync(raw).length).padStart(6)} KB`,
  );
}

const core = gzipSync(readFileSync(join(outdir, "playerstack.min.js")));
const TARGET_KB = 50;
if (core.length / 1024 > TARGET_KB) {
  console.warn(`  warning: core gzip size ${kb(core.length)} KB exceeds ${TARGET_KB} KB target`);
}
