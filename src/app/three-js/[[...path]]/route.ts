import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const PORT_ROOT = path.resolve(process.cwd(), "three-js");

const MIME_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".bin": "application/octet-stream",
  ".css": "text/css; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".html": "text/html; charset=utf-8",
  ".glsl": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".m4a": "audio/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

type ThreeJsRouteContext = {
  params: Promise<{ path?: string[] }>;
};

export async function GET(_request: Request, { params }: ThreeJsRouteContext) {
  const segments = (await params).path ?? [];
  const relativePath = segments.length === 0 ? "index.html" : segments.join("/");
  const filePath = path.resolve(PORT_ROOT, relativePath);
  const rootPrefix = `${PORT_ROOT}${path.sep}`;

  if (filePath !== path.join(PORT_ROOT, "index.html") && !filePath.startsWith(rootPrefix)) {
    return new Response("forbidden", { status: 403 });
  }

  try {
    const file = await fs.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    return new Response(file, {
      headers: {
        "cache-control": "no-store",
        "content-type": MIME_TYPES[extension] ?? "application/octet-stream",
      },
    });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code === "ENOENT" && path.extname(relativePath) === "") {
      const index = await fs.readFile(path.join(PORT_ROOT, "index.html"));
      return new Response(index, {
        headers: {
          "cache-control": "no-store",
          "content-type": MIME_TYPES[".html"],
        },
      });
    }
    return new Response(code === "ENOENT" ? "not found" : "unable to read three.js game file", {
      status: code === "ENOENT" ? 404 : 500,
    });
  }
}
