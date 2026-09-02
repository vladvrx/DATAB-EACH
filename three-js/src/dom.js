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

export function svgIcon(path, viewBox = "0 0 24 24") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("class", "icon-svg");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = `<path d="${path}" fill="currentColor"></path>`;
  return svg;
}

export const ICONS = {
  cross: "M18.3 5.71 12 12.01 5.7 5.7 4.29 7.11 10.59 13.4 4.29 19.7 5.7 21.11 12 14.82 18.3 21.11 19.71 19.7 13.41 13.4 19.71 7.11z",
  burger: "M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z",
  sound: "M5 9v6h4l5 4V5L9 9H5zm11.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z",
  profile: "M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z",
};

export function circleButton({ label, icon, tone = "white", onClick, extraClass = "" }) {
  const button = el("button", {
    class: `threejs-circle ${tone} ${extraClass}`.trim(),
    "aria-label": label,
    type: "button",
    "data-pointer": "",
    onClick,
  });
  button.append(svgIcon(ICONS[icon] || ICONS.cross));
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
