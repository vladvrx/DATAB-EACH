import {
  a as assets,
  aF as restoreReloadOverlay,
  aG as createGameApp,
  aH as resourceCache,
  aI as onDOMReady,
  aJ as createHistory,
  aK as getByPath,
  aL as FontFaceObserver,
  w as watch,
} from "../../vendor/vendor.75f6e6ae65453426.js";
import { ThreeJsRoot } from "./root.js";
import { installHud } from "./hud.js";

function disablePhoneAndMap(app) {
  const blocked = new Set(["Phone", "QuestsDebug"]);
  for (const method of ["push", "replace"]) {
    const original = app.$router[method]?.bind(app.$router);
    if (!original) continue;
    app.$router[method] = (location, ...args) => {
      const name = location && typeof location === "object" ? location.name : null;
      if (blocked.has(name)) return Promise.resolve();
      return original(location, ...args);
    };
  }
  if (app.$store?.phone) app.$store.phone.isVisible = false;
}

export async function startEngine() {
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
  disablePhoneAndMap(app);
  watch(() => app.$store.isMovingWithMouse, (moving) => {
    document.body.classList.toggle("moving-with-mouse", !!moving);
  }, { immediate: true });
  let biomeId = null;
  watch(() => app.$store.currentBiome, (biome) => {
    const id = biome?.id || biome;
    if (biomeId) document.body.classList.remove(`biome-${biomeId}`);
    if (id) document.body.classList.add(`biome-${id}`);
    biomeId = id || null;
  }, { immediate: true });
  const translate = app.$l;
  app.$tpl = (text) => {
    text = String(text ?? "").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
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

  const mount = () => {
    let stopPreloaderWatch = watch(() => app.$preloader.hidden, (hidden) => {
      if (!hidden) return;
      stopPreloaderWatch?.();
      window.setTimeout(() => {
        document.documentElement.classList.add("preloader-hidden");
      }, 700);
    });
    vueApp.mount("#app");
    installHud(app);
    window.__THREE_JS_GAME__ = { vueApp, app };
  };

  await new Promise((resolve, reject) => {
    onDOMReady(() => {
      try {
        mount();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });

  return app;
}
