import { test, expect } from "@playwright/test";

test("wiki home loads for anonymous visitors", async ({ page }) => {
  await page.goto("/wiki");
  await expect(page.locator("h1").first()).toBeVisible();
});

test("anonymous CMS staff API writes are forbidden", async ({ request }) => {
  const cross = await request.post("/api/staff/cms/wiki/categories", {
    headers: { origin: "https://attacker.example", "content-type": "application/json" },
    data: { slug: "test", name_en: "Test", name_ro: "Test" },
  });
  expect(cross.status()).toBe(403);

  const anonymous = await request.post("/api/staff/cms/wiki/categories", {
    headers: { origin: "http://127.0.0.1:3100", "content-type": "application/json" },
    data: { slug: "test", name_en: "Test", name_ro: "Test" },
  });
  expect(anonymous.status()).toBe(403);
});
