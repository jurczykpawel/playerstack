import { build, type Plugin } from "esbuild";
import { gzipSync } from "zlib";
import { createHash } from "crypto";
import { readFileSync, readdirSync, rmSync, mkdirSync } from "fs";
import { join, dirname, basename } from "path";
import { LAZY_MEDIA_ELEMENT_TAGS } from "../core/src/providers";
import { writeLegalNotices } from "./legal-notices";
import { LAZY_PLUGINS } from "./plugin-manifest";

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
  metafile: true,
} as const;

const esmResult = await build({
  ...common,
  format: "esm",
  outfile: join(outdir, "playerstack.esm.js"),
});
writeLegalNotices(esmResult.metafile!, process.cwd());

const cjsResult = await build({
  ...common,
  format: "cjs",
  outfile: join(outdir, "playerstack.cjs"),
});
writeLegalNotices(cjsResult.metafile!, process.cwd());

// Standalone: every provider except native <video> becomes a separate IIFE
// file next to playerstack.min.js. File names stay the same across
// releases, because the CDN may keep an old playerstack.min.js in browser
// caches for a long time and every deploy replaces all files: a hashed name
// would 404 for that cached script after the next release. The manifest adds
// `?v=<content hash>` so a new main script never reuses a stale cached provider.
const PROVIDERS = {
  "youtube-video": { name: "youtube", pkg: "youtube-video-element" },
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
writeLegalNotices(providerResult.metafile, process.cwd());

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

// Optional email features use stable sibling filenames, like providers.
const emailChunks: Record<string, string> = {};
for (const [module, name] of [
  ["hardened", "hardened"],
  ["optional-fields", "fields"],
]) {
  const file = `playerstack-email-gate-${name}.js`;
  const result = await build({
    bundle: true,
    target: "es2020",
    format: "esm",
    minify: true,
    sourcemap: true,
    legalComments: "linked",
    entryPoints: [join(root, `../plugin-email-gate/src/${module}.ts`)],
    outfile: join(outdir, file),
    metafile: true,
  });
  writeLegalNotices(result.metafile, process.cwd());
  const version = createHash("sha256")
    .update(readFileSync(join(outdir, file)))
    .digest("hex")
    .slice(0, 8);
  emailChunks[module!] = `${file}?v=${version}`;
}

const pluginEntries: Plugin = {
  name: "plugin-entries",
  setup(b) {
    b.onResolve({ filter: /\/load-(hardened|optional-fields)$/ }, (args) => ({
      path: args.path.split("/load-")[1]!,
      namespace: "email-loader",
    }));
    b.onLoad({ filter: /.*/, namespace: "email-loader" }, (args) => ({
      contents: `import { createModuleLoader } from "./src/module-imports";
        const base = document.currentScript.src;
        export const ${args.path === "hardened" ? "loadHardened" : "loadOptionalFields"} = createModuleLoader(base, ${JSON.stringify(emailChunks[args.path])});`,
      resolveDir: root,
    }));
    b.onResolve({ filter: /^plugin:/ }, (args) => ({
      path: args.path.slice(7),
      namespace: "plugin",
    }));
    b.onResolve({ filter: /^@playerstack\/core$/ }, () => ({
      path: join(coreDir, "src/plugin-helpers.ts"),
    }));
    b.onLoad({ filter: /.*/, namespace: "plugin" }, (args) => {
      const entry = LAZY_PLUGINS.find((entry) => entry.name === args.path)!;
      return {
        contents: `import { ${entry.exportName} } from "@playerstack/plugin-${entry.name}"; import { registerPlugin } from "./src/plugin-modules"; registerPlugin(${entry.exportName});`,
        resolveDir: root,
      };
    });
  },
};
const pluginResult = await build({
  bundle: true,
  target: "es2020",
  format: "iife",
  minify: true,
  sourcemap: true,
  legalComments: "linked",
  entryPoints: Object.fromEntries(LAZY_PLUGINS.map(({ name }) => [name, `plugin:${name}`])),
  entryNames: "playerstack-plugin-[name]",
  outdir,
  metafile: true,
  plugins: [pluginEntries],
});
writeLegalNotices(pluginResult.metafile, process.cwd());
const engineCopies = Object.keys(pluginResult.metafile.inputs).filter(
  (input) =>
    input.includes("media-chrome") ||
    (input.includes("core/src/") &&
      !["safe-html.ts", "overlay.ts", "plugin-helpers.ts"].some((file) => input.endsWith(file))),
);
if (engineCopies.length)
  throw new Error(`plugin files must not duplicate the engine: ${engineCopies.join(", ")}`);
const pluginFiles: Record<string, string> = {};
for (const { name } of LAZY_PLUGINS) {
  const file = `playerstack-plugin-${name}.js`;
  const version = createHash("sha256")
    .update(readFileSync(join(outdir, file)))
    .digest("hex")
    .slice(0, 8);
  pluginFiles[name] = `${file}?v=${version}`;
}

const standaloneImporter: Plugin = {
  name: "standalone-provider-imports",
  setup(b) {
    b.onResolve({ filter: /\/provider-imports$/ }, () => ({
      path: join(root, "src/standalone-provider-imports.ts"),
    }));
  },
};

const standaloneResult = await build({
  ...common,
  entryPoints: [join(root, "src/standalone.ts")],
  format: "iife",
  globalName: "Playerstack",
  outfile: join(outdir, "playerstack.min.js"),
  minify: true,
  define: {
    __PLAYERSTACK_PROVIDER_FILES__: JSON.stringify(providerFiles),
    __PLAYERSTACK_PLUGIN_FILES__: JSON.stringify(pluginFiles),
  },
  plugins: [standaloneImporter],
});
writeLegalNotices(standaloneResult.metafile!, process.cwd());

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
