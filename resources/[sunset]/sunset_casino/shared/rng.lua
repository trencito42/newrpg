-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — Casino server-side RNG + audit log helper (SERVER ONLY)
--  Included via server_scripts '@sunset_casino/shared/rng.lua' by every
--  gambling resource. Defines the globals CasinoRNG and CasinoLog in the
--  including resource's own Lua environment.
--
--  RNG: reads from the OS CSPRNG (/dev/urandom) with rejection sampling (no
--  modulo bias). If /dev/urandom is unavailable it falls back to math.random
--  seeded with a mix of os.time / os.clock / GetGameTimer / a counter and
--  re-mixed on every call. Gameplay outcomes must NEVER come from a client.
-- ═══════════════════════════════════════════════════════════════

CasinoRNG = CasinoRNG or {}

local urandom = nil
local buf, bufPos = '', 1
local counter = 0
local fallbackWarned = false

local function openUrandom()
    if urandom ~= nil then return urandom end
    local ok, fh = pcall(io.open, '/dev/urandom', 'rb')
    urandom = (ok and fh) or false
    return urandom
end

local function mixSeed()
    counter = counter + 1
    local t = (os.time() * 1000003) ~ (math.floor(os.clock() * 1e6)) ~ (GetGameTimer and GetGameTimer() or 0) ~ (counter * 2654435761)
    math.randomseed(t & 0x7fffffff)
end

local function nextByte()
    if bufPos > #buf then
        local fh = openUrandom()
        local chunk = fh and fh:read(512) or nil
        if not chunk or #chunk < 8 then return nil end
        buf, bufPos = chunk, 1
    end
    local b = buf:byte(bufPos)
    bufPos = bufPos + 1
    return b
end

local function next32()
    local v = 0
    for _ = 1, 4 do
        local b = nextByte()
        if not b then return nil end
        v = (v << 8) | b
    end
    return v
end

-- Uniform integer in [lo, hi] (inclusive).
function CasinoRNG.Int(lo, hi)
    lo = math.floor(tonumber(lo) or 1)
    hi = math.floor(tonumber(hi) or lo)
    if hi < lo then lo, hi = hi, lo end
    local span = hi - lo + 1
    if span <= 1 then return lo end
    if span <= 0xFFFFFFFF then
        local limit = 0x100000000 - (0x100000000 % span)
        for _ = 1, 16 do
            local v = next32()
            if not v then break end
            if v < limit then return lo + (v % span) end
        end
    end
    if not fallbackWarned then
        fallbackWarned = true
        print('^3[casino-rng]^7 /dev/urandom unavailable, using mixed math.random fallback')
    end
    mixSeed()
    return math.random(lo, hi)
end

-- Fisher-Yates in place.
function CasinoRNG.Shuffle(t)
    for i = #t, 2, -1 do
        local j = CasinoRNG.Int(1, i)
        t[i], t[j] = t[j], t[i]
    end
    return t
end

-- Weighted pick: weights = { w1, w2, ... } -> index
function CasinoRNG.Weighted(weights)
    local total = 0
    for i = 1, #weights do total = total + weights[i] end
    local roll = CasinoRNG.Int(1, total)
    local acc = 0
    for i = 1, #weights do
        acc = acc + weights[i]
        if roll <= acc then return i end
    end
    return #weights
end

-- Unguessable single-use token (spin nonce).
function CasinoRNG.Token()
    return ('%08x%08x'):format(CasinoRNG.Int(0, 0xFFFFFFFE), CasinoRNG.Int(0, 0xFFFFFFFE))
end

-- ── Strict integer validation helper (rejects NaN/inf/float/string/negative) ──
function CasinoRNG.IsInt(v, lo, hi)
    if type(v) ~= 'number' then return false end
    if v ~= v or v == math.huge or v == -math.huge then return false end
    if v ~= math.floor(v) then return false end
    if lo and v < lo then return false end
    if hi and v > hi then return false end
    return true
end

-- ═══════════════════════════════════════════════════════════════
--  CasinoLog: audit row for every settled game / refund. Best effort
--  (never blocks or breaks gameplay); also printed to the server log.
-- ═══════════════════════════════════════════════════════════════
CasinoLog = CasinoLog or {}
local logTableReady = false

