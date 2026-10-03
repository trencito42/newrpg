-- [INVENTORY API] Transactional, validated, optionally idempotent inventory
-- mutation API. sunset_inventory is the ONLY resource that may write
-- character_inventory / container_inventory (docs/architecture/DOMAIN_OWNERSHIP.md).
--
--   exports.sunset_inventory:ApplyOperation(source, ops, opts) -> result
--
--   ops   = array (1..MAX_OPS) of:
--             { type='add',          item=, count=, metadata=?, slot=? }
--             { type='remove',       item=, count=, rowId=? }
--             { type='set_metadata', item=, rowId=?, metadata=table, merge=bool?, expect=table? }
--   opts  = { opId=string?,       -- idempotency key (per character, 10 min window)
--             characterId=number? -- OFFLINE mode when source is nil/0: no weight/licence
--                                 -- checks, no client push; cache is invalidated
--           }
--   result= { ok=true,  results={...per op...}, inverse={...ops that undo this call...}, replayed=bool? }
--         | { ok=false, error=<code>, opIndex=n? }
--
-- Guarantees: all ops run on ONE MySQL transaction after locking the whole
-- character inventory (SELECT ... FOR UPDATE); any failed op rolls back ALL.
-- Counts must be whole numbers in [1, MAX_OP_COUNT] (floats/NaN/huge rejected,
-- never silently floored). Weight is enforced on the final state only when the
-- call increases carried weight.
--
-- `inverse` lets a caller in another domain compensate if a LATER step of its own
-- unit of work fails (see sunset_vehicles fuel flows): ApplyOperation(source, result.inverse).

local MAX_OPS = 16
local MAX_OP_COUNT = 100000
local MAX_STACK = 2000000000
local MAX_METADATA_BYTES = 2048
local OPID_TTL_MS = 600000
local OPID_MAX_ENTRIES = 512
local LOCK_WAIT_MS = 4000
local EPS = 0.001

local Applied = {}      -- [characterId .. ':' .. opId] = { at = ms, result = table } | { pending = true }
local AppliedOrder = {} -- FIFO of keys for bounded eviction
local CharLocks = {}    -- [characterId] = true while an ApplyOperation is in flight

local function whole(v, min, max)
    return type(v) == 'number' and v == v and v ~= math.huge and v ~= -math.huge
        and v == math.floor(v) and v >= min and v <= max
end

local function validName(v)
    return type(v) == 'string' and #v >= 1 and #v <= 64 and v:match('^[%w_%.%-]+$') ~= nil
end

local function hasMeta(t)
    return type(t) == 'table' and next(t) ~= nil
end

local function decodeMeta(raw)
    if raw == nil or raw == '' then return nil end
    if type(raw) == 'table' then return raw end
    local ok, v = pcall(json.decode, raw)
    if ok and type(v) == 'table' then return v end
    return nil
end

local function encodeMeta(t)
    if not hasMeta(t) then return '' end
    return json.encode(t)
end

local function copyTable(t)
    if type(t) ~= 'table' then return t end
    local out = {}
    for k, v in pairs(t) do out[k] = copyTable(v) end
    return out
end

local function metaEquals(a, b)
    if type(a) == 'number' and type(b) == 'number' then return math.abs(a - b) <= EPS end
    return a == b
end

-- Pure validation: returns normalized ops or (nil, errorCode, opIndex).
local function validateOps(ops)
    if type(ops) ~= 'table' then return nil, 'invalid_ops', 0 end
    local n = #ops
    if n < 1 or n > MAX_OPS then return nil, 'invalid_ops', 0 end
    local out = {}
    for i = 1, n do
        local op = ops[i]
        if type(op) ~= 'table' then return nil, 'invalid_op', i end
        local t = op.type
        if t ~= 'add' and t ~= 'remove' and t ~= 'set_metadata' then return nil, 'invalid_op_type', i end
        if not validName(op.item) then return nil, 'invalid_item', i end
        local norm = { type = t, item = op.item }
        if op.rowId ~= nil then
            if not whole(op.rowId, 1, 4294967295) then return nil, 'invalid_row', i end
            norm.rowId = op.rowId
        end
        if t == 'add' then
            if not Sunset.Items[op.item] then return nil, 'unknown_item', i end
            if not whole(op.count, 1, MAX_OP_COUNT) then return nil, 'invalid_count', i end
            norm.count = op.count
            if op.slot ~= nil then
                if not whole(op.slot, 1, Sunset.Config.MaxSlots) then return nil, 'invalid_slot', i end
                norm.slot = op.slot
            end
            if op.metadata ~= nil then
                if type(op.metadata) ~= 'table' then return nil, 'invalid_metadata', i end
                local ok, enc = pcall(json.encode, op.metadata)
                if not ok or type(enc) ~= 'string' or #enc > MAX_METADATA_BYTES then return nil, 'invalid_metadata', i end
                norm.metadata = op.metadata
            end
        elseif t == 'remove' then
            if not whole(op.count, 1, MAX_OP_COUNT) then return nil, 'invalid_count', i end
            norm.count = op.count
        else
            if type(op.metadata) ~= 'table' then return nil, 'invalid_metadata', i end
            local ok, enc = pcall(json.encode, op.metadata)
            if not ok or type(enc) ~= 'string' or #enc > MAX_METADATA_BYTES then return nil, 'invalid_metadata', i end
            norm.metadata = op.metadata
            norm.merge = op.merge == true
            if op.expect ~= nil then
                if type(op.expect) ~= 'table' then return nil, 'invalid_expect', i end
                norm.expect = op.expect
            end
        end
        out[i] = norm
    end
    return out
