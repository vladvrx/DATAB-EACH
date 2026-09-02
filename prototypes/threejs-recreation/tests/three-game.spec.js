const { test, expect } = require("@playwright/test");

test.describe.configure({ timeout: 180_000 });

test("boots the source Three.js game and preserves the requested UI", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const pageErrors = [];
  const failedRequests = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const reason = request.failure()?.errorText ?? "failed";
    if (!request.url().match(/\.(m4a|mp4)$/) && reason !== "net::ERR_ABORTED") {
      failedRequests.push(`${request.url()} ${reason}`);
    }
  });

  await page.goto("http://127.0.0.1:43173/?threeQa=1", { waitUntil: "domcontentloaded" });
  const shell = page.locator(".game-shell");
  await expect(shell).toHaveAttribute("data-ready", "true", { timeout: 150_000 });
  await expect(page.locator("canvas.game-canvas")).toBeVisible();

  const phoneButtons = page.locator(".phone-tabs button");
  await expect(phoneButtons).toHaveCount(2);
  await expect(phoneButtons.nth(0)).toHaveAccessibleName("Map");
  await expect(phoneButtons.nth(1)).toHaveAccessibleName("Quests");
  await expect(page.getByText("Customizr", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Shop items", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Change alien color" }).click();
  const swatches = page.locator(".color-swatch");
  await expect(swatches).toHaveCount(5);
  await swatches.nth(2).click();
  await expect(swatches).toHaveCount(0);

  await page.getByRole("button", { name: "Map" }).click();
  await expect(page.getByRole("region", { name: "Cove map" })).toBeVisible();
  await expect(page.getByAltText("Map of Cove Island")).toBeVisible();
  await page.getByRole("button", { name: "Close phone" }).click();

  await page.getByRole("button", { name: "Quests" }).click();
  await expect(page.getByRole("region", { name: "Quests" })).toBeVisible();
  await expect(page.locator(".quest-list article")).toHaveCount(4);
  await page.getByRole("button", { name: "Close phone" }).click();

  await page.keyboard.down("KeyW");
  await page.waitForTimeout(1_200);
  await page.keyboard.up("KeyW");
  await page.waitForTimeout(2_200);
  const savedPosition = await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem("datab-each-three-v1") || "null");
    return save?.position ?? null;
  });
  expect(savedPosition).not.toBeNull();
  expect(savedPosition).toHaveLength(3);

  await page.screenshot({ path: "test-results/three-game.png", fullPage: true });
  expect(pageErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

test("old reference URL opens the converted game", async ({ page }) => {
  await page.goto("http://127.0.0.1:43173/reference.html", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/^http:\/\/(?:127\.0\.0\.1|localhost):43173\/$/);
  await expect(page.locator(".game-shell")).toBeVisible();
});
