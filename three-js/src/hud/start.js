import { ctaButton, el, playUiSound, unwrap } from "../dom.js";

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
    onClick: () => {
      const intro = app.$webgl?.store?.intro;
      if (!intro || unwrap(intro.journeyStarted)) return;
      intro.journeyStarted.set(true);
      playUiSound(app, "sfx_UI_Dialog_CameraMove_In", { delay: 200 });
    },
  });
  button.setAttribute("data-v-a8ff0715", "");
  layer.append(button);

  const page = el("div", { class: "page page-intro", "data-v-366b880d": "" });
  page.hidden = true;
  page.append(layer);
  host.prepend(page);

  const sync = () => {
    const intro = app.$webgl?.store?.intro;
    const vueStart = document.querySelector("button.start-btn:not(.pointer), a.start-btn:not(.pointer)");
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
