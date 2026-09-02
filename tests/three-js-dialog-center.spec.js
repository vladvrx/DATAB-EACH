const { test, expect } = require("@playwright/test");

test.use({
  channel: "chrome",
  headless: true,
  viewport: { width: 1280, height: 720 },
});
test.setTimeout(180_000);

const THREE_JS_URL = "http://127.0.0.1:43173/three-js";

test("intro talk bubble sits in the vertical middle of the viewport", async ({ page }) => {
  await page.goto(THREE_JS_URL, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#preloader")).toBeHidden({ timeout: 90_000 });
  await expect(page.locator(".start-btn").first()).toBeVisible({ timeout: 60_000 });
  await page.locator(".start-btn").first().click();

  const bubble = page.locator("#threejs-hud .dialog-bubble.visible .bubble").last();
  await expect(bubble).toBeVisible({ timeout: 40_000 });
  await expect(bubble).toContainText("HELLO WELCOME");

  const metrics = await bubble.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return {
      top: rect.top,
      bottom: rect.bottom,
      height: rect.height,
      midY: rect.top + rect.height / 2,
      viewportHeight: window.innerHeight,
      bubbleTop: getComputedStyle(node.closest(".dialog-bubble")).top,
      bubblePosition: getComputedStyle(node.closest(".dialog-bubble")).position,
      bubbleTransform: getComputedStyle(node.closest(".dialog-bubble")).transform,
    };
  });

  expect(metrics.bubblePosition).toBe("fixed");
  expect(metrics.viewportHeight).toBe(720);
  expect(Math.abs(metrics.midY - metrics.viewportHeight / 2)).toBeLessThan(90);
  expect(metrics.top).toBeGreaterThan(metrics.viewportHeight * 0.28);
  expect(metrics.bottom).toBeLessThan(metrics.viewportHeight * 0.72);
});
