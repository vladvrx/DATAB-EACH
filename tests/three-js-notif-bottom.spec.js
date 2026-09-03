const { test, expect } = require("@playwright/test");

test.use({
  channel: "chrome",
  headless: true,
});
test.setTimeout(120_000);

const THREE_JS_URL = "http://127.0.0.1:43173/three-js";

async function waitForGame(page) {
  await page.goto(THREE_JS_URL, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#preloader")).toBeHidden({ timeout: 90_000 });
  await page.waitForFunction(() => !!window.__THREE_JS_GAME__?.app?.$notifs, null, { timeout: 60_000 });
}

async function showHint(page) {
  await page.evaluate(async () => {
    const app = window.__THREE_JS_GAME__.app;
    const store = app.$store;
    store.isDialogVisible = false;
    store.isDialogVisibleDelayed = false;
    store.isMenuOpen = false;
    store.isCinematicActive = false;
    store.isTransitionActive = false;
    store.isTransitionActiveDelayed = false;
    store.isApiErrorVisible = false;
    if (app.$route?.name !== "Home") {
      await app.$router.replace({ name: "Home" });
    }
  });
  await page.waitForTimeout(1400);
  await page.evaluate(() => {
    window.__THREE_JS_GAME__.app.$notifs.add("Hint", { hintType: "customize" });
  });
}

function assertAnchoredToBottom(metrics) {
  expect(metrics.position).toBe("fixed");
  expect(metrics.cardBottom).toBeGreaterThan(metrics.viewportHeight * 0.72);
  expect(metrics.cardTop).toBeGreaterThan(metrics.viewportHeight * 0.5);
  expect(metrics.viewportHeight - metrics.cardBottom).toBeLessThan(80);
}

test("hint toast sits on the bottom edge on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await waitForGame(page);
  await showHint(page);
  const toast = page.locator(".notif.visible[data-v-25064164]");
  await expect(toast).toBeVisible({ timeout: 10_000 });
  await expect(toast.locator(".notification")).toBeVisible();
  const metrics = await toast.evaluate((node) => {
    const card = node.querySelector(".notification");
    const style = getComputedStyle(node);
    const rect = card.getBoundingClientRect();
    return {
      position: style.position,
      top: style.top,
      bottom: style.bottom,
      cardTop: rect.top,
      cardBottom: rect.bottom,
      viewportHeight: window.innerHeight,
    };
  });
  const hiddenTransform = await page.evaluate(() => {
    const host = document.createElement("aside");
    host.className = "notif";
    host.setAttribute("data-v-25064164", "");
    const card = document.createElement("div");
    card.className = "notification";
    card.setAttribute("data-v-25064164", "");
    host.append(card);
    document.body.append(host);
    const transform = getComputedStyle(card).transform;
    host.remove();
    return transform;
  });
  assertAnchoredToBottom(metrics);
  const ty = Number((hiddenTransform.match(/-?\d+(?:\.\d+)?/g) || []).at(-1));
  expect(ty).toBeGreaterThan(150);
  await toast.screenshot({ path: "/opt/cursor/artifacts/notification_bottom_desktop.png" });
  await page.screenshot({ path: "/opt/cursor/artifacts/notification_bottom_desktop_page.png" });
});

test("hint toast sits on the bottom edge on iPhone 13", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    document.documentElement.classList.add("phone");
  });
  await waitForGame(page);
  await page.evaluate(() => document.documentElement.classList.add("phone"));
  await showHint(page);
  const toast = page.locator(".notif.visible[data-v-25064164]");
  await expect(toast).toBeVisible({ timeout: 10_000 });
  const metrics = await toast.evaluate((node) => {
    const card = node.querySelector(".notification");
    const style = getComputedStyle(node);
    const rect = card.getBoundingClientRect();
    return {
      position: style.position,
      top: style.top,
      bottom: style.bottom,
      cardTop: rect.top,
      cardBottom: rect.bottom,
      viewportHeight: window.innerHeight,
      isTopActive: !!window.__THREE_JS_GAME__.app.$notifs.isTopActive.value,
      isBottomActive: !!window.__THREE_JS_GAME__.app.$notifs.isBottomActive.value,
    };
  });
  assertAnchoredToBottom(metrics);
  expect(metrics.isTopActive).toBe(false);
  expect(metrics.isBottomActive).toBe(true);
  await toast.screenshot({ path: "/opt/cursor/artifacts/notification_bottom_iphone.png" });
  await page.screenshot({ path: "/opt/cursor/artifacts/notification_bottom_iphone_page.png" });
});
