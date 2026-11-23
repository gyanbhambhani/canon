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

test("/research renders every verdict from the reports, and the likelihood table", async ({ page }) => {
  await page.goto("/research");
  const table = page.getByTestId("verdicts");
  for (const v of site.benchmark.verdicts) {
    await expect(table.locator("tr", { hasText: v.id }).first()).toContainText(v.verdict);
  }
  await expect(page.getByTestId("likelihood").locator("tbody tr")).toHaveCount(site.likelihood.rows.length);
});

test("docs load with the sidebar", async ({ page }) => {
  await page.goto("/docs");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Quickstart" }).first()).toBeVisible();
  // search loads on first open
  await page.getByRole("button", { name: /search/i }).first().click();
  const input = page.getByPlaceholder(/search/i);
  await expect(input).toBeVisible();
  await input.fill("pipeline");
  await expect(page.getByRole("dialog")).toContainText(/pipeline/i);
  await page.keyboard.press("Escape");
  const llms = await page.request.get("/llms.txt");
  expect(llms.ok()).toBe(true);
  expect(await llms.text()).toContain("fn ");
});

test("playground opens on a mistake; Apply fix clears it and Run prints the output", async ({ page }) => {
  await page.goto("/play");
  const editor = page.getByTestId("editor").locator(".cm-content");
  await expect(editor).toContainText("hello, canon");
  await expect(page.locator(".cm-diag")).toHaveCount(1);
  const problems = page.getByTestId("diagnostics");
  await expect(problems).toContainText("E101");
  await expect(problems).toContainText("+  effects: io");
  await page.getByRole("button", { name: "Apply fix" }).click();
  await expect(editor).toContainText("effects: io");
  await expect(problems).toContainText("No problems.");
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByTestId("output")).toHaveText("hello, canon");
});

test("Break it shows a fix for each kind of mistake", async ({ page }) => {
  await page.goto("/play");
  const problems = page.getByTestId("diagnostics");
  const seen = new Set<string>();
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Break it" }).click();
    await expect(page.getByRole("button", { name: "Apply fix" })).toBeVisible();
    const code = (await problems.locator("li span.text-err").first().textContent())!;
    seen.add(code);
    await page.getByRole("button", { name: "Apply fix" }).click();
    await expect(problems.getByText(code, { exact: true })).toHaveCount(0);
  }
  expect([...seen].sort()).toEqual(["E101", "T004", "T009"]);
});

test("the Examples menu loads a program that runs", async ({ page }) => {
  await page.goto("/play");
  await page.getByLabel("Examples").selectOption({ label: "Customer ranking" });
  await expect(page.getByTestId("editor").locator(".cm-content")).toContainText("top_customers");
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByTestId("output")).toContainText("total:");
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
