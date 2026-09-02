export function unwrap(value) {
  if (value && typeof value === "object" && "value" in value) return value.value;
  return value;
}

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "html") node.innerHTML = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === "style" && typeof value === "object") Object.assign(node.style, value);
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

export const ICONS = {
  cross: {
    viewBox: "0 0 24 24",
    html: '<path d="M18.3 5.71 12 12.01 5.7 5.7 4.29 7.11 10.59 13.4 4.29 19.7 5.7 21.11 12 14.82 18.3 21.11 19.71 19.7 13.41 13.4 19.71 7.11z" fill="currentColor"></path>',
  },
  burger: {
    viewBox: "0 0 24 24",
    html: '<path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" fill="currentColor"></path>',
  },
  profile: {
    viewBox: "0 0 24 24",
    html: '<path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" fill="currentColor"></path>',
  },
  "sound-on": {
    viewBox: "0 0 17 16",
    html: '<path d="M13.2 4.4c.3-.4.9-.5 1.4-.2C16.1 5.3 17 6.8 17 8.5c0 1.7-.9 3.2-2.4 4.3-.4.3-1.1.2-1.4-.2-.3-.4-.2-1.1.2-1.4 1.1-.8 1.6-1.8 1.6-2.7 0-.9-.5-1.9-1.6-2.7-.4-.3-.5-.9-.2-1.4zM10.4.1c.4.2.6.5.6.9v14c0 .4-.2.7-.6.9-.3.2-.8.1-1.1-.1L4.6 12H1c-.6 0-1-.4-1-1V5c0-.6.4-1 1-1h3.6L9.3.2c.4-.2.8-.3 1.1-.1zM9 3.1 5.6 5.8c-.2.1-.4.2-.6.2H2v4h3c.2 0 .4.1.6.2L9 12.9V3.1z" fill="currentColor"></path>',
  },
  "sound-off": {
    viewBox: "0 0 17 16",
    html: '<path d="M14.8 2c-.4-.4-1-.4-1.4 0L11 4.4l-2 2L5.4 10l-2 2-.6.6c-.4.4-.4 1 0 1.4.4.4 1 .4 1.4 0L14.8 3.4c.4-.4.4-1 0-1.4zM15.1 4.6 13.7 6c.9.7 1.3 1.6 1.3 2.5 0 .9-.5 1.9-1.6 2.7-.4.3-.5.9-.2 1.4.3.4.9.5 1.4.2 1.5-1.1 2.4-2.6 2.4-4.3 0-1.5-.7-2.9-1.9-3.9zM2 10V6h3c.2 0 .4-.1.6-.2L9 3.1V5l2-2V1c0-.4-.2-.7-.6-.9s-.7-.1-1 .1L4.6 4H1c-.6 0-1 .4-1 1v6c0 .6.4 1 1 1h1l.1-.1L4 10H2zM9 12.9l-1.3-1-1.4 1.4 3.1 2.4c.3.2.7.3 1.1.1s.5-.4.5-.8V8.7l-2 2v2.2z" fill="currentColor"></path>',
  },
};

ICONS.sound = ICONS["sound-on"];

export function svgIcon(name) {
  const spec = ICONS[name] || ICONS.cross;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", spec.viewBox || "0 0 24 24");
  svg.setAttribute("class", "icon-svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("data-icon", name);
  svg.innerHTML = spec.html;
  return svg;
}

export function setCircleIcon(button, icon) {
  const content = button.querySelector(".button-content");
  if (!content) return;
  content.replaceChildren(svgIcon(icon));
}

export function circleButton({ label, icon, tone = "white", onClick, extraClass = "" }) {
  const button = el("button", {
    class: `circle-button ${tone} is-hoverable ${extraClass}`.trim(),
    "aria-label": label,
    type: "button",
    "data-v-1a897dbc": "",
    "data-pointer": "",
    onClick,
  });
  const content = el("span", { class: "button-content", "data-v-1a897dbc": "" });
  content.append(svgIcon(icon));
  button.append(content);
  return button;
}

export function ctaButton({ text, color = "white", extraClass = "", onClick, href }) {
  const tag = href ? "a" : "button";
  const button = el(tag, {
    class: `cta normal ${color} ${tag} ${extraClass}`.trim(),
    "data-v-6cd59efe": "",
    "data-pointer": "",
    type: href ? undefined : "button",
    href,
    onClick,
  });
  button.append(el("span", { class: "cta-content", "data-v-6cd59efe": "", html: text }));
  return button;
}

export function lazyImg(url, className, alt = "") {
  const src = typeof url === "string" ? url : "";
  return el("img", { class: className, src, alt, draggable: "false" });
}

export function playUiSound(app, id, opts) {
  try {
    app.$webgl?.audio?.playSound(id, opts);
  } catch {
    /* audio unlocks after first gesture */
  }
}
