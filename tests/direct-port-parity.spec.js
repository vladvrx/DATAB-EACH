const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const { PNG } = require("pngjs");

test.use({
  channel: "msedge",
  headless: true,
  viewport: { width: 390, height: 844 },
});
test.setTimeout(180_000);

const ORIGINAL_URL = "http://127.0.0.1:43173/reference.html?noSupercache=1&parity=original";
const PORT_URL = "http://127.0.0.1:43173/?noSupercache=1&parity=port";
const THREE_PORT_URL = "http://127.0.0.1:43173/three-port/?noSupercache=1&parity=port";
const PORT_ORIGIN = "http://127.0.0.1:43173/three-port";
const BLOCKED_ONLINE_SERVICES =
  /youtube|youtu\.be|ytimg|recaptcha|googletagmanager|cloudfunctions|gtm\.js|gtm-|datalayer/i;

function watchRemoteRequests(page, remoteRequests) {
  page.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith("http://") && !url.startsWith("https://")) return;
    const host = new URL(url).hostname;
    if (host !== "127.0.0.1" && host !== "localhost") remoteRequests.push(url);
  });
}

async function boot(context, url) {
  const page = await context.newPage();
  const errors = [];
  const failedRequests = [];
  const remoteRequests = [];
  watchRemoteRequests(page, remoteRequests);
  page.on("pageerror", (error) => errors.push(error.stack || error.message));
  page.on("requestfailed", (request) => {
    const reason = request.failure()?.errorText ?? "failed";
    if (reason !== "net::ERR_ABORTED" && !request.url().match(/\.(m4a|mp4)$/)) {
      failedRequests.push(`${request.url()} :: ${reason}`);
    }
  });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#preloader")).toBeHidden({ timeout: 90_000 });
  await expect(page.locator("canvas").first()).toBeVisible();
  return { page, errors, failedRequests, remoteRequests };
}

async function visibleControls(page) {
  return page.locator("button:visible").evaluateAll((buttons) =>
    buttons.map((button) => ({
      label: button.getAttribute("aria-label") || "",
      text: (button.textContent || "").trim().replace(/\s+/g, " "),
    })),
  );
}

async function runtimeState(page) {
  return page.evaluate(() => {
    const vueApp = document.querySelector("#app")?.__vue_app__;
    const globals = vueApp?.config?.globalProperties;
    const webgl = globals?.$webgl;
    const scene = webgl?.scenes?.current;
    const player = scene?.player;
    const position = player?.base?.position ?? webgl?.store?.playerPosition;
    const clip = (action) =>
      action
        ? {
            id: action.animationID,
            startFrame: action._startFrame,
            endFrame: action._endFrame,
            fps: action._fps,
            weight: action.weight,
          }
        : null;

    return {
      route: globals?.$route?.name ?? null,
      scene: webgl?.scenes?.currentSceneID?.value ?? null,
      position: position?.toArray?.() ?? null,
      currentAnimation: player?.currentAnimation ?? null,
      activeAnimation: player?.animation?.animationID ?? null,
      movementSpeed: player?.OptSpeed ?? null,
      canMove: player?.canMove ?? false,
      physicsReady: scene?.physics?.isReady ?? false,
      keyboardPressedCount: webgl?.input?.keyboard?.pressedCount ?? 0,
      transitionActive: webgl?.store?.isTransitionActive?.value ?? false,
      walk: clip(player?.moveAnims?.Walk),
      run: clip(player?.moveAnims?.Run),
      intro: webgl?.store?.intro
        ? {
            journeyStarted: webgl.store.intro.journeyStarted.value,
            startJourneyVisible: webgl.store.intro.startJourneyVisible.value,
            descentDone: webgl.store.intro.descentDone.value,
          }
        : null,
      questCount: Object.keys(globals?.$quests?.rawList ?? {}).length,
    };
  });
}

async function finishDialogBubble(page, expectedText) {
  const dialog = page.locator(".dialog-bubble").filter({ hasText: expectedText }).last();
  await expect(dialog).toContainText(expectedText, { timeout: 20_000 });
  await expect(dialog.locator(".bubble")).toHaveClass(/is-done/, { timeout: 20_000 });
  await page.keyboard.press("Space");
}

