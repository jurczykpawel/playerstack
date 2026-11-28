import { test, expect, type Page } from "@playwright/test";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { DIST, ORIGIN, SCRIPT, observeStandalone } from "./standalone-helpers";

observeStandalone();

async function openWithTrustedCss(
  page: Page,
  trustedCss: string,
  scriptAttrs = "data-allow-trusted-css",
): Promise<void> {
  const config = { customCss: { enabled: true, acknowledgeTrusted: true, trustedCss } };
  await page.route(`${ORIGIN}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/") {
      return route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html><head><meta charset="utf-8"></head><body>
          <h1 id="outside">Host heading</h1>
          <player-stack src="${ORIGIN}/v.mp4" data-config='${JSON.stringify(config).replace(/'/g, "&#39;")}' style="display:block;width:640px;height:360px"></player-stack>
          <p id="after">Host paragraph</p>
          <script src="${SCRIPT}" ${scriptAttrs}></script>
        </body></html>`,
      });
    }
    const file = join(DIST, path.split("/").pop()!);
    if (path.startsWith("/assets/") && existsSync(file)) {
      return route.fulfill({ body: readFileSync(file), contentType: "application/javascript" });
    }
    return route.fulfill({ status: 404 });
  });
  await page.goto(`${ORIGIN}/`);
  await expect(page.locator("player-stack media-controller")).toBeAttached();
}

const visibility = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => getComputedStyle(el).visibility);

test("trusted CSS styles the player but cannot reach the rest of the page", async ({ page }) => {
  await openWithTrustedCss(page, "& media-controller { visibility: hidden }");
  await expect.poll(() => visibility(page, "player-stack media-controller")).toBe("hidden");
});

test("trusted CSS from data-config is ignored unless the script tag allows it", async ({
  page,
}) => {
  await openWithTrustedCss(page, "& media-controller { visibility: hidden }", "");
  await expect(page.locator("player-stack media-controller")).toBeAttached();
  await expect(page.locator('style[data-playerstack="custom-css"]')).toHaveCount(0);
  expect(await visibility(page, "player-stack media-controller")).toBe("visible");
});

for (const [name, css] of [
  ["a pseudo-class around &", ":not(&):is(#outside, #after) { visibility: hidden }"],
  ["a string broken by a newline", 'color: "\n} #outside, #after { visibility: hidden }'],
  ["a sibling combinator after the player", "& ~ #after { visibility: hidden }"],
  ["a sibling combinator after a compound with &", "&:not(._) ~ #after { visibility: hidden }"],
  [
    "a semicolon inside a pseudo-class",
    ":is(:not(&),;):is(#outside, #after) { visibility: hidden }",
  ],
  [
    "a bracket inside a quoted string",
    ':is(#outside, #after):not([x=")"], &) { visibility: hidden }',
  ],
]) {
  test(`trusted CSS with ${name} is dropped`, async ({ page }) => {
    await openWithTrustedCss(page, css);
    await expect(page.locator('style[data-playerstack="custom-css"]')).toHaveCount(0);
    expect(await visibility(page, "#outside")).toBe("visible");
    expect(await visibility(page, "#after")).toBe("visible");
  });
}
