import { describe, expect, it } from "vitest";
import { buildMetadata, getSiteUrl } from "../src/lib/seo/metadata";

describe("seo metadata", () => {
  it("builds canonical and noindex", () => {
    const meta = buildMetadata({
      title: "Forum",
      path: "/forum",
      noIndex: true,
    });
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.alternates?.canonical).toBe(getSiteUrl("/forum"));
  });

  it("appends brand to title once", () => {
    const meta = buildMetadata({ title: "Players", path: "/players" });
    const title = typeof meta.title === "string" ? meta.title : "";
    expect(title).toContain("Players");
    expect(title.split("|").length).toBeLessThanOrEqual(2);
  });
});
