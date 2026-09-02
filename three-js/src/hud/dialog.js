import { w as watch } from "../../../vendor/vendor.75f6e6ae65453426.js";
import { ctaButton, el, playUiSound, unwrap } from "../dom.js";

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

export function installDialog(app, host) {
  const root = el("section", { class: "dialog", "data-v-fda03aae": "" });
  host.append(root);

  let token = 0;
  let typeTimer = 0;

  function clear() {
    window.clearTimeout(typeTimer);
    root.replaceChildren();
  }

  function typeBubble(content) {
    const chars = [...content.querySelectorAll(".char")];
    let index = 0;
    const step = () => {
      const node = chars[index];
      if (!node) {
        content.closest(".bubble")?.classList.add("is-done");
        return;
      }
      node.classList.add("visible");
      const delay = pauseFor((node.textContent || "").trim());
      index += 1;
      typeTimer = window.setTimeout(step, delay ? 30 + delay : 30);
    };
    typeTimer = window.setTimeout(step, 80);
  }

  function renderSpeak(node) {
    const current = ++token;
    const bubble = node.bubble ?? "";
    const html = wrapChars(app.$tpl(bubble));
    const aside = el("aside", {
      class: "dialog-component dialog-bubble",
      "data-v-9946fd7c": "",
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

    const advance = (event) => {
      if (event?.target?.tagName === "BUTTON") return;
      if (!app.$dialogs.current?.node?.isSpeak) return;
      app.$dialogs.nextNode();
      playUiSound(app, "sfx_UI_dialog_next");
    };
    aside.addEventListener("mousedown", advance);
    aside.addEventListener("touchend", advance);
  }

  function renderChoices(node) {
    const aside = el("aside", {
      class: "dialog-component dialog-buttons",
      "data-v-a65553f3": "",
    });
    const prompt = el("div", { class: "prompt", "data-v-3df37bd2": "" });
    const choices = Object.values(node.choices || {});
    for (const choice of choices) {
      const label = (choice.value || choice.id || "").trim();
      const color = /^yes$/i.test(label) ? "green" : "white";
      const button = ctaButton({
        text: label,
        color,
        extraClass: "pointer",
        onClick: () => {
          app.$dialogs.makeChoice(choice);
          playUiSound(app, "sfx_UI_dialog_answer");
        },
      });
      prompt.append(button);
    }
    aside.append(prompt);
    root.append(aside);
    requestAnimationFrame(() => aside.classList.add("visible"));
  }

  function render() {
    clear();
    const current = app.$dialogs.current;
    const node = current?.node;
    if (!node || unwrap(app.$store.isOverlayVisible)) return;

    if (current.opts?.closable && (app.$viewport.width > 700 || !(node.isPrompt || node.isGPTPrompt || node.isGPTInput))) {
      const close = el("button", {
        class: "dialog-close threejs-circle bordered pointer",
        "data-v-fda03aae": "",
        "aria-label": app.$l("arialabel.close"),
        type: "button",
        onClick: () => app.$dialogs.exitDialog(true),
      });
      close.textContent = "×";
      root.append(close);
    }

    if (node.isSpeak) renderSpeak(node);
    else if (node.isPrompt) renderChoices(node);
  }

  watch(() => app.$dialogs.current.node, render, { deep: true });
  watch(() => app.$store.isDialogVisible, (visible) => {
    if (!visible) clear();
    else render();
  });

  window.addEventListener("keydown", (event) => {
    const node = app.$dialogs.current?.node;
    if (!node) return;
    if (["Escape", "KeyX"].includes(event.code) && app.$dialogs.current.opts?.closable) {
      event.preventDefault();
      app.$dialogs.exitDialog(true);
      return;
    }
    if (node.isSpeak && ["Enter", "Space"].includes(event.code)) {
      event.preventDefault();
      app.$dialogs.nextNode();
      playUiSound(app, "sfx_UI_dialog_next");
    }
  });
}
