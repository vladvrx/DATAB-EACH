import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const submissionDir = path.join(rootDir, "submission");
const buildDir = path.join(rootDir, "build");

console.log("=== Packaging Data B-each Competition Submission ===");

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function copyFile(src, dest) {
  await ensureDir(path.dirname(dest));
  await fs.copyFile(src, dest);
}

async function copyDir(src, dest) {
  await ensureDir(dest);
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function main() {
  // Clean submission folder
  await fs.rm(submissionDir, { recursive: true, force: true });
  await ensureDir(submissionDir);
  await ensureDir(buildDir);

  console.log("1. Setting up vendor directory...");
  const vendorDir = path.join(submissionDir, "vendor");
  await ensureDir(vendorDir);

  // Copy Three.js core
  await copyFile(
    path.join(rootDir, "node_modules/three/build/three.module.js"),
    path.join(vendorDir, "three.module.js")
  );

  // Copy Three.js Addons
  await copyFile(
    path.join(rootDir, "node_modules/three/examples/jsm/loaders/GLTFLoader.js"),
    path.join(vendorDir, "GLTFLoader.js")
  );
  await copyFile(
    path.join(rootDir, "node_modules/three/examples/jsm/loaders/DRACOLoader.js"),
    path.join(vendorDir, "DRACOLoader.js")
  );
  await copyFile(
    path.join(rootDir, "node_modules/three/examples/jsm/controls/OrbitControls.js"),
    path.join(vendorDir, "OrbitControls.js")
  );
  await copyFile(
    path.join(rootDir, "node_modules/three/examples/jsm/utils/BufferGeometryUtils.js"),
    path.join(vendorDir, "BufferGeometryUtils.js")
  );

  // Adjust imports in vendor addons if needed (change '../utils/' to './' if local)
  let gltfSrc = await fs.readFile(path.join(vendorDir, "GLTFLoader.js"), "utf8");
  gltfSrc = gltfSrc.replace(`from '../utils/BufferGeometryUtils.js'`, `from './BufferGeometryUtils.js'`);
  await fs.writeFile(path.join(vendorDir, "GLTFLoader.js"), gltfSrc, "utf8");

  // Copy Draco decoder
  const dracoSrc = path.join(rootDir, "reference/vendors/draco");
  const dracoDest = path.join(vendorDir, "draco");
  await copyDir(dracoSrc, dracoDest);

  console.log("2. Copying 3D assets and graphics...");
  const assetsDir = path.join(submissionDir, "reference/assets");
  await ensureDir(assetsDir);

  const neededAssets = [
    "Asset_TechCompany03HouseOn.95ee562765453426.glb",
    "Asset_BuildingD.9f9b006f65453426.glb",
    "Asset_TechCompany03HouseOff.a23f6b6965453426.glb",
    "Asset_BeachUmbrella.ebc2bd3065453426.glb",
    "Asset_BeachBar.23745a6b65453426.glb",
    "Asset_ShopRamen.56282a3f65453426.glb",
    "Asset_SurfShop.0bb1733265453426.glb",
    "Asset_StiltHouseA.c6e4a15a65453426.glb",
    "Asset_PalmTreeTallA.e36ef4cc65453426.glb",
    "Asset_GrowableTreeLarge.abc3c7b965453426.glb",
    "Asset_BeachChair.728122b565453426.glb",
    "Asset_BeachBall.f2c6e9e765453426.glb",
    "Asset_Algae.e4fb453265453426.glb",
    "character.df6ab95f65453426.glb",
    "databeach-logo.png"
  ];

  for (const file of neededAssets) {
    const src = path.join(rootDir, "reference/assets", file);
    const dest = path.join(assetsDir, file);
    await copyFile(src, dest);
  }

  // Copy favicon and icons
  await copyFile(
    path.join(rootDir, "reference/favicon.ico"),
    path.join(submissionDir, "favicon.ico")
  );

  console.log("3. Assembling readable unminified index.html...");
  const css = await fs.readFile(path.join(rootDir, "game-src/styles/game.css"), "utf8");
  const buildingsSrc = await fs.readFile(path.join(rootDir, "game-src/sim/buildings.js"), "utf8");
  const stateSrc = await fs.readFile(path.join(rootDir, "game-src/sim/state.js"), "utf8");
  const economySrc = await fs.readFile(path.join(rootDir, "game-src/sim/economy.js"), "utf8");
  const synthSrc = await fs.readFile(path.join(rootDir, "game-src/audio/synth.js"), "utf8");
  const sceneSrc = await fs.readFile(path.join(rootDir, "game-src/render/scene.js"), "utf8");
  const touristsSrc = await fs.readFile(path.join(rootDir, "game-src/render/tourists.js"), "utf8");
  const hudSrc = await fs.readFile(path.join(rootDir, "game-src/ui/hud.js"), "utf8");
  const drawerSrc = await fs.readFile(path.join(rootDir, "game-src/ui/drawer.js"), "utf8");
  const modalsSrc = await fs.readFile(path.join(rootDir, "game-src/ui/modals.js"), "utf8");
  const mainSrc = await fs.readFile(path.join(rootDir, "game-src/main.js"), "utf8");

  // Helper to remove import/export statements for inlined modules
  function cleanModuleSource(src) {
    return src
      .replace(/^import\s+.*?;\s*$/gm, "")
      .replace(/^export\s+(const|class|function|let|var)\s+/gm, "$1 ")
      .replace(/^export\s+default\s+.*?;?\s*$/gm, "");
  }

  const combinedCode = `
// =====================================================================
// DATA B-EACH: ISLAND ECO-RESORT (SIMULATION & MANAGEMENT)
// SINGLE-PLAYER PORTRAIT PROTOTYPE
// =====================================================================

// --- BUILDINGS CATALOG ---
${cleanModuleSource(buildingsSrc)}

// --- SIMULATION STATE ---
${cleanModuleSource(stateSrc)}

// --- ECONOMY ENGINE ---
${cleanModuleSource(economySrc)}

// --- AUDIO SYNTHESIZER ---
${cleanModuleSource(synthSrc)}

// --- THREE.JS SCENE RENDERER ---
${cleanModuleSource(sceneSrc)}

// --- TOURISTS MANAGER ---
${cleanModuleSource(touristsSrc)}

// --- UI HUD ---
${cleanModuleSource(hudSrc)}

// --- UI DRAWER ---
${cleanModuleSource(drawerSrc)}

// --- UI MODALS ---
${cleanModuleSource(modalsSrc)}

// --- MAIN GAME COORDINATOR ---
${cleanModuleSource(mainSrc)}

// Boot the game when DOM is ready
window.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("app");
  window.game = new DataBeachGame(root);
});
`;

  const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; connect-src 'self' data: blob:; media-src 'self' data: blob:; object-src 'none'; worker-src 'self' blob:;">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover, user-scalable=no">
    <meta name="theme-color" content="#06111c">
    <title>Data B-each: Island Eco-Resort</title>
    <link rel="icon" href="./favicon.ico">
    <style>
${css}
    </style>
    <script type="importmap">
    {
      "imports": {
        "three": "./vendor/three.module.js",
        "three/addons/loaders/GLTFLoader.js": "./vendor/GLTFLoader.js",
        "three/addons/loaders/DRACOLoader.js": "./vendor/DRACOLoader.js",
        "three/addons/controls/OrbitControls.js": "./vendor/OrbitControls.js"
      }
    }
    </script>
  </head>
  <body>
    <main id="app" role="main"></main>
    <script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

${combinedCode}
    </script>
  </body>
</html>`;

  await fs.writeFile(path.join(submissionDir, "index.html"), indexHtml, "utf8");

  // Also update the root index.html so the active repo serves the simulation directly!
  // But wait, the root index.html needs vendor/ and reference/ paths to match.
  // We will copy submission/vendor into root/vendor/sim-vendor or maintain both.

  console.log("4. Validating offline rules...");
  const externalMatches = indexHtml.match(/https?:\/\/[^\s"'>]+/gi) || [];
  const invalidUrls = externalMatches.filter(
    (u) => !u.includes("w3.org") // XML namespace is fine
  );

  if (invalidUrls.length > 0) {
    throw new Error(`Found disallowed external URLs in index.html: ${invalidUrls.join(", ")}`);
  }
  console.log("✅ 0 external network requests confirmed!");

  console.log("5. Creating submission zip archive...");
  const zipPath = path.join(buildDir, "DATAB-EACH-submission.zip");
  if (await fs.stat(zipPath).catch(() => null)) {
    await fs.unlink(zipPath);
  }

  // Create zip using PowerShell Compress-Archive
  const psCmd = `powershell -NoProfile -Command "Compress-Archive -Path '${submissionDir}\\*' -DestinationPath '${zipPath}' -CompressionLevel Optimal"`;
  execSync(psCmd, { stdio: "inherit" });

  const stats = await fs.stat(zipPath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`\n🎉 SUBMISSION ZIP CREATED: ${zipPath}`);
  console.log(`📦 Size: ${stats.size} bytes (${sizeMB} MB) - Competition Limit: 35.00 MB`);

  if (stats.size > 35 * 1024 * 1024) {
    throw new Error(`CRITICAL: Zip exceeds 35MB limit! (${sizeMB} MB)`);
  }

  console.log("✅ Strict size validation PASSED!");
}

main().catch((err) => {
  console.error("Packaging failed:", err);
  process.exit(1);
});
