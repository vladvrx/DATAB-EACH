const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");

test.use({
  channel: "chrome",
  headless: true,
  viewport: { width: 1280, height: 720 },
});
test.setTimeout(180_000);

const ROOT = path.resolve(__dirname, "..");
const THREE_JS_URL = "http://127.0.0.1:43173/three-js";
const VENDOR = path.join(ROOT, "vendor/vendor.75f6e6ae65453426.js");
const BOAT = path.join(ROOT, "reference/assets/Asset_BoatYellow.9ec7874765453426.glb");
const WEBGL = path.join(ROOT, "vendor/webgl.3250e36a65453426.js");

function parseGlb(file) {
  const buffer = fs.readFileSync(file);
  const jsonLength = buffer.readUInt32LE(12);
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString());
  const binStart = 20 + jsonLength;
  const binLength = buffer.readUInt32LE(binStart);
  const bin = buffer.subarray(binStart + 8, binStart + 8 + binLength);
  return { json, bin };
}

test("intro ship, west-island music, and loader wipe are wired in the bundles", () => {
  const vendor = fs.readFileSync(VENDOR, "utf8");
  expect(vendor).toContain("rgb(255, 64, 96)");
  expect(vendor).toContain("rgb(255, 214, 0)");
  expect(vendor).toContain("rgb(48, 220, 120)");
  expect(vendor).toContain("rgb(112, 191, 228)");
  expect(vendor).toContain("g = (1 - p) * f");
  expect(vendor).not.toContain('bgm: "music_intro"');
  expect(vendor).not.toContain('bgm: "music_secret"');
  expect(vendor).not.toContain('bgm: "music_minigame_loop"');
  expect(vendor.match(/bgm: "music_island_west"/g)?.length).toBeGreaterThanOrEqual(4);

  const webgl = fs.readFileSync(WEBGL, "utf8");
  expect(webgl).toContain("character.df6ab95f65453426.glb");
  expect(webgl).not.toMatch(/character\.df6ab95f65453426\.glb\?/);

  const glb = parseGlb(BOAT);
  expect(glb.json.asset.extras.databEachIntroShipPaint).toBe(1);
  const uvAccessor = glb.json.accessors[glb.json.meshes[0].primitives[0].attributes.TEXCOORD_0];
  const view = glb.json.bufferViews[uvAccessor.bufferView];
  const uvs = new Set();
  for (let index = 0; index < uvAccessor.count; index++) {
    const offset = (view.byteOffset || 0) + index * 8;
    uvs.add(`${glb.bin.readFloatLE(offset).toFixed(5)},${glb.bin.readFloatLE(offset + 4).toFixed(5)}`);
  }
  expect([...uvs].sort()).toEqual(["0.00049,0.29492", "0.00049,0.29883"]);
});

test("Three.js intro ship is red/yellow and only west-island music plays", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack || error.message));

  await page.goto(THREE_JS_URL, { waitUntil: "domcontentloaded" });

  await page.waitForFunction(() => {
    const text = document.querySelector(".preloader-counter")?.textContent || "";
    return text === "100" || document.documentElement.classList.contains("preloader-hidden");
  }, { timeout: 90_000 });
  await page.waitForTimeout(350);
  await page.screenshot({ path: "/tmp/loader-wipe-upside-down.png", type: "png" });

  await expect(page.locator("#preloader")).toBeHidden({ timeout: 90_000 });
  await expect(page.locator(".start-btn").first()).toBeVisible({ timeout: 60_000 });

  const info = await page.evaluate(() => {
    const app = window.__THREE_JS_GAME__?.app;
    const webgl = app?.$webgl;
    const audio = webgl?.audio;
    const geometry = webgl?.resources?.assets?.BoatYellow?.geometry;
    const uv = geometry?.attributes?.uv?.array;
    const unique = new Set();
    if (uv) {
      for (let index = 0; index < uv.length; index += 2) {
        unique.add(`${uv[index].toFixed(5)},${uv[index + 1].toFixed(5)}`);
      }
    }
    return {
      scene: webgl?.scenes?.currentSceneID?.value ?? null,
      sceneBgm: webgl?.scenes?.current?.props?.bgm ?? null,
      wrapped: !!audio?.__westIslandOnly,
      uniqueUvs: [...unique].sort(),
      blockedIntro: typeof audio?.playSound === "function" ? audio.playSound("music_intro") : "missing",
      characterUrl: webgl?.resources?.assets?.DataBeach ? true : true,
    };
  });

  expect(info.scene).toBe("IslandIntro");
  expect(info.sceneBgm).toBe("music_island_west");
  expect(info.wrapped).toBe(true);
  expect(info.blockedIntro).toBeUndefined();
  expect(info.uniqueUvs).toEqual(["0.00049,0.29492", "0.00049,0.29883"]);
  expect(errors).toEqual([]);

  await page.screenshot({ path: "/tmp/intro-ship-red-yellow.png", type: "png" });
});
