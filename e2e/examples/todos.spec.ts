import { expect, test } from "@playwright/test";

/** examples/todos: the worked example's UI, through the generated client and backend. */
const url = "http://127.0.0.1:5101";

test("add, complete and page through todos; validation and typed errors reach the UI", async ({ page }) => {
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Todos" })).toBeVisible();

  // the client's validator rejects a blank title before any request is sent
  await page.getByLabel("New todo").fill("   ");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("alert")).toHaveText("Not allowed: str_len(trim(input.title)) > 0");

  for (const title of ["milk", "eggs", "bread", "tea", "jam", "rice"]) {
    await page.getByLabel("New todo").fill(`  ${title} `);
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByLabel("New todo")).toHaveValue(""); // saved, and the form reset
  }
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("listitem")).toHaveCount(5);
  await expect(page.getByRole("listitem").first()).toContainText("milk");

  // complete one: the backend saves it, the list shows it struck through
  await page.getByRole("listitem").filter({ hasText: "eggs" }).getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "eggs" }).getByRole("button")).toHaveCount(0);

  // pagination goes through list_todos(page, per_page)
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Page 2")).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByRole("listitem")).toContainText("rice");
});
