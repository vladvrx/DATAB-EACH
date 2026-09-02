const { test, expect } = require("@playwright/test");

test.use({
  channel: "msedge",
  headless: true,
  viewport: { width: 390, height: 844 },
});
test.setTimeout(90_000);

test("boots with color-only alien customization", async ({ page }) => {
  const pageErrors = [];
  const failedRequests = [];
  page.on("pageerror", (error) => pageErrors.push(error.stack || error.message));
  page.on("requestfailed", (request) =>
    failedRequests.push(`${request.url()} :: ${request.failure()?.errorText}`),
  );

  await page.goto("http://127.0.0.1:43184/?noSupercache=1&alien=qa", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(20_000);

  console.log(`PRELOADER=${await page.locator("#preloader").isVisible()}`);
  console.log(`PAGE_ERRORS=${JSON.stringify(pageErrors)}`);
  console.log(`FAILED_REQUESTS=${JSON.stringify(failedRequests)}`);

  await expect(page.locator("#preloader")).toBeHidden({ timeout: 30_000 });
  await page.evaluate(() =>
    document.querySelector('button[aria-label="Customize your profile"]')?.click(),
  );
  await expect(page.getByRole("button", { name: /^Switch for color/ })).toHaveCount(5);
  await expect(page.getByRole("button", { name: "Previous" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Next" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Male face" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Female face" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Randomize" })).toHaveCount(0);

  await page.getByRole("button", { name: "Switch for color 1" }).click();
  await expect(page.locator("button.color-1")).toHaveClass(/is-selected/);
  await page.evaluate(() =>
    document.querySelector('button[aria-label="Confirm"]')?.click(),
  );
  await page.waitForTimeout(1_000);

  await page.evaluate(() =>
    document.querySelector('button[aria-label="Open the phone"]')?.click(),
  );
  await page.waitForTimeout(1_000);
  await expect(page.getByRole("button", { name: "Map", exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Quests", exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Partners", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Accessories", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Customization", exact: true })).toHaveCount(0);
  await expect(page.locator(".nav-items > .nav-item")).toHaveCount(2);
  await expect(page.locator(".icons > div")).toHaveCount(2);
  const phoneNavigation = await page.locator(".phone-navigation").boundingBox();
  expect(phoneNavigation?.width).toBeLessThan(160);
  expect(pageErrors).toEqual([]);
});
