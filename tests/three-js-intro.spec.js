const { test, expect } = require("@playwright/test");

test.use({
  channel: "chrome",
  headless: true,
  viewport: { width: 1280, height: 720 },
});
test.setTimeout(180_000);

const THREE_JS_URL = "http://127.0.0.1:43173/three-js";

async function runtime(page) {
  return page.evaluate(() => {
    const game = window.__THREE_JS_GAME__;
    const app = game?.app;
    const webgl = app?.$webgl;
    return {
      route: app?.$route?.name ?? null,
      scene: webgl?.scenes?.currentSceneID?.value ?? null,
      dialog: app?.$dialogs?.current?.node?.id ?? null,
      dialogVisible: !!app?.$store?.isDialogVisible,
      headerVisible: document.querySelector("#threejs-hud .app-header")?.classList.contains("is-visible") ?? false,
      menuOpen: !!document.querySelector("#threejs-hud .menu.is-open"),
      isHeaderVisible: !!app?.$store?.isHeaderVisible,
      isTransitionActive: !!app?.$store?.isTransitionActive,
      isMenuOpen: !!app?.$store?.isMenuOpen,
      isOverlayVisible: !!app?.$store?.isOverlayVisible,
      sceneState: app?.$store?.sceneState ?? null,
      playingState: app?.$store?.sceneStates?.Playing ?? null,
      intro: webgl?.store?.intro
        ? {
            journeyStarted: webgl.store.intro.journeyStarted.value,
            startJourneyVisible: webgl.store.intro.startJourneyVisible.value,
          }
        : null,
      canMove: webgl?.scenes?.current?.player?.canMove ?? false,
    };
  });
}

async function finishBubble(page, text) {
  const dialog = page.locator(".dialog-bubble").filter({ hasText: text }).last();
  await expect(dialog).toContainText(text, { timeout: 40_000 });
  await expect(dialog.locator(".bubble")).toHaveClass(/is-done/, { timeout: 40_000 });
  await page.keyboard.press("Space");
}

test("Three.js intro Yes choice boats the player to Cove Island", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack || error.message));

  await page.goto(THREE_JS_URL, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#preloader")).toBeHidden({ timeout: 90_000 });
  await expect(page.locator(".start-btn").first()).toBeVisible({ timeout: 60_000 });

  const before = await runtime(page);
  expect(before.route).toBe("Intro");
  expect(before.scene).toBe("IslandIntro");
  expect(before.headerVisible).toBe(false);
  expect(before.intro?.startJourneyVisible).toBe(true);

  await page.locator(".start-btn").first().click();
  await finishBubble(page, "HELLO WELCOME");
  await finishBubble(page, "Glorbs found");
  await finishBubble(page, "CAN YOU HELP US");

  const yes = page.getByRole("button", { name: "Yes", exact: true });
  const no = page.getByRole("button", { name: "No thanks" });
  await expect(yes).toBeVisible({ timeout: 20_000 });
  await expect(no).toBeVisible();
  await expect(yes).toHaveClass(/green/);
  await yes.click();

  await finishBubble(page, "Cove Island");

  await expect.poll(async () => (await runtime(page)).scene, { timeout: 60_000 }).toBe("IslandWest");
  await expect.poll(async () => (await runtime(page)).route, { timeout: 30_000 }).toBe("Home");
  await expect.poll(async () => (await runtime(page)).canMove, { timeout: 30_000 }).toBe(true);
  await expect.poll(async () => (await runtime(page)).headerVisible, { timeout: 30_000 }).toBe(true);

  const after = await runtime(page);
  expect(after.dialogVisible).toBe(false);
  expect(after.menuOpen).toBe(false);
  expect(errors).toEqual([]);
});
