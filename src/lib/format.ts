export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return kb >= 10 ? `${kb.toFixed(0)} KB` : `${kb.toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

export function fmtMiB(bytes: number, digits = 2): string {
  return `${(bytes / 1024 / 1024).toFixed(digits)} MiB`;
}

export function fmtMB(bytes: number, digits = 2): string {
  return `${(bytes / 1_000_000).toFixed(digits)} MB`;
}

export function fmtCount(n: number): string {
  return n.toLocaleString("en-US");
}
