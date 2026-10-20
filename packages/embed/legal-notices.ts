import type { Metafile } from "esbuild";
import { appendFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { basename, dirname, join, resolve } from "path";

// These exact releases declare MIT but omit LICENSE from their npm archives.
const mediaElements = new Set([
  "youtube-video-element@1.9.0",
  "vimeo-video-element@1.7.2",
  "hls-video-element@1.5.11",
  "wistia-video-element@1.4.0",
  "twitch-video-element@0.2.0",
  "custom-media-element@1.4.6",
  "super-media-element@1.4.2",
  "media-tracks@0.3.5",
  "media-played-ranges-mixin@0.1.0",
]);

function packageNotice(input: string): { id: string; text: string } {
  let dir = dirname(input);
  while (dirname(dir) !== dir) {
    const manifest = join(dir, "package.json");
    if (existsSync(manifest)) {
      const pkg = JSON.parse(readFileSync(manifest, "utf8"));
      if (pkg.name && pkg.version) {
        const id = `${pkg.name}@${pkg.version}`;
        const files = readdirSync(dir).filter((file) =>
          /^(licen[sc]e|copying|notice)(\.(txt|md))?$/i.test(file),
        );
        const hasLicense = files.some((file) => /^(licen[sc]e|copying)/i.test(file));
        const texts = files
          .sort()
          .map((file) => `${file}:\n${readFileSync(join(dir, file), "utf8")}`);
        if (!hasLicense) {
          if (!mediaElements.has(id) || pkg.license !== "MIT") {
            throw new Error(`Missing license text for ${id}`);
          }
          texts.unshift(
            "MIT (declared in upstream package.json; npm archive has no LICENSE file).",
            readFileSync(new URL("./licenses/media-elements-MIT.txt", import.meta.url), "utf8"),
          );
        }
        if (pkg.license === "Apache-2.0") {
          texts.push(readFileSync(new URL("./licenses/Apache-2.0.txt", import.meta.url), "utf8"));
        }
        return {
          id,
          text: [
            id,
            `License: ${pkg.license ?? "see license text"}`,
            `Author: ${typeof pkg.author === "object" ? pkg.author.name : (pkg.author ?? "see license text")}`,
            `Source: ${typeof pkg.repository === "object" ? pkg.repository.url : (pkg.repository ?? pkg.homepage ?? "see license text")}`,
            ...texts,
          ].join("\n\n"),
        };
      }
    }
    dir = dirname(dir);
  }
  throw new Error(`No package manifest for bundled dependency: ${input}`);
}

export function writeLegalNotices(metafile: Metafile, workingDir: string): void {
  const cache = new Map<string, ReturnType<typeof packageNotice>>();
  for (const [output, meta] of Object.entries(metafile.outputs)) {
    if (!/\.(js|cjs)$/.test(output)) continue;
    const notices = new Map<string, string>();
    for (const [input, contribution] of Object.entries(meta.inputs)) {
      if (!input.includes("node_modules/") || contribution.bytesInOutput === 0) continue;
      const path = resolve(workingDir, input);
      let notice = cache.get(path);
      if (!notice) {
        notice = packageNotice(path);
        cache.set(path, notice);
      }
      notices.set(notice.id, notice.text);
    }
    const file = resolve(workingDir, output);
    const legal = `${file}.LEGAL.txt`;
    const preserved = existsSync(legal) ? readFileSync(legal, "utf8") : "";
    const text = [...notices].sort(([a], [b]) => a.localeCompare(b)).map(([, text]) => text);
    if (!text.length)
      text.push(
        [
          "Playerstack",
          readFileSync(new URL("../../NOTICE", import.meta.url), "utf8"),
          readFileSync(new URL("../../LICENSE", import.meta.url), "utf8"),
        ].join("\n\n"),
      );
    writeFileSync(legal, [...text, preserved].filter(Boolean).join("\n\n---\n\n") + "\n");
    appendFileSync(file, `\n// License notices: ${basename(legal)}\n`);
  }
}
