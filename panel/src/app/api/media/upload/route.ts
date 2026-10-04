import { getViewerLocale } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { t } from "@/lib/i18n";
import { detectPhoneImage, phonePhotoUrl, validPhoneToken } from "@/lib/phone-photo";


export async function POST(req: NextRequest) {
  const locale = await getViewerLocale();
  try {
    const mediaType = req.headers.get("x-media-type") || "player_avatar";
    const mediaHash = req.headers.get("x-media-hash") || "default";
    const mediaToken = req.headers.get("x-media-token") || "";
    const vehicleId = req.headers.get("x-vehicle-id");

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: t(locale, "interface.no_file_provided") }, { status: 400 });
    }
    const file = formData.get("files[]") as File | null;

    if (!file) {
      return NextResponse.json({ error: t(locale, "interface.no_file_provided") }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length === 0 || buffer.length > 5 * 1024 * 1024) {
      return NextResponse.json({ error: t(locale, "interface.invalid_file_size") }, { status: 400 });
    }

    // Token format: mediaType_accountId_timestamp
    const parts = mediaToken.split("_");
    const accountId = Number(parts[1]) || 0;

    const baseDir = process.env.PANEL_MEDIA_DIR || path.join(process.cwd(), "public", "media");

    if (mediaType === "player_avatar" && accountId > 0) {
      const dir = path.join(baseDir, "avatars");
      await fs.mkdir(dir, { recursive: true });
      const filename = `${accountId}_${Date.now()}.png`;
      const filePath = path.join(dir, filename);
      await fs.writeFile(filePath, buffer);

      const avatarUrl = `/media/avatars/${filename}`;
      await dbQuery(
        `INSERT INTO panel_player_media (account_id, avatar_url, avatar_hash, captured_at)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE avatar_url = VALUES(avatar_url), avatar_hash = VALUES(avatar_hash), updated_at = NOW()`,
        [accountId, avatarUrl, mediaHash]
      );

      return NextResponse.json({ success: true, url: avatarUrl });
    } else if (mediaType === "vehicle_preview" && vehicleId) {
      const vehId = Number(vehicleId);
      const dir = path.join(baseDir, "vehicles");
      await fs.mkdir(dir, { recursive: true });
      const filename = `${vehId}_${Date.now()}.png`;
      const filePath = path.join(dir, filename);
      await fs.writeFile(filePath, buffer);

      const previewUrl = `/media/vehicles/${filename}`;
      await dbQuery(
        `INSERT INTO panel_vehicle_media (vehicle_id, preview_url, visual_hash, captured_at)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE preview_url = VALUES(preview_url), visual_hash = VALUES(visual_hash), updated_at = NOW()`,
        [vehId, previewUrl, mediaHash]
      );

      return NextResponse.json({ success: true, url: previewUrl });
    } else if (mediaType === "phone_photo") {
      if (!validPhoneToken(mediaToken)) {
        return NextResponse.json({ error: t(locale, "interface.invalid_upload_parameters") }, { status: 400 });
      }
      const image = detectPhoneImage(buffer);
      if (!image) {
        return NextResponse.json({ error: t(locale, "interface.invalid_file_size") }, { status: 400 });
      }
      const filename = `${crypto.randomBytes(16).toString("hex")}.${image.ext}`;
      const url = phonePhotoUrl(filename);
      if (!url) {
        return NextResponse.json({ error: t(locale, "interface.invalid_upload_parameters") }, { status: 400 });
      }
      const dir = path.join(baseDir, "phone");
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, filename), buffer);
      return NextResponse.json({ url, mime: image.mime, size: buffer.length });
    }

    return NextResponse.json({ error: t(locale, "interface.invalid_upload_parameters") }, { status: 400 });
  } catch (err) {
    console.error("Media upload error:", err);
    return NextResponse.json({ error: t(locale, "interface.an_internal_error_occurred_try_again_later") }, { status: 500 });
  }
}
