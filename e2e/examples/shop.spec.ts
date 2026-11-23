import { expect, test } from "@playwright/test";

/** examples/shop: three Canon modules, signup, pagination and an outbound payment (mocked). */
const url = "http://127.0.0.1:5102";

test("sign up, add products, page and filter, order and pay", async ({ page }) => {
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Shop" })).toBeVisible();

  // validation written once: the client rejects a bad email with the server's rule
  await page.getByLabel("Email", { exact: true }).fill("ada");
  await page.getByLabel("Name", { exact: true }).fill("Ada");
  await page.getByLabel("Password").fill("correct horse");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByRole("alert")).toContainText("Not allowed: is_email(input.email)");

  // (a form action resets the form, as React 19 does: wait for that before filling it again)
  await expect(page.getByLabel("Password")).toHaveValue("");
  await page.getByLabel("Email", { exact: true }).fill("ada@example.com");
  await page.getByLabel("Name", { exact: true }).fill("Ada");
  await page.getByLabel("Password").fill("correct horse");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByText("Signed in as Ada")).toBeVisible();

  const add = async (sku: string, name: string, cents: string, tags: string) => {
    await page.getByLabel("SKU").fill(sku);
    await page.getByLabel("Product name").fill(name);
    await page.getByLabel("Price in cents").fill(cents);
    await page.getByLabel("Stock").fill("5");
    await page.getByLabel("Tags").fill(tags);
    await page.getByRole("button", { name: "Add product" }).click();
    await expect(page.getByLabel("SKU")).toHaveValue(""); // the action ran and reset the form
  };
  await add("apple", "Apple", "105", "fruit");
  await add("hammer", "Hammer", "1999", "tool, heavy");
  await add("pear", "Pear", "80", "fruit");

  // a duplicate SKU is a typed error from the backend (Invalid)
  await add("pear", "Pear", "80", "fruit");
  await expect(page.getByRole("alert")).toHaveText("Invalid: duplicate sku pear");

  // pagination (2 per page) and the tag filter
  const products = page.getByRole("region", { name: "Products" }).getByRole("listitem");
  await expect(products).toHaveCount(2);
  await page.getByRole("button", { name: "Next" }).click();
  await expect(products).toHaveCount(1);
  await expect(products).toContainText("Pear");
  await page.getByLabel("Tag filter").fill("tool");
  await expect(products).toHaveCount(1);
  await expect(products).toContainText("Hammer $19.99");

  // order across modules, then pay through the (mocked) payment host
  await page.getByRole("button", { name: "Buy Hammer" }).click();
  const order = page.getByRole("region", { name: "Order" });
  await expect(order).toContainText("Total $19.99");
  await expect(order).toContainText("Status: Open");
  await order.getByRole("button", { name: "Pay" }).click();
  await expect(order).toContainText("Status: Paid (test-receipt-1999)");
});
