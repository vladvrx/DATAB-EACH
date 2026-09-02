import { w as watch } from "../../../vendor/vendor.75f6e6ae65453426.js";
import { circleButton, ctaButton, el, playUiSound, unwrap } from "../dom.js";

function wrapChars(text) {
  return String(text ?? "").replace(/(^|[ >])([^ ><]+)?/gi, (match, prefix, word) => {
    let html = prefix;
    if (word !== undefined) {
      let chars = "";
      for (const char of word) {
        chars += char === " " || char === "\u00a0" || char === "&nbsp;"
          ? char
          : `<span class="char">${char}</span>`;
      }
      html += `<span class="word">${chars}</span>`;
    }
    return html;
  });
}

function pauseFor(char) {
  if (char === "…") return 600;
  if (char === ".") return 300;
  if (char === ":") return 220;
  if (char === "?") return 240;
  if (char === "!") return 290;
  if (char === ",") return 180;
  return 0;
}

function promptChoices(node) {
  return Object.values(node?.choices || {});
}

export function installDialog(app, host) {
  const root = el("section", { class: "dialog", "data-v-fda03aae": "" });
  host.append(root);

  let token = 0;
  let typeTimer = 0;
  let typed = false;
  let advancing = false;
  let skipping = false;

  function clear() {
    window.clearTimeout(typeTimer);
    token += 1;
    typed = false;
    skipping = false;
    advancing = false;
    root.replaceChildren();
  }

  function revealAll() {
    root.querySelectorAll(".char").forEach((node) => node.classList.add("visible"));
    root.querySelector(".bubble")?.classList.add("is-done");
    typed = true;
    skipping = false;
  }

  function typeBubble(content) {
    const chars = [...content.querySelectorAll(".char")];
    let index = 0;
    const step = () => {
      const node = chars[index];
      if (!node) {
        content.closest(".bubble")?.classList.add("is-done");
        typed = true;
        skipping = false;
        return;
      }
      node.classList.add("visible");
      const delay = pauseFor((node.textContent || "").trim());
      index += 1;
      const wait = skipping ? 8 : delay ? 30 + delay : 30;
      typeTimer = window.setTimeout(step, wait);
    };
    typeTimer = window.setTimeout(step, 80);
  }

  function renderSpeak(node) {
    const current = ++token;
    typed = false;
    skipping = false;
    const html = wrapChars(app.$tpl(node.bubble ?? ""));
    const aside = el("aside", {
      class: "dialog-component dialog-bubble",
      "data-v-9946fd7c": "",
      "data-pointer": "",
    });
    const section = el("section", { class: "bubble", "data-v-9946fd7c": "" });
    const content = el("div", { class: "content", "data-v-9946fd7c": "", html });
    section.append(content);
    aside.append(section);
    root.append(aside);
    window.setTimeout(() => {
      if (current !== token) return;
      aside.classList.add("visible");
      typeBubble(content);
    }, app.$dialogs.isFirstNode() ? 600 : 100);
  }

  function choose(choice) {
    if (!choice || advancing) return;
    advancing = true;
    app.$dialogs.makeChoice(choice);
    playUiSound(app, "sfx_UI_dialog_answer");
    window.setTimeout(() => { advancing = false; }, 80);
  }

  function renderChoices(node) {
    typed = true;
    const aside = el("aside", {
      class: "dialog-component dialog-buttons",
      "data-v-a65553f3": "",
    });
    const prompt = el("div", { class: "prompt", "data-v-3df37bd2": "" });
    const choices = promptChoices(node);
    const confirm = choices.at(-1);
    const cancel = choices.at(-2);
    const ordered = [cancel, confirm].filter(Boolean);
    for (const choice of ordered.length ? ordered : choices) {
      const label = (choice.value || choice.id || "").trim();
      const isConfirm = choice === confirm;
      const color = /^yes$/i.test(label) ? "green" : isConfirm ? "green" : "white";
      const button = ctaButton({
        text: label,
        color,
        extraClass: "pointer",
        onClick: () => choose(choice),
      });
      prompt.append(button);
    }
    aside.append(prompt);
    root.append(aside);
    requestAnimationFrame(() => aside.classList.add("visible"));
  }

  function renderSelect(node) {
    typed = true;
    const aside = el("aside", {
      class: "dialog-component dialog-select",
      "data-v-23585691": "",
    });
    const section = el("section", { class: "dialog-selector", "data-v-49ab79f6": "" });
    const list = el("div", { class: "prompt", "data-v-3df37bd2": "" });
    for (const choice of promptChoices(node)) {
      const label = (choice.value || choice.id || "").trim();
      list.append(ctaButton({
        text: label,
        color: "white",
        extraClass: "pointer",
        onClick: () => choose(choice),
      }));
    }
    section.append(list);
    aside.append(section);
    root.append(aside);
    requestAnimationFrame(() => aside.classList.add("visible"));
  }

  function nodeId() {
    return app.$dialogs.current?.node?.id ?? app.$dialogs.current?.node?.fullID ?? null;
  }

  function showClose(node) {
    const current = app.$dialogs.current;
    if (!current?.opts?.closable || !node) return false;
    if (unwrap(app.$store.isOverlayVisible) || unwrap(app.$store.currentFullscreenVideoDelayed)) return false;
    const mobile = (app.$viewport.width || window.innerWidth) <= 700;
    if (mobile && (node.isPrompt || node.isGPTPrompt || node.isGPTInput)) return false;
    return true;
  }

  function render() {
    clear();
    const current = app.$dialogs.current;
    const node = current?.node;
    if (!node || unwrap(app.$store.isOverlayVisible)) return;

    if (showClose(node)) {
      const close = circleButton({
        label: app.$l("arialabel.close"),
        icon: "cross",
        tone: "bordered",
        extraClass: "dialog-close pointer",
        onClick: () => app.$dialogs.exitDialog(true),
      });
      close.setAttribute("data-v-fda03aae", "");
      root.append(close);
    }

    if (node.isSpeak) renderSpeak(node);
    else if (node.isPrompt) {
      const count = Object.keys(node.choices || {}).length;
      if (count > 2) renderSelect(node);
      else renderChoices(node);
    }
  }

  function speaking() {
    return !!unwrap(app.$store.isDialogVisible) && !!app.$dialogs.current?.node?.isSpeak;
  }

  function uiTarget(event) {
    return event?.target?.closest?.("button, a, input, textarea, .menu.is-open");
  }

  async function nextSpeak() {
    if (!speaking() || advancing || !typed) return;
    advancing = true;
    try {
      await app.$dialogs.nextNode();
      playUiSound(app, "sfx_UI_dialog_next");
    } finally {
      window.setTimeout(() => { advancing = false; }, 80);
    }
  }

  function skipOrAdvance(event) {
    if (!speaking()) return;
    if (uiTarget(event)) return;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (!typed) {
      skipping = true;
      window.clearTimeout(typeTimer);
      revealAll();
      return;
    }
    nextSpeak();
  }

  watch(nodeId, render);
  watch(() => unwrap(app.$store.isDialogVisible), (visible) => {
    if (!visible) clear();
    else render();
  });

  window.addEventListener("pointerdown", skipOrAdvance, true);
  window.addEventListener("keydown", (event) => {
    const node = app.$dialogs.current?.node;
    if (!node) return;
    const closable = !!app.$dialogs.current.opts?.closable;
    if (node.isPrompt) {
      const choices = promptChoices(node);
      if (["Escape", "KeyN", "KeyX"].includes(event.code)) {
        event.preventDefault();
        event.stopPropagation();
        const cancel = choices.at(-2);
        if (cancel) choose(cancel);
        else if (closable) app.$dialogs.exitDialog(true);
        return;
      }
      if (["Enter", "Space", "NumpadEnter", "KeyY"].includes(event.code)) {
        event.preventDefault();
        event.stopPropagation();
        const confirm = choices.at(-1);
        if (confirm) choose(confirm);
        return;
      }
      return;
    }
    if (["Escape", "KeyX"].includes(event.code) && closable) {
      event.preventDefault();
      app.$dialogs.exitDialog(true);
      return;
    }
    if (["Enter", "Space", "NumpadEnter"].includes(event.code)) {
      skipOrAdvance(event);
    }
  }, true);
}
