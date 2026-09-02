const { test, expect } = require("@playwright/test");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const TEST_PORT = 43199;
const zipPath = path.resolve(__dirname, "../build/DATAB-EACH-submission.zip");
const cleanDir = path.resolve(__dirname, "../clean-test-env");

let server;

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html": return "text/html; charset=utf-8";
    case ".js": case ".mjs": return "application/javascript; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".json": return "application/json; charset=utf-8";
    case ".png": return "image/png";
    case ".jpg": case ".jpeg": return "image/jpeg";
    case ".svg": return "image/svg+xml";
    case ".wasm": return "application/wasm";
    case ".glb": return "model/gltf-binary";
    default: return "application/octet-stream";
  }
}

test.beforeAll(async () => {
  // 1. Clean and unzip into cleanDir
  if (fs.existsSync(cleanDir)) {
    fs.rmSync(cleanDir, { recursive: true, force: true });
  }
  fs.mkdirSync(cleanDir, { recursive: true });

  console.log("Unzipping submission package into clean folder...");
  execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${cleanDir}' -Force"`);

  // 2. Start minimal static local HTTP server
  server = http.createServer((req, res) => {
    let reqUrl = req.url.split("?")[0];
    if (reqUrl === "/" || reqUrl === "") reqUrl = "/index.html";

    const safePath = path.normalize(decodeURIComponent(reqUrl)).replace(/^(\.\.[\/\\])+/, "");
    const fullPath = path.join(cleanDir, safePath);

    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      res.writeHead(200, {
        "Content-Type": getContentType(fullPath),
        "Access-Control-Allow-Origin": "*"
      });
      fs.createReadStream(fullPath).pipe(res);
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    }
  });

  await new Promise((resolve) => server.listen(TEST_PORT, "127.0.0.1", resolve));
  console.log(`Test static server running at http://127.0.0.1:${TEST_PORT}/`);
});

test.afterAll(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

test.use({
  channel: "msedge",
  headless: true,
  viewport: { width: 390, height: 844 } // Portrait mobile screen
});

test("verified offline submission runs cleanly in portrait", async ({ page }) => {
  const pageErrors = [];
  const externalRequests = [];

  page.on("pageerror", (err) => {
    console.error("PAGE ERROR:", err);
    pageErrors.push(err.stack || err.message);
  });

  // Intercept and assert NO external network calls
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (!url.startsWith(`http://127.0.0.1:${TEST_PORT}`) && !url.startsWith("data:") && !url.startsWith("blob:")) {
      externalRequests.push(url);
      route.abort();
    } else {
      route.continue();
    }
  });

  await page.goto(`http://127.0.0.1:${TEST_PORT}/index.html`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // 1. Verify canvas initialized
  const canvas = page.locator("#viewport-container canvas");
  await expect(canvas).toBeVisible();

  // 2. Verify HUD elements
  const hud = page.locator("#game-hud");
  await expect(hud).toBeVisible();
  await expect(page.locator("[data-rating]")).toHaveText(/[1-5]\.[0-9]/);
  await expect(page.locator("[data-credits]")).toBeVisible();

  // 3. Test Drawer interactions
  const buildButtons = page.locator(".build-action-btn");
  await expect(buildButtons.first()).toBeVisible();

  // Tap first available build button (Sun Loungers or Beach Bar)
  await buildButtons.first().click();
  await page.waitForTimeout(1000);

  // Check that Data Credits changed (building was paid for)
  const creditsText = await page.locator("[data-credits]").textContent();
  console.log("Credits after building:", creditsText);
  expect(creditsText).not.toBe("2,500");

  // 4. Test Category Tab Switching
  await page.locator('.tab-btn[data-tab="energy"]').click();
  await page.waitForTimeout(500);
  await expect(page.locator(".card-title").first()).toContainText("Solar Canopy");

  await page.locator('.tab-btn[data-tab="eco"]').click();
  await page.waitForTimeout(500);
  await expect(page.locator(".card-title").first()).toContainText("Biolum Palm Grove");

  // Verify zero external network calls occurred
  expect(externalRequests).toHaveLength(0);
  // Verify zero runtime uncaught exceptions
  expect(pageErrors).toHaveLength(0);

  console.log("✅ Playwright offline portrait test completely PASSED!");
});
