import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const ALLOWED_FOLDERS = new Set(["phone", "avatars", "vehicles"]);
const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const FILENAME_RE = /^[0-9a-f]{32}\.(jpg|jpeg|png|webp)$/i;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  if (!segments || segments.length !== 2) {
    return new NextResponse(null, { status: 404 });
  }
  const [folder, filename] = segments;
  if (!ALLOWED_FOLDERS.has(folder) || !FILENAME_RE.test(filename)) {
    return new NextResponse(null, { status: 404 });
  }
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    return new NextResponse(null, { status: 404 });
  }
  const baseDir = process.env.PANEL_MEDIA_DIR || path.join(process.cwd(), "public", "media");
  const filePath = path.join(baseDir, folder, filename);
  // Prevent path traversal
  if (!filePath.startsWith(path.resolve(baseDir) + path.sep)) {
    return new NextResponse(null, { status: 404 });
  }
  try {
    const buf = await fs.readFile(filePath);
    const mime =
      ext === ".webp" ? "image/webp" :
      ext === ".png" ? "image/png" : "image/jpeg";
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(buf.length),
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