function CasinoLog.Record(charId, game, event, bet, payout, detail)
    charId = tonumber(charId) or 0
    bet = math.floor(tonumber(bet) or 0)
    payout = math.floor(tonumber(payout) or 0)
    game = tostring(game or '?'):sub(1, 24)
    event = tostring(event or '?'):sub(1, 24)
    detail = tostring(detail or ''):sub(1, 250)
    print(('[casino-log] char=%d game=%s event=%s bet=%d payout=%d %s'):format(charId, game, event, bet, payout, detail))
    local ok = pcall(function()
        if GetResourceState('oxmysql') ~= 'started' then return end
        if not logTableReady then
            logTableReady = true
            exports.oxmysql:query([[CREATE TABLE IF NOT EXISTS casino_log (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                character_id INT UNSIGNED NOT NULL DEFAULT 0,
                game VARCHAR(24) NOT NULL,
                event VARCHAR(24) NOT NULL,
                bet INT NOT NULL DEFAULT 0,
                payout INT NOT NULL DEFAULT 0,
                detail VARCHAR(255) NOT NULL DEFAULT '',
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                KEY idx_char (character_id, created_at)
            )]], {}, function() end)
        end
        exports.oxmysql:insert(
            'INSERT INTO casino_log (character_id, game, event, bet, payout, detail) VALUES (?, ?, ?, ?, ?, ?)',
            { charId, game, event, bet, payout, detail }, function() end)
    end)
    return ok
end

-- ═══════════════════════════════════════════════════════════════
--  CasinoPending: chips owed to a character that could not be credited
--  (player already gone on disconnect/resource stop, inventory full, DB hiccup).
--  Persisted so a crash/restart never destroys funds and never duplicates them:
--  a row is claimed with  UPDATE ... SET claimed=1 WHERE id=? AND claimed=0
--  (affected rows == 1) BEFORE the chips are handed out.
--  Requires the including resource to load '@oxmysql/lib/MySQL.lua' first.
-- ═══════════════════════════════════════════════════════════════
CasinoPending = CasinoPending or {}
local pendingReady = false

local function ensurePendingTable()
    if pendingReady or not MySQL then return end
    pendingReady = true
    pcall(function()
        MySQL.query.await([[CREATE TABLE IF NOT EXISTS casino_pending_chips (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            character_id INT UNSIGNED NOT NULL,
            chips INT NOT NULL,
            reason VARCHAR(48) NOT NULL DEFAULT '',
            claimed TINYINT NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_char (character_id, claimed)
        )]])
    end)
end

function CasinoPending.Add(charId, chips, reason)
    charId = tonumber(charId)
    chips = math.floor(tonumber(chips) or 0)
    if not charId or charId < 1 or chips < 1 then return false end
    CasinoLog.Record(charId, 'pending', 'owed', 0, chips, tostring(reason or ''))
    if not MySQL then return false end
    ensurePendingTable()
    local ok, id = pcall(function()
        return MySQL.insert.await('INSERT INTO casino_pending_chips (character_id, chips, reason) VALUES (?, ?, ?)',
            { charId, chips, tostring(reason or ''):sub(1, 48) })
    end)
    return ok and id ~= nil
end

-- giveFn(chips) -> boolean. Claims every unclaimed row exactly once.
function CasinoPending.Claim(charId, giveFn)
    charId = tonumber(charId)
    if not charId or not MySQL then return 0 end
    ensurePendingTable()
    local okQ, rows = pcall(function()
        return MySQL.query.await('SELECT id, chips FROM casino_pending_chips WHERE character_id = ? AND claimed = 0 LIMIT 20', { charId })
    end)
    if not okQ or type(rows) ~= 'table' then return 0 end
    local total = 0
    for _, row in ipairs(rows) do
        local okC, changed = pcall(function()
            return MySQL.update.await('UPDATE casino_pending_chips SET claimed = 1 WHERE id = ? AND claimed = 0', { row.id })
        end)
        if okC and tonumber(changed) == 1 then
            if giveFn(row.chips) then
                total = total + row.chips
                CasinoLog.Record(charId, 'pending', 'claimed', 0, row.chips, 'row ' .. tostring(row.id))
            else
                pcall(function()
                    MySQL.update.await('UPDATE casino_pending_chips SET claimed = 0 WHERE id = ?', { row.id })
                end)
            end
        end
    end
    return total
end
