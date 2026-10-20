// Fails if any built docs page has an empty <title> or og:title.
// Usage (after the docs build): bun scripts/check-docs-titles.ts [dist dir]
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

const dist = process.argv[2] ?? join(import.meta.dir, "../apps/docs/dist");

function* htmlFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* htmlFiles(path);
    else if (name.endsWith(".html")) yield path;
  }
}

const bad: string[] = [];
let pages = 0;
for (const file of htmlFiles(dist)) {
  pages++;
  const html = readFileSync(file, "utf8");
  const title = /<title>([^<]*)<\/title>/.exec(html)?.[1]?.trim() ?? "";
  const ogTitle = /<meta property="og:title" content="([^"]*)"/.exec(html)?.[1]?.trim() ?? "";
  if (!title || !ogTitle)
    bad.push(`${relative(dist, file)}: title="${title}" og:title="${ogTitle}"`);
}
if (pages === 0) throw new Error(`no HTML pages in ${dist}`);
if (bad.length > 0) {
  console.error(`${bad.length} of ${pages} pages without a title:\n  ${bad.join("\n  ")}`);
  process.exit(1);
}
console.log(`all ${pages} pages have <title> and og:title`);
