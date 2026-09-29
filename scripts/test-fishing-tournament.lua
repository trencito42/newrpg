#!/usr/bin/env lua
-- ═══════════════════════════════════════════════════════════════
--  Automated Unit Tests: Fishing Tournament Logic Suite
-- ═══════════════════════════════════════════════════════════════

local passed = 0
local failed = 0

local function assert_eq(actual, expected, testName)
    if actual == expected then
        passed = passed + 1
        print(string.format("  \27[32mPASS\27[0m %s", testName))
    else
        failed = failed + 1
        print(string.format("  \27[31mFAIL\27[0m %s: expected '%s', got '%s'", testName, tostring(expected), tostring(actual)))
    end
end

local function assert_true(condition, testName)
    assert_eq(not not condition, true, testName)
end

print("=== Starting Fishing Tournament Unit Tests ===")

-- 1. Weight integer conversion
print("\n[1] Weight Integer Conversion (Hectograms / Decagrams)")
local function toWeight10(kg)
    local raw = tonumber(kg) or 0
    return math.max(1, math.floor(raw * 10 + 0.5))
end

assert_eq(toWeight10(12.34), 123, "12.34 kg rounds to 123 (12.3 kg)")
assert_eq(toWeight10(12.36), 124, "12.36 kg rounds to 124 (12.4 kg)")
assert_eq(toWeight10(0.0), 1, "0.0 kg clamps to min 1 unit")
assert_eq(toWeight10(4.8), 48, "4.8 kg converts to 48")

-- 2. Ranking Comparator & 5-level Tie Breaker
print("\n[2] Deterministic Ranking & 5-Level Tie Breaker")
local function compareParticipants(a, b)
    -- 1. highest total weight
    if a.totalWeight10 ~= b.totalWeight10 then
        return a.totalWeight10 > b.totalWeight10
    end
    -- 2. highest single fish weight
    if a.biggestFishWeight10 ~= b.biggestFishWeight10 then
        return a.biggestFishWeight10 > b.biggestFishWeight10
    end
    -- 3. highest fish count
    if a.fishCount ~= b.fishCount then
        return a.fishCount > b.fishCount
    end
    -- 4. earliest lastCatchAt
    local tA = a.lastCatchAt or a.joinedAt or 0
    local tB = b.lastCatchAt or b.joinedAt or 0
    if tA ~= tB then
        return tA < tB
    end
    -- 5. characterId fallback
    return (tonumber(a.charId) or 0) < (tonumber(b.charId) or 0)
end

-- Test 2a: Higher total weight wins
local pA = { charId = 1, name = "Alice", totalWeight10 = 150, biggestFishWeight10 = 50, fishCount = 5, lastCatchAt = 100 }
local pB = { charId = 2, name = "Bob", totalWeight10 = 140, biggestFishWeight10 = 60, fishCount = 6, lastCatchAt = 50 }
assert_true(compareParticipants(pA, pB), "Higher total weight wins regardless of single fish")

-- Test 2b: Tie on total weight -> biggest single fish wins
local pC = { charId = 3, name = "Charlie", totalWeight10 = 150, biggestFishWeight10 = 60, fishCount = 4, lastCatchAt = 100 }
assert_true(compareParticipants(pC, pA), "Tie on total weight resolved by biggest single fish")

-- Test 2c: Tie on total weight & biggest fish -> fish count wins
local pD = { charId = 4, name = "Dan", totalWeight10 = 150, biggestFishWeight10 = 60, fishCount = 5, lastCatchAt = 100 }
assert_true(compareParticipants(pD, pC), "Tie on total weight & biggest fish resolved by fish count")

-- Test 2d: Tie on total weight, biggest fish & fish count -> earliest last catch wins
local pE = { charId = 5, name = "Eve", totalWeight10 = 150, biggestFishWeight10 = 60, fishCount = 5, lastCatchAt = 80 }
assert_true(compareParticipants(pE, pD), "Tie on catches resolved by earlier last catch time")

-- Test 2e: Absolute tie -> deterministic characterId fallback
local pF1 = { charId = 10, name = "Frank1", totalWeight10 = 150, biggestFishWeight10 = 60, fishCount = 5, lastCatchAt = 80 }
local pF2 = { charId = 20, name = "Frank2", totalWeight10 = 150, biggestFishWeight10 = 60, fishCount = 5, lastCatchAt = 80 }
assert_true(compareParticipants(pF1, pF2), "Absolute tie resolved deterministically by charId")

-- 3. Qualification Threshold Check (minFish = 3)
print("\n[3] Qualification Threshold (minFish = 3)")
local minFish = 3
local participants = {
    { charId = 1, name = "P1", totalWeight10 = 200, fishCount = 2 }, -- Unqualified!
    { charId = 2, name = "P2", totalWeight10 = 180, fishCount = 3 }, -- Qualified
    { charId = 3, name = "P3", totalWeight10 = 170, fishCount = 4 }, -- Qualified
}

local qualified = {}
for _, p in ipairs(participants) do
    if p.fishCount >= minFish then
        qualified[#qualified + 1] = p
    end
end
assert_eq(#qualified, 2, "Only participants with >= 3 fish qualify")
assert_eq(qualified[1].charId, 2, "P2 is first qualified winner despite P1 having higher raw weight")

-- 4. Daily Scheduler Date-Key Generation
print("\n[4] Daily Scheduler Date-Key Generation")
local function makeEventKey(dateStr, eventType, hour)
    return string.format("%s:%s:%02d", dateStr, eventType, tonumber(hour) or 0)
end

local keyDay1 = makeEventKey("2026-09-29", "fishing_tournament", 14)
local keyDay2 = makeEventKey("2026-09-30", "fishing_tournament", 14)

assert_eq(keyDay1, "2026-09-29:fishing_tournament:14", "Day 1 key formatted correctly")
assert_eq(keyDay2, "2026-09-30:fishing_tournament:14", "Day 2 key formatted correctly")
assert_true(keyDay1 ~= keyDay2, "Scheduler starts cleanly every day without colliding with yesterday's hour")

-- 5. Mid-Window Recovery Check
print("\n[5] Mid-Window Event Recovery Calculation")
local function checkWindowRecovery(startEpoch, durationSec, currentEpoch)
    local endEpoch = startEpoch + durationSec
    if currentEpoch >= startEpoch and currentEpoch < endEpoch then
        local remaining = endEpoch - currentEpoch
        return true, remaining
    end
    return false, 0
end

-- Scenario A: Server restarts at 14:25 (start 14:00, duration 3600s, current +1500s)
local start14 = 1790683200
local inWindow = start14 + 1500
local canRecover, remA = checkWindowRecovery(start14, 3600, inWindow)
assert_true(canRecover, "14:25 restart inside 14:00-15:00 window triggers recovery")
assert_eq(remA, 2100, "Remaining duration is exactly 2100 seconds (35 mins)")

-- Scenario B: Server starts at 15:20 (after 15:00 window)
local afterWindow = start14 + 4800
local canRecoverB, remB = checkWindowRecovery(start14, 3600, afterWindow)
assert_eq(canRecoverB, false, "Server start at 15:20 after window does NOT start missed event")

print(string.format("\n=== Test Suite Complete: %d Passed, %d Failed ===", passed, failed))
if failed > 0 then
    os.exit(1)
end
