import { describe, expect, it } from "vitest";
import { classifyUpload, detectPhoneImage, mediaPublicUrl, PHONE_MAX_BYTES, OTHER_MAX_BYTES } from "../src/lib/phone-photo";

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
const token = "ab".repeat(32);
const future = new Date(Date.now() + 60_000).toISOString();
const past = new Date(Date.now() - 60_000).toISOString();

function row(overrides: Record<string, unknown> = {}) {
  return {
    media_type: "phone_photo",
    expires_at: future,
    uploaded_at: null,
    committed_at: null,
    ...overrides,
  };
}

describe("phone photo upload contract", () => {
  it("accepts phone photos, avatars, and vehicle previews with an absolute url", () => {
    for (const kind of ["phone_photo", "player_avatar", "vehicle_preview"] as const) {
      const decision = classifyUpload({
        token,
        headerType: kind,
        row: row({ media_type: kind }),
        now: Date.now(),
        bytes: png.length,
        image: detectPhoneImage(png),
      });
      expect(decision.ok).toBe(true);
      const filename = `${"cd".repeat(16)}.png`;
      const url = mediaPublicUrl(kind, filename);
      expect(url).toBe(`https://racket.cat/api/media/${kind === "phone_photo" ? "phone" : kind === "player_avatar" ? "avatars" : "vehicles"}/${filename}`);
      expect(url?.startsWith("https://racket.cat/")).toBe(true);
    }
  });

  it("rejects missing, unknown, expired, reused, and mismatched tokens", () => {
    expect(classifyUpload({ token: "", headerType: "phone_photo", row: null, now: Date.now(), bytes: 10, image: detectPhoneImage(png) })).toMatchObject({ ok: false, code: "missing_token" });
    expect(classifyUpload({ token, headerType: "phone_photo", row: null, now: Date.now(), bytes: 10, image: detectPhoneImage(png) })).toMatchObject({ ok: false, code: "unknown_token" });
    expect(classifyUpload({ token, headerType: "phone_photo", row: row({ expires_at: past }), now: Date.now(), bytes: 10, image: detectPhoneImage(png) })).toMatchObject({ ok: false, code: "expired_token" });
    expect(classifyUpload({ token, headerType: "phone_photo", row: row({ uploaded_at: future }), now: Date.now(), bytes: 10, image: detectPhoneImage(png) })).toMatchObject({ ok: false, code: "reused_token" });
    expect(classifyUpload({ token, headerType: "player_avatar", row: row({ media_type: "phone_photo" }), now: Date.now(), bytes: 10, image: detectPhoneImage(png) })).toMatchObject({ ok: false, code: "wrong_media_type" });
  });

  it("rejects the wrong file, an empty body, and an oversized phone photo", () => {
    expect(classifyUpload({ token, headerType: "phone_photo", row: row(), now: Date.now(), bytes: 4, image: null })).toMatchObject({ ok: false, code: "wrong_file_type" });
    expect(classifyUpload({ token, headerType: "phone_photo", row: row(), now: Date.now(), bytes: 0, image: null })).toMatchObject({ ok: false, code: "empty_file" });
    expect(classifyUpload({ token, headerType: "phone_photo", row: row(), now: Date.now(), bytes: PHONE_MAX_BYTES + 1, image: detectPhoneImage(png) })).toMatchObject({ ok: false, code: "oversized" });
  });

  it("does not accept a path or foreign url as a stored name", () => {
    expect(mediaPublicUrl("phone_photo", "../secret.jpg")).toBeNull();
    expect(mediaPublicUrl("phone_photo", "https://evil.example/a.jpg")).toBeNull();
  });

  // A2: 3 MiB limit
  it("accepts a phone_photo exactly at the 3 MiB limit", () => {
    const decision = classifyUpload({
      token,
      headerType: "phone_photo",
      row: row(),
      now: Date.now(),
      bytes: PHONE_MAX_BYTES,
      image: detectPhoneImage(png),
    });
    expect(decision.ok).toBe(true);
  });

  it("rejects a phone_photo one byte above the 3 MiB limit with oversized", () => {
    const decision = classifyUpload({
      token,
      headerType: "phone_photo",
      row: row(),
      now: Date.now(),
      bytes: PHONE_MAX_BYTES + 1,
      image: detectPhoneImage(png),
    });
    expect(decision).toMatchObject({ ok: false, status: 413, code: "oversized" });
  });

  it("PHONE_MAX_BYTES is exactly 3 * 1024 * 1024 (3 MiB)", () => {
    expect(PHONE_MAX_BYTES).toBe(3 * 1024 * 1024);
  });

  it("avatar and vehicle_preview use the larger OTHER_MAX_BYTES limit, not the phone limit", () => {
    for (const kind of ["player_avatar", "vehicle_preview"] as const) {
      // Should pass at phone limit
      expect(classifyUpload({ token, headerType: kind, row: row({ media_type: kind }), now: Date.now(), bytes: PHONE_MAX_BYTES, image: detectPhoneImage(png) }).ok).toBe(true);
      // Should also pass up to OTHER_MAX_BYTES
      expect(classifyUpload({ token, headerType: kind, row: row({ media_type: kind }), now: Date.now(), bytes: OTHER_MAX_BYTES, image: detectPhoneImage(png) }).ok).toBe(true);
      // Over OTHER_MAX_BYTES is still rejected
      expect(classifyUpload({ token, headerType: kind, row: row({ media_type: kind }), now: Date.now(), bytes: OTHER_MAX_BYTES + 1, image: detectPhoneImage(png) })).toMatchObject({ ok: false, code: "oversized" });
    }
  });

  // A7: WebP uploads are accepted for phone_photo (server recognises the RIFF/WEBP magic)
  it("detects WebP images and accepts them for phone_photo", () => {
    const webpMagic = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    const detected = detectPhoneImage(webpMagic);
    expect(detected).toMatchObject({ ext: "webp", mime: "image/webp" });
    const decision = classifyUpload({
      token,
      headerType: "phone_photo",
      row: row(),
      now: Date.now(),
      bytes: webpMagic.length,
      image: detected,
    });
    expect(decision.ok).toBe(true);
  });
});
