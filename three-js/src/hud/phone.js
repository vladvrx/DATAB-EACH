import { w as watch } from "../../../vendor/vendor.75f6e6ae65453426.js";
import { ab as mapAtlas } from "../../../vendor/vendor.75f6e6ae65453426.js";
import { circleButton, el, lazyImg, playUiSound, unwrap } from "../dom.js";
import { iconUrl, selectAsset } from "../icons.js";

const NAV_TABS = ["Map", "Partners", "Accessories", "Customization", "Quests"];
const HUD_TABS = ["Map", "Partners", "Accessories", "Quests", "Customize"];

function questState(quest) {
  const unlocked = unwrap(quest.unlocked);
  const completed = unwrap(quest.completed);
  if (!unlocked) return "locked";
  if (completed) return "completed";
  return "in-progress";
}

function layoutPhone(app, phoneEl) {
  const viewport = app.$viewport;
  const phone = app.$store.phone;
  const designWidth = 375;
  const width = viewport.width;
  const height = viewport.height;
  const mobile = app.$device.type.mobile && width < 641;
  const full = mobile || width < 641;
  const availableHeight = full ? height : 0.81 * height;
  const scale = Math.min(width / designWidth, availableHeight / 590);
  const phoneWidth = full ? width : Math.floor(designWidth * scale);
  const phoneHeight = full ? height : Math.floor(590 * scale);
  const ratio = Math.round((phoneWidth / phoneHeight) * 1000) / 1000;
  let textScale = 1;
  if (ratio < 0.7) textScale = 1.5;
  else if (ratio < 1) textScale = 1.3;
  const metrics = {
    border: 15 * scale,
    x: full ? 0 : Math.floor(0.5 * width - 0.5 * phoneWidth),
    y: full ? 0 : Math.floor(0.5 * height - 0.5 * phoneHeight),
    width: phoneWidth,
    height: phoneHeight,
    scale,
    ratio,
    textScale,
    isFullScreen: full,
    useRealScroll: mobile,
  };
  phoneEl.classList.toggle("is-full-screen", !!full);
  phoneEl.classList.toggle("use-real-scroll", !!mobile);
  phoneEl.style.setProperty("--phone-scale", metrics.scale);
  phoneEl.style.setProperty("--phone-text-scale", metrics.textScale);
  phoneEl.style.setProperty("--phone-width", `${metrics.width}px`);
  phoneEl.style.setProperty("--phone-height", `${metrics.height}px`);
  phoneEl.style.setProperty("--phone-border", `${metrics.border}px`);
  phoneEl.style.setProperty("--phone-x", `${metrics.x}px`);
  phoneEl.style.setProperty("--phone-y", `${metrics.y}px`);
  phoneEl.style.setProperty("--phone-ratio", metrics.ratio);
  Object.assign(phone, metrics);
}

function questCard(app, quest) {
  const state = questState(quest);
  const article = el("article", {
    class: `card ${quest.type} ${state}`,
    "data-v-a6a26e1b": "",
  });
  const header = el("header", { class: "card-header", "data-v-a6a26e1b": "" });
  const headerText = el("div", { class: "card-header-text", "data-v-a6a26e1b": "" });
  if (state === "completed") {
    headerText.append(el("span", { class: "text", "data-v-a6a26e1b": "", html: quest.title }));
  } else {
    headerText.append(el("span", { class: "plus", "data-v-a6a26e1b": "", text: "+" }));
    headerText.append(el("span", { "data-v-a6a26e1b": "", text: String(quest.reward || 0) }));
    headerText.append(lazyImg(iconUrl("phone-point", 128, 256), "data-points"));
  }
  header.append(headerText);
  const iconWrap = el("div", { class: "card-icon", "data-v-a6a26e1b": "" });
  iconWrap.append(lazyImg(iconUrl(quest.icon, 128, 256), "quest-icon", quest.title));
  const body = el("div", { class: "card-body", "data-v-a6a26e1b": "" });
  const section = el("section", { class: state === "completed" ? "reward" : "card-content", "data-v-a6a26e1b": "" });
  if (state === "in-progress") {
    section.append(el("h3", { "data-v-a6a26e1b": "", html: app.$tpl(quest.description ?? "") }));
    if (quest.hasProgressBar) {
      const bar = el("div", { class: "progress-bar", "data-v-4a6162bf": "" });
      const fill = el("div", { class: "bar", "data-v-4a6162bf": "" });
      const norm = unwrap(quest.progressBarNorm) || 0;
      fill.style.setProperty("--bar-size", `${norm * 100}%`);
      bar.append(fill);
      section.append(bar);
    }
  } else if (state === "locked") {
    section.append(el("p", { "data-v-a6a26e1b": "", html: app.$tpl(quest.unlockText ?? "") }));
  }
  body.append(section);
  article.append(header, iconWrap, body, el("div", { class: "card-background", "data-v-a6a26e1b": "" }));
  return article;
}

