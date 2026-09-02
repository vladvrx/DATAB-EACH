import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const html = await fs.readFile(path.resolve(process.cwd(), "index.html"));
    return new Response(html, {
      headers: {
        "cache-control": "no-store",
        "content-type": "text/html; charset=utf-8",
      },
    });
  } catch {
    return new Response("root index.html is missing", { status: 500 });
  }
}
