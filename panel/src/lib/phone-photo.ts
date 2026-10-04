const PHONE_MEDIA_ORIGIN = "https://racket.cat/media/phone/";

export function validPhoneToken(token: string): boolean {
  return /^[a-f0-9]{48}$/i.test(token);
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

export function phonePhotoUrl(filename: string): string | null {
  if (!/^[a-f0-9]{32}\.(jpg|png|webp)$/i.test(filename)) return null;
  return `${PHONE_MEDIA_ORIGIN}${filename}`;
}
