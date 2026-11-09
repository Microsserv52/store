import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { mockApi, products } from "./fixtures";

test("catalog image URLs render with alternative text and recover from a failed image", async ({
  page,
}) => {
  await mockApi(page);
  let broken = false;
  const png = await readFile("public/brand.png");
  const image = {
    url: "https://images.example.test/fixture.png",
    alt: "Project logo upload fixture",
    width: 697,
    height: 345,
  };
  await page.route("https://images.example.test/fixture.png", (route) =>
    broken
      ? route.abort()
      : route.fulfill({ body: png, contentType: "image/png" }),
  );
  await page.route("**/api/products", (route) =>
    route.fulfill({ json: [{ ...products[0], image }] }),
  );
  await page.goto("/store/");
  const rendered = page.getByRole("img", { name: image.alt, exact: true });
  await expect(rendered).toBeVisible();
  await expect
    .poll(() =>
      rendered.evaluate(
        (element) => (element as HTMLImageElement).naturalWidth,
      ),
    )
    .toBeGreaterThan(0);
  broken = true;
  await page.reload();
  await expect(
    page.getByText("Product image unavailable", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: image.alt, exact: true }),
  ).toHaveCount(0);
});
