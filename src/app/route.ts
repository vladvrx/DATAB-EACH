import fs from "node:fs/promises";
import path from "node:path";

const THREE_JS_INDEX = path.resolve(process.cwd(), "three-js", "index.html");

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const html = await fs.readFile(THREE_JS_INDEX);
    return new Response(html, {
      headers: {
        "cache-control": "no-store",
        "content-type": "text/html; charset=utf-8",
      },
    });
  } catch {
    return new Response("three-js/index.html is missing", { status: 500 });
  }
}
