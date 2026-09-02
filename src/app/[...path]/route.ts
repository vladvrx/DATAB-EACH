import fs from "node:fs/promises";
import path from "node:path";

const PROJECT_ROOT = process.cwd();
const REFERENCE_ROOT = path.resolve(PROJECT_ROOT, "reference");
const DIRECT_PORT_ROOT = path.resolve(PROJECT_ROOT, "direct-port");
const VENDOR_ROOT = path.resolve(PROJECT_ROOT, "vendor");
const ROOT_INDEX = path.resolve(PROJECT_ROOT, "index.html");

const MIME_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".bin": "application/octet-stream",
  ".css": "text/css; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".glsl": "text/plain; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".m4a": "audio/mp4",
  ".map": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".webmanifest": "application/manifest+json",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xmp": "application/octet-stream",
};

type GameRouteContext = {
  params: Promise<{ path: string[] }>;
};

function safeFilePath(root: string, segments: string[]) {
  const filePath = path.resolve(root, ...segments);
  const rootPrefix = `${root}${path.sep}`;
  return filePath === root || filePath.startsWith(rootPrefix) ? filePath : null;
}

async function fileResponse(filePath: string) {
  const file = await fs.readFile(filePath);
  const extension = path.extname(filePath).toLowerCase();
  return new Response(file, {
    headers: {
      "cache-control": "no-store",
      "content-type": MIME_TYPES[extension] ?? "application/octet-stream",
    },
  });
}

export async function GET(_request: Request, { params }: GameRouteContext) {
  const segments = (await params).path;
  const [mount, ...mountedSegments] = segments;
  let root = REFERENCE_ROOT;
  let relativeSegments = segments;
  let fallbackIndex: string | null = ROOT_INDEX;

  if (mount === "direct-port") {
    root = DIRECT_PORT_ROOT;
    relativeSegments = mountedSegments.length ? mountedSegments : ["index.html"];
    fallbackIndex = path.join(DIRECT_PORT_ROOT, "index.html");
  } else if (mount === "three-js") {
    root = path.resolve(PROJECT_ROOT, "three-js");
    relativeSegments = mountedSegments.length ? mountedSegments : ["index.html"];
    fallbackIndex = path.join(root, "index.html");
  } else if (mount === "vendor") {
    root = VENDOR_ROOT;
    relativeSegments = mountedSegments;
    fallbackIndex = null;
  } else if (mount === "reference") {
    root = REFERENCE_ROOT;
    relativeSegments = mountedSegments;
    fallbackIndex = null;
  }

  const filePath = safeFilePath(root, relativeSegments);
  if (!filePath) return new Response("forbidden", { status: 403 });

  try {
    return await fileResponse(filePath);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    const routeHasExtension = path.extname(relativeSegments.at(-1) ?? "") !== "";
    if (code === "ENOENT" && fallbackIndex && !routeHasExtension) {
      return fileResponse(fallbackIndex);
    }
    return new Response(code === "ENOENT" ? "not found" : "unable to read game file", {
      status: code === "ENOENT" ? 404 : 500,
    });
  }
}
