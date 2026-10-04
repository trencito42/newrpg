import crypto from "crypto";

export const PHONE_MAX_BYTES = 3 * 1024 * 1024; // 3 MiB — WebP@0.78 captures are well under this; nginx must have client_max_body_size >= 10M
export const OTHER_MAX_BYTES = 5 * 1024 * 1024;

const ORIGIN = "https://racket.cat/api/media";

export type UploadKind = "phone_photo" | "player_avatar" | "vehicle_preview";

export interface LedgerClaim {
  media_type: string;
  expires_at: string | Date;
  uploaded_at: string | Date | null;
  committed_at: string | Date | null;
}

export function hashUploadToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function detectPhoneImage(buffer: Buffer): { ext: string; mime: string } | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg" };
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return { ext: "png", mime: "image/png" };
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { ext: "webp", mime: "image/webp" };
  }
  return null;
}

export function absurdImageSize(buffer: Buffer): boolean {
  if (buffer.length >= 24 && buffer[0] === 0x89 && buffer[1] === 0x50) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return width < 1 || height < 1 || width > 8192 || height > 8192;
  }
  let offset = 2;
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    while (offset + 8 < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const size = buffer.readUInt16BE(offset + 2);
      if (size < 2) return true;
      if (marker >= 0xc0 && marker <= 0xc3) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return width < 1 || height < 1 || width > 8192 || height > 8192;
      }
      offset += 2 + size;
    }
  }
  return false;
}

export function mediaPublicUrl(kind: UploadKind, filename: string): string | null {
  const folder = kind === "phone_photo" ? "phone" : kind === "player_avatar" ? "avatars" : "vehicles";
  if (!/^[a-f0-9]{32}\.(jpg|png|webp)$/i.test(filename)) return null;
  return `${ORIGIN}/${folder}/${filename}`;
}

function utcMillis(value: string | Date): number {
  if (value instanceof Date) return value.getTime();
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(raw)) return Date.parse(raw.replace(" ", "T") + "Z");
  return Date.parse(raw);
}

export function classifyUpload(input: {
  token: string;
  headerType: string;
  row: LedgerClaim | null;
  now: number;
  bytes: number;
  image: { ext: string; mime: string } | null;
}): { ok: true } | { ok: false; status: number; code: string } {
  if (!input.token) return { ok: false, status: 401, code: "missing_token" };
  if (!/^[0-9a-f]{64}$/i.test(input.token)) return { ok: false, status: 401, code: "unknown_token" };
  if (!input.row) return { ok: false, status: 401, code: "unknown_token" };
  if (input.row.uploaded_at || input.row.committed_at) return { ok: false, status: 409, code: "reused_token" };
  const expires = utcMillis(input.row.expires_at);
  if (!Number.isFinite(expires) || expires <= input.now) return { ok: false, status: 401, code: "expired_token" };
  if (input.row.media_type !== input.headerType) return { ok: false, status: 400, code: "wrong_media_type" };
  if (input.bytes < 1) return { ok: false, status: 400, code: "empty_file" };
  const limit = input.headerType === "phone_photo" ? PHONE_MAX_BYTES : OTHER_MAX_BYTES;
  if (input.bytes > limit) return { ok: false, status: 413, code: "oversized" };
  if (!input.image) return { ok: false, status: 400, code: "wrong_file_type" };
  if (input.headerType !== "phone_photo" && input.headerType !== "player_avatar" && input.headerType !== "vehicle_preview") {
    return { ok: false, status: 400, code: "wrong_media_type" };
  }
  return { ok: true };
}
