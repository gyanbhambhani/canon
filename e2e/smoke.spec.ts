import { expect, test } from "@playwright/test";

test("landing page loads with the hero and the numbers", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("The dialect models already speak.");
  await expect(page.getByRole("link", { name: "Try it" })).toHaveAttribute("href", "/play");
  await expect(page.getByText(/scrambled variants tested\. One output\./)).toBeVisible();
});

test("docs load with the sidebar", async ({ page }) => {
  await page.goto("/docs");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Quickstart" }).first()).toBeVisible();
  const llms = await page.request.get("/llms.txt");
  expect(llms.ok()).toBe(true);
  expect(await llms.text()).toContain("fn ");
});

test("playground formats, checks and runs hello.cn in a worker", async ({ page }) => {
  await page.goto("/play");
  const editor = page.getByTestId("editor").locator(".cm-content");
  await expect(editor).toContainText("hello, canon");
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByTestId("output")).toHaveText("hello, canon");

  // a missing effect shows a patch; Apply rewrites the editor and the problem goes away
  await editor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type('fn main() -> Unit {\nprint("hi")\n');
  await page.getByRole("button", { name: "Format" }).click();
  await expect(page.getByTestId("diagnostics")).toContainText("E101");
  await page.getByRole("button", { name: "Apply" }).first().click();
  await expect(editor).toContainText("effects: io");
  await expect(page.getByTestId("diagnostics")).toContainText("No problems.");
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByTestId("output")).toHaveText("hi");
});

test("an infinite loop is stopped after 2 seconds", async ({ page }) => {
  const src = "fn main() -> Unit {\n  var i = 0\n  while i >= 0 {\n    i = i + 1\n    i = i - 1\n  }\n}\n";
  const b64 = Buffer.from(src).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  await page.goto(`/play#code=${b64}`);
  await expect(page.getByTestId("editor").locator(".cm-content")).toContainText("while i >= 0");
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByTestId("output")).toContainText("Stopped after 2 seconds", { timeout: 6000 });
});

test("landing numbers are the ones scripts/stats.ts wrote at build time", async ({ page }) => {
  const { readFileSync } = await import("node:fs");
  const site = JSON.parse(readFileSync("apps/web/lib/generated/site.json", "utf8"));
  await page.goto("/");
  const strip = page.locator("dl");
  for (const n of [site.stats.referenceTokens, site.stats.fuzzedVariants, site.stats.conformanceTests, site.stats.stdlibFunctions]) {
    await expect(strip).toContainText(n.toLocaleString("en-US"));
  }
  await expect(page.getByText(`${site.stats.fuzzedVariants.toLocaleString("en-US")} scrambled variants tested`)).toBeVisible();
});

test("without NEXT_PUBLIC_GITHUB_URL there is no GitHub link", async ({ page }) => {
  test.skip(!!process.env.NEXT_PUBLIC_GITHUB_URL, "built with a GitHub URL");
  await page.goto("/");
  await expect(page.getByRole("link", { name: "GitHub" })).toHaveCount(0);
});
