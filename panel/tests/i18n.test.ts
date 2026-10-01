import { describe, it, expect } from "vitest";
import en from "../src/locales/en.json";
import ro from "../src/locales/ro.json";
import { t, formatCurrency, formatNumber } from "../src/lib/i18n";

describe("Internationalization (RO + EN)", () => {
  it("has matching top-level keys in Romanian and English dictionaries", () => {
    const enKeys = Object.keys(en);
    const roKeys = Object.keys(ro);

    expect(enKeys.sort()).toEqual(roKeys.sort());
  });

  it("has matching nested keys across all namespaces", () => {
    function getDeepKeys(obj: any, prefix = ""): string[] {
      return Object.keys(obj).reduce((res: string[], el: string) => {
        if (Array.isArray(obj[el])) {
          return res;
        } else if (typeof obj[el] === "object" && obj[el] !== null) {
          return [...res, ...getDeepKeys(obj[el], prefix + el + ".")];
        }
        return [...res, prefix + el];
      }, []);
    }

    const enDeep = getDeepKeys(en).sort();
    const roDeep = getDeepKeys(ro).sort();

    expect(enDeep).toEqual(roDeep);
  });

  it("correctly resolves nested translation paths", () => {
    expect(t("ro", "nav.home")).toBe("Prezentare");
    expect(t("en", "nav.home")).toBe("Overview");
    expect(t("ro", "nav.players")).toBe("Jucători");
    expect(t("en", "nav.players")).toBe("Players");
  });

  it("formats currency in standard RPG notation ($50,000)", () => {
    const formatted = formatCurrency(50000);
    expect(formatted).toBe("$50,000");
  });

  it("formats numbers with proper thousand separators", () => {
    expect(formatNumber(1250000, "en")).toBe("1,250,000");
    expect(formatNumber(1250000, "ro")).toBe("1.250.000");
  });
});
