import { w as watch } from "../../vendor/vendor.75f6e6ae65453426.js";
import { installChrome } from "./hud/chrome.js";
import { installDialog } from "./hud/dialog.js";
import { installPhone } from "./hud/phone.js";
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
      installChrome(app, host);
      installPhone(app, host);
      installDialog(app, host);
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
