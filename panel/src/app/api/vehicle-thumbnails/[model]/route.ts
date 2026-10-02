import { readFile } from "node:fs/promises";
import path from "node:path";
import { getVehicleCdnUrl } from "@/lib/gta-assets";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ model: string }> },
) {
  const { model } = await params;
  const normalized = model?.toLowerCase();
  if (!normalized || !/^[a-z0-9_]{1,64}$/.test(normalized)) {
    return new Response("Invalid vehicle model", { status: 400 });
  }

  const filePath = path.join(process.cwd(), "public", "vehicles", `${normalized}.png`);
  try {
    const image = await readFile(filePath);
    return new Response(image, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=60",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      return new Response("Thumbnail unavailable", { status: 500 });
    }
    return Response.redirect(getVehicleCdnUrl(normalized), 302);
  }
}
