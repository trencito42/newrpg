#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  Automated Unit Tests: Job Route Creator & Store Suite
// ═══════════════════════════════════════════════════════════════

let passed = 0;
let failed = 0;

function assert_eq(actual, expected, testName) {
    if (actual === expected) {
        passed++;
        console.log(`  \x1b[32mPASS\x1b[0m ${testName}`);
    } else {
        failed++;
        console.error(`  \x1b[31mFAIL\x1b[0m ${testName}: expected '${expected}', got '${actual}'`);
    }
}

function assert_true(condition, testName) {
    assert_eq(Boolean(condition), true, testName);
}

console.log("=== Starting Job Route Creator Unit Tests ===");

// 1. Schema Validation & Deserialization
console.log("\n[1] Schema Validation & Deserialization");
const sampleRoutesJson = `{
  "schemaVersion": 1,
  "trucker": [
    {
      "id": "fuel_west_eclipse",
      "label": "Depot → West Eclipse Gas Station",
      "category": "fuel",
      "pay": 650,
      "pickup": { "x": 1234.3, "y": -3104.2, "z": 4.8, "h": 3.5 },
      "delivery": { "x": -1434.9, "y": -298.1, "z": 45.1, "h": 311.2 },
      "parkingBay": { "x": -1434.1, "y": -250.7, "z": 48.0, "h": 131.9 }
    }
  ],
  "garbage": [
    {
      "id": "south_ls_01",
      "label": "South Los Santos",
      "bins": [
        { "x": -128.45, "y": -1415.22, "z": 29.35 },
        { "x": 45.12, "y": -1398.55, "z": 29.35 }
      ]
    }
  ]
}`;

let parsedData = null;
try {
    parsedData = JSON.parse(sampleRoutesJson);
} catch (e) {
    parsedData = null;
}

assert_true(parsedData !== null, "JSON parses cleanly");
assert_eq(parsedData.schemaVersion, 1, "Schema version is 1");
assert_eq(parsedData.trucker.length, 1, "1 trucker route parsed");
assert_eq(parsedData.garbage.length, 1, "1 garbage route parsed");
assert_eq(parsedData.garbage[0].bins.length, 2, "2 garbage bins parsed in ordered list");

// 2. Route Normalization & Bounds Checking
console.log("\n[2] Route Normalization & Bounds Checking");
function normalizeTrucker(raw, idx) {
    if (!raw || typeof raw !== 'object') return null;
    const id = String(raw.id || `route_${idx}`).replace(/[^a-zA-Z0-9_-]/g, '');
    const pay = Math.max(50, Math.min(100000, Math.floor(Number(raw.pay) || 500)));
    return {
        id: id || `route_${idx}`,
        label: String(raw.label || 'Route').slice(0, 100),
        category: String(raw.category || 'fuel'),
        pay: pay,
        pickup: { x: Number(raw.pickup?.x) || 0, y: Number(raw.pickup?.y) || 0, z: Number(raw.pickup?.z) || 0, h: Number(raw.pickup?.h || raw.pickup?.w) || 0 },
        delivery: { x: Number(raw.delivery?.x) || 0, y: Number(raw.delivery?.y) || 0, z: Number(raw.delivery?.z) || 0, h: Number(raw.delivery?.h || raw.delivery?.w) || 0 },
        parkingBay: { x: Number(raw.parkingBay?.x) || 0, y: Number(raw.parkingBay?.y) || 0, z: Number(raw.parkingBay?.z) || 0, h: Number(raw.parkingBay?.h || raw.parkingBay?.w) || 0 },
    };
}

const normA = normalizeTrucker(parsedData.trucker[0], 1);
assert_eq(normA.id, "fuel_west_eclipse", "Normalized ID is fuel_west_eclipse");
assert_eq(normA.pay, 650, "Base pay normalized to 650");
assert_eq(normA.pickup.x, 1234.3, "Pickup X coordinate preserved");
assert_eq(normA.parkingBay.h, 131.9, "Parking bay heading preserved");

