import { w as watch } from "../../../vendor/vendor.75f6e6ae65453426.js";
import { circleButton, ctaButton, el, lazyImg, playUiSound, setCircleIcon, unwrap } from "../dom.js";
import { iconUrl } from "../icons.js";

function flag(value) {
  return !!unwrap(value);
}

function installSoundButton(app, { tone, extraClass = "" } = {}) {
  const button = circleButton({
    label: app.$l("arialabel.sound"),
    icon: flag(app.$store.isAudioMuted) ? "sound-off" : "sound-on",
    tone,
    extraClass: `pointer sound-toggle ${extraClass}`.trim(),
    onClick: () => {
      app.$store.isAudioMuted = !flag(app.$store.isAudioMuted);
    },
  });
  button.setAttribute("data-sound-toggle", "");
  const sync = () => {
    const muted = flag(app.$store.isAudioMuted);
    button.classList.toggle("muted", muted);
    button.setAttribute("aria-pressed", muted ? "true" : "false");
    setCircleIcon(button, muted ? "sound-off" : "sound-on");
  };
  watch(() => flag(app.$store.isAudioMuted), sync, { immediate: true });
  return button;
}

function installHeader(app, host) {
  const header = el("header", { class: "app-header", "data-v-08688f2d": "" });
  const logo = el("div", {
    class: "logo white pointer",
    "data-v-08688f2d": "",
    tabindex: "0",
    onClick: () => { app.$store.isMenuOpen = true; },
  });
  logo.append(el("img", { src: "./reference/assets/databeach-logo.png", alt: "Data B-each", class: "logo-mark" }));
  const buttons = el("div", { class: "buttons", "data-v-08688f2d": "" });
  buttons.append(
    circleButton({
      label: app.$l("arialabel.customize"),
      icon: "profile",
      tone: "bordered",
      extraClass: "pointer",
      onClick: () => {
        playUiSound(app, "sfx_phone_click_soft");
        app.$store.isCustomizeOpen = true;
        app.$router.push({ name: "Customize" });
      },
    }),
    installSoundButton(app, { tone: "bordered" }),
  );
  header.append(logo, buttons);
  host.append(header);

  const visible = () => {
    const store = app.$store;
    const sceneState = unwrap(store.sceneState);
    const playing = unwrap(store.sceneStates?.Playing);
    return flag(store.isHeaderVisible)
      && !flag(store.isTransitionActive)
      && !flag(store.isMenuOpen)
      && !flag(store.isCustomizeOpen)
      && !flag(store.isDialogVisible)
      && !flag(store.isOverlayVisible)
      && Number(sceneState) >= Number(playing)
      && !unwrap(store.currentFullscreenVideo)
      && !flag(store.isCinematicActive);
  };
  watch(
    () => [
      app.$route?.name,
      unwrap(app.$store.sceneState),
      unwrap(app.$store.sceneStates?.Playing),
      flag(app.$store.isHeaderVisible),
      flag(app.$store.isTransitionActive),
      flag(app.$store.isMenuOpen),
      flag(app.$store.isCustomizeOpen),
      flag(app.$store.isDialogVisible),
      flag(app.$store.isOverlayVisible),
      unwrap(app.$store.currentFullscreenVideo),
      flag(app.$store.isCinematicActive),
    ],
    () => header.classList.toggle("is-visible", visible()),
    { immediate: true },
  );
}

function installMenuCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { setProgress() {}, dispose() {} };
  let progress = 0;
  let width = 1;
  let height = 1;
  const paint = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const bounds = canvas.parentElement?.getBoundingClientRect();
    width = Math.max(1, Math.round((bounds?.width || 400) * ratio));
    height = Math.max(1, Math.round((bounds?.height || 400) * ratio));
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${Math.round(width / ratio)}px`;
    canvas.style.height = `${Math.round(height / ratio)}px`;
    ctx.clearRect(0, 0, width, height);
    const stroke = Math.max(8, width / 19);
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#05ad90");
    gradient.addColorStop(1, "#78e8c8");
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, Math.max(1, (Math.min(width, height) - stroke) / 2), 0, Math.PI * 2);
    ctx.lineWidth = stroke - 1;
    ctx.strokeStyle = gradient;
    ctx.stroke();
    if (progress > 0) {
      ctx.beginPath();
      ctx.arc(
        width / 2,
        height / 2,
        Math.max(1, (Math.min(width, height) - stroke) / 2),
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * progress,
      );
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = stroke;
      ctx.stroke();
    }
  };
  const observer = new ResizeObserver(paint);
  if (canvas.parentElement) observer.observe(canvas.parentElement);
  paint();
  return {
    setProgress(value) {
      progress = value;
      paint();
    },
    dispose() {
      observer.disconnect();
    },
  };
}

function installMenu(app, host) {
  const menu = el("aside", { class: "menu", "data-v-2fd699fb": "", tabindex: "-1" });
  const background = el("div", { class: "menu-background", "data-v-2fd699fb": "" });
  const canvas = el("canvas");
  background.append(canvas);
  const wipe = installMenuCanvas(canvas);
  const container = el("div", { class: "menu-container", "data-v-2fd699fb": "" });
  const buttons = el("section", { class: "menu-buttons", "data-v-2fd699fb": "" });
  const close = () => { app.$store.isMenuOpen = false; };
  buttons.append(
    circleButton({
      label: app.$l("arialabel.close"),
      icon: "cross",
      tone: "green",
      extraClass: "pointer",
      onClick: close,
    }),
    installSoundButton(app, { tone: "white" }),
  );
  const infos = el("section", { class: "menu-infos", "data-v-2fd699fb": "" });
  infos.append(
    el("img", {
      src: "./reference/assets/databeach-logo.png",
      alt: "Data B-each",
      "data-v-2fd699fb": "",
      class: "menu-logo",
    }),
    el("p", { "data-v-2fd699fb": "", html: app.$l("global.baseline") }),
    ctaButton({
      text: app.$l("cta.discover"),
      color: "white",
      extraClass: "menu-cta pointer",
      href: app.$l("menu.islandlink"),
      onClick: () => app.$analytics.event({ event_category: "menu", event_action: "access_CCBUrl", event_value: "" }),
    }),
    ctaButton({
      text: app.$l("cta.start"),
      color: flag(app.$store.isGuest) ? "blue" : "gray",
      extraClass: "menu-cta pointer",
      onClick: () => {
        if (flag(app.$store.isGuest)) app.$savestate.clear();
        else {
          app.$store.isFormOpen = true;
          close();
        }
      },
    }),
  );
  container.append(buttons, infos);
  const overlay = el("div", {
    class: "menu-overlay",
    "data-bypass-touch": "",
    "data-v-2fd699fb": "",
    hidden: true,
    onClick: close,
  });
  menu.append(background, container, overlay);
  menu.inert = true;
  host.append(menu);

  watch(() => flag(app.$store.isMenuOpen), (open) => {
    menu.classList.toggle("is-open", open);
    menu.tabIndex = open ? 0 : -1;
    overlay.hidden = !open;
    menu.inert = !open;
    wipe.setProgress(open ? 1 : 0);
    if (open) playUiSound(app, "sfx_phone_swipe");
  }, { immediate: true });

  window.addEventListener("keydown", (event) => {
    if (event.code === "Escape" && flag(app.$store.isMenuOpen)) close();
  });
}

function installJoystick(app, host) {
  const aside = el("aside", { class: "joystick", "data-v-b69952e5": "" });
  const indicator = el("div", { class: "indicator", "data-v-b69952e5": "" });
  const outer = el("div", { class: "outer-circle", "data-v-b69952e5": "" }, [el("div", { class: "circle-outer", "data-v-b69952e5": "" })]);
  const inner = el("div", { class: "inner-circle", "data-v-b69952e5": "" }, [el("div", { class: "circle-inner", "data-v-b69952e5": "" })]);
  aside.append(indicator, outer, inner);
  host.append(aside);

  const hidden = () => {
    const store = app.$store;
    const joy = unwrap(app.$webgl?.store?.joystickVisible);
    return joy
      || store.isDialogVisibleDelayed
      || store.isInteractionButtonVisibleDelayed
      || store.isMenuOpen
      || store.isFormOpen
      || store.isTransitionActiveDelayed
      || store.sceneState < store.sceneStates.Playing
      || unwrap(app.$route?.name) === "Phone";
  };
  watch(hidden, (isHidden) => indicator.classList.toggle("hidden", isHidden), { immediate: true });

  const move = () => {
    const touch = app.$webgl?.input?.touch?.value;
    if (!touch) return;
    const x = touch.relativePos?.x || 0;
    const y = touch.relativePos?.y || 0;
    const firstX = touch.firstPos?.x || 0;
    const firstY = touch.firstPos?.y || 0;
    outer.style.transform = `translate(${Math.round(firstX)}px, ${Math.round(firstY)}px)`;
    const length = Math.sqrt(x * x + y * y) || 1;
    const clamped = Math.min(length, 75);
    inner.style.transform = `translate(${Math.round(x / length * clamped + firstX)}px, ${Math.round(y / length * clamped + firstY)}px)`;
    aside.classList.toggle("active", !!(touch.isDown || touch.pressed));
  };
  const loop = () => {
    move();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function installInteraction(app, host) {
  const aside = el("aside", { class: "interaction-button", "data-v-b03f534f": "", style: { visibility: "hidden" } });
  const wrapper = el("div", { class: "wrapper hidden", "data-v-b03f534f": "" });
  const bounce = el("div", { class: "bounce", "data-v-b03f534f": "" });
  const button = el("button", { class: "pointer", "data-v-b03f534f": "", type: "button" });
  const icon = lazyImg(iconUrl("interactions-yes"), "icon", "");
  const hint = el("p", { "data-v-b03f534f": "", text: app.$l("cta.interaction.tap") });
  button.append(icon, el("figure", { class: "round", "data-v-b03f534f": "" }));
  bounce.append(button, hint);
  wrapper.append(bounce);
  aside.append(wrapper);
  host.append(aside);

  let action = { active: false, mode: "tap", onTap() {}, onStart() {}, onStop() {}, onDone() {}, locked: false };

  const show = (next) => {
    action = { active: false, mode: "tap", onTap() {}, onStart() {}, onStop() {}, onDone() {}, locked: false, ...next };
    if (!next || next.locked) {
      wrapper.classList.add("hidden");
      app.$store.isInteractionButtonVisible = false;
      aside.style.visibility = "hidden";
      return;
    }
    action.active = true;
    icon.src = iconUrl(next.icon || "interactions-yes") || icon.src;
    wrapper.className = `wrapper mode-${action.mode}`;
    hint.textContent = action.mode === "hold" || action.mode === "hold-infinite"
      ? (app.$device.type.mobile ? app.$l("cta.interaction.touch") : app.$l("cta.interaction.click"))
      : app.$l("cta.interaction.tap");
    aside.style.visibility = "visible";
    app.$store.isInteractionButtonVisible = true;
  };

  const fire = () => {
    if (!action.active) return;
    if (action.mode === "tap" || action.mode === "click") action.onTap?.();
    else action.onStart?.();
  };
  const release = () => {
    if (action.mode === "hold" || action.mode === "hold-infinite") action.onStop?.();
  };
  button.addEventListener("mousedown", fire);
  button.addEventListener("touchstart", (event) => { event.preventDefault(); fire(); }, { passive: false });
  window.addEventListener("mouseup", release);
  window.addEventListener("touchend", release);

  const hideChrome = () => {
    const store = app.$store;
    return store.isDialogVisible
      || store.isMenuOpen
      || store.isFormOpen
      || store.isTransitionActive
      || store.isInteractionDone
      || store.sceneState < store.sceneStates.Playing
      || store.currentFullscreenVideo;
  };
  watch(hideChrome, (hidden) => wrapper.classList.toggle("hidden", hidden || !action.active));

  const ready = () => {
    const signal = app.$webgl?.store?.interactionButton;
    if (!signal?.watchImmediate) return false;
    signal.watchImmediate(show);
    return true;
  };
  if (!ready()) {
    const timer = window.setInterval(() => { if (ready()) window.clearInterval(timer); }, 200);
  }
}

export function installChrome(app, host) {
  installHeader(app, host);
  installMenu(app, host);
  installJoystick(app, host);
  installInteraction(app, host);
}
