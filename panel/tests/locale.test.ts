import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { parsePanelLocale, resolveViewerLocale } from "../src/lib/locale";

describe("resolveViewerLocale", () => {
  it("anonymous + no cookie → EN", () => {
    expect(resolveViewerLocale(null, null)).toBe("en");
    expect(resolveViewerLocale(undefined, undefined)).toBe("en");
  });

  it("anonymous + RO cookie → RO", () => {
    expect(resolveViewerLocale(null, "ro")).toBe("ro");
  });

  it("authenticated account EN + RO cookie → EN", () => {
    expect(resolveViewerLocale("en", "ro")).toBe("en");
  });

  it("authenticated account RO + EN cookie → RO", () => {
    expect(resolveViewerLocale("ro", "en")).toBe("ro");
  });

  it("invalid cookie ignored when anonymous", () => {
    expect(resolveViewerLocale(null, "fr")).toBe("en");
  });

  it("parsePanelLocale rejects invalid values", () => {
    expect(parsePanelLocale("en")).toBe("en");
    expect(parsePanelLocale("ro")).toBe("ro");
    expect(parsePanelLocale("de")).toBeNull();
  });
});

describe("panel locale integration expectations", () => {
  const accountPage = readFileSync(
    resolve(__dirname, "../src/app/account/page.tsx"),
    "utf8"
  );

  it("/account has no duplicate language selector form", () => {
    expect(accountPage).not.toContain('name="language"');
    expect(accountPage).not.toContain("updateLanguage");
  });

  it("LanguageToggle persists authenticated changes via account API", () => {
    const toggle = readFileSync(
      resolve(__dirname, "../src/components/navigation/LanguageToggle.tsx"),
      "utf8"
    );
    expect(toggle).toContain("/api/account/language");
    expect(toggle).toContain("isAuthenticated");
  });

  it("no rogue NEXT_LOCALE or racket_locale in panel src", () => {
    const hits = execSync('rg -l "NEXT_LOCALE|racket_locale" src -g "!**/*.test.ts" || true', {
      cwd: resolve(__dirname, ".."),
      encoding: "utf8",
    }).trim();
    expect(hits).toBe("");
  });
});
