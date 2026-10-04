import { describe, expect, it } from "vitest";
import { classifyUpload, detectPhoneImage, mediaPublicUrl, PHONE_MAX_BYTES } from "../src/lib/phone-photo";

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
      expect(url).toBe(`https://racket.cat/media/${kind === "phone_photo" ? "phone" : kind === "player_avatar" ? "avatars" : "vehicles"}/${filename}`);
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
});
