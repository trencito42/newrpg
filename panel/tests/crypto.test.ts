import { describe, it, expect } from "vitest";
import {
  verifyScryptPassword,
  hashScryptPassword,
  isModernScrypt,
  generateRandomToken,
} from "../src/lib/crypto";

describe("Sunset Password & Crypto Security", () => {
  it("generates a valid scrypt hash in fivem sunset_auth format", async () => {
    const password = "SuperSecretPassword123!";
    const hash = hashScryptPassword(password);

    expect(hash).not.toBeNull();
    expect(isModernScrypt(hash)).toBe(true);
    expect(hash?.startsWith("$scrypt$32768$8$1$")).toBe(true);
  });

  it("successfully verifies password against scrypt hash", async () => {
    const password = "MyRPGAccountPassword2026";
    const hash = hashScryptPassword(password);
    expect(hash).not.toBeNull();

    const isValid = await verifyScryptPassword(password, hash!);
    expect(isValid).toBe(true);
  });

  it("fails verification for wrong password", async () => {
    const password = "CorrectPassword";
    const wrongPassword = "WrongPassword";
    const hash = hashScryptPassword(password);
    expect(hash).not.toBeNull();

    const isValid = await verifyScryptPassword(wrongPassword, hash!);
    expect(isValid).toBe(false);
  });

  it("strictly rejects insecure legacy plaintext or sha1/md5 formats without scrypt prefix", async () => {
    const plainLegacy = "testpass";
    const md5Legacy = "098f6bcd4621d373cade4e832627b4f6";

    expect(isModernScrypt(plainLegacy)).toBe(false);
    expect(isModernScrypt(md5Legacy)).toBe(false);

    // verifyScryptPassword should reject non-scrypt hashes safely
    const plainValid = await verifyScryptPassword("testpass", plainLegacy);
    expect(plainValid).toBe(false);

    const md5Valid = await verifyScryptPassword("testpass", md5Legacy);
    expect(md5Valid).toBe(false);
  });

  it("generates random base64url tokens", () => {
    const token = generateRandomToken(32);
    expect(token.length).toBeGreaterThan(30);
    expect(/^[A-Za-z0-9_-]+$/.test(token)).toBe(true);
  });
});
