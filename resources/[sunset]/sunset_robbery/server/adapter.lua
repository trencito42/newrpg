RobberyAdapter = {}

function RobberyAdapter.notify(source, message, kind, duration)
    TriggerClientEvent('sunset:client:notify', source, message, kind or 'info', duration or 5000)
end

function RobberyAdapter.getCharacter(source)
    return exports.sunset_core:GetCharacter(source)
end

function RobberyAdapter.isDead(source)
    if GetResourceState('sunset_death') ~= 'started' then return false end
    local ok, downed = pcall(function()
        return exports.sunset_death:IsPlayerDowned(source)
    end)
    return ok and downed == true
end

function RobberyAdapter.isPoliceRestricted(source)
    local char = RobberyAdapter.getCharacter(source)
    if not char then return true end
    local factionId = select(1, Sunset.GetCharacterFaction(char))
    if factionId and SunsetRobbery.BlockedFactions[factionId] then return true end
    return factionId and Sunset.FactionTypeMatches(factionId, 'law_enforcement')
end

function RobberyAdapter.isWanted(source)
    if GetResourceState('sunset_factions') ~= 'started' then return false end
    local ok, wanted = pcall(function()
        return exports.sunset_factions:GetWantedState(source)
    end)
    return ok and type(wanted) == 'table' and (tonumber(wanted.level) or 0) > 0
end

function RobberyAdapter.isJailed(source)
    if GetResourceState('sunset_factions') ~= 'started' then return false end
    local ok, jailed = pcall(function()
        return exports.sunset_factions:IsJailed(source) == true
    end)
    return ok and jailed == true
end

function RobberyAdapter.policeCount()
    local count = 0
    for _, id in ipairs(GetPlayers()) do
        local src = tonumber(id)
        local onDuty = false
        pcall(function()
            onDuty = exports.sunset_factions:IsOnDuty(src) == true
        end)
        if onDuty then
            local char = RobberyAdapter.getCharacter(src)
            local factionId = char and select(1, Sunset.GetCharacterFaction(char))
            if factionId and Sunset.FactionTypeMatches(factionId, 'law_enforcement') then
                count = count + 1
            end
        end
    end
    return count
end

function RobberyAdapter.hasItem(source, item, count)
    if not item then return true end
    if GetResourceState('sunset_inventory') ~= 'started' then return false end
    local ok, has = pcall(function()
        return exports.sunset_inventory:HasItem(source, item, count or 1)
    end)
    return ok and has == true
end

function RobberyAdapter.addItem(source, item, count, metadata)
    if GetResourceState('sunset_inventory') ~= 'started' then return false end
    local ok, added = pcall(function()
        return exports.sunset_inventory:AddItem(source, item, count or 1, nil, metadata)
    end)
    return ok and added == true
end

function RobberyAdapter.removeItem(source, item, count)
    if GetResourceState('sunset_inventory') ~= 'started' then return false end
    local ok, removed = pcall(function()
        return exports.sunset_inventory:RemoveItem(source, item, count or 1)
    end)
    return ok and removed == true
end

function RobberyAdapter.removeItemById(source, rowId, item, count)
    if GetResourceState('sunset_inventory') ~= 'started' then return false end
    local ok, removed = pcall(function()
        return exports.sunset_inventory:RemoveItemById(source, rowId, item, count or 1)
    end)
    return ok and removed == true
end

function RobberyAdapter.removeRobberyLoot(source, characterId, robberyId)
    robberyId = tostring(robberyId or '')
    characterId = tonumber(characterId)
    if robberyId == '' or not characterId then return 0, false end

    if GetResourceState('sunset_inventory') == 'started' and GetPlayerName(source) then
        local ok, removed = pcall(function()
            return exports.sunset_inventory:RemoveRobberyItems(source, robberyId)
        end)
        if ok then return tonumber(removed) or 0, true end
    end

    -- Offline fallback goes through the inventory-owned export (no direct SQL here).
    local ok, removed = pcall(function()
        return exports.sunset_inventory:RemoveStolenByRobbery(characterId, robberyId)
    end)
    if not ok then return 0, false end
    return tonumber(removed) or 0, true
end

function RobberyAdapter.addCash(source, amount)
    return exports.sunset_core:AddMoney(source, 'cash', amount, 'fence') == true
end

function RobberyAdapter.settleFenceSale(source, rowId, item, amount)
    local char = RobberyAdapter.getCharacter(source)
    rowId = tonumber(rowId)
    amount = math.floor(tonumber(amount) or 0)
    item = tostring(item or '')
    if not char or not rowId or amount < 1 or item == '' then return false end

    -- Domain-correct settlement (inventory + core own their tables):
    --   1) consume exactly one unit of the exact row via the transactional
    --      inventory API (fails safe if the row changed / was already sold);
    --   2) credit cash through core AddMoney (ledger + cache);
    --   3) if the credit fails, restore the item from the API's `inverse`.
    -- A repeated/raced sale of the same row fails at step 1, so it cannot pay twice.
    local ok, applied = pcall(function()
        return exports.sunset_inventory:ApplyOperation(source, {
            { type = 'remove', item = item, count = 1, rowId = rowId },
        }, {})
    end)
    if not ok or not applied or not applied.ok then return false end
    local paid = false
    pcall(function() paid = exports.sunset_core:AddMoney(source, 'cash', amount, 'fence') == true end)
    if not paid then
        local undo = exports.sunset_inventory:ApplyOperation(source, applied.inverse, {})
        if not (undo and undo.ok) then
            print(('[sunset_robbery] FENCE ROLLBACK FAILED src=%s item=%s row=%s'):format(tostring(source), item, tostring(rowId)))
        end
        return false
    end
    return true
