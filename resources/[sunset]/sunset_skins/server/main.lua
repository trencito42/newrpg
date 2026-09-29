local function getPlayer(source)
    return exports.sunset_core:GetPlayer(source)
end

local function getCharacter(source)
    return exports.sunset_core:GetCharacter(source)
end

local function skinByModel(model)
    for _, s in ipairs(SunsetSkins.Skins) do
        if s.model == model then return s end
    end
end

-- Returns all skins with owned flag for this player
exports.sunset_core:RegisterCallback('skins:getAll', function(source)
    local player = getPlayer(source)
    if not player then return nil, 'Not authenticated' end

    local rows = MySQL.query.await('SELECT model FROM player_skins WHERE player_id = ?', { player.id })
    local owned = {}
    local knownModels = {}
    for _, r in ipairs(rows or {}) do owned[r.model] = true end

    local result = {}
    for _, s in ipairs(SunsetSkins.Skins) do
        knownModels[s.model] = true
        result[#result + 1] = {
            model      = s.model,
            label      = s.label,
            category   = s.category,
            priceCash  = s.priceCash  or 0,
            pricePP    = s.pricePP    or 0,
            battlepass = s.battlepass or false,
            owned      = owned[s.model] or false,
        }
    end

    -- Dynamically append any custom/admin skins owned by the player that aren't in config
    for model, _ in pairs(owned) do
        if not knownModels[model] then
            local formattedLabel = model:gsub('^%l', string.upper):gsub('_', ' ')
            result[#result + 1] = {
                model      = model,
                label      = formattedLabel,
                category   = 'special',
                priceCash  = 0,
                pricePP    = 0,
                battlepass = false,
                owned      = true,
            }
        end
    end

    return result
end)

-- Buy a skin (currency = 'cash' | 'pp')
exports.sunset_core:RegisterCallback('skins:buy', function(source, model, currency)
    local player = getPlayer(source)
    local char   = getCharacter(source)
    if not player or not char then return nil, 'Not authenticated' end

    local cfg = skinByModel(model)
    if not cfg then return nil, 'Unknown skin' end
    if cfg.battlepass then return nil, 'This skin is a Battlepass exclusive' end

    local existing = MySQL.query.await(
        'SELECT id FROM player_skins WHERE player_id = ? AND model = ?',
        { player.id, model }
    )
    if existing and #existing > 0 then return nil, 'Skin already owned' end

    if currency == 'pp' then
        local ok = exports.sunset_core:SpendBlazePoints(source, cfg.pricePP)
        if not ok then
            return nil, ('Not enough Premium Points — need %d PP'):format(cfg.pricePP)
        end
    else
        local ok = exports.sunset_core:RemoveMoney(source, 'cash', cfg.priceCash, 'skin_shop')
        if not ok then
            return nil, ('Not enough cash — need $%s'):format(cfg.priceCash)
        end
    end

    MySQL.query.await(
        'INSERT INTO player_skins (player_id, model, source) VALUES (?, ?, ?)',
        { player.id, model, 'shop' }
    )
    return { success = true }
end)

-- Equip (switch active skin); saves to character metadata + triggers client model change
exports.sunset_core:RegisterCallback('skins:equip', function(source, model)
    local player = getPlayer(source)
    local char   = getCharacter(source)
    if not player or not char then return nil, 'Not authenticated' end

    if model and model ~= '' then
        local existing = MySQL.query.await(
            'SELECT id FROM player_skins WHERE player_id = ? AND model = ?',
            { player.id, model }
        )
        if not existing or #existing == 0 then return nil, 'Skin not owned' end
    end

    local meta = char.metadata or {}
    meta.skin = (model ~= nil and model ~= '' and model ~= 'default' and model ~= 'reset') and model or nil
    char.metadata = meta
    MySQL.update.await('UPDATE characters SET metadata = ? WHERE id = ?', { json.encode(meta), char.id })

    TriggerClientEvent('sunset:skins:applyModel', source, meta.skin or '')
    return { success = true }
end)

