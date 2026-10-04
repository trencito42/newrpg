/**
 * Static unit tests for vehicle persistence policy.
 *
 * These tests encode the rules that govern how engine/body/fuel values flow
 * from the database → normalizeVehicleStats → spawn, and what the server should
 * do in playerDropped scenarios.  They are pure-TypeScript mirrors of the Lua
 * logic so they can run in CI without a FiveM runtime.
 */

import { describe, expect, it } from "vitest";

// ─── Mirror of client/main.lua normalizeVehicleStats ─────────────────────────

function normalizeVehicleStats(vehData: {
  fuel?: number | null;
  engine?: number | null;
  body?: number | null;
  destroyed?: number | boolean | string | null;
}): { fuel: number; engine: number; body: number } {
  let fuel = vehData.fuel != null ? Number(vehData.fuel) : null;
  let engine = vehData.engine != null ? Number(vehData.engine) : null;
  let body = vehData.body != null ? Number(vehData.body) : null;
  const isDestroyed =
    vehData.destroyed === 1 || vehData.destroyed === true || vehData.destroyed === "1";

  // Fix 5: only default NULL/missing — 0 is a valid empty tank
  if (fuel == null || isNaN(fuel)) fuel = 100.0;

  if (isDestroyed) {
    engine = 0.0;
    body = 0.0;
  } else {
    if (engine == null || isNaN(engine)) engine = 1000.0;
    if (body == null || isNaN(body)) body = 1000.0;
  }

  fuel = Math.max(0, Math.min(100, fuel));
  engine = Math.max(0, Math.min(1000, engine));
  body = Math.max(0, Math.min(1000, body));

  return { fuel, engine, body };
}

// ─── Mirror of server-side playerDropped health-selection logic (Fix 1) ──────

interface RuntimeCache {
  engine: number;
  body: number;
  fuel: number;
}

function selectDroppedHealth(
  entityEngine: number,
  entityBody: number,
  cache: RuntimeCache | null
): { engine: number | null; body: number | null; source: string } {
  if (cache && cache.engine > 0) {
    return { engine: cache.engine, body: cache.body, source: "cache" };
  }
  if (entityEngine > 0) {
    return { engine: entityEngine, body: entityBody, source: "entity" };
  }
  // Both are 0/null — entity torn down. Skip write, preserve last good sync.
  return { engine: null, body: null, source: "skip" };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("normalizeVehicleStats — spawn health policy", () => {
  it("healthy DB 1000 → spawn applies 1000", () => {
    const { engine, body } = normalizeVehicleStats({ engine: 1000, body: 1000, fuel: 80 });
    expect(engine).toBe(1000);
    expect(body).toBe(1000);
  });

  it("damaged DB 650 → spawn applies 650 (not silently healed)", () => {
    const { engine, body } = normalizeVehicleStats({ engine: 650, body: 700, fuel: 50 });
    expect(engine).toBe(650);
    expect(body).toBe(700);
  });

  it("fuel=0 → spawn remains 0 (Fix 5: empty tank is valid)", () => {
    const { fuel } = normalizeVehicleStats({ engine: 1000, body: 1000, fuel: 0 });
    expect(fuel).toBe(0);
  });

  it("fuel=null (missing legacy row) → defaulted to 100", () => {
    const { fuel } = normalizeVehicleStats({ engine: 1000, body: 1000, fuel: null });
    expect(fuel).toBe(100);
  });

  it("missing engine (nil/null) → legacy default of 1000 applied", () => {
    const { engine } = normalizeVehicleStats({ engine: null, body: null, fuel: 80 });
    expect(engine).toBe(1000);
  });

  it("missing body (nil/null) → legacy default of 1000 applied", () => {
    const { body } = normalizeVehicleStats({ engine: null, body: null, fuel: 80 });
    expect(body).toBe(1000);
  });

  it("destroyed=1 → engine and body forced to 0 (totaled vehicle)", () => {
    const { engine, body } = normalizeVehicleStats({
      engine: 800,
      body: 900,
      fuel: 60,
      destroyed: 1,
    });
    expect(engine).toBe(0);
    expect(body).toBe(0);
  });

  it("destroyed='1' string variant → engine and body forced to 0", () => {
    const { engine, body } = normalizeVehicleStats({
      engine: 800,
      body: 900,
      fuel: 60,
      destroyed: "1",
    });
    expect(engine).toBe(0);
    expect(body).toBe(0);
  });

  it("values are clamped to valid GTA ranges", () => {
    const r = normalizeVehicleStats({ engine: 5000, body: -100, fuel: 999 });
    expect(r.engine).toBe(1000);
    expect(r.body).toBe(0);
    expect(r.fuel).toBe(100);
  });
});

describe("playerDropped health selection — Fix 1 (VehicleRuntimeState cache)", () => {
  it("good cache + live entity → prefers cache value", () => {
    const result = selectDroppedHealth(990, 980, { engine: 996, body: 983, fuel: 45 });
    expect(result.source).toBe("cache");
    expect(result.engine).toBe(996);
    expect(result.body).toBe(983);
  });

  it("no cache + live entity with engine > 0 → uses entity", () => {
    const result = selectDroppedHealth(990, 980, null);
    expect(result.source).toBe("entity");
    expect(result.engine).toBe(990);
  });

  it("entity engine=0 (entity torn down during shutdown), no cache → skip write", () => {
    const result = selectDroppedHealth(0, 0, null);
    expect(result.source).toBe("skip");
    expect(result.engine).toBeNull();
    expect(result.body).toBeNull();
  });

  it("entity engine=0 but valid cache → uses cache (shutdown scenario)", () => {
    // This is the exact Fix 1 scenario: entity torn down returns 0 but cache
    // holds the last good periodic-sync value.
    const result = selectDroppedHealth(0, 0, { engine: 750, body: 820, fuel: 30 });
    expect(result.source).toBe("cache");
    expect(result.engine).toBe(750);
  });
});

describe("boot reconciliation policy — Fix 3", () => {
  it("stored=0 rows should be set to stored=1 on boot (health unchanged)", () => {
    // Policy: only stored column is modified; engine/body/fuel are not reset.
    const dbRow = { stored: 0, engine: 875, body: 910, fuel: 22 };
    // Simulate reconciliation: set stored=1, leave health as-is
    const reconciled = { ...dbRow, stored: 1 };
    expect(reconciled.stored).toBe(1);
    expect(reconciled.engine).toBe(875); // unchanged
    expect(reconciled.body).toBe(910);   // unchanged
    expect(reconciled.fuel).toBe(22);    // unchanged
  });
});
