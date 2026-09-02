import { initializePageBehavior } from "../../direct-port/src/page-behavior.js";
import {
  a as assets,
  aF as restoreReloadOverlay,
  aG as createGameApp,
  aH as resourceCache,
  aI as onDOMReady,
  aJ as createHistory,
  aK as getByPath,
  aL as FontFaceObserver,
} from "../../vendor/vendor.75f6e6ae65453426.js";
import { ThreeJsRoot } from "./root.js";
import { installHud } from "./hud.js";

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

  await restoreReloadOverlay();
  await assets.test();

  const vueApp = createGameApp(ThreeJsRoot);
  await vueApp.usePreview();
  vueApp.pluginManager.setOptions("router", {
    historyMode: createHistory,
  });

  if ((/iPad|iPhone|iPod/.test(navigator.platform) || ("MacIntel" === navigator.platform && navigator.maxTouchPoints > 1))) {
    resourceCache.add = () => {};
  }

  const app = await vueApp.pluginManager.install();
  const translate = app.$l;
  app.$tpl = (text) => {
    text = text.replace(/&#39;/g, "'").replace(/&quot;/g, '"');
    if (!text.includes("{{")) return text;
    return text.replace(/{{([ a-z0-9+_.-]+)}}/gi, (_, raw) => {
      let op = null;
      let amount = 0;
      let path = raw.trim();
      const math = path.match(/([+*/-]) ?([0-9]*)$/i);
      if (math) {
        path = path.slice(0, -math[0].length).trim();
        op = math[1];
        amount = parseFloat(math[2]);
      }
      let value = getByPath(app.$store, path);
      if (value == null) return "";
      if (!isNaN(parseFloat(value))) {
        if (op === "-") value -= amount;
        else if (op === "+") value += amount;
        else if (op === "*") value *= amount;
        else if (op === "/") value /= amount;
      }
      return value;
    });
  };
  app.$l = app.$translation = (key, fallback = false) => app.$tpl(translate(key, fallback));
  app.$analytics.event = (payload) => app.$analytics.rawEvent({ event: "ga_event", ...payload });
  app.$preloader.setMinimumTaskCount(25);

  const params = new URL(document.location).searchParams;
  const access = params.has("k") && params.get("k");
  if (access) await app.$savestate.auth(access);

  const track = async (work) => {
    const task = app.$preloader.createTask();
    await work;
    task.finish();
    return work;
  };

  await Promise.all([
    track(app.$savestate.preload()),
    track(app.$manifest.load()),
    track(app.$partners.load()),
    track(app.$items.load()),
  ]);
  await track(app.$quests.load());
  await app.$partners.initVariables();
  await app.$savestate.init({
    requestedPartner: null,
    requestedChatAssistant: false,
  });
  await app.$quests.init();
  await app.$partners.linkQuests();

  app.$preloader.task(Promise.all([
    new FontFaceObserver("Gilmer", { weight: 500 }).load(),
    new FontFaceObserver("Gilmer", { weight: 700 }).load(),
    new FontFaceObserver("Comfortaa", { weight: 400 }).load(),
  ]).catch(() => {}));

  vueApp.mount("#app");
  installHud(app);

  window.__THREE_JS_GAME__ = { vueApp, app };
  return app;
}

export function startThreeJsGame() {
  startPromise ??= new Promise((resolve, reject) => {
    onDOMReady(() => boot().then(resolve, reject));
  });
  return startPromise;
}