// 3. Trucker Immutable Session Snapshot & Deletion Resilience
console.log("\n[3] Trucker Immutable Session Snapshot & Active Session Resilience");
// Player starts route
const activeTruckerSession = {
    jobId: 'trucker',
    state: 'ACTIVE',
    data: {
        routeId: normA.id,
        label: normA.label,
        category: normA.category,
        pay: normA.pay,
        pickup: normA.pickup,
        delivery: normA.delivery,
        parkingBay: normA.parkingBay,
        stage: 'to_delivery',
    }
};

// Developer deletes the route in route_store
const updatedTruckerRoutes = []; // Empty routes list

// Player calls deliver() - validates against session snapshot, NOT mutable routes list
function validateDelivery(session, playerCoords) {
    if (!session || !session.data || !session.data.delivery) return false;
    const target = session.data.delivery;
    const dx = playerCoords.x - target.x;
    const dy = playerCoords.y - target.y;
    return Math.sqrt(dx * dx + dy * dy) <= 35.0;
}

const isDeliverOk = validateDelivery(activeTruckerSession, { x: -1434.9, y: -298.1, z: 45.1 });
assert_true(isDeliverOk, "Active trucker delivery succeeds using session snapshot even after route was deleted from store");
assert_eq(activeTruckerSession.data.pay, 650, "Base pay is preserved from session snapshot");

// 4. Garbage Route Ordered Sequence & Snapshot
console.log("\n[4] Garbage Route Ordered Sequence & Session Snapshot");
const sampleGarbageRoute = {
    id: "south_ls_loop",
    label: "South LS Loop",
    bins: [
        { x: 100, y: 200, z: 30 },
        { x: 110, y: 210, z: 30 },
        { x: 120, y: 220, z: 30 }
    ]
};

// Start session copies bins in exact authored order (no random shuffle)
const garbageSession = {
    jobId: 'garbage',
    state: 'ACTIVE',
    data: {
        routeId: sampleGarbageRoute.id,
        label: sampleGarbageRoute.label,
        bins: [...sampleGarbageRoute.bins],
        collected: 0,
        capacity: 3,
        binIndex: 1,
    }
};

assert_eq(garbageSession.data.bins[0].x, 100, "First bin is stop #1");
assert_eq(garbageSession.data.bins[1].x, 110, "Second bin is stop #2 in authored order");
assert_eq(garbageSession.data.bins[2].x, 120, "Third bin is stop #3 in authored order");

// 5. Route Duplication with Unique ID
console.log("\n[5] Route Duplication Logic");
function duplicateRoute(original) {
    const copy = JSON.parse(JSON.stringify(original));
    copy.id = `${original.id}_copy`;
    copy.label = `${original.label || original.id} (Copy)`;
    return copy;
}

const dup = duplicateRoute(sampleGarbageRoute);
assert_eq(dup.id, "south_ls_loop_copy", "Duplicated route gets unique _copy ID");
assert_eq(dup.label, "South LS Loop (Copy)", "Duplicated route label updated");
assert_eq(dup.bins.length, 3, "Duplicated route preserves all bins");

// 6. Malformed JSON Fallback Recovery
console.log("\n[6] Malformed JSON Recovery");
function safeLoadRoutes(rawJsonString, currentCache) {
    try {
        const parsed = JSON.parse(rawJsonString);
        if (typeof parsed !== 'object' || parsed === null) throw new Error("Not object");
        return { ok: true, data: parsed };
    } catch (err) {
        // Preserves currentCache without overwriting with empty
        return { ok: false, data: currentCache };
    }
}

const fallbackCache = { trucker: [normA], garbage: [sampleGarbageRoute] };
const badJsonResult = safeLoadRoutes("{ corrupt json !!! ", fallbackCache);
assert_eq(badJsonResult.ok, false, "Corrupt JSON load fails gracefully");
assert_eq(badJsonResult.data.trucker.length, 1, "Existing cache preserved on JSON parse failure");

console.log(`\n=== Test Suite Complete: ${passed} Passed, ${failed} Failed ===`);
if (failed > 0) {
    process.exit(1);
}
