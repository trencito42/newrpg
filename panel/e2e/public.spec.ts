import { test, expect } from "@playwright/test";

test("anonymous homepage and player directory render from MariaDB", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1").first()).toBeVisible();
  await page.goto("/players");
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page.locator('a[href^="/players/"]').first()).toBeVisible();
});

test("public profile shows assets and warning count without private balances", async ({ page }) => {
  const slug = process.env.PANEL_E2E_PROFILE_SLUG;
  test.skip(!slug, "Set PANEL_E2E_PROFILE_SLUG to a character with public assets in the test DB");
  await page.goto(`/players/${encodeURIComponent(slug!)}`);
  await expect(page.getByText("Vehicles Owned")).toBeVisible();
  await expect(page.getByText("Properties Owned")).toBeVisible();
  if (process.env.PANEL_E2E_EXPECTED_PLATE) {
    await expect(page.getByText(process.env.PANEL_E2E_EXPECTED_PLATE, { exact: false })).toBeVisible();
  }
  if (process.env.PANEL_E2E_EXPECTED_PROPERTY) {
    await expect(page.getByText(process.env.PANEL_E2E_EXPECTED_PROPERTY, { exact: false })).toBeVisible();
  }
  await expect(page.getByText(/Warnings:/)).toBeVisible();
  await expect(page.getByText("Financial balance is private to the character owner.")).toBeVisible();
  await expect(page.getByText("Cash on Hand (Private)")).toHaveCount(0);
});

test("login failure and Romanian login copy are visible", async ({ page, context }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("nonexistent_e2e_user");
  await page.getByLabel("Password").fill("incorrect_e2e_password");
  await page.getByRole("button", { name: "Log In" }).click();
  await expect(page.getByText("The username or password provided is incorrect.")).toBeVisible();
  await context.addCookies([{ name: "sunset_panel_locale", value: "ro", url: "http://127.0.0.1:3100" }]);
  await page.reload();
  await expect(page.getByText("Autentificare în Cont")).toBeVisible();
});

test("anonymous staff and finance access are denied", async ({ page }) => {
  await page.goto("/staff/dashboard");
  await expect(page.getByText("Staff Access Restricted")).toBeVisible();
  await page.goto("/my-character/banking");
  await expect(page).toHaveURL(/\/login$/);
});

test("state-changing APIs deny anonymous and cross-origin calls", async ({ request }) => {
  const cross = await request.post("/api/staff/actions", {
    headers: { origin: "https://attacker.example", "content-type": "application/json" },
    data: {},
  });
  expect(cross.status()).toBe(403);
  const anonymous = await request.post("/api/staff/actions", {
    headers: { origin: "http://127.0.0.1:3100", "content-type": "application/json" },
    data: {},
  });
  expect(anonymous.status()).toBe(401);
  const logoutGet = await request.get("/api/auth/logout");
  expect(logoutGet.status()).toBe(405);
});
