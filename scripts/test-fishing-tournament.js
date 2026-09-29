#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  Automated Unit Tests: Fishing Tournament Logic Suite (Node.js)
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

console.log("=== Starting Fishing Tournament Unit Tests ===");

// 1. Weight integer conversion
console.log("\n[1] Weight Integer Conversion (Hectograms / Decagrams)");
function toWeight10(kg) {
    const raw = Number(kg) || 0;
    return Math.max(1, Math.floor(raw * 10 + 0.5));
}

assert_eq(toWeight10(12.34), 123, "12.34 kg rounds to 123 (12.3 kg)");
assert_eq(toWeight10(12.36), 124, "12.36 kg rounds to 124 (12.4 kg)");
assert_eq(toWeight10(0.0), 1, "0.0 kg clamps to min 1 unit");
assert_eq(toWeight10(4.8), 48, "4.8 kg converts to 48");

// 2. Ranking Comparator & 5-level Tie Breaker
console.log("\n[2] Deterministic Ranking & 5-Level Tie Breaker");
function compareParticipants(a, b) {
    // 1. highest total weight
    if (a.totalWeight10 !== b.totalWeight10) {
        return b.totalWeight10 - a.totalWeight10; // descending
    }
    // 2. highest single fish weight
    if (a.biggestFishWeight10 !== b.biggestFishWeight10) {
        return b.biggestFishWeight10 - a.biggestFishWeight10; // descending
    }
    // 3. highest fish count
    if (a.fishCount !== b.fishCount) {
        return b.fishCount - a.fishCount; // descending
    }
    // 4. earliest lastCatchAt
    const tA = a.lastCatchAt || a.joinedAt || 0;
    const tB = b.lastCatchAt || b.joinedAt || 0;
    if (tA !== tB) {
        return tA - tB; // ascending (earlier is better)
    }
    // 5. characterId fallback
    return (Number(a.charId) || 0) - (Number(b.charId) || 0);
}

const pA = { charId: 1, name: "Alice", totalWeight10: 150, biggestFishWeight10: 50, fishCount: 5, lastCatchAt: 100 };
const pB = { charId: 2, name: "Bob", totalWeight10: 140, biggestFishWeight10: 60, fishCount: 6, lastCatchAt: 50 };
assert_true(compareParticipants(pA, pB) < 0, "Higher total weight wins regardless of single fish");

const pC = { charId: 3, name: "Charlie", totalWeight10: 150, biggestFishWeight10: 60, fishCount: 4, lastCatchAt: 100 };
assert_true(compareParticipants(pC, pA) < 0, "Tie on total weight resolved by biggest single fish");

const pD = { charId: 4, name: "Dan", totalWeight10: 150, biggestFishWeight10: 60, fishCount: 5, lastCatchAt: 100 };
assert_true(compareParticipants(pD, pC) < 0, "Tie on total weight & biggest fish resolved by fish count");

const pE = { charId: 5, name: "Eve", totalWeight10: 150, biggestFishWeight10: 60, fishCount: 5, lastCatchAt: 80 };
assert_true(compareParticipants(pE, pD) < 0, "Tie on catches resolved by earlier last catch time");

const pF1 = { charId: 10, name: "Frank1", totalWeight10: 150, biggestFishWeight10: 60, fishCount: 5, lastCatchAt: 80 };
const pF2 = { charId: 20, name: "Frank2", totalWeight10: 150, biggestFishWeight10: 60, fishCount: 5, lastCatchAt: 80 };
assert_true(compareParticipants(pF1, pF2) < 0, "Absolute tie resolved deterministically by charId");

// 3. Qualification Threshold Check (minFish = 3)
console.log("\n[3] Qualification Threshold (minFish = 3)");
const minFish = 3;
const participants = [
    { charId: 1, name: "P1", totalWeight10: 200, fishCount: 2 }, // Unqualified!
    { charId: 2, name: "P2", totalWeight10: 180, fishCount: 3 }, // Qualified
    { charId: 3, name: "P3", totalWeight10: 170, fishCount: 4 }, // Qualified
];

const qualified = participants.filter(p => p.fishCount >= minFish).sort(compareParticipants);
assert_eq(qualified.length, 2, "Only participants with >= 3 fish qualify");
assert_eq(qualified[0].charId, 2, "P2 is first qualified winner despite P1 having higher raw weight");

// 4. Daily Scheduler Date-Key Generation
console.log("\n[4] Daily Scheduler Date-Key Generation");
function makeEventKey(dateStr, eventType, hour) {
    const padHour = String(hour).padStart(2, '0');
    return `${dateStr}:${eventType}:${padHour}`;
}

const keyDay1 = makeEventKey("2026-09-29", "fishing_tournament", 14);
const keyDay2 = makeEventKey("2026-09-30", "fishing_tournament", 14);

assert_eq(keyDay1, "2026-09-29:fishing_tournament:14", "Day 1 key formatted correctly");
assert_eq(keyDay2, "2026-09-30:fishing_tournament:14", "Day 2 key formatted correctly");
assert_true(keyDay1 !== keyDay2, "Scheduler starts cleanly every day without colliding with yesterday's hour");

// 5. Mid-Window Recovery Check
console.log("\n[5] Mid-Window Event Recovery Calculation");
function checkWindowRecovery(startEpoch, durationSec, currentEpoch) {
    const endEpoch = startEpoch + durationSec;
    if (currentEpoch >= startEpoch && currentEpoch < endEpoch) {
        const remaining = endEpoch - currentEpoch;
        return { canRecover: true, remaining };
    }
    return { canRecover: false, remaining: 0 };
}

const start14 = 1790683200;
const inWindow = start14 + 1500;
const resA = checkWindowRecovery(start14, 3600, inWindow);
assert_true(resA.canRecover, "14:25 restart inside 14:00-15:00 window triggers recovery");
assert_eq(resA.remaining, 2100, "Remaining duration is exactly 2100 seconds (35 mins)");

const afterWindow = start14 + 4800;
const resB = checkWindowRecovery(start14, 3600, afterWindow);
assert_eq(resB.canRecover, false, "Server start at 15:20 after window does NOT start missed event");

console.log(`\n=== Test Suite Complete: ${passed} Passed, ${failed} Failed ===`);
if (failed > 0) {
    process.exit(1);
}
