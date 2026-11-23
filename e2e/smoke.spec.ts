import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const site = JSON.parse(readFileSync("apps/web/lib/generated/site.json", "utf8"));

test("landing page: the one idea, the real terminal, and the benchmark from data", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("The programming language for AI agents.");
  await expect(page.getByRole("link", { name: "Get started" }).first()).toHaveAttribute("href", "/docs/quickstart");
  await expect(page.getByRole("link", { name: "Open playground" })).toHaveAttribute("href", "/play");
  const term = page.getByTestId("hero-terminal");
  await expect(term).toContainText("error E101");
  await expect(term).toContainText("hello.cn: ok");
  const table = page.getByTestId("benchmark-table");
  for (const k of ["canonCorrect", "canonFirstPassRange", "turnsRange", "canonDistinctRange", "tsDistinctRange"]) {
    await expect(table).toContainText(site.display[k]);
  }
});

test("theme: follows the OS, the toggle switches it, and the choice persists", async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: "dark" });
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await ctx.close();
});

test("no horizontal scroll at 375px", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 375, height: 800 } });
  for (const path of ["/", "/play", "/docs", "/research"]) {
    await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(375);
  }
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

test("without NEXT_PUBLIC_GITHUB_URL there is no GitHub link", async ({ page }) => {
  test.skip(!!process.env.NEXT_PUBLIC_GITHUB_URL, "built with a GitHub URL");
  await page.goto("/");
  await expect(page.getByRole("link", { name: "GitHub" })).toHaveCount(0);
});