end

function RobberyAdapter.getCooldown(scope, key)
    local ok, value = pcall(function()
        return MySQL.scalar.await(
            'SELECT expires_at FROM robbery_cooldowns WHERE scope = ? AND scope_key = ? LIMIT 1',
            { tostring(scope), tostring(key) }
        )
    end)
    if not ok then return nil end
    return tonumber(value) or 0
end

function RobberyAdapter.setCooldown(scope, key, expiresAt)
    local ok, changed = pcall(function()
        return MySQL.update.await([[
            INSERT INTO robbery_cooldowns (scope, scope_key, expires_at)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at)
        ]], { tostring(scope), tostring(key), tonumber(expiresAt) or 0 })
    end)
    return ok and changed ~= nil
end

function RobberyAdapter.clearCooldown(scope, key)
    pcall(function()
        MySQL.update.await('DELETE FROM robbery_cooldowns WHERE scope = ? AND scope_key = ?', {
            tostring(scope), tostring(key),
        })
    end)
end

function RobberyAdapter.audit(session, event, details)
    if not session then return end
    local payload = type(details) == 'table' and details or { reason = tostring(details or '') }
    CreateThread(function()
        pcall(function()
            MySQL.insert.await([[
                INSERT INTO robbery_audit
                    (session_id, character_id, location_id, event, bag_used, estimated_value, details)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ]], {
                session.id,
                session.characterId,
                session.locationId,
                tostring(event or 'unknown'):sub(1, 32),
                tonumber(session.bagUsed) or 0,
                tonumber(session.estimated) or 0,
                json.encode(payload),
            })
        end)
    end)
end

function RobberyAdapter.playerCoords(source)
    local ped = GetPlayerPed(source)
    if not ped or ped == 0 then return nil end
    return GetEntityCoords(ped)
end

function RobberyAdapter.dist(a, b)
    if not a or not b then return 9999.0 end
    return #(a - b)
end

function RobberyAdapter.getRobPoints(source)
    return exports.sunset_core:GetRobPoints(source)
end

function RobberyAdapter.takeRobPoints(source, amount)
    return exports.sunset_core:AddRobPoints(source, -(tonumber(amount) or 0))
end

function RobberyAdapter.refundRobPoints(source, amount)
    return exports.sunset_core:AddRobPoints(source, tonumber(amount) or 0)
end

function RobberyAdapter.startRun(session)
    local ok, id = pcall(function()
        return MySQL.insert.await([[
            INSERT INTO robbery_runs (session_id, character_id, location_id, status)
            VALUES (?, ?, ?, 'active')
        ]], { session.id, session.characterId, session.locationId })
    end)
    return ok and id ~= nil
end

function RobberyAdapter.finishRun(session, status)
    local ok, changed = pcall(function()
        return MySQL.update.await([[
            UPDATE robbery_runs
            SET status = ?, bag_used = ?, estimated_value = ?, finished_at = CURRENT_TIMESTAMP
            WHERE session_id = ? AND status = 'active'
        ]], {
            tostring(status), tonumber(session.bagUsed) or 0,
            tonumber(session.estimated) or 0, session.id,
        })
    end)
    return ok and tonumber(changed) and changed > 0
end

function RobberyAdapter.isCompletedLoot(robberyId, characterId)
    robberyId = tostring(robberyId or '')
    characterId = tonumber(characterId)
    if robberyId == '' or not characterId then return false end
    local ok, status = pcall(function()
        return MySQL.scalar.await(
            'SELECT status FROM robbery_runs WHERE session_id = ? AND character_id = ? LIMIT 1',
            { robberyId, characterId }
        )
    end)
    return ok and status == 'success'
end

function RobberyAdapter.issueWanted(source, reasonCode, silent)
    if GetResourceState('sunset_factions') ~= 'started' then return end
    local ok, wanted = pcall(function()
        return exports.sunset_factions:AddWantedCharge(source, reasonCode or 'robbery', nil, { silent = silent == true })
    end)
    if ok and wanted then
        local message = silent
            and ('You are wanted ★%d for robbery with no right to surrender. One star expires every 15 minutes online.'):format(wanted.level)
            or ('You are wanted ★%d for robbery with no right to surrender. LSPD was alerted; one star expires every 15 minutes online.'):format(wanted.level)
        RobberyAdapter.notify(source, message, 'error', 9000)
    end
end

function RobberyAdapter.isAdmin(source)
    if GetResourceState('sunset_admin') ~= 'started' then return false end
    local ok, level = pcall(function()
        return exports.sunset_admin:GetAdminLevel(source)
    end)
    return ok and (tonumber(level) or 0) >= 1
end


-- [PERF 2026-10-01] Retention: bounded batched purge of old audit/log rows (see sql/64-retention-indexes.sql).
CreateThread(function()
    Wait(120000)
    local purges = { { 'robbery_audit', 90 } }
    while true do
        for _, p in ipairs(purges) do
            for _ = 1, 20 do
                local ok, n = pcall(function()
                    return MySQL.update.await(('DELETE FROM `%s` WHERE created_at < (NOW() - INTERVAL ? DAY) LIMIT 2000'):format(p[1]), { p[2] })
                end)
                if not ok or (tonumber(n) or 0) < 2000 then break end
                Wait(1000)
            end
        end
        Wait(6 * 3600 * 1000)
    end
end)
