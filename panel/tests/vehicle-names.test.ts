import { describe, expect, it } from "vitest";
import { vehicleDisplayName } from "../src/lib/vehicle-names";

describe("vehicle display names", () => {
  it("prefers the catalog label over the technical model", () => {
    expect(vehicleDisplayName("d7cyp", "Cypher GTS Spec")).toBe("Cypher GTS Spec");
    expect(vehicleDisplayName("H4RxST2", "Harx ST2 GT")).toBe("Harx ST2 GT");
  });

  it("does not leak invalid localization sentinel values", () => {
    expect(vehicleDisplayName("tempesta2", "CARNOTFOUND")).toBe("Tempesta Widebody");
    expect(vehicleDisplayName(null, "NULL")).toBe("Vehicle");
  });

  it("sanitizes unknown technical identifiers", () => {
    expect(vehicleDisplayName("unknown_model")).toBe("Unknown Model");
  });
});
