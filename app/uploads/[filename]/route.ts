import { readFile } from "node:fs/promises";
import path from "node:path";
export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> },
) {
  const { filename } = await context.params;
  if (!/^[a-f0-9-]{36}\.webp$/.test(filename))
    return new Response(null, { status: 404 });
  try {
    const data = await readFile(path.resolve(".local/uploads", filename));
    return new Response(data, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
