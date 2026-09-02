const { test, expect } = require("@playwright/test");

test.use({
  channel: "chrome",
  headless: true,
});
test.setTimeout(120_000);

const THREE_JS_URL = "http://127.0.0.1:43173/three-js";

async function showHeader(page) {
  await page.evaluate(() => {
    document.querySelector("#threejs-hud .app-header")?.classList.add("is-visible");
  });
}

test("header mute button sits beside profile and swaps on/off icons", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(THREE_JS_URL, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#preloader")).toBeHidden({ timeout: 90_000 });
  await expect(page.locator("#threejs-hud .app-header")).toHaveCount(1);
  await showHeader(page);

  const profile = page.locator("#threejs-hud .app-header .buttons > :nth-child(1)");
  const mute = page.locator("#threejs-hud .app-header [data-sound-toggle]");
  await expect(profile).toBeVisible();
  await expect(mute).toBeVisible();
  const display = await mute.evaluate((node) => getComputedStyle(node).display);
  expect(display).not.toBe("none");

  const profileBox = await profile.boundingBox();
  const muteBox = await mute.boundingBox();
  expect(profileBox).toBeTruthy();
  expect(muteBox).toBeTruthy();
  expect(muteBox.x).toBeGreaterThan(profileBox.x);
  expect(Math.abs(muteBox.y - profileBox.y)).toBeLessThan(8);

  await expect(mute.locator('svg[data-icon="sound-on"]')).toBeVisible();
  await expect(mute).toHaveAttribute("aria-pressed", "false");

  await mute.click();
  await expect(mute).toHaveAttribute("aria-pressed", "true");
  await expect(mute.locator('svg[data-icon="sound-off"]')).toBeVisible();
  expect(await page.evaluate(() => !!window.__THREE_JS_GAME__.app.$store.isAudioMuted)).toBe(true);

  await mute.click();
  await expect(mute).toHaveAttribute("aria-pressed", "false");
  await expect(mute.locator('svg[data-icon="sound-on"]')).toBeVisible();
  expect(await page.evaluate(() => !!window.__THREE_JS_GAME__.app.$store.isAudioMuted)).toBe(false);
});
