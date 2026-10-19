import { build, type Plugin } from "esbuild";
import { gzipSync } from "zlib";
import { readFileSync, readdirSync, rmSync, mkdirSync } from "fs";
import { join, dirname, basename } from "path";

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
// IIFE files next to playerstack.min.js, named by content hash so a cached
// main script never pairs with a different provider build.
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
  entryNames: "playerstack-[name].[hash]",
  outdir,
  metafile: true,
  plugins: [providerEntries],
});

const providerFiles: Record<string, string> = {};
for (const [file, meta] of Object.entries(providerResult.metafile.outputs)) {
  if (!file.endsWith(".js") || !meta.entryPoint) continue;
  const pkg = meta.entryPoint.replace(/^provider:/, "");
  const tag = Object.entries(PROVIDERS).find(([, p]) => p.pkg === pkg)?.[0];
  if (tag) providerFiles[tag] = basename(file);
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
