import { describe, expect, it } from "vitest";
import { detectPhoneImage, phonePhotoUrl, validPhoneToken } from "../src/lib/phone-photo";

describe("phone photo upload contract", () => {
  it("accepts the in-memory game token shape and rejects path tokens", () => {
    expect(validPhoneToken("a".repeat(48))).toBe(true);
    expect(validPhoneToken("phone_photo_1_1")).toBe(false);
    expect(validPhoneToken("short")).toBe(false);
  });

  it("detects jpeg png and webp and rejects other bytes", () => {
    expect(detectPhoneImage(Buffer.from([0xff, 0xd8, 0xff, 0x00]))?.mime).toBe("image/jpeg");
    expect(detectPhoneImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))?.ext).toBe("png");
    const webp = Buffer.alloc(12);
    webp.write("RIFF", 0);
    webp.write("WEBP", 8);
    expect(detectPhoneImage(webp)?.mime).toBe("image/webp");
    expect(detectPhoneImage(Buffer.from("not-an-image"))).toBeNull();
  });

  it("builds only a stable racket.cat media url", () => {
    expect(phonePhotoUrl(`${"ab".repeat(16)}.jpg`)).toBe(
      `https://racket.cat/media/phone/${"ab".repeat(16)}.jpg`
    );
    expect(phonePhotoUrl("../secret.jpg")).toBeNull();
    expect(phonePhotoUrl("https://evil.example/a.jpg")).toBeNull();
  });
});
