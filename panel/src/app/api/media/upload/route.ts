import { getViewerLocale } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { dbExecute, dbQuerySingle, dbTransaction } from "@/lib/db";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { t } from "@/lib/i18n";
import {
  absurdImageSize,
  classifyUpload,
  detectPhoneImage,
  hashUploadToken,
  mediaPublicUrl,
  UploadKind,
} from "@/lib/phone-photo";

interface TokenRow extends RowDataPacket {
  id: number;
  account_id: number | null;
  character_id: number;
  media_type: string;
  entity_id: number | null;
  expires_at: string;
  uploaded_at: string | null;
  committed_at: string | null;
}

function fail(locale: "en" | "ro", status: number, code: string) {
  const key = code === "empty_file" || code === "oversized" || code === "wrong_file_type"
    ? "interface.invalid_file_size"
    : code === "missing_token" || code === "unknown_token" || code === "expired_token" || code === "reused_token"
      ? "interface.invalid_upload_parameters"
      : "interface.invalid_upload_parameters";
  return NextResponse.json({ error: t(locale, key), code }, { status });
}

export async function POST(req: NextRequest) {
  let locale: "en" | "ro" = "en";
  try {
    locale = await getViewerLocale();
    const mediaType = req.headers.get("x-media-type") || "";
    const mediaHash = (req.headers.get("x-media-hash") || "default").slice(0, 128);
    const mediaToken = (req.headers.get("x-media-token") || "").trim();

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return fail(locale, 400, "empty_file");
    }
    const file = formData.get("files[]") as File | null;
    const buffer = file ? Buffer.from(await file.arrayBuffer()) : Buffer.alloc(0);
    const image = buffer.length && !absurdImageSize(buffer) ? detectPhoneImage(buffer) : null;
    const tokenHash = /^[0-9a-f]{64}$/i.test(mediaToken) ? hashUploadToken(mediaToken) : "";
    const row = tokenHash
      ? await dbQuerySingle<TokenRow>(
          `SELECT id, account_id, character_id, media_type, entity_id, expires_at, uploaded_at, committed_at
           FROM media_upload_tokens WHERE token_hash = ? LIMIT 1`,
          [tokenHash]
        )
      : null;
    const decision = classifyUpload({
      token: mediaToken,
      headerType: mediaType,
      row,
      now: Date.now(),
      bytes: buffer.length,
      image,
    });
    if (!decision.ok || !row || !image) {
      return fail(locale, decision.ok ? 400 : decision.status, decision.ok ? "wrong_file_type" : decision.code);
    }

    const kind = mediaType as UploadKind;
    const filename = `${crypto.randomBytes(16).toString("hex")}.${image.ext}`;
    const url = mediaPublicUrl(kind, filename);
    if (!url) return fail(locale, 400, "wrong_file_type");

    const claimed = await dbTransaction(async (connection) => {
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE media_upload_tokens
         SET uploaded_at = UTC_TIMESTAMP(), media_url = ?, mime_type = ?, file_size = ?
         WHERE id = ? AND token_hash = ? AND media_type = ?
           AND uploaded_at IS NULL AND committed_at IS NULL
           AND expires_at > UTC_TIMESTAMP()`,
        [url, image.mime, buffer.length, row.id, tokenHash, mediaType]
      );
      return result.affectedRows === 1;
    });
    if (!claimed) {
      const again = await dbQuerySingle<TokenRow>(
        `SELECT uploaded_at, committed_at, expires_at FROM media_upload_tokens WHERE id = ? LIMIT 1`,
        [row.id]
      );
      if (again && (again.uploaded_at || again.committed_at)) return fail(locale, 409, "reused_token");
      return fail(locale, 401, again ? "expired_token" : "unknown_token");
    }

    const baseDir = process.env.PANEL_MEDIA_DIR || path.join(process.cwd(), "public", "media");
    const folder = kind === "phone_photo" ? "phone" : kind === "player_avatar" ? "avatars" : "vehicles";
    try {
      const dir = path.join(baseDir, folder);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, filename), buffer);
    } catch (err) {
      await dbExecute(
        `UPDATE media_upload_tokens
         SET uploaded_at = NULL, media_url = NULL, mime_type = NULL, file_size = NULL
         WHERE id = ? AND committed_at IS NULL`,
        [row.id]
      );
      console.error("Media upload write failed");
      throw err;
    }

    if (kind === "player_avatar" && row.account_id) {
      await dbExecute(
        `INSERT INTO panel_player_media (account_id, avatar_url, avatar_hash, captured_at)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE avatar_url = VALUES(avatar_url), avatar_hash = VALUES(avatar_hash), updated_at = NOW()`,
        [row.account_id, url, mediaHash]
      );
    } else if (kind === "vehicle_preview" && row.entity_id) {
      await dbExecute(
        `INSERT INTO panel_vehicle_media (vehicle_id, preview_url, visual_hash, captured_at)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE preview_url = VALUES(preview_url), visual_hash = VALUES(visual_hash), updated_at = NOW()`,
        [row.entity_id, url, mediaHash]
      );
    }

    return NextResponse.json({ success: true, url, mime: image.mime, size: buffer.length });
  } catch (err) {
    console.error("Media upload error");
    return NextResponse.json({ error: t(locale, "interface.an_internal_error_occurred_try_again_later") }, { status: 500 });
  }
}