function renderQuests(app, mount) {
  const article = el("article", { class: "phone-tab quests", "data-v-175b67d6": "" });
  article.append(el("header", {}, [
    el("h1", { html: app.$l("phone.title.quest") }),
    el("p", { html: app.$l("phone.desc.quest") }),
  ]));
  const rank = { Main: 1e7, Partner: 2, Side: 1, Fintech: 1e7 };
  const open = [];
  const locked = [];
  const done = [];
  Object.values(app.$quests.list)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .sort((a, b) => ((rank[b.type] || 0) + (b.reward || 0) * 100) - ((rank[a.type] || 0) + (a.reward || 0) * 100))
    .forEach((quest) => {
      const state = questState(quest);
      if (state === "completed") done.push(quest);
      else if (state === "locked" && quest.unlockText) locked.push(quest);
      else if (state === "in-progress") open.push(quest);
    });
  const list = (items, title) => {
    const section = el("section", { "data-v-175b67d6": "" });
    if (title) section.append(el("h2", { class: "subtitle", "data-v-175b67d6": "", text: title }));
    const ul = el("ul", { class: "quests-list", "data-v-175b67d6": "" });
    for (const quest of items) ul.append(el("li", { class: questState(quest) === "completed" ? "completed-quest" : "" }, [questCard(app, quest)]));
    section.append(ul);
    return section;
  };
  article.append(list(open));
  if (locked.length) article.append(list(locked, app.$l("quest.locked")));
  if (done.length) article.append(list(done, app.$l("quest.completed")));
  mount.replaceChildren(article);
}

function renderMap(app, mount) {
  const article = el("article", { class: "phone-tab map", "data-v-d7359a46": "" });
  const scale = 0.5;
  const mapSize = 1024;
  article.style.setProperty("--map-ratio", mapAtlas.ratio.toFixed(4));
  article.style.setProperty("--map-size", `${mapSize}px`);
  const container = el("div", { class: "map-container", "data-v-d7359a46": "", "data-pointer": "" });
  const contents = el("div", { class: "map-contents", "data-v-d7359a46": "" });
  const illustration = selectAsset(app.$device.type.phone ? mapAtlas.mobileImg : mapAtlas.desktopImg);
  contents.append(lazyImg(illustration, "map-illustration", "Island map"));

  const partners = app.$partners.list;
  for (const [id, pin] of Object.entries(mapAtlas.pins)) {
    if (!partners[id]) continue;
    const island = mapAtlas.coords?.[pin.island];
    const bounds = island?.bounds;
    const x = bounds ? (pin.position.x / 1000 * bounds.width + bounds.x) * scale : pin.position.x;
    const y = bounds ? (pin.position.y / 1000 * bounds.height + bounds.y) * scale : pin.position.y;
    const marker = el("button", {
      class: "map-pin pointer",
      "data-v-0bed9cfd": "",
      type: "button",
      style: { left: `${x}px`, top: `${y - 18}px` },
      onClick: () => {
        playUiSound(app, "sfx_phone_click_soft");
        app.$store.phone.tab.id = "PartnerDetails";
        app.$store.phone.tab.props = { partner: id };
      },
    });
    marker.style.position = "absolute";
    marker.style.transform = "translate(-50%, -100%)";
    if (pin.object) marker.append(lazyImg(iconUrl(pin.object, 64, 128), "pin-object", id));
    contents.append(marker);
  }

  const user = el("div", { class: "userPosition", "data-v-d7359a46": "" });
  contents.append(user);
  container.append(contents);
  article.append(container);
  mount.replaceChildren(article);

  const updateUser = () => {
    const scene = app.$webgl?.scenes?.currentSceneID?.value;
    const pos = app.$webgl?.store?.playerPosition;
    const island = mapAtlas.coords?.[scene];
    if (!pos || !island?.bounds || !island.min || !island.max) return;
    const bounds = island.bounds;
    const dx = (island.min.map.x / 1000 * bounds.width + bounds.x) * scale;
    const dy = (island.min.map.y / 1000 * bounds.height + bounds.y) * scale;
    const ex = (island.max.map.x / 1000 * bounds.width + bounds.x) * scale;
    const ey = (island.max.map.y / 1000 * bounds.height + bounds.y) * scale;
    const x = dx + ((pos.x - island.min.gl.x) / (island.max.gl.x - island.min.gl.x)) * (ex - dx);
    let z = pos.z;
    z += -1 * Math.max(0, pos.y - 2.4984851165859103);
    const y = dy + ((z - island.min.gl.y) / (island.max.gl.y - island.min.gl.y)) * (ey - dy);
    user.style.setProperty("--userXPos", `${x}px`);
    user.style.setProperty("--userYPos", `${y}px`);
  };
  updateUser();
  const timer = window.setInterval(updateUser, 250);
  article.addEventListener("remove", () => window.clearInterval(timer));

  let dragging = false;
  let last = [0, 0];
  let pan = [0, 0];
  const apply = () => {
    contents.style.transform = `translate(${pan[0]}px, ${pan[1]}px)`;
  };
  container.addEventListener("pointerdown", (event) => {
    dragging = true;
    last = [event.clientX, event.clientY];
    container.setPointerCapture(event.pointerId);
  });
  container.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    pan[0] += event.clientX - last[0];
    pan[1] += event.clientY - last[1];
    last = [event.clientX, event.clientY];
    apply();
  });
  container.addEventListener("pointerup", () => { dragging = false; });
}

