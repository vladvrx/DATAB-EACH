import { a as assets, x as iconSheet } from "../../vendor/vendor.75f6e6ae65453426.js";

export function iconUrl(id, phoneSize = 64, desktopSize = 256) {
  if (!id) return "";
  try {
    const pack = iconSheet.get(id, phoneSize, desktopSize);
    if (!pack) return "";
    if (typeof pack === "string") return pack;
    return assets.select(pack) || pack.url || pack.png || pack.webp || pack.avif || "";
  } catch {
    return "";
  }
}

export function selectAsset(pack) {
  if (!pack) return "";
  if (typeof pack === "string") return pack;
  return assets.select(pack) || pack.url || pack.png || pack.webp || pack.avif || "";
}
