import { test, expect } from "@playwright/test";
import { mockApi } from "./fixtures";
test("search and cart persist across navigation", async ({ page }) => {
  await mockApi(page);
  await page.goto("/store/");
  await page.getByRole("searchbox", { name: "Search products" }).fill("Tea");
  await expect(page.getByText("Fixture Notebook", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Add to demo cart" }).click();
  await page.goto("/store/cart/");
  await expect(page.getByText("Fixture Tea", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Fixture Tea", { exact: true })).toBeVisible();
});
test("signed-in checkout creates a demo order without payment fields", async ({
  page,
}) => {
  await mockApi(page, "user");
  await page.goto("/store/");
  await page
    .getByRole("article")
    .filter({ hasText: "Fixture Tea" })
    .getByRole("button", { name: "Add to demo cart" })
    .click();
  await page.goto("/store/checkout/");
  const request = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/orders") && request.method() === "POST",
  );
  await page
    .getByRole("button", { name: "Create demo order", exact: true })
    .click();
  expect((await request).postDataJSON()).toEqual({
    items: [{ idProduct: "00000000-0000-4000-8000-000000000001", quantity: 1 }],
  });
  await expect(page.getByRole("alert")).toContainText("No payment was taken");
  await expect(page.getByLabel(/card number/i)).toHaveCount(0);
});
test("invalid login input displays accessible errors", async ({ page }) => {
  await mockApi(page);
  await page.goto("/store/login/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Enter your password.")).toBeVisible();
});