test("recovered Three.js runtime matches the authoritative start screen", async ({ browser }) => {
  const originalContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const portContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const [original, port] = await Promise.all([
    boot(originalContext, ORIGINAL_URL),
    boot(portContext, PORT_URL),
  ]);

  await expect(port.page).toHaveTitle(await original.page.title());
  expect(await visibleControls(port.page)).toEqual(await visibleControls(original.page));
  expect(await port.page.locator("canvas").count()).toBe(await original.page.locator("canvas").count());
  expect(original.errors).toEqual([]);
  expect(port.errors).toEqual([]);
  expect(original.failedRequests).toEqual([]);
  expect(port.failedRequests).toEqual([]);
  expect(port.remoteRequests).toEqual([]);

  await Promise.all([
    original.page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" }),
    port.page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" }),
  ]);
  await original.page.waitForTimeout(500);
  await port.page.waitForTimeout(500);
  const originalImage = await original.page.screenshot({ path: "test-results/direct-port-original.png" });
  const portImage = await port.page.screenshot({ path: "test-results/direct-port-recovered.png" });
  const originalPng = PNG.sync.read(originalImage);
  const portPng = PNG.sync.read(portImage);
  const { default: pixelmatch } = await import("pixelmatch");
  const difference = new PNG({ width: originalPng.width, height: originalPng.height });
  const changedPixels = pixelmatch(
    originalPng.data,
    portPng.data,
    difference.data,
    originalPng.width,
    originalPng.height,
    { threshold: 0.15 },
  );
  fs.writeFileSync(path.join("test-results", "direct-port-diff.png"), PNG.sync.write(difference));
  expect(changedPixels / (originalPng.width * originalPng.height)).toBeLessThan(0.08);

  await originalContext.close();
  await portContext.close();
});

