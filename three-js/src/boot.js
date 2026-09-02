import { initializePageBehavior } from "../../direct-port/src/page-behavior.js";

const siteDataUrl = new URL("../../direct-port/data/site.json", import.meta.url);
const logoUrl = new URL("../../reference/assets/databeach-logo.png", import.meta.url);
const cursorUrl = new URL("../../reference/assets/ui/game-cursor-4k.png", import.meta.url);

let startPromise;

function routerBasePath() {
  const path = window.location.pathname;
  for (const mount of ["/three-js", "/three-port", "/direct-port"]) {
    if (path === mount || path.startsWith(`${mount}/`)) return `${mount}/`;
  }
  return "/";
}

async function loadSiteData() {
  const response = await fetch(siteDataUrl);
  if (!response.ok) throw new Error(`Site data returned HTTP ${response.status}`);
  const data = await response.json();
  data.project.basepath = routerBasePath();
  data.project.url = "./";
  data.project.origin = window.location.origin;
  data.page.route.url = "./";
  return data;
}

async function boot() {
  document.documentElement.classList.remove("no-js");
  initializePageBehavior({ logoUrl, cursorUrl });
  window.__DATA = await loadSiteData();
  const { startEngine } = await import("./engine.js?v=toon-outline-4");
  return startEngine();
}

export function startThreeJsGame() {
  startPromise ??= boot();
  return startPromise;
}
