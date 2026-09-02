import { w as watch } from "../../../vendor/vendor.75f6e6ae65453426.js";
import { el, playUiSound, unwrap } from "../dom.js";

const ITEM_IMAGES = {
  compass: "./reference/assets/compass.b2f451c665453426.png",
  disk: "./reference/assets/disk.f55f04a765453426.png",
  flag: "./reference/assets/flag.d3788bd965453426.png",
  hammer: "./reference/assets/hammer.2c9aee8665453426.png",
  helmet: "./reference/assets/helmet.da38033f65453426.png",
  lightbulb: "./reference/assets/lightbulb.cd23ded965453426.png",
  resortkey: "./reference/assets/resortkey.c1564def65453426.png",
  scissor: "./reference/assets/scissor.9a36d8ba65453426.png",
  screwdriver: "./reference/assets/screwdriver.dac0be1665453426.png",
  shears: "./reference/assets/shears.fc5233c565453426.png",
  stethoscope: "./reference/assets/stethoscope.325dc80665453426.png",
  wateringcan: "./reference/assets/wateringcan.734ea1e565453426.png",
  zipline: "./reference/assets/zipline.1612767b65453426.png",
};

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function installItemNotification(app, host) {
  let panel = null;
  let token = 0;

  const hide = async (onDone) => {
    if (!panel) return;
    panel.classList.add("hidden");
    playUiSound(app, "sfx_phone_swipe", { delay: 400 });
    await sleep(550);
    panel.remove();
    panel = null;
    onDone?.();
  };

  watch(
    () => unwrap(app.$store.itemNotification),
    async (next) => {
      const current = ++token;
      if (!next) {
        await hide();
        return;
      }
      panel?.remove();
      const aside = el("aside", { class: "item-notification", "data-v-1efd6f75": "" });
      const figure = el("figure", { "data-v-1efd6f75": "" });
      const src = ITEM_IMAGES[next.image] || ITEM_IMAGES.hammer;
      figure.append(el("img", { src, alt: "", class: "lazy-img loaded" }));
      aside.append(figure, el("div", { class: "effect", "data-v-1efd6f75": "" }));
      host.append(aside);
      panel = aside;
      aside.getBoundingClientRect();
      playUiSound(app, "sfx_quest_getObject");
      aside.classList.add("visible");
      await sleep(1500);
      if (current !== token) return;
      if (next.variable) app.$savestate.setVariable(next.variable, true);
      await sleep(100);
      if (current !== token) return;
      app.$store.itemNotification = null;
    },
    { immediate: true },
  );
}

export function installSpinner(app, host) {
  const aside = el("aside", { class: "spinner", "data-v-d2bf7f03": "" });
  aside.append(
    el("div", { class: "spinner-container", "data-v-d2bf7f03": "" }, [
      el("div", { class: "spinner-shape", "data-v-d2bf7f03": "" }),
    ]),
  );
  host.append(aside);
  watch(
    () => !!unwrap(app.$store.isSpinnerVisible),
    (visible) => aside.classList.toggle("visible", visible),
    { immediate: true },
  );
}