test("direct port keeps alien customization and the two-tab phone", async ({ page }) => {
  const pageErrors = [];
  const remoteRequests = [];
  watchRemoteRequests(page, remoteRequests);
  page.on("pageerror", (error) => pageErrors.push(error.stack || error.message));
  await page.goto(THREE_PORT_URL, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#preloader")).toBeHidden({ timeout: 90_000 });

  await page.evaluate(() =>
    document.querySelector('button[aria-label="Customize your profile"]')?.click(),
  );
  await expect(page.getByRole("button", { name: /^Switch for color/ })).toHaveCount(5);
  await expect(page.getByRole("button", { name: "Previous" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Next" })).toHaveCount(0);
  await page.getByRole("button", { name: "Switch for color 1" }).click();
  await page.evaluate(() => document.querySelector('button[aria-label="Confirm"]')?.click());

  await page.evaluate(() => document.querySelector('button[aria-label="Open the phone"]')?.click());
  await expect(page.getByRole("button", { name: "Map", exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Quests", exact: true })).toHaveCount(1);
  await expect(page.locator(".nav-items > .nav-item")).toHaveCount(2);
  await expect(page.locator(".icons > div")).toHaveCount(2);
  expect(pageErrors).toEqual([]);
  expect(remoteRequests).toEqual([]);
});

test("session pressure increases challenge with time, unlocks, and completions", async ({ page }) => {
  const pageErrors = [];
  const remoteRequests = [];
  watchRemoteRequests(page, remoteRequests);
  page.on("pageerror", (error) => pageErrors.push(error.stack || error.message));

  await page.goto(PORT_URL, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#preloader")).toBeHidden({ timeout: 90_000 });
  await expect
    .poll(() => page.evaluate(() => window.__DATAB_EACH_SESSION_PRESSURE__?.snapshot() ?? null))
    .not.toBeNull();
  await expect
    .poll(() => page.evaluate(() => window.__DATAB_EACH_SESSION_PRESSURE__.snapshot().ready))
    .toBe(true);

  const initial = await page.evaluate(() => window.__DATAB_EACH_SESSION_PRESSURE__.snapshot());
  expect(initial).toMatchObject({ stage: 0, stageName: "Calm", targetTimeMultiplier: 1 });

  await page.evaluate(() => {
    const globals = document.querySelector("#app").__vue_app__.config.globalProperties;
    globals.$circuit.targetTime = 70;
    window.__DATAB_EACH_SESSION_PRESSURE__.advance(240);
  });
  await expect
    .poll(() => page.evaluate(() => window.__DATAB_EACH_SESSION_PRESSURE__.snapshot().stage))
    .toBe(1);
  await expect
    .poll(() => page.evaluate(() => {
      const globals = document.querySelector("#app").__vue_app__.config.globalProperties;
      return globals.$circuit.targetTime;
    }))
    .toBe(66.5);

  await page.evaluate(() => {
    const globals = document.querySelector("#app").__vue_app__.config.globalProperties;
    globals.$savestate.game.quests.AvenMain = true;
    globals.$savestate.setVariable("hasHammer", true);
  });
  await expect
    .poll(() => page.evaluate(() => {
      const globals = document.querySelector("#app").__vue_app__.config.globalProperties;
      return globals.$quests.list.AvenSide.unlocked;
    }))
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__DATAB_EACH_SESSION_PRESSURE__.snapshot().stage))
    .toBe(2);
  await expect(page.locator("#session-pressure")).toContainText("Charged");
  expect(await page.evaluate(() => document.body.dataset.sessionPressureStage)).toBe("2");

  await page.evaluate(() => {
    const globals = document.querySelector("#app").__vue_app__.config.globalProperties;
    globals.$savestate.game.vars.questsCompletedCount += 2;
  });
  await expect
    .poll(() => page.evaluate(() => window.__DATAB_EACH_SESSION_PRESSURE__.snapshot().stage))
    .toBe(3);
  expect(pageErrors).toEqual([]);
  expect(remoteRequests).toEqual([]);
});

test("direct port preserves the complete intro handoff and original walk clips", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const port = await boot(context, `${PORT_URL}&journey=full`);

  await expect(port.page.locator(".start-btn")).toBeVisible({ timeout: 60_000 });
  const introReady = await runtimeState(port.page);
  expect(introReady.route).toBe("Intro");
  expect(introReady.scene).toBe("IslandIntro");
  expect(introReady.intro?.startJourneyVisible).toBe(true);
  expect(introReady.intro?.journeyStarted).toBe(false);

  await port.page.locator(".start-btn").click();
  await finishDialogBubble(port.page, "Welcome aboard, newcomer");
  await finishDialogBubble(port.page, "Come check out what us and the Glorbs found");
  await finishDialogBubble(port.page, "restoring the power back on the island");
  await expect(port.page.getByRole("button", { name: "Yes", exact: true })).toBeVisible();
  await port.page.getByRole("button", { name: "Yes", exact: true }).click();
  await finishDialogBubble(port.page, "drop you off on Cove Island");

  await expect
    .poll(async () => (await runtimeState(port.page)).scene, { timeout: 60_000 })
    .toBe("IslandWest");
  await expect
    .poll(async () => (await runtimeState(port.page)).route, { timeout: 30_000 })
    .toBe("Home");
  await expect(port.page.getByRole("button", { name: "Open the phone" })).toBeVisible({
    timeout: 30_000,
  });
  await expect
    .poll(async () => (await runtimeState(port.page)).canMove, { timeout: 30_000 })
    .toBe(true);

  const beforeMove = await runtimeState(port.page);
  expect(beforeMove.walk).toMatchObject({ id: "Walk", startFrame: 3, endFrame: 27, fps: 30 });
  expect(beforeMove.run).toMatchObject({ id: "Run", startFrame: 33, endFrame: 57, fps: 30 });
  expect(beforeMove.questCount).toBeGreaterThan(0);
  expect(beforeMove.position).not.toBeNull();
  expect(beforeMove.movementSpeed).toBeGreaterThan(0);

  await port.page.evaluate(() => window.__DATAB_EACH_SESSION_PRESSURE__.advance(240));
  await expect
    .poll(async () => (await runtimeState(port.page)).movementSpeed)
    .toBeLessThan(beforeMove.movementSpeed);
  await port.page.evaluate(() => window.__DATAB_EACH_SESSION_PRESSURE__.advance(6));
  await expect
    .poll(async () => (await runtimeState(port.page)).movementSpeed)
    .toBeCloseTo(beforeMove.movementSpeed, 5);

  const movementSamples = [];
  await port.page.keyboard.down("KeyW");
  try {
    for (let sample = 0; sample < 20; sample += 1) {
      await port.page.waitForTimeout(75);
      movementSamples.push(await runtimeState(port.page));
    }
  } finally {
    await port.page.keyboard.up("KeyW");
  }

  const moved = movementSamples.some((state) => {
    if (!state.position || !beforeMove.position) return false;
    const squaredDistance = state.position.reduce((total, value, index) => {
      const delta = value - beforeMove.position[index];
      return total + delta * delta;
    }, 0);
    return squaredDistance > 0.01;
  });
  expect(moved).toBe(true);
  expect(movementSamples.some((state) => state.currentAnimation === "Walk")).toBe(true);
  expect(port.errors).toEqual([]);
  expect(port.failedRequests).toEqual([]);
  expect(port.remoteRequests).toEqual([]);

  await context.close();
});

test("direct port exposes recovered source contracts and reload-safe SPA routes", async ({ request }) => {
  const [
    rootResponse,
    rootRouteResponse,
    manifestResponse,
    modulesResponse,
    clipsResponse,
    sceneResponse,
    shaderResponse,
    threePortRouteResponse,
    vendorResponse,
  ] = await Promise.all([
    request.get("http://127.0.0.1:43173/", { maxRedirects: 0 }),
    request.get("http://127.0.0.1:43173/phone"),
    request.get(`${PORT_ORIGIN}/PORT_MANIFEST.json`),
    request.get(`${PORT_ORIGIN}/EXTRACTED_MODULES.json`),
    request.get(`${PORT_ORIGIN}/data/character-animation-clips.json`),
    request.get(`${PORT_ORIGIN}/data/scenes/Scene_IslandWest.json`),
    request.get(`${PORT_ORIGIN}/src/shaders/water_depth_frag.glsl`),
    request.get(`${PORT_ORIGIN}/phone`),
    request.get("http://127.0.0.1:43173/vendor/main.35e6243a65453426.js"),
  ]);

  expect(rootResponse.status()).toBe(200);
  expect(rootResponse.headers()["content-type"]).toContain("text/html");

  for (const response of [
    rootRouteResponse,
    manifestResponse,
    modulesResponse,
    clipsResponse,
    sceneResponse,
    shaderResponse,
    threePortRouteResponse,
    vendorResponse,
  ]) {
    expect(response.ok()).toBe(true);
  }

  const manifest = await manifestResponse.json();
  const modules = await modulesResponse.json();
  const clips = await clipsResponse.json();
  const scene = await sceneResponse.json();
  expect(manifest).toMatchObject({
    engine: "three.js",
    engineRevision: 150,
    basePath: "./",
    entryPoint: "../index.html",
    vendorDirectory: "../vendor",
  });
  expect(modules.scenes).toContain("Scene_IslandWest.json");
  expect(modules.shaders).toContain("water_depth_frag.glsl");
  expect(clips).toMatchObject({
    fps: 30,
    clips: { Walk: [3, 27], Run: [33, 57] },
  });
  expect(scene.name).toBe("IslandWest");
  expect(scene.actors.length).toBeGreaterThan(0);
  expect(await shaderResponse.text()).toContain("waterDepth");
  expect(await rootRouteResponse.text()).toContain("startGame");
  expect(await threePortRouteResponse.text()).toContain("startGame");

  const runtimeFiles = [
    "index.html",
    "direct-port/index.html",
    "direct-port/src/bootstrap.js",
    "direct-port/src/page-behavior.js",
    "direct-port/src/session-pressure.js",
    "vendor/vendor.75f6e6ae65453426.js",
    "vendor/webgl.3250e36a65453426.js",
    "vendor/main.35e6243a65453426.js",
  ];
  for (const runtimeFile of runtimeFiles) {
    const source = fs.readFileSync(runtimeFile, "utf8");
    expect(source).not.toMatch(BLOCKED_ONLINE_SERVICES);
  }

  expect(fs.statSync("vendor").isDirectory()).toBe(true);
  expect(fs.existsSync("direct-port/assets")).toBe(false);
  const rootIndex = fs.readFileSync("index.html", "utf8");
  const portIndex = fs.readFileSync("direct-port/index.html", "utf8");
  for (const html of [rootIndex, portIndex]) {
    expect(html).toContain("connect-src 'self'");
    expect(html).toContain("frame-src 'none'");
    expect(html).toContain("startGame");
    expect(html).not.toMatch(/(?:src|href)=["']\//i);
    expect(html).not.toMatch(/<style(?:\s[^>]*)?>/i);
    expect(html).not.toContain("/three-port/assets/");
  }

  const recoveredCss = fs.readFileSync("direct-port/styles/recovered-game.css", "utf8");
  expect(recoveredCss.split(/\r?\n/).length).toBeGreaterThan(500);
  expect(recoveredCss).not.toMatch(/url\(\s*["']?\//i);

  for (const bundle of [
    "vendor/vendor.75f6e6ae65453426.js",
    "vendor/webgl.3250e36a65453426.js",
    "vendor/main.35e6243a65453426.js",
  ]) {
    expect(fs.readFileSync(bundle, "utf8")).not.toMatch(/["'`]\/assets\//);
  }
});
