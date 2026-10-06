import { describe, expect, it } from "vitest";
import { buildVehicleProfileDetails, parseVehicleProps, sanitizeCosmetics } from "../src/lib/vehicle-profile";

describe("vehicle profile props", () => {
  it("parses GTA mods with zero-based level display (+1)", () => {
    const details = buildVehicleProfileDetails({
      modEngine: 2,
      modBrakes: -1,
      modTurbo: 1,
    });
    expect(details.performance.engine).toEqual({ level: 3, max: 4 });
    expect(details.performance.brakes).toBe("stock");
    expect(details.performance.turbo).toBe(true);
    expect(details.performance.allStock).toBe(false);
  });

  it("prefers cosmetics RGB over indexed colors", () => {
    const details = buildVehicleProfileDetails({
      color1: 12,
      color2: 0,
      cosmetics: {
        primary: { r: 30, g: 111, b: 168 },
        secondary: { r: 17, g: 17, b: 17 },
      },
    });
    expect(details.colors).toHaveLength(2);
    expect(details.colors[0]).toMatchObject({ kind: "rgb", hex: "#1E6FA8" });
  });

  it("uses indexed colors when cosmetics block is absent", () => {
    const details = buildVehicleProfileDetails({ color1: 111, color2: 0 });
    expect(details.colors[0]).toEqual({ kind: "gta", role: "primary", gtaIndex: 111 });
  });

  it("detects tuned ECU from persisted map", () => {
    const details = buildVehicleProfileDetails({
      ecu: {
        profileVersion: 2,
        stage: "sport",
        power: 25,
        torque: 10,
        exhaust: "pop_bang",
        pop: { enabled: true, rpmMax: 88 },
        dyno: { lastHp: 420, lastTorque: 510 },
      },
    });
    expect(details.ecu.tuned).toBe(true);
    expect(details.ecu.dynoHp).toBe(420);
    expect(details.ecu.chips.length).toBeGreaterThan(0);
  });

  it("returns stock ECU for missing props", () => {
    const details = buildVehicleProfileDetails(null);
    expect(details.ecu.stock).toBe(true);
    expect(details.performance.allStock).toBe(true);
  });

  it("sanitizeCosmetics mirrors tuning defaults", () => {
    const cos = sanitizeCosmetics({ windowTint: 2, xenon: true });
    expect(cos.windowTint).toBe(2);
    expect(cos.xenon).toBe(true);
    expect(cos.secondary).toEqual({ r: 111, g: 111, b: 111 });
  });

  it("never throws on invalid JSON", () => {
    expect(parseVehicleProps("{not-json")).toEqual({});
  });
});
