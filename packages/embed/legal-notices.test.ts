import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { spawnSync } from "child_process";
import { build } from "esbuild";
import { writeLegalNotices } from "./legal-notices";
const pluginNames = [
  "controls-policy",
  "autopreview",
  "branded-thumb",
  "email-gate",
  "saved-position",
  "action-bar",
  "chapters",
  "cta-end",
  "sticky",
  "yt-subscribe",
  "analytics",
  "watermark",
  "custom-css",
  "intro-card",
];

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

async function fixture(license?: string, spdx?: string) {
  const root = mkdtempSync(join(tmpdir(), "playerstack-notices-"));
  roots.push(root);
  const pkg = join(root, "node_modules/example");
  mkdirSync(pkg, { recursive: true });
  writeFileSync(
    join(pkg, "package.json"),
    JSON.stringify({ name: "example", version: "1.0.0", license: spdx }),
  );
  writeFileSync(join(pkg, "index.js"), 'console.log("example");');
  if (license) writeFileSync(join(pkg, "LICENSE"), license);
  writeFileSync(join(root, "entry.js"), 'import "example";');
  const result = await build({
    absWorkingDir: root,
    entryPoints: ["entry.js"],
    outfile: "bundle.js",
    bundle: true,
    metafile: true,
  });
  return { root, result };
}

describe("bundle license notices", () => {
  it("writes project notices for chunks without third-party code", async () => {
    const { root } = await fixture();
    const result = await build({
      absWorkingDir: root,
      entryPoints: ["entry.js"],
      outfile: "own.js",
      bundle: true,
      metafile: true,
      plugins: [
        {
          name: "own",
          setup(b) {
            b.onLoad({ filter: /entry\.js$/ }, () => ({ contents: 'console.log("own");' }));
          },
        },
      ],
    });
    writeLegalNotices(result.metafile!, root);
    expect(readFileSync(join(root, "own.js.LEGAL.txt"), "utf8")).toContain("Apache License");
  });
  it("includes licenses and NOTICE even when source files have no legal comments", async () => {
    const { root, result } = await fixture("Example license text");
    writeFileSync(join(root, "node_modules/example/NOTICE"), "Example attribution");
    writeLegalNotices(result.metafile!, root);
    const notice = readFileSync(join(root, "bundle.js.LEGAL.txt"), "utf8");
    expect(notice).toContain("example@1.0.0");
    expect(notice).toContain("Example license text");
    expect(notice).toContain("Example attribution");
    expect(readFileSync(join(root, "bundle.js"), "utf8")).toContain("bundle.js.LEGAL.txt");
  });

  it("fails the build if an included package has no license text or reviewed fallback", async () => {
    const { root, result } = await fixture();
    expect(() => writeLegalNotices(result.metafile!, root)).toThrow(/example@1.0.0/);
  });

  it("includes the full Apache license alongside an upstream short license notice", async () => {
    const { root, result } = await fixture("Upstream copyright notice", "Apache-2.0");
    writeLegalNotices(result.metafile!, root);
    const notice = readFileSync(join(root, "bundle.js.LEGAL.txt"), "utf8");
    expect(notice).toContain("Upstream copyright notice");
    expect(notice).toContain("TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION");
    expect(notice).toContain("END OF TERMS AND CONDITIONS");
  });
});

const standaloneFiles = ["min", "youtube", "hls", "vimeo", "wistia", "twitch"].map((name) =>
  name === "min" ? "playerstack.min.js" : `playerstack-${name}.js`,
);

standaloneFiles.push(...pluginNames.map((name) => `playerstack-plugin-${name}.js`));

describe("standalone copy", () => {
  it.each(standaloneFiles.flatMap((file) => [file, `${file}.LEGAL.txt`]))(
    "rejects a release missing %s before replacing any files",
    (missing) => {
      const root = mkdtempSync(join(tmpdir(), "playerstack-copy-"));
      roots.push(root);
      const dist = join(root, "packages/embed/dist");
      const target = join(root, "public");
      mkdirSync(dist, { recursive: true });
      mkdirSync(target);
      mkdirSync(join(root, "scripts"));
      const script = join(root, "scripts/copy-standalone.sh");
      writeFileSync(
        script,
        readFileSync(new URL("../../scripts/copy-standalone.sh", import.meta.url)),
      );
      for (const file of standaloneFiles) {
        writeFileSync(join(dist, file), "new release");
        writeFileSync(join(dist, `${file}.LEGAL.txt`), "new notices");
      }
      rmSync(join(dist, missing));
      writeFileSync(join(target, "playerstack.min.js"), "previous release");
      const result = spawnSync("bash", [script, target]);
      expect(result.status).not.toBe(0);
      expect(readFileSync(join(target, "playerstack.min.js"), "utf8")).toBe("previous release");
    },
  );
});
