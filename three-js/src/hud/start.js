import { ctaButton, el, playUiSound, unwrap } from "../dom.js";

function startJourney(app) {
  const intro = app.$webgl?.store?.intro;
  if (!intro || unwrap(intro.journeyStarted)) return false;
  intro.journeyStarted.set(true);
  playUiSound(app, "sfx_UI_Dialog_CameraMove_In", { delay: 200 });
  return true;
}

function vueStartButton() {
  return [...document.querySelectorAll(".page-intro .start-btn")].find((node) => !node.closest("#threejs-hud"));
}

export function installStartScreen(app, host) {
  const layer = el("div", {
    class: "start",
    "data-v-a8ff0715": "",
    hidden: true,
  });
  const button = ctaButton({
    text: app.$l("cta.start"),
    color: "white",
    extraClass: "start-btn pointer",
    onClick: () => startJourney(app),
  });
  button.setAttribute("data-v-a8ff0715", "");
  layer.append(button);

  const page = el("div", { class: "page page-intro threejs-start-fallback", "data-v-366b880d": "" });
  page.hidden = true;
  page.inert = true;
  page.append(layer);
  host.prepend(page);

  const sync = () => {
    const intro = app.$webgl?.store?.intro;
    const vueStart = vueStartButton();
    const visible = !!intro
      && unwrap(intro.startJourneyVisible)
      && !unwrap(intro.journeyStarted)
      && !vueStart;
    layer.hidden = !visible;
    page.hidden = !visible;
    page.inert = !visible;
  };

  const bind = () => {
    const intro = app.$webgl?.store?.intro;
    if (!intro?.startJourneyVisible?.watchImmediate) return false;
    intro.startJourneyVisible.watchImmediate(sync);
    intro.journeyStarted.watchImmediate(sync);
    return true;
  };
  if (!bind()) {
    const timer = window.setInterval(() => { if (bind()) window.clearInterval(timer); }, 200);
  }

  new MutationObserver(sync).observe(document.querySelector("main.ui") ?? document.body, {
    childList: true,
    subtree: true,
  });
}