function renderPartner(app, mount, id) {
  const partner = app.$partners.list[id] || Object.values(app.$partners.list)[0];
  const article = el("article", { class: "phone-tab article", "data-v-3ef3e175": "" });
  if (partner?.colors?.primary) article.style.setProperty("--background", partner.colors.primary);
  article.append(
    el("header", { class: "article-header", "data-v-3ef3e175": "" }, [
      circleButton({
        label: app.$l("arialabel.back"),
        icon: "cross",
        tone: "white",
        onClick: () => {
          app.$store.phone.tab.id = "Map";
          app.$store.phone.tab.props = null;
          playUiSound(app, "sfx_phone_click_soft");
        },
      }),
      el("h1", { text: partner?.name || id }),
    ]),
    el("div", { class: "content", "data-scrollable": "", html: partner?.description || partner?.text || "" }),
  );
  mount.replaceChildren(article);
}

function renderTab(app, mount) {
  const tab = app.$store.phone.tab.id;
  if (tab === "Quests") return renderQuests(app, mount);
  if (tab === "PartnerDetails") return renderPartner(app, mount, app.$store.phone.tab.props?.partner);
  return renderMap(app, mount);
}

export function installPhone(app, host) {
  const hud = el("section", { class: "phone-hud hidden", "data-v-3d9fa6fd": "", key: "phoneHUD" });
  const openButton = el("button", {
    "aria-label": app.$l("arialabel.phone"),
    class: "pointer",
    "data-v-3d9fa6fd": "",
    type: "button",
    onClick: () => {
      playUiSound(app, "sfx_phone_click_soft");
      app.$router.push({ name: "Phone" });
    },
  });
  const phoneMini = el("div", { class: `phone ${app.$savestate.game.player.color}`, "data-v-3d9fa6fd": "" });
  const icons = el("div", { class: "icons", "data-v-3d9fa6fd": "" });
  const hudIcons = [
    iconUrl("phone-map", 64, 64),
    iconUrl("phone-partner", 64, 64),
    iconUrl("phone-quest", 64, 64),
    iconUrl("phone-customization", 64, 64),
    iconUrl("phone-point", 64, 128),
  ];
  hudIcons.forEach((url, index) => {
    const item = el("div", { class: `item-${index}`, "data-v-3d9fa6fd": "" });
    item.append(lazyImg(url, "icon", HUD_TABS[index]));
    if (index === 4) {
      item.append(el("span", { class: "data-points", "data-v-3d9fa6fd": "" }, [
        el("span", { html: String(app.$savestate.game.dataPoints) }),
        el("span", { html: String(app.$savestate.game.dataPoints) }),
      ]));
    }
    icons.append(item);
  });
  phoneMini.append(el("div", { "data-v-3d9fa6fd": "" }, [icons]));
  hud.append(openButton, phoneMini, el("div", { class: "case", "data-v-3d9fa6fd": "" }), el("div", { class: "shadow", "data-v-3d9fa6fd": "" }), el("div", { class: "background", "data-v-3d9fa6fd": "" }));

  const phone = el("section", { class: "new-phone hidden", "data-v-99fe8ba9": "" });
  phone.style.visibility = "hidden";
  const overlay = el("div", {
    class: "phone-overlay",
    "data-bypass-touch": "",
    "data-v-99fe8ba9": "",
    onClick: () => app.$router.push({ name: "Home" }),
  });
  overlay.hidden = true;

  const screen = el("div", { class: "screen", "data-v-a170c6fb": "" });
  const nav = el("div", { class: "phone-navigation", "data-v-ad29435e": "" });
  const navList = el("ul", { class: "nav-items", "data-v-ad29435e": "" });
  const navIcons = {
    Map: iconUrl("phone-map", 64, 128),
    Partners: iconUrl("phone-partner", 64, 128),
    Accessories: iconUrl("phone-point", 64, 128),
    Customization: iconUrl("phone-customization", 64, 128),
    Quests: iconUrl("phone-quest", 64, 128),
  };
  NAV_TABS.forEach((tab, index) => {
    const item = el("li", { class: `nav-item ${tab} item-${index}`, "data-v-ad29435e": "" });
    const button = el("button", {
      class: "nav-button pointer",
      "data-tab": tab,
      "aria-label": tab,
      "data-v-ad29435e": "",
      type: "button",
      onClick: () => {
        if (app.$store.phone.tab.id === tab) return;
        app.$store.phone.tab.id = tab;
        app.$store.phone.tab.props = null;
        playUiSound(app, "sfx_phone_click_medium");
        playUiSound(app, "sfx_phone_swipe", { delay: 250 });
      },
    });
    button.append(lazyImg(navIcons[tab], "button-image", tab));
    item.append(button);
    navList.append(item);
  });
  nav.append(el("nav", { class: "nav", "data-v-ad29435e": "" }, [navList]));
  nav.append(circleButton({
    label: app.$l("arialabel.close"),
    icon: "cross",
    tone: "green",
    extraClass: "pointer",
    onClick: () => {
      playUiSound(app, "sfx_phone_click_soft");
      app.$router.push({ name: "Home" });
    },
  }));
  const tabMount = el("div", { class: "phone-tab-container", "data-v-bf11d546": "" });
  screen.append(el("figure", { class: "screen-shine", "data-v-a170c6fb": "" }), nav, tabMount);
  phone.append(
    el("figure", { class: `phone-case ${app.$savestate.game.player.color}`, "data-v-b29ae3bf": "" }),
    screen,
  );

  host.append(hud, phone, overlay);
  layoutPhone(app, phone);
  renderTab(app, tabMount);

  const hudHidden = () => {
    const store = app.$store;
    return !store.isHeaderVisible
      || store.isFormOpen
      || store.isDialogVisibleDelayed
      || store.isMenuOpen
      || store.isTransitionActive
      || store.isOverlayVisible
      || store.phone.isVisible
      || store.sceneState < store.sceneStates.Playing
      || store.isCinematicActive
      || store.currentFullscreenVideo;
  };

  watch(hudHidden, (hidden) => hud.classList.toggle("hidden", hidden), { immediate: true });
  watch(() => app.$store.phone.isVisible, (visible) => {
    hud.classList.toggle("hidden", visible || hudHidden());
    openButton.hidden = !!visible;
  });
  watch(() => app.$savestate.game.dataPoints, (value) => {
    hud.querySelectorAll(".data-points span").forEach((node) => { node.innerHTML = String(value); });
  });
  watch(() => [app.$viewport.width, app.$viewport.height], () => layoutPhone(app, phone));
  watch(() => app.$store.phone.tab.id, () => {
    nav.querySelectorAll(".nav-button").forEach((button) => {
      button.classList.toggle("is-selected", button.getAttribute("data-tab") === app.$store.phone.tab.id);
    });
    nav.classList.toggle("is-hidden", app.$store.phone.tab.id === "PartnerDetails");
    renderTab(app, tabMount);
  });
  watch(() => unwrap(app.$route?.name) || app.$router.currentRoute.value.name, async (name) => {
    const store = app.$store.phone;
    if (name === "Phone") {
      if (store.isVisible) return;
      store.isVisible = true;
      phone.style.visibility = "visible";
      overlay.hidden = false;
      layoutPhone(app, phone);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      store.isReady = true;
      phone.classList.remove("hidden");
      phone.classList.add("visible");
      playUiSound(app, "sfx_phone_open");
      renderTab(app, tabMount);
    } else if (store.isVisible) {
      phone.classList.remove("visible");
      phone.classList.add("hidden");
      playUiSound(app, "sfx_phone_close");
      store.isReady = false;
      overlay.hidden = true;
      await new Promise((resolve) => setTimeout(resolve, 500));
      store.isVisible = false;
      phone.style.visibility = "hidden";
    }
  });
}
