// Renders apps/docs/og/og-default.html to apps/docs/public/og-default-2.png (1200x630).
// Usage: bun scripts/render-og.ts
import { chromium } from "@playwright/test";
import { join } from "path";
import { pathToFileURL } from "url";

const docs = join(import.meta.dir, "../apps/docs");
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.goto(pathToFileURL(join(docs, "og/og-default.html")).href);
  await page.evaluate(() => document.fonts.ready);
  const loaded = await page.evaluate(() =>
    ["Space Grotesk Variable", "Inter Variable"].every((f) => document.fonts.check(`16px "${f}"`)),
  );
  if (!loaded) throw new Error("OG fonts did not load; run bun install first");
  await page.screenshot({ path: join(docs, "public/og-default-2.png") });
} finally {
  await browser.close();
}
console.log("apps/docs/public/og-default-2.png");
