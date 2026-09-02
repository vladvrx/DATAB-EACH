import { w as watch } from "../../vendor/vendor.75f6e6ae65453426.js";
import { installChrome } from "./hud/chrome.js";
import { installDialog } from "./hud/dialog.js";
import { installItemNotification, installSpinner } from "./hud/pickups.js";
import { installStartScreen } from "./hud/start.js";

function waitForHost() {
  return new Promise((resolve) => {
    const existing = document.querySelector("#threejs-hud");
    if (existing) return resolve(existing);
    const observer = new MutationObserver(() => {
      const node = document.querySelector("#threejs-hud");
      if (!node) return;
      observer.disconnect();
      resolve(node);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
}

export function installHud(app) {
  waitForHost().then((host) => {
    let installed = false;
    const startWhenReady = () => {
      if (installed) return true;
      if (!app.$preloader.finished && !app.$preloader.hidden) return false;
      installed = true;
      installStartScreen(app, host);
      try { installChrome(app, host); } catch (error) { console.error("Three.js HUD chrome failed", error); }
      try { installDialog(app, host); } catch (error) { console.error("Three.js HUD dialog failed", error); }
      try { installItemNotification(app, host); } catch (error) { console.error("Three.js item notification failed", error); }
      try { installSpinner(app, host); } catch (error) { console.error("Three.js spinner failed", error); }
      document.documentElement.classList.add("threejs-hud-ready");
      return true;
    };
    if (!startWhenReady()) {
      watch(() => app.$preloader.finished || app.$preloader.hidden, (ready) => {
        if (ready) startWhenReady();
      });
    }
  });
}
