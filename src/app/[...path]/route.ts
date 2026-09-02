import fs from "node:fs/promises";
import path from "node:path";

const REFERENCE_ROOT = path.resolve(process.cwd(), "reference");

const MIME_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".bin": "application/octet-stream",
  ".css": "text/css; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".m4a": "audio/mp4",
  ".manifest": "application/manifest+json",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".webmanifest": "application/manifest+json",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
  ".xmp": "application/octet-stream",
};

type ReferenceRouteContext = {
  params: Promise<{ path: string[] }>;
};

function getReferencePath(segments: string[]) {
  const relativePath = segments.join("/");
  const filePath = path.resolve(REFERENCE_ROOT, relativePath);
  const rootPrefix = `${REFERENCE_ROOT}${path.sep}`;

  if (!filePath.startsWith(rootPrefix)) {
    return null;
  }

  return filePath;
}

async function serveReferenceFile(segments: string[]) {
  const filePath = getReferencePath(segments);

  if (!filePath) {
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
    const code = error && typeof error === "object" && "code" in error
      ? error.code
      : undefined;

    return new Response(code === "ENOENT" ? "not found" : "unable to read file", {
      status: code === "ENOENT" ? 404 : 500,
    });
  }
}

export async function GET(
  _request: Request,
  { params }: ReferenceRouteContext,
) {
  return serveReferenceFile((await params).path);
}