end
InventoryValidateOps = validateOps -- global only for in-resource reuse/tests

local function weigh(live)
    local total = 0
    for _, row in ipairs(live) do
        total = total + InventoryInternal.getItemWeight(row.item, row.count)
    end
    return total
end

local function findFreeSlot(live, wanted)
    local used = {}
    for _, row in ipairs(live) do used[row.slot] = true end
    if wanted then return (not used[wanted]) and wanted or nil end
    for i = 1, Sunset.Config.MaxSlots do
        if not used[i] then return i end
    end
    return nil
end

-- Executes ONE op against the locked snapshot `live` using the transaction
-- connection `query`. Returns result, inverseOps | nil, errorCode.
local function applyOne(query, characterId, live, op)
    if op.type == 'add' then
        local def = Sunset.Items[op.item]
        local metadata = op.metadata
        if not metadata and op.item == 'gas_can' then
            metadata = { liters = 0 }
        elseif not metadata and def.weapon then
            metadata = { serial = ('LS-%06d-%06d'):format(tonumber(characterId) or 0, math.random(0, 999999)) }
        end
        local stackable = not hasMeta(metadata) and not def.weapon and op.item ~= 'gas_can'
        if stackable then
            for _, row in ipairs(live) do
                if row.item == op.item and not hasMeta(row.meta) and (not op.slot or row.slot == op.slot) then
                    local newCount = row.count + op.count
                    if newCount > MAX_STACK then return nil, 'stack_limit' end
                    local changed = query.update.await(
                        'UPDATE character_inventory SET count = count + ? WHERE id = ? AND character_id = ?',
                        { op.count, row.id, characterId })
                    if tonumber(changed) ~= 1 then return nil, 'db_conflict' end
                    row.count = newCount
                    return { type = 'add', item = op.item, count = op.count, rowId = row.id, stacked = true },
                        { { type = 'remove', item = op.item, count = op.count, rowId = row.id } }
                end
            end
        end
        local slot = findFreeSlot(live, op.slot)
        if not slot then return nil, 'no_space' end
        local id = query.insert.await(
            'INSERT INTO character_inventory (character_id, item, count, slot, metadata) VALUES (?, ?, ?, ?, NULLIF(?, \'\'))',
            { characterId, op.item, op.count, slot, encodeMeta(metadata) })
        if not id then return nil, 'db_error' end
        live[#live + 1] = { id = id, item = op.item, count = op.count, slot = slot, meta = copyTable(metadata) }
        return { type = 'add', item = op.item, count = op.count, rowId = id, slot = slot },
            { { type = 'remove', item = op.item, count = op.count, rowId = id } }
    end

    if op.type == 'remove' then
        local targets, remaining = {}, op.count
        if op.rowId then
            for _, row in ipairs(live) do
                if row.id == op.rowId and row.item == op.item then
                    if row.count < remaining then return nil, 'insufficient' end
                    targets[1] = { row = row, take = remaining }
                    remaining = 0
                end
            end
            if remaining > 0 then return nil, 'row_missing' end
        else
            for _, row in ipairs(live) do
                if remaining <= 0 then break end
                if row.item == op.item and row.count > 0 then
                    local take = math.min(row.count, remaining)
                    targets[#targets + 1] = { row = row, take = take }
                    remaining = remaining - take
                end
            end
            if remaining > 0 then return nil, 'insufficient' end
        end
        local inverse = {}
        for _, t in ipairs(targets) do
            local changed = query.update.await(
                'UPDATE character_inventory SET count = count - ? WHERE id = ? AND character_id = ? AND item = ? AND count >= ?',
                { t.take, t.row.id, characterId, op.item, t.take })
            if tonumber(changed) ~= 1 then return nil, 'db_conflict' end
            inverse[#inverse + 1] = { type = 'add', item = op.item, count = t.take, metadata = copyTable(t.row.meta) }
            t.row.count = t.row.count - t.take
            if t.row.count <= 0 then
                local deleted = query.update.await(
                    'DELETE FROM character_inventory WHERE id = ? AND character_id = ? AND count <= 0',
                    { t.row.id, characterId })
                if tonumber(deleted) ~= 1 then return nil, 'db_conflict' end
                for i = #live, 1, -1 do
                    if live[i].id == t.row.id then table.remove(live, i) break end
                end
            end
        end
        return { type = 'remove', item = op.item, count = op.count }, inverse
    end

    -- set_metadata
    local row
    for _, r in ipairs(live) do
        if r.item == op.item and ((op.rowId and r.id == op.rowId) or (not op.rowId)) then row = r break end
    end
    if not row then return nil, 'row_missing' end
    if op.expect then
        for k, v in pairs(op.expect) do
            local cur = type(row.meta) == 'table' and row.meta[k] or nil
            if not metaEquals(cur, v) then return nil, 'precondition_failed' end
        end
    end
    local old = copyTable(row.meta)
    local new
    if op.merge then
        new = copyTable(old) or {}
        for k, v in pairs(op.metadata) do new[k] = v end
    else
        new = copyTable(op.metadata)
    end
    local newEnc, oldEnc = encodeMeta(new), encodeMeta(old)
    if newEnc ~= oldEnc then
        local changed = query.update.await(
            'UPDATE character_inventory SET metadata = NULLIF(?, \'\') WHERE id = ? AND character_id = ?',
            { newEnc, row.id, characterId })
        if tonumber(changed) ~= 1 then return nil, 'db_conflict' end
    end
    row.meta = hasMeta(new) and new or nil
    return { type = 'set_metadata', item = op.item, rowId = row.id },
        { { type = 'set_metadata', item = op.item, rowId = row.id, metadata = old or {} } }
end

local function runOps(query, characterId, ops, enforceWeight, maxWeight)
    local rows = query.query.await(
        'SELECT id, item, count, slot, metadata FROM character_inventory WHERE character_id = ? ORDER BY slot FOR UPDATE',
        { characterId }) or {}
    local live = {}
    for _, r in ipairs(rows) do
        live[#live + 1] = { id = tonumber(r.id), item = r.item, count = tonumber(r.count) or 0,
            slot = tonumber(r.slot), meta = decodeMeta(r.metadata) }
    end
    local before = weigh(live)
    local results, inverse = {}, {}
    for i, op in ipairs(ops) do
        local res, inv = applyOne(query, characterId, live, op)
        if not res then return nil, inv, i end -- inv carries the error code here
        results[#results + 1] = res
        for _, x in ipairs(inv) do inverse[#inverse + 1] = x end
    end
    if enforceWeight then
        local after = weigh(live)
        if after > before + 1e-9 and after > maxWeight then return nil, 'overweight', 0 end
    end
    -- compensation must undo in reverse order
    local rev = {}
    for i = #inverse, 1, -1 do rev[#rev + 1] = inverse[i] end
    return { results = results, inverse = rev }
end

local function acquire(characterId)
    local waited = 0
    while CharLocks[characterId] do
        if waited >= LOCK_WAIT_MS then return false end
        Wait(25)
        waited = waited + 25
    end
    CharLocks[characterId] = true
    return true
end

local function rememberOp(key, result)
    Applied[key] = { at = GetGameTimer(), result = result }
    AppliedOrder[#AppliedOrder + 1] = key
    local now = GetGameTimer()
    while #AppliedOrder > 0 do
        local oldest = AppliedOrder[1]
        local entry = Applied[oldest]
        if #AppliedOrder > OPID_MAX_ENTRIES or not entry or (entry.at and now - entry.at > OPID_TTL_MS) then
            table.remove(AppliedOrder, 1)
            Applied[oldest] = nil
        else
            break
        end
    end
end

function ApplyOperation(source, ops, opts)
    opts = type(opts) == 'table' and opts or {}
    local norm, verr, vidx = validateOps(ops)
    if not norm then return { ok = false, error = verr, opIndex = vidx } end

    local opId = opts.opId
    if opId ~= nil and (type(opId) ~= 'string' or #opId < 1 or #opId > 64) then
        return { ok = false, error = 'invalid_op_id' }
    end

    local online = type(source) == 'number' and source > 0
    local characterId
    if online then
        local char = exports.sunset_core:GetCharacter(source)
        if not char then return { ok = false, error = 'no_character' } end
        characterId = tonumber(char.id)
    else
        characterId = tonumber(opts.characterId)
    end
    if not characterId or characterId < 1 then return { ok = false, error = 'no_character' } end

    local hasRemove, weaponAdd = false, false
    for _, op in ipairs(norm) do
        if op.type == 'remove' then hasRemove = true end
        if op.type == 'add' then
            local def = Sunset.Items[op.item]
            if def.weapon and not InventoryInternal.LICENSE_EXEMPT_WEAPONS[string.upper(def.weapon)] then weaponAdd = true end
        end
    end
    if online and hasRemove and type(IsInventoryTradeLocked) == 'function' and IsInventoryTradeLocked(source) then
        return { ok = false, error = 'trade_locked' }
    end
    if online and weaponAdd then
        if GetResourceState('sunset_licenses') ~= 'started'
            or not exports.sunset_licenses:HasLicense(source, 'weapon') then
            return { ok = false, error = 'license_required' }
        end
    end

    local key = opId and (characterId .. ':' .. opId) or nil
    if key then
        local seen = Applied[key]
        if seen then
            if seen.pending then return { ok = false, error = 'in_progress' } end
            local replay = copyTable(seen.result)
            replay.replayed = true
            return replay
        end
        Applied[key] = { pending = true }
    end
    local function done(result)
        if key then
            if result.ok then rememberOp(key, copyTable(result)) else Applied[key] = nil end
        end
        return result
    end

    if not acquire(characterId) then return done({ ok = false, error = 'busy' }) end
    local out, errCode, errIdx
    local committed = MySQL.startTransaction(function(query)
        local r, e, i = runOps(query, characterId, norm, online,
            online and InventoryInternal.maxWeightFor(source) or 0)
        if not r then errCode, errIdx = e, i return false end
        out = r
        return true
    end)
    CharLocks[characterId] = nil

    if not committed or not out then
        -- Roll back happened in the DB; resync the cache defensively.
        if online then
            InventoryInternal.loadInventory(characterId)
        end
        return done({ ok = false, error = errCode or 'db_error', opIndex = errIdx })
    end

    if online and GetPlayerName(source) then
        local inv = InventoryInternal.loadInventory(characterId)
        InventoryInternal.sendInventoryUpdate(source, inv)
    else
        -- character not (known to be) online: force reload on next read
        InventoryInternal.invalidate(characterId)
    end
    return done({ ok = true, results = out.results, inverse = out.inverse })
end
exports('ApplyOperation', ApplyOperation)

-- Canonical administrative clear path for online or offline characters.
-- Cross-domain tools must call this export instead of writing inventory tables.
function ClearCharacterInventory(characterId)
    characterId = tonumber(characterId)
    if not characterId or characterId < 1 or characterId ~= math.floor(characterId) then return false, 'no_character' end
    if not acquire(characterId) then return false, 'busy' end
    local ok, changed = pcall(MySQL.update.await, 'DELETE FROM character_inventory WHERE character_id = ?', { characterId })
    CharLocks[characterId] = nil
    if not ok then return false, 'db_error' end
    InventoryInternal.invalidate(characterId)
    return true, tonumber(changed) or 0
end
exports('ClearCharacterInventory', ClearCharacterInventory)

-- Offline-safe removal of robbery loot for a character (robbery fallback path).
exports('RemoveStolenByRobbery', function(characterId, robberyId)
    characterId = tonumber(characterId)
    robberyId = tostring(robberyId or '')
    if not characterId or robberyId == '' then return 0 end
    local changed = MySQL.update.await([[
        DELETE FROM character_inventory
        WHERE character_id = ?
          AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.robbery')) = ?
          AND JSON_EXTRACT(metadata, '$.stolen') = true
    ]], { characterId, robberyId })
    InventoryInternal.invalidate(characterId)
    return tonumber(changed) or 0
end)

-- Startup recovery: delete stolen loot belonging to the given (abandoned) robbery sessions.
exports('PurgeStolenLoot', function(sessionIds)
    if type(sessionIds) ~= 'table' then return 0 end
    local total = 0
    local batch = {}
    local function flush()
        if #batch == 0 then return end
        total = total + (tonumber(MySQL.update.await([[
            DELETE FROM character_inventory
            WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.robbery')) IN (?)
              AND JSON_EXTRACT(metadata, '$.stolen') = true
        ]], { batch })) or 0)
        batch = {}
    end
    for _, id in ipairs(sessionIds) do
        if type(id) == 'string' and id ~= '' then
            batch[#batch + 1] = id
            if #batch >= 100 then flush() end
        end
    end
    flush()
    InventoryInternal.invalidateAll()
    return total
end)
