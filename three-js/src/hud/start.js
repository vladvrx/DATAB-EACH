import { ctaButton, el, playUiSound, unwrap } from "../dom.js";

function startJourney(app) {
  const intro = app.$webgl?.store?.intro;
  if (!intro || unwrap(intro.journeyStarted)) return false;
  intro.journeyStarted.set(true);
  playUiSound(app, "sfx_UI_Dialog_CameraMove_In", { delay: 200 });
  return true;
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
  button.addEventListener("pointerup", (event) => {
    event.preventDefault();
    startJourney(app);
  });
  layer.append(button);

  const page = el("div", { class: "page page-intro", "data-v-366b880d": "" });
  page.hidden = true;
  page.append(layer);
  host.prepend(page);

  document.addEventListener("pointerup", (event) => {
    const start = event.target?.closest?.(".start-btn");
    if (!start) return;
    startJourney(app);
  }, true);

  const sync = () => {
    const intro = app.$webgl?.store?.intro;
    const vueStart = document.querySelector("main.ui .page-intro .start-btn:not(.pointer)");
    const visible = intro
      && unwrap(intro.startJourneyVisible)
      && !unwrap(intro.journeyStarted)
      && !vueStart;
    layer.hidden = !visible;
    page.hidden = !visible;
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
}
