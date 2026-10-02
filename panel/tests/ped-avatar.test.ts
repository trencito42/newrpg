import { describe, expect, it } from "vitest";
import { getPedAvatarUrl } from "../src/lib/gta-assets";

describe("MySkins avatar", () => {
  it("uses the equipped ped model rather than an account snapshot", () => {
    expect(getPedAvatarUrl("s_m_y_cop_01"))
      .toBe("https://docs-backend.fivem.net/peds/s_m_y_cop_01.webp");
  });

  it("uses the server's default ped after a MySkins reset", () => {
    expect(getPedAvatarUrl(null)).toBe("https://docs-backend.fivem.net/peds/ig_bankman.webp");
    expect(getPedAvatarUrl("reset")).toBe("https://docs-backend.fivem.net/peds/ig_bankman.webp");
  });

  it("normalizes and rejects invalid model paths", () => {
    expect(getPedAvatarUrl(" IG_LAMARDAVIS "))
      .toBe("https://docs-backend.fivem.net/peds/ig_lamardavis.webp");
    expect(getPedAvatarUrl("../../different"))
      .toBe("https://docs-backend.fivem.net/peds/ig_bankman.webp");
  });
});