-- /giveskin [id] [model]  (admin rank 3+)
RegisterCommand('giveskin', function(source, args)
    local reqLevel = exports.sunset_admin:GetCommandRequiredLevel('giveskin') or 3
    if source ~= 0 and not exports.sunset_admin:IsAdmin(source, reqLevel) then
        exports.sunset_core:CommandDenyAdmin(source)
        return
    end
    local targetId = tonumber(args[1])
    local model    = args[2]
    if not targetId or not model then
        exports.sunset_core:CommandUsage(source, '/giveskin [id] [model]')
        return
    end
    local target = exports.sunset_core:GetPlayer(targetId)
    if not target then
        exports.sunset_core:CommandPlayerNotFound(source, tostring(targetId))
        return
    end
    local already = MySQL.query.await(
        'SELECT id FROM player_skins WHERE player_id = ? AND model = ?',
        { target.id, model }
    )
    if already and #already > 0 then
        exports.sunset_core:CommandReply(source, 'Player already owns that skin.')
        return
    end
    MySQL.query.await(
        'INSERT INTO player_skins (player_id, model, source) VALUES (?, ?, ?)',
        { target.id, model, 'admin' }
    )
    exports.sunset_core:CommandReply(source, ('Skin ~b~%s~w~ given to player %d.'):format(model, targetId))
    TriggerClientEvent('sunset:skins:notify', targetId, ('An admin gave you the skin: %s'):format(model))
end, false)

-- /setskin [model] or /setskin [id] [model]  (admin rank 1+, bypasses ownership — sets model and saves permanently)
RegisterCommand('setskin', function(source, args)
    local reqLevel = exports.sunset_admin:GetCommandRequiredLevel('setskin') or 1
    if source ~= 0 and not exports.sunset_admin:IsAdmin(source, reqLevel) then
        exports.sunset_core:CommandDenyAdmin(source)
        return
    end

    local targetSource, model
    if #args >= 2 and tonumber(args[1]) then
        targetSource = tonumber(args[1])
        model        = args[2]
    elseif #args >= 1 then
        targetSource = (source ~= 0) and source or nil
        model        = args[1]
    end

    if not targetSource or not model then
        exports.sunset_core:CommandUsage(source, '/setskin [model] or /setskin [id] [model]')
        return
    end

    local targetChar = exports.sunset_core:GetCharacter(targetSource)
    if not targetChar then
        exports.sunset_core:CommandPlayerNotFound(source, tostring(targetSource))
        return
    end

    local meta = targetChar.metadata or {}
    meta.skin = (model ~= '' and model ~= 'default' and model ~= 'reset') and model or nil
    targetChar.metadata = meta
    MySQL.update.await('UPDATE characters SET metadata = ? WHERE id = ?', { json.encode(meta), targetChar.id })

    local targetPlayer = getPlayer(targetSource)
    if targetPlayer and meta.skin then
        local already = MySQL.query.await(
            'SELECT id FROM player_skins WHERE player_id = ? AND model = ?',
            { targetPlayer.id, meta.skin }
        )
        if not already or #already == 0 then
            MySQL.query.await(
                'INSERT INTO player_skins (player_id, model, source) VALUES (?, ?, ?)',
                { targetPlayer.id, meta.skin, 'admin' }
            )
        end
    end

    TriggerClientEvent('sunset:skins:applyModel', targetSource, meta.skin or '')
    exports.sunset_core:CommandReply(source, ('Skin for player %d set and saved permanently to ~b~%s~w~.'):format(targetSource, tostring(meta.skin or 'default')))
end, false)

-- NOTE: the characterSelected delayed applyModel was removed.
-- sunset_spawn is the sole owner of SetPlayerModel during login; it already
-- reads char.metadata.skin via resolveModel() and applies the correct model
-- in one shot before streaming.  A second SetPlayerModel 1.2 s later would
-- invalidate spawn's cached ped handle, causing 0,0,0 coords and 18 s timeouts.
-- Runtime skin changes (equip callback, /setskin) still go through TriggerClientEvent
-- sunset:skins:applyModel directly — that path is unaffected.

-- Battlepass: called from sunset_pass to grant a skin on tier unlock
RegisterNetEvent('sunset:skins:grantBattlepassSkin')
AddEventHandler('sunset:skins:grantBattlepassSkin', function(model)
    local src    = source
    local player = getPlayer(src)
    if not player then return end
    local already = MySQL.query.await(
        'SELECT id FROM player_skins WHERE player_id = ? AND model = ?',
        { player.id, model }
    )
    if already and #already > 0 then return end
    MySQL.query.await(
        'INSERT INTO player_skins (player_id, model, source) VALUES (?, ?, ?)',
        { player.id, model, 'battlepass' }
    )
    TriggerClientEvent('sunset:skins:notify', src, ('Battlepass reward unlocked: skin %s'):format(model))
end)
