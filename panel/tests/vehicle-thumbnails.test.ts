import { describe, expect, it } from "vitest";
import { getVehicleCdnUrl, getVehiclePreviewUrl } from "../src/lib/gta-assets";

describe("vehicle thumbnail URLs", () => {
  it("uses generated model thumbnails before CDN previews", () => {
    expect(getVehiclePreviewUrl("H4RxST2")).toBe("/api/vehicle-thumbnails/h4rxst2");
    expect(getVehiclePreviewUrl("d7cyp")).toBe("/api/vehicle-thumbnails/d7cyp");
  });

  it("keeps per-vehicle custom media as the highest priority", () => {
    expect(getVehiclePreviewUrl("d7cyp", "/media/vehicles/photo.jpg"))
      .toBe("/media/vehicles/photo.jpg");
  });

  it("rejects invalid model paths and preserves safe CDN fallbacks", () => {
    expect(getVehiclePreviewUrl("../../bad")).toContain("blista.webp");
    expect(getVehicleCdnUrl("d7cyp")).toContain("/cypher.webp");
  });
});
